"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import {
  BarChart3,
  CircleDollarSign,
  CreditCard,
  Eye,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminShellTab =
  | "metrics"
  | "finance"
  | "commerce"
  | "users"
  | "authors"
  | "reports"
  | "content"
  | "admins";

type TabItem = {
  id: AdminShellTab;
  label: string;
  visible: boolean;
};

const tabIcons = {
  metrics: BarChart3,
  finance: CircleDollarSign,
  commerce: CreditCard,
  users: Eye,
  authors: Shield,
  reports: Eye,
  content: Shield,
  admins: Shield,
} as const;

export default function AdminShell({
  activeTab,
  onTabChange,
  tabs,
  signingOut,
  onSignOut,
  children,
}: {
  activeTab: AdminShellTab;
  onTabChange: (tab: AdminShellTab) => void;
  tabs: TabItem[];
  signingOut: boolean;
  onSignOut: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0b0d12] text-zinc-950">
      <header className="w-full border-b border-white/10 bg-[linear-gradient(112deg,#16343c_0%,#0f182f_43%,#0c1425_68%,#080f22_100%)] text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-4 py-5 md:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[14px] border border-white/10 bg-white/5">
                <Image
                  src="/fanpush-logo.png"
                  alt="FanPush"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-[10px]"
                />
              </div>
              <div>
                <div className="text-[0.78rem] font-semibold uppercase tracking-[0.34em] text-zinc-300">
                  FanPush Admin
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Panel de control
                </h1>
                <p className="mt-2 max-w-[780px] text-sm leading-6 !text-white/80 md:text-base">
                  Administración central con foco en finanzas, moderación y operación.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="rounded-[16px] border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12 disabled:opacity-60"
            >
              {signingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-[22px] border border-white/8 bg-black/30 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex min-w-max gap-2">
              {tabs
                .filter((item) => item.visible)
                .map((item) => {
                  const Icon = tabIcons[item.id];
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-[14px] border px-4 py-3 text-sm font-semibold transition",
                        active
                          ? "border-white/10 bg-[#2a313c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                          : "border-transparent bg-transparent text-zinc-300 hover:border-white/8 hover:bg-white/6 hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 pb-10 pt-6 md:px-6">
        {children}
      </main>
    </div>
  );
}
