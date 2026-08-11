import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonOk, handleApiError } from "@/lib/api";
import { requireSessionUser } from "@/lib/session";
import { Department } from "@/models/Department";
import { User } from "@/models/User";

export async function GET() {
  try {
    const user = await requireSessionUser();
    await connectDB();

    let filter: Record<string, unknown> = { active: true };

    if (user.role === "general_manager") {
      // GM assigns to CEO, HR, managers, and external-contract employees
      filter = {
        active: true,
        $or: [
          { role: { $in: ["ceo", "hr", "manager"] } },
          { role: "employee", contractType: "external" },
        ],
      };
    } else if (user.role === "ceo") {
      // CEO assigns to HR, managers, and external-contract employees
      filter = {
        active: true,
        $or: [
          { role: { $in: ["hr", "manager"] } },
          { role: "employee", contractType: "external" },
        ],
      };
    } else if (user.role === "manager") {
      // Only employees assigned to this manager
      filter = {
        active: true,
        role: "employee",
        managerId: Types.ObjectId.isValid(user.id)
          ? new Types.ObjectId(user.id)
          : user.id,
      };
    } else {
      filter = { _id: user.id };
    }

    const users = await User.find(filter)
      .select("name email role departmentId managerId contractType")
      .populate("departmentId", "name")
      .sort({ role: 1, name: 1 })
      .lean();

    const managerIds = users
      .filter((u) => u.role === "manager")
      .map((u) => u._id);
    const managedBy = new Map<string, Array<{ _id: string; name: string }>>();
    if (managerIds.length > 0) {
      const depts = await Department.find({
        managerId: { $in: managerIds },
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

    // Managers → HR → external-contract employees (clear for CEO/GM pickers)
    const roleOrder = (role: string, contractType?: string) => {
      if (role === "ceo") return 0;
      if (role === "manager") return 1;
      if (role === "hr") return 2;
      if (role === "employee" && contractType === "external") return 3;
      return 9;
    };
    const payload = users
      .map((u) => ({
        _id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        contractType: u.contractType || "internal",
        departmentId: u.departmentId
          ? {
              _id: String(
                typeof u.departmentId === "object" &&
                  u.departmentId &&
                  "_id" in u.departmentId
                  ? (u.departmentId as { _id: unknown })._id
                  : u.departmentId
              ),
              name:
                typeof u.departmentId === "object" &&
                u.departmentId &&
                "name" in u.departmentId
                  ? String((u.departmentId as { name?: unknown }).name || "")
                  : "",
            }
          : null,
        managerId: u.managerId ? String(u.managerId) : null,
        managedDepartments:
          u.role === "manager" ? managedBy.get(String(u._id)) || [] : undefined,
      }))
      .sort((a, b) => {
        const oa = roleOrder(a.role, a.contractType);
        const ob = roleOrder(b.role, b.contractType);
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name, "ar");
      });

    return jsonOk(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
