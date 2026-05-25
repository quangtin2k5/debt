"use client";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleDollarSign,
  LogOut,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
  Edit2,
  Trash2,
  Settings,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DebtSide = "I_OWE" | "THEY_OWE";
type TxType = "DEBT" | "PAYMENT";

type Contact = {
  id: string;
  user_id: string;
  name: string;
  side: DebtSide;
  created_at: string;
};

type DebtTransaction = {
  id: string;
  contact_id: string;
  type: TxType;
  amount: number;
  note: string | null;
  happened_at: string;
  created_at: string;
};

const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
const activityKey = "debt-mobile-last-activity";

function currency(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function balanceOf(items: DebtTransaction[]) {
  return items.reduce((sum, item) => {
    return sum + (item.type === "DEBT" ? Number(item.amount) : -Number(item.amount));
  }, 0);
}

function formatNumberInput(value: string) {
  const clean = value.replace(/\D/g, "");
  if (!clean) return "";
  return new Intl.NumberFormat("vi-VN").format(Number(clean));
}

function getAmountSuggestions(rawValue: string): string[] {
  const clean = rawValue.replace(/\D/g, "");
  if (!clean) return [];
  
  const num = Number(clean);
  if (isNaN(num) || num <= 0 || num >= 10000000) return [];
  
  const multipliers = [10, 100, 1000, 10000, 100000, 1000000];
  const results: number[] = [];
  
  multipliers.forEach(m => {
    const val = num * m;
    if (val >= 1000 && val <= 50000000 && !results.includes(val)) {
      results.push(val);
    }
  });
  
  return results
    .sort((a, b) => a - b)
    .slice(0, 4)
    .map(val => new Intl.NumberFormat("vi-VN").format(val));
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [mode, setMode] = useState<"login" | "register" | "otp">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpArray, setOtpArray] = useState(["", "", "", "", "", ""]);
  const [authMessage, setAuthMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState<DebtSide>("I_OWE");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allTransactions, setAllTransactions] = useState<DebtTransaction[]>([]);
  const [transactions, setTransactions] = useState<DebtTransaction[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [contactModal, setContactModal] = useState(false);
  const [txModal, setTxModal] = useState(false);
  const [contactName, setContactName] = useState("");
  const [appMessage, setAppMessage] = useState("");
  const [txType, setTxType] = useState<TxType>("DEBT");
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Edit/Delete Contacts states
  const [editContactModal, setEditContactModal] = useState(false);
  const [editContactName, setEditContactName] = useState("");
  const [editContactSide, setEditContactSide] = useState<DebtSide>("I_OWE");
  const [deleteContactConfirm, setDeleteContactConfirm] = useState(false);

  // Edit/Delete Transactions states
  const [editingTx, setEditingTx] = useState<DebtTransaction | null>(null);
  const [editTxModal, setEditTxModal] = useState(false);
  const [editTxType, setEditTxType] = useState<TxType>("DEBT");
  const [editTxAmount, setEditTxAmount] = useState("");
  const [editTxDate, setEditTxDate] = useState("");
  const [editTxNote, setEditTxNote] = useState("");
  const [deleteTxConfirmId, setDeleteTxConfirmId] = useState<string | null>(null);

  const handleAmountChange = (val: string, setter: (v: string) => void) => {
    const formatted = formatNumberInput(val);
    setter(formatted);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getUser().then(({ data }) => {
      const last = Number(localStorage.getItem(activityKey) || 0);
      if (data.user && last && Date.now() - last > FIVE_DAYS) {
        supabase.auth.signOut();
        setUser(null);
      } else {
        setUser(data.user ?? null);
        if (data.user) localStorage.setItem(activityKey, String(Date.now()));
      }
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) localStorage.setItem(activityKey, String(Date.now()));
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const markActive = () => localStorage.setItem(activityKey, String(Date.now()));
    window.addEventListener("click", markActive);
    window.addEventListener("keydown", markActive);
    window.addEventListener("touchstart", markActive);
    return () => {
      window.removeEventListener("click", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("touchstart", markActive);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadContacts();
  }, [user]);

  useEffect(() => {
    if (!selected) return;
    loadTransactions(selected.id);
  }, [selected]);

  async function loadContacts() {
    setAppMessage("");
    const { data, error } = await supabase
      .from("debt_contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setAppMessage(error.message);
      return;
    }
    setContacts((data ?? []) as Contact[]);

    const txResult = await supabase
      .from("debt_transactions")
      .select("*")
      .order("happened_at", { ascending: false });
    if (txResult.error) setAppMessage(txResult.error.message);
    else setAllTransactions((txResult.data ?? []) as DebtTransaction[]);
  }

  async function loadTransactions(contactId: string) {
    setAppMessage("");
    const { data, error } = await supabase
      .from("debt_transactions")
      .select("*")
      .eq("contact_id", contactId)
      .order("happened_at", { ascending: false });
    if (!error) {
      setTransactions((data ?? []) as DebtTransaction[]);
      setAllTransactions((current) => {
        const others = current.filter((item) => item.contact_id !== contactId);
        return [...others, ...((data ?? []) as DebtTransaction[])];
      });
    } else {
      setAppMessage(error.message);
    }
  }

  async function verifyAndRegisterOtp(code: string) {
    if (busy || code.length !== 6) return;
    setBusy(true);
    setAuthMessage("");
    try {
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, otp: code }),
      });
      const registerResult = (await registerResponse.json()) as { error?: string };

      if (!registerResponse.ok) {
        setAuthMessage(registerResult.error ?? "Không tạo được tài khoản.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) setAuthMessage(error.message);
        else setAuthMessage("");
      }
    } catch (e: any) {
      setAuthMessage(e.message || "Đã xảy ra lỗi.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const code = otpArray.join("");
    if (code.length === 6 && mode === "otp") {
      verifyAndRegisterOtp(code);
    }
  }, [otpArray, mode]);

  const handleOtpChange = (value: string, index: number) => {
    const val = value.slice(-1);
    if (val && !/^\d+$/.test(val)) return;

    const newOtp = [...otpArray];
    newOtp[index] = val;
    setOtpArray(newOtp);

    if (val !== "" && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (otpArray[index] === "" && index > 0) {
        const prevInput = document.getElementById(`otp-${index - 1}`);
        prevInput?.focus();
        
        const newOtp = [...otpArray];
        newOtp[index - 1] = "";
        setOtpArray(newOtp);
      } else {
        const newOtp = [...otpArray];
        newOtp[index] = "";
        setOtpArray(newOtp);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasteData)) {
      const digits = pasteData.split("");
      setOtpArray(digits);
      document.getElementById("otp-5")?.focus();
    }
  };

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setAuthMessage("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setAuthMessage(error?.message ?? "");
    }

    if (mode === "register") {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) setAuthMessage(result.error ?? "Không gửi được OTP.");
      else {
        setOtpArray(["", "", "", "", "", ""]);
        setMode("otp");
        setAuthMessage("Đã gửi mã OTP bằng Gmail cá nhân. Hãy kiểm tra Hộp thư đến hoặc Spam.");
      }
    }

    if (mode === "otp") {
      const code = otpArray.join("");
      if (code.length !== 6) {
        setAuthMessage("Vui lòng nhập đầy đủ 6 chữ số OTP.");
        setBusy(false);
        return;
      }
      await verifyAndRegisterOtp(code);
    }

    setBusy(false);
  }

  async function resendOtp() {
    if (!email) {
      setAuthMessage("Nhập Gmail trước khi gửi lại OTP.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = (await response.json()) as { error?: string };
    if (response.ok) {
      setOtpArray(["", "", "", "", "", ""]);
      setAuthMessage("Đã gửi lại OTP bằng Gmail cá nhân.");
    } else {
      setAuthMessage(result.error ?? "Không gửi được OTP.");
    }
    setBusy(false);
  }

  async function addContact(event: FormEvent) {
    event.preventDefault();
    if (!contactName.trim() || !user || busy) return;
    setBusy(true);
    setAppMessage("");
    const { error } = await supabase.from("debt_contacts").insert({
      user_id: user.id,
      name: contactName.trim(),
      side: tab,
    });
    setBusy(false);
    if (error) {
      setAppMessage(error.message);
    } else {
      setContactName("");
      setContactModal(false);
      loadContacts();
    }
  }

  async function addTransaction(event: FormEvent) {
    event.preventDefault();
    if (!selected || !txAmount || busy) return;
    setBusy(true);
    setAppMessage("");
    
    const cleanAmount = Number(txAmount.replace(/\D/g, ""));
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setAppMessage("Số tiền không hợp lệ.");
      setBusy(false);
      return;
    }
    
    const { error } = await supabase.from("debt_transactions").insert({
      contact_id: selected.id,
      type: txType,
      amount: cleanAmount,
      note: txNote.trim() || null,
      happened_at: txDate,
    });
    setBusy(false);
    if (error) {
      setAppMessage(error.message);
    } else {
      setTxAmount("");
      setTxNote("");
      setTxType("DEBT");
      setTxDate(new Date().toISOString().slice(0, 10));
      setTxModal(false);
      loadTransactions(selected.id);
      loadContacts();
    }
  }

  // Update & Delete Contact logic
  async function updateContact(event: FormEvent) {
    event.preventDefault();
    if (!selected || !editContactName.trim() || busy) return;
    setBusy(true);
    setAppMessage("");
    const { error } = await supabase
      .from("debt_contacts")
      .update({
        name: editContactName.trim(),
        side: editContactSide,
      })
      .eq("id", selected.id);
    setBusy(false);
    if (error) {
      setAppMessage(error.message);
    } else {
      setSelected({ ...selected, name: editContactName.trim(), side: editContactSide });
      setEditContactModal(false);
      loadContacts();
    }
  }

  async function deleteContact() {
    if (!selected || busy) return;
    setBusy(true);
    setAppMessage("");
    
    // First explicitly delete all related transactions to bypass foreign key restriction issues (in case they don't have cascade setup)
    const { error: txError } = await supabase
      .from("debt_transactions")
      .delete()
      .eq("contact_id", selected.id);
      
    if (txError) {
      setBusy(false);
      setAppMessage("Lỗi xóa giao dịch liên quan: " + txError.message);
      return;
    }
    
    const { error } = await supabase
      .from("debt_contacts")
      .delete()
      .eq("id", selected.id);
    setBusy(false);
    if (error) {
      setAppMessage("Lỗi xóa người nợ: " + error.message);
    } else {
      setSelected(null);
      setEditContactModal(false);
      setDeleteContactConfirm(false);
      loadContacts();
    }
  }

  // Update & Delete Transaction logic
  async function updateTransaction(event: FormEvent) {
    event.preventDefault();
    if (!selected || !editingTx || !editTxAmount || busy) return;
    setBusy(true);
    setAppMessage("");
    
    const cleanAmount = Number(editTxAmount.replace(/\D/g, ""));
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setAppMessage("Số tiền không hợp lệ.");
      setBusy(false);
      return;
    }
    
    const { error } = await supabase
      .from("debt_transactions")
      .update({
        type: editTxType,
        amount: cleanAmount,
        happened_at: editTxDate,
        note: editTxNote.trim() || null,
      })
      .eq("id", editingTx.id);
    setBusy(false);
    if (error) {
      setAppMessage("Lỗi cập nhật giao dịch: " + error.message);
    } else {
      setEditTxModal(false);
      setEditingTx(null);
      loadTransactions(selected.id);
      loadContacts();
    }
  }

  async function deleteTransaction(txId: string) {
    if (!selected || busy) return;
    setBusy(true);
    setAppMessage("");
    const { error } = await supabase
      .from("debt_transactions")
      .delete()
      .eq("id", txId);
    setBusy(false);
    if (error) {
      setAppMessage("Lỗi xóa giao dịch: " + error.message);
    } else {
      setDeleteTxConfirmId(null);
      loadTransactions(selected.id);
      loadContacts();
    }
  }

  function startEditContact() {
    if (!selected) return;
    setAppMessage(""); // Clear any stale error messages
    setEditContactName(selected.name);
    setEditContactSide(selected.side);
    setDeleteContactConfirm(false);
    setEditContactModal(true);
  }

  function startEditTransaction(tx: DebtTransaction) {
    setAppMessage(""); // Clear any stale error messages
    setEditingTx(tx);
    setEditTxType(tx.type);
    setEditTxAmount(new Intl.NumberFormat("vi-VN").format(tx.amount));
    setEditTxDate(tx.happened_at);
    setEditTxNote(tx.note || "");
    setEditTxModal(true);
  }

  const visibleContacts = contacts.filter((item) => item.side === tab);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const date = new Date(item.happened_at);
      const matchesQuery =
        !query.trim() ||
        item.note?.toLowerCase().includes(query.toLowerCase()) ||
        String(item.amount).includes(query.trim());
      const matchesDay = !day || date.getDate() === Number(day);
      const matchesMonth = !month || date.getMonth() + 1 === Number(month);
      const matchesYear = !year || date.getFullYear() === Number(year);
      return matchesQuery && matchesDay && matchesMonth && matchesYear;
    });
  }, [transactions, query, day, month, year]);

  const contactBalances = useMemo(() => {
    const map = new Map<string, number>();
    allTransactions.forEach((item) => {
      const currentVal = map.get(item.contact_id) ?? 0;
      const change = item.type === "DEBT" ? Number(item.amount) : -Number(item.amount);
      map.set(item.contact_id, currentVal + change);
    });
    return map;
  }, [allTransactions]);

  const stats = useMemo(() => {
    let iOwe = 0;
    let theyOwe = 0;
    contacts.forEach((c) => {
      const bal = contactBalances.get(c.id) ?? 0;
      const netWeOwe = c.side === "I_OWE" ? bal : -bal;
      if (netWeOwe > 0) {
        iOwe += netWeOwe;
      } else {
        theyOwe += Math.abs(netWeOwe);
      }
    });
    const net = theyOwe - iOwe;
    return { iOwe, theyOwe, net };
  }, [contacts, contactBalances]);

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f3ec] text-[#24322f] font-bold">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#315b52] border-t-transparent" />
          <p className="text-sm font-semibold tracking-wide text-[#55615d]">Đang tải dữ liệu...</p>
        </div>
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f3ec] px-5 text-[#24322f]">
        <section className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl border border-[#ded5c6]">
          <h1 className="text-2xl font-black">Cần cấu hình Supabase</h1>
          <p className="mt-3 text-sm leading-6 text-[#66736f]">
            Tạo file <b>.env.local</b> từ <b>.env.example</b>, điền URL và anon key của Supabase, sau đó chạy lại ứng dụng.
          </p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#f7f3ec] px-5 py-8 text-[#24322f] flex items-center justify-center">
        {/* Glow Effects */}
        <div className="absolute -left-[10%] -top-[10%] h-[350px] w-[350px] rounded-full bg-[#315b52]/10 blur-[100px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[350px] w-[350px] rounded-full bg-[#d6663f]/10 blur-[100px]" />

        <section className="relative z-10 mx-auto flex w-full max-w-md flex-col justify-center">
          <div className="mb-8 text-center sm:text-left">
            <div className="mx-auto sm:mx-0 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#315b52] text-white shadow-lg shadow-[#315b52]/25">
              <WalletCards size={32} />
            </div>
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-[#24322f] to-[#455c57] bg-clip-text text-transparent">Sổ nợ cá nhân</h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-[#66736f]">
              Quản lý thông minh ai đang nợ bạn, bạn đang nợ ai, và tra cứu lịch sử trả nợ theo ngày.
            </p>
          </div>

          <form onSubmit={submitAuth} className="relative overflow-hidden rounded-[28px] border border-white/50 bg-white/85 p-6 shadow-[0_24px_50px_rgba(49,91,82,0.12)] backdrop-blur-md">
            {busy && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm transition-all duration-300">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#315b52] border-t-transparent" />
                <p className="mt-3 text-sm font-bold text-[#315b52] tracking-wide animate-pulse">Đang xử lý...</p>
              </div>
            )}

            <div className="mb-6 grid grid-cols-2 rounded-2xl bg-[#efe8dc] p-1.5 border border-[#ded5c6]/30">
              <button 
                type="button" 
                onClick={() => setMode("login")} 
                className={`h-11 rounded-xl text-sm font-black transition-all ${mode === "login" ? "bg-white text-[#24322f] shadow-sm" : "text-[#7d776d] hover:text-[#24322f]"}`}
              >
                Đăng nhập
              </button>
              <button 
                type="button" 
                onClick={() => setMode("register")} 
                className={`h-11 rounded-xl text-sm font-black transition-all ${mode !== "login" ? "bg-white text-[#24322f] shadow-sm" : "text-[#7d776d] hover:text-[#24322f]"}`}
              >
                Đăng ký
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#55615d]">Địa chỉ Gmail</span>
              <span className="flex h-13 items-center gap-3 rounded-2xl border border-[#ded5c6] bg-white px-4 transition-all focus-within:border-[#315b52] focus-within:ring-2 focus-within:ring-[#315b52]/10">
                <Mail size={18} className="text-[#7d776d]" />
                <input 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  type="email" 
                  required 
                  placeholder="name@gmail.com" 
                  className="w-full bg-transparent text-base outline-none text-[#24322f] placeholder-[#a69d90]" 
                />
              </span>
            </label>

            {mode !== "otp" ? (
              <label className="mb-6 block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#55615d]">Mật khẩu</span>
                <input 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  type="password" 
                  required 
                  minLength={6} 
                  placeholder="Tối thiểu 6 ký tự" 
                  className="h-13 w-full rounded-2xl border border-[#ded5c6] bg-white px-4 text-base outline-none transition-all focus:border-[#315b52] focus:ring-2 focus:ring-[#315b52]/10 text-[#24322f] placeholder-[#a69d90]" 
                />
              </label>
            ) : (
              <div className="mb-6 block">
                <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-[#55615d]">Mã OTP trong Gmail</span>
                <div className="grid grid-cols-6 gap-2">
                  {otpArray.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(e.target.value, index)}
                      onKeyDown={(e) => handleOtpKeyDown(e, index)}
                      onPaste={handleOtpPaste}
                      className="h-12 w-full rounded-xl border border-[#ded5c6] bg-white text-center text-xl font-black text-[#24322f] outline-none transition-all focus:border-[#315b52] focus:ring-2 focus:ring-[#315b52]/10 animate-fade-in"
                    />
                  ))}
                </div>
              </div>
            )}

            {authMessage && (
              <div className="mb-5 flex gap-2 rounded-2xl bg-[#fff6df] px-4 py-3 text-xs leading-relaxed text-[#7b5a13] border border-[#f1c9a7]/30">
                <AlertTriangle size={16} className="shrink-0 text-[#7b5a13]" />
                <p>{authMessage}</p>
              </div>
            )}

            <button 
              disabled={busy} 
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#315b52] text-base font-black text-white disabled:opacity-60 hover:opacity-95 shadow-md shadow-[#315b52]/20 active:scale-[0.98] transition-all"
            >
              {busy ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : mode === "otp" ? (
                <ShieldCheck size={18} />
              ) : (
                <Check size={18} />
              )}
              {busy ? "Đang xử lý..." : mode === "login" ? "Vào ứng dụng" : mode === "register" ? "Tạo tài khoản" : "Xác thực OTP"}
            </button>

            {mode === "otp" && (
              <button 
                type="button" 
                onClick={resendOtp} 
                disabled={busy} 
                className="mt-3 h-11 w-full rounded-2xl border border-[#ded5c6] bg-white text-sm font-bold text-[#315b52] disabled:opacity-60 hover:bg-gray-50 transition-colors"
              >
                Gửi lại mã OTP
              </button>
            )}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec] pb-28 text-[#24322f]">
      <header className="sticky top-0 z-20 border-b border-[#e4d9c9] bg-[#f7f3ec]/90 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b8175]">SỔ GHI NỢ CÁ NHÂN</p>
            <h1 className="text-2xl font-black text-[#24322f] tracking-tight">Ledger</h1>
          </div>
          <button 
            onClick={() => supabase.auth.signOut()} 
            className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ded5c6] bg-white shadow-sm hover:bg-[#efe8dc]/50 transition-colors text-[#55615d]" 
            title="Đăng xuất"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 pt-4">
        {appMessage && (
          <div className="mb-4 flex gap-2.5 rounded-2xl border border-[#f1c9a7]/40 bg-[#fff6df] px-4 py-3 text-sm text-[#7b4d13]">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-[#7b4d13]" />
            <p>{appMessage}</p>
          </div>
        )}

        {!selected ? (
          <>
            {/* Stats Dashboard Card */}
            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#203c36] to-[#315b52] p-6 text-white shadow-[0_20px_45px_rgba(49,91,82,0.22)] mb-5">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5 blur-xl" />
              <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
              
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-white/70">Số dư nợ ròng</span>
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur-md ${stats.net >= 0 ? "bg-[#d9ece1]/20 text-[#6fe0a3] border border-[#6fe0a3]/20" : "bg-[#fbeae5]/20 text-[#fca5a5] border border-[#fca5a5]/20"}`}>
                  {stats.net >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {stats.net >= 0 ? "Thặng dư" : "Thâm hụt"}
                </span>
              </div>
              
              <h2 className="mt-2 text-3.5xl font-black tracking-tight">{currency(stats.net)}</h2>
              
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                <div>
                  <p className="flex items-center gap-1.5 text-xs text-white/60">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#fca5a5]" /> Tôi nợ người ta
                  </p>
                  <p className="mt-1 text-lg font-black text-[#fca5a5]">{currency(stats.iOwe)}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs text-white/60">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#6fe0a3]" /> Người ta nợ tôi
                  </p>
                  <p className="mt-1 text-lg font-black text-[#6fe0a3]">{currency(stats.theyOwe)}</p>
                </div>
              </div>
              
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-[#d6663f] to-[#51bc87] transition-all duration-700"
                  style={{ width: `${stats.theyOwe + stats.iOwe > 0 ? (stats.theyOwe / (stats.theyOwe + stats.iOwe)) * 100 : 50}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 rounded-2xl bg-[#e9dfd0] p-1 border border-[#ded5c6]/40">
              <button 
                onClick={() => setTab("I_OWE")} 
                className={`h-12 rounded-xl text-sm font-black transition-all ${tab === "I_OWE" ? "bg-white text-[#24322f] shadow-sm" : "text-[#746d63] hover:text-[#24322f]"}`}
              >
                Tôi nợ người ta
              </button>
              <button 
                onClick={() => setTab("THEY_OWE")} 
                className={`h-12 rounded-xl text-sm font-black transition-all ${tab === "THEY_OWE" ? "bg-white text-[#24322f] shadow-sm" : "text-[#746d63] hover:text-[#24322f]"}`}
              >
                Người ta nợ tôi
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {visibleContacts.length === 0 && (
                <div className="rounded-[28px] border-2 border-dashed border-[#cfc4b4] bg-white/70 p-8 text-center shadow-inner">
                  <UserRound className="mx-auto mb-3 text-[#8b8175]" size={36} />
                  <p className="font-black text-lg">Chưa có người nào</p>
                  <p className="mt-1 text-sm text-[#746d63] max-w-[240px] mx-auto leading-relaxed">
                    Bấm dấu cộng nổi phía dưới để tạo hồ sơ người nợ đầu tiên.
                  </p>
                </div>
              )}

              {visibleContacts.map((item) => {
                const bal = contactBalances.get(item.id) ?? 0;
                const netWeOwe = item.side === "I_OWE" ? bal : -bal;
                
                const avatarGradient = netWeOwe > 0 
                  ? "bg-gradient-to-br from-[#fdf2ee] to-[#fbe2d7] text-[#c94e2a]"
                  : netWeOwe < 0 
                    ? "bg-gradient-to-br from-[#edf7f3] to-[#d6edd5] text-[#2c6e49]"
                    : "bg-gradient-to-br from-[#f1eede] to-[#e4decb] text-[#554d3e]";

                return (
                  <button 
                    key={item.id} 
                    onClick={() => setSelected(item)} 
                    className="group relative flex w-full items-center justify-between overflow-hidden rounded-[24px] border border-[#e5dacb] bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#315b52]/30 hover:shadow-md"
                  >
                    <div className="absolute right-0 top-0 h-full w-1.5 bg-transparent transition-all duration-300 group-hover:bg-[#315b52]" />
                    
                    <span className="flex items-center gap-3.5">
                      <span className={`grid h-13 w-13 place-items-center rounded-2xl ${avatarGradient} font-black text-lg transition-transform duration-300 group-hover:scale-105 shadow-sm`}>
                        {item.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        <span className="block text-base font-black text-[#24322f]">{item.name}</span>
                        <span className="mt-0.5 block text-xs font-semibold text-[#8b8175]">
                          {netWeOwe > 0 ? "Bạn nợ người ta" : netWeOwe < 0 ? "Người ta nợ bạn" : "Đã thanh toán hết"}
                        </span>
                      </span>
                    </span>
                    
                    <div className="text-right">
                      <span className={`block text-base font-black transition-colors duration-300 ${netWeOwe > 0 ? "text-[#c94e2a]" : netWeOwe < 0 ? "text-[#2c6e49]" : "text-[#746d63]"}`}>
                        {currency(Math.abs(bal))}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-bold text-[#8b8175] opacity-0 group-hover:opacity-100 transition-opacity">
                        Xem chi tiết →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <button 
                onClick={() => setSelected(null)} 
                className="flex items-center gap-2 text-sm font-bold text-[#55615d] hover:text-[#315b52] transition-colors"
              >
                <ArrowLeft size={18} /> Quay lại danh sách
              </button>
              
              <button 
                onClick={startEditContact} 
                className="flex items-center gap-1.5 rounded-xl bg-[#e9dfd0] hover:bg-[#ded5c6] px-3.5 py-1.5 text-xs font-black text-[#315b52] transition-all border border-[#ded5c6]/40 active:scale-95"
              >
                <Edit2 size={13} /> Sửa / Xóa người nợ
              </button>
            </div>

            {(() => {
              const bal = balanceOf(transactions);
              const netWeOwe = selected.side === "I_OWE" ? bal : -bal;
              
              const cardGradient = netWeOwe > 0 
                ? "from-[#c94e2a] to-[#d6663f] shadow-[#d6663f]/25" 
                : netWeOwe < 0 
                  ? "from-[#203c36] to-[#315b52] shadow-[#315b52]/25" 
                  : "from-[#4c5c58] to-[#60736e] shadow-slate-400/25";

              return (
                <div className={`relative overflow-hidden rounded-[28px] bg-gradient-to-br ${cardGradient} p-6 text-white shadow-[0_20px_50px]`}>
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5 blur-xl" />
                  <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] opacity-80">
                        {selected.side === "I_OWE" ? "Tôi đang nợ" : "Người này đang nợ tôi"}
                      </p>
                      <h2 className="mt-1.5 text-3xl font-black tracking-tight">{selected.name}</h2>
                    </div>
                    
                    <button 
                      onClick={startEditContact} 
                      className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all shadow-sm border border-white/10 active:scale-95" 
                      title="Chỉnh sửa người nợ"
                    >
                      <Settings size={18} />
                    </button>
                  </div>
                  
                  <div className="mt-8 flex items-baseline justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-60">Số dư hiện tại</p>
                      <p className="mt-1 text-4xl font-black tracking-tight">{currency(Math.abs(bal))}</p>
                    </div>
                    
                    <span className="rounded-full bg-white/10 px-3.5 py-1 text-xs font-black border border-white/10 backdrop-blur-md">
                      {netWeOwe > 0 ? "Tôi phải trả" : netWeOwe < 0 ? "Tôi cần thu" : "Đã tất toán"}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="mt-5 rounded-[24px] border border-[#e2d7c8] bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-12 items-center gap-3 rounded-2xl bg-[#f3eee6] px-4 border border-transparent focus-within:border-[#315b52]/30 focus-within:bg-white transition-all duration-300">
                <Search size={17} className="text-[#7d776d]" />
                <input 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)} 
                  placeholder="Tìm số tiền hoặc ghi chú..." 
                  className="w-full bg-transparent text-sm outline-none text-[#24322f] placeholder-[#8b8175]" 
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input 
                  value={day} 
                  onChange={(e) => setDay(e.target.value)} 
                  inputMode="numeric" 
                  placeholder="Ngày" 
                  className="h-11 rounded-2xl border border-[#e2d7c8] bg-white px-3 text-sm outline-none focus:border-[#315b52] transition-colors text-center" 
                />
                <input 
                  value={month} 
                  onChange={(e) => setMonth(e.target.value)} 
                  inputMode="numeric" 
                  placeholder="Tháng" 
                  className="h-11 rounded-2xl border border-[#e2d7c8] bg-white px-3 text-sm outline-none focus:border-[#315b52] transition-colors text-center" 
                />
                <input 
                  value={year} 
                  onChange={(e) => setYear(e.target.value)} 
                  inputMode="numeric" 
                  placeholder="Năm" 
                  className="h-11 rounded-2xl border border-[#e2d7c8] bg-white px-3 text-sm outline-none focus:border-[#315b52] transition-colors text-center" 
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {filteredTransactions.map((item) => (
                <article 
                  key={item.id} 
                  className="relative overflow-hidden rounded-[22px] border border-[#e5dacb] bg-white p-4 transition-all duration-300 hover:border-[#315b52]/20 hover:shadow-sm"
                >
                  {/* Decorative tag color bar */}
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${item.type === "DEBT" ? "bg-[#c94e2a]" : "bg-[#2c6e49]"}`} />
                  
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold text-[#8b8175]">
                        <CalendarDays size={13} className="text-[#8b8175]" /> {dateLabel(item.happened_at)}
                      </p>
                      <h3 className="mt-2 flex items-center gap-2 text-base font-black text-[#24322f]">
                        <span className={`flex h-6.5 w-6.5 items-center justify-center rounded-lg ${item.type === "DEBT" ? "bg-red-50 text-[#c94e2a]" : "bg-emerald-50 text-[#2c6e49]"}`}>
                          {item.type === "DEBT" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                        </span>
                        {item.type === "DEBT" ? "Nợ thêm" : "Trả nợ"}
                      </h3>
                      {item.note && <p className="mt-1 text-sm text-[#746d63] italic">“{item.note}”</p>}
                    </div>
                    <p className={`text-base font-black ${item.type === "DEBT" ? "text-[#c94e2a]" : "text-[#2c6e49]"}`}>
                      {item.type === "DEBT" ? "+" : "-"}{currency(item.amount)}
                    </p>
                  </div>

                  {deleteTxConfirmId === item.id ? (
                    <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-red-50 p-3 border border-red-100/50">
                      <p className="text-xs font-bold text-red-700">Xác nhận xóa giao dịch này?</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setDeleteTxConfirmId(null)} 
                          className="px-3 py-1.5 rounded-xl bg-white border border-[#ded5c6] text-xs font-bold text-[#7d776d] flex-1 hover:bg-gray-50 transition-colors"
                        >
                          Hủy
                        </button>
                        <button 
                          onClick={() => deleteTransaction(item.id)} 
                          disabled={busy}
                          className="px-3 py-1.5 rounded-xl bg-red-600 text-xs font-black text-white flex-1 hover:bg-red-700 transition-colors disabled:opacity-60"
                        >
                          Xác nhận xóa
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-2 border-t border-[#f5eedf] pt-3 justify-end">
                      <button 
                        onClick={() => startEditTransaction(item)} 
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#f3eee6] hover:bg-[#eae3d5] text-xs font-black text-[#55615d] transition-all"
                      >
                        <Edit2 size={12} /> Sửa
                      </button>
                      <button 
                        onClick={() => setDeleteTxConfirmId(item.id)} 
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100/60 text-xs font-black text-red-600 transition-all"
                      >
                        <Trash2 size={12} /> Xóa
                      </button>
                    </div>
                  )}
                </article>
              ))}
              
              {filteredTransactions.length === 0 && (
                <div className="rounded-[22px] bg-white p-6 text-center text-sm font-semibold text-[#746d63] border border-[#e5dacb]">
                  Không tìm thấy giao dịch nào phù hợp.
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <button 
        onClick={() => { setAppMessage(""); if (selected) setTxModal(true); else setContactModal(true); }} 
        className="fixed bottom-6 left-1/2 z-30 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-3xl bg-[#d6663f] text-white shadow-[0_18px_40px_rgba(214,102,63,0.4)] active:scale-95 transition-all" 
        title="Thêm mới"
      >
        <Plus size={32} />
      </button>

      {/* Modal Add Contact */}
      {contactModal && (
        <Modal title="Thêm người mới" onClose={() => setContactModal(false)} errorMessage={appMessage}>
          <form onSubmit={addContact} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#24322f]">Tên người nợ</span>
              <input 
                value={contactName} 
                onChange={(e) => setContactName(e.target.value)} 
                required 
                placeholder="Ví dụ: Anh Tuấn, Chị Hoa..." 
                className="h-13 w-full rounded-2xl border border-[#ded5c6] bg-white px-4 text-base outline-none focus:border-[#315b52] focus:ring-2 focus:ring-[#315b52]/10 transition-all text-[#24322f]" 
              />
            </label>
            <button 
              disabled={busy} 
              type="submit"
              className="h-13 w-full rounded-2xl bg-[#315b52] font-black text-white shadow-md shadow-[#315b52]/20 hover:opacity-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang tạo...
                </>
              ) : (
                "Tạo hồ sơ"
              )}
            </button>
          </form>
        </Modal>
      )}

      {/* Modal Edit Contact */}
      {editContactModal && (
        <Modal title="Chỉnh sửa người nợ" onClose={() => setEditContactModal(false)} errorMessage={appMessage}>
          {!deleteContactConfirm ? (
            <form onSubmit={updateContact} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#24322f]">Tên người nợ</span>
                <input 
                  value={editContactName} 
                  onChange={(e) => setEditContactName(e.target.value)} 
                  required 
                  placeholder="Tên người nợ" 
                  className="h-13 w-full rounded-2xl border border-[#ded5c6] bg-white px-4 text-base outline-none focus:border-[#315b52] focus:ring-2 focus:ring-[#315b52]/10 transition-all text-[#24322f]" 
                />
              </label>
              
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#24322f]">Phân loại ban đầu</span>
                <div className="grid grid-cols-2 rounded-2xl bg-[#efe8dc] p-1 border border-[#ded5c6]/30">
                  <button 
                    type="button" 
                    onClick={() => setEditContactSide("I_OWE")} 
                    className={`h-11 rounded-xl text-sm font-black transition-all ${editContactSide === "I_OWE" ? "bg-white text-[#24322f] shadow-sm" : "text-[#7d776d] hover:text-[#24322f]"}`}
                  >
                    Tôi nợ người ta
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditContactSide("THEY_OWE")} 
                    className={`h-11 rounded-xl text-sm font-black transition-all ${editContactSide === "THEY_OWE" ? "bg-white text-[#24322f] shadow-sm" : "text-[#7d776d] hover:text-[#24322f]"}`}
                  >
                    Người ta nợ tôi
                  </button>
                </div>
              </label>

              <div className="flex flex-col gap-3 pt-2">
                <button 
                  disabled={busy} 
                  type="submit" 
                  className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#315b52] font-black text-white shadow-md shadow-[#315b52]/20 hover:opacity-90 disabled:opacity-60 transition-all"
                >
                  {busy ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Check size={18} /> Lưu thay đổi
                    </>
                  )}
                </button>
                
                <button 
                  type="button" 
                  onClick={() => setDeleteContactConfirm(true)}
                  className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 font-bold text-red-600 hover:bg-red-100/60 transition-colors"
                >
                  <Trash2 size={18} /> Xóa người nợ này
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5 py-2 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 animate-pulse">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#24322f]">Xác nhận xóa vĩnh viễn?</h3>
                <p className="mt-2 text-sm text-[#746d63] leading-relaxed">
                  Bạn đang chuẩn bị xóa người nợ <b>{selected?.name}</b>. Thao tác này sẽ <b>xóa sạch tất cả các giao dịch liên quan</b> trong quá khứ và không thể phục hồi.
                </p>
              </div>
              
              <div className="flex gap-3 pt-3">
                <button 
                  type="button" 
                  onClick={() => setDeleteContactConfirm(false)} 
                  className="h-13 flex-1 rounded-2xl border border-[#ded5c6] font-bold text-[#7d776d] hover:bg-gray-50 transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="button" 
                  onClick={deleteContact} 
                  disabled={busy} 
                  className="h-13 flex-1 rounded-2xl bg-red-600 font-black text-white hover:bg-red-700 shadow-md shadow-red-600/20 disabled:opacity-60 transition-all"
                >
                  Đồng ý xóa
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal Add Transaction */}
      {txModal && (
        <Modal title="Thêm giao dịch mới" onClose={() => setTxModal(false)} errorMessage={appMessage}>
          <form onSubmit={addTransaction} className="space-y-4">
            <div className="grid grid-cols-2 rounded-2xl bg-[#efe8dc] p-1 border border-[#ded5c6]/30">
              <button 
                type="button" 
                onClick={() => setTxType("DEBT")} 
                className={`h-11 rounded-xl text-sm font-black transition-all ${txType === "DEBT" ? "bg-white text-[#24322f] shadow-sm" : "text-[#7d776d] hover:text-[#24322f]"}`}
              >
                Nợ thêm
              </button>
              <button 
                type="button" 
                onClick={() => setTxType("PAYMENT")} 
                className={`h-11 rounded-xl text-sm font-black transition-all ${txType === "PAYMENT" ? "bg-white text-[#24322f] shadow-sm" : "text-[#7d776d] hover:text-[#24322f]"}`}
              >
                Trả nợ
              </button>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#55615d]">Số tiền (VND)</span>
              <input 
                value={txAmount} 
                onChange={(e) => handleAmountChange(e.target.value, setTxAmount)} 
                required 
                type="text" 
                inputMode="numeric" 
                placeholder="Ví dụ: 100.000" 
                className="h-13 w-full rounded-2xl border border-[#ded5c6] bg-white px-4 text-base outline-none focus:border-[#315b52] focus:ring-2 focus:ring-[#315b52]/10 transition-all text-[#24322f] font-bold" 
              />
              
              {/* Dynamic banking style quick suggestions */}
              {(() => {
                const suggestions = getAmountSuggestions(txAmount);
                if (suggestions.length === 0) return null;
                return (
                  <div className="mt-2.5 flex flex-wrap gap-2 animate-in fade-in duration-200">
                    <span className="w-full text-[10px] font-bold text-[#8b8175] uppercase tracking-wider">Gợi ý nhanh số tiền:</span>
                    {suggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setTxAmount(sug)}
                        className="rounded-xl bg-[#315b52]/5 hover:bg-[#315b52]/10 border border-[#315b52]/10 px-3 py-1.5 text-xs font-bold text-[#315b52] transition-colors active:scale-95"
                      >
                        {sug} đ
                      </button>
                    ))}
                  </div>
                );
              })()}
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#55615d]">Ngày phát sinh</span>
              <input 
                value={txDate} 
                onChange={(e) => setTxDate(e.target.value)} 
                required 
                type="date" 
                className="h-13 w-full rounded-2xl border border-[#ded5c6] bg-white px-4 text-base outline-none focus:border-[#315b52] focus:ring-2 focus:ring-[#315b52]/10 transition-all text-[#24322f]" 
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#55615d]">Ghi chú chi tiết</span>
              <input 
                value={txNote} 
                onChange={(e) => setTxNote(e.target.value)} 
                placeholder="Ví dụ: Mua hộ bánh mỳ, trả tiền xe..." 
                className="h-13 w-full rounded-2xl border border-[#ded5c6] bg-white px-4 text-base outline-none focus:border-[#315b52] focus:ring-2 focus:ring-[#315b52]/10 transition-all text-[#24322f]" 
              />
            </label>
            <button 
              disabled={busy} 
              type="submit"
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#315b52] font-black text-white shadow-md shadow-[#315b52]/20 hover:opacity-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <CircleDollarSign size={18} /> Lưu giao dịch
                </>
              )}
            </button>
          </form>
        </Modal>
      )}

      {/* Modal Edit Transaction */}
      {editTxModal && (
        <Modal 
          title="Chỉnh sửa giao dịch" 
          onClose={() => { setEditTxModal(false); setEditingTx(null); }}
          errorMessage={appMessage}
        >
          <form onSubmit={updateTransaction} className="space-y-4">
            <div className="grid grid-cols-2 rounded-2xl bg-[#efe8dc] p-1 border border-[#ded5c6]/30">
              <button 
                type="button" 
                onClick={() => setEditTxType("DEBT")} 
                className={`h-11 rounded-xl text-sm font-black transition-all ${editTxType === "DEBT" ? "bg-white text-[#24322f] shadow-sm" : "text-[#7d776d] hover:text-[#24322f]"}`}
              >
                Nợ thêm
              </button>
              <button 
                type="button" 
                onClick={() => setEditTxType("PAYMENT")} 
                className={`h-11 rounded-xl text-sm font-black transition-all ${editTxType === "PAYMENT" ? "bg-white text-[#24322f] shadow-sm" : "text-[#7d776d] hover:text-[#24322f]"}`}
              >
                Trả nợ
              </button>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#55615d]">Số tiền (VND)</span>
              <input 
                value={editTxAmount} 
                onChange={(e) => handleAmountChange(e.target.value, setEditTxAmount)} 
                required 
                type="text" 
                inputMode="numeric" 
                placeholder="Ví dụ: 100.000" 
                className="h-13 w-full rounded-2xl border border-[#ded5c6] bg-white px-4 text-base outline-none focus:border-[#315b52] focus:ring-2 focus:ring-[#315b52]/10 transition-all text-[#24322f] font-bold" 
              />
              
              {/* Dynamic banking style quick suggestions */}
              {(() => {
                const suggestions = getAmountSuggestions(editTxAmount);
                if (suggestions.length === 0) return null;
                return (
                  <div className="mt-2.5 flex flex-wrap gap-2 animate-in fade-in duration-200">
                    <span className="w-full text-[10px] font-bold text-[#8b8175] uppercase tracking-wider">Gợi ý nhanh số tiền:</span>
                    {suggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setEditTxAmount(sug)}
                        className="rounded-xl bg-[#315b52]/5 hover:bg-[#315b52]/10 border border-[#315b52]/10 px-3 py-1.5 text-xs font-bold text-[#315b52] transition-colors active:scale-95"
                      >
                        {sug} đ
                      </button>
                    ))}
                  </div>
                );
              })()}
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#55615d]">Ngày phát sinh</span>
              <input 
                value={editTxDate} 
                onChange={(e) => setEditTxDate(e.target.value)} 
                required 
                type="date" 
                className="h-13 w-full rounded-2xl border border-[#ded5c6] bg-white px-4 text-base outline-none focus:border-[#315b52] focus:ring-2 focus:ring-[#315b52]/10 transition-all text-[#24322f]" 
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#55615d]">Ghi chú chi tiết</span>
              <input 
                value={editTxNote} 
                onChange={(e) => setEditTxNote(e.target.value)} 
                placeholder="Ví dụ: Vay tiền trưa, thanh toán..." 
                className="h-13 w-full rounded-2xl border border-[#ded5c6] bg-white px-4 text-base outline-none focus:border-[#315b52] focus:ring-2 focus:ring-[#315b52]/10 transition-all text-[#24322f]" 
              />
            </label>
            <button 
              disabled={busy} 
              type="submit"
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#315b52] font-black text-white shadow-md shadow-[#315b52]/20 hover:opacity-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <CircleDollarSign size={18} /> Lưu thay đổi
                </>
              )}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}

function Modal({ title, children, onClose, errorMessage }: { title: string; children: React.ReactNode; onClose: () => void; errorMessage?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40 px-4 pb-4 backdrop-blur-sm transition-all duration-300">
      <section className="mx-auto w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl border border-[#ded5c6]/30 animate-in slide-in-from-bottom duration-300">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-[#24322f] tracking-tight">{title}</h2>
          <button 
            onClick={onClose} 
            className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f3eee6] text-[#7d776d] hover:bg-[#eae3d5] active:scale-95 transition-all"
          >
            <X size={18} />
          </button>
        </div>
        {errorMessage && (
          <div className="mb-4 flex gap-2 rounded-2xl bg-red-50 border border-red-200/50 p-3.5 text-xs text-red-600 leading-relaxed font-semibold">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}
        {children}
      </section>
    </div>
  );
}
