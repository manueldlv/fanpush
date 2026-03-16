"use client";

import { useMemo, useState } from "react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";

const sales = [
  {
    id: "s1",
    type: "Foto",
    title: "Aurora urbana",
    count: 12,
    total: 120,
    buyer: {
      name: "maria.soria",
      full: "Maria Soria",
      avatar: "https://picsum.photos/seed/buyer-1/80/80",
    },
  },
  {
    id: "s2",
    type: "Video",
    title: "Motion set",
    count: 7,
    total: 140,
    buyer: {
      name: "fede.cl",
      full: "Federico C.",
      avatar: "https://picsum.photos/seed/buyer-2/80/80",
    },
  },
  {
    id: "s3",
    type: "Pack",
    title: "Pack Naturaleza",
    count: 4,
    total: 80,
    buyer: {
      name: "jaz.min",
      full: "Jaz Min",
      avatar: "https://picsum.photos/seed/buyer-3/80/80",
    },
  },
];

export default function VentasPage() {
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

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[1100px] md:gap-8 md:px-6 md:py-8">
          <div>
            <h1 className="text-2xl font-semibold">Mis ventas</h1>
            <p className="text-sm text-zinc-500">
              Resumen de ventas totales y detalle por tipo de contenido.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Ventas totales</div>
              <div className="mt-2 text-2xl font-semibold">
                ${totals.totalSales.toFixed(2)}
              </div>
            </div>
            <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
              <div className="text-xs text-zinc-500">Comision (30%)</div>
              <div className="mt-2 text-2xl font-semibold">
                ${totals.platform.toFixed(2)}
              </div>
            </div>
            <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-5">
              <div className="text-xs text-emerald-700">Tu ganancia (70%)</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-900">
                ${totals.creator.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="rounded-[5px] border border-zinc-200 bg-white">
            <div className="grid grid-cols-8 border-b border-zinc-200 px-4 py-3 text-xs font-semibold text-zinc-500">
              <span>Tipo</span>
              <span className="col-span-2">Contenido</span>
              <span>Comprador</span>
              <span className="text-right">Ventas</span>
              <span className="text-right">Total</span>
              <span className="col-span-2 text-right">Desglose</span>
            </div>
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="grid grid-cols-8 items-center px-4 py-3 text-sm text-zinc-700"
              >
                <span>{sale.type}</span>
                <span className="col-span-2">{sale.title}</span>
                <a
                  href={`/perfil?user=${encodeURIComponent(
                    sale.buyer.name,
                  )}&full=${encodeURIComponent(
                    sale.buyer.full,
                  )}&avatar=${encodeURIComponent(sale.buyer.avatar)}`}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  {sale.buyer.name}
                </a>
                <span className="text-right">{sale.count}</span>
                <span className="text-right font-semibold">
                  ${sale.total.toFixed(2)}
                </span>
                <span className="col-span-2 text-right text-xs text-zinc-500">
                  ${(sale.total * 0.7).toFixed(2)} (70%) · $
                  {(sale.total * 0.3).toFixed(2)} (30%)
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-emerald-900">
                  Retirar fondos con MercadoPago
                </div>
                <div className="text-xs text-emerald-700">
                  Transferi tus ganancias a tu cuenta en segundos.
                </div>
              </div>
              <button className="rounded-[8px] bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                Retirar ahora
              </button>
            </div>
          </div>

          <div className="rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
            Recibes el 70% de cada venta. La plataforma retiene el 30% en
            concepto de comision.
          </div>
        </div>
      </div>
    </div>
  );
}
