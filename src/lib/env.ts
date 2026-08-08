/**
 * Central env validation for local + Netlify production.
 * Fail fast in production when secrets/DB URI are missing or unsafe.
 */

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NETLIFY === "true" ||
    process.env.CONTEXT === "production"
  );
}

function isLocalMongo(uri: string) {
  return (
    uri.includes("127.0.0.1") ||
    uri.includes("localhost") ||
    uri.startsWith("mongodb://0.0.0.0")
  );
}

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    if (isProductionRuntime()) {
      throw new Error(
        "MONGODB_URI is required in production (use MongoDB Atlas)."
      );
    }
    return "mongodb://127.0.0.1:27017/alhadara_tasks";
  }

  if (isProductionRuntime() && isLocalMongo(uri)) {
    throw new Error(
      "MONGODB_URI must point to a remote database (e.g. MongoDB Atlas) in production."
    );
  }

  return uri;
}

export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    if (isProductionRuntime()) {
      throw new Error(
        "NEXTAUTH_SECRET is required in production. Generate with: openssl rand -base64 32"
      );
    }
    return "dev-only-insecure-secret-change-me";
  }

  if (isProductionRuntime() && secret.length < 32) {
    throw new Error(
      "NEXTAUTH_SECRET must be at least 32 characters in production."
    );
  }

  const weak = [
    "change-me",
    "alhadara-dev-secret",
    "dev-only-insecure-secret",
  ];
  if (
    isProductionRuntime() &&
    weak.some((w) => secret.toLowerCase().includes(w))
  ) {
    throw new Error(
      "NEXTAUTH_SECRET looks like a development placeholder. Use a strong random value."
    );
  }

  return secret;
}

export function isDemoLoginEnabled() {
  if (isProductionRuntime()) {
    return process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";
  }
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN !== "false";
}

export function assertServerEnv() {
  getMongoUri();
  getAuthSecret();
}
