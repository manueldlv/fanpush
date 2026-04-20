"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, Heart, Lock, MoreHorizontal, Send, Unlock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import { getSessionAccessTokenWithRetry } from "@/lib/auth";
import { buildPostSharePath } from "@/lib/postShare";
import { buildUserProfileHref } from "@/lib/profileRoute";
import {
  applyResolvedMediaAccess,
  type ResolvedAccessMedia,
} from "@/lib/postMediaState";
import { getSupabaseClient } from "@/lib/supabase";
import type { Post } from "@/lib/store/posts";
import { formatARS } from "@/lib/utils";
import { buildHashtagHref } from "@/lib/hashtags";

const formatUnits = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

function renderCaptionWithHashtags(caption: string) {
  const parts = caption.split(/(#[\p{L}\p{N}_]+)/gu);
  return parts.map((part, index) => {
    if (/^#[\p{L}\p{N}_]+$/u.test(part)) {
      return (
        <Link
          key={`${part}-${index}`}
          href={buildHashtagHref(part)}
          className="font-medium text-[#42a5ff] hover:underline"
        >
          {part}
        </Link>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

type PostModalProps = {
  post: Post;
  onClose: () => void;
  currentUserId?: string | null;
  onDelete?: (postId: string) => void | Promise<void>;
  onPurchase?: (postId: string) => void | boolean | Promise<void | boolean>;
  onTip?: (post: Post) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (post: Post) => void;
  onShare?: (post: Post) => void;
  isLiked?: boolean;
  onLike?: (postId: string) => void | Promise<void>;
  onReport?: (post: Post) => void;
  onUnfollow?: (userId: string) => void | Promise<void>;
  isFollowing?: boolean;
  onToggleFollow?: (userId: string) => void | Promise<void>;
};

export default function PostModal({
  post,
  onClose,
  currentUserId,
  onDelete,
  onPurchase,
  onTip,
  isFavorite = false,
  onToggleFavorite,
  onShare,
  isLiked = false,
  onLike,
  onReport,
  onUnfollow,
  isFollowing = false,
  onToggleFollow,
}: PostModalProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showUnlockedChip, setShowUnlockedChip] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState(post.media);
  const [ownerSalesCount, setOwnerSalesCount] = useState(0);
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
  const videoCount = resolvedMedia.filter((item) => item.kind === "video").length;
  const imageCount = resolvedMedia.filter((item) => item.kind === "image").length;
  const mediaSummary = [
    videoCount > 0 ? `${videoCount} ${videoCount === 1 ? "video" : "videos"}` : null,
    imageCount > 0 ? `${imageCount} ${imageCount === 1 ? "foto" : "fotos"}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const mediaLockedForViewer = Boolean(current?.locked) && !isOwner;
  const ownerSalesGross = ownerSalesCount * Number(post.price ?? 0);
  const showPostActions = !isOwner && (!isPaidPost || lockedCount === 0);

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
    let cancelled = false;

    const loadOwnerSales = async () => {
      if (!isOwner || !isPaidPost) {
        setOwnerSalesCount(0);
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { count } = await supabase
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .eq("album_id", post.id);

      if (!cancelled) {
        setOwnerSalesCount(count ?? 0);
      }
    };

    void loadOwnerSales();

    return () => {
      cancelled = true;
    };
  }, [isOwner, isPaidPost, post.id]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 md:p-6">
      <div
        className="absolute inset-0 h-full w-full"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-[1160px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-[-18px] top-[-26px] z-[130] inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/80 text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-black/90 md:right-[-22px] md:top-[-32px]"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[16px] bg-white md:max-h-none md:flex-row md:rounded-[5px]">
          <div className="relative h-[42vh] bg-black md:h-[680px] md:flex-1">
          {current?.kind === "image" ? (
            <img
              src={current.url}
              alt={post.author}
              className={`h-full w-full object-contain ${
                mediaLockedForViewer ? "blur-[10px]" : ""
              }`}
              style={{ filter: mediaLockedForViewer ? "blur(10px)" : "none" }}
            />
          ) : (
            <video
              src={current?.url}
              className={`h-full w-full object-contain ${
                mediaLockedForViewer ? "blur-[10px]" : ""
              }`}
              muted={mediaLockedForViewer}
              controls={!mediaLockedForViewer}
              autoPlay={!mediaLockedForViewer}
              loop={!mediaLockedForViewer}
              preload="metadata"
              playsInline
              style={{ filter: mediaLockedForViewer ? "blur(10px)" : "none" }}
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
          {isOwner && isPaidPost ? (
            <div className="absolute right-4 top-4 z-20 rounded-[5px] bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-900 shadow-sm">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                {Math.round(Number(post.price ?? 0)).toLocaleString("es-AR")}
              </span>
            </div>
          ) : null}
          {mediaLockedForViewer ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
              <div className="w-full max-w-[460px] rounded-[14px] bg-white/96 px-8 py-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-[2px]">
                <div className="mx-auto flex h-[82px] w-[82px] items-center justify-center rounded-[10px] bg-[#f4f1ff]">
                  <Lock className="h-9 w-9 text-[#5A3EE7]" />
                </div>
                <div className="mt-4 text-[18px] font-bold leading-[1.08] tracking-[-0.03em] text-[#161823]">
                  Desbloqueá
                  <br />
                  el contenido completo
                </div>
                <div className="mt-2.5 text-[14px] font-medium leading-none text-[#7a7a7a]">
                  {mediaSummary}
                </div>
                <div className="mt-3 text-[30px] font-bold leading-none tracking-[-0.04em] text-[#5A3EE7]">
                  ${formatUnits(post.price ?? 0)}
                </div>
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
                      setShowUnlockedChip(true);
                    }
                    setPurchaseLoading(false);
                  }}
                  className="mt-5 min-w-[260px] rounded-[5px] bg-[#5A3EE7] px-6 py-3 text-[14px] font-bold text-white"
                >
                  {purchaseLoading ? "Procesando..." : "Comprar"}
                </button>
              </div>
            </div>
          ) : null}
          {post.media.length > 1 ? (
            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#171717] px-4 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.24)]">
                {post.media.map((_, mediaIndex) => (
                  <button
                    key={`media-dot-${mediaIndex}`}
                    type="button"
                    onClick={() => setIndex(mediaIndex)}
                    aria-label={`Ir al archivo ${mediaIndex + 1}`}
                    className={`h-[10px] w-[10px] rounded-full transition ${
                      mediaIndex === index ? "bg-white" : "bg-[#5f5f5f]"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : null}
          </div>

          <div className="relative w-full overflow-y-auto border-t border-zinc-200 bg-white p-4 md:w-[390px] md:border-l md:border-t-0 md:p-0">
            <div className="border-b border-[#E0E0E0] px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar src={post.avatar} alt={post.author} />
                <div className="min-w-0 text-[15px] font-semibold text-zinc-900">
                  {post.author}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {!isOwner ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!post.userId || followLoading) return;
                      setFollowLoading(true);
                      try {
                        await onToggleFollow?.(post.userId);
                      } finally {
                        setFollowLoading(false);
                      }
                    }}
                    disabled={followLoading}
                    className="text-[14px] font-semibold text-[#5A3EE7] disabled:opacity-60"
                  >
                    {isFollowing ? "Siguiendo" : "Seguir"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="rounded-[8px] px-1 py-1 text-zinc-700"
                  aria-label="Opciones"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="flex items-start gap-3">
              <UserAvatar src={post.avatar} alt={post.author} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[15px] font-semibold text-zinc-900">
                    {post.author}
                  </div>
                  <div className="text-[12px] text-[#9ca3af]">{post.time}</div>
                </div>
                <div className="mt-1 text-[14px] leading-5 text-[#464646]">
                  {renderCaptionWithHashtags(post.caption)}
                </div>
              </div>
            </div>

            {showPostActions ? (
              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-4 text-zinc-900">
                  <button
                    type="button"
                    className="flex items-center gap-2"
                    onClick={() => onLike?.(post.id)}
                    aria-label="Me gusta"
                  >
                    <Heart
                      className={`h-6 w-6 ${
                        isLiked ? "fill-[#ff334b] text-[#ff334b]" : "fill-none text-zinc-900"
                      }`}
                    />
                    <span className="text-[15px] font-semibold text-zinc-900">
                      {post.likes}
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-4 text-zinc-900">
                  <button
                    type="button"
                    aria-label="Compartir"
                    onClick={() => onShare?.(post)}
                  >
                    <Send className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    aria-label="Guardar"
                    onClick={() => onToggleFavorite?.(post)}
                  >
                    <Bookmark
                      className={`h-6 w-6 ${
                        isFavorite ? "fill-[#5A3EE7] text-[#5A3EE7]" : "text-zinc-900"
                      }`}
                    />
                  </button>
                </div>
              </div>
            ) : null}

            {!isOwner && onTip && post.tipEnabled ? (
              <button
                type="button"
                onClick={() => onTip(post)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[5px] bg-[#f3f3f3] px-4 py-3 text-[13px] font-semibold text-[#464646] transition hover:bg-[#ebebeb]"
              >
                <img
                  src="/tip-lightning.png"
                  alt=""
                  aria-hidden="true"
                  className="h-4 w-4 object-contain"
                />
                Enviar propina
              </button>
            ) : null}

            {!isOwner && isPaidPost ? (
              <div className="mt-4 flex items-center justify-between rounded-[5px] border border-[#E0E0E0] bg-[#fafafa] px-4 py-3">
                <div>
                  <div className="text-[12px] font-medium text-[#7a7a7a]">
                    Precio del post
                  </div>
                  <div className="mt-1 text-[18px] font-bold leading-none text-[#161823]">
                    {formatARS(Number(post.price ?? 0))}
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-zinc-900 shadow-sm">
                  <Lock className="h-3.5 w-3.5" />
                  Pago
                </div>
              </div>
            ) : null}

            {isOwner && isPaidPost ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-[5px] bg-[#ede9ff] px-4 py-3 text-[13px] font-semibold text-[#5A3EE7]">
                  Este post es tuyo y lo estás vendiendo en ${formatUnits(post.price ?? 0)}
                </div>

                <div className="flex items-center justify-between rounded-[5px] border border-[#E0E0E0] bg-[#fafafa] px-4 py-3">
                  <div>
                    <div className="text-[12px] font-medium text-[#7a7a7a]">
                      Total vendido
                    </div>
                    <div className="mt-1 text-[22px] font-bold leading-none text-[#161823]">
                      {formatARS(ownerSalesGross)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-medium text-[#7a7a7a]">
                      Compras
                    </div>
                    <div className="mt-1 text-[18px] font-semibold leading-none text-[#161823]">
                      {ownerSalesCount}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            </div>

          </div>
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-[108] flex items-center justify-center bg-black/50 px-6 py-10">
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Cerrar menu"
          />
          <div className="relative w-full max-w-[520px] overflow-hidden rounded-[18px] bg-white shadow-xl">
            {!isOwner ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onReport?.(post);
                    setMenuOpen(false);
                  }}
                  className="w-full border-b border-zinc-200 py-4 text-center text-sm font-semibold text-red-600"
                >
                  Denunciar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!post.userId) {
                      setMenuOpen(false);
                      return;
                    }
                    if (followLoading) return;
                    setFollowLoading(true);
                    try {
                      if (isFollowing) {
                        await onUnfollow?.(post.userId);
                      } else {
                        await onToggleFollow?.(post.userId);
                      }
                    } finally {
                      setFollowLoading(false);
                    }
                    setMenuOpen(false);
                  }}
                  className="w-full border-b border-zinc-200 py-4 text-center text-sm font-semibold text-red-600"
                >
                  {isFollowing ? "Dejar de seguir" : "Seguir"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleFavorite?.(post);
                    setMenuOpen(false);
                  }}
                  className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
                >
                  {isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    router.push(buildPostSharePath(post));
                    setMenuOpen(false);
                    onClose();
                  }}
                  className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
                >
                  Ir a la publicación
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onShare?.(post);
                    setMenuOpen(false);
                  }}
                  className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
                >
                  Compartir
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
                className="w-full border-b border-zinc-200 py-4 text-center text-sm font-semibold text-red-600"
              >
                Eliminar publicacion
              </button>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="w-full py-4 text-center text-sm font-medium text-zinc-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

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
