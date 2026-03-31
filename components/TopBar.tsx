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
  X,
  type LucideIcon,
  Search,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import {
  useGetNotificationCenterQuery,
  useMarkNotificationsAsReadMutation,
} from "@/lib/redux/api/notificationsApi";
import { useSearchUsersQuery } from "@/lib/redux/api/searchApi";
import { useGetViewerQuery, useSignOutMutation } from "@/lib/redux/api/sessionApi";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { formatARS } from "@/lib/utils";

type SearchResult = {
  id: string;
  name: string;
  fullName: string;
  detail: string;
  avatar: string | null;
};

function getNotificationMeta(type: string): {
  section: string;
  icon: LucideIcon;
  iconTone: string;
} {
  if (type === "follow") {
    return {
      section: "Seguidores",
      icon: UserPlus,
      iconTone: "bg-sky-100 text-sky-700",
    };
  }
  if (type === "purchase") {
    return {
      section: "Ventas",
      icon: CreditCard,
      iconTone: "bg-violet-100 text-violet-700",
    };
  }
  if (type === "tip") {
    return {
      section: "Este mes",
      icon: BadgeDollarSign,
      iconTone: "bg-emerald-100 text-emerald-700",
    };
  }
  if (type === "withdrawal_update") {
    return {
      section: "Este mes",
      icon: Wallet,
      iconTone: "bg-amber-100 text-amber-700",
    };
  }
  if (type === "content_removed_update") {
    return {
      section: "Este mes",
      icon: ShieldAlert,
      iconTone: "bg-rose-100 text-rose-700",
    };
  }
  if (type === "author_application_update") {
    return {
      section: "Este mes",
      icon: Sparkles,
      iconTone: "bg-indigo-100 text-indigo-700",
    };
  }
  return {
    section: "Este mes",
    icon: Bell,
    iconTone: "bg-zinc-200 text-zinc-700",
  };
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const { data: viewer, isLoading: viewerLoading } = useGetViewerQuery();
  const { data: notificationCenter } = useGetNotificationCenterQuery();
  const [markNotificationsAsRead] = useMarkNotificationsAsReadMutation();
  const [signOut] = useSignOutMutation();
  const { data: searchResults = [] } = useSearchUsersQuery(debouncedQuery, {
    skip: !debouncedQuery,
  });
  const profile = viewer?.profile;
  const balance = viewer?.commerce.balance ?? 0;
  const canCreate = viewer?.access.canCreate ?? false;
  const authorStatus = viewer?.access.authorStatus ?? "idle";
  const notifications = notificationCenter?.activity ?? [];
  const showViewerSkeleton = viewerLoading && !viewer;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
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
    setDebouncedQuery("");
  };

  const hasUnreadNotifications = notifications.some((item) => !item.isRead);
  const notificationSections = useMemo(() => {
    const sectionOrder = ["Este mes", "Seguidores", "Ventas"];
    const grouped = new Map<
      string,
      Array<{ item: (typeof notifications)[number]; meta: ReturnType<typeof getNotificationMeta> }>
    >();

    for (const item of notifications) {
      const meta = getNotificationMeta(item.type);
      const current = grouped.get(meta.section) ?? [];
      current.push({ item, meta });
      grouped.set(meta.section, current);
    }

    const ordered = sectionOrder
      .filter((section) => grouped.has(section))
      .map((section) => ({
        key: section.toLowerCase().replace(/\s+/g, "-"),
        label: section,
        items: grouped.get(section) ?? [],
      }));

    const remaining = Array.from(grouped.entries())
      .filter(([section]) => !sectionOrder.includes(section))
      .map(([section, items]) => ({
        key: section.toLowerCase().replace(/\s+/g, "-"),
        label: section,
        items,
      }));

    return [...ordered, ...remaining];
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
                      {searchResults.map((item) => (
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
                      await markNotificationsAsRead(unreadIds);
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
                  className="absolute right-0 top-12 z-50 rounded-[18px] border border-zinc-200 bg-white px-6 py-5 shadow-xl"
                  style={{
                    width: "420px",
                    minWidth: "420px",
                    maxWidth: "calc(100vw - 1rem)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-zinc-900">
                      Notificaciones
                    </h2>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="rounded-[5px] p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                      aria-label="Cerrar notificaciones"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-6 max-h-[520px] space-y-8 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="rounded-[5px] bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                        No hay notificaciones.
                      </div>
                    ) : (
                      notificationSections.map((section) => (
                        <section key={section.key}>
                          <div className="text-sm font-semibold text-zinc-900">
                            {section.label}
                          </div>
                          <div className="mt-4 space-y-3">
                            {section.items.map(({ item, meta }) => {
                              const MetaIcon = meta.icon;
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-3 rounded-[5px] bg-zinc-50 px-3 py-3"
                                >
                                  {item.avatar ? (
                                    <UserAvatar
                                      src={item.avatar}
                                      alt={item.text}
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

                                  <div className="flex-1 text-sm text-zinc-700">
                                    <div className="font-medium text-zinc-900">
                                      {item.text}
                                    </div>
                                    <div className="text-xs text-zinc-400">
                                      {item.dateLabel}
                                    </div>
                                  </div>

                                  {item.action ? (
                                    <Link
                                      href={item.action.href}
                                      className="rounded-[5px] bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
                                      onClick={() => setNotificationsOpen(false)}
                                    >
                                      {item.action.label}
                                    </Link>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))
                    )}
                  </div>

                  <div className="mt-6 border-t border-zinc-100 pt-4">
                    <Link
                      href="/notificaciones"
                      className="text-sm font-semibold text-zinc-900 transition hover:text-zinc-600"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      Entrar al centro de notificaciones
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              {showViewerSkeleton ? (
                <div className="fanpush-skeleton h-5 w-16 rounded" />
              ) : (
                <Link
                  href="/saldo"
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
                      src={profile?.avatarUrl}
                      alt={profile?.username ?? "Perfil"}
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
                      href="/saldo"
                      className="block rounded-[6px] px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setProfileOpen(false)}
                    >
                      Mi saldo
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
                        await signOut();
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
