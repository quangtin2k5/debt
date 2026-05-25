import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createOtp } from "@/lib/otp-store";

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email?: string };

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Gmail khong hop le." }, { status: 400 });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

  if (!gmailUser || !gmailAppPassword) {
    return NextResponse.json(
      { error: "Chua cau hinh GMAIL_USER hoac GMAIL_APP_PASSWORD trong .env.local." },
      { status: 500 },
    );
  }

  const code = createOtp(email);
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  await transporter.sendMail({
    from: `"So ghi no" <${gmailUser}>`,
    to: email,
    subject: "Ma OTP dang ky So ghi no",
    text: `Ma OTP cua ban la: ${code}. Ma co hieu luc trong 10 phut.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#24322f">
        <h2>Ma OTP dang ky So ghi no</h2>
        <p>Nhap ma ben duoi de hoan tat dang ky:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
        <p>Ma co hieu luc trong 10 phut.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
