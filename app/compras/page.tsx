"use client";

import { useMemo, useState } from "react";
import { Download, Lock } from "lucide-react";
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

const sales = [
  { id: "s1", type: "Foto", title: "Aurora urbana", count: 12, total: 120 },
  { id: "s2", type: "Video", title: "Motion set", count: 7, total: 140 },
  { id: "s3", type: "Pack", title: "Pack Naturaleza", count: 4, total: 80 },
];

export default function ComprasPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const totals = useMemo(() => {
    const totalSales = sales.reduce((acc, item) => acc + item.total, 0);
    const creator = totalSales * 0.7;
    const platform = totalSales * 0.3;
    return {
      totalSales,
      creator,
      platform,
    };
  }, []);

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

      <div className="flex h-full pl-60">
        <div className="mx-auto flex h-full w-full max-w-[1100px] flex-col gap-8 px-6 py-8">
          <div>
            <h1 className="text-2xl font-semibold">Mis compras</h1>
            <p className="text-sm text-zinc-500">
              Contenido adquirido y packs desbloqueados.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="rounded-[5px] border border-zinc-200 bg-white p-4"
              >
                <div className="relative aspect-square overflow-hidden rounded-[5px]">
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
                <div className="mt-4">
                  <div className="text-sm font-semibold text-zinc-900">
                    {purchase.title}
                  </div>
                  <div className="text-xs text-zinc-500">
                    @{purchase.creator} · {purchase.date}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-zinc-900">
                      ${purchase.price.toFixed(2)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {purchase.status}
                    </span>
                  </div>
                </div>
                <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-[5px] border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700">
                  <Download className="h-4 w-4" />
                  Descargar
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-zinc-200 pt-6">
            <div>
              <h2 className="text-2xl font-semibold">Mis ventas</h2>
              <p className="text-sm text-zinc-500">
                Resumen de ventas totales y detalle por tipo de contenido.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-6">
              <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                <div className="text-xs text-zinc-500">Ventas totales</div>
                <div className="mt-2 text-2xl font-semibold">
                  ${totals.totalSales.toFixed(2)}
                </div>
              </div>
              <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                <div className="text-xs text-zinc-500">Tu ganancia (70%)</div>
                <div className="mt-2 text-2xl font-semibold">
                  ${totals.creator.toFixed(2)}
                </div>
              </div>
              <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                <div className="text-xs text-zinc-500">Comision (30%)</div>
                <div className="mt-2 text-2xl font-semibold">
                  ${totals.platform.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[5px] border border-zinc-200 bg-white">
              <div className="grid grid-cols-5 border-b border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-500">
                <span>Tipo</span>
                <span className="col-span-2">Contenido</span>
                <span className="text-right">Ventas</span>
                <span className="text-right">Total</span>
              </div>
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="grid grid-cols-5 items-center px-4 py-3 text-sm text-zinc-700"
                >
                  <span>{sale.type}</span>
                  <span className="col-span-2">{sale.title}</span>
                  <span className="text-right">{sale.count}</span>
                  <span className="text-right font-semibold">
                    ${sale.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
              Recibes el 70% de cada venta. La plataforma retiene el 30% en
              concepto de comision.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
