import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyOtp } from "@/lib/otp-store";

export async function POST(request: Request) {
  try {
    const { email, password, otp } = (await request.json()) as {
      email?: string;
      password?: string;
      otp?: string;
    };

    if (!email || !password || !otp) {
      return NextResponse.json({ error: "Thieu Gmail, mat khau moi hoac OTP." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Mat khau moi phai co it nhat 6 ky tu." }, { status: 400 });
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

    // Find the user's ID by listing users and finding the email
    const { data, error: findError } = await admin.auth.admin.listUsers();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 400 });
    }

    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { error: "Khong tim thay tai khoan voi Gmail nay." },
        { status: 404 },
      );
    }

    // Update the password using admin API
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Da xay ra loi." }, { status: 500 });
  }
}
