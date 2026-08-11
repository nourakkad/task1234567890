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
  ensureCeoDepartment,
  getManagedDepartments,
  parseDepartmentIds,
  syncManagerDepartments,
} from "@/lib/departments";
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

      // Attach all departments each manager is responsible for
      const managerIds = users
        .filter((u) => u.role === "manager")
        .map((u) => u._id);
      const managedBy = new Map<string, Array<{ _id: string; name: string }>>();
      if (managerIds.length > 0) {
        const depts = await Department.find({
          managerId: { $in: managerIds },
        })
          .select("_id name managerId")
          .lean();
        for (const d of depts) {
          const mid = String(d.managerId);
          const list = managedBy.get(mid) || [];
          list.push({ _id: String(d._id), name: d.name });
          managedBy.set(mid, list);
        }
      }
      const usersWithDepts = users.map((u) => {
        if (u.role !== "manager") return u;
        const managedDepartments = managedBy.get(String(u._id)) || [];
        return { ...u, managedDepartments };
      });

      return jsonOk({
        users: usersWithDepts,
        departments,
        performanceMonth,
        canEdit: user.role === "hr",
        canEditHr: canManageHrAccounts(user.role),
      });
    }

    // Manager: own employees + all departments they manage
    const rawUsers = await User.find({
      active: true,
      role: "employee",
      managerId: user.id,
    })
      .select("-passwordHash -loginPassword")
      .populate("departmentId", "_id name")
      .populate("managerId", "_id name email")
      .sort({ name: 1 })
      .lean();
    const departments = await Department.find({ managerId: user.id })
      .populate("managerId", "name")
      .sort({ name: 1 })
      .lean();
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
        loginPassword: String(body.password),
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
    let managerDeptIds: string[] = [];

    if (createRole === "manager") {
      const newDepartmentName = String(body.newDepartmentName || "").trim();
      managerDeptIds = parseDepartmentIds(body);

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
        managerDeptIds = [...new Set([...managerDeptIds, String(createdDept._id)])];
      }

      if (managerDeptIds.length === 0) {
        return jsonError("اختر قسمًا واحدًا على الأقل أو أنشئ قسمًا جديدًا");
      }
      departmentId = new Types.ObjectId(managerDeptIds[0]);
    } else {
      // employee
      const contractType =
        String(body.contractType || "internal") === "external"
          ? "external"
          : "internal";

      if (contractType === "external") {
        const ceoDept = await ensureCeoDepartment();
        managerId = null;
        departmentId = ceoDept._id;
      } else {
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

        const managed = await getManagedDepartments(manager._id);
        const managedIds = managed.map((d) => d._id);

        if (body.departmentId) {
          if (!Types.ObjectId.isValid(String(body.departmentId))) {
            return jsonError("معرّف القسم غير صالح");
          }
          const deptId = String(body.departmentId);
          if (managedIds.length > 0 && !managedIds.includes(deptId)) {
            return jsonError("القسم ليس من أقسام هذا المدير", 403);
          }
          const dept = await Department.findById(deptId);
          if (!dept) return jsonError("القسم غير موجود");
          departmentId = dept._id;
        } else if (managedIds.length === 1) {
          departmentId = new Types.ObjectId(managedIds[0]);
        } else if (manager.departmentId) {
          departmentId = manager.departmentId;
        }
        if (!departmentId) {
          return jsonError("اختر قسمًا من أقسام المدير");
        }
      }

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
        loginPassword: String(body.password),
        role: "employee",
        contractType,
        departmentId,
        managerId,
      });

      const safe = await User.findById(created._id)
        .select("-passwordHash")
        .populate("departmentId", "name")
        .populate("managerId", "name email")
        .lean();

      return jsonOk(safe, 201);
    }

    const exists = await User.findOne({ email });
    if (exists) return jsonError("البريد مستخدم مسبقًا");

    const passwordHash = await bcrypt.hash(String(body.password), BCRYPT_ROUNDS);
    const created = await User.create({
      name: String(body.name).trim(),
      email,
      passwordHash,
      loginPassword: String(body.password),
      role: createRole,
      departmentId,
      managerId,
    });

    if (createRole === "manager") {
      try {
        await syncManagerDepartments(created._id, managerDeptIds);
      } catch {
        return jsonError("قسم غير موجود", 404);
      }
    }

    const safe = await User.findById(created._id)
      .select("-passwordHash")
      .populate("departmentId", "name")
      .populate("managerId", "name email")
      .lean();

    if (createRole === "manager" && safe) {
      const managedDepartments = await getManagedDepartments(created._id);
      return jsonOk({ ...safe, managedDepartments }, 201);
    }

    return jsonOk(safe, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
