"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Search, User as UserIcon } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type SearchResult = {
  id: string;
  name: string;
  fullName: string;
  detail: string;
  avatar: string | null;
};

type NotificationItem = {
  id: string;
  text: string;
  date: string;
  avatar: string | null;
  action?: { label: string; href: string };
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<{
    username: string | null;
    avatarUrl: string | null;
  }>({ username: null, avatarUrl: null });
  const [balance, setBalance] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

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
    const loadProfile = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        setProfile({ username: null, avatarUrl: null });
        setBalance(0);
        return;
      }

      const { data: userRow } = await supabase
        .from("users")
        .select("username, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      let avatarUrl = userRow?.avatar_url ?? null;
      if (avatarUrl && !avatarUrl.startsWith("http")) {
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(avatarUrl);
        avatarUrl = publicUrl.publicUrl;
      }

      setProfile({
        username: userRow?.username ?? null,
        avatarUrl,
      });

      const { data: postRows } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", userId);
      const postIds = (postRows ?? []).map((row) => row.id);
      if (postIds.length === 0) {
        setBalance(0);
        return;
      }
      const { data: purchaseRows } = await supabase
        .from("purchases")
        .select("amount, post_id")
        .in("post_id", postIds);
      const total = (purchaseRows ?? []).reduce(
        (sum, row) => sum + Number(row.amount || 0) * 0.7,
        0,
      );
      setBalance(total);

      const { data: notifRows } = await supabase
        .from("notifications")
        .select("id,actor_id,message,created_at,type,entity_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      const actorIds = Array.from(
        new Set((notifRows ?? []).map((n) => n.actor_id).filter(Boolean)),
      );
      const { data: actors } = actorIds.length
        ? await supabase
            .from("users")
            .select("id,avatar_url,username")
            .in("id", actorIds)
        : { data: [] };

      const resolveAvatar = async (value: string | null) => {
        if (!value) return null;
        if (value.startsWith("http")) return value;
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(value);
        return publicUrl.publicUrl;
      };

      const actorMap = new Map(
        (actors ?? []).map((actor) => [actor.id, actor]),
      );
      const mapped = await Promise.all(
        (notifRows ?? []).map(async (row) => ({
          id: row.id,
          text: `${actorMap.get(row.actor_id)?.username ?? "alguien"} ${
            row.message ?? ""
          }`,
          date: new Date(row.created_at).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
          }),
          avatar: await resolveAvatar(actorMap.get(row.actor_id)?.avatar_url ?? null),
          action:
            row.type === "purchase"
              ? { label: "Ver venta", href: "/ventas" }
              : undefined,
        })),
      );
      setNotifications(mapped);
    };

    loadProfile();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        username?: string;
        fullName?: string;
        avatarUrl?: string | null;
      };
      if (detail?.avatarUrl !== undefined || detail?.username) {
        setProfile({
          username: detail?.username ?? profile.username,
          avatarUrl:
            detail?.avatarUrl !== undefined
              ? detail.avatarUrl
              : profile.avatarUrl,
        });
      }
    };
    window.addEventListener("profile-updated", handler as EventListener);
    return () =>
      window.removeEventListener("profile-updated", handler as EventListener);
  }, [profile.avatarUrl, profile.username]);

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
    const params = new URLSearchParams({
      user: item.name,
      full: item.fullName,
      avatar: item.avatar,
    });
    router.push(`/perfil?${params.toString()}`);
    setSearchOpen(false);
    setQuery("");
  };

  if (pathname?.startsWith("/auth")) {
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
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100"
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4" />
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 top-12 z-50 w-[360px] rounded-[12px] border border-zinc-200 bg-white p-4 shadow-xl">
                  <div className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
                    {notifications.length === 0 ? (
                      <div className="text-sm text-zinc-500">
                        No hay notificaciones.
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-[10px] bg-zinc-50 px-3 py-3"
                        >
                          {item.avatar ? (
                            <img
                              src={item.avatar}
                              alt="avatar"
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-zinc-100" />
                          )}
                          <div className="flex-1 text-sm text-zinc-700">
                            <div className="font-medium text-zinc-900">
                              {item.text}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {item.date}
                            </div>
                          </div>
                          {item.action ? (
                            <Link
                              href={item.action.href}
                              className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
                            >
                              {item.action.label}
                            </Link>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/ventas"
                className="cursor-pointer text-sm font-semibold text-zinc-900"
              >
                ${balance.toFixed(2)}
              </Link>
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="rounded-full"
                  aria-label="Abrir menu de perfil"
                >
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.username ?? "Perfil"}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-500">
                      <UserIcon className="h-4 w-4" />
                    </span>
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
                      Settings
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
