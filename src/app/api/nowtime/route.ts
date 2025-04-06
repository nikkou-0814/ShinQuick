import { NextResponse } from "next/server";
import Sntp from "sntp";

export async function GET() {
  try {
    const options = {
      host: "ntp.nict.jp",
      port: 123,
      timeout: 1000,
    };

    const timeData = await Sntp.time(options);
    return NextResponse.json({
      dateTime: new Date(timeData.receiveTimestamp).toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "NTPサーバー時刻の取得に失敗しました" },
      { status: 500 }
    );
  }
}
