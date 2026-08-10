import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import {
  canAccessTask,
  canDeleteUpdate,
  getTeamMemberIds,
} from "@/lib/permissions";
import { requireSessionUser } from "@/lib/session";
import { DailyUpdate } from "@/models/DailyUpdate";
import { Task } from "@/models/Task";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح");

    const update = await DailyUpdate.findById(id);
    if (!update) return jsonError("التحديث غير موجود", 404);

    const task = await Task.findById(update.taskId);
    if (!task) return jsonError("المهمة غير موجودة", 404);

    const teamIds =
      user.role === "manager" ? await getTeamMemberIds(user.id) : [];
    if (!canAccessTask(user, task, teamIds)) {
      return jsonError("غير مصرح", 403);
    }

    const body = await request.json();

    // Append-only content: employees/managers can only add manager notes or minor edits by creator/manager
    if (body.managerNotes !== undefined) {
      if (
        user.role !== "general_manager" &&
        user.role !== "ceo" &&
        user.role !== "manager"
      ) {
        return jsonError("فقط المدير يضيف ملاحظات", 403);
      }
      update.managerNotes = body.managerNotes;
    }

    if (
      user.role === "general_manager" ||
      user.role === "ceo" ||
      update.createdBy.toString() === user.id
    ) {
      const editable = [
        "workPerformed",
        "supplier",
        "result",
        "issue",
        "nextAction",
        "hours",
        "documentLink",
      ] as const;
      for (const field of editable) {
        if (body[field] !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (update as any)[field] = body[field];
        }
      }
      if (body.date) update.date = new Date(body.date);
      if (body.expectedDate !== undefined) {
        update.expectedDate = body.expectedDate
          ? new Date(body.expectedDate)
          : null;
      }
    }

    await update.save();
    return jsonOk(update);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    if (!canDeleteUpdate(user.role)) {
      return jsonError("لا يُسمح بحذف التحديثات اليومية", 403);
    }

    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح");

    const update = await DailyUpdate.findByIdAndDelete(id);
    if (!update) return jsonError("التحديث غير موجود", 404);

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
