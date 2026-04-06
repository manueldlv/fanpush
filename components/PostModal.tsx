"use client";

import { useEffect, useState } from "react";
import { Lock, MoreHorizontal, Unlock, X, Zap } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { getSessionAccessTokenWithRetry } from "@/lib/auth";
import {
  applyResolvedMediaAccess,
  type ResolvedAccessMedia,
} from "@/lib/postMediaState";
import { getSupabaseClient } from "@/lib/supabase";
import type { Post } from "@/lib/store/posts";
import { formatARS } from "@/lib/utils";

type PostModalProps = {
  post: Post;
  onClose: () => void;
  currentUserId?: string | null;
  onDelete?: (postId: string) => void | Promise<void>;
  onPurchase?: (postId: string) => void | boolean | Promise<void | boolean>;
  onTip?: (post: Post) => void;
};

export default function PostModal({
  post,
  onClose,
  currentUserId,
  onDelete,
  onPurchase,
  onTip,
}: PostModalProps) {
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [showPurchaseToast, setShowPurchaseToast] = useState(false);
  const [showUnlockedChip, setShowUnlockedChip] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState(post.media);
  const lockedCount = resolvedMedia.filter((m) => m.locked).length;
  const current = resolvedMedia[index] ?? resolvedMedia[0];
  const isOwner =
    Boolean(post.userId) &&
    Boolean(currentUserId) &&
    post.userId === currentUserId;
  const hasPaidContent = post.media.some(
    (item) => item.locked || !item.hasAccess,
  );
  const isPaidPost = Number(post.price ?? 0) > 0 || hasPaidContent;
  const showUnlockedStatus = !isOwner && hasPaidContent && lockedCount === 0;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    setIndex(0);
    setMenuOpen(false);
    setConfirmDelete(false);
    setPurchaseLoading(false);
    setShowPurchaseToast(false);
    setShowUnlockedChip(false);
    setResolvedMedia(post.media);
  }, [post.id, post.media]);

  const fetchResolvedMedia = async (forceRetry = false) => {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId || post.mediaPostIds.length === 0)
      return null;

    const needsResolution = post.media.some(
      (item) => item.locked && (!item.accessResolved || forceRetry),
    );
    if (!needsResolution) return post.media;

    const accessToken = await getSessionAccessTokenWithRetry(supabase, {
      forceRetry,
    });
    if (!accessToken) return null;

    const response = await fetch("/api/media/access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ postIds: post.mediaPostIds }),
    });

    if (!response.ok) return null;
    const result = (await response.json()) as {
      items?: Record<string, ResolvedAccessMedia>;
    };
    const resolvedItems = result.items ?? {};

    return post.media.map((item, mediaIndex) => {
      const postId = post.mediaPostIds[mediaIndex];
      const resolved = postId ? resolvedItems[postId] : null;
      return applyResolvedMediaAccess(item, resolved);
    });
  };

  useEffect(() => {
    let cancelled = false;

    const resolvePremiumMedia = async () => {
      const nextMedia = await fetchResolvedMedia(false);
      if (!nextMedia) return;
      if (cancelled) return;
      setResolvedMedia(nextMedia);
    };

    resolvePremiumMedia();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, post.id, post.media, post.mediaPostIds]);

  useEffect(() => {
    if (!showPurchaseToast) return;
    const timeout = window.setTimeout(() => {
      setShowPurchaseToast(false);
      setShowUnlockedChip(true);
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [showPurchaseToast]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 md:p-6">
      <div
        className="absolute inset-0 h-full w-full"
        onClick={onClose}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-[8px] bg-white/90 p-2 cursor-pointer md:right-6 md:top-6"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-[16px] bg-white md:max-h-none md:flex-row md:rounded-[5px]">
        <div className="relative h-[42vh] bg-black md:h-[680px] md:flex-1">
          {current?.kind === "image" ? (
            <img
              src={current.url}
              alt={post.author}
              className={`h-full w-full object-contain ${
                current.locked ? "blur-[10px]" : ""
              }`}
              style={{ filter: current.locked ? "blur(10px)" : "none" }}
            />
          ) : (
            <video
              src={current?.url}
              className={`h-full w-full object-contain ${
                current?.locked ? "blur-[10px]" : ""
              }`}
              muted
              playsInline
              style={{ filter: current?.locked ? "blur(10px)" : "none" }}
            />
          )}

          {post.media.length > 1 ? (
            <div className="absolute inset-y-0 left-0 z-20 flex items-center pl-2 md:pl-3">
              <button
                type="button"
                onClick={() =>
                  setIndex(
                    (prev) =>
                      (prev - 1 + post.media.length) % post.media.length,
                  )
                }
                className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700 cursor-pointer"
              >
                ‹
              </button>
            </div>
          ) : null}
          {post.media.length > 1 ? (
            <div className="absolute inset-y-0 right-0 z-20 flex items-center pr-2 md:pr-3">
              <button
                type="button"
                onClick={() =>
                  setIndex((prev) => (prev + 1) % post.media.length)
                }
                className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700 cursor-pointer"
              >
                ›
              </button>
            </div>
          ) : null}

          {lockedCount > 0 ? (
            <div className="absolute right-4 top-4 z-20 rounded-[5px] bg-white/90 px-3 py-1 text-xs font-semibold text-zinc-700">
              <span className="inline-flex items-center gap-2">
                <Lock className="h-3 w-3" />
                {lockedCount} locked
              </span>
            </div>
          ) : null}
          {showUnlockedChip && lockedCount === 0 ? (
            <div className="absolute right-4 top-4 z-20 rounded-[5px] bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white">
              <span className="inline-flex items-center gap-2">
                <Unlock className="h-3 w-3" />
                Comprado
              </span>
            </div>
          ) : null}
          {showUnlockedStatus && !showUnlockedChip ? (
            <div className="absolute right-4 top-4 z-20 rounded-[5px] bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white">
              <span className="inline-flex items-center gap-2">
                <Unlock className="h-3 w-3" />
                Comprado
              </span>
            </div>
          ) : null}
          {current?.locked && !isOwner ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="w-full max-w-[260px] rounded-[14px] bg-white/95 px-6 py-5 text-center shadow-md md:px-8 md:py-6">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] bg-zinc-100">
                  <Lock className="h-5 w-5 text-zinc-600" />
                </div>
                <div className="mt-3 text-sm font-semibold text-zinc-900">
                  Desbloquear post completo
                </div>
                <div className="text-xs text-zinc-500">
                  {lockedCount} contenido bloqueado
                </div>
                <div className="mt-4 rounded-[10px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-left">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Pago único
                  </div>
                  <div className="mt-1 text-center text-[18px] font-semibold text-zinc-900">
                    {formatARS(post.price ?? 0)}
                  </div>
                </div>
                {!isOwner ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!onPurchase || purchaseLoading) return;
                      setPurchaseLoading(true);
                      const result = await onPurchase(post.id);
                      if (result !== false) {
                        const nextMedia = await fetchResolvedMedia(true);
                        if (nextMedia) {
                          setResolvedMedia(nextMedia);
                        }
                        setShowPurchaseToast(true);
                      }
                      setPurchaseLoading(false);
                    }}
                    className="mt-3 w-full rounded-[10px] bg-blue-600 px-6 py-2 text-sm font-semibold text-white cursor-pointer"
                  >
                    {purchaseLoading ? "Procesando..." : "Comprar"}
                  </button>
                ) : (
                  <div className="mt-3 rounded-[10px] border border-zinc-200 bg-zinc-100 px-6 py-2 text-sm font-semibold text-zinc-700">
                    Contenido propio
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {showPurchaseToast ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-[5px] bg-white/95 px-6 py-4 text-center shadow-md">
                <div className="text-sm font-semibold text-zinc-900">
                  Compra realizada
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Ahora puedes ver el contenido completo.
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative w-full overflow-y-auto border-t border-zinc-200 bg-white p-4 md:w-[380px] md:border-l md:border-t-0 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <UserAvatar src={post.avatar} alt={post.author} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[15px] font-semibold text-zinc-900">
                    {post.author}
                  </div>
                  {isPaidPost ? (
                    <div className="rounded-full bg-zinc-950 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                      Post pago
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => (isOwner ? !prev : false))}
              className="rounded-[8px] border border-zinc-200 px-2 py-1 text-zinc-700"
              aria-label="Opciones"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {post.caption ? (
              <div className="rounded-[14px] bg-zinc-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  Descripción
                </div>
                <div className="mt-1.5 text-[14px] leading-[1.45] text-zinc-700">
                  {post.caption}
                </div>
              </div>
            ) : null}

            {isPaidPost ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-zinc-950 px-3 py-1.5 text-[12px] font-semibold text-white">
                  Pago
                </div>
                <div className="rounded-full bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold text-zinc-700">
                  {formatARS(post.price ?? 0)}
                </div>
              </div>
            ) : null}

            {isPaidPost ? (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-[13px] leading-[1.45] text-amber-950">
                <span className="font-semibold">Contenido pago.</span> Este post
                se desbloquea por {formatARS(post.price ?? 0)}.
              </div>
            ) : null}
          </div>

          {menuOpen && isOwner ? (
            <div className="absolute right-6 top-14 z-10 w-52 overflow-hidden rounded-[10px] border border-zinc-200 bg-white shadow-lg">
              {post.userId && currentUserId && post.userId === currentUserId ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Eliminar publicación
                </button>
              ) : null}
            </div>
          ) : null}

          {lockedCount > 0 && !isOwner ? (
            <div className="mt-6 rounded-[14px] border border-zinc-200 p-4 shadow-sm">
              <div className="text-[15px] font-semibold text-zinc-900">
                Desbloquear post completo
              </div>
              <div className="mt-2 text-[13px] text-zinc-500">
                {lockedCount} contenido bloqueado
              </div>
              {!isOwner ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!onPurchase || purchaseLoading) return;
                    setPurchaseLoading(true);
                    const result = await onPurchase(post.id);
                    if (result !== false) {
                      const nextMedia = await fetchResolvedMedia(true);
                      if (nextMedia) {
                        setResolvedMedia(nextMedia);
                      }
                      setShowPurchaseToast(true);
                    }
                    setPurchaseLoading(false);
                  }}
                  className="mt-4 w-full rounded-[10px] bg-zinc-900 px-4 py-3 text-[15px] font-semibold text-white"
                >
                  {purchaseLoading
                    ? "Procesando..."
                    : `Desbloquear por ${formatARS(post.price ?? 0)}`}
                </button>
              ) : (
                <div className="mt-4 rounded-[10px] bg-zinc-900 px-4 py-3 text-center text-[15px] font-semibold text-white">
                  {formatARS(post.price ?? 0)}
                </div>
              )}
            </div>
          ) : null}

          {!isOwner && onTip && post.tipEnabled ? (
            <button
              type="button"
              onClick={() => onTip(post)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-amber-300 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-amber-200"
            >
              <Zap className="h-4 w-4" />
              Enviar propina
            </button>
          ) : null}
        </div>
      </div>

      {confirmDelete ? (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[360px] rounded-[18px] bg-white p-5 shadow-2xl">
            <div className="text-[18px] font-semibold text-zinc-900">
              ¿Eliminar publicación?
            </div>
            <p className="mt-2 text-[14px] leading-6 text-zinc-500">
              Esta acción elimina el post de tu perfil y no se puede deshacer.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-[12px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!onDelete) {
                    setConfirmDelete(false);
                    return;
                  }
                  await onDelete(post.id);
                  setConfirmDelete(false);
                  onClose();
                }}
                className="flex-1 rounded-[12px] bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
