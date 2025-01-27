import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.DM_DATA_CLIENT_ID!;
  const redirectUri = process.env.DM_DATA_REDIRECT_URI!;
  const state = "someRandomString";
  const dmdataAuthUrl = new URL("https://manager.dmdata.jp/account/oauth2/v1/auth");

  dmdataAuthUrl.searchParams.set("client_id", clientId);
  dmdataAuthUrl.searchParams.set("response_type", "code");
  dmdataAuthUrl.searchParams.set("redirect_uri", redirectUri);
  dmdataAuthUrl.searchParams.set("scope", "contract.list eew.get.forecast socket.close socket.list socket.start");
  dmdataAuthUrl.searchParams.set("state", state);

  return NextResponse.redirect(dmdataAuthUrl.toString());
}
