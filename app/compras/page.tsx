"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Image as ImageIcon,
  Lock,
  X,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Link from "next/link";
import MediaImage from "@/components/MediaImage";
import SidebarLeft from "@/components/SidebarLeft";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { useGetPurchasesQuery } from "@/lib/redux/api/commerceApi";
import { formatARS } from "@/lib/utils";

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
  const [openPurchase, setOpenPurchase] = useState<PurchaseItem | null>(null);
  const [openIndex, setOpenIndex] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const {
    data,
    isLoading: loading,
    refetch,
  } = useGetPurchasesQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const items = data?.items ?? [];
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const refreshPurchases = () => {
      void refetch();
    };
    window.addEventListener("purchases-updated", refreshPurchases);
    window.addEventListener("balance-updated", refreshPurchases);
    return () => {
      window.removeEventListener("purchases-updated", refreshPurchases);
      window.removeEventListener("balance-updated", refreshPurchases);
    };
  }, [refetch]);

  const displayItems = useMemo(() => items, [items]);

  const totalSpent = useMemo(
    () => displayItems.reduce((acc, item) => acc + item.price, 0),
    [displayItems],
  );
  const totalPages = Math.max(1, Math.ceil(displayItems.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(
    () =>
      displayItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [displayItems, page],
  );
  const rangeStart =
    displayItems.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * ITEMS_PER_PAGE, displayItems.length);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

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

  const renderThumbGrid = (purchase: PurchaseItem) => {
    const thumbItems =
      purchase.covers.length > 0 ? purchase.covers : [purchase.cover];
    const visibleThumbs = thumbItems.slice(0, 10);
    const extraCount = Math.max(thumbItems.length - 10, 0);
    const thumbCount = visibleThumbs.length || 1;

    const layout =
      thumbCount === 1
        ? { columns: 1, rows: 1 }
        : thumbCount === 2
          ? { columns: 2, rows: 1 }
          : thumbCount === 4
            ? { columns: 2, rows: 2 }
            : thumbCount <= 5
              ? { columns: thumbCount, rows: 1 }
              : { columns: Math.ceil(thumbCount / 2), rows: 2 };

    const remainder =
      layout.rows > 1 ? thumbCount % layout.columns : 0;
    const finalItemSpan =
      layout.rows > 1 && remainder !== 0 ? layout.columns - remainder + 1 : 1;

    return (
      <div
        className="relative grid h-[88px] w-[88px] gap-1 overflow-hidden rounded-[12px] border border-zinc-200 bg-zinc-100 p-1"
        style={{
          gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
        }}
      >
        {visibleThumbs.map((src, index) => {
          const mediaKind = purchase.media[index]?.kind ?? "image";
          const isLastVisible = index === visibleThumbs.length - 1;
          const shouldSpan =
            isLastVisible && finalItemSpan > 1;
          return (
            <div
              key={`${purchase.id}-thumb-${index}-${src}`}
              className="relative overflow-hidden rounded-[8px] bg-zinc-100"
              style={shouldSpan ? { gridColumn: `span ${finalItemSpan}` } : undefined}
            >
              <MediaImage
                src={src}
                alt={purchase.title}
                className="h-full w-full object-cover"
                fallbackClassName="h-full w-full"
                iconClassName="h-4 w-4"
              />
              {mediaKind === "video" ? (
                <div className="absolute bottom-1 right-1 rounded-full bg-black/65 p-1 text-white">
                  <Film className="h-3 w-3" />
                </div>
              ) : null}
              {extraCount > 0 && isLastVisible ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
                  +{extraCount}
                </div>
              ) : null}
            </div>
          );
        })}
        {purchase.status === "Pendiente" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
            <Lock className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SidebarLeft />
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
                <MediaImage
                  src={openPurchase.media[openIndex]?.url}
                  alt={openPurchase.title}
                  className="h-full w-full object-contain"
                  fallbackClassName="h-full w-full bg-zinc-950 text-zinc-500"
                  iconClassName="h-8 w-8"
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

      <div className="flex min-h-screen md:pl-60">
        <div className="mx-auto flex w-full max-w-none flex-col gap-5 px-4 py-5 pb-24 md:max-w-[1120px] md:gap-6 md:px-6 md:py-6">
          <div>
            <h1 className="text-2xl font-semibold">Mis compras</h1>
            <p className="text-sm text-zinc-500">
              Contenido adquirido y packs desbloqueados.
            </p>
          </div>

          {!loading && displayItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-[12px] border border-zinc-200 bg-white p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  Publicaciones compradas
                </div>
                <div className="mt-2 text-xl font-semibold text-zinc-900">
                  {displayItems.length}
                </div>
              </div>
              <div className="rounded-[12px] border border-zinc-200 bg-white p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  Invertido en contenido
                </div>
                <div className="mt-2 text-xl font-semibold text-zinc-900">
                  {formatARS(totalSpent)}
                </div>
              </div>
              <div className="rounded-[12px] border border-zinc-200 bg-white p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  Última compra
                </div>
                <div className="mt-2 text-base font-semibold text-zinc-900">
                  {displayItems[0]?.date ?? "—"}
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-[5px] border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                Cargando compras...
              </div>
            ) : null}
            {!loading && displayItems.length === 0 ? (
              <div className="rounded-[16px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
                <div className="text-lg font-semibold text-zinc-900">
                  Aún no tienes compras
                </div>
                <p className="mt-2 max-w-[560px] leading-6">
                  Cuando compres contenido bloqueado o envíes propinas, lo verás
                  reflejado aquí con acceso rápido para volver a abrirlo o descargarlo.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="/explorar"
                    className="fanpush-button-primary rounded-[12px] px-4 py-3 text-sm"
                  >
                    Explorar contenido
                  </a>
                  <a
                    href="/ayuda"
                    className="rounded-[12px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700"
                  >
                    Cómo funciona
                  </a>
                </div>
              </div>
            ) : null}
            {!loading && displayItems.length > 0 ? (
              <div className="rounded-[14px] border border-zinc-200 bg-white">
                <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Historial de compras
                    </div>
                    <div className="text-xs text-zinc-500">
                      Mostrando {rangeStart}-{rangeEnd} de {displayItems.length} compras
                    </div>
                  </div>
                  {totalPages > 1 ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page === 1}
                        className="inline-flex items-center gap-1 rounded-[10px] border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </button>
                      <div className="min-w-[88px] text-center text-xs font-semibold text-zinc-600">
                        Página {page} de {totalPages}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPage((current) => Math.min(totalPages, current + 1))
                        }
                        disabled={page === totalPages}
                        className="inline-flex items-center gap-1 rounded-[10px] border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="divide-y divide-zinc-200">
                  {paginatedItems.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex gap-3">
                          <div className="shrink-0">{renderThumbGrid(purchase)}</div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <div className="truncate text-[15px] font-semibold text-zinc-900">
                                {purchase.title}
                              </div>
                              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                                {purchase.media.length} archivo
                                {purchase.media.length === 1 ? "" : "s"}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                {purchase.status}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-zinc-500">
                              <Link
                                href={buildUserProfileHref(purchase.creator)}
                                className="font-medium text-zinc-700 transition hover:text-zinc-900 hover:underline"
                              >
                                @{purchase.creator}
                              </Link>{" "}
                              · {purchase.date}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <span className="text-base font-semibold text-zinc-900">
                                {formatARS(purchase.price)}
                              </span>
                              {purchase.media.length > 5 ? (
                                <span className="text-xs text-zinc-500">
                                  +{purchase.media.length - 5} más en el álbum
                                </span>
                              ) : null}
                            </div>
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
                          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Abrir
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(purchase)}
                          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={downloadingId === purchase.id}
                        >
                          <Download className="h-4 w-4" />
                          {downloadingId === purchase.id
                            ? "Descargando..."
                            : "Descargar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
