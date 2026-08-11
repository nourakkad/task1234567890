import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { BCRYPT_ROUNDS, validatePassword } from "@/lib/password";
import { requireSessionUser } from "@/lib/session";
import { User } from "@/models/User";

export async function PATCH(request: Request) {
  try {
    const sessionUser = await requireSessionUser();
    await connectDB();

    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return jsonError("جميع الحقول مطلوبة");
    }

    if (newPassword !== confirmPassword) {
      return jsonError("كلمة المرور الجديدة وتأكيدها غير متطابقين");
    }

    if (currentPassword === newPassword) {
      return jsonError("كلمة المرور الجديدة يجب أن تختلف عن الحالية");
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) return jsonError(passwordError);

    const user = await User.findById(sessionUser.id);
    if (!user || !user.active) {
      return jsonError("غير مصرح", 401);
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return jsonError("كلمة المرور الحالية غير صحيحة", 400);
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.loginPassword = null;
    await user.save();

    return jsonOk({ ok: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    return handleApiError(error);
  }
}
