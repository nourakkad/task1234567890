import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { CEO_DEPARTMENT_NAME } from "@/constants/lookups";
import { requireSessionUser } from "@/lib/session";
import { Department } from "@/models/Department";
import { User } from "@/models/User";

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

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "hr") {
      return jsonError("فقط الموارد البشرية تضيف الأقسام", 403);
    }

    await connectDB();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const underCeo = Boolean(body.underCeo);

    if (!name || name.length < 2) {
      return jsonError("اسم القسم مطلوب");
    }
    if (name.length > 80) {
      return jsonError("اسم القسم طويل جدًا");
    }

    const exists = await Department.findOne({ name });
    if (exists) return jsonError("يوجد قسم بنفس الاسم");

    const dept = await Department.create({
      name,
      managerId: null,
      underCeo,
    });
    return jsonOk(dept, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireSessionUser();
    if (user.role !== "hr") {
      return jsonError("فقط الموارد البشرية تعدّل الأقسام", 403);
    }

    await connectDB();
    const body = await request.json();
    if (!body.id) return jsonError("معرّف القسم مطلوب");

    const dept = await Department.findById(body.id);
    if (!dept) return jsonError("القسم غير موجود", 404);

    const isSystemCeoDept = dept.name === CEO_DEPARTMENT_NAME;

    if (body.name) {
      const name = String(body.name).trim();
      if (name.length < 2) return jsonError("اسم القسم قصير جدًا");
      if (isSystemCeoDept && name !== CEO_DEPARTMENT_NAME) {
        return jsonError("لا يمكن إعادة تسمية قسم النظام للمدير التنفيذي");
      }
      const clash = await Department.findOne({
        name,
        _id: { $ne: dept._id },
      });
      if (clash) return jsonError("يوجد قسم بنفس الاسم");
      dept.name = name;
    }

    if (body.underCeo !== undefined) {
      const underCeo = Boolean(body.underCeo);
      if (isSystemCeoDept && !underCeo) {
        return jsonError("قسم النظام يبقى تحت سيطرة المدير التنفيذي");
      }
      dept.underCeo = underCeo;
      if (underCeo) {
        dept.managerId = null;
        // Employees in this dept report to CEO directly
        await User.updateMany(
          { departmentId: dept._id, role: "employee" },
          { $set: { managerId: null } }
        );
      }
    }

    if (body.managerId !== undefined && !dept.underCeo) {
      dept.managerId = body.managerId || null;
    }

    await dept.save();

    return jsonOk(dept);
  } catch (error) {
    return handleApiError(error);
  }
}
