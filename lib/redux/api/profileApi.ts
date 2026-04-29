import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  coerceAccountState,
  getUnavailableAccountMessage,
  isPubliclyUnavailableAccount,
} from "@/lib/accountState";
import {
  getSessionAccessTokenWithRetry,
  PURCHASE_REFRESH_FLAG,
} from "@/lib/auth";
import { parseUploadModerationMeta } from "@/lib/contentClassification";
import {
  coerceProfileDetails,
  parseProfileDetails,
} from "@/lib/profileDetails";
import { resolveBadgeSlugs } from "@/lib/badges";
import { getReferralLevel } from "@/lib/referrals";
import { inferDisplayKind, PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import {
  applyResolvedMediaAccess,
  buildInitialPostMediaState,
  type ResolvedAccessMedia,
} from "@/lib/postMediaState";
import { ensureUserRow, getSupabaseClient } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/time";
import { getUserMetaEntries, USER_META_KEYS } from "@/lib/userMeta";
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

type ProfileViewStats = {
  posts: number;
  followers: number;
  following: number;
};

type ProfileSummary = {
  username: string;
  fullName: string;
  avatar: string;
  bio: string;
  website: string;
  instagram: string;
  badges: string[];
};

export type ProfileViewArg = {
  userId?: string | null;
  username?: string | null;
};

export type ProfileViewData = {
  currentUserId: string | null;
  viewedUserId: string | null;
  profile: ProfileSummary;
  posts: Post[];
  stats: ProfileViewStats;
  isFollowing: boolean;
  earnings: number;
  referralCount: number;
  referralLevel: number;
};

const PROFILE_ALBUM_LIMIT = 60;
const MEDIA_ACCESS_BATCH_SIZE = 50;

const emptyStats = (): ProfileViewStats => ({
  posts: 0,
  followers: 0,
  following: 0,
});

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

  const baseDescription = (description ?? "").trim() || meta.displayCaption.trim();
  return [baseDescription, tagSuffix]
    .filter(Boolean)
    .join(" ")
    .trim();
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

const resolvePublicUrl = async (
  value: string | null,
  bucket = PUBLIC_MEDIA_BUCKET,
) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  const supabase = getSupabaseClient();
  if (!supabase) return value;
  const { data } = supabase.storage.from(bucket).getPublicUrl(value);
  return data.publicUrl;
};

const resolveAccessibleMedia = async (
  accessToken: string,
  incomingPosts: Post[],
) => {
  const allPostIds = Array.from(
    new Set(incomingPosts.flatMap((post) => post.mediaPostIds).filter(Boolean)),
  );
  if (allPostIds.length === 0) return incomingPosts;

  const batches = Array.from(
    { length: Math.ceil(allPostIds.length / MEDIA_ACCESS_BATCH_SIZE) },
    (_, index) =>
      allPostIds.slice(
        index * MEDIA_ACCESS_BATCH_SIZE,
        (index + 1) * MEDIA_ACCESS_BATCH_SIZE,
      ),
  );
  const resolvedItems: Record<string, ResolvedAccessMedia> = {};

  await Promise.all(
    batches.map(async (postIds) => {
      const response = await fetch("/api/media/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ postIds }),
      });

      if (!response.ok) return;

      const result = (await response.json()) as {
        items?: Record<string, ResolvedAccessMedia>;
      };
      Object.assign(resolvedItems, result.items ?? {});
    }),
  );

  return incomingPosts.map((post) => ({
    ...post,
    media: post.media.map((item, index): Post["media"][number] => {
      const postId = post.mediaPostIds[index];
      const resolved = postId ? resolvedItems[postId] : null;
      return applyResolvedMediaAccess(item, resolved);
    }),
  }));
};

const buildEmptyProfileView = (
  arg: ProfileViewArg,
  fallbackUsername = "usuario",
): ProfileViewData => ({
  currentUserId: null,
  viewedUserId: null,
  profile: {
    username: arg.username?.trim() || fallbackUsername,
    fullName: "Sin nombre",
    avatar: "",
    bio: "",
    website: "",
    instagram: "",
    badges: [],
  },
  posts: [],
  stats: emptyStats(),
  isFollowing: false,
  earnings: 0,
  referralCount: 0,
  referralLevel: 1,
});

const buildUnavailableProfileView = ({
  arg,
  currentUserId,
  viewedUserId,
  username,
  blockedReason,
}: {
  arg: ProfileViewArg;
  currentUserId: string | null;
  viewedUserId: string;
  username: string;
  blockedReason: string | null;
}): ProfileViewData => ({
  currentUserId,
  viewedUserId,
  profile: {
    username: username || arg.username?.trim() || "usuario",
    fullName: "Perfil no disponible",
    avatar: "",
    bio: getUnavailableAccountMessage(
      coerceAccountState({
        isBlocked: true,
        blockedReason,
      }),
    ),
    website: "",
    instagram: "",
    badges: [],
  },
  posts: [],
  stats: emptyStats(),
  isFollowing: false,
  earnings: 0,
  referralCount: 0,
  referralLevel: 1,
});

export const getProfileViewCacheKey = (arg: ProfileViewArg) => {
  if (arg.userId?.trim()) return `id:${arg.userId.trim()}`;
  if (arg.username?.trim())
    return `username:${arg.username.trim().toLowerCase()}`;
  return "self";
};

const loadProfileView = async (
  arg: ProfileViewArg,
): Promise<ProfileViewData> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return buildEmptyProfileView(arg);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authUser = session?.user ?? null;
  const currentUserId = authUser?.id ?? null;
  const fallbackUsername = resolveFallbackUsername(
    authUser?.email,
    authUser?.user_metadata,
  );

  let viewedUserId: string | null = null;
  let userRow: {
    id?: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null = null;

  if (arg.userId?.trim()) {
    viewedUserId = arg.userId.trim();
    const { data } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .eq("id", viewedUserId)
      .maybeSingle();
    userRow = data
      ? {
          id: data.id ?? null,
          username: data.username ?? null,
          avatar_url: data.avatar_url ?? null,
        }
      : null;
  } else if (arg.username?.trim()) {
    const { data } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .eq("username", arg.username.trim())
      .maybeSingle();
    if (data) {
      viewedUserId = data.id ?? null;
      userRow = {
        id: data.id ?? null,
        username: data.username ?? null,
        avatar_url: data.avatar_url ?? null,
      };
    } else if (
      currentUserId &&
      arg.username.trim().toLowerCase() ===
        fallbackUsername.trim().toLowerCase()
    ) {
      viewedUserId = currentUserId;
      await ensureUserRow(supabase, authUser);
    } else {
      viewedUserId = null;
      userRow = null;
    }
  } else if (currentUserId) {
    viewedUserId = currentUserId;
    await ensureUserRow(supabase, authUser);
  }

  if (!viewedUserId) {
    return {
      ...buildEmptyProfileView(arg, fallbackUsername),
      currentUserId,
    };
  }

  if (!userRow) {
    const { data } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .eq("id", viewedUserId)
      .maybeSingle();
    userRow = data
      ? {
          id: data.id ?? null,
          username: data.username ?? null,
          avatar_url: data.avatar_url ?? null,
        }
      : null;
  }

  const [
    profileRowResult,
    userMetaResult,
    albumsResult,
    postsCountResult,
    followersRowsResult,
    followingRowsResult,
    referralCountResult,
    authorPromotionResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", viewedUserId)
      .maybeSingle(),
    getUserMetaEntries(supabase, viewedUserId, [
      USER_META_KEYS.profileDetails,
      USER_META_KEYS.accountState,
    ]),
    supabase
      .from("albums")
      .select(
        "id,user_id,description,price,visibility,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count,caption))",
      )
      .eq("user_id", viewedUserId)
      .eq("visibility", "published")
      .order("created_at", { ascending: false })
      .limit(PROFILE_ALBUM_LIMIT),
    supabase
      .from("albums")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewedUserId)
      .eq("visibility", "published"),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", viewedUserId),
    supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", viewedUserId),
    supabase
      .from("user_referrals")
      .select("referred_user_id", { count: "exact", head: true })
      .eq("referrer_user_id", viewedUserId),
    supabase
      .from("author_promotions")
      .select(
        "user_id,is_active,promote_in_feed,promote_in_suggestions,promote_in_explore",
      )
      .eq("user_id", viewedUserId)
      .maybeSingle(),
  ]);

  const profileDetails = coerceProfileDetails(
    userMetaResult.entries.get(USER_META_KEYS.profileDetails),
  );
  const accountState = coerceAccountState(
    userMetaResult.entries.get(USER_META_KEYS.accountState),
  );

  if (
    currentUserId !== viewedUserId &&
    isPubliclyUnavailableAccount(accountState)
  ) {
    return buildUnavailableProfileView({
      arg,
      currentUserId,
      viewedUserId,
      username: userRow?.username ?? arg.username?.trim() ?? fallbackUsername,
      blockedReason: accountState.blockedReason,
    });
  }

  const resolvedAvatar = await resolvePublicUrl(userRow?.avatar_url ?? "");
  const referralCount = referralCountResult.count ?? 0;
  const referralLevel = getReferralLevel(referralCount);
  const promotionRow = authorPromotionResult.data;
  const hasActivePromotion = Boolean(
    promotionRow &&
      promotionRow.is_active !== false &&
      (promotionRow.promote_in_feed ||
        promotionRow.promote_in_suggestions ||
        promotionRow.promote_in_explore),
  );
  const profile: ProfileSummary = {
    username: userRow?.username ?? arg.username?.trim() ?? fallbackUsername,
    fullName: profileRowResult.data?.full_name ?? "Sin nombre",
    avatar: resolvedAvatar,
    bio: profileDetails?.bio ?? "",
    website: profileDetails?.website ?? "",
    instagram: profileDetails?.instagram ?? "",
    badges: [],
  };

  let posts: Post[] = [];
  const albums = albumsResult.data ?? [];
  const legacyPosts =
    albums.length === 0
      ? ((
          await supabase
            .from("posts")
            .select("id,media_url,media_type,is_locked,likes_count,created_at")
            .eq("user_id", viewedUserId)
            .order("created_at", { ascending: false })
            .limit(PROFILE_ALBUM_LIMIT)
        ).data ?? [])
      : [];

  const allMediaPostIds = [
    ...albums.flatMap((album) =>
      normalizeAlbumMedia(
        album.album_posts as AlbumPostRow[] | null | undefined,
      ).map((item) => item.id ?? ""),
    ),
    ...legacyPosts.map((post) => post.id ?? ""),
  ].filter(Boolean);

  const { data: allLikesRows } = allMediaPostIds.length
    ? await supabase
        .from("likes")
        .select("post_id")
        .in("post_id", allMediaPostIds)
    : { data: [] };
  const likesByPostId = buildLikesCountMap(allLikesRows);

  if (albums.length > 0) {
    posts = await Promise.all(
      albums.map(async (album) => {
        const media = normalizeAlbumMedia(
          album.album_posts as AlbumPostRow[] | null | undefined,
        );
        const albumUser = normalizeAlbumUser(
          album.users as AlbumUser | AlbumUser[] | null | undefined,
        );
        const mediaWithUrls: Post["media"] = await Promise.all(
          media.map(async (item) =>
            buildInitialPostMediaState({
              previewUrl: await resolvePublicUrl(item?.media_url ?? ""),
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
        const avatarUrl = await resolvePublicUrl(
          albumUser?.avatar_url ?? userRow?.avatar_url ?? "",
        );
        const normalizedCaption = buildProfileCaption(
          album.description ?? "",
          media[0]?.caption ?? null,
        );
        return {
          id: album.id,
          userId: album.user_id ?? viewedUserId,
          mediaPostIds,
          author:
            albumUser?.username ??
            userRow?.username ??
            profile.username ??
            "usuario",
          verified: false,
          time: formatRelativeTime(album.created_at ?? media[0]?.created_at ?? ""),
          suggestion: "Perfil",
          caption: normalizedCaption,
          likes: media.reduce(
            (sum, item) => sum + (likesByPostId.get(item.id ?? "") ?? 0),
            0,
          ),
          avatar: avatarUrl || null,
          price: album.price ?? 0,
          tipEnabled: postMeta?.tipsEnabled ?? false,
          media: mediaWithUrls,
        } satisfies Post;
      }),
    );
  } else {
    const avatarUrl = await resolvePublicUrl(userRow?.avatar_url ?? "");
    posts = await Promise.all(
      (legacyPosts ?? []).map(
        async (post) =>
          ({
            id: post.id,
            userId: viewedUserId,
            mediaPostIds: [post.id],
            author: userRow?.username ?? profile.username ?? "usuario",
            verified: false,
            time: formatRelativeTime(post.created_at ?? ""),
            suggestion: "Perfil",
            caption: "",
            likes: likesByPostId.get(post.id ?? "") ?? 0,
            avatar: avatarUrl || null,
            price: 0,
            tipEnabled: false,
            media: [
              buildInitialPostMediaState({
                previewUrl: await resolvePublicUrl(post.media_url),
                previewKind: inferDisplayKind(
                  post.media_url,
                  post.media_type,
                  post.is_locked,
                ),
                locked: post.is_locked ?? false,
              }),
            ],
          }) satisfies Post,
      ),
    );
  }

  const accessToken = await getSessionAccessTokenWithRetry(supabase);
  if (accessToken && posts.length > 0) {
    posts = await resolveAccessibleMedia(accessToken, posts);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PURCHASE_REFRESH_FLAG);
    }
  }

  let isFollowing = false;
  if (currentUserId && viewedUserId && currentUserId !== viewedUserId) {
    const { data: followRows } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUserId)
      .eq("following_id", viewedUserId)
      .limit(1);
    isFollowing = Boolean(followRows?.length);
  }
  let earnings = 0;
  if (
    currentUserId &&
    viewedUserId &&
    currentUserId === viewedUserId &&
    accessToken
  ) {
    try {
      const viewerResponse = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
      const viewerResult = (await viewerResponse.json()) as {
        viewer?: {
          commerce?: {
            lifetimeEarned?: number | null;
          };
      };
      };
      if (viewerResponse.ok) {
        earnings = Number(viewerResult.viewer?.commerce?.lifetimeEarned ?? 0);
      }
    } catch {
      earnings = 0;
    }
  }

  try {
    const badgeResponse = await fetch(
      `/api/profile-badges?userId=${encodeURIComponent(viewedUserId)}`,
      { cache: "no-store" },
    );
    const badgeResult = (await badgeResponse.json()) as { badges?: string[] };
    if (badgeResponse.ok && Array.isArray(badgeResult.badges)) {
      profile.badges = badgeResult.badges;
    } else {
      profile.badges = resolveBadgeSlugs({
        persistedBadges: accountState.badges,
        lifetimeEarnedArs: currentUserId === viewedUserId ? earnings : null,
        referralCount,
        hasActivePromotion,
        isFeatured: accountState.isFeatured,
      });
    }
  } catch {
    profile.badges = resolveBadgeSlugs({
      persistedBadges: accountState.badges,
      lifetimeEarnedArs: currentUserId === viewedUserId ? earnings : null,
      referralCount,
      hasActivePromotion,
      isFeatured: accountState.isFeatured,
    });
  }

  return {
    currentUserId,
    viewedUserId,
    profile,
    posts,
    stats: {
      posts: postsCountResult.count ?? 0,
      followers: followersRowsResult.count ?? 0,
      following: followingRowsResult.count ?? 0,
    },
    isFollowing,
    earnings,
    referralCount,
    referralLevel,
  };
};

export const profileApi = createApi({
  reducerPath: "profileApi",
  baseQuery: fakeBaseQuery<{ error: string }>(),
  tagTypes: ["ProfileView"],
  endpoints: (builder) => ({
    getProfileView: builder.query<ProfileViewData, ProfileViewArg>({
      async queryFn(arg) {
        try {
          const data = await loadProfileView(arg);
          return { data };
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error
                  ? error.message
                  : "No se pudo cargar el perfil.",
            },
          };
        }
      },
      keepUnusedDataFor: 300,
      providesTags: (_result, _error, arg) => [
        { type: "ProfileView", id: getProfileViewCacheKey(arg) },
      ],
    }),
  }),
});

export const { useGetProfileViewQuery } = profileApi;
