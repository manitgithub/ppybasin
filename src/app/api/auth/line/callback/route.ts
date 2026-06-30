import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession, upsertLineUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "ppybasin_line_state";

type LineTokenResponse = {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type LineIdTokenPayload = {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  nonce?: string;
  name?: string;
  picture?: string;
  email?: string;
};

function callbackUrl(request: Request) {
  return process.env.LINE_CALLBACK_URL || new URL("/api/auth/line/callback", request.url).toString();
}

function appUrl(path: string, request: Request) {
  const baseUrl = process.env.LINE_CALLBACK_URL
    ? new URL(process.env.LINE_CALLBACK_URL).origin
    : new URL(request.url).origin;

  return new URL(path, baseUrl);
}

function decodeJwtPayload(token: string): LineIdTokenPayload {
  const payload = token.split(".")[1];
  if (!payload) return {};

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as LineIdTokenPayload;
}

async function exchangeCode(request: Request, code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl(request),
    client_id: process.env.LINE_CHANNEL_ID ?? "",
    client_secret: process.env.LINE_CHANNEL_SECRET ?? "",
  });

  const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const payload = (await response.json()) as LineTokenResponse;

  if (!response.ok || !payload.id_token) {
    throw new Error(payload.error_description || payload.error || "Unable to exchange LINE authorization code");
  }

  return payload;
}

async function verifyIdToken(idToken: string) {
  const body = new URLSearchParams({
    id_token: idToken,
    client_id: process.env.LINE_CHANNEL_ID ?? "",
  });

  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("LINE ID token verification failed");
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const stored = cookieStore.get(STATE_COOKIE)?.value;
  const [storedState, storedNonce] = stored?.split(".") ?? [];

  cookieStore.delete(STATE_COOKIE);

  if (error) {
    return NextResponse.redirect(appUrl(`/?login_error=${encodeURIComponent(error)}`, request));
  }

  if (!code || !state || state !== storedState || !storedNonce) {
    return NextResponse.redirect(appUrl("/?login_error=invalid_state", request));
  }

  // debug: log env presence to help diagnose config issues in development
  try {
    // eslint-disable-next-line no-console
    console.debug("LINE callback: LINE_CHANNEL_ID present?", Boolean(process.env.LINE_CHANNEL_ID));
    // eslint-disable-next-line no-console
    console.debug("LINE callback: LINE_CHANNEL_SECRET present?", Boolean(process.env.LINE_CHANNEL_SECRET));
  } catch (e) {
    /* ignore */
  }

  if (!process.env.LINE_CHANNEL_ID || !process.env.LINE_CHANNEL_SECRET) {
    return NextResponse.redirect(appUrl("/?login_error=line_config", request));
  }

  try {
    const token = await exchangeCode(request, code);
    await verifyIdToken(token.id_token as string);

    const profile = decodeJwtPayload(token.id_token as string);

    if (!profile.sub || profile.nonce !== storedNonce) {
      throw new Error("LINE profile payload is invalid");
    }

    const user = await upsertLineUser({
      lineUserId: profile.sub,
      displayName: profile.name || "LINE User",
      pictureUrl: profile.picture ?? null,
      email: profile.email ?? null,
    });

    if (user.status !== "active") {
      return NextResponse.redirect(appUrl("/?login_error=disabled", request));
    }

    await createSession(user.id);
    return NextResponse.redirect(appUrl("/", request));
  } catch (callbackError) {
    console.error("LINE login failed", callbackError);
    return NextResponse.redirect(appUrl("/?login_error=line_failed", request));
  }
}
