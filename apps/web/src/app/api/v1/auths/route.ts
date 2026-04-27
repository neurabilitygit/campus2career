import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    providers: [
      {
        id: "google",
        label: "Google",
        loginUrl: "/auth",
      },
    ],
  });
}
