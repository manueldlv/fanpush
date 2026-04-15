"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  Bell,
  CreditCard,
  Search,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { useGetNotificationCenterQuery } from "@/lib/redux/api/notificationsApi";
import { useSearchUsersQuery } from "@/lib/redux/api/searchApi";
import {
  useGetViewerQuery,
  useSignOutMutation,
} from "@/lib/redux/api/sessionApi";
import type { NotificationActivityItem } from "@/lib/server/repositories/notification-center";
import { cn } from "@/lib/utils";

type NotificationTone = {
  pillClassName: string;
  iconWrapClassName: string;
  iconClassName: string;
  label: string;
  icon: typeof Bell;
};

const NOTIFICATION_TONES: Record<string, NotificationTone> = {
  follow: {
    label: "Nuevo seguidor",
    pillClassName: "bg-sky-50 text-sky-700",
    iconWrapClassName: "bg-sky-100",
    iconClassName: "text-sky-700",
    icon: UserPlus,
  },
  tip: {
    label: "Nueva propina",
    pillClassName: "bg-emerald-50 text-emerald-700",
    iconWrapClassName: "bg-emerald-100",
    iconClassName: "text-emerald-700",
    icon: BadgeDollarSign,
  },
  purchase: {
    label: "Nueva venta",
    pillClassName: "bg-violet-50 text-violet-700",
    iconWrapClassName: "bg-violet-100",
    iconClassName: "text-violet-700",
    icon: CreditCard,
  },
  withdrawal_update: {
    label: "Retiro",
    pillClassName: "bg-amber-50 text-amber-700",
    iconWrapClassName: "bg-amber-100",
    iconClassName: "text-amber-700",
    icon: Wallet,
  },
  author_application_update: {
    label: "Solicitud de autor",
    pillClassName: "bg-indigo-50 text-indigo-700",
    iconWrapClassName: "bg-indigo-100",
    iconClassName: "text-indigo-700",
    icon: Sparkles,
  },
  content_removed_update: {
    label: "Moderación",
    pillClassName: "bg-rose-50 text-rose-700",
    iconWrapClassName: "bg-rose-100",
    iconClassName: "text-rose-700",
    icon: ShieldAlert,
  },
};

const getNotificationTone = (type: string): NotificationTone =>
  NOTIFICATION_TONES[type] ?? {
    label: "Notificación",
    pillClassName: "bg-zinc-100 text-zinc-700",
    iconWrapClassName: "bg-zinc-100",
    iconClassName: "text-zinc-600",
    icon: Bell,
  };

const formatBalanceUnits = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

function NotificationPreviewItem({
  item,
  onSelect,
}: {
  item: NotificationActivityItem;
  onSelect: () => void;
}) {
  const tone = getNotificationTone(item.type);
  const Icon = tone.icon;

  const content = (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 px-4 py-3 transition hover:bg-zinc-50">
      {item.avatar ? (
        <UserAvatar
          src={item.avatar}
          alt={item.text}
          sizeClassName="h-11 w-11"
          iconClassName="h-4 w-4"
        />
      ) : (
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full",
            tone.iconWrapClassName,
          )}
        >
          <Icon className={cn("h-4.5 w-4.5", tone.iconClassName)} />
        </div>
      )}

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold",
              tone.pillClassName,
            )}
          >
            {tone.label}
          </span>
          <span className="text-[11px] text-zinc-400">{item.dateLabel}</span>
          {!item.isRead ? <span className="h-2 w-2 rounded-full bg-zinc-950" /> : null}
        </div>
        <p className="mt-2 line-clamp-2 text-[13px] leading-[1.35] text-zinc-900">
          {item.text}
        </p>
      </div>
    </div>
  );

  if (item.action) {
    return (
      <Link href={item.action.href} onClick={onSelect} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onSelect} className="block w-full text-left">
      {content}
    </button>
  );
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const profileRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const { data: viewer, isLoading: viewerLoading } = useGetViewerQuery();
  const { data: notificationsData } = useGetNotificationCenterQuery();
  const [signOut] = useSignOutMutation();
  const { data: results = [], isFetching: searchLoading } = useSearchUsersQuery(
    debouncedQuery,
    { skip: debouncedQuery.trim().length < 2 },
  );
  const profile = viewer?.profile;
  const balance = viewer?.commerce.balance ?? 0;
  const isAuthor = viewer?.access.isAuthor ?? false;
  const previewNotifications = (notificationsData?.activity ?? []).slice(0, 6);
  const unreadCount = (notificationsData?.activity ?? []).filter(
    (item) => !item.isRead,
  ).length;

  const showTopBar = useMemo(
    () =>
      !pathname?.startsWith("/auth") &&
      !pathname?.startsWith("/admin") &&
      !pathname?.startsWith("/terminos") &&
      !pathname?.startsWith("/privacidad") &&
      !pathname?.startsWith("/ayuda") &&
      !pathname?.startsWith("/faq"),
    [pathname],
  );

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
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
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [notificationsOpen, profileOpen, searchOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [query]);

  if (!showTopBar) {
    return null;
  }

  return (
    <header className="fixed left-0 top-0 z-[140] h-16 w-full border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/fanpush-logo.png"
              alt="FanPush"
              width={54}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </Link>

          <nav className="hidden items-center gap-5 text-[14px] font-semibold text-zinc-500 sm:flex">
            <Link
              href="/"
              className={pathname === "/" ? "text-[#5A3EE7]" : "hover:text-zinc-900"}
            >
              Feed
            </Link>
            <Link
              href="/explorar"
              className={
                pathname?.startsWith("/explorar")
                  ? "text-[#5A3EE7]"
                  : "hover:text-zinc-900"
              }
            >
              Descubrir
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden md:block" ref={searchRef}>
            <div className="flex h-[50px] w-[360px] items-center gap-3 rounded-full border border-zinc-200 bg-white px-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <Search className="h-[22px] w-[22px] text-zinc-400" />
              <input
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar usuarios"
                className="w-full bg-transparent text-[15px] font-medium text-zinc-800 outline-none placeholder:text-zinc-400"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setDebouncedQuery("");
                  }}
                  className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {searchOpen ? (
              <div className="absolute right-0 top-[56px] w-[360px] overflow-hidden rounded-[18px] border border-zinc-200 bg-white shadow-xl">
                {debouncedQuery.trim().length < 2 ? (
                  <div className="px-4 py-4 text-[13px] text-zinc-500">
                    Escribí al menos 2 letras para buscar perfiles.
                  </div>
                ) : searchLoading ? (
                  <div className="px-4 py-4 text-[13px] text-zinc-500">Buscando...</div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-4 text-[13px] text-zinc-500">
                    No encontramos usuarios para “{debouncedQuery}”.
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto py-2">
                    {results.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          setQuery("");
                          setDebouncedQuery("");
                          router.push(buildUserProfileHref(item.name));
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-50"
                      >
                        <UserAvatar
                          src={item.avatar}
                          alt={item.name}
                          sizeClassName="h-9 w-9"
                          iconClassName="h-4 w-4"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-zinc-900">
                            {item.name}
                          </div>
                          <div className="truncate text-[12px] text-zinc-500">
                            Abrir perfil
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
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative inline-flex h-[50px] w-[50px] items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-zinc-50 hover:text-zinc-900"
              aria-label="Notificaciones"
            >
              <Bell className="h-[23px] w-[23px]" />
              {unreadCount > 0 ? (
                <span className="absolute right-[13px] top-[13px] h-2.5 w-2.5 rounded-full bg-[#ff334b]" />
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="absolute right-0 top-12 z-50 w-[420px] overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-xl">
                <div className="border-b border-zinc-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold text-zinc-950">
                        Notifications
                      </div>
                      {unreadCount > 0 ? (
                        <div className="text-[12px] text-zinc-500">
                          {unreadCount} nuevas
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {previewNotifications.length === 0 ? (
                  <div className="px-4 py-6 text-[13px] text-zinc-500">
                    No tenés notificaciones por ahora.
                  </div>
                ) : (
                  <div className="max-h-[420px] divide-y divide-zinc-100 overflow-y-auto">
                    {previewNotifications.map((item) => (
                      <NotificationPreviewItem
                        key={item.id}
                        item={item}
                        onSelect={() => setNotificationsOpen(false)}
                      />
                    ))}
                  </div>
                )}

                <div className="border-t border-zinc-100 p-3">
                  <Link
                    href="/notificaciones"
                    onClick={() => setNotificationsOpen(false)}
                    className="flex h-9 items-center justify-center text-[13px] font-medium text-[#5A3EE7] transition hover:text-[#4931bc]"
                  >
                    Ver todas las notificaciones
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {viewerLoading ? (
            <div className="fanpush-skeleton h-9 w-20 rounded-full" />
          ) : (
            <Link
              href="/saldo"
              className="inline-flex h-[50px] items-center gap-2.5 rounded-full border border-[#5A3EE7] bg-white px-5 text-[#5A3EE7] shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
            >
              <Image
                src="/brand-lightning.png"
                alt=""
                width={17}
                height={21}
                aria-hidden="true"
                className="h-[21px] w-auto"
              />
              <span className="text-[16px] font-bold tracking-[-0.01em]">
                {Number.isFinite(balance) ? formatBalanceUnits(balance) : "0"}
              </span>
            </Link>
          )}

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="rounded-full"
              aria-label="Abrir menu de perfil"
            >
              {viewerLoading ? (
                <div className="fanpush-skeleton h-[50px] w-[50px] rounded-full" />
              ) : (
                <UserAvatar
                  src={profile?.avatarUrl}
                  alt={profile?.username ?? "Perfil"}
                  sizeClassName="h-[50px] w-[50px]"
                  iconClassName="h-5 w-5"
                />
              )}
            </button>

            {profileOpen ? (
              <div className="absolute right-0 top-12 z-[150] w-48 rounded-[12px] border border-zinc-200 bg-white p-2 shadow-xl">
                <Link
                  href="/perfil"
                  className="block rounded-[8px] px-3 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-100"
                  onClick={() => setProfileOpen(false)}
                >
                  Ver perfil
                </Link>
                <Link
                  href="/saldo"
                  className="block rounded-[8px] px-3 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-100"
                  onClick={() => setProfileOpen(false)}
                >
                  Mi saldo
                </Link>
                <Link
                  href="/settings"
                  className="block rounded-[8px] px-3 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-100"
                  onClick={() => setProfileOpen(false)}
                >
                  Configuración
                </Link>
                {!isAuthor ? (
                  <Link
                    href="/autor/solicitud"
                    className="block rounded-[8px] px-3 py-2 text-[13px] font-semibold text-[#5A3EE7] hover:bg-[#f4f1ff]"
                    onClick={() => setProfileOpen(false)}
                  >
                    Convertirme en autor
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    setProfileOpen(false);
                    router.replace("/auth");
                    window.location.assign("/auth");
                  }}
                  className="block w-full rounded-[8px] px-3 py-2 text-left text-[13px] font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
