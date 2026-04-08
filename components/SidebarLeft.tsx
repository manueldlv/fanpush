import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Compass,
  Wallet,
  Home,
  LogOut,
  DollarSign,
  Search,
  Send,
  Settings,
  ShoppingBag,
  SquarePlus,
  User,
} from "lucide-react";
import { useGetViewerQuery, useSignOutMutation } from "@/lib/redux/api/sessionApi";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { openSearchPanel } from "@/lib/redux/slices/uiSlice";

export default function SidebarLeft() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const searchOpen = useAppSelector((state) => state.ui.searchPanelOpen);
  const { data: viewer } = useGetViewerQuery();
  const [signOut] = useSignOutMutation();
  const canCreate = viewer?.access.canCreate ?? false;

  const itemClass = (active = false) =>
    `group flex items-center gap-3 rounded-[14px] px-3 py-3 text-[15px] font-semibold leading-none tracking-[-0.01em] transition ${
      active
        ? "text-[#5A3EE7]"
        : "text-[#161823] hover:bg-black/[0.035] hover:text-[#161823]"
    }`;

  const iconClass = (active = false) =>
    `h-6 w-6 transition ${active ? "text-[#5A3EE7]" : "text-[#161823]"}`;

  return (
    <>
      <aside className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-60 border-r border-black/8 bg-white px-4 py-6 md:block">
        <div className="flex h-full flex-col">
          <nav className="mt-2 flex flex-1 flex-col gap-0.5">
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
              <Send className={iconClass(pathname === "/mensajes")} />
              <span>Mensajes</span>
            </Link>
            <Link
              href="/notificaciones"
              className={itemClass(pathname === "/notificaciones")}
            >
              <Bell className={iconClass(pathname === "/notificaciones")} />
              <span>Notificaciones</span>
            </Link>
            {canCreate ? (
              <Link
                href="/crear"
                className={itemClass(pathname === "/crear")}
              >
                <SquarePlus className={iconClass(pathname === "/crear")} />
                <span>Crear</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="group flex items-center gap-3 rounded-[14px] px-3 py-3 text-[15px] font-semibold tracking-[-0.01em] text-black/20"
              >
                <SquarePlus className="h-6 w-6 text-black/20" />
                <span>Crear</span>
              </button>
            )}
            <Link
              href="/compras"
              className={itemClass(pathname === "/compras")}
            >
              <ShoppingBag className={iconClass(pathname === "/compras")} />
              <span>Mis compras</span>
            </Link>
            <Link
              href="/ventas"
              className={itemClass(pathname === "/ventas")}
            >
              <DollarSign className={iconClass(pathname === "/ventas")} />
              <span>Mis ventas</span>
            </Link>
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
        <Link
          href="/"
          className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
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
          className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
          aria-label="Explorar"
        >
          <Compass className="h-5 w-5" />
        </Link>
        <Link
          href="/mensajes"
          className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
          aria-label="Mensajes"
        >
          <Send className="h-5 w-5" />
        </Link>
        {canCreate ? (
          <Link
            href="/crear"
            className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
            aria-label="Crear"
          >
            <SquarePlus className="h-5 w-5" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-300"
            aria-label="Crear deshabilitado"
          >
            <SquarePlus className="h-5 w-5" />
          </button>
        )}
        <Link
          href="/notificaciones"
          className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-700 transition hover:bg-zinc-100"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
        </Link>
        <Link
          href="/perfil"
          className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
          aria-label="Perfil"
        >
          <User className="h-5 w-5" />
        </Link>
      </nav>
    </>
  );
}
