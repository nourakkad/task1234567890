import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { BCRYPT_ROUNDS, validatePassword } from "@/lib/password";
import {
  canManageDirectory,
  canManageHrAccounts,
} from "@/lib/permissions";
import { requireSessionUser } from "@/lib/session";
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
        return jsonError("فقط المدير التنفيذي يعدّل حسابات الموارد البشرية", 403);
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
    }

    if (target.role === "manager" && body.departmentId !== undefined) {
      if (!Types.ObjectId.isValid(String(body.departmentId))) {
        return jsonError("معرّف القسم غير صالح");
      }
      const dept = await Department.findById(body.departmentId);
      if (!dept) return jsonError("القسم غير موجود", 404);
      const prevDeptId = target.departmentId?.toString() || null;
      target.departmentId = dept._id;
      await Department.findByIdAndUpdate(dept._id, { managerId: target._id });
      if (prevDeptId && prevDeptId !== dept._id.toString()) {
        await Department.updateOne(
          { _id: prevDeptId, managerId: target._id },
          { $set: { managerId: null } }
        );
      }
    }

    if (target.role === "employee") {
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
        if (!body.departmentId && manager.departmentId) {
          target.departmentId = manager.departmentId;
        }
      }
      if (body.departmentId !== undefined) {
        if (!Types.ObjectId.isValid(String(body.departmentId))) {
          return jsonError("معرّف القسم غير صالح");
        }
        const dept = await Department.findById(body.departmentId);
        if (!dept) return jsonError("القسم غير موجود", 404);
        target.departmentId = dept._id;
      }
    }

    await target.save();

    const safe = await User.findById(target._id)
      .select("-passwordHash")
      .populate("departmentId", "name")
      .populate("managerId", "name email");

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
        return jsonError("فقط المدير التنفيذي يحذف حسابات الموارد البشرية", 403);
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
