import crypto from "crypto";

type OtpRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
};

const OTP_TTL = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const globalStore = globalThis as typeof globalThis & {
  debtOtpStore?: Map<string, OtpRecord>;
};

const store = globalStore.debtOtpStore ?? new Map<string, OtpRecord>();
globalStore.debtOtpStore = store;

function hashOtp(email: string, code: string) {
  return crypto
    .createHash("sha256")
    .update(`${email.toLowerCase()}:${code}:${process.env.OTP_SECRET ?? "dev-secret"}`)
    .digest("hex");
}

export function createOtp(email: string) {
  const code = crypto.randomInt(100000, 999999).toString();
  store.set(email.toLowerCase(), {
    codeHash: hashOtp(email, code),
    expiresAt: Date.now() + OTP_TTL,
    attempts: 0,
  });
  return code;
}

export function verifyOtp(email: string, code: string) {
  const key = email.toLowerCase();
  const record = store.get(key);

  if (!record) return { ok: false, message: "Ma OTP khong ton tai hoac da het han." };
  if (Date.now() > record.expiresAt) {
    store.delete(key);
    return { ok: false, message: "Ma OTP da het han. Hay gui lai ma moi." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    return { ok: false, message: "Ban da nhap sai qua nhieu lan. Hay gui lai OTP." };
  }

  record.attempts += 1;
  if (record.codeHash !== hashOtp(email, code)) {
    return { ok: false, message: "Ma OTP khong dung." };
  }

  store.delete(key);
  return { ok: true, message: "OTP hop le." };
}
