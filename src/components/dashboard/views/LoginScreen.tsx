"use client";

import { CircleUser, KeyRound, Waves } from "lucide-react";
import { useEffect, useState } from "react";

export default function LoginScreen() {
  const [error] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const messages: Record<string, string> = {
      line_config: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ID หรือ LINE_CHANNEL_SECRET",
      invalid_state: "เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่",
      disabled: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
      line_failed: "เข้าสู่ระบบผ่าน LINE ไม่สำเร็จ กรุณาลองใหม่",
    };
    const loginError = new URLSearchParams(window.location.search).get("login_error");

    return loginError ? (messages[loginError] ?? "เข้าสู่ระบบไม่สำเร็จ") : null;
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("login_error")) {
      window.history.replaceState(null, "", "/");
    }
  }, []);

  return (
    <main className="grid min-h-screen bg-[#061b2e] text-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative flex min-h-[48vh] flex-col justify-between overflow-hidden p-6 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,142,232,0.34),transparent_28rem),linear-gradient(135deg,#09233a_0%,#061b2e_55%,#092844_100%)]" />
        <div className="relative z-10 flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full border-2 border-white bg-[#eef7ff] text-[#1267b9]">
            <Waves size={34} strokeWidth={2.7} />
          </span>
          <div>
            <p className="text-sm font-extrabold text-sky-200">SMART BASIN</p>
            <h1 className="max-w-2xl text-2xl font-extrabold leading-tight md:text-4xl">
              ระบบอัจฉริยะติดตาม เฝ้าระวัง และจัดการสิทธิ์ผู้ใช้งาน
            </h1>
          </div>
        </div>
        <div className="relative z-10 max-w-xl">
          <p className="text-sm font-bold text-sky-100">ลุ่มน้ำป่าพะยอม</p>
          <p className="mt-3 text-lg font-semibold leading-8 text-white/82">
            เข้าสู่ระบบด้วย LINE เพื่อเปิด dashboard สถานการณ์น้ำและควบคุมสิทธิ์ของเจ้าหน้าที่ตามบทบาท.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#eef3f8] p-6 text-slate-900">
        <div className="w-full max-w-[430px] rounded-[8px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold text-[#1f7a4d]">LINE LOGIN</p>
              <h2 className="mt-1 text-2xl font-extrabold text-[#20325c]">เข้าสู่ระบบ</h2>
            </div>
            <span className="grid size-11 place-items-center rounded-[8px] bg-[#06c755] text-white">
              <KeyRound size={22} />
            </span>
          </div>

          {error && (
            <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <a
            className="flex h-12 w-full items-center justify-center gap-3 rounded-[8px] bg-[#06c755] text-sm font-extrabold text-white shadow-lg shadow-green-200 transition hover:bg-[#05b84f]"
            href="/api/auth/line/start"
          >
            <CircleUser size={20} />
            เข้าสู่ระบบด้วย LINE
          </a>

          <div className="mt-5 rounded-[8px] bg-slate-50 p-4 text-xs font-semibold leading-6 text-slate-600">
            ผู้ใช้คนแรกที่เข้าสู่ระบบสำเร็จจะได้รับสิทธิ์ admin อัตโนมัติ จากนั้นสามารถจัดการสิทธิ์บัญชีอื่นได้ในเมนูจัดการสิทธิ์ผู้ใช้.
          </div>

          <div className="mt-4 flex justify-center gap-4 text-xs font-extrabold text-[#216ed7]">
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
            <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a>
          </div>
        </div>
      </section>
    </main>
  );
}
