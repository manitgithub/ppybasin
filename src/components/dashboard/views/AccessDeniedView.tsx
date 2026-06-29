"use client";

import type { ViewId } from "@/components/dashboard/types";

export default function AccessDeniedView({ viewId }: { viewId: ViewId }) {
  return (
    <section className="rounded-[8px] border border-amber-200 bg-amber-50 p-6 text-amber-800">
      <h2 className="text-lg font-extrabold">ไม่มีสิทธิ์เข้าเมนูนี้</h2>
      <p className="mt-1 text-sm font-semibold">เมนู `{viewId}` ต้องใช้สิทธิ์เพิ่มเติมจากผู้ดูแลระบบ</p>
    </section>
  );
}
