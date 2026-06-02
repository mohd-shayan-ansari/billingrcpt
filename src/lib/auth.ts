import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "billinglottery_token";
const encoder = new TextEncoder();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return encoder.encode(secret);
}

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: "MASTER_ADMIN" | "COUNTER_ADMIN";
  isActive: boolean;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(user: Pick<SessionUser, "id" | "name" | "username" | "role">) {
  return new SignJWT({
    name: user.name,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

/**
 * Resolves the session cookie to a SessionUser.
 * Returns null ONLY when the cookie is missing/invalid or the user no longer exists.
 * Does NOT reject inactive users — isActive is included in the return value so
 * individual endpoints can enforce their own access rules (e.g. POST /receipts).
 * This means a counter admin whose account is disabled keeps a valid session and
 * stays logged in; they are simply blocked from creating new receipts.
 */
export async function getSessionFromRequest(request?: Request) {
  const token = request
    ? request.headers.get("cookie")?.match(/billinglottery_token=([^;]+)/)?.[1]
    : (await cookies()).get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    // Only reject if the user account has been fully deleted from the DB.
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
    } satisfies SessionUser;
  } catch {
    return null;
  }
}

export function createAuthCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; ${process.env.NODE_ENV === "production" ? "Secure;" : ""}`;
}

export function clearAuthCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;`;
}