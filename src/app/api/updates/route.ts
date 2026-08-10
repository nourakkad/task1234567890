import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { nextUpdateNo } from "@/lib/counters";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import {
  canAccessTask,
  getTeamMemberIds,
  getVisibleTaskFilter,
} from "@/lib/permissions";
import { sanitizeHttpUrl } from "@/lib/safeUrl";
import { requireSessionUser } from "@/lib/session";
import { clampProgress, validateStatusChange } from "@/lib/taskStatus";
import { DailyUpdate } from "@/models/DailyUpdate";
import { Task } from "@/models/Task";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    // Fast path: single task detail — avoid loading all visible task IDs
    if (taskId) {
      if (!Types.ObjectId.isValid(taskId)) {
        return jsonError("معرّف مهمة غير صالح");
      }
      const task = await Task.findById(taskId).select(
        "ownerId departmentId status"
      );
      if (!task) return jsonError("المهمة غير موجودة", 404);
      const teamIds =
        user.role === "manager" ? await getTeamMemberIds(user.id) : [];
      if (!canAccessTask(user, task, teamIds)) {
        return jsonError("غير مصرح", 403);
      }
      const updates = await DailyUpdate.find({ taskId })
        .populate("taskId", "taskNo name")
        .populate("createdBy", "name email role")
        .sort({ createdAt: -1, date: -1 })
        .limit(100)
        .lean();
      return jsonOk(updates);
    }

    const taskFilter = await getVisibleTaskFilter(user);
    const visibleTasks = await Task.find(taskFilter).select("_id").lean();
    const visibleIds = visibleTasks.map((t) => t._id);

    const updates = await DailyUpdate.find({ taskId: { $in: visibleIds } })
      .populate("taskId", "taskNo name")
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1, date: -1 })
      .limit(100)
      .lean();

    return jsonOk(updates);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const body = await request.json();

    if (!body.taskId || !body.workPerformed) {
      return jsonError("رقم المهمة والعمل المنفذ مطلوبان");
    }

    if (!Types.ObjectId.isValid(String(body.taskId))) {
      return jsonError("معرّف مهمة غير صالح");
    }

    const task = await Task.findById(body.taskId);
    if (!task) return jsonError("المهمة غير موجودة", 404);

    if (task.status === "مكتملة" || task.status === "ملغاة") {
      return jsonError("لا يمكن إضافة تحديث لمهمة مغلقة", 400);
    }

    const teamIds =
      user.role === "manager" ? await getTeamMemberIds(user.id) : [];
    if (!canAccessTask(user, task, teamIds)) {
      return jsonError("غير مصرح بإضافة تحديث لهذه المهمة", 403);
    }

    const docLink = sanitizeHttpUrl(body.documentLink, "رابط المستند");
    if (!docLink.ok) return jsonError(docLink.error);

    if (body.status !== undefined && body.status !== null && body.status !== "") {
      const statusError = validateStatusChange(
        user.role,
        body.status,
        task.managerApproval
      );
      if (statusError) return jsonError(statusError, 400);
    }

    const entryType = "update" as const;

    const updateNo = await nextUpdateNo();
    const update = await DailyUpdate.create({
      updateNo,
      taskId: body.taskId,
      date: body.date ? new Date(body.date) : new Date(),
      workPerformed: String(body.workPerformed).slice(0, 5000),
      supplier: String(body.supplier || "").slice(0, 500),
      result: String(body.result || "").slice(0, 2000),
      issue: String(body.issue || "").slice(0, 2000),
      nextAction: String(body.nextAction || "").slice(0, 2000),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      hours: Number(body.hours) > 0 ? Number(body.hours) : 0,
      documentLink: docLink.value,
      managerNotes: "",
      entryType,
      createdBy: user.id,
    });

    task.lastUpdate = new Date();
    if (body.nextAction) task.nextAction = String(body.nextAction).slice(0, 2000);
    if (body.expectedDate) task.nextActionDate = new Date(body.expectedDate);
    if (body.status) task.status = body.status;
    if (body.progress !== undefined) {
      const progress = clampProgress(body.progress);
      if (progress !== null) task.progress = progress;
    }
    await task.save();

    const populated = await DailyUpdate.findById(update._id)
      .populate("taskId", "taskNo name")
      .populate("createdBy", "name email");

    return jsonOk(populated, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
