import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  userId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updatePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Get current user to verify current password
  const currentUser = await prisma.user.findUnique({ where: { id: session.id } });

  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify current password
  const passwordValid = await verifyPassword(parsed.data.currentPassword, currentUser.passwordHash);

  if (!passwordValid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  // Determine which user's password to update
  let targetUserId = session.id;
  if (parsed.data.userId && parsed.data.userId !== "self") {
    // Only Master Admin can change other users' passwords
    if (session.role !== Role.MASTER_ADMIN) {
      return NextResponse.json({ error: "Only Master Admin can change other users' passwords" }, { status: 403 });
    }
    targetUserId = parsed.data.userId;
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Update to new password
  const newPasswordHash = await hashPassword(parsed.data.newPassword);

  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash: newPasswordHash },
  });

  return NextResponse.json({ success: true });
}
