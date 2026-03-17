import Link from "next/link";
import {
  Bell,
  Compass,
  Home,
  LogOut,
  DollarSign,
  Search,
  Settings,
  ShoppingBag,
  SquarePlus,
  User,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type SidebarLeftProps = {
  onSearchClick: () => void;
  searchOpen: boolean;
  onNotificationsClick: () => void;
  notificationsOpen: boolean;
};

export default function SidebarLeft({
  onSearchClick,
  searchOpen,
  onNotificationsClick,
  notificationsOpen,
}: SidebarLeftProps) {
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
              onClick={onSearchClick}
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
            <button
              type="button"
              onClick={onNotificationsClick}
              className={`group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium transition ${
                notificationsOpen
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Bell
                className={`h-5 w-5 transition ${
                  notificationsOpen ? "text-zinc-900" : "text-zinc-500"
                }`}
              />
              <span>Notificaciones</span>
            </button>
            <Link
              href="/crear"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <SquarePlus className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Crear</span>
            </Link>
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
            <div className="py-2" />
            <Link
              href="/settings"
              className="group flex items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Settings className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
              <span>Settings</span>
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
            Comparte fotos y conecta con tu comunidad.
          </div>

        <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={async () => {
                const supabase = getSupabaseClient();
                if (supabase) {
                  await supabase.auth.signOut();
                }
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
          onClick={onSearchClick}
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
          href="/crear"
          className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
          aria-label="Crear"
        >
          <SquarePlus className="h-5 w-5" />
        </Link>
        <button
          type="button"
          onClick={onNotificationsClick}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
            notificationsOpen ? "bg-zinc-100 text-zinc-900" : "text-zinc-700"
          }`}
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
        </button>
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
