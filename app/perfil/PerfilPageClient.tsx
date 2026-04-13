"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Grid, Lock } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import SidebarLeft from "@/components/SidebarLeft";
import PostModal from "@/components/PostModal";
import TipModal from "@/components/TipModal";
import UserAvatar from "@/components/UserAvatar";
import { runBalanceCheckout } from "@/lib/balanceCheckout";
import { getSessionAccessTokenWithRetry } from "@/lib/auth";
import { parseUploadModerationMeta } from "@/lib/contentClassification";
import {
  getPremiumPathFromPreview,
  inferDisplayKind,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";
import {
  applyResolvedMediaAccess,
  buildInitialPostMediaState,
  type ResolvedAccessMedia,
} from "@/lib/postMediaState";
import {
  getProfileViewCacheKey,
  profileApi,
  useGetProfileViewQuery,
} from "@/lib/redux/api/profileApi";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { getSupabaseClient } from "@/lib/supabase";
import { formatARS } from "@/lib/utils";
import type { Post } from "@/lib/store/posts";

type AlbumMediaPost = {
  id: string | null;
  media_url: string | null;
  media_type: string | null;
  is_locked: boolean | null;
  likes_count: number | null;
  caption?: string | null;
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
  return Array.isArray(user) ? (user[0] ?? null) : user;
};

const normalizeSingleRelation = <T,>(
  value: T | T[] | null | undefined,
): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

function ProfileHeaderSkeleton() {
  return (
    <div className="rounded-[12px] border border-zinc-200 bg-white px-5 py-5 md:px-7 md:py-6">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 md:flex-row md:items-start md:gap-8">
        <div className="fanpush-skeleton h-20 w-20 rounded-full md:h-28 md:w-28" />
        <div className="flex-1 md:max-w-[500px]">
          <div className="fanpush-skeleton h-8 w-44 rounded-full" />
          <div className="mt-3 fanpush-skeleton h-5 w-28 rounded-full" />
          <div className="mt-4 space-y-2">
            <div className="fanpush-skeleton h-4 w-full rounded-full" />
            <div className="fanpush-skeleton h-4 w-[82%] rounded-full" />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="fanpush-skeleton h-4 w-24 rounded-full" />
            <div className="fanpush-skeleton h-4 w-24 rounded-full" />
            <div className="fanpush-skeleton h-4 w-24 rounded-full" />
            <div className="fanpush-skeleton h-4 w-24 rounded-full" />
          </div>
          <div className="mt-5 fanpush-skeleton h-11 w-full max-w-[460px] rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}

function ProfilePostsSkeleton() {
  return (
    <div className="rounded-[12px] border border-zinc-200 bg-white">
      <div className="flex items-center justify-center gap-8 border-b border-zinc-200 px-6 pt-4">
        <div className="fanpush-skeleton mb-3 h-5 w-24 rounded-full" />
        <div className="fanpush-skeleton mb-3 h-5 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-[2px] p-2 sm:grid-cols-3 md:grid-cols-5 md:gap-[2px] md:p-4">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={`profile-post-skeleton-${index}`}
            className="fanpush-skeleton aspect-[3/4] rounded-[4px]"
          />
        ))}
      </div>
    </div>
  );
}

const profileGamificationBadges = [
  { icon: "🌈", title: "Perfil destacado", detail: "Completó su perfil y mantuvo actividad constante." },
  { icon: "🪩", title: "Creador activo", detail: "Publicó contenido premium de forma consistente." },
  { icon: "💐", title: "Favorito del mes", detail: "Recibió muchas interacciones positivas este mes." },
  { icon: "🛡️", title: "Autor verificado", detail: "Completó la validación de autor con DNI." },
  { icon: "🏅", title: "Top ventas", detail: "Superó una marca destacada de ventas en la plataforma." },
  { icon: "🪄", title: "Gran comunidad", detail: "Refirió a +500 usuarios y expandió su comunidad." },
];

export default function PerfilPage({
  forcedUsername,
}: {
  forcedUsername?: string;
} = {}) {
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "purchased">("posts");
  const [tipOpen, setTipOpen] = useState(false);
  const [uiMessage, setUiMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const availableBalance = useAppSelector(
    (state) => state.viewer.commerce.balance,
  );
  const routeUsername = forcedUsername ?? searchParams.get("user");
  const profileId = searchParams.get("id");
  const profileQueryArg = {
    userId: profileId,
    username: routeUsername,
  };
  const { data: profileData, isLoading: profileQueryLoading } =
    useGetProfileViewQuery(profileQueryArg);

  const profileName =
    profileData?.profile.username ?? routeUsername ?? "usuario";
  const profileFullName =
    profileData?.profile.fullName ?? searchParams.get("full") ?? "Sin nombre";
  const profileAvatar =
    profileData?.profile.avatar ?? searchParams.get("avatar") ?? "";
  const profileBio = profileData?.profile.bio ?? "";
  const profileWebsite = profileData?.profile.website ?? "";
  const profileInstagram = profileData?.profile.instagram ?? "";
  const profilePosts = profileData?.posts ?? [];
  const currentUserId = profileData?.currentUserId ?? null;
  const viewedUserId = profileData?.viewedUserId ?? null;
  const stats = profileData?.stats ?? {
    posts: 0,
    followers: 0,
    following: 0,
  };
  const isFollowing = profileData?.isFollowing ?? false;
  const earnings = profileData?.earnings ?? 0;
  const profileLoading = !profileData && profileQueryLoading;
  const postsLoading = !profileData && profileQueryLoading;
  const statsLoading = !profileData && profileQueryLoading;

  const resolveAccessibleMedia = async (
    supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
    accessToken: string,
    incomingPosts: Post[],
  ) => {
    const allPostIds = incomingPosts
      .flatMap((post) => post.mediaPostIds)
      .filter(Boolean);
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

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        username?: string;
        fullName?: string;
        avatarUrl?: string | null;
        bio?: string;
        website?: string;
        instagram?: string;
      };
      dispatch(
        profileApi.util.updateQueryData(
          "getProfileView",
          profileQueryArg,
          (draft) => {
            if (detail?.username) draft.profile.username = detail.username;
            if (detail?.fullName) draft.profile.fullName = detail.fullName;
            if (detail?.avatarUrl !== undefined) {
              draft.profile.avatar = detail.avatarUrl ?? "";
            }
            if (detail?.bio !== undefined) draft.profile.bio = detail.bio;
            if (detail?.website !== undefined)
              draft.profile.website = detail.website;
            if (detail?.instagram !== undefined) {
              draft.profile.instagram = detail.instagram;
            }
          },
        ),
      );
    };
    const invalidateProfile = () => {
      dispatch(
        profileApi.util.invalidateTags([
          {
            type: "ProfileView",
            id: getProfileViewCacheKey(profileQueryArg),
          },
        ]),
      );
    };
    window.addEventListener("profile-updated", handler as EventListener);
    window.addEventListener("purchases-updated", invalidateProfile);
    window.addEventListener("earnings-updated", invalidateProfile);
    return () => {
      window.removeEventListener("profile-updated", handler as EventListener);
      window.removeEventListener("purchases-updated", invalidateProfile);
      window.removeEventListener("earnings-updated", invalidateProfile);
    };
  }, [dispatch, profileId, routeUsername]);

  useEffect(() => {
    if (!uiMessage) return;
    const timeout = window.setTimeout(() => {
      setUiMessage(null);
    }, 3600);
    return () => window.clearTimeout(timeout);
  }, [uiMessage]);

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
          "id,user_id,description,price,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count,caption))",
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
          media.map(async (item) =>
            buildInitialPostMediaState({
              previewUrl: await resolveMediaUrl(item?.media_url ?? ""),
              previewKind: inferDisplayKind(
                item?.media_url,
                item?.media_type,
                item?.is_locked,
              ),
              locked: item?.is_locked ?? false,
            }),
          ),
        );
        const mediaPostIds = media.map((item) => item.id ?? "");
        const postMeta = parseUploadModerationMeta(media[0]?.caption ?? null);
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
          likes: media.reduce((sum, item) => sum + (item.likes_count ?? 0), 0),
          avatar: avatarUrl || null,
          price: album.price ?? post.price ?? 0,
          tipEnabled: postMeta?.tipsEnabled ?? false,
          media: mediaWithUrls,
        };
        const accessToken = await getSessionAccessTokenWithRetry(supabase);
        setOpenPost(
          accessToken
            ? ((
                await resolveAccessibleMedia(supabase, accessToken, [basePost])
              )[0] ?? basePost)
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
        setUiMessage({
          tone: "error",
          text: `No se pudo dejar de seguir: ${error.message}`,
        });
        return;
      }
      dispatch(
        profileApi.util.updateQueryData(
          "getProfileView",
          profileQueryArg,
          (draft) => {
            draft.isFollowing = false;
            draft.stats.followers = Math.max(draft.stats.followers - 1, 0);
          },
        ),
      );
      setUiMessage({
        tone: "success",
        text: `Ya no seguís a @${profileName}.`,
      });
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: viewedUserId,
      });
      if (error) {
        setUiMessage({
          tone: "error",
          text: `No se pudo seguir a este usuario: ${error.message}`,
        });
        return;
      }
      dispatch(
        profileApi.util.updateQueryData(
          "getProfileView",
          profileQueryArg,
          (draft) => {
            draft.isFollowing = true;
            draft.stats.followers += 1;
          },
        ),
      );
      setUiMessage({
        tone: "success",
        text: `Ahora seguís a @${profileName}.`,
      });

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

      dispatch(
        profileApi.util.updateQueryData(
          "getProfileView",
          profileQueryArg,
          (draft) => {
            draft.posts = draft.posts.filter((post) => post.id !== albumId);
            draft.stats.posts = Math.max(draft.stats.posts - 1, 0);
          },
        ),
      );
      setOpenPost(null);
      setUiMessage({
        tone: "success",
        text: "La publicación se eliminó correctamente.",
      });
    } catch (err) {
      console.error(err);
      setUiMessage({
        tone: "error",
        text: "No se pudo eliminar la publicación. Revisa los permisos.",
      });
    }
  };

  const handlePurchase = async (albumId: string) => {
    if (!currentUserId) return;
    try {
      await runBalanceCheckout({
        kind: "purchase",
        albumId,
      });
      setUiMessage({
        tone: "success",
        text: "Compra realizada. El contenido premium ya quedó habilitado.",
      });
      window.dispatchEvent(new Event("purchases-updated"));
      window.dispatchEvent(new Event("balance-updated"));
      return true;
    } catch (error) {
      setUiMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "No se pudo completar la compra con saldo.",
      });
      return false;
    }
  };

  const isOwnProfile = Boolean(
    currentUserId && viewedUserId && currentUserId === viewedUserId,
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SidebarLeft />
      {openPost ? (
        <PostModal
          post={openPost}
          onClose={() => setOpenPost(null)}
          currentUserId={currentUserId}
          onDelete={handleDelete}
          onPurchase={handlePurchase}
          onTip={() => {
            if (!isOwnProfile) setTipOpen(true);
          }}
        />
      ) : null}
      <TipModal
        open={tipOpen}
        availableBalance={availableBalance}
        recipientLabel={profileName || "usuario"}
        recipientUserId={viewedUserId}
        onClose={() => setTipOpen(false)}
        onSubmitted={() => {
          window.dispatchEvent(new Event("balance-updated"));
          window.dispatchEvent(new Event("earnings-updated"));
        }}
      />

      <div className="flex min-h-screen md:pl-60">
        <div className="mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-4 pb-24 md:max-w-[1495px] md:gap-5 md:px-6 md:py-5">
          {uiMessage ? (
            <div
              className={`rounded-[12px] border px-4 py-3 text-sm font-medium shadow-sm ${
                uiMessage.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {uiMessage.text}
            </div>
          ) : null}
          {profileLoading ? (
            <ProfileHeaderSkeleton />
          ) : (
            <div className="relative z-[70] rounded-[5px] border border-zinc-200 bg-white">
              <div className="relative h-[270px] w-full overflow-hidden">
                <Image
                  src="/profile-banner.png"
                  alt="Banner de perfil"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="relative px-4 pb-6 pt-0 md:px-7">
                <div className="absolute left-4 top-0 -translate-y-[68%] rounded-full border-[6px] border-white bg-white md:left-7 md:-translate-y-[72%]">
                  <UserAvatar
                    src={profileAvatar}
                    alt={profileName || "Perfil"}
                    sizeClassName="h-[120px] w-[120px] md:h-[160px] md:w-[160px]"
                    iconClassName="h-10 w-10 md:h-12 md:w-12"
                  />
                </div>

                <div className="flex min-h-[178px] flex-col justify-end gap-5 pt-[42px] md:flex-row md:items-end md:justify-between md:pt-[58px]">
                  <div className="max-w-[880px]">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                      <div className="flex items-center gap-2">
                        <h1 className="text-[25px] font-semibold leading-none text-zinc-900">
                          {profileName || "usuario"}
                        </h1>
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#2f7cf6] text-[10px] font-bold text-white">
                          ✓
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] leading-none text-zinc-600">
                        <span className="whitespace-nowrap">
                          <span className="font-semibold text-zinc-900">
                            {statsLoading ? "..." : stats.posts}
                          </span>{" "}
                          publicaciones
                        </span>
                        <span className="whitespace-nowrap">
                          <span className="font-semibold text-zinc-900">
                            {statsLoading ? "..." : stats.followers}
                          </span>{" "}
                          seguidores
                        </span>
                        <span className="whitespace-nowrap">
                          <span className="font-semibold text-zinc-900">
                            {statsLoading ? "..." : stats.following}
                          </span>{" "}
                          seguidos
                        </span>
                        <span className="whitespace-nowrap">
                          <span className="font-semibold text-zinc-900">
                            {statsLoading ? "..." : formatARS(earnings)}
                          </span>{" "}
                          ventas
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[22px]">
                      {profileGamificationBadges.map((badge, index) => (
                        <div
                          key={`profile-badge-${index}`}
                          className="group relative z-[80]"
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center">
                            {badge.icon}
                          </span>
                          <div className="pointer-events-none absolute bottom-[calc(100%+12px)] left-1/2 z-[120] w-max max-w-[280px] -translate-x-1/2 rounded-[16px] bg-black px-5 py-3 text-center opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                            <div className="text-[14px] font-semibold leading-tight text-white">
                              {badge.title}
                            </div>
                            <div className="mt-1 text-[12px] leading-snug text-white/85">
                              {badge.detail}
                            </div>
                            <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-[9px] border-r-[9px] border-t-[11px] border-l-transparent border-r-transparent border-t-black" />
                          </div>
                        </div>
                      ))}
                    </div>

                    {profileBio ? (
                      <p className="mt-4 max-w-[820px] text-[15px] leading-[1.5] text-[#464646]">
                        {profileBio}
                      </p>
                    ) : isOwnProfile ? (
                      <p className="mt-4 max-w-[820px] text-[15px] leading-[1.5] text-[#464646]">
                        Hola ! Bienvenidos a mi perfil, aca voy a estar subiendo un poquito de todo ojalá les guste !!
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-3">
                      {isOwnProfile ? (
                        <button
                          type="button"
                          onClick={() => router.push("/settings")}
                          className="fanpush-button-secondary px-5 py-3"
                        >
                          Editar mi perfil
                        </button>
                      ) : currentUserId && viewedUserId ? (
                        <>
                          <button
                            type="button"
                            onClick={toggleFollow}
                            className={`rounded-[5px] px-5 py-3 text-[14px] font-semibold transition-colors ${
                              isFollowing
                                ? "fanpush-button-secondary"
                                : "bg-[#5A3EE7] text-white"
                            }`}
                          >
                            {isFollowing ? "Siguiendo" : "Seguir"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/mensajes?user=${encodeURIComponent(
                                  profileData?.profile.username ?? profileName ?? "",
                                )}`,
                              )
                            }
                            className="fanpush-button-secondary px-5 py-3"
                          >
                            Enviar mensaje
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTipOpen(true);
                            }}
                            className="fanpush-button-secondary px-5 py-3"
                          >
                            Propina
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {postsLoading ? (
            <ProfilePostsSkeleton />
          ) : (
            <div className="rounded-[5px] border border-zinc-200 bg-white p-4 md:p-5">
              {!isOwnProfile ? (
                <div className="mb-4 flex items-center justify-center gap-5 border-b border-zinc-200 px-4 pt-1 text-sm font-semibold text-zinc-500 md:gap-8 md:px-6">
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
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {activeTab === "posts" ? (
                  profilePosts.map((post) => {
                    const firstMedia = post.media[0];
                    if (!firstMedia) return null;
                    const isPaidPost =
                      Number(post.price ?? 0) > 0 ||
                      post.media.some((item) => item.locked);
                    return (
                      <div
                        key={post.id}
                        className="relative aspect-[280/370] min-w-0 w-full cursor-pointer overflow-hidden rounded-[5px] border border-zinc-200"
                        onClick={() => openPostFromProfile(post)}
                      >
                        <MediaImage
                          src={firstMedia.url}
                          alt={profileName || "Post"}
                          className="h-full w-full object-cover"
                          fallbackClassName="h-full w-full border-0"
                          iconClassName="h-7 w-7"
                        />
                        {isPaidPost ? (
                          <div className="absolute right-2 top-2 rounded-[5px] bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-900 shadow-sm">
                            <span className="inline-flex items-center gap-1.5">
                              <Lock className="h-3 w-3" />
                              {Math.round(Number(post.price ?? 0)).toLocaleString("es-AR")}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-2 rounded-[5px] border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500 sm:col-span-3">
                    Aun no tienes compras.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
