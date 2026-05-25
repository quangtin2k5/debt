import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp-store";

export async function POST(request: Request) {
  const { email, otp } = (await request.json()) as { email?: string; otp?: string };

  if (!email || !otp) {
    return NextResponse.json({ error: "Thieu Gmail hoac OTP." }, { status: 400 });
  }

  const result = verifyOtp(email, otp);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
