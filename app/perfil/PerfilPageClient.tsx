"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Pencil, Send } from "lucide-react";
import AvatarCropModal from "@/components/AvatarCropModal";
import MediaImage from "@/components/MediaImage";
import SidebarLeft from "@/components/SidebarLeft";
import PostModal from "@/components/PostModal";
import PurchaseSuccessToast from "@/components/PurchaseSuccessToast";
import SharePostModal from "@/components/SharePostModal";
import TipModal from "@/components/TipModal";
import UserAvatar from "@/components/UserAvatar";
import { runBalanceCheckout } from "@/lib/balanceCheckout";
import { getSessionAccessTokenWithRetry } from "@/lib/auth";
import { parseUploadModerationMeta } from "@/lib/contentClassification";
import {
  FAVORITES_UPDATED_EVENT,
  isFavoritePost,
  toggleFavoritePost,
} from "@/lib/favorites";
import { MAX_AVATAR_IMAGE_BYTES, validateImageFile } from "@/lib/imageFiles";
import {
  inferDisplayKind,
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
import {
  sessionApi,
  useGetSessionQuery,
  useGetViewerQuery,
} from "@/lib/redux/api/sessionApi";
import { useAppDispatch } from "@/lib/redux/hooks";
import { buildPostSharePath } from "@/lib/postShare";
import { redirectToSaldo, shouldRedirectToSaldo } from "@/lib/purchaseRedirect";
import { buildUserProfileHref } from "@/lib/profileRoute";
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

const buildLikesCountMap = (
  rows: Array<{ post_id: string | null }> | null | undefined,
) => {
  const likesByPostId = new Map<string, number>();
  for (const row of rows ?? []) {
    const postId = row.post_id ?? "";
    if (!postId) continue;
    likesByPostId.set(postId, (likesByPostId.get(postId) ?? 0) + 1);
  }
  return likesByPostId;
};

const buildProfileCaption = (
  description: string | null | undefined,
  moderationSource: string | null | undefined,
) => {
  const meta = parseUploadModerationMeta(moderationSource);
  if (!meta) return description ?? "";

  const tagSuffix = meta.tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .join(" ");

  return [meta.displayCaption.trim(), tagSuffix].filter(Boolean).join(" ").trim();
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
  const [lastOpenedQueryPostId, setLastOpenedQueryPostId] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [avatarCropSource, setAvatarCropSource] = useState<string | null>(null);
  const [avatarCropFileName, setAvatarCropFileName] = useState("avatar.jpg");
  const [avatarCropMimeType, setAvatarCropMimeType] = useState("image/jpeg");
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [followStateOverride, setFollowStateOverride] = useState<boolean | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [reportModal, setReportModal] = useState<{
    albumId: string;
    ownerId: string;
    author: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [favoritePostIds, setFavoritePostIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [purchasedPostIds, setPurchasedPostIds] = useState<Set<string>>(new Set());
  const [uiMessage, setUiMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const { data: viewer } = useGetViewerQuery();
  const { data: session } = useGetSessionQuery();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const availableBalance = viewer?.commerce.balance ?? 0;
  const routeUsername =
    forcedUsername ??
    searchParams.get("user") ??
    viewer?.profile.username ??
    null;
  const profileId = searchParams.get("id");
  const profileQueryArg = {
    userId: profileId,
    username: routeUsername,
  };
  const { data: profileData, isLoading: profileQueryLoading } =
    useGetProfileViewQuery(profileQueryArg, {
      refetchOnMountOrArgChange: true,
    });

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
  const sessionUserId = session?.userId ?? null;
  const currentUserId = profileData?.currentUserId ?? sessionUserId;
  const viewedUserId = profileData?.viewedUserId ?? null;
  const requestedPostId = searchParams.get("post");
  const viewerUsername = viewer?.profile.username?.trim().toLowerCase() ?? null;
  const normalizedProfileName = profileName.trim().toLowerCase();
  const isOwnProfile = Boolean(
    (currentUserId && viewedUserId && currentUserId === viewedUserId) ||
      (viewerUsername && viewerUsername === normalizedProfileName),
  );
  const selfProfileQueryArg = {
    userId: null,
    username: viewer?.profile.username ?? null,
  };
  const connectionsBaseHref = isOwnProfile
    ? "/perfil/conexiones"
    : `${buildUserProfileHref(profileName || "usuario")}/conexiones`;
  const stats = profileData?.stats ?? {
    posts: 0,
    followers: 0,
    following: 0,
  };
  const isFollowing =
    followStateOverride ?? profileData?.isFollowing ?? false;
  const earnings = profileData?.earnings ?? 0;
  const profileLoading = !profileData && profileQueryLoading;
  const postsLoading = !profileData && profileQueryLoading;
  const statsLoading = !profileData && profileQueryLoading;

  useEffect(() => {
    setFollowStateOverride(profileData?.isFollowing ?? null);
  }, [profileData?.isFollowing, viewedUserId]);

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
          {
            type: "ProfileView",
            id: getProfileViewCacheKey(selfProfileQueryArg),
          },
        ]),
      );
    };
    window.addEventListener("profile-updated", handler as EventListener);
    window.addEventListener("follow-updated", invalidateProfile);
    window.addEventListener("purchases-updated", invalidateProfile);
    window.addEventListener("earnings-updated", invalidateProfile);
    return () => {
      window.removeEventListener("profile-updated", handler as EventListener);
      window.removeEventListener("follow-updated", invalidateProfile);
      window.removeEventListener("purchases-updated", invalidateProfile);
      window.removeEventListener("earnings-updated", invalidateProfile);
    };
  }, [dispatch, profileId, routeUsername, viewer?.profile.username]);

  useEffect(() => {
    if (!uiMessage) return;
    const timeout = window.setTimeout(() => {
      setUiMessage(null);
    }, uiMessage.text.includes("Compra realizada") ? 6500 : 3600);
    return () => window.clearTimeout(timeout);
  }, [uiMessage]);

  useEffect(() => {
    if (!currentUserId) {
      setFavoritePostIds(new Set());
      return;
    }

    const syncFavorites = () => {
      const next = new Set<string>();
      for (const post of profilePosts) {
        if (isFavoritePost(currentUserId, post.id)) {
          next.add(post.id);
        }
      }
      if (openPost && isFavoritePost(currentUserId, openPost.id)) {
        next.add(openPost.id);
      }
      setFavoritePostIds(next);
    };

    syncFavorites();
    window.addEventListener(FAVORITES_UPDATED_EVENT, syncFavorites);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, syncFavorites);
    };
  }, [currentUserId, openPost, profilePosts]);

  useEffect(() => {
    if (!currentUserId) {
      setLikedPostIds(new Set());
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const allPostIds = [
      ...profilePosts.flatMap((post) => post.mediaPostIds ?? []),
      ...(openPost?.mediaPostIds ?? []),
    ].filter(Boolean);

    if (allPostIds.length === 0) {
      setLikedPostIds(new Set());
      return;
    }

    let cancelled = false;

    const loadLikedPostIds = async () => {
      const { data, error } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", Array.from(new Set(allPostIds)));

      if (cancelled || error) return;
      setLikedPostIds(
        new Set((data ?? []).map((row) => row.post_id).filter(Boolean)),
      );
    };

    void loadLikedPostIds();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, openPost?.id, openPost?.mediaPostIds, profilePosts]);

  useEffect(() => {
    if (!currentUserId) {
      setPurchasedPostIds(new Set());
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const allPostIds = [
      ...profilePosts.flatMap((post) => post.mediaPostIds ?? []),
      ...(openPost?.mediaPostIds ?? []),
    ].filter(Boolean);

    if (allPostIds.length === 0) {
      setPurchasedPostIds(new Set());
      return;
    }

    let cancelled = false;

    const loadPurchasedPostIds = async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", Array.from(new Set(allPostIds)));

      if (cancelled || error) return;
      setPurchasedPostIds(
        new Set((data ?? []).map((row) => row.post_id).filter(Boolean)),
      );
    };

    void loadPurchasedPostIds();
    window.addEventListener("purchases-updated", loadPurchasedPostIds);

    return () => {
      cancelled = true;
      window.removeEventListener("purchases-updated", loadPurchasedPostIds);
    };
  }, [currentUserId, openPost?.id, openPost?.mediaPostIds, profilePosts]);

  useEffect(() => {
    return () => {
      if (avatarCropSource?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarCropSource);
      }
    };
  }, [avatarCropSource]);

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
        const mediaPostIds = media.map((item) => item.id ?? "").filter(Boolean);
        const { data: likeRows } = mediaPostIds.length
          ? await supabase
              .from("likes")
              .select("post_id")
              .in("post_id", mediaPostIds)
          : { data: [] };
        const likesByPostId = buildLikesCountMap(likeRows);
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
        const postMeta = parseUploadModerationMeta(media[0]?.caption ?? null);
        const avatarUrl = await resolveAvatarUrl(
          albumUser?.avatar_url ?? post.avatar ?? "",
        );
        const normalizedCaption = buildProfileCaption(
          album.description ?? "",
          media[0]?.caption ?? null,
        );
        const basePost: Post = {
          id: album.id,
          userId: album.user_id ?? post.userId,
          mediaPostIds,
          author: albumUser?.username ?? post.author ?? "usuario",
          verified: false,
          time: "Ahora",
          suggestion: "Perfil",
          caption: normalizedCaption,
          likes: media.reduce(
            (sum, item) => sum + (likesByPostId.get(item.id ?? "") ?? 0),
            0,
          ),
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

  useEffect(() => {
    if (!requestedPostId || profilePosts.length === 0) return;
    if (lastOpenedQueryPostId === requestedPostId) return;

    const targetPost = profilePosts.find((post) => post.id === requestedPostId);
    if (!targetPost) return;

    setLastOpenedQueryPostId(requestedPostId);
    void openPostFromProfile(targetPost);
  }, [lastOpenedQueryPostId, profilePosts, requestedPostId]);

  const toggleFollow = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId || !viewedUserId) return;
    if (currentUserId === viewedUserId) return;
    if (followPending) return;
    setFollowPending(true);

    const { data: existingFollow, error: existingFollowError } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUserId)
      .eq("following_id", viewedUserId)
      .limit(1);

    if (existingFollowError) {
      setUiMessage({
        tone: "error",
        text: `No se pudo validar el seguimiento: ${existingFollowError.message}`,
      });
      setFollowPending(false);
      return;
    }

    const actualIsFollowing = Boolean(existingFollow?.length);

    if (actualIsFollowing) {
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
        setFollowPending(false);
        return;
      }
      setFollowStateOverride(false);
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
      dispatch(
        profileApi.util.updateQueryData(
          "getProfileView",
          selfProfileQueryArg,
          (draft) => {
            draft.stats.following = Math.max((draft.stats.following ?? 0) - 1, 0);
          },
        ),
      );
      dispatch(
        profileApi.util.invalidateTags([
          { type: "ProfileView", id: getProfileViewCacheKey(profileQueryArg) },
          { type: "ProfileView", id: getProfileViewCacheKey(selfProfileQueryArg) },
        ]),
      );
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: viewedUserId,
      });
      const duplicateFollow = error && "code" in error && error.code === "23505";
      if (error && !duplicateFollow) {
        setUiMessage({
          tone: "error",
          text: `No se pudo seguir a este usuario: ${error.message}`,
        });
        setFollowPending(false);
        return;
      }
      setFollowStateOverride(true);
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
      dispatch(
        profileApi.util.updateQueryData(
          "getProfileView",
          selfProfileQueryArg,
          (draft) => {
            draft.stats.following = (draft.stats.following ?? 0) + 1;
          },
        ),
      );
      dispatch(
        profileApi.util.invalidateTags([
          { type: "ProfileView", id: getProfileViewCacheKey(profileQueryArg) },
          { type: "ProfileView", id: getProfileViewCacheKey(selfProfileQueryArg) },
        ]),
      );

      if (!duplicateFollow) {
        await supabase.from("notifications").insert({
          user_id: viewedUserId,
          actor_id: currentUserId,
          type: "follow",
          entity_id: currentUserId,
          message: "comenzó a seguirte.",
          is_read: false,
        });
      }
    }
    setFollowPending(false);
  };

  const handleDelete = async (albumId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId) return;

    try {
      const { error: albumsError } = await supabase
        .from("albums")
        .update({ visibility: "removed" })
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
        text: "La publicación se ocultó correctamente.",
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
    const targetPost = profilePosts.find((post) => post.id === albumId);
    const requiredAmount = Number(targetPost?.price ?? 0);
    try {
      await runBalanceCheckout({
        kind: "purchase",
        albumId,
        availableBalance,
        requiredAmount,
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

  const handleOpenTip = () => {
    if (!viewedUserId || viewedUserId === currentUserId) return;
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
        targetId: viewedUserId,
        targetLabel: profileName || "usuario",
        targetAvatar: profileData?.profile.avatar ?? null,
      });
      return;
    }
    setTipOpen(true);
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

    const accessToken = await getSessionAccessTokenWithRetry(supabase);

    if (!accessToken) {
      setReportSubmitting(false);
      setReportError("Necesitas iniciar sesión para reportar contenido.");
      return;
    }

    const response = await fetch("/api/reports/content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
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

  const canCreateContent = Boolean(viewer?.access.canCreate);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      validateImageFile(file, {
        label: "La foto de perfil",
        maxBytes: MAX_AVATAR_IMAGE_BYTES,
      });
      const nextCropSource = URL.createObjectURL(file);
      if (avatarCropSource?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarCropSource);
      }
      setUiMessage(null);
      setAvatarCropSource(nextCropSource);
      setAvatarCropFileName(file.name || "avatar.jpg");
      setAvatarCropMimeType(file.type || "image/jpeg");
    } catch (error) {
      setUiMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo cargar la foto.",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleAvatarUploaded = async (file: File) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Falta configurar Supabase.");
    }

    setUpdatingAvatar(true);
    setUiMessage(null);

    try {
      if (!currentUserId) {
        throw new Error("Necesitas iniciar sesión.");
      }

      const safeUsername =
        profileName.trim() || viewer?.profile.username || session?.email?.split("@")[0] || "usuario";
      const path = `avatars/${currentUserId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

      if (uploadError) {
        if (/bucket not found/i.test(uploadError.message)) {
          throw new Error(
            "El almacenamiento de imágenes todavía no está preparado. Intenta de nuevo en unos minutos.",
          );
        }
        throw uploadError;
      }

      const uploadedAvatarUrl =
        supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;

      const { error: userUpdateError } = await supabase.from("users").upsert(
        {
          id: currentUserId,
          username: safeUsername,
          avatar_url: path,
        },
        { onConflict: "id" },
      );

      if (userUpdateError) {
        throw userUpdateError;
      }

      if (avatarCropSource?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarCropSource);
      }
      setAvatarCropSource(null);

      window.dispatchEvent(
        new CustomEvent("profile-updated", {
          detail: {
            username: safeUsername,
            avatarUrl: uploadedAvatarUrl,
          },
        }),
      );

      dispatch(
        profileApi.util.invalidateTags([
          { type: "ProfileView", id: getProfileViewCacheKey(profileQueryArg) },
          { type: "ProfileView", id: "self" },
          { type: "ProfileView", id: `id:${currentUserId}` },
          { type: "ProfileView", id: `username:${safeUsername.toLowerCase()}` },
        ]),
      );
      dispatch(sessionApi.util.invalidateTags(["Viewer", "Session"]));

      setUiMessage({
        tone: "success",
        text: "Foto de perfil actualizada.",
      });
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleToggleFavorite = (post: Post) => {
    if (!currentUserId) return;
    const result = toggleFavoritePost(currentUserId, post);
    setFavoritePostIds((prev) => {
      const next = new Set(prev);
      if (result.favorite) next.add(post.id);
      else next.delete(post.id);
      return next;
    });
  };

  const toggleLike = async (albumId: string) => {
    if (!currentUserId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const targetPost =
      (openPost && openPost.id === albumId ? openPost : null) ??
      profilePosts.find((item) => item.id === albumId);
    const postId = targetPost?.mediaPostIds?.[0];
    if (!postId) return;

    const isLiked = likedPostIds.has(postId);

    if (isLiked) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("user_id", currentUserId)
        .eq("post_id", postId);

      if (error) return;

      setLikedPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });

      setOpenPost((prev) =>
        prev && prev.id === albumId
          ? { ...prev, likes: Math.max((prev.likes ?? 0) - 1, 0) }
          : prev,
      );

      dispatch(
        profileApi.util.updateQueryData(
          "getProfileView",
          profileQueryArg,
          (draft) => {
            const target = draft.posts.find((item) => item.id === albumId);
            if (target) {
              target.likes = Math.max((target.likes ?? 0) - 1, 0);
            }
          },
        ),
      );
      return;
    }

    const { error } = await supabase.from("likes").insert({
      user_id: currentUserId,
      post_id: postId,
    });

    if (error) return;

    setLikedPostIds((prev) => new Set(prev).add(postId));
    setOpenPost((prev) =>
      prev && prev.id === albumId ? { ...prev, likes: (prev.likes ?? 0) + 1 } : prev,
    );
    dispatch(
      profileApi.util.updateQueryData(
        "getProfileView",
        profileQueryArg,
        (draft) => {
          const target = draft.posts.find((item) => item.id === albumId);
          if (target) {
            target.likes = (target.likes ?? 0) + 1;
          }
        },
      ),
    );
  };

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
            if (!isOwnProfile) handleOpenTip();
          }}
          isFavorite={favoritePostIds.has(openPost.id)}
          onToggleFavorite={handleToggleFavorite}
          onShare={setSharePost}
          isLiked={Boolean(
            openPost.mediaPostIds?.[0] && likedPostIds.has(openPost.mediaPostIds[0]),
          )}
          onLike={toggleLike}
          onReport={(post) => {
            if (!post.userId) return;
            setReportModal({
              albumId: post.id,
              ownerId: post.userId,
              author: post.author,
            });
            setReportReason("");
            setReportError(null);
            setReportSent(false);
          }}
          onUnfollow={async (userId) => {
            if (userId !== viewedUserId || !isFollowing) return;
            await toggleFollow();
          }}
          isFollowing={isFollowing}
          onToggleFollow={async (userId) => {
            if (userId !== viewedUserId) return;
            await toggleFollow();
          }}
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
        recipientLabel={profileName || "usuario"}
        recipientAvatar={profileData?.profile.avatar ?? null}
        recipientUserId={viewedUserId}
        onClose={() => setTipOpen(false)}
        onSubmitted={() => {
          window.dispatchEvent(new Event("balance-updated"));
          window.dispatchEvent(new Event("earnings-updated"));
        }}
      />
      <AvatarCropModal
        open={Boolean(avatarCropSource)}
        imageSrc={avatarCropSource ?? ""}
        fileName={avatarCropFileName}
        mimeType={avatarCropMimeType}
        onCancel={() => {
          if (avatarCropSource?.startsWith("blob:")) {
            URL.revokeObjectURL(avatarCropSource);
          }
          setAvatarCropSource(null);
        }}
        onConfirm={handleAvatarUploaded}
      />
      {reportModal ? (
        <div className="fixed inset-0 z-[111] flex items-center justify-center bg-black/50 px-6 py-10">
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
                <div className="text-xs font-medium text-zinc-500">
                  Moderación
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-zinc-950">
                  Denunciar contenido
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Contanos qué viste en la publicación de @{reportModal.author}. El
                  equipo de FanPush va a revisarlo.
                </p>

                <div className="mt-4">
                  <textarea
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    rows={4}
                    className="w-full rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                    placeholder="Contenido fuera de contexto"
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

      <div className="flex min-h-screen md:pl-60">
        <div className="mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-4 pb-24 md:max-w-[1495px] md:gap-5 md:px-6 md:py-5">
          <PurchaseSuccessToast
            message={
              uiMessage?.tone === "success" && uiMessage.text.includes("Compra realizada")
                ? uiMessage.text
                : null
            }
            onClose={() => setUiMessage(null)}
          />
          {uiMessage ? (
            uiMessage.tone === "success" && uiMessage.text.includes("Compra realizada") ? null : (
              <div
                className={`rounded-[12px] border px-4 py-3 text-sm font-medium shadow-sm ${
                  uiMessage.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {uiMessage.text}
              </div>
            )
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
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!isOwnProfile || updatingAvatar) return;
                    avatarInputRef.current?.click();
                  }}
                  className={`absolute left-4 top-0 -translate-y-[68%] rounded-full border-[6px] border-white bg-white md:left-7 md:-translate-y-[72%] ${
                    isOwnProfile
                      ? "cursor-pointer transition hover:scale-[1.01]"
                      : "cursor-default"
                  }`}
                  aria-label={
                    isOwnProfile ? "Cambiar foto de perfil" : "Avatar de perfil"
                  }
                >
                  <UserAvatar
                    src={profileAvatar}
                    alt={profileName || "Perfil"}
                    sizeClassName="h-[120px] w-[120px] md:h-[160px] md:w-[160px]"
                    iconClassName="h-10 w-10 md:h-12 md:w-12"
                  />
                  {isOwnProfile ? (
                    <span className="absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white bg-[#5A3EE7] text-white shadow-sm md:bottom-3 md:right-3 md:h-10 md:w-10">
                      <Pencil className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                    </span>
                  ) : null}
                </button>

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
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`${connectionsBaseHref}?tab=followers`)
                          }
                          className="whitespace-nowrap transition hover:text-zinc-900"
                        >
                          <span className="font-semibold text-zinc-900">
                            {statsLoading ? "..." : stats.followers}
                          </span>{" "}
                          seguidores
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`${connectionsBaseHref}?tab=following`)
                          }
                          className="whitespace-nowrap transition hover:text-zinc-900"
                        >
                          <span className="font-semibold text-zinc-900">
                            {statsLoading ? "..." : stats.following}
                          </span>{" "}
                          seguidos
                        </button>
                        <span className="whitespace-nowrap">
                          <span className="font-semibold text-zinc-900">
                            {statsLoading ? "..." : formatARS(earnings)}
                          </span>{" "}
                          ventas
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[30px] leading-none">
                      {profileGamificationBadges.map((badge, index) => (
                        <div
                          key={`profile-badge-${index}`}
                          className="group relative z-[80]"
                        >
                          <span className="inline-flex h-[30px] w-[30px] items-center justify-center">
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
                        <>
                          <button
                            type="button"
                            onClick={() => router.push("/settings")}
                            className="fanpush-button-secondary px-5 py-3"
                          >
                            Editar mi perfil
                          </button>
                          {canCreateContent ? (
                            <button
                              type="button"
                              onClick={() => router.push("/settings?tab=chat-content")}
                              className="fanpush-button-secondary px-5 py-3"
                            >
                              Contenido de chat
                            </button>
                          ) : null}
                        </>
                      ) : currentUserId && viewedUserId ? (
                        <>
                          <button
                            type="button"
                            onClick={toggleFollow}
                            disabled={followPending}
                            className={`rounded-[5px] px-5 py-3 text-[14px] font-semibold transition-colors ${
                              isFollowing
                                ? "fanpush-button-secondary"
                                : "bg-[#5A3EE7] text-white"
                            } ${followPending ? "cursor-wait opacity-60" : ""}`}
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
                              handleOpenTip();
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {profilePosts.length > 0 ? (
                  profilePosts.map((post) => {
                    const firstMedia = post.media[0];
                    if (!firstMedia) return null;
                    const viewerOwnsPost = post.mediaPostIds.some((postId) =>
                      purchasedPostIds.has(postId),
                    );
                    const isPaidPost =
                      Number(post.price ?? 0) > 0 ||
                      post.media.some((item) => item.locked);
                    const showLockedOverlay =
                      !isOwnProfile &&
                      isPaidPost &&
                      !viewerOwnsPost &&
                      post.media.some((item) => item.locked || !item.hasAccess);
                    return (
                      <div
                        key={post.id}
                        className="relative aspect-[280/370] min-w-0 w-full cursor-pointer overflow-hidden rounded-[5px] border border-zinc-200"
                        onClick={() => openPostFromProfile(post)}
                      >
                        {firstMedia.kind === "video" ? (
                          <video
                            src={firstMedia.url}
                            className="h-full w-full object-cover"
                            muted
                            autoPlay
                            loop
                            preload="metadata"
                            playsInline
                          />
                        ) : (
                          <MediaImage
                            src={firstMedia.url}
                            alt={profileName || "Post"}
                            className="h-full w-full object-cover"
                            fallbackClassName="h-full w-full border-0"
                            iconClassName="h-7 w-7"
                          />
                        )}
                        {isPaidPost ? (
                          isOwnProfile ? (
                            <div className="absolute right-2 top-2 rounded-[5px] bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-900 shadow-sm">
                              <span className="inline-flex items-center gap-1.5">
                                <Lock className="h-3 w-3" />
                                {Math.round(Number(post.price ?? 0)).toLocaleString("es-AR")}
                              </span>
                            </div>
                          ) : showLockedOverlay ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="rounded-[10px] bg-white/20 p-4 text-white shadow-sm backdrop-blur-[2px]">
                                <Lock className="h-8 w-8" strokeWidth={2.2} />
                              </div>
                            </div>
                          ) : null
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-2 rounded-[5px] border border-zinc-200 bg-zinc-50 p-6 sm:col-span-3 xl:col-span-5">
                    <div className="text-[24px] font-semibold text-zinc-900">
                      {isOwnProfile
                        ? "Todavía no hay posts"
                        : `${profileName || "Esta persona"} todavía no tiene posts`}
                    </div>
                    <p className="mt-3 max-w-[720px] text-[15px] leading-7 text-[#464646]">
                      {isOwnProfile
                        ? canCreateContent
                          ? "Todavía no subiste contenido. Cuando publiques tus primeros posteos, van a aparecer acá."
                          : "Todavía no tienes publicaciones. Conviértete en autor para empezar a subir contenido."
                        : "Si quieres seguir descubriendo creadores, puedes explorar otros perfiles."}
                    </p>
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isOwnProfile) {
                            router.push("/explorar");
                            return;
                          }
                          router.push(
                            canCreateContent ? "/crear" : "/autor/solicitud",
                          );
                        }}
                        className={
                          isOwnProfile && canCreateContent
                            ? "fanpush-button-primary px-5 py-3 text-[14px] font-semibold"
                            : "rounded-[5px] border border-zinc-200 bg-white px-5 py-3 text-[14px] font-semibold text-zinc-900 transition hover:bg-zinc-50"
                        }
                      >
                        {isOwnProfile
                          ? canCreateContent
                            ? "Comenzar a subir contenido"
                            : "Convertirme en autor"
                          : "Explorar perfiles"}
                      </button>
                    </div>
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
