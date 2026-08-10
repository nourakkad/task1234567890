import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { BCRYPT_ROUNDS, validatePassword } from "@/lib/password";
import {
  canManageDirectory,
  canManageHrAccounts,
  canViewOrgDirectory,
} from "@/lib/permissions";
import {
  buildTeamPerformance,
  currentMonthRange,
} from "@/lib/performance";
import { requireSessionUser } from "@/lib/session";
import { Department } from "@/models/Department";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

async function withMonthlyRatings<T extends { _id: Types.ObjectId; name: string }>(
  users: T[]
) {
  const now = new Date();
  const { start, end } = currentMonthRange(now);
  const performanceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rows = await buildTeamPerformance(
    users.map((u) => ({ _id: u._id, name: u.name })),
    Task,
    start,
    end
  );
  const byId = new Map(rows.map((r) => [r.userId, r]));
  return {
    performanceMonth,
    users: users.map((u) => {
      const stats = byId.get(String(u._id));
      return {
        ...u,
        avgScore: stats?.avgScore ?? null,
        reviewCount: stats?.reviewCount ?? 0,
      };
    }),
  };
}

export async function GET() {
  try {
    const user = await requireSessionUser();
    if (!canViewOrgDirectory(user.role)) {
      return jsonError("غير مصرح", 403);
    }

    await connectDB();

    if (user.role === "hr" || user.role === "ceo") {
      const roles =
        user.role === "ceo"
          ? (["hr", "manager", "employee"] as const)
          : (["manager", "employee"] as const);
      const rawUsers = await User.find({
        active: true,
        role: { $in: [...roles] },
      })
        .select("-passwordHash")
        .populate("departmentId", "_id name")
        .populate("managerId", "_id name email")
        .sort({ role: 1, name: 1 })
        .lean();
      const departments = await Department.find()
        .populate("managerId", "_id name email")
        .sort({ name: 1 })
        .lean();
      const { users, performanceMonth } = await withMonthlyRatings(rawUsers);
      return jsonOk({
        users,
        departments,
        performanceMonth,
        canEdit: user.role === "hr",
        canEditHr: canManageHrAccounts(user.role),
      });
    }

    // Manager: own employees only
    const rawUsers = await User.find({
      active: true,
      role: "employee",
      managerId: user.id,
    })
      .select("-passwordHash")
      .populate("departmentId", "_id name")
      .populate("managerId", "_id name email")
      .sort({ name: 1 })
      .lean();
    const departments = user.departmentId
      ? await Department.find({ _id: user.departmentId })
          .populate("managerId", "name")
          .lean()
      : [];
    const { users, performanceMonth } = await withMonthlyRatings(rawUsers);
    return jsonOk({
      users,
      departments,
      performanceMonth,
      canEdit: false,
      canEditHr: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const body = await request.json();

    if (!body.name || !body.email || !body.password || !body.role) {
      return jsonError("الاسم والبريد وكلمة المرور والدور مطلوبة");
    }

    const passwordError = validatePassword(String(body.password));
    if (passwordError) return jsonError(passwordError);

    const email = String(body.email).trim().toLowerCase();
    if (!email.includes("@")) return jsonError("البريد غير صالح");

    const createRole = String(body.role);

    // CEO may only create HR accounts
    if (canManageHrAccounts(user.role) && createRole === "hr") {
      const exists = await User.findOne({ email });
      if (exists) return jsonError("البريد مستخدم مسبقًا");

      const passwordHash = await bcrypt.hash(
        String(body.password),
        BCRYPT_ROUNDS
      );
      const created = await User.create({
        name: String(body.name).trim(),
        email,
        passwordHash,
        role: "hr",
        departmentId: null,
        managerId: null,
      });

      const safe = await User.findById(created._id).select("-passwordHash");
      return jsonOk(safe, 201);
    }

    if (!canManageDirectory(user.role)) {
      return jsonError("غير مصرح بإضافة هذا النوع من المستخدمين", 403);
    }

    if (createRole !== "manager" && createRole !== "employee") {
      return jsonError("يمكن إضافة مدراء أو موظفين فقط");
    }

    let departmentId: Types.ObjectId | null = null;
    let managerId: Types.ObjectId | null = null;

    if (createRole === "manager") {
      const newDepartmentName = String(body.newDepartmentName || "").trim();
      if (newDepartmentName) {
        if (newDepartmentName.length < 2) {
          return jsonError("اسم القسم قصير جدًا");
        }
        const existingDept = await Department.findOne({
          name: newDepartmentName,
        });
        if (existingDept) {
          return jsonError("يوجد قسم بنفس الاسم — اختره من القائمة");
        }
        const createdDept = await Department.create({
          name: newDepartmentName,
          managerId: null,
        });
        departmentId = createdDept._id;
      } else if (body.departmentId) {
        if (!Types.ObjectId.isValid(String(body.departmentId))) {
          return jsonError("معرّف القسم غير صالح");
        }
        const dept = await Department.findById(body.departmentId);
        if (!dept) return jsonError("القسم غير موجود");
        departmentId = dept._id;
      } else {
        return jsonError("اختر قسمًا موجودًا أو أنشئ قسمًا جديدًا");
      }
    } else {
      // employee
      if (!body.managerId || !Types.ObjectId.isValid(String(body.managerId))) {
        return jsonError("اختر المدير المسؤول");
      }
      const manager = await User.findOne({
        _id: body.managerId,
        role: "manager",
        active: true,
      });
      if (!manager) return jsonError("المدير غير موجود", 404);
      managerId = manager._id;
      departmentId = manager.departmentId || null;
      if (body.departmentId) {
        if (!Types.ObjectId.isValid(String(body.departmentId))) {
          return jsonError("معرّف القسم غير صالح");
        }
        const dept = await Department.findById(body.departmentId);
        if (!dept) return jsonError("القسم غير موجود");
        departmentId = dept._id;
      }
      if (!departmentId) {
        return jsonError("يجب ربط الموظف بقسم");
      }
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
