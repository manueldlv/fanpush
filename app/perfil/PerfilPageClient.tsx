"use client";

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

export default function PerfilPage({
  forcedUsername,
}: {
  forcedUsername?: string;
} = {}) {
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "purchased">("posts");
  const [tipOpen, setTipOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const availableBalance = useAppSelector((state) => state.viewer.commerce.balance);
  const routeUsername = forcedUsername ?? searchParams.get("user");
  const profileId = searchParams.get("id");
  const profileQueryArg = {
    userId: profileId,
    username: routeUsername,
  };
  const { data: profileData, isLoading: profileQueryLoading } =
    useGetProfileViewQuery(profileQueryArg);

  const profileName = profileData?.profile.username ?? routeUsername ?? "usuario";
  const profileFullName =
    profileData?.profile.fullName ?? searchParams.get("full") ?? "Sin nombre";
  const profileAvatar = profileData?.profile.avatar ?? searchParams.get("avatar") ?? "";
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
        profileApi.util.updateQueryData("getProfileView", profileQueryArg, (draft) => {
          if (detail?.username) draft.profile.username = detail.username;
          if (detail?.fullName) draft.profile.fullName = detail.fullName;
          if (detail?.avatarUrl !== undefined) {
            draft.profile.avatar = detail.avatarUrl ?? "";
          }
          if (detail?.bio !== undefined) draft.profile.bio = detail.bio;
          if (detail?.website !== undefined) draft.profile.website = detail.website;
          if (detail?.instagram !== undefined) {
            draft.profile.instagram = detail.instagram;
          }
        }),
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
      dispatch(
        profileApi.util.updateQueryData("getProfileView", profileQueryArg, (draft) => {
          draft.isFollowing = false;
          draft.stats.followers = Math.max(draft.stats.followers - 1, 0);
        }),
      );
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: viewedUserId,
      });
      if (error) {
        alert(`No se pudo seguir a este usuario: ${error.message}`);
        return;
      }
      dispatch(
        profileApi.util.updateQueryData("getProfileView", profileQueryArg, (draft) => {
          draft.isFollowing = true;
          draft.stats.followers += 1;
        }),
      );

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
        profileApi.util.updateQueryData("getProfileView", profileQueryArg, (draft) => {
          draft.posts = draft.posts.filter((post) => post.id !== albumId);
          draft.stats.posts = Math.max(draft.stats.posts - 1, 0);
        }),
      );
      setOpenPost(null);
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar la publicación. Revisa los permisos (RLS).");
    }
  };

  const handlePurchase = async (albumId: string) => {
    if (!currentUserId) return;
    try {
      await runBalanceCheckout({
        kind: "purchase",
        albumId,
      });
      window.dispatchEvent(new Event("purchases-updated"));
      window.dispatchEvent(new Event("balance-updated"));
      return true;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo completar la compra con saldo.",
      );
      return false;
    }
  };

  const isOwnProfile = Boolean(
    currentUserId && viewedUserId && currentUserId === viewedUserId,
  );

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
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

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-4 px-4 py-4 md:max-w-[1240px] md:gap-5 md:px-6 md:py-5">
          {profileLoading ? (
            <ProfileHeaderSkeleton />
          ) : (
          <div className="rounded-[12px] border border-zinc-200 bg-white px-5 py-5 md:px-7 md:py-6">
            <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 md:flex-row md:items-start md:gap-8">
              <div className="flex flex-1 items-start gap-4 md:gap-6">
                <UserAvatar
                  src={profileAvatar}
                  alt={profileName || "Perfil"}
                  sizeClassName="h-20 w-20 md:h-28 md:w-28"
                  iconClassName="h-8 w-8 md:h-10 md:w-10"
                />
                <div className="flex-1 md:max-w-[500px]">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[22px] font-semibold leading-none md:text-[28px]">
                      {profileName || "usuario"}
                    </h1>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-bold text-white">
                      ✓
                    </span>
                  </div>
                  <div className="mt-1.5 text-[15px] font-medium leading-snug text-zinc-700 md:text-[17px]">
                    {profileFullName || "Sin nombre"}
                  </div>
                  {profileBio ? (
                    <div className="mt-2.5 max-w-[560px] text-[13px] leading-5 text-zinc-700 md:text-[14px]">
                      {profileBio}
                    </div>
                  ) : isOwnProfile ? (
                    <div className="mt-2.5 max-w-[560px] rounded-[14px] border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                      Tu perfil todavía no tiene bio. Puedes agregar una desde Configuración para que se vea más completo.
                    </div>
                  ) : null}
                  <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-zinc-600 md:gap-x-6 md:text-[14px]">
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
                  {profileWebsite || profileInstagram ? (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {profileWebsite ? (
                        <a
                          href={profileWebsite}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          Link principal
                        </a>
                      ) : null}
                      {profileInstagram ? (
                        <a
                          href={`https://instagram.com/${profileInstagram.replace(/^@/, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          {profileInstagram.startsWith("@")
                            ? profileInstagram
                            : `@${profileInstagram}`}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-4 w-full max-w-[460px]">
                    {isOwnProfile ? (
                      <button
                        type="button"
                        onClick={() => router.push("/settings")}
                        className="w-full rounded-[10px] bg-zinc-100 px-4 py-2 text-[14px] font-semibold text-zinc-900"
                      >
                        Editar perfil
                      </button>
                    ) : currentUserId && viewedUserId ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={toggleFollow}
                          className={`w-full rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-colors ${
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
                            setTipOpen(true);
                          }}
                          className="w-full rounded-[10px] border border-zinc-200 bg-white px-4 py-2 text-[14px] font-semibold text-zinc-900 transition hover:bg-zinc-50"
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
          )}

          {postsLoading ? (
            <ProfilePostsSkeleton />
          ) : (
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
                      <MediaImage
                        src={firstMedia.url}
                        alt={profileName || "Post"}
                        className="h-full w-full object-cover"
                        fallbackClassName="h-full w-full border-0"
                        iconClassName="h-7 w-7"
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
          )}
        </div>
      </div>
    </div>
  );
}
