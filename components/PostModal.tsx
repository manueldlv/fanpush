"use client";

import { useEffect, useState } from "react";
import { Lock, MoreHorizontal, Unlock, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { getSessionAccessTokenWithRetry } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import type { Post } from "@/lib/store";
import { formatARS } from "@/lib/utils";

type PostModalProps = {
  post: Post;
  onClose: () => void;
  currentUserId?: string | null;
  onDelete?: (postId: string) => void | Promise<void>;
  onPurchase?: (postId: string) => void | boolean | Promise<void | boolean>;
};

export default function PostModal({
  post,
  onClose,
  currentUserId,
  onDelete,
  onPurchase,
}: PostModalProps) {
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [showPurchaseToast, setShowPurchaseToast] = useState(false);
  const [showUnlockedChip, setShowUnlockedChip] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState(post.media);
  const lockedCount = resolvedMedia.filter((m) => m.locked).length;
  const current = resolvedMedia[index];
  const isOwner =
    Boolean(post.userId) && Boolean(currentUserId) && post.userId === currentUserId;
  const unlockedMedia = purchased
    ? resolvedMedia.map((item) => ({ ...item, locked: false }))
    : resolvedMedia;
  const unlockedLockedCount = unlockedMedia.filter((m) => m.locked).length;
  const unlockedCurrent = unlockedMedia[index];
  const hasPaidContent = lockedCount > 0;
  const showUnlockedStatus =
    !isOwner && hasPaidContent && unlockedLockedCount === 0;

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
    setPurchased(false);
    setPurchaseLoading(false);
    setShowPurchaseToast(false);
    setShowUnlockedChip(false);
    setResolvedMedia(post.media);
  }, [post.id]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId || post.mediaPostIds.length === 0) return;

    const needsResolution = post.media.some(
      (item) => item.locked || item.url.includes("locked-previews/"),
    );
    if (!needsResolution) return;

    let cancelled = false;

    const resolvePremiumMedia = async () => {
      const accessToken = await getSessionAccessTokenWithRetry(supabase, {
        forceRetry: true,
      });
      if (!accessToken) return;

      const response = await fetch("/api/media/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ postIds: post.mediaPostIds }),
      });

      if (!response.ok) return;
      const result = (await response.json()) as {
        items?: Record<
          string,
          { url: string; kind: "image" | "video"; locked: boolean }
        >;
      };
      const resolvedItems = result.items ?? {};

      if (cancelled) return;
      setResolvedMedia(
        post.media.map((item, mediaIndex) => {
          const postId = post.mediaPostIds[mediaIndex];
          const resolved = postId ? resolvedItems[postId] : null;
          return resolved
            ? {
                ...item,
                url: resolved.url,
                kind: resolved.kind,
                locked: resolved.locked,
              }
            : item;
        }),
      );
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6">
      <div
        className="absolute inset-0 h-full w-full"
        onClick={onClose}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-6 top-6 rounded-[5px] bg-white/90 p-2"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="relative z-10 flex w-full max-w-[1100px] overflow-hidden rounded-[5px] bg-white">
        <div className="relative flex-1 bg-black h-[520px] md:h-[680px]">
          {unlockedCurrent.kind === "image" ? (
            <img
              src={unlockedCurrent.url}
              alt={post.author}
              className={`h-full w-full object-contain ${
                unlockedCurrent.locked ? "blur-[10px]" : ""
              }`}
              style={{ filter: unlockedCurrent.locked ? "blur(10px)" : "none" }}
            />
          ) : (
            <video
              src={unlockedCurrent.url}
              className={`h-full w-full object-contain ${
                unlockedCurrent.locked ? "blur-[10px]" : ""
              }`}
              muted
              playsInline
              style={{ filter: unlockedCurrent.locked ? "blur(10px)" : "none" }}
            />
          )}

          {post.media.length > 1 ? (
            <div className="absolute inset-y-0 left-0 z-20 flex items-center pl-3">
              <button
                type="button"
                onClick={() =>
                  setIndex((prev) =>
                    (prev - 1 + post.media.length) % post.media.length,
                  )
                }
                className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
              >
                ‹
              </button>
            </div>
          ) : null}
          {post.media.length > 1 ? (
            <div className="absolute inset-y-0 right-0 z-20 flex items-center pr-3">
              <button
                type="button"
                onClick={() =>
                  setIndex((prev) => (prev + 1) % post.media.length)
                }
                className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
              >
                ›
              </button>
            </div>
          ) : null}

          {unlockedLockedCount > 0 ? (
            <div className="absolute right-4 top-4 z-20 rounded-[5px] bg-white/90 px-3 py-1 text-xs font-semibold text-zinc-700">
              <span className="inline-flex items-center gap-2">
                <Lock className="h-3 w-3" />
                {unlockedLockedCount} locked
              </span>
            </div>
          ) : null}
          {showUnlockedChip && unlockedLockedCount === 0 ? (
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
          {unlockedCurrent.locked && !isOwner ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-[5px] bg-white/95 px-8 py-6 text-center shadow-md">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[5px] bg-zinc-100">
                  <Lock className="h-5 w-5 text-zinc-600" />
                </div>
                <div className="mt-3 text-sm font-semibold text-zinc-900">
                  Desbloquear post completo
                </div>
                <div className="text-xs text-zinc-500">
                  {unlockedLockedCount} contenido bloqueado
                </div>
                {!isOwner ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!onPurchase || purchaseLoading) return;
                      setPurchaseLoading(true);
                      const result = await onPurchase(post.id);
                      if (result !== false) {
                        setPurchased(true);
                        setShowPurchaseToast(true);
                      }
                      setPurchaseLoading(false);
                    }}
                    className="mt-3 w-full rounded-[5px] bg-zinc-900 px-6 py-2 text-sm font-semibold text-white"
                  >
                    {purchaseLoading
                      ? "Procesando..."
                      : `Desbloquear por ${formatARS(post.price ?? 0)}`}
                  </button>
                ) : (
                  <div className="mt-3 rounded-[5px] bg-zinc-900 px-6 py-2 text-sm font-semibold text-white">
                    {formatARS(post.price ?? 0)}
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

        <div className="relative w-[360px] border-l border-zinc-200 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <UserAvatar src={post.avatar} alt={post.author} />
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  {post.author}
                </div>
                {post.caption ? (
                  <div className="mt-1 text-xs text-zinc-500">
                    {post.caption}
                  </div>
                ) : null}
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

          {menuOpen && isOwner ? (
            <div className="absolute right-6 top-14 z-10 w-52 overflow-hidden rounded-[10px] border border-zinc-200 bg-white shadow-lg">
              {post.userId && currentUserId && post.userId === currentUserId ? (
                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false);
                    if (!onDelete) return;
                    const confirmDelete = window.confirm(
                      "¿Eliminar esta publicación?",
                    );
                    if (!confirmDelete) return;
                    await onDelete(post.id);
                    onClose();
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Eliminar publicación
                </button>
              ) : null}
            </div>
          ) : null}

          {unlockedLockedCount > 0 && !isOwner ? (
            <div className="mt-6 rounded-[5px] border border-zinc-200 p-4">
              <div className="text-sm font-semibold text-zinc-900">
                Desbloquear post completo
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                {unlockedLockedCount} contenido bloqueado
              </div>
              {!isOwner ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!onPurchase || purchaseLoading) return;
                    setPurchaseLoading(true);
                    const result = await onPurchase(post.id);
                    if (result !== false) {
                      setPurchased(true);
                      setShowPurchaseToast(true);
                    }
                    setPurchaseLoading(false);
                  }}
                  className="mt-4 w-full rounded-[5px] bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  {purchaseLoading
                    ? "Procesando..."
                    : `Desbloquear por ${formatARS(post.price ?? 0)}`}
                </button>
              ) : (
                <div className="mt-4 rounded-[5px] bg-zinc-900 px-4 py-2 text-center text-sm font-semibold text-white">
                  {formatARS(post.price ?? 0)}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
