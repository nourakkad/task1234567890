import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { buildUserMonthHistory } from "@/lib/performance";
import { requireSessionUser } from "@/lib/session";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "ceo" && user.role !== "manager") {
      return jsonError("غير مصرح بعرض سجل التقييم", 403);
    }

    await connectDB();
    const { userId } = await params;
    if (!Types.ObjectId.isValid(userId)) {
      return jsonError("معرّف غير صالح", 400);
    }

    const target = await User.findById(userId).select("name role managerId active");
    if (!target || !target.active) {
      return jsonError("المستخدم غير موجود", 404);
    }

    if (user.role === "ceo") {
      if (target.role !== "manager") {
        return jsonError("المدير التنفيذي يعرض سجل المدراء فقط", 403);
      }
    } else if (user.role === "manager") {
      if (target.role !== "employee") {
        return jsonError("المدير يعرض سجل موظفي فريقه فقط", 403);
      }
      if (target.managerId?.toString() !== user.id) {
        return jsonError("لا يمكن عرض سجل موظف خارج فريقك", 403);
      }
    }

    const months = await buildUserMonthHistory(target._id, Task);

    return jsonOk({
      userId: String(target._id),
      name: target.name,
      role: target.role,
      months,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
