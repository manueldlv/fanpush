import Link from "next/link";
import {
  Bell,
  Compass,
  Home,
  LogOut,
  Search,
  Settings,
  ShoppingBag,
  SquarePlus,
  User,
} from "lucide-react";

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
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-zinc-200 bg-white/95 px-4 py-6 backdrop-blur">
      <div className="flex h-full flex-col">
        <div className="px-2">
          <div className="text-xl font-semibold tracking-tight text-zinc-900">
            Fanpush
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
            Social
          </div>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
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
            <img
              src="https://picsum.photos/seed/bebudlv/40/40"
              alt="Perfil"
              className="h-5 w-5 rounded-full object-cover"
            />
            <span>Perfil</span>
          </Link>
        </nav>

        <div className="mt-6 rounded-[5px] border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
          Comparte fotos y conecta con tu comunidad.
        </div>

        <div className="mt-auto pt-4">
          <Link
            href="/auth"
            className="group flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <LogOut className="h-5 w-5 text-zinc-500 transition group-hover:text-zinc-900" />
            <span>Cerrar sesion</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
