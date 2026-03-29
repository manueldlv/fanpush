"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  Bell,
  CreditCard,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Wallet,
  type LucideIcon,
  Search,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  hydrateNotificationsState,
  markNotificationsAsRead,
  type AppNotificationItem,
} from "@/lib/redux/slices/notificationsSlice";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { getSupabaseClient } from "@/lib/supabase";
import { formatARS } from "@/lib/utils";

type SearchResult = {
  id: string;
  name: string;
  fullName: string;
  detail: string;
  avatar: string | null;
};

function getNotificationMeta(type: string, text: string): {
  label: string;
  source: string;
  icon: LucideIcon;
  tone: string;
  iconTone: string;
} {
  if (type === "follow") {
    return {
      label: "Nuevo seguidor",
      source: "Usuario",
      icon: UserPlus,
      tone: "bg-sky-50 text-sky-700",
      iconTone: "bg-sky-100 text-sky-700",
    };
  }
  if (type === "tip") {
    return {
      label: "Propina",
      source: "Ingreso",
      icon: BadgeDollarSign,
      tone: "bg-emerald-50 text-emerald-700",
      iconTone: "bg-emerald-100 text-emerald-700",
    };
  }
  if (type === "purchase") {
    return {
      label: "Compra",
      source: "Venta",
      icon: CreditCard,
      tone: "bg-violet-50 text-violet-700",
      iconTone: "bg-violet-100 text-violet-700",
    };
  }
  if (type === "withdrawal_update") {
    return {
      label: "Retiro",
      source: "FanPush",
      icon: Wallet,
      tone: "bg-amber-50 text-amber-700",
      iconTone: "bg-amber-100 text-amber-700",
    };
  }
  if (type === "content_removed_update") {
    return {
      label: "Moderación",
      source: "Admin",
      icon: ShieldAlert,
      tone: "bg-rose-50 text-rose-700",
      iconTone: "bg-rose-100 text-rose-700",
    };
  }
  if (type === "author_application_update") {
    return {
      label: "Solicitud de autor",
      source: "FanPush",
      icon: Sparkles,
      tone: "bg-indigo-50 text-indigo-700",
      iconTone: "bg-indigo-100 text-indigo-700",
    };
  }
  return {
    label: "Notificación",
    source: text.startsWith("FanPush ") ? "FanPush" : "Usuario",
    icon: Bell,
    tone: "bg-zinc-100 text-zinc-700",
    iconTone: "bg-zinc-200 text-zinc-700",
  };
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profile = useAppSelector((state) => state.viewer.profile);
  const balance = useAppSelector((state) => state.viewer.commerce.balance);
  const canCreate = useAppSelector((state) => state.viewer.access.canCreate);
  const authorStatus = useAppSelector((state) => state.viewer.access.authorStatus);
  const viewerHydrated = useAppSelector((state) => state.viewer.hydrated);
  const notifications = useAppSelector((state) => state.notifications.items);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const showViewerSkeleton = !viewerHydrated;

  useEffect(() => {
    const load = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase
        .from("users")
        .select("id,username,avatar_url")
        .ilike("username", `%${query.trim()}%`)
        .limit(10);

      const resolveAvatar = async (value: string | null) => {
        if (!value) return null;
        if (value.startsWith("http")) return value;
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(value);
        return publicUrl.publicUrl;
      };

      const mapped = await Promise.all(
        (data ?? []).map(async (row) => ({
          id: row.id,
          name: row.username ?? "usuario",
          fullName: row.username ?? "",
          detail: "Sugerencia para ti",
          avatar: await resolveAvatar(row.avatar_url ?? null),
        })),
      );
      setResults(mapped);
    };

    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchOpen && searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
      if (
        notificationsOpen &&
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [searchOpen, notificationsOpen, profileOpen]);

  const handleSelect = (item: SearchResult) => {
    router.push(buildUserProfileHref(item.name));
    setSearchOpen(false);
    setQuery("");
  };

  const hasUnreadNotifications = notifications.some((item) => !item.isRead);
  const groupedNotifications = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const groups = {
      unread: [] as AppNotificationItem[],
      today: [] as AppNotificationItem[],
      yesterday: [] as AppNotificationItem[],
      older: [] as AppNotificationItem[],
    };

    for (const item of notifications) {
      const createdAt = new Date(item.createdAt);
      if (!item.isRead) {
        groups.unread.push(item);
        continue;
      }
      if (createdAt >= startOfToday) {
        groups.today.push(item);
      } else if (createdAt >= startOfYesterday) {
        groups.yesterday.push(item);
      } else {
        groups.older.push(item);
      }
    }

    return groups;
  }, [notifications]);

  if (
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/terminos") ||
    pathname?.startsWith("/privacidad") ||
    pathname?.startsWith("/ayuda") ||
    pathname?.startsWith("/faq")
  ) {
    return null;
  }

  return (
    <header className="fixed left-0 top-0 z-50 h-16 w-full border-b border-zinc-200 bg-white">
      <div className="h-full">
        <div className="flex h-full w-full items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-10">
            <Link href="/" className="text-xl font-semibold text-zinc-900">
              FanPush
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-semibold text-zinc-500 sm:flex">
              <Link href="/" className="text-zinc-900">
                Feed
              </Link>
              <Link href="/explorar" className="hover:text-zinc-900">
                Descubrir
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {showViewerSkeleton ? (
              <div className="hidden h-10 w-48 rounded-full bg-zinc-100 lg:block" />
            ) : !canCreate ? (
              authorStatus === "pending" ? (
                <div className="hidden rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 lg:inline-flex">
                  Solicitud en revisión
                </div>
              ) : (
                <Link
                  href="/autor/solicitud"
                  className="hidden rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white lg:inline-flex"
                >
                  Convertirme en autor
                </Link>
              )
            ) : null}
            <div className="relative" ref={searchRef}>
              <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2">
                <Search className="h-4 w-4 text-zinc-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Buscar"
                  className="w-28 bg-transparent text-sm text-zinc-800 outline-none sm:w-40 md:w-[240px]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              {searchOpen ? (
                <div className="absolute right-0 top-12 z-50 w-[360px] rounded-[10px] border border-zinc-200 bg-white p-4 shadow-xl">
                  {!query.trim() ? (
                    <div className="text-sm text-zinc-500">
                      No hay búsquedas recientes.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {results.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelect(item)}
                          className="flex w-full items-center gap-3 rounded-[5px] p-2 text-left transition hover:bg-zinc-100"
                        >
                          {item.avatar ? (
                            <img
                              src={item.avatar}
                              alt={item.name}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-zinc-100" />
                          )}
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">
                              {item.name}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {item.fullName} · {item.detail}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={async () => {
                  const nextOpen = !notificationsOpen;
                  setNotificationsOpen(nextOpen);

                  if (nextOpen) {
                    const unreadIds = notifications
                      .filter((item) => !item.isRead)
                      .map((item) => item.id);
                    if (unreadIds.length > 0) {
                      await dispatch(markNotificationsAsRead(unreadIds));
                      void dispatch(hydrateNotificationsState());
                    }
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100"
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4" />
                {hasUnreadNotifications ? (
                  <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
                ) : null}
              </button>

              {notificationsOpen ? (
                <div
                  className="absolute right-0 top-12 z-50 rounded-[12px] border border-zinc-200 bg-white p-4 shadow-xl"
                  style={{
                    width: "600px",
                    minWidth: "600px",
                    maxWidth: "calc(100vw - 1rem)",
                  }}
                >
                  <div className="border-b border-zinc-100 pb-2">
                    <div className="text-[24px] font-semibold tracking-tight text-zinc-950">
                      Notifications
                    </div>
                  </div>
                  <div className="max-h-[520px] space-y-4 overflow-y-auto pt-3 pr-2">
                    {notifications.length === 0 ? (
                      <div className="text-sm text-zinc-500">
                        No hay notificaciones.
                      </div>
                    ) : (
                      ([
                        {
                          key: "unread",
                          label: "New",
                          items: groupedNotifications.unread,
                        },
                        {
                          key: "today",
                          label: "Today",
                          items: groupedNotifications.today,
                        },
                        {
                          key: "yesterday",
                          label: "Yesterday",
                          items: groupedNotifications.yesterday,
                        },
                        {
                          key: "older",
                          label: "Earlier",
                          items: groupedNotifications.older,
                        },
                      ] as const).map((group) =>
                        group.items.length ? (
                          <div key={group.key}>
                            <div className="mb-2 text-sm font-semibold text-zinc-900">
                              {group.label}
                            </div>
                            <div className="space-y-0.5">
                              {group.items.map((item) => {
                                const meta = getNotificationMeta(item.type, item.text);
                                const MetaIcon = meta.icon;
                                return (
                                  <div
                                    key={item.id}
                                    className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-3 rounded-[12px] px-1 py-1.5"
                                  >
                                    <div className="pt-0.5">
                                      {item.avatar ? (
                                        <UserAvatar
                                          src={item.avatar}
                                          alt="avatar"
                                          sizeClassName="h-10 w-10"
                                          iconClassName="h-4 w-4"
                                        />
                                      ) : (
                                        <div
                                          className={`flex h-10 w-10 items-center justify-center rounded-full ${meta.iconTone}`}
                                        >
                                          <MetaIcon className="h-4.5 w-4.5" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 border-b border-zinc-100 pb-2.5 text-sm text-zinc-700">
                                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}
                                        >
                                          {meta.label}
                                        </span>
                                        <span className="text-[11px] text-zinc-400">
                                          {item.date}
                                        </span>
                                      </div>
                                      <div className="leading-[1.25] font-medium text-zinc-900">
                                        {item.text}
                                      </div>
                                      {item.action && !item.text.startsWith("FanPush ") ? (
                                        <div className="mt-1.5">
                                          <Link
                                            href={item.action.href}
                                            className="inline-flex rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white"
                                          >
                                            {item.action.label}
                                          </Link>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null,
                      )
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              {showViewerSkeleton ? (
                <div className="fanpush-skeleton h-5 w-16 rounded" />
              ) : (
                <Link
                  href="/ventas"
                  className="cursor-pointer text-sm font-semibold text-zinc-900"
                >
                  {formatARS(balance)}
                </Link>
              )}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="rounded-full"
                  aria-label="Abrir menu de perfil"
                >
                  {showViewerSkeleton ? (
                    <div className="fanpush-skeleton h-9 w-9 rounded-full" />
                  ) : (
                    <UserAvatar
                      src={profile.avatarUrl}
                      alt={profile.username ?? "Perfil"}
                      sizeClassName="h-9 w-9"
                      iconClassName="h-4 w-4"
                    />
                  )}
                </button>
                {profileOpen ? (
                  <div className="absolute right-0 top-12 z-50 w-48 rounded-[10px] border border-zinc-200 bg-white p-2 shadow-xl">
                    <Link
                      href="/perfil"
                      className="block rounded-[6px] px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setProfileOpen(false)}
                    >
                      Ver perfil
                    </Link>
                    <Link
                      href="/settings"
                      className="block rounded-[6px] px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setProfileOpen(false)}
                    >
                      Configuración
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        const supabase = getSupabaseClient();
                        if (supabase) {
                          await supabase.auth.signOut();
                        }
                        setProfileOpen(false);
                        router.replace("/auth");
                        window.location.assign("/auth");
                      }}
                      className="block w-full rounded-[6px] px-3 py-2 text-left text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                    >
                      Cerrar sesion
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
