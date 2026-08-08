import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { BCRYPT_ROUNDS, validatePassword } from "@/lib/password";
import { canManageTeam } from "@/lib/permissions";
import { requireSessionUser } from "@/lib/session";
import { Department } from "@/models/Department";
import { User } from "@/models/User";

export async function GET() {
  try {
    const user = await requireSessionUser();
    await connectDB();

    if (user.role === "ceo") {
      const users = await User.find({ active: true })
        .select("-passwordHash")
        .populate("departmentId", "name")
        .populate("managerId", "name email")
        .sort({ role: 1, name: 1 })
        .lean();
      const departments = await Department.find().populate("managerId", "name");
      return jsonOk({ users, departments });
    }

    if (user.role === "manager") {
      const users = await User.find({
        active: true,
        $or: [{ _id: user.id }, { managerId: user.id }],
      })
        .select("-passwordHash")
        .populate("departmentId", "name")
        .sort({ role: 1, name: 1 })
        .lean();
      const departments = await Department.find({
        _id: user.departmentId,
      }).populate("managerId", "name");
      return jsonOk({ users, departments });
    }

    return jsonError("غير مصرح", 403);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    if (!canManageTeam(user.role)) {
      return jsonError("غير مصرح", 403);
    }

    await connectDB();
    const body = await request.json();

    if (!body.name || !body.email || !body.password || !body.role) {
      return jsonError("الاسم والبريد وكلمة المرور والدور مطلوبة");
    }

    const passwordError = validatePassword(String(body.password));
    if (passwordError) return jsonError(passwordError);

    const email = String(body.email).trim().toLowerCase();
    if (!email.includes("@")) return jsonError("البريد غير صالح");

    let createRole = String(body.role);
    let departmentId = body.departmentId || null;
    let managerId = body.managerId || null;

    if (user.role === "ceo") {
      // CEO adds managers only
      if (createRole !== "manager") {
        return jsonError("المدير التنفيذي يمكنه إضافة مدراء فقط", 403);
      }
      if (!departmentId) {
        return jsonError("يجب اختيار قسم للمدير");
      }
      const dept = await Department.findById(departmentId);
      if (!dept) return jsonError("القسم غير موجود");
      managerId = null;
    } else if (user.role === "manager") {
      // Managers add employees only
      if (createRole !== "employee") {
        return jsonError("المدير يمكنه إضافة موظفين فقط", 403);
      }
      if (!user.departmentId) {
        return jsonError("حساب المدير غير مرتبط بقسم");
      }
      managerId = user.id;
      departmentId = user.departmentId;
    } else {
      return jsonError("غير مصرح", 403);
    }

    const exists = await User.findOne({ email });
    if (exists) return jsonError("البريد مستخدم مسبقًا");

    const passwordHash = await bcrypt.hash(String(body.password), BCRYPT_ROUNDS);
    const created = await User.create({
      name: String(body.name).trim(),
      email,
      passwordHash,
      role: createRole,
      departmentId,
      managerId,
    });

    if (createRole === "manager" && departmentId) {
      await Department.findByIdAndUpdate(departmentId, {
        managerId: created._id,
      });
    }

    const safe = await User.findById(created._id)
      .select("-passwordHash")
      .populate("departmentId", "name")
      .populate("managerId", "name email");

    return jsonOk(safe, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
