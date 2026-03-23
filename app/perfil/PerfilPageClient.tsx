"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, CheckCircle2, Grid, Lock, User } from "lucide-react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import PostModal from "@/components/PostModal";
import {
  getSessionAccessTokenWithRetry,
  PURCHASE_REFRESH_FLAG,
} from "@/lib/auth";
import { loadCreatorEarnings } from "@/lib/earnings";
import {
  getPremiumPathFromPreview,
  inferDisplayKind,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";
import { ensureUserRow, getSupabaseClient } from "@/lib/supabase";
import { formatARS } from "@/lib/utils";
import type { Post } from "@/lib/store/posts";

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

const normalizeAlbumUser = (
  user: AlbumUser | AlbumUser[] | null | undefined,
): AlbumUser | null => {
  if (!user) return null;
  return Array.isArray(user) ? user[0] ?? null : user;
};

const normalizeSingleRelation = <T,>(
  value: T | T[] | null | undefined,
): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const resolveFallbackUsername = (email?: string | null, metadata?: unknown) => {
  if (
    metadata &&
    typeof metadata === "object" &&
    "username" in metadata &&
    typeof metadata.username === "string" &&
    metadata.username.trim()
  ) {
    return metadata.username.trim();
  }

  if (email?.includes("@")) {
    return email.split("@")[0];
  }

  return "usuario";
};

export default function PerfilPage({
  forcedUsername,
}: {
  forcedUsername?: string;
} = {}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [earnings, setEarnings] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    posts: 0,
    followers: 0,
    following: 0,
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "purchased">("posts");
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState("5.00");
  const [tipSubmitting, setTipSubmitting] = useState(false);
  const [tipSent, setTipSent] = useState<{
    total: string;
    creator: string;
    platform: string;
  } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const routeUsername = forcedUsername ?? searchParams.get("user");
  const [profileName, setProfileName] = useState(
    routeUsername ?? "usuario",
  );
  const [profileFullName, setProfileFullName] = useState(
    searchParams.get("full") ?? "Sin nombre",
  );
  const [profileAvatar, setProfileAvatar] = useState(
    searchParams.get("avatar") ?? "",
  );
  const [profileLoading, setProfileLoading] = useState(true);

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
      items?: Record<string, { url: string; kind: "image" | "video"; locked: boolean }>;
    };
    const resolvedItems = result.items ?? {};

    return incomingPosts.map((post) => ({
      ...post,
      media: post.media.map((item, index): Post["media"][number] => {
        const postId = post.mediaPostIds[index];
        const resolved = postId ? resolvedItems[postId] : null;
        return resolved
          ? { ...item, url: resolved.url, kind: resolved.kind, locked: resolved.locked }
          : item;
      }),
    }));
  };

  useEffect(() => {
    const checkoutKind = searchParams.get("checkout");
    if (checkoutKind === "tip") {
      const total = Number(searchParams.get("tip_total") || 0);
      if (total > 0) {
        setTipSent({
          total: total.toFixed(2),
          creator: (total * 0.7).toFixed(2),
          platform: (total * 0.3).toFixed(2),
        });
        setTipOpen(true);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const idParam = searchParams.get("id");
    const userParam = forcedUsername ?? searchParams.get("user");
    const fullParam = searchParams.get("full");
    const avatarParam = searchParams.get("avatar");
    if (idParam || userParam || fullParam || avatarParam) {
      if (userParam) setProfileName(userParam);
      if (fullParam) setProfileFullName(fullParam);
      if (avatarParam) setProfileAvatar(avatarParam);
      setProfileLoading(false);
      return;
    }

    const loadProfile = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;
      await ensureUserRow(supabase, authData?.user);
      setViewedUserId(userId);

      const { data: userRow } = await supabase
        .from("users")
        .select("username, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      const fallbackUser = resolveFallbackUsername(
        authData?.user?.email,
        authData?.user?.user_metadata,
      );

      let avatarUrl = userRow?.avatar_url ?? "";
      if (avatarUrl && !avatarUrl.startsWith("http")) {
        const { data: publicUrl } = supabase.storage
          .from(PUBLIC_MEDIA_BUCKET)
          .getPublicUrl(avatarUrl);
        avatarUrl = publicUrl.publicUrl;
      }

      setProfileName(userRow?.username ?? fallbackUser);
      setProfileAvatar(avatarUrl);
      setProfileFullName(profileRow?.full_name ?? "Sin nombre");
      setProfileLoading(false);
    };

    loadProfile();
  }, [forcedUsername, searchParams]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        username?: string;
        fullName?: string;
        avatarUrl?: string | null;
      };
      if (detail?.username) setProfileName(detail.username);
      if (detail?.fullName) setProfileFullName(detail.fullName);
      if (detail?.avatarUrl !== undefined) {
        setProfileAvatar(detail.avatarUrl ?? "");
      }
    };
    window.addEventListener("profile-updated", handler as EventListener);
    return () =>
      window.removeEventListener("profile-updated", handler as EventListener);
  }, []);

  useEffect(() => {
    const loadPosts = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: authData } = await supabase.auth.getUser();
      setCurrentUserId(authData?.user?.id ?? null);

      let userId: string | null = null;
      let userRow: { username: string | null; avatar_url: string | null } | null =
        null;
      const idParam = searchParams.get("id");
      const userParam = forcedUsername ?? searchParams.get("user");
      if (idParam) {
        userId = idParam;
        const { data } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .eq("id", idParam)
          .maybeSingle();
        userRow = data
          ? { username: data.username ?? null, avatar_url: data.avatar_url ?? null }
          : null;
      } else if (userParam) {
        const { data } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .eq("username", userParam)
          .maybeSingle();
        userId = data?.id ?? null;
        userRow = data
          ? { username: data.username ?? null, avatar_url: data.avatar_url ?? null }
          : null;
      } else {
        userId = authData?.user?.id ?? null;
        setCurrentUserId(authData?.user?.id ?? null);
        await ensureUserRow(supabase, authData?.user);
      }


      if (!userId) return;
      setViewedUserId(userId);
      if (!userRow) {
        const { data } = await supabase
          .from("users")
          .select("username, avatar_url")
          .eq("id", userId)
          .maybeSingle();
        userRow = data
          ? { username: data.username ?? null, avatar_url: data.avatar_url ?? null }
          : null;
      }
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      const { data: albums } = await supabase
        .from("albums")
        .select(
          "id,user_id,description,price,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count))",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const resolveMediaUrl = async (value: string | null) => {
        if (!value) return "";
        if (value.startsWith("http")) return value;
        const { data: publicUrl } = supabase.storage
          .from(PUBLIC_MEDIA_BUCKET)
          .getPublicUrl(value);
        return publicUrl.publicUrl;
      };

      const resolveAvatarUrl = async (value: string | null) => {
        if (!value) return "";
        if (value.startsWith("http")) return value;
        const { data: publicUrl } = supabase.storage
          .from(PUBLIC_MEDIA_BUCKET)
          .getPublicUrl(value);
        return publicUrl.publicUrl;
      };

      const resolvedAvatar = userRow?.avatar_url
        ? await resolveAvatarUrl(userRow.avatar_url)
        : "";
      const fallbackUsername = resolveFallbackUsername(
        authData?.user?.email,
        authData?.user?.user_metadata,
      );
      setProfileName(userRow?.username ?? userParam ?? fallbackUsername);
      setProfileFullName(profileRow?.full_name ?? "Sin nombre");
      setProfileAvatar(resolvedAvatar);

      if ((albums ?? []).length > 0) {
        const mapped: Post[] = await Promise.all(
          (albums ?? []).map(async (album) => {
            const media = normalizeAlbumMedia(
              album.album_posts as AlbumPostRow[] | null | undefined,
            );
            const albumUser = normalizeAlbumUser(
              album.users as AlbumUser | AlbumUser[] | null | undefined,
            );
            const mediaWithUrls: Post["media"] = await Promise.all(
              media.map(async (item) => ({
                url: await resolveMediaUrl(item?.media_url ?? ""),
                kind: inferDisplayKind(
                  item?.media_url,
                  item?.media_type,
                  item?.is_locked,
                ),
                locked: item?.is_locked ?? false,
              })),
            );
            const mediaPostIds = media.map((item) => item.id ?? "");
            const avatarUrl = await resolveAvatarUrl(
              albumUser?.avatar_url ?? userRow?.avatar_url ?? "",
            );
            return {
              id: album.id,
              userId: album.user_id ?? userId,
              mediaPostIds,
              author:
                albumUser?.username ??
                userRow?.username ??
                profileName ??
                "usuario",
              verified: false,
              time: "Ahora",
              suggestion: "Perfil",
              caption: album.description ?? "",
              likes: media.reduce(
                (sum, item) => sum + (item.likes_count ?? 0),
                0,
              ),
              avatar: avatarUrl || null,
              price: album.price ?? 0,
              media: mediaWithUrls,
            } satisfies Post;
          }),
        );

        const allMediaIds = mapped.flatMap((post) => post.mediaPostIds);
        const accessToken = await getSessionAccessTokenWithRetry(supabase);
        if (accessToken && allMediaIds.length > 0) {
          setProfilePosts(await resolveAccessibleMedia(supabase, accessToken, mapped));
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(PURCHASE_REFRESH_FLAG);
          }
        } else {
          setProfilePosts(mapped);
        }
      } else {
        const { data: legacyPosts } = await supabase
          .from("posts")
          .select("id,media_url,media_type,is_locked,likes_count,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        const avatarUrl = await resolveAvatarUrl(userRow?.avatar_url ?? "");
        const mapped: Post[] = await Promise.all(
          (legacyPosts ?? []).map(async (post) => ({
            id: post.id,
            userId,
            mediaPostIds: [post.id],
            author: userRow?.username ?? profileName ?? "usuario",
            verified: false,
            time: "Ahora",
            suggestion: "Perfil",
            caption: "",
            likes: post.likes_count ?? 0,
            avatar: avatarUrl || null,
            price: 0,
            media: [
              {
                url: await resolveMediaUrl(post.media_url),
                kind: inferDisplayKind(
                  post.media_url,
                  post.media_type,
                  post.is_locked,
                ),
                locked: post.is_locked ?? false,
              },
            ],
          } satisfies Post)),
        );

        const accessToken = await getSessionAccessTokenWithRetry(supabase);
        if (accessToken && mapped.length > 0) {
          setProfilePosts(await resolveAccessibleMedia(supabase, accessToken, mapped));
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(PURCHASE_REFRESH_FLAG);
          }
        } else {
          setProfilePosts(mapped);
        }
      }

      const { count: postsCount } = await supabase
        .from("albums")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      const { count: followersCount } = await supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", userId);
      const { count: followingCount } = await supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("follower_id", userId);

      setStats({
        posts: postsCount ?? 0,
        followers: followersCount ?? 0,
        following: followingCount ?? 0,
      });

      if (authData?.user?.id && userId && authData.user.id !== userId) {
        const { data: followRow } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", authData.user.id)
          .eq("following_id", userId)
          .maybeSingle();
        setIsFollowing(Boolean(followRow));
      } else {
        setIsFollowing(false);
      }

      const earningsSummary = await loadCreatorEarnings(supabase, userId);
      setEarnings(earningsSummary.creatorNet);
    };

    loadPosts();
  }, [forcedUsername, searchParams]);

  const openPostFromProfile = async (post: Post) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setOpenPost(post);
      return;
    }

    const resolveMediaUrl = async (value: string | null) => {
      if (!value) return "";
      if (value.startsWith("http")) return value;
      const { data: publicUrl } = supabase.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .getPublicUrl(value);
      return publicUrl.publicUrl;
    };

    const resolveAvatarUrl = async (value: string | null) => {
      if (!value) return "";
      if (value.startsWith("http")) return value;
      const { data: publicUrl } = supabase.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .getPublicUrl(value);
      return publicUrl.publicUrl;
    };

    try {
      const { data: album } = await supabase
        .from("albums")
        .select(
          "id,user_id,description,price,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count))",
        )
        .eq("id", post.id)
        .maybeSingle();

      if (album) {
        const media = normalizeAlbumMedia(
          album.album_posts as AlbumPostRow[] | null | undefined,
        );
        const albumUser = normalizeAlbumUser(
          album.users as AlbumUser | AlbumUser[] | null | undefined,
        );
        const mediaWithUrls: Post["media"] = await Promise.all(
          media.map(async (item) => ({
            url: await resolveMediaUrl(item?.media_url ?? ""),
            kind: inferDisplayKind(
              item?.media_url,
              item?.media_type,
              item?.is_locked,
            ),
            locked: item?.is_locked ?? false,
          })),
        );
        const mediaPostIds = media.map((item) => item.id ?? "");
        const avatarUrl = await resolveAvatarUrl(
          albumUser?.avatar_url ?? post.avatar ?? "",
        );
        const basePost: Post = {
          id: album.id,
          userId: album.user_id ?? post.userId,
          mediaPostIds,
          author: albumUser?.username ?? post.author ?? "usuario",
          verified: false,
          time: "Ahora",
          suggestion: "Perfil",
          caption: album.description ?? "",
          likes: media.reduce(
            (sum, item) => sum + (item.likes_count ?? 0),
            0,
          ),
          avatar: avatarUrl || null,
          price: album.price ?? post.price ?? 0,
          media: mediaWithUrls,
        };
        const accessToken = await getSessionAccessTokenWithRetry(supabase);
        setOpenPost(
          accessToken
            ? (await resolveAccessibleMedia(supabase, accessToken, [basePost]))[0] ??
                basePost
            : basePost,
        );
        return;
      }

      setOpenPost(post);
    } catch (err) {
      console.error(err);
      setOpenPost(post);
    }
  };

  const toggleFollow = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId || !viewedUserId) return;
    if (currentUserId === viewedUserId) return;

    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", viewedUserId);
      if (error) {
        alert(`No se pudo dejar de seguir: ${error.message}`);
        return;
      }
      setIsFollowing(false);
      setStats((prev) => ({
        ...prev,
        followers: Math.max(prev.followers - 1, 0),
      }));
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: viewedUserId,
      });
      if (error) {
        alert(`No se pudo seguir a este usuario: ${error.message}`);
        return;
      }
      setIsFollowing(true);
      setStats((prev) => ({
        ...prev,
        followers: prev.followers + 1,
      }));

      await supabase.from("notifications").insert({
        user_id: viewedUserId,
        actor_id: currentUserId,
        type: "follow",
        entity_id: currentUserId,
        message: "comenzó a seguirte.",
        is_read: false,
      });
    }
  };

  const handleSendTip = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId || !viewedUserId) return;
    if (currentUserId === viewedUserId) return;

    const amount = Number(tipAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Ingresa un monto válido para la propina.");
      return;
    }

    setTipSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Necesitas iniciar sesión para enviar una propina.");
      }

      const response = await fetch("/api/mercadopago/preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          kind: "tip",
          targetUserId: viewedUserId,
          amount,
          returnPath: window.location.pathname,
        }),
      });

      const result = (await response.json()) as {
        initPoint?: string;
        error?: string;
      };

      if (!response.ok || !result.initPoint) {
        throw new Error(
          result.error ?? "No se pudo iniciar el checkout de la propina.",
        );
      }

      window.location.assign(result.initPoint);
    } catch (error) {
      alert(
        error instanceof Error
          ? `No se pudo enviar la propina: ${error.message}`
          : "No se pudo enviar la propina.",
      );
    } finally {
      setTipSubmitting(false);
    }
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

      setProfilePosts((prev) => prev.filter((post) => post.id !== albumId));
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar la publicación. Revisa los permisos (RLS).");
    }
  };

  const handlePurchase = async (albumId: string) => {
    if (!currentUserId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert("Necesitas iniciar sesión para comprar.");
        return false;
      }

      const response = await fetch("/api/mercadopago/preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          kind: "purchase",
          albumId,
          returnPath: window.location.pathname,
        }),
      });

      const result = (await response.json()) as {
        initPoint?: string;
        error?: string;
      };

      if (!response.ok || !result.initPoint) {
        alert(result.error ?? "No se pudo iniciar el checkout con Mercado Pago.");
        return false;
      }

      window.location.assign(result.initPoint);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el checkout con Mercado Pago.",
      );
      return false;
    }
    return false;
  };

  const isOwnProfile = Boolean(
    currentUserId && viewedUserId && currentUserId === viewedUserId,
  );
  const tipPayout = (() => {
    const value = Number(tipAmount) || 0;
    return {
      total: value.toFixed(2),
      creator: (value * 0.7).toFixed(2),
      platform: (value * 0.3).toFixed(2),
    };
  })();

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
      {openPost ? (
        <PostModal
          post={openPost}
          onClose={() => setOpenPost(null)}
          currentUserId={currentUserId}
          onDelete={handleDelete}
          onPurchase={handlePurchase}
        />
      ) : null}
      {tipOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[560px] rounded-[20px] bg-white p-6 shadow-2xl">
            {tipSent ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold">Propina enviada</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        @{profileName || "usuario"} ya recibió la acreditación en su saldo.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTipOpen(false);
                      setTipSent(null);
                    }}
                    className="rounded-[10px] p-2 text-zinc-500 transition hover:bg-zinc-100"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-6 rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <div className="flex items-center justify-between">
                    <span>Propina total enviada</span>
                    <span className="font-semibold">{formatARS(Number(tipSent.total))}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Se acredita al creador</span>
                    <span className="font-semibold">{formatARS(Number(tipSent.creator))}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Comisión de plataforma</span>
                    <span className="font-semibold">{formatARS(Number(tipSent.platform))}</span>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setTipSent(null)}
                    className="rounded-[12px] border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700"
                  >
                    Enviar otra
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipOpen(false);
                      setTipSent(null);
                    }}
                    className="rounded-[12px] bg-zinc-900 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Listo
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Enviar propina</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Apoya a @{profileName || "usuario"} con una propina directa.
                      Recibe el 70% y la plataforma retiene el 30%.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTipOpen(false)}
                    className="rounded-[10px] p-2 text-zinc-500 transition hover:bg-zinc-100"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold text-zinc-700">
                    Monto de la propina (ARS)
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-[12px] border border-zinc-300 bg-white px-4 py-3 text-lg font-semibold text-zinc-900">
                    <span className="text-zinc-500">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="0.01"
                      value={tipAmount}
                      onChange={(event) => setTipAmount(event.target.value)}
                      className="w-full bg-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-[12px] border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  <div className="flex items-center justify-between">
                    <span>Propina total</span>
                    <span className="font-semibold text-zinc-900">
                      {formatARS(Number(tipPayout.total))}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Recibe el creador (70%)</span>
                    <span className="font-semibold text-zinc-900">
                      {formatARS(Number(tipPayout.creator))}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Comisión plataforma (30%)</span>
                    <span className="font-semibold text-zinc-900">
                      {formatARS(Number(tipPayout.platform))}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setTipOpen(false)}
                    className="rounded-[12px] border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSendTip}
                    disabled={tipSubmitting}
                    className="rounded-[12px] bg-zinc-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {tipSubmitting ? "Enviando..." : "Enviar propina"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[1360px] md:gap-8 md:px-6 md:py-8">
          <div className="rounded-[12px] border border-zinc-200 bg-white px-6 py-8 md:px-10 md:py-10">
            <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 md:flex-row md:items-start md:gap-14">
              <div className="flex flex-1 items-start gap-6 md:gap-10">
                {profileAvatar ? (
                  <img
                    src={profileAvatar}
                    alt={profileName}
                    className="h-28 w-28 rounded-full object-cover md:h-40 md:w-40"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-500 md:h-40 md:w-40">
                    <User className="h-10 w-10 md:h-14 md:w-14" />
                  </div>
                )}
                <div className="flex-1 md:max-w-[560px]">
                  <div className="flex items-center gap-2 md:gap-3">
                    <h1 className="text-[28px] font-semibold leading-none md:text-[38px]">
                      {profileName || "usuario"}
                    </h1>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-bold text-white md:h-6 md:w-6 md:text-[10px]">
                      ✓
                    </span>
                  </div>
                  <div className="mt-3 text-[18px] font-medium leading-snug text-zinc-700 md:text-[20px]">
                    {profileFullName || "Sin nombre"}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 text-[15px] text-zinc-600 md:gap-x-10 md:text-[17px]">
                    <span className="whitespace-nowrap">
                      <span className="font-semibold text-zinc-900">
                        {stats.posts}
                      </span>{" "}
                      publicaciones
                    </span>
                    <span className="whitespace-nowrap">
                      <span className="font-semibold text-zinc-900">
                        {stats.followers}
                      </span>{" "}
                      seguidores
                    </span>
                    <span className="whitespace-nowrap">
                      <span className="font-semibold text-zinc-900">
                        {stats.following}
                      </span>{" "}
                      seguidos
                    </span>
                    <span className="whitespace-nowrap">
                      <span className="font-semibold text-zinc-900">
                        {formatARS(earnings)}
                      </span>{" "}
                      ventas
                    </span>
                  </div>
                  <div className="mt-6 w-full max-w-[520px]">
                    {isOwnProfile ? (
                      <button
                        type="button"
                        onClick={() => router.push("/settings")}
                        className="w-full rounded-[16px] bg-zinc-100 px-4 py-4 text-[15px] font-semibold text-zinc-900 md:text-[16px]"
                      >
                        Editar perfil
                      </button>
                    ) : currentUserId && viewedUserId ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={toggleFollow}
                          className={`w-full rounded-[16px] px-4 py-4 text-[15px] font-semibold transition-colors md:text-[16px] ${
                            isFollowing
                              ? "bg-zinc-100 text-zinc-900"
                              : "bg-indigo-600 text-white hover:bg-indigo-500"
                          }`}
                        >
                          {isFollowing ? "Siguiendo" : "Seguir"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTipSent(null);
                            setTipOpen(true);
                          }}
                          className="w-full rounded-[16px] border border-zinc-200 bg-white px-4 py-4 text-[15px] font-semibold text-zinc-900 transition hover:bg-zinc-50 md:text-[16px]"
                        >
                          Propina
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="rounded-[12px] border border-zinc-200 bg-white">
            <div className="flex items-center justify-center gap-8 border-b border-zinc-200 px-6 pt-4 text-sm font-semibold text-zinc-500">
              <button
                onClick={() => setActiveTab("posts")}
                className={`pb-3 ${
                  activeTab === "posts"
                    ? "border-b-2 border-zinc-900 text-zinc-900"
                    : ""
                }`}
              >
                <Grid className="mr-2 inline h-4 w-4" />
                Posteos
              </button>
              <button
                onClick={() => setActiveTab("purchased")}
                className={`pb-3 ${
                  activeTab === "purchased"
                    ? "border-b-2 border-zinc-900 text-zinc-900"
                    : ""
                }`}
              >
                <Bookmark className="mr-2 inline h-4 w-4" />
                Comprados
              </button>
            </div>

            <div className="grid grid-cols-2 gap-[2px] p-2 sm:grid-cols-3 md:grid-cols-5 md:gap-[2px] md:p-4">
              {activeTab === "posts" ? (
                profilePosts.map((post) => {
                  const firstMedia = post.media[0];
                  if (!firstMedia) return null;
                  return (
                    <div
                      key={post.id}
                      className="relative aspect-[3/4] cursor-pointer overflow-hidden border border-zinc-200"
                      onClick={() => openPostFromProfile(post)}
                    >
                      <img
                        src={firstMedia.url}
                        alt={profileName}
                        className="h-full w-full object-cover"
                      />
                      {firstMedia.locked ? (
                        <div className="absolute right-2 top-2 rounded-[5px] bg-white/90 px-2 py-1 text-[10px] font-semibold text-zinc-700">
                          <Lock className="mr-1 inline h-3 w-3" />
                          Locked
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-3 rounded-[5px] border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">
                  Aun no tienes compras.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
