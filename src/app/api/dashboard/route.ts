import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonOk, handleApiError } from "@/lib/api";
import {
  buildTeamPerformance,
  currentMonthRange,
} from "@/lib/performance";
import { requireSessionUser } from "@/lib/session";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

async function kpiFromMatch(match: Record<string, unknown>) {
  const now = new Date();
  const [rows] = await Task.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        inProgress: {
          $sum: { $cond: [{ $eq: ["$status", "قيد التنفيذ"] }, 1, 0] },
        },
        waitingSupplier: {
          $sum: { $cond: [{ $eq: ["$status", "بانتظار المورد"] }, 1, 0] },
        },
        waitingManagement: {
          $sum: {
            $cond: [{ $eq: ["$status", "بانتظار قرار الإدارة"] }, 1, 0],
          },
        },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "مكتملة"] }, 1, 0] },
        },
        paused: {
          $sum: { $cond: [{ $eq: ["$status", "معلقة"] }, 1, 0] },
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$targetDate", null] },
                  { $lt: ["$targetDate", now] },
                  { $not: [{ $in: ["$status", ["مكتملة", "ملغاة"]] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
        progressSum: { $sum: { $ifNull: ["$progress", 0] } },
      },
    },
  ]);

  if (!rows) {
    return {
      total: 0,
      inProgress: 0,
      waitingSupplier: 0,
      waitingManagement: 0,
      completed: 0,
      paused: 0,
      overdue: 0,
      avgProgress: 0,
    };
  }

  return {
    total: rows.total,
    inProgress: rows.inProgress,
    waitingSupplier: rows.waitingSupplier,
    waitingManagement: rows.waitingManagement,
    completed: rows.completed,
    paused: rows.paused,
    overdue: rows.overdue,
    avgProgress: rows.total === 0 ? 0 : rows.progressSum / rows.total,
  };
}

function attentionMatch(scope: Record<string, unknown>, now: Date) {
  return {
    $and: [
      scope,
      {
        $or: [
          { status: "معلقة" },
          { status: "بانتظار قرار الإدارة" },
          {
            targetDate: { $lt: now },
            status: { $nin: ["مكتملة", "ملغاة"] },
          },
        ],
      },
    ],
  };
}

async function fetchNeedsAttention(scope: Record<string, unknown>, now: Date) {
  return Task.find(attentionMatch(scope, now))
    .select(
      "taskNo name status priority lastUpdate nextAction updatedAt ownerId departmentId"
    )
    .populate("ownerId", "name role")
    .populate("departmentId", "name")
    .sort({ lastUpdate: -1, updatedAt: -1 })
    .limit(12)
    .lean();
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

    if (user.role === "hr") {
      return jsonOk({
        role: "hr",
        redirectTo: "/hr",
      });
    }

    const now = new Date();
    const { start: monthStart, end: monthEnd } = currentMonthRange(now);
    const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    if (user.role === "ceo" || user.role === "general_manager") {
      const [managers, employees, ceos, hrs] = await Promise.all([
        User.find({ role: "manager", active: true }).select("_id name").lean(),
        User.find({ role: "employee", active: true }).select("_id").lean(),
        user.role === "general_manager"
          ? User.find({ role: "ceo", active: true }).select("_id").lean()
          : Promise.resolve([]),
        user.role === "ceo"
          ? User.find({ role: "hr", active: true }).select("_id").lean()
          : Promise.resolve([]),
      ]);

      const managerIds = managers.map((m) => m._id);
      const employeeIds = employees.map((e) => e._id);
      const ceoIds = ceos.map((c) => c._id);
      const hrIds = hrs.map((h) => h._id);
      // CEO /track uses managerTasks=1 for managers + HR
      const trackOwnerIds =
        user.role === "ceo" ? [...managerIds, ...hrIds] : managerIds;

      const [
        kpis,
        managerTasks,
        employeeTasks,
        ceoTasks,
        needsAttention,
        teamPerformance,
      ] = await Promise.all([
        kpiFromMatch({}),
        Task.countDocuments({ ownerId: { $in: trackOwnerIds } }),
        Task.countDocuments({ ownerId: { $in: employeeIds } }),
        ceoIds.length
          ? Task.countDocuments({ ownerId: { $in: ceoIds } })
          : Promise.resolve(0),
        fetchNeedsAttention({}, now),
        user.role === "ceo"
          ? buildTeamPerformance(managers, Task, monthStart, monthEnd)
          : Promise.resolve([]),
      ]);

      return jsonOk({
        role: user.role,
        kpis: {
          ...kpis,
          managerTasks,
          employeeTasks,
          ceoTasks,
          managersCount: managers.length,
          employeesCount: employees.length,
        },
        needsAttention,
        performanceMonth: monthLabel,
        teamPerformance,
      });
    }

    // Manager — scope = inbox (owned) ∪ team-assigned (no department-wide leak)
    const ownerSelf = new Types.ObjectId(user.id);
    const teamMatch = {
      assignedById: ownerSelf,
      ownerId: { $ne: ownerSelf },
    };
    const scope = {
      $or: [{ ownerId: ownerSelf }, teamMatch],
    };

    const [
      employees,
      kpis,
      fromCeo,
      teamAssigned,
      waitingMyDecision,
      needsAttention,
    ] = await Promise.all([
      User.find({
        role: "employee",
        managerId: user.id,
        active: true,
      })
        .select("_id name")
        .lean(),
      kpiFromMatch(scope),
      Task.countDocuments({ ownerId: ownerSelf }),
      Task.countDocuments(teamMatch),
      // Only team tasks waiting on this manager — not the manager's own inbox
      Task.countDocuments({
        $and: [teamMatch, { status: "بانتظار قرار الإدارة" }],
      }),
      fetchNeedsAttention(scope, now),
    ]);

    const teamPerformance = await buildTeamPerformance(
      employees,
      Task,
      monthStart,
      monthEnd
    );

    return jsonOk({
      role: "manager",
      kpis: {
        ...kpis,
        fromCeo,
        teamAssigned,
        waitingMyDecision,
      },
      needsAttention,
      performanceMonth: monthLabel,
      teamPerformance,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
