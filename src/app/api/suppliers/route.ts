import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import {
  canAccessTask,
  getTeamMemberIds,
  getVisibleTaskFilter,
} from "@/lib/permissions";
import { sanitizeHttpUrl } from "@/lib/safeUrl";
import { requireSessionUser } from "@/lib/session";
import { Supplier } from "@/models/Supplier";
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
      const suppliers = await Supplier.find({ taskId })
        .populate("taskId", "taskNo name")
        .sort({ updatedAt: -1 })
        .lean();
      return jsonOk(suppliers);
    }

    const taskFilter = await getVisibleTaskFilter(user);
    const visibleTasks = await Task.find(taskFilter).select("_id").lean();
    const visibleIds = visibleTasks.map((t) => t._id);

    const suppliers = await Supplier.find({ taskId: { $in: visibleIds } })
      .populate("taskId", "taskNo name")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    return jsonOk(suppliers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const body = await request.json();

    if (!body.taskId || !body.name) {
      return jsonError("المهمة واسم المورد مطلوبان");
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

    const supplier = await Supplier.create({
      taskId: body.taskId,
      name: body.name,
      contactName: body.contactName || "",
      phone: body.phone || "",
      email: body.email || "",
      wechat: body.wechat || "",
      address: body.address || "",
      product: body.product || "",
      price: body.price ?? null,
      currency: body.currency || "RMB",
      moq: body.moq || "",
      leadTime: body.leadTime || "",
      paymentTerms: body.paymentTerms || "",
      sampleStatus: body.sampleStatus || "لم تطلب",
      rating: body.rating ?? null,
      decision: body.decision || "قيد التقييم",
      reason: body.reason || "",
      fileLink: fileLink.value,
    });

    task.lastUpdate = new Date();
    await task.save();

    return jsonOk(supplier, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
