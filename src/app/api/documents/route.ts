import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { nextDocNo } from "@/lib/counters";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import {
  canAccessTask,
  getTeamMemberIds,
  getVisibleTaskFilter,
} from "@/lib/permissions";
import { sanitizeHttpUrl } from "@/lib/safeUrl";
import { requireSessionUser } from "@/lib/session";
import { SampleDocument } from "@/models/SampleDocument";
import { Task } from "@/models/Task";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (taskId) {
      if (!Types.ObjectId.isValid(taskId)) {
        return jsonError("معرّف مهمة غير صالح");
      }
      const task = await Task.findById(taskId).select("ownerId departmentId");
      if (!task) return jsonError("المهمة غير موجودة", 404);
      const teamIds =
        user.role === "manager" ? await getTeamMemberIds(user.id) : [];
      if (!canAccessTask(user, task, teamIds)) {
        return jsonError("غير مصرح", 403);
      }
      const docs = await SampleDocument.find({ taskId })
        .populate("taskId", "taskNo name")
        .sort({ updatedAt: -1 })
        .lean();
      return jsonOk(docs);
    }

    const taskFilter = await getVisibleTaskFilter(user);
    const visibleTasks = await Task.find(taskFilter).select("_id").lean();
    const visibleIds = visibleTasks.map((t) => t._id);

    const docs = await SampleDocument.find({ taskId: { $in: visibleIds } })
      .populate("taskId", "taskNo name")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    return jsonOk(docs);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const body = await request.json();

    if (!body.taskId || !body.name || !body.recordType) {
      return jsonError("المهمة ونوع السجل والاسم مطلوبة");
    }
    if (!Types.ObjectId.isValid(body.taskId)) {
      return jsonError("معرّف مهمة غير صالح");
    }

    const task = await Task.findById(body.taskId);
    if (!task) return jsonError("المهمة غير موجودة", 404);

    const teamIds =
      user.role === "manager" ? await getTeamMemberIds(user.id) : [];
    if (!canAccessTask(user, task, teamIds)) {
      return jsonError("غير مصرح", 403);
    }

    const fileLink = sanitizeHttpUrl(body.fileLink, "رابط الملف");
    if (!fileLink.ok) return jsonError(fileLink.error);

    const isSample =
      body.recordType === "صورة عينة" || body.prefix === "SMP";
    const recordNo = await nextDocNo(isSample ? "SMP" : "DOC");

    const doc = await SampleDocument.create({
      recordNo,
      taskId: body.taskId,
      supplier: body.supplier || "",
      recordType: body.recordType,
      name: body.name,
      requestDate: body.requestDate ? new Date(body.requestDate) : null,
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      actualDate: body.actualDate ? new Date(body.actualDate) : null,
      status: body.status || "",
      reviewResult: body.reviewResult || "",
      fileName: body.fileName || "",
      fileLink: fileLink.value,
      notes: body.notes || "",
    });

    task.lastUpdate = new Date();
    await task.save();

    return jsonOk(doc, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
