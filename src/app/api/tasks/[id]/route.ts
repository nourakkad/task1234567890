import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import {
  canAccessTask,
  canDeleteTask,
  canEditTask,
  canSetManagementDecision,
  getTeamMemberIds,
} from "@/lib/permissions";
import { sanitizeHttpUrl } from "@/lib/safeUrl";
import { requireSessionUser } from "@/lib/session";
import { clampProgress, validateStatusChange } from "@/lib/taskStatus";
import { DailyUpdate } from "@/models/DailyUpdate";
import { SampleDocument } from "@/models/SampleDocument";
import { Supplier } from "@/models/Supplier";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح", 400);

    const task = await Task.findById(id)
      .populate("ownerId", "name email role departmentId managerId")
      .populate("departmentId", "name")
      .populate("assignedById", "name email");

    if (!task) return jsonError("المهمة غير موجودة", 404);

    const teamIds =
      user.role === "manager" ? await getTeamMemberIds(user.id) : [];
    if (!canAccessTask(user, task, teamIds)) {
      return jsonError("غير مصرح بعرض هذه المهمة", 403);
    }

    return jsonOk(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح", 400);

    const task = await Task.findById(id);
    if (!task) return jsonError("المهمة غير موجودة", 404);

    const teamIds =
      user.role === "manager" ? await getTeamMemberIds(user.id) : [];
    if (!canEditTask(user, task, teamIds)) {
      return jsonError("غير مصرح بتعديل هذه المهمة", 403);
    }

    const body = await request.json();

    // Employees cannot reassign ownership / department / management decision
    if (user.role === "employee") {
      if (
        body.ownerId !== undefined ||
        body.departmentId !== undefined ||
        body.managementDecision !== undefined ||
        body.managerApproval !== undefined
      ) {
        return jsonError("غير مصرح بتعديل الإسناد أو قرار الإدارة", 403);
      }
    }

    if (body.managementDecision !== undefined) {
      if (user.role === "employee") {
        return jsonError("الموظف لا يضع قرار الإدارة", 403);
      }
      if (
        user.role !== "ceo" &&
        user.role !== "manager" &&
        !canSetManagementDecision(user.role)
      ) {
        return jsonError("فقط الإدارة يمكنها تحديث قرار الإدارة", 403);
      }
      task.managementDecision = String(body.managementDecision || "");
    }

    if (body.ownerId !== undefined) {
      if (user.role === "employee") {
        return jsonError("غير مصرح بتغيير المسؤول", 403);
      }
      if (!Types.ObjectId.isValid(String(body.ownerId))) {
        return jsonError("معرّف المسؤول غير صالح", 400);
      }
      const owner = await User.findById(body.ownerId);
      if (!owner || !owner.active) return jsonError("المسؤول غير موجود", 404);
      if (user.role === "general_manager") {
        if (owner.role !== "ceo" && owner.role !== "manager") {
          return jsonError(
            "المدير العام يسند المهام للمدير التنفيذي والمدراء فقط",
            403
          );
        }
      }
      if (user.role === "ceo" && owner.role !== "manager") {
        return jsonError("المدير التنفيذي يسند المهام للمدراء فقط", 403);
      }
      if (user.role === "manager") {
        const isSelf = owner._id.toString() === user.id;
        const isTeam = owner.managerId?.toString() === user.id;
        if (!isSelf && !isTeam) {
          return jsonError("لا يمكن إسناد المهمة خارج فريقك", 403);
        }
      }
      task.ownerId = owner._id;
    }

    if (body.departmentId !== undefined) {
      if (user.role === "employee") {
        return jsonError("غير مصرح بتغيير القسم", 403);
      }
      if (user.role === "manager") {
        if (
          String(body.departmentId) !== String(user.departmentId || "")
        ) {
          return jsonError("لا يمكن نقل المهمة خارج قسمك", 403);
        }
      }
      if (body.departmentId) {
        if (!Types.ObjectId.isValid(String(body.departmentId))) {
          return jsonError("معرّف القسم غير صالح", 400);
        }
        task.departmentId = new Types.ObjectId(String(body.departmentId));
      } else {
        task.departmentId = null;
      }
    }

    const contentFields = [
      "name",
      "description",
      "priority",
      "nextAction",
    ] as const;
    for (const field of contentFields) {
      if (body[field] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (task as any)[field] = body[field];
      }
    }

    if (body.folderLink !== undefined) {
      const link = sanitizeHttpUrl(body.folderLink, "رابط المجلد");
      if (!link.ok) return jsonError(link.error);
      task.folderLink = link.value;
    }

    if (body.progress !== undefined) {
      const progress = clampProgress(body.progress);
      if (progress === null) return jsonError("نسبة الإنجاز غير صالحة");
      task.progress = progress;
    }

    if (body.status !== undefined) {
      const statusError = validateStatusChange(
        user.role,
        body.status,
        task.managerApproval
      );
      if (statusError) return jsonError(statusError, 400);
      task.status = body.status;
    }

    if (body.assignedDate) task.assignedDate = new Date(body.assignedDate);
    if (body.targetDate !== undefined) {
      task.targetDate = body.targetDate ? new Date(body.targetDate) : null;
    }
    if (body.nextActionDate !== undefined) {
      task.nextActionDate = body.nextActionDate
        ? new Date(body.nextActionDate)
        : null;
    }

    if (body.managerApproval !== undefined) {
      if (
        user.role !== "general_manager" &&
        user.role !== "ceo" &&
        user.role !== "manager"
      ) {
        return jsonError("غير مصرح باعتماد المهمة", 403);
      }
      task.managerApproval = body.managerApproval;
      if (body.managerApproval === "approved" && task.status === "مكتملة") {
        task.closureDate = new Date();
      }
    }

    if (body.status === "مكتملة") {
      if (task.managerApproval !== "approved" && user.role === "employee") {
        return jsonError("لا يمكن إغلاق المهمة دون اعتماد المدير", 400);
      }
      if (
        user.role === "general_manager" ||
        user.role === "ceo" ||
        user.role === "manager"
      ) {
        task.closureDate = body.closureDate
          ? new Date(body.closureDate)
          : new Date();
        if (!task.managerApproval || task.managerApproval === "pending") {
          task.managerApproval = "approved";
        }
      } else if (task.managerApproval === "approved") {
        task.closureDate = body.closureDate
          ? new Date(body.closureDate)
          : new Date();
      }
    }

    task.lastUpdate = new Date();
    await task.save();

    const populated = await Task.findById(task._id)
      .populate("ownerId", "name email role")
      .populate("departmentId", "name")
      .populate("assignedById", "name email");

    return jsonOk(populated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    if (!canDeleteTask(user.role)) {
      return jsonError("فقط المدير التنفيذي يمكنه حذف المهام", 403);
    }

    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح", 400);

    const task = await Task.findById(id);
    if (!task) return jsonError("المهمة غير موجودة", 404);

    await Promise.all([
      DailyUpdate.deleteMany({ taskId: task._id }),
      Supplier.deleteMany({ taskId: task._id }),
      SampleDocument.deleteMany({ taskId: task._id }),
      task.deleteOne(),
    ]);

    return jsonOk({ ok: true, message: "تم حذف المهمة" });
  } catch (error) {
    return handleApiError(error);
  }
}
