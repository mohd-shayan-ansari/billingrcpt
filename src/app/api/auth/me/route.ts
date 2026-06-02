import { NextResponse } from "next/server";
import { getSessionFromRequestIncludingInactive } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSessionFromRequestIncludingInactive(request);

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: session });
}