import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { nextTaskNo } from "@/lib/counters";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import {
  canCreateTask,
  getVisibleTaskFilter,
} from "@/lib/permissions";
import { requireSessionUser } from "@/lib/session";
import { addTimelineEntry } from "@/lib/timeline";
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

    let filter: Record<string, unknown> = await getVisibleTaskFilter(user);

    if (fromCeo) {
      if (user.role !== "manager") {
        return jsonError("هذه الصفحة للمدراء فقط", 403);
      }

      // Manager inbox: tasks owned by them OR in their department
      const ownerOid = new Types.ObjectId(user.id);
      const or: Record<string, unknown>[] = [{ ownerId: ownerOid }];
      if (user.departmentId && Types.ObjectId.isValid(user.departmentId)) {
        or.push({ departmentId: new Types.ObjectId(user.departmentId) });
      }
      filter = { $or: or };
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
      if (user.role !== "ceo") {
        return jsonError("هذه الصفحة للمدير التنفيذي فقط", 403);
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
      if (user.role !== "ceo") {
        return jsonError("هذه الصفحة للمدير التنفيذي فقط", 403);
      }
      const managers = await User.find({
        role: "manager",
        active: true,
      }).select("_id");
      filter = {
        ownerId: { $in: managers.map((m) => m._id) },
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
      .populate("departmentId", "name")
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

    if (taskIds.length > 0) {
      const recent = await DailyUpdate.find({ taskId: { $in: taskIds } })
        .populate("createdBy", "name role")
        .sort({ createdAt: -1, date: -1 })
        .lean();

      for (const entry of recent) {
        const key = String(entry.taskId);
        if (latestByTask.has(key)) continue;
        const sender = entry.createdBy as
          | { name?: string; role?: UserRole }
          | null
          | undefined;
        const role = sender?.role || "employee";
        latestByTask.set(key, {
          text: entry.workPerformed,
          date: entry.createdAt || entry.date,
          entryType: entry.entryType,
          senderName: sender?.name || "—",
          senderRole: role,
          senderRoleLabel: ROLE_LABELS[role as UserRole] || role,
        });
      }
    }

    const withLastMessage = tasks.map((task) => ({
      ...task,
      lastMessage: latestByTask.get(String(task._id)) || null,
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

    if (!body.name || !body.ownerId || !body.departmentId) {
      return jsonError("الاسم والمسؤول والقسم مطلوبة");
    }

    const owner = await User.findById(body.ownerId);
    if (!owner) return jsonError("المسؤول غير موجود", 404);

    if (user.role === "ceo") {
      if (owner.role !== "manager") {
        return jsonError("المدير التنفيذي يسند المهام للمدراء فقط", 403);
      }
      if (
        owner.departmentId &&
        body.departmentId !== owner.departmentId.toString()
      ) {
        return jsonError("يجب أن تطابق المهمة قسم المدير المختار", 403);
      }
    }

    if (user.role === "manager") {
      if (owner.role !== "employee") {
        return jsonError("المدير يسند المهام للموظفين فقط", 403);
      }
      const isTeam =
        owner.managerId?.toString() === user.id ||
        owner.departmentId?.toString() === user.departmentId;
      if (!isTeam) {
        return jsonError("لا يمكن إسناد المهمة خارج فريقك", 403);
      }
      if (user.departmentId && body.departmentId !== user.departmentId) {
        return jsonError("يجب أن تكون المهمة ضمن قسمك", 403);
      }
      if (!body.managementDecision && !body.nextAction) {
        return jsonError("أدخل القرار أو الأمر للموظف");
      }
    }

    const dept = await Department.findById(body.departmentId);
    if (!dept) return jsonError("القسم غير موجود", 404);

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
      departmentId: body.departmentId,
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

    return jsonOk(populated, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
