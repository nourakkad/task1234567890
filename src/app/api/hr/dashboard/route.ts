import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import {
  buildTeamPerformance,
  currentMonthRange,
} from "@/lib/performance";
import { requireSessionUser } from "@/lib/session";
import { Department } from "@/models/Department";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

/** HR dashboard: counts + monthly ratings for all managers and employees */
export async function GET() {
  try {
    const user = await requireSessionUser();
    if (user.role !== "hr") return jsonError("غير مصرح", 403);

    await connectDB();
    const now = new Date();
    const { start: monthStart, end: monthEnd } = currentMonthRange(now);
    const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [managers, employees, departmentsCount] = await Promise.all([
      User.find({ role: "manager", active: true }).select("_id name").lean(),
      User.find({ role: "employee", active: true }).select("_id name").lean(),
      Department.countDocuments(),
    ]);

    const [managersPerformance, employeesPerformance] = await Promise.all([
      buildTeamPerformance(managers, Task, monthStart, monthEnd),
      buildTeamPerformance(employees, Task, monthStart, monthEnd),
    ]);

    return jsonOk({
      role: "hr",
      performanceMonth: monthLabel,
      kpis: {
        managersCount: managers.length,
        employeesCount: employees.length,
        departmentsCount,
      },
      managersPerformance,
      employeesPerformance,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
