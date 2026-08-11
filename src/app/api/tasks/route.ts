import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { nextTaskNo } from "@/lib/counters";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import {
  canCreateTask,
  getVisibleTaskFilter,
  resolveManagerDepartmentIds,
} from "@/lib/permissions";
import { getManagedDepartmentIds } from "@/lib/departments";
import { requireSessionUser } from "@/lib/session";
import { addTimelineEntry } from "@/lib/timeline";
import { notifyTaskAssigned } from "@/lib/notifications";
import { DailyUpdate } from "@/models/DailyUpdate";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { Department } from "@/models/Department";
import { ROLE_LABELS, type UserRole } from "@/constants/lookups";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const fromCeo = searchParams.get("fromCeo") === "1";
    const fromManager = searchParams.get("fromManager") === "1";
    const teamAssigned = searchParams.get("teamAssigned") === "1";
    const employeeTasks = searchParams.get("employeeTasks") === "1";
    const managerTasks = searchParams.get("managerTasks") === "1";
    const leadershipTasks = searchParams.get("leadershipTasks") === "1";
    const fromLeadership = searchParams.get("fromLeadership") === "1";

    let filter: Record<string, unknown> = await getVisibleTaskFilter(user);

    if (fromCeo || fromLeadership) {
      // Inbox: tasks assigned TO this user (manager / CEO / HR)
      if (
        user.role !== "manager" &&
        user.role !== "ceo" &&
        user.role !== "hr"
      ) {
        return jsonError("غير مصرح", 403);
      }

      filter = { ownerId: new Types.ObjectId(user.id) };
    }

    if (fromManager) {
      if (user.role !== "employee") {
        return jsonError("هذه الصفحة للموظفين فقط", 403);
      }
      filter = { ownerId: new Types.ObjectId(user.id) };
    }

    if (teamAssigned) {
      if (user.role !== "manager") {
        return jsonError("هذه الصفحة للمدراء فقط", 403);
      }
      // Tasks this manager assigned to employees
      filter = {
        assignedById: new Types.ObjectId(user.id),
        ownerId: { $ne: new Types.ObjectId(user.id) },
      };
    }

    if (employeeTasks) {
      if (user.role !== "ceo" && user.role !== "general_manager") {
        return jsonError("غير مصرح", 403);
      }
      const employees = await User.find({
        role: "employee",
        active: true,
      }).select("_id");
      filter = {
        ownerId: { $in: employees.map((e) => e._id) },
      };
    }

    if (managerTasks) {
      // CEO tracks managers + HR
      if (user.role !== "ceo") {
        return jsonError("غير مصرح", 403);
      }
      const assignees = await User.find({
        role: { $in: ["manager", "hr"] },
        active: true,
      }).select("_id");
      filter = {
        ownerId: { $in: assignees.map((m) => m._id) },
      };
    }

    if (leadershipTasks) {
      // GM tracks CEO + HR + managers
      if (user.role !== "general_manager") {
        return jsonError("هذه الصفحة للمدير العام فقط", 403);
      }
      const leaders = await User.find({
        role: { $in: ["ceo", "hr", "manager"] },
        active: true,
      }).select("_id");
      filter = {
        ownerId: { $in: leaders.map((m) => m._id) },
      };
    }

    // Combine status with existing filters safely (works with $or)
    if (status) {
      filter = { $and: [filter, { status }] };
    }

    const departmentId = searchParams.get("departmentId");
    if (departmentId) {
      if (!Types.ObjectId.isValid(departmentId)) {
        return jsonError("معرّف القسم غير صالح", 400);
      }
      filter = {
        $and: [filter, { departmentId: new Types.ObjectId(departmentId) }],
      };
    }

    const tasks = await Task.find(filter)
      .populate("ownerId", "name email role")
      .populate("departmentId", "_id name")
      .populate("assignedById", "name role")
      .sort({ updatedAt: -1 })
      .lean();

    const taskIds = tasks.map((t) => t._id);
    const latestByTask = new Map<
      string,
      {
        text: string;
        date: Date;
        entryType?: string;
        senderName: string;
        senderRole: UserRole | string;
        senderRoleLabel: string;
      }
    >();
    const textsByTask = new Map<string, string[]>();

    if (taskIds.length > 0) {
      const allUpdates = await DailyUpdate.find({ taskId: { $in: taskIds } })
        .select(
          "taskId workPerformed result issue nextAction managerNotes supplier createdAt date entryType createdBy"
        )
        .populate("createdBy", "name role")
        .sort({ createdAt: -1, date: -1 })
        .lean();

      for (const entry of allUpdates) {
        const tid = String(entry.taskId);
        const parts = [
          entry.workPerformed,
          entry.result,
          entry.issue,
          entry.nextAction,
          entry.managerNotes,
          entry.supplier,
        ].filter((x): x is string => Boolean(x && String(x).trim()));

        if (parts.length > 0) {
          const list = textsByTask.get(tid) || [];
          list.push(...parts);
          textsByTask.set(tid, list);
        }

        if (!latestByTask.has(tid)) {
          const sender = entry.createdBy as
            | { name?: string; role?: UserRole }
            | null
            | undefined;
          const role = sender?.role || "employee";
          latestByTask.set(tid, {
            text: entry.workPerformed,
            date: entry.createdAt || entry.date,
            entryType: entry.entryType,
            senderName: sender?.name || "—",
            senderRole: role,
            senderRoleLabel: ROLE_LABELS[role] || role,
          });
        }
      }
    }

    const withLastMessage = tasks.map((task) => ({
      ...task,
      lastMessage: latestByTask.get(String(task._id)) || null,
      messageTexts: textsByTask.get(String(task._id)) || [],
    }));

    return jsonOk(withLastMessage);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    if (!canCreateTask(user.role)) {
      return jsonError("ليس لديك صلاحية إنشاء مهمة", 403);
    }

    await connectDB();
    const body = await request.json();

    if (!body.name || !body.ownerId) {
      return jsonError("الاسم والمسؤول مطلوبان");
    }

    const owner = await User.findById(body.ownerId);
    if (!owner) return jsonError("المسؤول غير موجود", 404);
    const isExternalEmployee =
      owner.role === "employee" && owner.contractType === "external";

    if (user.role === "general_manager") {
      if (
        owner.role !== "ceo" &&
        owner.role !== "hr" &&
        owner.role !== "manager" &&
        !isExternalEmployee
      ) {
        return jsonError(
          "المدير العام يسند المهام للمدير التنفيذي والموارد البشرية والمدراء وموظفي العقود الخارجية فقط",
          403
        );
      }
      if (owner.role === "manager") {
        if (!body.departmentId) {
          return jsonError("يجب اختيار قسم للمدير");
        }
        const managed = await getManagedDepartmentIds(owner._id);
        const legacy = owner.departmentId?.toString();
        const allowed =
          managed.length > 0
            ? managed
            : legacy
              ? [legacy]
              : [];
        if (
          allowed.length > 0 &&
          !allowed.includes(String(body.departmentId))
        ) {
          return jsonError("يجب أن تكون المهمة ضمن أقسام المدير المختار", 403);
        }
      }
      if (isExternalEmployee && !body.departmentId && !owner.departmentId) {
        return jsonError("قسم الموظف غير محدد");
      }
      // CEO / HR may have no department — optional
      if (!body.managementDecision && !body.nextAction) {
        return jsonError("أدخل القرار أو الأمر");
      }
    }

    if (user.role === "ceo") {
      if (
        owner.role !== "manager" &&
        owner.role !== "hr" &&
        !isExternalEmployee
      ) {
        return jsonError(
          "المدير التنفيذي يسند المهام للموارد البشرية والمدراء وموظفي العقود الخارجية فقط",
          403
        );
      }
      if (owner.role === "manager") {
        if (!body.departmentId) {
          return jsonError("الاسم والمسؤول والقسم مطلوبة");
        }
        const managed = await getManagedDepartmentIds(owner._id);
        const legacy = owner.departmentId?.toString();
        const allowed =
          managed.length > 0
            ? managed
            : legacy
              ? [legacy]
              : [];
        if (
          allowed.length > 0 &&
          !allowed.includes(String(body.departmentId))
        ) {
          return jsonError("يجب أن تكون المهمة ضمن أقسام المدير المختار", 403);
        }
      }
      if (isExternalEmployee && !body.departmentId && !owner.departmentId) {
        return jsonError("قسم الموظف غير محدد");
      }
      if (!body.managementDecision && !body.nextAction) {
        return jsonError("أدخل القرار أو الأمر");
      }
    }

    if (user.role === "manager") {
      if (owner.role !== "employee" || owner.contractType === "external") {
        return jsonError("المدير يسند المهام لموظفي فريقه فقط", 403);
      }
      if (!body.departmentId) {
        return jsonError("الاسم والمسؤول والقسم مطلوبة");
      }
      const managedIds = await resolveManagerDepartmentIds(user);
      const isTeam = owner.managerId?.toString() === user.id;
      if (!isTeam) {
        return jsonError("لا يمكن إسناد المهمة خارج فريقك", 403);
      }
      if (
        managedIds.length > 0 &&
        !managedIds.includes(String(body.departmentId))
      ) {
        return jsonError("يجب أن تكون المهمة ضمن أقسامك", 403);
      }
      if (!body.managementDecision && !body.nextAction) {
        return jsonError("أدخل القرار أو الأمر للموظف");
      }
    }

    let departmentId =
      body.departmentId || owner.departmentId?.toString() || null;
    if (departmentId) {
      const dept = await Department.findById(departmentId);
      if (!dept) return jsonError("القسم غير موجود", 404);
      if (
        isExternalEmployee &&
        owner.departmentId &&
        String(departmentId) !== owner.departmentId.toString()
      ) {
        return jsonError("يجب أن تكون المهمة ضمن قسم المدير التنفيذي", 403);
      }
    } else if (owner.role === "manager" || owner.role === "employee") {
      return jsonError("القسم مطلوب لهذا المسؤول");
    }
    // ceo / hr: department optional

    const taskNo = await nextTaskNo();
    const task = await Task.create({
      taskNo,
      name: body.name,
      description: body.description || "",
      assignedDate: body.assignedDate
        ? new Date(body.assignedDate)
        : new Date(),
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      ownerId: body.ownerId,
      departmentId,
      assignedById: user.id,
      priority: body.priority || "متوسطة",
      status: body.status || "لم تبدأ",
      progress: body.progress ?? 0,
      nextAction: body.nextAction || "",
      nextActionDate: body.nextActionDate
        ? new Date(body.nextActionDate)
        : null,
      managementDecision: body.managementDecision || "",
      folderLink: body.folderLink || "",
      lastUpdate: new Date(),
    });

    if (
      user.role === "general_manager" &&
      (body.managementDecision || body.nextAction)
    ) {
      await addTimelineEntry({
        taskId: task._id.toString(),
        createdBy: user.id,
        text: body.managementDecision || body.nextAction,
        entryType: "gm_order",
        result: "أمر التكليف من المدير العام",
      });
    }

    if (user.role === "ceo" && (body.managementDecision || body.nextAction)) {
      await addTimelineEntry({
        taskId: task._id.toString(),
        createdBy: user.id,
        text: body.managementDecision || body.nextAction,
        entryType: "ceo_order",
        result: "أمر التكليف من المدير التنفيذي",
      });
    }

    if (
      user.role === "manager" &&
      (body.managementDecision || body.nextAction)
    ) {
      await addTimelineEntry({
        taskId: task._id.toString(),
        createdBy: user.id,
        text: body.managementDecision || body.nextAction,
        entryType: "manager_order",
        result: "أمر التكليف من المدير",
      });
    }

    const populated = await Task.findById(task._id)
      .populate("ownerId", "name email role")
      .populate("departmentId", "name");

    try {
      await notifyTaskAssigned({
        ownerId: task.ownerId,
        ownerRole: owner.role,
        assignedById: user.id,
        assignerName: user.name || ROLE_LABELS[user.role as UserRole] || "الإدارة",
        taskId: task._id,
        taskNo: task.taskNo,
        taskName: task.name,
      });
    } catch {
      // don't fail task create if notification fails
    }

    return jsonOk(populated, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
