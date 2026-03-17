"use client";

import { Bookmark, Heart, Lock, MoreHorizontal, Send } from "lucide-react";
import { usePostsStore } from "@/lib/store";
import type { Post } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
import PostModal from "@/components/PostModal";
import { getSupabaseClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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

export default function FeedLayout() {
  const posts = usePostsStore((state) => state.posts);
  const setPosts = usePostsStore((state) => state.setPosts);
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState<Record<string, number>>({});
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [purchasedPostIds, setPurchasedPostIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);

  const openPost = posts.find((post) => post.id === selectedPost) ?? null;
  const menuPost = posts.find((post) => post.id === menuPostId) ?? null;

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

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id ?? null;
        setCurrentUserId(userId);

        const { data: followRows } = userId
          ? await supabase
              .from("follows")
              .select("following_id")
              .eq("follower_id", userId)
          : { data: [] };
        setFollowingIds(
          new Set((followRows ?? []).map((row) => row.following_id)),
        );

        const { data, error } = await supabase
          .from("albums")
          .select(
            "id,user_id,description,price,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count))",
          )
          .order("created_at", { ascending: false });
        if (error) throw error;

        const resolveMediaUrl = async (value: string | null) => {
          if (!value) return "";
          if (value.startsWith("http")) return value;
          const { data: publicUrl } = supabase.storage
            .from("Imagenes")
            .getPublicUrl(value);
          return publicUrl.publicUrl;
        };

        const resolveAvatarUrl = async (value: string | null) => {
          if (!value) return "";
          if (value.startsWith("http")) return value;
          const { data: publicUrl } = supabase.storage
            .from("Imagenes")
            .getPublicUrl(value);
          return publicUrl.publicUrl;
        };

        const mapped: Post[] =
          (await Promise.all(
            (data ?? []).map(async (post) => {
              const media = normalizeAlbumMedia(
                post.album_posts as AlbumPostRow[] | null | undefined,
              );
              const albumUser = normalizeSingleRelation(
                post.users as AlbumUser | AlbumUser[] | null | undefined,
              );
              const mediaWithUrls: Post["media"] = await Promise.all(
                media.map(async (item) => ({
                  url: await resolveMediaUrl(item?.media_url ?? ""),
                  kind: item?.media_type === "video" ? "video" : "image",
                  locked: item?.is_locked ?? false,
                })),
              );
              const mediaPostIds = media.map((item) => item.id ?? "");
              const avatarUrl = await resolveAvatarUrl(
                albumUser?.avatar_url ?? "",
              );
              return {
                id: post.id,
                userId: post.user_id,
                mediaPostIds,
                author: albumUser?.username ?? "usuario",
                verified: false,
                time: formatTime(post.created_at),
                suggestion: "Sugerencia para ti",
                caption: post.description ?? "",
                likes: media.reduce(
                  (sum, item) => sum + (item.likes_count ?? 0),
                  0,
                ),
                avatar:
                  avatarUrl ||
                  "https://picsum.photos/seed/default-avatar/64/64",
                price: post.price ?? 0,
                media: mediaWithUrls,
              } satisfies Post;
            }),
          )) ?? [];

        setPosts(mapped);

        const allPostIds = mapped.flatMap((post) => post.mediaPostIds).filter(Boolean);
        if (userId && allPostIds.length > 0) {
          const { data: likesRows } = await supabase
            .from("likes")
            .select("post_id")
            .eq("user_id", userId)
            .in("post_id", allPostIds);
          setLikedPostIds(new Set((likesRows ?? []).map((row) => row.post_id)));

          const { data: purchaseRows } = await supabase
            .from("purchases")
            .select("post_id")
            .eq("user_id", userId)
            .in("post_id", allPostIds);
          const purchased = new Set(
            (purchaseRows ?? []).map((row) => row.post_id),
          );
          setPurchasedPostIds(purchased);

          setPosts((prev) =>
            prev.map((post) => ({
              ...post,
              media: post.media.map((item, index): Post["media"][number] => {
                const postId = post.mediaPostIds[index];
                const unlocked =
                  post.userId === userId || purchased.has(postId);
                return { ...item, locked: unlocked ? false : item.locked };
              }),
            })),
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, [setPosts]);

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
      setPosts((prev) =>
        prev.map((post) => ({
          ...post,
          media: post.media.map((item, index): Post["media"][number] => {
            const postId = post.mediaPostIds[index];
            const unlocked =
              post.userId === currentUserId || purchased.has(postId);
            return { ...item, locked: unlocked ? false : item.locked };
          }),
        })),
      );
    };
    window.addEventListener("purchases-updated", purchasesHandler);
    return () => {
      window.removeEventListener("purchases-updated", purchasesHandler);
    };
  }, [currentUserId, posts, setPosts]);

  useEffect(() => {
    if (!menuPostId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuPostId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [menuPostId]);

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
        setPosts((prev) =>
          prev.map((p) =>
            p.id === albumId ? { ...p, likes: Math.max(p.likes - 1, 0) } : p,
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
        setPosts((prev) =>
          prev.map((p) => (p.id === albumId ? { ...p, likes: p.likes + 1 } : p)),
        );
      }
    }
  };

  const handlePurchase = async (albumId: string) => {
    if (!currentUserId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const post = posts.find((item) => item.id === albumId);
    if (!post) return;

    const rows = post.mediaPostIds.map((postId, index) => ({
      user_id: currentUserId,
      post_id: postId,
      payment_id: `sim-${Date.now()}`,
      amount: index === 0 ? post.price ?? 0 : 0,
      status: "approved",
    }));
    const { error } = await supabase.from("purchases").insert(rows);
    if (error) {
      console.error(error);
      alert("No se pudo registrar la compra. Revisa permisos (RLS).");
      return false;
    }
    if (!error) {
      setPurchasedPostIds((prev) => {
        const next = new Set(prev);
        post.mediaPostIds.forEach((id) => next.add(id));
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === albumId
            ? {
                ...p,
                media: p.media.map((item) => ({ ...item, locked: false })),
              }
            : p,
        ),
      );

      if (post.userId !== currentUserId) {
        await supabase.from("notifications").insert({
          user_id: post.userId,
          actor_id: currentUserId,
          type: "purchase",
          entity_id: albumId,
          message: "compró tu publicación.",
          is_read: false,
        });
      }
      window.dispatchEvent(new Event("purchases-updated"));
    }
    return true;
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
          .from("Imagenes")
          .remove(mediaPaths);
        if (storageError) throw storageError;
      }

      const { error: albumsError } = await supabase
        .from("albums")
        .delete()
        .eq("id", albumId)
        .eq("user_id", currentUserId);
      if (albumsError) throw albumsError;

      setPosts((prev) => prev.filter((post) => post.id !== albumId));
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar la publicación. Revisa los permisos (RLS).");
    } finally {
      setMenuPostId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <section className="flex w-full max-w-none flex-col gap-6 md:max-w-[630px] md:pr-2">
      {loading ? (
        <div className="rounded-[5px] border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">
          Cargando contenido...
        </div>
      ) : null}
      {openPost ? (
        <PostModal
          post={openPost}
          onClose={() => setSelectedPost(null)}
          currentUserId={currentUserId}
          onDelete={handleDelete}
          onPurchase={handlePurchase}
        />
      ) : null}
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
              onClick={() => setMenuPostId(null)}
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
              onClick={() => setMenuPostId(null)}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
            >
              Añadir a favoritos
            </button>
            <button
              type="button"
              onClick={() => setMenuPostId(null)}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
            >
              Ir a la publicación
            </button>
            <button
              type="button"
              onClick={() => setMenuPostId(null)}
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
          className="rounded-[5px] border border-zinc-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (post.author) params.set("user", post.author);
                  if (post.avatar) params.set("avatar", post.avatar);
                  router.push(`/perfil?${params.toString()}`);
                }}
                className="h-10 w-10 overflow-hidden rounded-full"
                aria-label={`Ver perfil de ${post.author}`}
              >
                <img
                  src={post.avatar}
                  alt={post.author}
                  className="h-10 w-10 rounded-full object-cover"
                />
              </button>
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (post.author) params.set("user", post.author);
                      if (post.avatar) params.set("avatar", post.avatar);
                      router.push(`/perfil?${params.toString()}`);
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
                  <span className="text-xs font-normal text-zinc-500">
                    · {post.time}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">{post.suggestion}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {post.userId !== currentUserId ? (
                <button
                  className={`text-sm font-semibold ${
                    followingIds.has(post.userId)
                      ? "text-zinc-700"
                      : "text-blue-600"
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
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedPost(post.id)}
            className="relative aspect-square w-full overflow-hidden text-left"
          >
            {post.media.map((item, index) => {
              const current = activeIndex[post.id] ?? 0;
              const isActive = index === current;
              const lockedCount = post.media.filter((m) => m.locked).length;
              return (
                <div
                  key={`${post.id}-${index}`}
                  className={`absolute inset-0 transition-opacity duration-300 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {item.kind === "image" ? (
                    <img
                      src={item.url}
                      alt={`Media de ${post.author}`}
                      className={`h-full w-full object-cover ${
                        item.locked ? "blur-[6px]" : ""
                      }`}
                    />
                  ) : (
                    <video
                      src={item.url}
                      className={`h-full w-full object-cover ${
                        item.locked ? "blur-[6px]" : ""
                      }`}
                      muted
                      playsInline
                    />
                  )}
                  {item.locked ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-[5px] bg-white/95 px-6 py-5 text-center shadow-md">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[5px] bg-zinc-100">
                          <Lock className="h-5 w-5 text-zinc-600" />
                        </div>
                        <div className="mt-3 text-sm font-semibold text-zinc-900">
                          Desbloquear post completo
                        </div>
                        <div className="text-xs text-zinc-500">
                          {lockedCount} contenido bloqueado
                        </div>
                        <div className="mt-3 rounded-[5px] bg-zinc-900 px-5 py-2 text-sm font-semibold text-white">
                          ${post.price?.toFixed(2) ?? "0.00"}
                        </div>
                        {post.userId !== currentUserId ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedPost(post.id);
                            }}
                            className="mt-3 w-full rounded-[5px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Comprar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {lockedCount > 0 ? (
                    <div className="absolute right-4 top-4 rounded-[5px] bg-white/90 px-3 py-1 text-xs font-semibold text-zinc-700">
                      <span className="inline-flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        {lockedCount} locked
                      </span>
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

          <div className="px-5 py-4">
            <div className="text-sm font-semibold text-zinc-900">
              {post.likes.toLocaleString("es-AR")} Me gusta
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-4 text-zinc-700">
                <button
                  className="flex items-center gap-2"
                  onClick={() => toggleLike(post.id)}
                >
                  <Heart className="h-5 w-5" />
                  <span className="text-xs">{post.likes}</span>
                </button>
                <button className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <button aria-label="Guardar">
                <Bookmark className="h-5 w-5 text-zinc-700" />
              </button>
            </div>

            <div className="mt-4 text-sm text-zinc-700">
              <span className="font-semibold text-zinc-900">
                {post.author}
              </span>{" "}
              {post.caption}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
