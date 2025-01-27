import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const tokenUrl = "https://manager.dmdata.jp/account/oauth2/v1/token";
  const clientId = process.env.DM_DATA_CLIENT_ID!;
  const redirectUri = process.env.DM_DATA_REDIRECT_URI!;

  const bodyParams = new URLSearchParams();
  bodyParams.set("grant_type", "authorization_code");
  bodyParams.set("client_id", clientId);
  bodyParams.set("code", code);
  bodyParams.set("redirect_uri", redirectUri);

  const tokenResp = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyParams,
  });

  if (!tokenResp.ok) {
    return NextResponse.json({ error: "token_request_failed" }, { status: 400 });
  }

  const tokenJson = await tokenResp.json();
  const { access_token, refresh_token } = tokenJson;
  const nextUrl = new URL("/oauth/done", request.nextUrl.origin);
  nextUrl.searchParams.set("access_token", access_token);
  if (refresh_token) {
    nextUrl.searchParams.set("refresh_token", refresh_token);
  }

  return NextResponse.redirect(nextUrl);
}
