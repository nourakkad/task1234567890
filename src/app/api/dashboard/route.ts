import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonOk, handleApiError } from "@/lib/api";
import { getVisibleTaskFilter } from "@/lib/permissions";
import { requireSessionUser } from "@/lib/session";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

function computeKpis(
  tasks: Array<{
    status: string;
    progress?: number;
    targetDate?: Date | string | null;
  }>
) {
  const now = new Date();
  const total = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "قيد التنفيذ").length;
  const waitingSupplier = tasks.filter(
    (t) => t.status === "بانتظار المورد"
  ).length;
  const waitingManagement = tasks.filter(
    (t) => t.status === "بانتظار قرار الإدارة"
  ).length;
  const completed = tasks.filter((t) => t.status === "مكتملة").length;
  const paused = tasks.filter((t) => t.status === "معلقة").length;
  const overdue = tasks.filter(
    (t) =>
      t.targetDate &&
      new Date(t.targetDate) < now &&
      t.status !== "مكتملة" &&
      t.status !== "ملغاة"
  ).length;
  const avgProgress =
    total === 0
      ? 0
      : tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / total;

  return {
    total,
    inProgress,
    waitingSupplier,
    waitingManagement,
    completed,
    paused,
    overdue,
    avgProgress,
  };
}

function uniqueById<T extends { _id: unknown }>(items: T[]) {
  return items.filter(
    (t, idx, arr) =>
      arr.findIndex((x) => String(x._id) === String(t._id)) === idx
  );
}

export async function GET() {
  try {
    const user = await requireSessionUser();
    await connectDB();

    if (user.role === "employee") {
      return jsonOk({
        role: "employee",
        redirectTo: "/my-tasks",
      });
    }

    const now = new Date();

    if (user.role === "ceo") {
      const managers = await User.find({ role: "manager", active: true }).select(
        "_id"
      );
      const employees = await User.find({
        role: "employee",
        active: true,
      }).select("_id");

      const managerIds = managers.map((m) => m._id);
      const employeeIds = employees.map((e) => e._id);

      const [managerTasks, employeeTasks, allTasks] = await Promise.all([
        Task.find({ ownerId: { $in: managerIds } }).lean(),
        Task.find({ ownerId: { $in: employeeIds } }).lean(),
        Task.find({})
          .populate("ownerId", "name role")
          .populate("departmentId", "name")
          .lean(),
      ]);

      const needsAttention = allTasks
        .filter(
          (t) =>
            t.status === "معلقة" ||
            t.status === "بانتظار قرار الإدارة" ||
            (t.targetDate &&
              new Date(t.targetDate) < now &&
              t.status !== "مكتملة" &&
              t.status !== "ملغاة")
        )
        .sort(
          (a, b) =>
            new Date(b.lastUpdate || b.updatedAt).getTime() -
            new Date(a.lastUpdate || a.updatedAt).getTime()
        )
        .slice(0, 12);

      return jsonOk({
        role: "ceo",
        kpis: {
          ...computeKpis(allTasks),
          managerTasks: managerTasks.length,
          employeeTasks: employeeTasks.length,
          managersCount: managers.length,
          employeesCount: employees.length,
        },
        needsAttention,
      });
    }

    // Manager
    const filter = await getVisibleTaskFilter(user);
    const visibleTasks = await Task.find(filter)
      .populate("ownerId", "name role")
      .populate("departmentId", "name")
      .lean();

    const myCeoTasks = await Task.find({
      ownerId: new Types.ObjectId(user.id),
    }).lean();

    const teamTasks = await Task.find({
      assignedById: new Types.ObjectId(user.id),
      ownerId: { $ne: new Types.ObjectId(user.id) },
    })
      .populate("ownerId", "name role")
      .populate("departmentId", "name")
      .lean();

    const combined = uniqueById([...visibleTasks, ...teamTasks]);
    const needsAttention = combined
      .filter(
        (t) =>
          t.status === "معلقة" ||
          t.status === "بانتظار قرار الإدارة" ||
          (t.targetDate &&
            new Date(t.targetDate) < now &&
            t.status !== "مكتملة" &&
            t.status !== "ملغاة")
      )
      .sort(
        (a, b) =>
          new Date(b.lastUpdate || b.updatedAt).getTime() -
          new Date(a.lastUpdate || a.updatedAt).getTime()
      )
      .slice(0, 12);

    return jsonOk({
      role: "manager",
      kpis: {
        ...computeKpis(combined),
        fromCeo: myCeoTasks.length,
        teamAssigned: teamTasks.length,
        waitingMyDecision: combined.filter(
          (t) => t.status === "بانتظار قرار الإدارة"
        ).length,
      },
      needsAttention,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
