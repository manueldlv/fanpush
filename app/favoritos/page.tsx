"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, Heart, Share2 } from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import PostModal from "@/components/PostModal";
import SharePostModal from "@/components/SharePostModal";
import TipModal from "@/components/TipModal";
import UserAvatar from "@/components/UserAvatar";
import { runBalanceCheckout } from "@/lib/balanceCheckout";
import { redirectToSaldo, shouldRedirectToSaldo } from "@/lib/purchaseRedirect";
import {
  FAVORITES_UPDATED_EVENT,
  loadFavoritePosts,
  removeFavoritePost,
  toggleFavoritePost,
  type FavoritePostRecord,
} from "@/lib/favorites";
import { buildPostSharePath } from "@/lib/postShare";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { useGetSessionQuery, useGetViewerQuery } from "@/lib/redux/api/sessionApi";
import type { Post } from "@/lib/store/posts";
import { formatARS } from "@/lib/utils";

export default function FavoritosPage() {
  const { data: session } = useGetSessionQuery();
  const { data: viewer } = useGetViewerQuery();
  const viewerId = session?.userId ?? null;
  const [favoriteItems, setFavoriteItems] = useState<FavoritePostRecord[]>([]);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipTarget, setTipTarget] = useState<{
    userId: string;
    label: string;
    avatar: string | null;
  } | null>(null);
  const availableBalance = viewer?.commerce.balance ?? 0;

  useEffect(() => {
    const syncFavorites = () => {
      setFavoriteItems(loadFavoritePosts(viewerId));
    };

    syncFavorites();
    window.addEventListener(FAVORITES_UPDATED_EVENT, syncFavorites);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, syncFavorites);
    };
  }, [viewerId]);

  const favoritePosts = useMemo(
    () => favoriteItems.map((item) => item.post),
    [favoriteItems],
  );

  const handleToggleFavorite = (post: Post) => {
    if (!viewerId) return;
    const result = toggleFavoritePost(viewerId, post);
    if (!result.favorite) {
      setOpenPost((current) => (current?.id === post.id ? null : current));
    }
  };

  const handleRemoveFavorite = (postId: string) => {
    removeFavoritePost(viewerId, postId);
    setOpenPost((current) => (current?.id === postId ? null : current));
  };

  const handlePurchase = async (postId: string) => {
    if (!viewerId) return false;
    const targetPost = favoritePosts.find((post) => post.id === postId);
    try {
      await runBalanceCheckout({
        kind: "purchase",
        albumId: postId,
        availableBalance,
        requiredAmount: Number(targetPost?.price ?? 0),
      });
      window.dispatchEvent(new Event("purchases-updated"));
      window.dispatchEvent(new Event("balance-updated"));
      return true;
    } catch {
      return false;
    }
  };

  const handleOpenTip = (post: Post) => {
    if (!viewerId || !post.userId || post.userId === viewerId || !post.tipEnabled) {
      return;
    }

    if (
      shouldRedirectToSaldo({
        availableBalance,
        requiredAmount: 1000,
      })
    ) {
      redirectToSaldo({
        reason: "insufficient-balance",
        requiredAmount: 1000,
        currentBalance: availableBalance,
        kind: "tip",
        targetId: post.userId,
        targetLabel: post.author,
        targetAvatar: post.avatar,
      });
      return;
    }

    setTipTarget({
      userId: post.userId,
      label: post.author,
      avatar: post.avatar,
    });
    setTipOpen(true);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SidebarLeft />
      {openPost ? (
        <PostModal
          post={openPost}
          onClose={() => setOpenPost(null)}
          currentUserId={viewerId}
          onPurchase={handlePurchase}
          onTip={handleOpenTip}
          isFavorite={favoritePosts.some((post) => post.id === openPost.id)}
          onToggleFavorite={handleToggleFavorite}
          onShare={setSharePost}
        />
      ) : null}
      <SharePostModal
        open={Boolean(sharePost)}
        post={sharePost}
        sharePath={sharePost ? buildPostSharePath(sharePost) : null}
        onClose={() => setSharePost(null)}
      />
      <TipModal
        open={tipOpen}
        availableBalance={availableBalance}
        recipientLabel={tipTarget?.label ?? "usuario"}
        recipientAvatar={tipTarget?.avatar ?? null}
        recipientUserId={tipTarget?.userId ?? null}
        onClose={() => setTipOpen(false)}
        onSubmitted={() => {
          window.dispatchEvent(new Event("balance-updated"));
          window.dispatchEvent(new Event("earnings-updated"));
        }}
      />

      <div className="flex min-h-screen md:pl-60">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 py-5 pb-24 md:px-6">
          <div className="rounded-[5px] border border-zinc-200 bg-white px-6 py-6">
            <h1 className="text-[25px] font-semibold tracking-[-0.02em] text-zinc-950">
              Favoritos
            </h1>
            <p className="mt-2 text-[15px] leading-6 text-[#464646]">
              Guarda publicaciones para volver a encontrarlas rápido desde acá.
            </p>
          </div>

          {favoritePosts.length === 0 ? (
            <div className="rounded-[5px] border border-zinc-200 bg-white px-6 py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f3ff] text-[#5A3EE7]">
                <Bookmark className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-[30px] font-semibold tracking-[-0.03em] text-zinc-950">
                Todavía no guardaste favoritos
              </h2>
              <p className="mx-auto mt-3 max-w-[560px] text-[15px] leading-7 text-[#464646]">
                Cuando marques una publicación con el ícono de guardado, va a aparecer
                acá para que puedas volver a verla cuando quieras.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {favoriteItems.map((item) => {
                const post = item.post;
                const cover = post.media[0];
                const isPaid = Number(post.price ?? 0) > 0 || post.media.some((media) => media.locked);

                return (
                  <div
                    key={post.id}
                    className="overflow-hidden rounded-[5px] border border-zinc-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenPost(post)}
                      className="relative block h-[320px] w-full overflow-hidden bg-zinc-100 text-left"
                    >
                      {cover?.kind === "video" ? (
                        <video
                          src={cover.url}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={cover?.url}
                          alt={post.author}
                          className="h-full w-full object-cover"
                        />
                      )}
                      {isPaid ? (
                        <div className="absolute right-3 top-3 rounded-[5px] bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-900 shadow-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <Bookmark className="h-3 w-3" />
                            {formatARS(Number(post.price ?? 0))}
                          </span>
                        </div>
                      ) : null}
                    </button>

                    <div className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar src={post.avatar} alt={post.author} />
                          <div className="min-w-0">
                            <a
                              href={buildUserProfileHref(post.author)}
                              className="block truncate text-[18px] font-semibold text-zinc-950 hover:underline"
                            >
                              @{post.author}
                            </a>
                            <div className="mt-1 text-[14px] text-zinc-500">{post.time}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFavorite(post.id)}
                          className="rounded-[5px] border border-zinc-200 bg-white px-3 py-2 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
                        >
                          Quitar
                        </button>
                      </div>

                      <div className="mt-4 line-clamp-2 text-[15px] leading-6 text-[#464646]">
                        {post.caption}
                      </div>

                      <div className="mt-5 flex items-center justify-between">
                        <div className="flex items-center gap-4 text-zinc-900">
                          <div className="inline-flex items-center gap-2 text-[14px] font-semibold">
                            <Heart className="h-4 w-4" />
                            {post.likes}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSharePost(post)}
                            className="rounded-[5px] border border-zinc-200 bg-white p-2.5 text-zinc-700 transition hover:bg-zinc-50"
                            aria-label="Compartir"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenPost(post)}
                            className="fanpush-button-secondary px-4 py-2.5 text-[14px]"
                          >
                            Abrir
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
