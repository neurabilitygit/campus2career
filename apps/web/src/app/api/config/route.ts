import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    appName: "Campus2Career",
    environment: process.env.NODE_ENV || "development",
    webBaseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  });
}
