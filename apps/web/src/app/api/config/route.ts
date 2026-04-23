import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    appName: "Rising Senior",
    environment: process.env.NODE_ENV || "development",
    webBaseUrl:
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      "http://localhost:3000",
  });
}
