import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { createOtp } from "@/lib/otp-store";

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Gmail khong hop le." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Chua cau hinh SUPABASE_SERVICE_ROLE_KEY trong .env.local." },
        { status: 500 },
      );
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

    if (!gmailUser || !gmailAppPassword) {
      return NextResponse.json(
        { error: "Chua cau hinh GMAIL_USER hoac GMAIL_APP_PASSWORD trong .env.local." },
        { status: 500 },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await admin.auth.admin.listUsers();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { error: "Gmail nay chua duoc dang ky tai khoan." },
        { status: 404 },
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
      subject: "Ma OTP khoi phuc mat khau So ghi no",
      text: `Ma OTP khoi phuc mat khau cua ban la: ${code}. Ma co hieu luc trong 10 phut.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#24322f">
          <h2>Yeu cau khoi phuc mat khau So ghi no</h2>
          <p>Nhap ma ben duoi de hoan tat dat lai mat khau cua ban:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#d6663f">${code}</p>
          <p>Ma co hieu luc trong 10 phut.</p>
          <p style="font-size:12px;color:#7d776d">Neu ban khong yeu cau khoi phuc mat khau, ban co the bo qua email nay.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Da xay ra loi." }, { status: 500 });
  }
}
