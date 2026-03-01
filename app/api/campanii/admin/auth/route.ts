import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/campanii/admin-auth";

export async function GET() {
  const isAdmin = await verifyAdminSession();
  return NextResponse.json({ isAdmin });
}
