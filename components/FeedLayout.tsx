"use client";

import Link from "next/link";
import { Bookmark, Heart, Lock, MoreHorizontal, Send } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import { useEffect, useMemo, useState } from "react";
import PostModal from "@/components/PostModal";
import PurchaseSuccessToast from "@/components/PurchaseSuccessToast";
import SharePostModal from "@/components/SharePostModal";
import TipModal from "@/components/TipModal";
import UserAvatar from "@/components/UserAvatar";
import { runBalanceCheckout } from "@/lib/balanceCheckout";
import { getSessionAccessTokenWithRetry, PURCHASE_REFRESH_FLAG } from "@/lib/auth";
import {
  FAVORITES_UPDATED_EVENT,
  isFavoritePost,
  toggleFavoritePost,
} from "@/lib/favorites";
import {
  getPremiumPathFromPreview,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";
import {
  applyResolvedMediaAccess,
  buildInitialPostMediaState,
  type ResolvedAccessMedia,
} from "@/lib/postMediaState";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { useGetFeedQuery } from "@/lib/redux/api/feedApi";
import { setFeedPosts } from "@/lib/redux/slices/postsSlice";
import { buildPostSharePath } from "@/lib/postShare";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { getSupabaseClient } from "@/lib/supabase";
import type { Post } from "@/lib/store/posts";
import { formatARS } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { buildHashtagHref, extractHashtags } from "@/lib/hashtags";

type AlbumMediaPost = {
  id: string | null;
  media_url: string | null;
  media_type: string | null;
  is_locked: boolean | null;
  likes_count: number | null;
};

type AlbumPostRow = {
  post: AlbumMediaPost | AlbumMediaPost[] | null;
};

type AlbumUser = {
  username: string | null;
  avatar_url: string | null;
};

type AlbumLinkPost = {
  media_url: string | null;
};

type AlbumLinkRow = {
  post_id: string;
  post: AlbumLinkPost | AlbumLinkPost[] | null;
};

const normalizeAlbumMedia = (
  albumPosts: AlbumPostRow[] | null | undefined,
): AlbumMediaPost[] =>
  (albumPosts ?? []).flatMap((item) => {
    if (!item?.post) return [];
    return Array.isArray(item.post) ? item.post : [item.post];
  });

const normalizeSingleRelation = <T,>(
  value: T | T[] | null | undefined,
): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

function renderCaptionWithHashtags(caption: string) {
  const parts = caption.split(/(#[\p{L}\p{N}_]+)/gu);
  return parts.map((part, index) => {
    if (/^#[\p{L}\p{N}_]+$/u.test(part)) {
      return (
        <Link
          key={`${part}-${index}`}
          href={buildHashtagHref(part)}
          className="font-medium text-[#5A3EE7] hover:underline"
        >
          {part}
        </Link>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function FeedHeroSkeleton() {
  return (
    <div className="rounded-[16px] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="fanpush-skeleton h-3 w-20 rounded-full" />
      <div className="mt-3 fanpush-skeleton h-7 w-[68%] rounded-full" />
      <div className="mt-4 space-y-2">
        <div className="fanpush-skeleton h-4 w-full rounded-full" />
        <div className="fanpush-skeleton h-4 w-[92%] rounded-full" />
        <div className="fanpush-skeleton h-4 w-[72%] rounded-full" />
      </div>
      <div className="mt-5 flex gap-3">
        <div className="fanpush-skeleton h-11 w-40 rounded-[12px]" />
        <div className="fanpush-skeleton h-11 w-32 rounded-[12px]" />
      </div>
    </div>
  );
}

function FeedPostSkeleton() {
  return (
    <article className="rounded-[16px] border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="fanpush-skeleton h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <div className="fanpush-skeleton h-4 w-32 rounded-full" />
            <div className="fanpush-skeleton h-3 w-24 rounded-full" />
          </div>
        </div>
        <div className="fanpush-skeleton h-4 w-14 rounded-full" />
      </div>
      <div className="fanpush-skeleton aspect-[4/5] w-full" />
      <div className="px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="fanpush-skeleton h-5 w-5 rounded-full" />
          <div className="fanpush-skeleton h-5 w-5 rounded-full" />
          <div className="fanpush-skeleton h-5 w-5 rounded-full" />
        </div>
        <div className="mt-4 space-y-2">
          <div className="fanpush-skeleton h-4 w-full rounded-full" />
          <div className="fanpush-skeleton h-4 w-[88%] rounded-full" />
          <div className="fanpush-skeleton h-4 w-[54%] rounded-full" />
        </div>
      </div>
    </article>
  );
}

export default function FeedLayout() {
  const dispatch = useAppDispatch();
  const posts = useAppSelector((state) => state.posts.items);
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState<Record<string, number>>({});
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [reportModal, setReportModal] = useState<{
    albumId: string;
    ownerId: string;
    author: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState("Contenido fuera de contexto");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [purchasedPostIds, setPurchasedPostIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [favoritePostIds, setFavoritePostIds] = useState<Set<string>>(new Set());
  const [tipTarget, setTipTarget] = useState<{
    userId: string;
    label: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const viewerBalance = useAppSelector((state) => state.viewer.commerce.balance);
  const {
    data: feedData,
    isLoading: feedLoading,
    error: feedError,
    refetch,
  } = useGetFeedQuery();

  const openPost = posts.find((post) => post.id === selectedPost) ?? null;
  const menuPost = posts.find((post) => post.id === menuPostId) ?? null;

  const resolveAccessibleMedia = async (
    supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
    accessToken: string,
    incomingPosts: Post[],
  ) => {
    const allPostIds = incomingPosts.flatMap((post) => post.mediaPostIds).filter(Boolean);
    if (allPostIds.length === 0) return incomingPosts;

    const response = await fetch("/api/media/access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ postIds: allPostIds }),
    });

    if (!response.ok) return incomingPosts;
    const result = (await response.json()) as {
      items?: Record<string, ResolvedAccessMedia>;
    };

    const resolvedItems = result.items ?? {};
    return incomingPosts.map((post) => ({
      ...post,
      media: post.media.map((item, index): Post["media"][number] => {
        const postId = post.mediaPostIds[index];
        const resolved = postId ? resolvedItems[postId] : null;
        return applyResolvedMediaAccess(item, resolved);
      }),
    }));
  };

  const formatTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Ahora";
    const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMinutes < 60) return `${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} d`;
  };

  const formatFeedLikes = (value: number) => {
    if (value >= 1000) {
      const formatted = (value / 1000).toFixed(1).replace(".", ",");
      return `${formatted} mil`;
    }
    return value.toLocaleString("es-AR");
  };

  useEffect(() => {
    if (!feedData) return;
    setCurrentUserId(feedData.currentUserId);
    setFollowingIds(new Set(feedData.followingIds));
    setLikedPostIds(new Set(feedData.likedPostIds));
    setPurchasedPostIds(new Set(feedData.purchasedPostIds));
    dispatch(setFeedPosts(feedData.posts));
    setLoading(feedLoading);
  }, [dispatch, feedData, feedLoading]);

  useEffect(() => {
    if (!deleteError && !purchaseError && !purchaseSuccess) return;
    const timeout = window.setTimeout(() => {
      setDeleteError(null);
      setPurchaseError(null);
      setPurchaseSuccess(null);
    }, 6500);
    return () => window.clearTimeout(timeout);
  }, [deleteError, purchaseError, purchaseSuccess]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const purchasesHandler = async () => {
      if (!currentUserId) return;
      const allPostIds = posts.flatMap((post) => post.mediaPostIds).filter(Boolean);
      if (allPostIds.length === 0) return;
      const { data: purchaseRows } = await supabase
        .from("purchases")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", allPostIds);
      const purchased = new Set(
        (purchaseRows ?? []).map((row) => row.post_id),
      );
      setPurchasedPostIds(purchased);
      const accessToken = await getSessionAccessTokenWithRetry(supabase);
      if (accessToken) {
        const resolved = await resolveAccessibleMedia(supabase, accessToken, posts);
        dispatch(setFeedPosts(resolved));
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(PURCHASE_REFRESH_FLAG);
        }
      }
    };
    window.addEventListener("purchases-updated", purchasesHandler);
    return () => {
      window.removeEventListener("purchases-updated", purchasesHandler);
    };
  }, [currentUserId, dispatch, posts]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId || purchasedPostIds.size === 0 || posts.length === 0) {
      return;
    }

    const needsRefresh = posts.some((post) =>
      post.mediaPostIds.some((postId, index) => {
        const item = post.media[index];
        return (
          Boolean(postId) &&
          purchasedPostIds.has(postId) &&
          Boolean(item) &&
          item.locked &&
          !item.hasAccess
        );
      }),
    );

    if (!needsRefresh) return;

    let cancelled = false;

    const refreshPurchasedMedia = async () => {
      const accessToken = await getSessionAccessTokenWithRetry(supabase, {
        forceRetry: true,
      });
      if (!accessToken) return;
      const resolved = await resolveAccessibleMedia(supabase, accessToken, posts);
      if (cancelled) return;
      dispatch(setFeedPosts(resolved));
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PURCHASE_REFRESH_FLAG);
      }
    };

    refreshPurchasedMedia();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, dispatch, purchasedPostIds, posts]);

  useEffect(() => {
    if (!menuPostId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuPostId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [menuPostId]);

  useEffect(() => {
    if (!currentUserId) {
      setFavoritePostIds(new Set());
      return;
    }

    const syncFavorites = () => {
      setFavoritePostIds(
        new Set(
          posts
            .filter((post) => isFavoritePost(currentUserId, post.id))
            .map((post) => post.id),
        ),
      );
    };

    syncFavorites();
    window.addEventListener(FAVORITES_UPDATED_EVENT, syncFavorites);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, syncFavorites);
    };
  }, [currentUserId, posts]);

  const toggleFollow = async (userId: string) => {
    if (!currentUserId || userId === currentUserId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const isFollowing = followingIds.has(userId);

    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", userId);
      if (!error) {
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: userId,
      });
      if (!error) {
        setFollowingIds((prev) => new Set(prev).add(userId));
        await supabase.from("notifications").insert({
          user_id: userId,
          actor_id: currentUserId,
          type: "follow",
          entity_id: currentUserId,
          message: "comenzó a seguirte.",
          is_read: false,
        });
      }
    }
  };

  const toggleLike = async (albumId: string) => {
    if (!currentUserId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const post = posts.find((item) => item.id === albumId);
    const postId = post?.mediaPostIds?.[0];
    if (!postId) return;

    const isLiked = likedPostIds.has(postId);
    if (isLiked) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("user_id", currentUserId)
        .eq("post_id", postId);
      if (!error) {
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        dispatch(
          setFeedPosts(
            posts.map((p) =>
              p.id === albumId ? { ...p, likes: Math.max(p.likes - 1, 0) } : p,
            ),
          ),
        );
      }
    } else {
      const { error } = await supabase.from("likes").insert({
        user_id: currentUserId,
        post_id: postId,
      });
      if (!error) {
        setLikedPostIds((prev) => new Set(prev).add(postId));
        dispatch(
          setFeedPosts(
            posts.map((p) => (p.id === albumId ? { ...p, likes: p.likes + 1 } : p)),
          ),
        );
      }
    }
  };

  const handlePurchase = async (albumId: string) => {
    if (!currentUserId) return;
    try {
      await runBalanceCheckout({
        kind: "purchase",
        albumId,
      });
      setPurchaseError(null);
      setPurchaseSuccess(
        "El contenido premium ya quedó habilitado. También lo vas a encontrar en tu panel de compras.",
      );
      window.dispatchEvent(new Event("purchases-updated"));
      window.dispatchEvent(new Event("balance-updated"));
      return true;
    } catch (error) {
      setPurchaseSuccess(null);
      setPurchaseError(
        error instanceof Error
          ? error.message
          : "No se pudo completar la compra con saldo.",
      );
      return false;
    }
  };

  const handleOpenTip = (post: Post) => {
    if (
      !currentUserId ||
      !post.userId ||
      post.userId === currentUserId ||
      !post.tipEnabled
    ) {
      return;
    }
    setTipTarget({
      userId: post.userId,
      label: post.author,
    });
  };

  const handleSharePost = (post: Post) => {
    setSharePost(post);
  };

  const handleToggleFavorite = (post: Post) => {
    if (!currentUserId) return;
    const nextFavoriteState = toggleFavoritePost(currentUserId, post);
    setFavoritePostIds((prev) => {
      const next = new Set(prev);
      if (nextFavoriteState.favorite) next.add(post.id);
      else next.delete(post.id);
      return next;
    });
  };

  const handleDelete = async (albumId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId) return;

    try {
      const { data: links, error: linksError } = await supabase
        .from("album_posts")
        .select("post_id, post:posts(media_url)")
        .eq("album_id", albumId);
      if (linksError) throw linksError;
      const normalizedLinks = (links ?? []) as AlbumLinkRow[];
      const postIds = normalizedLinks.map((row) => row.post_id);
      const mediaPaths = normalizedLinks
        .map((row) => normalizeSingleRelation(row.post)?.media_url)
        .filter(Boolean) as string[];
      const premiumPaths = normalizedLinks
        .map((row) =>
          getPremiumPathFromPreview(
            currentUserId,
            normalizeSingleRelation(row.post)?.media_url,
          ),
        )
        .filter(Boolean) as string[];

      const { error: albumPostsError } = await supabase
        .from("album_posts")
        .delete()
        .eq("album_id", albumId);
      if (albumPostsError) throw albumPostsError;

      if (postIds.length > 0) {
        const { error: postsError } = await supabase
          .from("posts")
          .delete()
          .in("id", postIds)
          .eq("user_id", currentUserId);
        if (postsError) throw postsError;
      }

      if (mediaPaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(PUBLIC_MEDIA_BUCKET)
          .remove(mediaPaths);
        if (storageError) throw storageError;
      }
      if (premiumPaths.length > 0) {
        const { error: premiumError } = await supabase.storage
          .from(PREMIUM_MEDIA_BUCKET)
          .remove(premiumPaths);
        if (premiumError) throw premiumError;
      }

      const { error: albumsError } = await supabase
        .from("albums")
        .delete()
        .eq("id", albumId)
        .eq("user_id", currentUserId);
      if (albumsError) throw albumsError;

      dispatch(setFeedPosts(posts.filter((post) => post.id !== albumId)));
    } catch (err) {
      console.error(err);
      setDeleteError("No se pudo eliminar la publicación. Revisa los permisos.");
    } finally {
      setMenuPostId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleReport = async () => {
    if (!currentUserId || !reportModal?.ownerId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (!reportReason.trim()) {
      setReportError("Escribí un motivo para enviar la denuncia.");
      return;
    }
    setReportError(null);
    setReportSubmitting(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setReportSubmitting(false);
      setReportError("Necesitas iniciar sesión para reportar contenido.");
      return;
    }

    const response = await fetch("/api/reports/content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        albumId: reportModal.albumId,
        ownerId: reportModal.ownerId,
        reason: reportReason.trim(),
      }),
    });

    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setReportSubmitting(false);
      setReportError(result.error ?? "No se pudo enviar el reporte.");
      return;
    }
    setReportSent(true);
    setReportSubmitting(false);
  };

  return (
    <section className="flex w-full max-w-none flex-col gap-6 md:max-w-[630px] md:pr-2">
      {feedError ? (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="text-sm font-semibold text-rose-800">
            No pudimos cargar tu feed ahora mismo
          </div>
          <p className="mt-2 text-sm leading-6 text-rose-700">
            Revisá tu conexión o volvé a intentarlo. Si el problema sigue, podés
            usar Explorar mientras tanto.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-[12px] bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
            >
              Reintentar
            </button>
            <a
              href="/explorar"
              className="rounded-[12px] border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700"
            >
              Ir a explorar
            </a>
          </div>
        </div>
      ) : null}
      {deleteError ? (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="text-sm font-semibold text-rose-700">
            {deleteError}
          </div>
        </div>
      ) : null}
      <PurchaseSuccessToast
        message={purchaseSuccess}
        onClose={() => setPurchaseSuccess(null)}
      />
      {purchaseError ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="text-sm font-semibold text-amber-900">
            {purchaseError}
          </div>
        </div>
      ) : null}
      {loading ? (
        <>
          <FeedHeroSkeleton />
          <FeedPostSkeleton />
          <FeedPostSkeleton />
        </>
      ) : null}
      {!loading && !feedError && posts.length === 0 ? (
        <div className="rounded-[5px] border border-zinc-200 bg-white px-6 py-8">
          <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-zinc-950">
            Aún no hay publicaciones
          </h2>
          <p className="mt-3 max-w-[620px] text-[15px] leading-7 text-[#464646]">
            Todavía no hay publicaciones para mostrar. Si quieres empezar a subir
            contenido y aparecer en el feed, conviértete en autor para publicar
            tus propios posteos dentro del sitio.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/explorar"
              className="inline-flex h-11 items-center justify-center rounded-[5px] border border-zinc-200 px-5 text-[14px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Explorar perfiles
            </Link>
          </div>
        </div>
      ) : null}
      {openPost ? (
        <PostModal
          post={openPost}
          onClose={() => setSelectedPost(null)}
          currentUserId={currentUserId}
          onDelete={handleDelete}
          onPurchase={handlePurchase}
          onTip={handleOpenTip}
          isFavorite={favoritePostIds.has(openPost.id)}
          onToggleFavorite={handleToggleFavorite}
          onShare={handleSharePost}
        />
      ) : null}
      <SharePostModal
        open={Boolean(sharePost)}
        post={sharePost}
        sharePath={sharePost ? buildPostSharePath(sharePost) : null}
        onClose={() => setSharePost(null)}
      />
      <TipModal
        open={Boolean(tipTarget)}
        availableBalance={viewerBalance}
        recipientLabel={tipTarget?.label ?? "usuario"}
        recipientUserId={tipTarget?.userId ?? null}
        onClose={() => setTipTarget(null)}
        onSubmitted={() => {
          window.dispatchEvent(new Event("balance-updated"));
          window.dispatchEvent(new Event("earnings-updated"));
        }}
      />
      {menuPost ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-6 py-10">
          <button
            type="button"
            onClick={() => setMenuPostId(null)}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Cerrar menu"
          />
          <div className="relative w-full max-w-[520px] overflow-hidden rounded-[18px] bg-white shadow-xl">
            <button
              type="button"
              onClick={() => {
                if (!menuPost?.userId) return;
                setReportModal({
                  albumId: menuPost.id,
                  ownerId: menuPost.userId,
                  author: menuPost.author,
                });
                setReportReason("Contenido fuera de contexto");
                setReportError(null);
                setReportSent(false);
                setMenuPostId(null);
              }}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-semibold text-red-600"
            >
              Denunciar
            </button>
            <button
              type="button"
              onClick={() => setMenuPostId(null)}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-semibold text-red-600"
            >
              Dejar de seguir
            </button>
            {menuPost?.userId === currentUserId ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(menuPost.id)}
                className="w-full border-b border-zinc-200 py-4 text-center text-sm font-semibold text-red-600"
              >
                Eliminar publicacion
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (!menuPost) return;
                handleToggleFavorite(menuPost);
                setMenuPostId(null);
              }}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
            >
              {favoritePostIds.has(menuPost.id)
                ? "Quitar de favoritos"
                : "Añadir a favoritos"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!menuPost) return;
                router.push(buildPostSharePath(menuPost));
                setMenuPostId(null);
              }}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
            >
              Ir a la publicación
            </button>
            <button
              type="button"
              onClick={() => {
                if (!menuPost) return;
                router.push(buildUserProfileHref(menuPost.author));
                setMenuPostId(null);
              }}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
            >
              Información sobre esta cuenta
            </button>
            <button
              type="button"
              onClick={() => setMenuPostId(null)}
              className="w-full py-4 text-center text-sm font-medium text-zinc-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {reportModal ? (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/50 px-6 py-10">
          <button
            type="button"
            onClick={() => {
              if (reportSubmitting) return;
              setReportModal(null);
              setReportError(null);
              setReportSent(false);
            }}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Cerrar denuncia"
          />
          <div className="relative w-full max-w-[560px] rounded-[28px] bg-white p-6 shadow-2xl md:p-7">
            {!reportSent ? (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
                  Moderación
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-zinc-950">
                  Denunciar contenido
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Contanos qué viste en la publicación de @{reportModal.author}. El
                  equipo de FanPush va a revisarlo.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    "Contenido fuera de contexto",
                    "Spam o engañoso",
                    "Desnudez o sexual explícito",
                    "Violencia o abuso",
                  ].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setReportReason(option)}
                      className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                        reportReason === option
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                    Motivo
                  </label>
                  <textarea
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    rows={4}
                    className="w-full rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                    placeholder="Describí brevemente por qué querés denunciar esta publicación."
                  />
                </div>

                {reportError ? (
                  <div className="mt-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {reportError}
                  </div>
                ) : null}

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (reportSubmitting) return;
                      setReportModal(null);
                      setReportError(null);
                    }}
                    className="flex-1 rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleReport}
                    disabled={reportSubmitting}
                    className="fanpush-button-primary flex-1 rounded-[18px] px-4 py-3 text-sm disabled:opacity-60"
                  >
                    {reportSubmitting ? "Enviando..." : "Enviar denuncia"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Send className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-center text-2xl font-semibold text-zinc-950">
                  Denuncia enviada
                </h3>
                <p className="mt-2 text-center text-sm leading-6 text-zinc-500">
                  Recibimos tu reporte sobre la publicación de @{reportModal.author}.
                  El equipo de moderación lo va a revisar.
                </p>
                <div className="mt-6 rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-700">
                  Motivo enviado: <span className="font-semibold">{reportReason}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReportModal(null);
                    setReportError(null);
                    setReportSent(false);
                  }}
                  className="fanpush-button-primary mt-6 w-full rounded-[18px] px-4 py-3 text-sm"
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {confirmDeleteId ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 px-6 py-10">
          <button
            type="button"
            onClick={() => setConfirmDeleteId(null)}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Cerrar confirmacion"
          />
          <div className="relative w-full max-w-[520px] overflow-hidden rounded-[18px] bg-white shadow-xl text-center">
            <div className="px-6 py-6">
              <div className="text-lg font-semibold text-zinc-900">
                ¿Eliminar publicación?
              </div>
              <div className="mt-2 text-sm text-zinc-500">
                ¿Seguro que quieres eliminar esta publicación?
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(confirmDeleteId)}
              className="w-full border-t border-zinc-200 py-4 text-center text-sm font-semibold text-red-600"
            >
              Eliminar
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="w-full border-t border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {posts.map((post) => (
        <article
          key={post.id}
          className="overflow-hidden rounded-[5px] border border-zinc-200 bg-white"
        >
          {(() => {
            const lockedCount = post.media.filter((m) => m.locked).length;
            const hasPaidContent = lockedCount > 0;
            const current = activeIndex[post.id] ?? 0;
            const primaryPostId = post.mediaPostIds?.[0];
            const isLiked = primaryPostId ? likedPostIds.has(primaryPostId) : false;

            return (
              <>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  router.push(buildUserProfileHref(post.author));
                }}
                className="h-[46px] w-[46px] overflow-hidden rounded-full"
                aria-label={`Ver perfil de ${post.author}`}
              >
                <UserAvatar src={post.avatar} alt={post.author} />
              </button>
              <div>
                <div className="flex items-center gap-2 text-[15px] font-semibold leading-none text-zinc-900">
                  <button
                    type="button"
                    onClick={() => {
                      router.push(buildUserProfileHref(post.author));
                    }}
                    className="hover:underline"
                  >
                    {post.author}
                  </button>
                  {post.verified ? (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] bg-sky-500 text-[10px] font-bold text-white">
                      ✓
                    </span>
                  ) : null}
                  <span className="text-[13px] font-normal text-zinc-500">
                    {post.time}
                  </span>
                </div>
                <div className="mt-1 text-[13px] leading-none text-zinc-500">
                  {post.suggestion}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {post.userId !== currentUserId ? (
                <button
                  className={`min-w-[108px] text-right text-[16px] font-semibold leading-none tracking-[-0.02em] ${
                    followingIds.has(post.userId)
                      ? "text-zinc-700"
                      : "text-[#5A3EE7]"
                  }`}
                  onClick={() => toggleFollow(post.userId)}
                >
                  {followingIds.has(post.userId) ? "Siguiendo" : "Seguir"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setMenuPostId(post.id)}
                className="rounded-[5px] p-2 text-zinc-500 hover:bg-zinc-100"
                aria-label="Mas opciones"
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedPost(post.id)}
            className={`relative w-full overflow-hidden text-left ${
              hasPaidContent ? "h-[620px]" : "aspect-square"
            }`}
          >
            {post.media.map((item, index) => {
              const isActive = index === current;
              return (
                <div
                  key={`${post.id}-${index}`}
                  className={`absolute inset-0 transition-opacity duration-300 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {item.kind === "image" ? (
                    <MediaImage
                      src={item.url}
                      alt={`Media de ${post.author}`}
                      className={`h-full w-full object-cover ${
                        item.locked ? "scale-[1.02] blur-[10px]" : ""
                      }`}
                      fallbackClassName={`h-full w-full ${
                        item.locked ? "scale-[1.02] blur-[10px]" : ""
                      }`}
                      iconClassName="h-7 w-7"
                    />
                  ) : (
                    <video
                      src={item.url}
                      className={`h-full w-full object-cover ${
                        item.locked ? "scale-[1.02] blur-[10px]" : ""
                      }`}
                      muted
                      playsInline
                    />
                  )}
                  {item.locked ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-[86px] w-[86px] items-center justify-center rounded-[5px] bg-white/20">
                        <Lock className="h-9 w-9 text-white" strokeWidth={2.5} />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {post.media.length > 1 ? (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
                {post.media.map((_, index) => {
                  const current = activeIndex[post.id] ?? 0;
                  return (
                    <button
                      key={`dot-${post.id}-${index}`}
                      type="button"
                      onClick={() =>
                        setActiveIndex((prev) => ({ ...prev, [post.id]: index }))
                      }
                      className={`h-2 w-2 rounded-[5px] ${
                        current === index ? "bg-white" : "bg-white/50"
                      }`}
                      aria-label="Cambiar slide"
                    />
                  );
                })}
              </div>
            ) : null}
            {post.media.length > 1 ? (
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveIndex((prev) => {
                      const current = prev[post.id] ?? 0;
                      const next =
                        (current - 1 + post.media.length) % post.media.length;
                      return { ...prev, [post.id]: next };
                    });
                  }}
                  className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
                >
                  ‹
                </button>
              </div>
            ) : null}
            {post.media.length > 1 ? (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveIndex((prev) => {
                      const current = prev[post.id] ?? 0;
                      const next = (current + 1) % post.media.length;
                      return { ...prev, [post.id]: next };
                    });
                  }}
                  className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
                >
                  ›
                </button>
              </div>
            ) : null}
          </button>

          <div className="px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-zinc-700">
                <button
                  className="flex items-center gap-2"
                  onClick={() => toggleLike(post.id)}
                >
                  <Heart
                    className={`h-6 w-6 ${
                      isLiked ? "fill-[#ff334b] text-[#ff334b]" : "fill-none text-zinc-900"
                    }`}
                  />
                  <span className="text-[15px] font-semibold text-zinc-900">
                    {formatFeedLikes(post.likes)}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-4 text-zinc-900">
                <button
                  type="button"
                  aria-label="Compartir"
                  onClick={() => handleSharePost(post)}
                >
                  <Send className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  aria-label="Guardar"
                  onClick={() => handleToggleFavorite(post)}
                >
                  <Bookmark
                    className={`h-6 w-6 ${
                      favoritePostIds.has(post.id)
                        ? "fill-[#5A3EE7] text-[#5A3EE7]"
                        : "text-zinc-900"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-5 text-[15px] leading-[1.45] text-zinc-700">
              <span className="font-semibold text-zinc-900">
                {post.author}
              </span>{" "}
              {renderCaptionWithHashtags(post.caption)}
            </div>

            {currentUserId && post.userId !== currentUserId && post.tipEnabled ? (
              <button
                type="button"
                onClick={() => handleOpenTip(post)}
                className="mt-5 inline-flex items-center gap-2 text-[15px] font-semibold text-[#5A3EE7]"
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
          </div>
              </>
            );
          })()}
        </article>
      ))}
    </section>
  );
}
