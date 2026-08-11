import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonOk, handleApiError } from "@/lib/api";
import { getCeoControlledDepartmentIds } from "@/lib/departments";
import { requireSessionUser } from "@/lib/session";
import { Department } from "@/models/Department";
import { User } from "@/models/User";

export async function GET() {
  try {
    const user = await requireSessionUser();
    await connectDB();

    const ceoDeptIds = await getCeoControlledDepartmentIds();
    const ceoDeptOids = ceoDeptIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    let filter: Record<string, unknown> = { active: true };

    if (user.role === "general_manager") {
      filter = {
        active: true,
        $or: [
          { role: { $in: ["ceo", "hr", "manager"] } },
          { role: "employee", contractType: "external" },
          ...(ceoDeptOids.length
            ? [{ role: "employee", departmentId: { $in: ceoDeptOids } }]
            : []),
        ],
      };
    } else if (user.role === "ceo") {
      filter = {
        active: true,
        $or: [
          { role: { $in: ["hr", "manager"] } },
          { role: "employee", contractType: "external" },
          ...(ceoDeptOids.length
            ? [{ role: "employee", departmentId: { $in: ceoDeptOids } }]
            : []),
        ],
      };
    } else if (user.role === "manager") {
      filter = {
        active: true,
        role: "employee",
        managerId: Types.ObjectId.isValid(user.id)
          ? new Types.ObjectId(user.id)
          : user.id,
        contractType: { $ne: "external" },
        ...(ceoDeptOids.length
          ? { departmentId: { $nin: ceoDeptOids } }
          : {}),
      };
    } else {
      filter = { _id: user.id };
    }

    const users = await User.find(filter)
      .select("name email role departmentId managerId contractType")
      .populate("departmentId", "name underCeo")
      .sort({ role: 1, name: 1 })
      .lean();

    const managerIds = users
      .filter((u) => u.role === "manager")
      .map((u) => u._id);
    const managedBy = new Map<string, Array<{ _id: string; name: string }>>();
    if (managerIds.length > 0) {
      const depts = await Department.find({
        managerId: { $in: managerIds },
        underCeo: { $ne: true },
      })
        .select("_id name managerId")
        .lean();
      for (const d of depts) {
        const mid = String(d.managerId);
        const list = managedBy.get(mid) || [];
        list.push({ _id: String(d._id), name: d.name });
        managedBy.set(mid, list);
      }
    }

    const ceoDeptSet = new Set(ceoDeptIds);
    const roleOrder = (
      role: string,
      contractType?: string,
      departmentId?: string | null
    ) => {
      if (role === "ceo") return 0;
      if (role === "manager") return 1;
      if (role === "hr") return 2;
      if (
        role === "employee" &&
        (contractType === "external" ||
          (departmentId && ceoDeptSet.has(departmentId)))
      ) {
        return 3;
      }
      return 9;
    };

    const payload = users
      .map((u) => {
        const deptId = u.departmentId
          ? String(
              typeof u.departmentId === "object" &&
                u.departmentId &&
                "_id" in u.departmentId
                ? (u.departmentId as { _id: unknown })._id
                : u.departmentId
            )
          : null;
        const deptUnderCeo =
          (typeof u.departmentId === "object" &&
            u.departmentId &&
            "underCeo" in u.departmentId &&
            Boolean((u.departmentId as { underCeo?: boolean }).underCeo)) ||
          (deptId ? ceoDeptSet.has(deptId) : false);

        return {
          _id: String(u._id),
          name: u.name,
          email: u.email,
          role: u.role,
          contractType: u.contractType || "internal",
          underCeo: deptUnderCeo,
          departmentId: u.departmentId
            ? {
                _id: deptId || "",
                name:
                  typeof u.departmentId === "object" &&
                  u.departmentId &&
                  "name" in u.departmentId
                    ? String((u.departmentId as { name?: unknown }).name || "")
                    : "",
                underCeo: deptUnderCeo,
              }
            : null,
          managerId: u.managerId ? String(u.managerId) : null,
          managedDepartments:
            u.role === "manager"
              ? managedBy.get(String(u._id)) || []
              : undefined,
        };
      })
      .sort((a, b) => {
        const oa = roleOrder(a.role, a.contractType, a.departmentId?._id);
        const ob = roleOrder(b.role, b.contractType, b.departmentId?._id);
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name, "ar");
      });

    return jsonOk(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
