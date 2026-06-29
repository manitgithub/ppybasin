import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LINE_AUTH_URL = "https://access.line.me/oauth2/v2.1/authorize";
const STATE_COOKIE = "ppybasin_line_state";

function callbackUrl(request: Request) {
  return process.env.LINE_CALLBACK_URL || new URL("/api/auth/line/callback", request.url).toString();
}

export async function GET(request: Request) {
  const channelId = process.env.LINE_CHANNEL_ID;

  if (!channelId) {
    return NextResponse.redirect(new URL("/?login_error=line_config", request.url));
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const nonce = crypto.randomBytes(24).toString("base64url");
  const url = new URL(LINE_AUTH_URL);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", channelId);
  url.searchParams.set("redirect_uri", callbackUrl(request));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("nonce", nonce);

  (await cookies()).set(STATE_COOKIE, `${state}.${nonce}`, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.redirect(url);
}
