"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Search,
  X,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { FANPUSH_WHATSAPP_SUPPORT_URL } from "@/lib/support";
import { useGetNotificationCenterQuery } from "@/lib/redux/api/notificationsApi";
import { useSearchUsersQuery } from "@/lib/redux/api/searchApi";
import {
  useGetViewerQuery,
  useSignOutMutation,
} from "@/lib/redux/api/sessionApi";
import { useViewerSession } from "@/lib/redux/useViewerSession";
import { getSupabaseClient } from "@/lib/supabase";
import type { NotificationActivityItem } from "@/lib/server/repositories/notification-center";
import { cn } from "@/lib/utils";

const formatBalanceUnits = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

function NotificationPreviewItem({
  item,
  isFollowing,
  followLoading,
  onFollow,
  onSelect,
}: {
  item: NotificationActivityItem;
  isFollowing: boolean;
  followLoading: boolean;
  onFollow: (item: NotificationActivityItem) => Promise<void>;
  onSelect: () => void;
}) {
  const router = useRouter();
  const profilePrefix =
    item.actorUsername && item.text.startsWith(`${item.actorUsername} `)
      ? `${item.actorUsername} `
      : null;
  const profileSuffix = profilePrefix ? item.text.slice(profilePrefix.length) : item.text;
  const rowHref = item.action?.href ?? (!item.action && item.type === "follow" && item.actorUsername
    ? buildUserProfileHref(item.actorUsername)
    : null);
  const content = (
    <div className="flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-50">
      <UserAvatar
        src={item.avatar}
        alt={item.text}
        sizeClassName="h-11 w-11"
        iconClassName="h-4 w-4"
      />

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[12px] font-medium leading-[1.35] text-zinc-900">
          {profilePrefix && item.actorUsername ? (
            <>
              <Link
                href={buildUserProfileHref(item.actorUsername)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect();
                }}
                className="text-[#2563eb] hover:underline"
              >
                {item.actorUsername}
              </Link>{" "}
              {profileSuffix}
            </>
          ) : (
            item.text
          )}
          <span className="ml-1 text-zinc-400">{item.dateLabel}</span>
        </p>
      </div>

      {item.type === "follow" && item.actorId ? (
        <button
          type="button"
          onClick={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await onFollow(item);
          }}
          disabled={followLoading}
          className={cn(
            "inline-flex min-w-[90px] items-center justify-center rounded-[10px] px-3 py-2 text-[12px] font-semibold transition",
            isFollowing
              ? "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              : "bg-[#5A3EE7] text-white hover:bg-[#4931bc]",
            followLoading ? "cursor-wait opacity-60" : "",
          )}
        >
          {isFollowing ? "Siguiendo" : "Seguir"}
        </button>
      ) : null}

      {!item.isRead ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#ff334b]" /> : null}
    </div>
  );

  if (rowHref) {
    return (
      <button
        type="button"
        onClick={() => {
          onSelect();
          router.push(rowHref);
        }}
        className="block w-full text-left"
      >
        {content}
      </button>
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
  const [followingActorIds, setFollowingActorIds] = useState<Set<string>>(new Set());
  const [followPendingIds, setFollowPendingIds] = useState<Set<string>>(new Set());
  const profileRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const { data: viewer, isLoading: viewerLoading } = useGetViewerQuery();
  const { userId: currentUserId } = useViewerSession();
  const { data: notificationsData } = useGetNotificationCenterQuery();
  const [signOut] = useSignOutMutation();
  const { data: results = [], isFetching: searchLoading } = useSearchUsersQuery(
    debouncedQuery,
    { skip: debouncedQuery.trim().length < 2 },
  );
  const profile = viewer?.profile;
  const isAuthor = viewer?.access.isAuthor ?? false;
  const balance = viewer?.commerce.balance ?? 0;
  const previewNotifications = (notificationsData?.activity ?? []).slice(0, 6);
  const followActorIdsKey = useMemo(
    () =>
      Array.from(
        new Set(
          previewNotifications
            .filter((item) => item.type === "follow" && item.actorId)
            .map((item) => item.actorId as string),
        ),
      )
        .sort()
        .join(","),
    [previewNotifications],
  );
  const unreadCount = (notificationsData?.activity ?? []).filter(
    (item) => !item.isRead,
  ).length;

  useEffect(() => {
    const loadFollowState = async () => {
      const actorIds = followActorIdsKey
        ? followActorIdsKey.split(",").filter(Boolean)
        : [];
      if (actorIds.length === 0) {
        setFollowingActorIds((prev) => (prev.size === 0 ? prev : new Set()));
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase || !currentUserId) return;
      if (!currentUserId) return;

      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .in("following_id", actorIds);

      setFollowingActorIds(
        (prev) => {
          const next = new Set(
            (data ?? []).map((row) => row.following_id).filter(Boolean),
          );
          const prevKey = Array.from(prev).sort().join(",");
          const nextKey = Array.from(next).sort().join(",");
          return prevKey === nextKey ? prev : next;
        },
      );
    };

    void loadFollowState();
  }, [currentUserId, followActorIdsKey]);

  const handleFollowFromNotifications = async (item: NotificationActivityItem) => {
    if (!item.actorId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (!currentUserId || currentUserId === item.actorId) return;

    setFollowPendingIds((prev) => new Set(prev).add(item.actorId as string));
    try {
      if (followingActorIds.has(item.actorId)) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", item.actorId);
        if (error) throw error;

        setFollowingActorIds((prev) => {
          const next = new Set(prev);
          next.delete(item.actorId as string);
          return next;
        });
        return;
      }

      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: item.actorId,
      });
      if (error) throw error;

      setFollowingActorIds((prev) => new Set(prev).add(item.actorId as string));
    } finally {
      setFollowPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.actorId as string);
        return next;
      });
    }
  };

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
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              window.location.assign("/");
            }}
            className="flex shrink-0 items-center"
            aria-label="Ir al inicio"
          >
            <Image
              src="/fanpush-logo.png"
              alt="FanPush"
              width={54}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </a>

          <nav className="hidden items-center gap-5 text-[14px] font-semibold text-zinc-500 sm:flex">
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault();
                window.location.assign("/");
              }}
              className={pathname === "/" ? "text-[#5A3EE7]" : "hover:text-zinc-900"}
            >
              Feed
            </a>
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
            <div className="flex h-[42px] w-[360px] items-center gap-2.5 rounded-full border border-zinc-200 bg-white px-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <Search className="h-5 w-5 text-zinc-400" />
              <input
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar usuarios"
                className="w-full bg-transparent text-[14px] font-medium text-zinc-800 outline-none placeholder:text-zinc-400"
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
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold leading-none text-zinc-900">
                            {item.name}
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
              className="relative inline-flex h-[42px] w-[42px] items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-zinc-50 hover:text-zinc-900"
              aria-label="Notificaciones"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-[10px] top-[10px] h-2.5 w-2.5 rounded-full bg-[#ff334b]" />
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
                        isFollowing={Boolean(item.actorId && followingActorIds.has(item.actorId))}
                        followLoading={Boolean(item.actorId && followPendingIds.has(item.actorId))}
                        onFollow={handleFollowFromNotifications}
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
            <button
              type="button"
              onClick={() => router.push("/saldo")}
              className="inline-flex h-[42px] items-center gap-2 rounded-full border border-[#5A3EE7] bg-white px-4 text-[#5A3EE7] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#faf8ff]"
              aria-label="Ir a mi saldo"
            >
              <Image
                src="/brand-lightning.png"
                alt=""
                width={17}
                height={21}
                aria-hidden="true"
                className="h-[18px] w-auto"
              />
              <span className="text-[15px] font-bold tracking-[-0.01em]">
                {Number.isFinite(balance) ? formatBalanceUnits(balance) : "0"}
              </span>
            </button>
          )}

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-full align-middle"
              aria-label="Abrir menu de perfil"
            >
              {viewerLoading ? (
                <div className="fanpush-skeleton h-[42px] w-[42px] rounded-full" />
              ) : (
                <UserAvatar
                  src={profile?.avatarUrl}
                  alt={profile?.username ?? "Perfil"}
                  sizeClassName="h-[42px] w-[42px]"
                  iconClassName="h-[18px] w-[18px]"
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
                <a
                  href={FANPUSH_WHATSAPP_SUPPORT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-[8px] px-3 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-100"
                  onClick={() => setProfileOpen(false)}
                >
                  Ayuda en línea
                </a>
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
