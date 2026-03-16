"use client";

import { useState } from "react";
import { Bell, User } from "lucide-react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";

export default function SettingsPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "notifications">(
    "profile",
  );
  const [avatarUrl, setAvatarUrl] = useState(
    "https://picsum.photos/seed/bebudlv/96/96",
  );

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <SidebarLeft
        searchOpen={searchOpen}
        onSearchClick={() => {
          setNotificationsOpen(false);
          setSearchOpen(true);
        }}
        notificationsOpen={notificationsOpen}
        onNotificationsClick={() => {
          setSearchOpen(false);
          setNotificationsOpen(true);
        }}
      />

      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none gap-6 px-4 py-6 md:max-w-[1200px] md:gap-8 md:px-6 md:py-8">
          <aside className="w-[280px] shrink-0">
            <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
              <div className="text-lg font-semibold">Configuración</div>
              <div className="mt-4 space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className={`flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-semibold transition ${
                    activeTab === "profile"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <User className="h-4 w-4" />
                  Editar perfil
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("notifications")}
                  className={`flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-semibold transition ${
                    activeTab === "notifications"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  Notificaciones
                </button>
              </div>
            </div>
          </aside>

          <section className="flex-1">
            {activeTab === "profile" ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold">Editar perfil</h1>
                  <p className="text-sm text-zinc-500">
                    Actualiza tu informacion publica y preferencias basicas.
                  </p>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={avatarUrl}
                        alt="bebudlv"
                        className="h-16 w-16 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-sm font-semibold">bebudlv</div>
                        <div className="text-sm text-zinc-500">Manu</div>
                      </div>
                    </div>
                    <label className="cursor-pointer rounded-[5px] bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
                      Cambiar foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const nextUrl = URL.createObjectURL(file);
                          setAvatarUrl(nextUrl);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                  <label className="text-sm font-semibold text-zinc-900">
                    Nombre
                  </label>
                  <div className="mt-2 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <input
                      placeholder="Tu nombre"
                      className="w-full bg-transparent text-sm text-zinc-800 outline-none"
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Asi aparecera tu nombre en tu perfil.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button className="rounded-[5px] bg-zinc-900 px-6 py-2 text-sm font-semibold text-white">
                    Guardar cambios
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold">Notificaciones</h1>
                  <p className="text-sm text-zinc-500">
                    Personaliza como queres recibir avisos.
                  </p>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white">
                  <button className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
                    <span>Notificaciones push</span>
                    <span className="text-zinc-400">›</span>
                  </button>
                  <button className="flex w-full items-center justify-between border-t border-zinc-200 px-6 py-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
                    <span>Notificaciones por correo electronico</span>
                    <span className="text-zinc-400">›</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
