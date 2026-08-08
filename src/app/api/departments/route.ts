import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { requireSessionUser } from "@/lib/session";
import { Department } from "@/models/Department";

export async function GET() {
  try {
    await requireSessionUser();
    await connectDB();
    const departments = await Department.find()
      .populate("managerId", "name email")
      .sort({ name: 1 })
      .lean();
    return jsonOk(departments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "ceo") {
      return jsonError("فقط المدير التنفيذي يعدّل الأقسام", 403);
    }

    await connectDB();
    const body = await request.json();
    if (!body.id) return jsonError("معرّف القسم مطلوب");

    const dept = await Department.findById(body.id);
    if (!dept) return jsonError("القسم غير موجود", 404);

    if (body.name) dept.name = body.name;
    if (body.managerId !== undefined) dept.managerId = body.managerId;
    await dept.save();

    return jsonOk(dept);
  } catch (error) {
    return handleApiError(error);
  }
}
