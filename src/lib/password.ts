const MIN_LENGTH = 10;

export function validatePassword(password: string): string | null {
  if (!password || password.length < MIN_LENGTH) {
    return `كلمة المرور يجب أن تكون ${MIN_LENGTH} أحرف على الأقل`;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على حروف وأرقام";
  }
  return null;
}

export const BCRYPT_ROUNDS = 12;
