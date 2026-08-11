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
      // GM assigns to CEO, HR, and managers
      filter = {
        active: true,
        role: { $in: ["ceo", "hr", "manager"] },
      };
    } else if (user.role === "ceo") {
      // CEO assigns to HR and managers
      filter = {
        active: true,
        role: { $in: ["hr", "manager"] },
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
      .select("name email role departmentId managerId")
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

    // Normalize ids for mobile clients (avoid ObjectId edge cases)
    const payload = users.map((u) => ({
      _id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
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
    }));

    return jsonOk(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
