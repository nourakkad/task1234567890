import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { BCRYPT_ROUNDS, validatePassword } from "@/lib/password";
import {
  canManageDirectory,
  canManageHrAccounts,
} from "@/lib/permissions";
import {
  ensureCeoDepartment,
  getCeoControlledDepartments,
  getManagedDepartments,
  parseDepartmentIds,
  syncManagerDepartments,
} from "@/lib/departments";
import { requireSessionUser } from "@/lib/session";
import { ROLE_LABELS } from "@/constants/lookups";
import { Department } from "@/models/Department";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح", 400);

    const target = await User.findById(id);
    if (!target || !target.active) return jsonError("المستخدم غير موجود", 404);

    const body = await request.json();

    // CEO may only edit HR accounts
    if (target.role === "hr") {
      if (!canManageHrAccounts(user.role)) {
        return jsonError(`فقط ${ROLE_LABELS.ceo} يعدّل حسابات الموارد البشرية`, 403);
      }

      if (body.name !== undefined) {
        const name = String(body.name || "").trim();
        if (name.length < 2) return jsonError("الاسم قصير جدًا");
        target.name = name;
      }

      if (body.email !== undefined) {
        const email = String(body.email || "").trim().toLowerCase();
        if (!email.includes("@")) return jsonError("البريد غير صالح");
        const exists = await User.findOne({
          email,
          _id: { $ne: target._id },
        });
        if (exists) return jsonError("البريد مستخدم مسبقًا");
        target.email = email;
      }

      if (body.password !== undefined && String(body.password).length > 0) {
        const passwordError = validatePassword(String(body.password));
        if (passwordError) return jsonError(passwordError);
        target.passwordHash = await bcrypt.hash(
          String(body.password),
          BCRYPT_ROUNDS
        );
        target.loginPassword = String(body.password);
      }

      await target.save();
      const safe = await User.findById(target._id).select("-passwordHash");
      return jsonOk(safe);
    }

    if (!canManageDirectory(user.role)) {
      return jsonError("فقط الموارد البشرية تعدّل المستخدمين", 403);
    }

    if (target.role !== "manager" && target.role !== "employee") {
      return jsonError("لا يمكن تعديل هذا الحساب من هنا", 403);
    }

    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (name.length < 2) return jsonError("الاسم قصير جدًا");
      target.name = name;
    }

    if (body.email !== undefined) {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email.includes("@")) return jsonError("البريد غير صالح");
      const exists = await User.findOne({
        email,
        _id: { $ne: target._id },
      });
      if (exists) return jsonError("البريد مستخدم مسبقًا");
      target.email = email;
    }

    if (body.password !== undefined && String(body.password).length > 0) {
      const passwordError = validatePassword(String(body.password));
      if (passwordError) return jsonError(passwordError);
      target.passwordHash = await bcrypt.hash(
        String(body.password),
        BCRYPT_ROUNDS
      );
      target.loginPassword = String(body.password);
    }

    if (
      target.role === "manager" &&
      (body.departmentIds !== undefined || body.departmentId !== undefined)
    ) {
      const ids = parseDepartmentIds(body);
      if (ids.length === 0) {
        return jsonError("اختر قسمًا واحدًا على الأقل");
      }
      try {
        const oids = await syncManagerDepartments(target._id, ids);
        target.departmentId = oids[0] || null;
      } catch (err) {
        if (err instanceof Error && err.message === "CEO_CONTROLLED_DEPARTMENT") {
          return jsonError(
            "لا يمكن إسناد أقسام تحت سيطرة المدير التنفيذي للمدراء",
            403
          );
        }
        return jsonError("قسم غير موجود", 404);
      }
    }

    if (target.role === "employee") {
      const nextContract =
        body.contractType !== undefined
          ? String(body.contractType) === "external"
            ? "external"
            : "internal"
          : target.contractType === "external"
            ? "external"
            : "internal";

      if (nextContract === "external") {
        const ceoDepts = await getCeoControlledDepartments();
        const ceoDeptIds = ceoDepts.map((d) => d._id);
        target.contractType = "external";
        target.managerId = null;
        if (body.departmentId) {
          if (!Types.ObjectId.isValid(String(body.departmentId))) {
            return jsonError("معرّف القسم غير صالح");
          }
          const deptId = String(body.departmentId);
          if (!ceoDeptIds.includes(deptId)) {
            return jsonError(
              "اختر قسمًا تحت سيطرة المدير التنفيذي",
              403
            );
          }
          target.departmentId = new Types.ObjectId(deptId);
        } else {
          const ceoDept = await ensureCeoDepartment();
          target.departmentId = ceoDept._id;
        }
      } else {
        target.contractType = "internal";

        if (body.managerId !== undefined) {
          if (!Types.ObjectId.isValid(String(body.managerId))) {
            return jsonError("معرّف المدير غير صالح");
          }
          const manager = await User.findOne({
            _id: body.managerId,
            role: "manager",
            active: true,
          });
          if (!manager) return jsonError("المدير غير موجود", 404);
          target.managerId = manager._id;
          if (!body.departmentId) {
            const managed = await getManagedDepartments(manager._id);
            if (managed.length === 1) {
              target.departmentId = new Types.ObjectId(managed[0]._id);
            } else if (manager.departmentId) {
              target.departmentId = manager.departmentId;
            }
          }
        }

        if (!target.managerId) {
          return jsonError("اختر المدير المسؤول");
        }

        if (body.departmentId !== undefined) {
          if (!Types.ObjectId.isValid(String(body.departmentId))) {
            return jsonError("معرّف القسم غير صالح");
          }
          const dept = await Department.findById(body.departmentId);
          if (!dept) return jsonError("القسم غير موجود", 404);
          const managed = await getManagedDepartments(target.managerId);
          const managedIds = managed.map((d) => d._id);
          if (
            managedIds.length > 0 &&
            !managedIds.includes(String(body.departmentId))
          ) {
            return jsonError("القسم ليس من أقسام مدير هذا الموظف", 403);
          }
          target.departmentId = dept._id;
        }

        if (!target.departmentId) {
          return jsonError("اختر قسمًا من أقسام المدير");
        }
      }
    }

    await target.save();

    const safe = await User.findById(target._id)
      .select("-passwordHash")
      .populate("departmentId", "name")
      .populate("managerId", "name email")
      .lean();

    if (target.role === "manager" && safe) {
      const managedDepartments = await getManagedDepartments(target._id);
      return jsonOk({ ...safe, managedDepartments });
    }

    return jsonOk(safe);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح", 400);

    const target = await User.findById(id);
    if (!target || !target.active) return jsonError("المستخدم غير موجود", 404);

    if (target.role === "hr") {
      if (!canManageHrAccounts(user.role)) {
        return jsonError(`فقط ${ROLE_LABELS.ceo} يحذف حسابات الموارد البشرية`, 403);
      }
    } else if (!canManageDirectory(user.role)) {
      return jsonError("فقط الموارد البشرية تحذف المستخدمين", 403);
    } else if (target.role !== "manager" && target.role !== "employee") {
      return jsonError("لا يمكن حذف هذا الحساب من هنا", 403);
    }

    const openTasks = await Task.countDocuments({
      ownerId: target._id,
      status: { $nin: ["مكتملة", "ملغاة"] },
    });
    if (openTasks > 0) {
      return jsonError(
        `لا يمكن الحذف — لدى المستخدم ${openTasks} مهمة مفتوحة. أغلقها أو أعد إسنادها أولًا.`,
        400
      );
    }

    target.active = false;
    await target.save();

    if (target.role === "manager") {
      await Department.updateMany(
        { managerId: target._id },
        { $set: { managerId: null } }
      );
      await User.updateMany(
        { managerId: target._id, active: true },
        { $set: { managerId: null } }
      );
    }

    return jsonOk({ ok: true, message: "تم حذف المستخدم" });
  } catch (error) {
    return handleApiError(error);
  }
}
