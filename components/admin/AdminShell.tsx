"use client";

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
    <div className="min-h-screen bg-white text-zinc-950">
      <header className="w-full border-b border-zinc-200 bg-white text-zinc-950 shadow-sm">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-4 py-5 md:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-500">FanPush admin</div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">
                Panel de control
              </h1>
              <p className="mt-2 max-w-[780px] text-sm leading-6 text-zinc-600 md:text-base">
                Administración central con foco en finanzas, moderación y operación.
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="rounded-[16px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
            >
              {signingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
          </div>

          <div className="rounded-[22px] border border-zinc-200 bg-white p-2 shadow-sm">
            <div className="flex flex-wrap gap-2">
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
                          ? "border-zinc-200 bg-zinc-950 text-white"
                          : "border-transparent bg-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950",
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
