import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyOtp } from "@/lib/otp-store";

export async function POST(request: Request) {
  const { email, password, otp } = (await request.json()) as {
    email?: string;
    password?: string;
    otp?: string;
  };

  if (!email || !password || !otp) {
    return NextResponse.json({ error: "Thieu Gmail, mat khau hoac OTP." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Mat khau phai co it nhat 6 ky tu." }, { status: 400 });
  }

  const otpResult = verifyOtp(email, otp);
  if (!otpResult.ok) {
    return NextResponse.json({ error: otpResult.message }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Chua cau hinh SUPABASE_SERVICE_ROLE_KEY trong .env.local." },
      { status: 500 },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    const alreadyExists = error.message.toLowerCase().includes("already");
    return NextResponse.json(
      { error: alreadyExists ? "Gmail nay da co tai khoan. Hay dang nhap." : error.message },
      { status: alreadyExists ? 409 : 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
