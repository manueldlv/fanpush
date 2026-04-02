import Link from "next/link";
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
  const searchOpen = useAppSelector((state) => state.ui.searchPanelOpen);
  const { data: viewer } = useGetViewerQuery();
  const [signOut] = useSignOutMutation();
  const canCreate = viewer?.access.canCreate ?? false;

  return (
    <>
      <aside className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-60 border-r border-zinc-200 bg-white/95 px-4 py-6 backdrop-blur md:block">
        <div className="flex h-full flex-col">
          <nav className="mt-2 flex flex-1 flex-col gap-1">
            <Link
              href="/"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Home className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Inicio</span>
            </Link>
            <button
              type="button"
              onClick={() => dispatch(openSearchPanel())}
              className={`group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium transition ${
                searchOpen
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Search
                className={`h-5 w-5 transition ${
                  searchOpen ? "text-zinc-900" : "text-zinc-500"
                }`}
              />
              <span>Búsqueda</span>
            </button>
            <Link
              href="/explorar"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Compass className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Explorar</span>
            </Link>
            <Link
              href="/mensajes"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Send className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Mensajes</span>
            </Link>
            <Link
              href="/notificaciones"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Bell className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Notificaciones</span>
            </Link>
            {canCreate ? (
              <Link
                href="/crear"
                className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                <SquarePlus className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
                <span>Crear</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-400"
              >
                <SquarePlus className="h-5 w-5 text-zinc-300" />
                <span>Crear</span>
              </button>
            )}
            <Link
              href="/compras"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <ShoppingBag className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Mis compras</span>
            </Link>
            <Link
              href="/ventas"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <DollarSign className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Mis ventas</span>
            </Link>
            <Link
              href="/saldo"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Wallet className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Mi saldo</span>
            </Link>
            <div className="py-2" />
            <Link
              href="/settings"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Settings className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Configuración</span>
            </Link>
            <Link
              href="/perfil"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <User className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Perfil</span>
            </Link>
          </nav>

          <div className="mt-6 rounded-[5px] border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
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

        <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.assign("/auth");
              }}
              className="group flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <LogOut className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
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
