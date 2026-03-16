"use client";

import { useState } from "react";
import { Download, Image as ImageIcon, Lock } from "lucide-react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";

const purchases = [
  {
    id: "p1",
    title: "Pack Naturaleza",
    creator: "creativestudio",
    date: "12 mar",
    price: 9.99,
    cover: "https://picsum.photos/seed/purchase-1/600/600",
    status: "Desbloqueado",
  },
  {
    id: "p2",
    title: "Sesion urbana",
    creator: "cami.rojas",
    date: "09 mar",
    price: 5.5,
    cover: "https://picsum.photos/seed/purchase-2/600/600",
    status: "Desbloqueado",
  },
  {
    id: "p3",
    title: "Estudio minimal",
    creator: "mateod",
    date: "05 mar",
    price: 7.0,
    cover: "https://picsum.photos/seed/purchase-3/600/600",
    status: "Pendiente",
  },
];

export default function ComprasPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[1100px] md:gap-8 md:px-6 md:py-8">
          <div>
            <h1 className="text-2xl font-semibold">Mis compras</h1>
            <p className="text-sm text-zinc-500">
              Contenido adquirido y packs desbloqueados.
            </p>
          </div>

          <div className="space-y-4">
            {purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="flex flex-col gap-4 rounded-[5px] border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-[5px] border border-zinc-200 bg-zinc-100">
                    <img
                      src={purchase.cover}
                      alt={purchase.title}
                      className="h-full w-full object-cover"
                    />
                    {purchase.status === "Pendiente" ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                        <Lock className="h-5 w-5" />
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {purchase.title}
                    </div>
                    <div className="text-xs text-zinc-500">
                      @{purchase.creator} · {purchase.date}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-sm">
                      <span className="font-semibold text-zinc-900">
                        ${purchase.price.toFixed(2)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {purchase.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <a
                    href={purchase.cover}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-[5px] border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Ver foto
                  </a>
                  <button className="inline-flex items-center justify-center gap-2 rounded-[5px] border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
                    <Download className="h-4 w-4" />
                    Descargar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
