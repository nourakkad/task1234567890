import type { IUser } from "@/models/User";

const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export function isLoginLocked(user: Pick<IUser, "lockedUntil">): boolean {
  if (!user.lockedUntil) return false;
  return new Date(user.lockedUntil).getTime() > Date.now();
}

export async function registerFailedLogin(user: {
  failedLoginCount?: number;
  lockedUntil?: Date | null;
  save: () => Promise<unknown>;
}) {
  const count = (user.failedLoginCount || 0) + 1;
  user.failedLoginCount = count;
  if (count >= MAX_ATTEMPTS) {
    user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
    user.failedLoginCount = 0;
  }
  await user.save();
}

export async function clearFailedLogins(user: {
  failedLoginCount?: number;
  lockedUntil?: Date | null;
  save: () => Promise<unknown>;
}) {
  if (!user.failedLoginCount && !user.lockedUntil) return;
  user.failedLoginCount = 0;
  user.lockedUntil = null;
  await user.save();
}

export const LOGIN_LOCK_MESSAGE =
  "تم قفل الحساب مؤقتًا بسبب محاولات دخول فاشلة. حاول بعد 15 دقيقة.";
