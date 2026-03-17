"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import { getSupabaseClient } from "@/lib/supabase";

type SaleItem = {
  id: string;
  type: string;
  title: string;
  count: number;
  total: number;
  buyer: {
    id: string;
    name: string;
    full: string;
    avatar: string | null;
  };
};

export default function VentasPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) return;

        const { data: postRows } = await supabase
          .from("posts")
          .select("id,user_id,media_type,caption,album_posts(album_id)")
          .eq("user_id", userId);
        const postIds = (postRows ?? []).map((row) => row.id);
        if (postIds.length === 0) {
          setSales([]);
          return;
        }

        const { data: purchaseRows } = await supabase
          .from("purchases")
          .select("id,user_id,post_id,amount,created_at")
          .in("post_id", postIds)
          .order("created_at", { ascending: false });

        const buyerIds = Array.from(
          new Set((purchaseRows ?? []).map((row) => row.user_id)),
        );
        const { data: buyers } = buyerIds.length
          ? await supabase
              .from("users")
              .select("id,username,avatar_url")
              .in("id", buyerIds)
          : { data: [] };

        const buyerMap = new Map(
          (buyers ?? []).map((row) => [row.id, row]),
        );
        const postMap = new Map((postRows ?? []).map((row) => [row.id, row]));

        const albumIds = Array.from(
          new Set(
            (postRows ?? [])
              .map((row) => row.album_posts?.[0]?.album_id)
              .filter(Boolean) as string[],
          ),
        );
        const { data: albumRows } = albumIds.length
          ? await supabase
              .from("albums")
              .select("id,description")
              .in("id", albumIds)
          : { data: [] };
        const albumMap = new Map(
          (albumRows ?? []).map((row) => [row.id, row]),
        );
        const { data: albumPostRows } = albumIds.length
          ? await supabase
              .from("album_posts")
              .select("album_id,post_id")
              .in("album_id", albumIds)
          : { data: [] };
        const albumCountMap = new Map<string, number>();
        (albumPostRows ?? []).forEach((row) => {
          const current = albumCountMap.get(row.album_id) ?? 0;
          albumCountMap.set(row.album_id, current + 1);
        });

        const resolveAvatar = (value: string | null) => {
          if (!value) return null;
          if (value.startsWith("http")) return value;
          const { data: publicUrl } = supabase.storage
            .from("Imagenes")
            .getPublicUrl(value);
          return publicUrl.publicUrl;
        };

        const grouped = new Map<string, SaleItem>();
        (purchaseRows ?? []).forEach((row) => {
          const post = postMap.get(row.post_id);
          const buyer = buyerMap.get(row.user_id);
          const albumId = post?.album_posts?.[0]?.album_id ?? row.post_id;
          const album = albumMap.get(albumId);
          const groupKey = `${albumId}-${row.user_id}`;
          const current = grouped.get(groupKey);
          const count =
            albumCountMap.get(albumId) ??
            (post?.media_type ? 1 : 0);
          const type =
            count > 1 ? "Album" : post?.media_type === "video" ? "Video" : "Foto";
          const base: SaleItem = current ?? {
            id: groupKey,
            type,
            title: album?.description || post?.caption || "Publicación",
            count,
            total: 0,
            buyer: {
              id: row.user_id,
              name: buyer?.username ?? "usuario",
              full: buyer?.username ?? "Usuario",
              avatar: resolveAvatar(buyer?.avatar_url ?? null),
            },
          };
          grouped.set(groupKey, {
            ...base,
            total: base.total + Number(row.amount || 0),
          });
        });

        const mapped: SaleItem[] = Array.from(grouped.values());

        setSales(mapped);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("purchases-updated", handler);
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      window.removeEventListener("purchases-updated", handler);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [load]);

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
            {loading ? (
              <div className="px-4 py-4 text-sm text-zinc-500">
                Cargando ventas...
              </div>
            ) : null}
            {!loading && sales.length === 0 ? (
              <div className="px-4 py-4 text-sm text-zinc-500">
                Aún no tienes ventas.
              </div>
            ) : null}
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
                  )}&avatar=${encodeURIComponent(
                    sale.buyer.avatar ?? "",
                  )}`}
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
                  Disponible para retirar: ${totals.creator.toFixed(2)}
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
