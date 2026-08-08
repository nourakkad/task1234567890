import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import {
  canAccessTask,
  getTeamMemberIds,
} from "@/lib/permissions";
import { sanitizeHttpUrl } from "@/lib/safeUrl";
import { requireSessionUser } from "@/lib/session";
import { Supplier } from "@/models/Supplier";
import { Task } from "@/models/Task";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح");

    const supplier = await Supplier.findById(id);
    if (!supplier) return jsonError("المورد غير موجود", 404);

    const task = await Task.findById(supplier.taskId);
    if (!task) return jsonError("المهمة غير موجودة", 404);

    const teamIds =
      user.role === "manager" ? await getTeamMemberIds(user.id) : [];
    if (!canAccessTask(user, task, teamIds)) {
      return jsonError("غير مصرح", 403);
    }

    const body = await request.json();
    if (body.fileLink !== undefined) {
      const fileLink = sanitizeHttpUrl(body.fileLink, "رابط الملف");
      if (!fileLink.ok) return jsonError(fileLink.error);
      supplier.fileLink = fileLink.value;
    }

    const fields = [
      "name",
      "contactName",
      "phone",
      "email",
      "wechat",
      "address",
      "product",
      "price",
      "currency",
      "moq",
      "leadTime",
      "paymentTerms",
      "sampleStatus",
      "rating",
      "decision",
      "reason",
    ] as const;

    for (const field of fields) {
      if (body[field] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supplier as any)[field] = body[field];
      }
    }

    await supplier.save();
    task.lastUpdate = new Date();
    await task.save();

    return jsonOk(supplier);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    if (user.role === "employee") {
      return jsonError("غير مصرح بالحذف", 403);
    }

    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح");

    const supplier = await Supplier.findById(id);
    if (!supplier) return jsonError("المورد غير موجود", 404);

    const task = await Task.findById(supplier.taskId);
    if (!task) return jsonError("المهمة غير موجودة", 404);

    const teamIds =
      user.role === "manager" ? await getTeamMemberIds(user.id) : [];
    if (!canAccessTask(user, task, teamIds)) {
      return jsonError("غير مصرح", 403);
    }

    await supplier.deleteOne();
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
