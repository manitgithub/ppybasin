"use client";

import { CircleUser } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AppUser, UserRole, UserStatus } from "@/lib/auth";
import { formatDate, roleLabel } from "@/components/dashboard/utils";

const permissionOptions = [
  { id: "dashboard:view", label: "ดู Dashboard" },
  { id: "alerts:manage", label: "จัดการแจ้งเตือน" },
  { id: "sensors:manage", label: "จัดการ Sensor" },
  { id: "users:manage", label: "จัดการสิทธิ์" },
];

export default function UserAccessManager({ currentUser }: { currentUser: AppUser }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "โหลดผู้ใช้งานไม่สำเร็จ");
      }

      setUsers(payload.users ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดผู้ใช้งานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const patchLocalUser = (id: string, patch: Partial<AppUser>) => {
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)));
  };

  const togglePermission = (user: AppUser, permission: string) => {
    const next = user.permissions.includes(permission)
      ? user.permissions.filter((item) => item !== permission)
      : [...user.permissions, permission];

    patchLocalUser(user.id, { permissions: next });
  };

  const saveUser = async (user: AppUser) => {
    setSavingId(user.id);
    setError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          role: user.role,
          status: user.status,
          permissions: user.permissions,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "บันทึกสิทธิ์ไม่สำเร็จ");
      }

      patchLocalUser(user.id, payload.user);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกสิทธิ์ไม่สำเร็จ");
    } finally {
      setSavingId(null);
    }
  };

  if (currentUser.role !== "admin") {
    return (
      <section className="rounded-[8px] border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <h2 className="text-lg font-extrabold">ต้องใช้สิทธิ์ผู้ดูแลระบบ</h2>
        <p className="mt-1 text-sm font-semibold">บัญชีของคุณยังไม่มีสิทธิ์จัดการผู้ใช้งาน</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-[8px] bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div>
          <p className="text-xs font-extrabold text-[#2c72d9]">ACCESS CONTROL</p>
          <h2 className="text-2xl font-extrabold text-[#20325c]">จัดการสิทธิ์ผู้ใช้งาน</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">กำหนดบทบาท สถานะ และ permission หลังเข้าสู่ระบบด้วย LINE</p>
        </div>
        <button
          className="h-10 rounded-[8px] bg-[#216ed7] px-4 text-sm font-extrabold text-white disabled:opacity-60"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void loadUsers();
          }}
        >
          รีเฟรช
        </button>
      </div>

      {error && <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <div className="grid gap-3">
        {users.map((user) => (
          <article key={user.id} className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_180px_160px_minmax(360px,1.2fr)_100px] xl:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
                  {user.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.pictureUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <CircleUser size={25} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#20325c]">{user.displayName}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{user.email ?? user.lineUserId}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">
                    ล่าสุด: {user.lastLoginAt ? formatDate(user.lastLoginAt) : "ยังไม่มีข้อมูล"}
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="text-[11px] font-extrabold text-slate-500">บทบาท</span>
                <select
                  className="mt-1 h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-400"
                  value={user.role}
                  onChange={(event) => patchLocalUser(user.id, { role: event.target.value as UserRole })}
                >
                  <option value="admin">{roleLabel("admin")}</option>
                  <option value="operator">{roleLabel("operator")}</option>
                  <option value="viewer">{roleLabel("viewer")}</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-extrabold text-slate-500">สถานะ</span>
                <select
                  className="mt-1 h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-400"
                  value={user.status}
                  onChange={(event) => patchLocalUser(user.id, { status: event.target.value as UserStatus })}
                >
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>

              <div>
                <p className="mb-2 text-[11px] font-extrabold text-slate-500">สิทธิ์การใช้งาน</p>
                <div className="flex flex-wrap gap-2">
                  {permissionOptions.map((permission) => (
                    <label key={permission.id} className="flex h-9 items-center gap-2 rounded-[8px] border border-slate-200 px-3 text-xs font-extrabold text-[#40577f]">
                      <input
                        type="checkbox"
                        checked={user.permissions.includes(permission.id)}
                        onChange={() => togglePermission(user, permission.id)}
                      />
                      {permission.label}
                    </label>
                  ))}
                </div>
              </div>

              <button
                className="h-10 rounded-[8px] bg-[#216ed7] px-4 text-sm font-extrabold text-white disabled:opacity-60"
                disabled={savingId === user.id}
                onClick={() => void saveUser(user)}
              >
                {savingId === user.id ? "บันทึก..." : "บันทึก"}
              </button>
            </div>
          </article>
        ))}

        {users.length === 0 && !loading && (
          <div className="rounded-[8px] border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
            ยังไม่มีผู้ใช้งานจาก LINE Login
          </div>
        )}
      </div>
    </section>
  );
}
