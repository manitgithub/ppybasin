"use client";

import { useState } from "react";
import { Eye, Undo2 } from "lucide-react";
import type { AppUser, UserRole } from "@/lib/auth";
import { roleLabel } from "@/components/dashboard/utils";

async function switchRole(role: UserRole) {
  const response = await fetch("/api/auth/view-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "สลับมุมมองไม่สำเร็จ");
  // The page and every API read the role on the server, so reload to apply it everywhere.
  window.location.assign("/#home");
  window.location.reload();
}

/** Role picker for the staff sidebar. Hidden for accounts that only have one role. */
export function RoleSwitcher({ user }: { user: AppUser }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const roles = user.availableRoles ?? [user.role];
  const actual = user.actualRole ?? user.role;
  if (roles.length < 2) return <p className="mb-6 rounded-[7px] bg-[#0d3b63] px-3 py-2 text-xs font-extrabold text-white">{roleLabel(user.role)}</p>;
  return <div className="mb-6">
    <label className="block">
      <span className="sr-only">ดูระบบในมุมมอง</span>
      <span className="flex items-center gap-2 rounded-[7px] bg-[#0d3b63] px-2 py-1.5">
        <Eye size={16} className="shrink-0 text-[#8cc8ff]" aria-hidden />
        <select
          className="min-h-9 w-full cursor-pointer rounded-[5px] bg-transparent text-xs font-extrabold text-white outline-none [&>option]:text-slate-900"
          value={user.role}
          disabled={busy}
          onChange={(event) => {
            setBusy(true); setError("");
            switchRole(event.target.value as UserRole).catch((e) => { setError(e.message); setBusy(false); });
          }}
        >
          {roles.map((role) => <option key={role} value={role}>{role === actual ? `${roleLabel(role)} (สิทธิ์จริง)` : `ดูแบบ${role === "viewer" ? "ประชาชน" : roleLabel(role)}`}</option>)}
        </select>
      </span>
    </label>
    {user.role !== actual && <p className="mt-2 text-[11px] font-bold leading-snug text-[#ffd98a]">กำลังดูในมุมมอง{roleLabel(user.role)} · สิทธิ์ถูกจำกัดตามมุมมองนี้</p>}
    {error && <p className="mt-2 text-[11px] font-bold text-[#ffb4a8]" role="alert">{error}</p>}
  </div>;
}

/** Floating notice shown while previewing, with a one-tap way back to the real role. */
export function ViewAsBanner({ user, withSidebar = false }: { user: AppUser; withSidebar?: boolean }) {
  const [busy, setBusy] = useState(false);
  const actual = user.actualRole;
  if (!actual || actual === user.role) return null;
  return <div role="status" className={`fixed left-1/2 z-[1200] -translate-x-1/2 ${withSidebar ? "bottom-4 lg:left-[calc(50%+107px)]" : "bottom-[96px]"} flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-full bg-[#061b2e] py-1.5 pl-4 pr-1.5 text-xs font-bold text-white shadow-lg`}>
    <Eye size={15} className="shrink-0 text-[#8cc8ff]" aria-hidden />
    <span className="truncate">กำลังดูแบบ{user.role === "viewer" ? "ประชาชน" : roleLabel(user.role)}</span>
    <button type="button" disabled={busy} className="flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-[#0d3b63] disabled:opacity-60"
      onClick={() => { setBusy(true); switchRole(actual).catch(() => setBusy(false)); }}>
      <Undo2 size={14} aria-hidden />{busy ? "กำลังสลับ…" : `กลับเป็น${roleLabel(actual)}`}
    </button>
  </div>;
}
