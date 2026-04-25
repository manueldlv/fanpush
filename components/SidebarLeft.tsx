import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  Compass,
  Wallet,
  Home,
  LogOut,
  DollarSign,
  Search,
  Settings,
  ShoppingBag,
  SquarePlus,
  User,
} from "lucide-react";
import { useGetViewerQuery, useSignOutMutation } from "@/lib/redux/api/sessionApi";
import { useGetNotificationCenterQuery } from "@/lib/redux/api/notificationsApi";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { openSearchPanel } from "@/lib/redux/slices/uiSlice";
import { EARNINGS_REFRESH_FLAG, PURCHASE_REFRESH_FLAG } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export default function SidebarLeft() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const searchOpen = useAppSelector((state) => state.ui.searchPanelOpen);
  const { data: viewer } = useGetViewerQuery();
  const { data: notificationCenter } = useGetNotificationCenterQuery();
  const [signOut] = useSignOutMutation();
  const [purchaseBadge, setPurchaseBadge] = useState(false);
  const [salesBadge, setSalesBadge] = useState(false);
  const [messagesBadgeCount, setMessagesBadgeCount] = useState(0);
  const isBlocked = viewer?.access.isBlocked ?? false;
  const blockedReason = viewer?.access.blockedReason ?? null;
  const financeOnlyAccess =
    isBlocked &&
    (blockedReason === "account_closed" || blockedReason === "account_deleted");
  const canCreate = viewer?.access.canCreate ?? false;
  const isAuthor = viewer?.access.isAuthor ?? false;
  const createHref = canCreate ? "/crear" : "/autor/solicitud";

  useEffect(() => {
    let cancelled = false;

    const loadDirectChatUnread = async () => {
      try {
        const supabase = getSupabaseClient();
        const session = supabase
          ? await supabase.auth.getSession().then((result) => result.data.session)
          : null;
        const response = await fetch("/api/direct-chats", {
          credentials: "include",
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        const result = (await response.json()) as {
          error?: string;
          threads?: Array<{ unread?: boolean }>;
        };
        if (!response.ok || cancelled) return;
        setMessagesBadgeCount((result.threads ?? []).filter((thread) => thread.unread).length);
      } catch {
        if (!cancelled) setMessagesBadgeCount(0);
      }
    };

    void loadDirectChatUnread();
    window.addEventListener("focus", loadDirectChatUnread);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadDirectChatUnread);
    };
  }, []);

  useEffect(() => {
    const syncBadges = () => {
      if (typeof window === "undefined") return;
      setPurchaseBadge(Boolean(window.sessionStorage.getItem(PURCHASE_REFRESH_FLAG)));
      setSalesBadge(Boolean(window.sessionStorage.getItem(EARNINGS_REFRESH_FLAG)));
    };

    syncBadges();
    window.addEventListener("purchases-updated", syncBadges);
    window.addEventListener("earnings-updated", syncBadges);
    return () => {
      window.removeEventListener("purchases-updated", syncBadges);
      window.removeEventListener("earnings-updated", syncBadges);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/compras") {
      window.sessionStorage.removeItem(PURCHASE_REFRESH_FLAG);
      setPurchaseBadge(false);
    }
    if (pathname === "/ventas") {
      window.sessionStorage.removeItem(EARNINGS_REFRESH_FLAG);
      setSalesBadge(false);
    }
  }, [pathname]);

  const itemClass = (active = false) =>
    `group flex items-center gap-3 rounded-[14px] px-3 py-3 text-[15px] font-semibold leading-none tracking-[-0.01em] transition ${
      active
        ? "text-[#5A3EE7]"
        : "text-[#161823] hover:bg-black/[0.035] hover:text-[#161823]"
    }`;

  const iconClass = (active = false) =>
    `h-6 w-6 transition ${active ? "text-[#5A3EE7]" : "text-[#161823]"}`;

  const unreadNotifications = (notificationCenter?.activity ?? []).some(
    (item) => !item.isRead,
  );
  const salesActivityBadge = (notificationCenter?.activity ?? []).some(
    (item) =>
      !item.isRead &&
      (item.type === "purchase" ||
        item.type === "tip" ||
        item.type === "withdrawal_update"),
  );

  const showBadge = (
    _active: boolean,
    badgeCount: number,
    icon: ReactNode,
    label: string,
  ) => (
    <>
      <span className="relative">
        {icon}
        {badgeCount > 0 ? (
          <span className="absolute -right-2 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ff334b] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </span>
      <span>{label}</span>
    </>
  );

  const messagesNavIcon = (active = false) => (
    <Image
      src="/messages-nav-icon.png"
      alt=""
      width={22}
      height={18}
      className="h-[18px] w-[22px] object-contain"
      style={{
        filter: active
          ? "brightness(0) saturate(100%) invert(33%) sepia(82%) saturate(2390%) hue-rotate(238deg) brightness(94%) contrast(93%)"
          : "brightness(0) saturate(100%)",
      }}
      unoptimized
      aria-hidden="true"
    />
  );

  const mobileIconWrapClass =
    "relative flex h-11 w-11 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100";

  const mobileBadge = (count: number) =>
    count > 0 ? (
      <span className="absolute right-0 top-0 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ff334b] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  return (
    <>
      <aside className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-60 border-r border-black/8 bg-white px-4 py-6 md:block">
        <div className="flex h-full flex-col">
          <nav className="mt-2 flex flex-1 flex-col gap-0.5">
            {!financeOnlyAccess ? (
              <>
                <Link
                  href="/"
                  className={itemClass(pathname === "/")}
                >
                  <Home className={iconClass(pathname === "/")} />
                  <span>Inicio</span>
                </Link>
                <button
                  type="button"
                  onClick={() => dispatch(openSearchPanel())}
                  className={`group flex items-center gap-3 rounded-[14px] px-3 py-3 text-[15px] font-semibold leading-none tracking-[-0.01em] transition ${
                    searchOpen
                      ? "text-[#5A3EE7]"
                      : "text-[#161823] hover:bg-black/[0.035] hover:text-[#161823]"
                  }`}
                >
                  <Search className={`h-6 w-6 transition ${searchOpen ? "text-[#5A3EE7]" : "text-[#161823]"}`} />
                  <span>Búsqueda</span>
                </button>
                <Link
                  href="/explorar"
                  className={itemClass(pathname === "/explorar")}
                >
                  <Compass className={iconClass(pathname === "/explorar")} />
                  <span>Explorar</span>
                </Link>
                <Link
                  href="/mensajes"
                  className={itemClass(pathname === "/mensajes")}
                >
                  {showBadge(
                    pathname === "/mensajes",
                    messagesBadgeCount,
                    messagesNavIcon(pathname === "/mensajes"),
                    "Mensajes",
                  )}
                </Link>
                <Link
                  href="/notificaciones"
                  className={itemClass(pathname === "/notificaciones")}
                >
                  {showBadge(
                    pathname === "/notificaciones",
                    unreadNotifications ? 1 : 0,
                    <Bell className={iconClass(pathname === "/notificaciones")} />,
                    "Notificaciones",
                  )}
                </Link>
                <Link
                  href={createHref}
                  className={itemClass(pathname === "/crear" || pathname === "/autor/solicitud")}
                >
                  <SquarePlus
                    className={iconClass(
                      pathname === "/crear" || pathname === "/autor/solicitud",
                    )}
                  />
                  <span>Crear</span>
                </Link>
                <Link
                  href="/compras"
                  className={itemClass(pathname === "/compras")}
                >
                  {showBadge(
                    pathname === "/compras",
                    purchaseBadge ? 1 : 0,
                    <ShoppingBag className={iconClass(pathname === "/compras")} />,
                    "Mis compras",
                  )}
                </Link>
                <Link
                  href="/favoritos"
                  className={itemClass(pathname === "/favoritos")}
                >
                  <Bookmark className={iconClass(pathname === "/favoritos")} />
                  <span>Favoritos</span>
                </Link>
              </>
            ) : (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                Tu cuenta está cerrada. Solo puedes acceder a saldo, retiros y configuración.
              </div>
            )}
            {isAuthor ? (
              <Link
                href="/ventas"
                className={itemClass(pathname === "/ventas")}
              >
                {showBadge(
                  pathname === "/ventas",
                  salesBadge || salesActivityBadge ? 1 : 0,
                  <DollarSign className={iconClass(pathname === "/ventas")} />,
                  "Mis ventas",
                )}
              </Link>
            ) : null}
            <Link
              href="/saldo"
              className={itemClass(pathname === "/saldo")}
            >
              <Wallet className={iconClass(pathname === "/saldo")} />
              <span>Mi saldo</span>
            </Link>
            <div className="py-2" />
            <Link
              href="/settings"
              className={itemClass(pathname === "/settings")}
            >
              <Settings className={iconClass(pathname === "/settings")} />
              <span>Configuración</span>
            </Link>
            <Link
              href="/perfil"
              className={itemClass(pathname === "/perfil")}
            >
              <User className={iconClass(pathname === "/perfil")} />
              <span>Perfil</span>
            </Link>
          </nav>

          {!financeOnlyAccess ? (
            <div className="mt-6 rounded-[16px] border border-black/8 bg-black/[0.02] p-4 text-xs text-zinc-600">
              <div className="font-semibold text-zinc-900">FanPush guía rápida</div>
              <div className="mt-2">
                Compra contenido al instante, deja propinas y, si quieres vender, solicita tu verificación de autor.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/ayuda"
                  className="rounded-[5px] border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700"
                >
                  Centro de ayuda
                </Link>
                <Link
                  href="/faq"
                  className="rounded-[5px] border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700"
                >
                  FAQ
                </Link>
              </div>
            </div>
          ) : null}

        <div className="mt-auto border-t border-black/8 pt-4">
            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.assign("/auth");
              }}
              className="group flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-[15px] font-semibold tracking-[-0.01em] text-[#161823] transition hover:bg-black/[0.035]"
            >
              <LogOut className="h-6 w-6 text-[#161823]" />
              <span>Cerrar sesion</span>
            </button>
        </div>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-zinc-200 bg-white px-2 py-2 md:hidden">
        {!financeOnlyAccess ? (
          <>
            <Link
              href="/"
              className={mobileIconWrapClass}
              aria-label="Inicio"
            >
              <Home className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => dispatch(openSearchPanel())}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                searchOpen ? "bg-zinc-100 text-zinc-900" : "text-zinc-700"
              }`}
              aria-label="Búsqueda"
            >
              <Search className="h-5 w-5" />
            </button>
            <Link
              href="/explorar"
              className={mobileIconWrapClass}
              aria-label="Explorar"
            >
              <Compass className="h-5 w-5" />
            </Link>
            <Link
              href="/mensajes"
              className={mobileIconWrapClass}
              aria-label="Mensajes"
            >
              {mobileBadge(messagesBadgeCount)}
              <Image
                src="/messages-nav-icon.png"
                alt=""
                width={20}
                height={16}
                className="h-4 w-5 object-contain brightness-0 saturate-100"
                unoptimized
                aria-hidden="true"
              />
            </Link>
            <Link
              href={createHref}
              className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
              aria-label="Crear"
            >
              <SquarePlus className="h-5 w-5" />
            </Link>
            <Link
              href="/notificaciones"
              className={mobileIconWrapClass}
              aria-label="Notificaciones"
            >
              {mobileBadge(unreadNotifications ? 1 : 0)}
              <Bell className="h-5 w-5" />
            </Link>
            <Link
              href="/compras"
              className={mobileIconWrapClass}
              aria-label="Mis compras"
            >
              {mobileBadge(purchaseBadge ? 1 : 0)}
              <ShoppingBag className="h-5 w-5" />
            </Link>
          </>
        ) : null}
        {isAuthor ? (
          <Link
            href="/ventas"
            className={mobileIconWrapClass}
            aria-label="Mis ventas"
          >
            {mobileBadge(salesBadge || salesActivityBadge ? 1 : 0)}
            <DollarSign className="h-5 w-5" />
          </Link>
        ) : null}
        <Link
          href="/perfil"
          className={mobileIconWrapClass}
          aria-label="Perfil"
        >
          <User className="h-5 w-5" />
        </Link>
      </nav>
    </>
  );
}
