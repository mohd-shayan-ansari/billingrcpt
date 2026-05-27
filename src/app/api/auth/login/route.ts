import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthCookie, createSessionToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z
  .object({
    username: z.string().min(2).optional(),
    name: z.string().min(2).optional(),
    password: z.string().min(6),
  })
  .refine((data) => !!(data.username || data.name), { message: "Invalid credentials" });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  // Prefer username (email) when provided, fall back to name for backwards compatibility
  const lookup = parsed.data.username ? { username: parsed.data.username } : { name: parsed.data.name };

  const user = await prisma.user.findFirst({ where: lookup });

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!user.isActive) {
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    },
  });

  response.headers.set("Set-Cookie", createAuthCookie(token));

  return response;
}