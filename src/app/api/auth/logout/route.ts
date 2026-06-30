import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function appUrl(path: string, request: Request) {
  const baseUrl = process.env.LINE_CALLBACK_URL
    ? new URL(process.env.LINE_CALLBACK_URL).origin
    : new URL(request.url).origin;

  return new URL(path, baseUrl);
}

export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(appUrl("/", request));
}

export async function GET(request: Request) {
  await destroySession();
  return NextResponse.redirect(appUrl("/", request));
}
