import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { requireSessionUser } from "@/lib/session";
import { Department } from "@/models/Department";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "ceo") {
      return jsonError("فقط المدير التنفيذي يحذف الأقسام", 403);
    }

    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح", 400);

    const dept = await Department.findById(id);
    if (!dept) return jsonError("القسم غير موجود", 404);

    const [usersCount, tasksCount] = await Promise.all([
      User.countDocuments({ departmentId: id, active: true }),
      Task.countDocuments({ departmentId: id }),
    ]);

    if (usersCount > 0) {
      return jsonError(
        `لا يمكن حذف القسم — مرتبط بـ ${usersCount} مستخدم. انقل المدراء/الموظفين أولًا.`,
        400
      );
    }

    if (tasksCount > 0) {
      return jsonError(
        `لا يمكن حذف القسم — مرتبط بـ ${tasksCount} مهمة. أعد إسناد المهام أولًا.`,
        400
      );
    }

    await dept.deleteOne();
    return jsonOk({ ok: true, message: "تم حذف القسم" });
  } catch (error) {
    return handleApiError(error);
  }
}
