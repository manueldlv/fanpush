"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Image as ImageIcon, Lock, X } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import { getSupabaseClient } from "@/lib/supabase";

type PurchaseItem = {
  id: string;
  title: string;
  creator: string;
  date: string;
  price: number;
  cover: string;
  covers: string[];
  media: { url: string; kind: "image" | "video" }[];
  status: string;
};

export default function ComprasPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [openPurchase, setOpenPurchase] = useState<PurchaseItem | null>(null);
  const [openIndex, setOpenIndex] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) return;

        const { data: purchaseRows } = await supabase
          .from("purchases")
          .select("id,post_id,amount,status,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        const postIds = Array.from(
          new Set((purchaseRows ?? []).map((row) => row.post_id)),
        );
        const { data: postRows } = postIds.length
          ? await supabase
              .from("posts")
              .select(
                "id,user_id,media_url,is_locked,caption,album_posts(album_id)",
              )
              .in("id", postIds)
          : { data: [] };

        const creatorIds = Array.from(
          new Set((postRows ?? []).map((row) => row.user_id)),
        );
        const { data: creators } = creatorIds.length
          ? await supabase
              .from("users")
              .select("id,username,avatar_url")
              .in("id", creatorIds)
          : { data: [] };

        const creatorMap = new Map(
          (creators ?? []).map((row) => [row.id, row.username ?? "usuario"]),
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
              .select(
                "id,description,price,album_posts(post:posts(media_url,media_type))",
              )
              .in("id", albumIds)
          : { data: [] };
        const albumMap = new Map(
          (albumRows ?? []).map((row) => [row.id, row]),
        );

        const resolveCover = (value: string | null) => {
          if (!value) return "https://picsum.photos/seed/placeholder/600/600";
          if (value.startsWith("http")) return value;
          const { data: publicUrl } = supabase.storage
            .from("Imagenes")
            .getPublicUrl(value);
          return publicUrl.publicUrl;
        };

        const albumEntries = new Map<string, PurchaseItem>();
        (purchaseRows ?? []).forEach((row) => {
          const post = postMap.get(row.post_id);
          const albumId = post?.album_posts?.[0]?.album_id ?? row.post_id;
          const album = albumMap.get(albumId);
          const albumCovers = (album?.album_posts ?? [])
            .map((item: any) =>
              (item?.post?.media_url ?? item?.media_url ?? "") as string,
            )
            .filter(Boolean)
            .map((value) => resolveCover(value));
          const albumMedia = (album?.album_posts ?? [])
            .map((item: any) => ({
              url: resolveCover(item?.post?.media_url ?? item?.media_url ?? null),
              kind:
                (item?.post?.media_type ?? item?.media_type) === "video"
                  ? "video"
                  : "image",
            }))
            .filter((item) => item.url);
          const current = albumEntries.get(albumId);
          const date = new Date(row.created_at).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
          });
          const fallbackCover = resolveCover(post?.media_url ?? null);
          const base: PurchaseItem = current ?? {
            id: albumId,
            title: album?.description || post?.caption || "Publicación",
            creator: creatorMap.get(post?.user_id ?? "") ?? "usuario",
            date,
            price: album?.price ? Number(album.price) : 0,
            cover: albumCovers[0] ?? fallbackCover,
            covers: albumCovers.length > 0 ? albumCovers : [fallbackCover],
            media:
              albumMedia.length > 0
                ? albumMedia
                : [
                    {
                      url: fallbackCover,
                      kind: "image",
                    },
                  ],
            status: row.status ?? "Desbloqueado",
          };

          albumEntries.set(albumId, {
            ...base,
            date: base.date || date,
            price:
              album?.price && Number(album.price) > 0
                ? Number(album.price)
                : base.price + Number(row.amount || 0),
          });
        });

        const mapped: PurchaseItem[] = Array.from(albumEntries.values());

        setItems(mapped);
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

  const handleDownload = async (purchase: PurchaseItem) => {
    if (downloadingId) return;
    setDownloadingId(purchase.id);
    try {
      const zip = new JSZip();
      const files = purchase.media.length > 0 ? purchase.media : purchase.covers.map((url) => ({ url, kind: "image" as const }));
      await Promise.all(
        files.map(async (item, index) => {
          const response = await fetch(item.url);
          const blob = await response.blob();
          const ext = item.kind === "video" ? "mp4" : "jpg";
          zip.file(
            `fanpush-${purchase.id}-${index + 1}.${ext}`,
            blob,
          );
        }),
      );
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `fanpush-${purchase.id}.zip`);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadingId(null);
    }
  };

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
      {openPurchase ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6">
          <div
            className="absolute inset-0 h-full w-full"
            onClick={() => setOpenPurchase(null)}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => setOpenPurchase(null)}
            className="absolute right-6 top-6 rounded-[5px] bg-white/90 p-2"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative z-10 flex w-full max-w-[900px] overflow-hidden rounded-[5px] bg-black">
            <div className="relative h-[520px] w-full bg-black">
              {openPurchase.media[openIndex]?.kind === "video" ? (
                <video
                  src={openPurchase.media[openIndex]?.url}
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                />
              ) : (
                <img
                  src={openPurchase.media[openIndex]?.url}
                  alt={openPurchase.title}
                  className="h-full w-full object-contain"
                />
              )}
              {openPurchase.media.length > 1 ? (
                <>
                  <div className="absolute inset-y-0 left-0 z-20 flex items-center pl-3">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenIndex((prev) =>
                          (prev - 1 + openPurchase.media.length) %
                          openPurchase.media.length,
                        )
                      }
                      className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
                    >
                      ‹
                    </button>
                  </div>
                  <div className="absolute inset-y-0 right-0 z-20 flex items-center pr-3">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenIndex((prev) =>
                          (prev + 1) % openPurchase.media.length,
                        )
                      }
                      className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
                    >
                      ›
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[1100px] md:gap-8 md:px-6 md:py-8">
          <div>
            <h1 className="text-2xl font-semibold">Mis compras</h1>
            <p className="text-sm text-zinc-500">
              Contenido adquirido y packs desbloqueados.
            </p>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="rounded-[5px] border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                Cargando compras...
              </div>
            ) : null}
            {!loading && items.length === 0 ? (
              <div className="rounded-[5px] border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                Aún no tienes compras.
              </div>
            ) : null}
            {items.map((purchase) => (
              <div
                key={purchase.id}
                className="flex flex-col gap-4 rounded-[5px] border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
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
                    {purchase.covers.length > 1 ? (
                      <div className="flex gap-1">
                        {purchase.covers.slice(1, 3).map((cover, index) => (
                          <img
                            key={`${purchase.id}-thumb-${index}`}
                            src={cover}
                            alt={purchase.title}
                            className="h-10 w-10 rounded-[5px] object-cover"
                          />
                        ))}
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
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPurchase(purchase);
                      setOpenIndex(0);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-[5px] border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Ver foto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(purchase)}
                    className="inline-flex items-center justify-center gap-2 rounded-[5px] border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={downloadingId === purchase.id}
                  >
                    <Download className="h-4 w-4" />
                    {downloadingId === purchase.id ? "Descargando..." : "Descargar"}
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
