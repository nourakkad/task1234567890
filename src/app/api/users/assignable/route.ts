import { connectDB } from "@/lib/db";
import { jsonOk, handleApiError } from "@/lib/api";
import { requireSessionUser } from "@/lib/session";
import { User } from "@/models/User";

export async function GET() {
  try {
    const user = await requireSessionUser();
    await connectDB();

    let filter: Record<string, unknown> = { active: true };

    if (user.role === "ceo") {
      // CEO assigns tasks to managers only
      filter = {
        active: true,
        role: "manager",
      };
    } else if (user.role === "manager") {
      // Manager assigns tasks to employees only
      filter = {
        active: true,
        role: "employee",
        managerId: user.id,
      };
    } else {
      filter = { _id: user.id };
    }

    const users = await User.find(filter)
      .select("name email role departmentId managerId")
      .populate("departmentId", "name")
      .sort({ name: 1 })
      .lean();

    return jsonOk(users);
  } catch (error) {
    return handleApiError(error);
  }
}
