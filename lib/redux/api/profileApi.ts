import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  getSessionAccessTokenWithRetry,
  PURCHASE_REFRESH_FLAG,
} from "@/lib/auth";
import { loadCreatorEarnings } from "@/lib/earnings";
import { parseProfileDetails } from "@/lib/profileDetails";
import { inferDisplayKind, PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import {
  applyResolvedMediaAccess,
  buildInitialPostMediaState,
  type ResolvedAccessMedia,
} from "@/lib/postMediaState";
import { ensureUserRow, getSupabaseClient } from "@/lib/supabase";
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
};

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
  return Array.isArray(user) ? user[0] ?? null : user;
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
  },
  posts: [],
  stats: emptyStats(),
  isFollowing: false,
  earnings: 0,
});

export const getProfileViewCacheKey = (arg: ProfileViewArg) => {
  if (arg.userId?.trim()) return `id:${arg.userId.trim()}`;
  if (arg.username?.trim()) return `username:${arg.username.trim().toLowerCase()}`;
  return "self";
};

const loadProfileView = async (arg: ProfileViewArg): Promise<ProfileViewData> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return buildEmptyProfileView(arg);
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const currentUserId = authUser?.id ?? null;
  const fallbackUsername = resolveFallbackUsername(
    authUser?.email,
    authUser?.user_metadata,
  );

  let viewedUserId: string | null = null;
  let userRow:
    | {
        id?: string | null;
        username: string | null;
        avatar_url: string | null;
      }
    | null = null;

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
    viewedUserId = data?.id ?? null;
    userRow = data
      ? {
          id: data.id ?? null,
          username: data.username ?? null,
          avatar_url: data.avatar_url ?? null,
        }
      : null;
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
    profileMetaRowResult,
    albumsResult,
    postsCountResult,
    followersCountResult,
    followingCountResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", viewedUserId)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("message")
      .eq("user_id", viewedUserId)
      .eq("type", "profile_meta")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("albums")
      .select(
        "id,user_id,description,price,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count))",
      )
      .eq("user_id", viewedUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("albums")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewedUserId),
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", viewedUserId),
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", viewedUserId),
  ]);

  const profileDetails = parseProfileDetails(profileMetaRowResult.data?.message);
  const resolvedAvatar = await resolvePublicUrl(userRow?.avatar_url ?? "");
  const profile: ProfileSummary = {
    username: userRow?.username ?? arg.username?.trim() ?? fallbackUsername,
    fullName: profileRowResult.data?.full_name ?? "Sin nombre",
    avatar: resolvedAvatar,
    bio: profileDetails?.bio ?? "",
    website: profileDetails?.website ?? "",
    instagram: profileDetails?.instagram ?? "",
  };

  let posts: Post[] = [];
  const albums = albumsResult.data ?? [];

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
        const avatarUrl = await resolvePublicUrl(
          albumUser?.avatar_url ?? userRow?.avatar_url ?? "",
        );
        return {
          id: album.id,
          userId: album.user_id ?? viewedUserId,
          mediaPostIds,
          author:
            albumUser?.username ?? userRow?.username ?? profile.username ?? "usuario",
          verified: false,
          time: "Ahora",
          suggestion: "Perfil",
          caption: album.description ?? "",
          likes: media.reduce((sum, item) => sum + (item.likes_count ?? 0), 0),
          avatar: avatarUrl || null,
          price: album.price ?? 0,
          media: mediaWithUrls,
        } satisfies Post;
      }),
    );
  } else {
    const { data: legacyPosts } = await supabase
      .from("posts")
      .select("id,media_url,media_type,is_locked,likes_count,created_at")
      .eq("user_id", viewedUserId)
      .order("created_at", { ascending: false });
    const avatarUrl = await resolvePublicUrl(userRow?.avatar_url ?? "");
    posts = await Promise.all(
      (legacyPosts ?? []).map(async (post) => ({
        id: post.id,
        userId: viewedUserId,
        mediaPostIds: [post.id],
        author: userRow?.username ?? profile.username ?? "usuario",
        verified: false,
        time: "Ahora",
        suggestion: "Perfil",
        caption: "",
        likes: post.likes_count ?? 0,
        avatar: avatarUrl || null,
        price: 0,
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
      }) satisfies Post),
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
    const { data: followRow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", currentUserId)
      .eq("following_id", viewedUserId)
      .maybeSingle();
    isFollowing = Boolean(followRow);
  }

  const earningsSummary = await loadCreatorEarnings(supabase, viewedUserId);

  return {
    currentUserId,
    viewedUserId,
    profile,
    posts,
    stats: {
      posts: postsCountResult.count ?? 0,
      followers: followersCountResult.count ?? 0,
      following: followingCountResult.count ?? 0,
    },
    isFollowing,
    earnings: earningsSummary.creatorNet,
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
