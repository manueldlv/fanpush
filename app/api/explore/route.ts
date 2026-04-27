import { NextResponse } from "next/server";
import { getBearerToken, getAdminSupabase } from "@/lib/server/auth/session";

type AuthorRoleRow = {
  user_id: string | null;
};

type UserRow = {
  id: string | null;
  username: string | null;
  avatar_url: string | null;
};

type AuthorAlbumPost = {
  post_id?: string | null;
  post:
    | {
        id?: string | null;
        media_url: string | null;
        media_type: string | null;
        is_locked: boolean | null;
        created_at: string | null;
      }
    | Array<{
        id?: string | null;
        media_url: string | null;
        media_type: string | null;
        is_locked: boolean | null;
        created_at: string | null;
      }>
    | null;
};

type AuthorAlbumRow = {
  user_id: string | null;
  description: string | null;
  created_at: string | null;
  album_posts: AuthorAlbumPost[] | null;
};

type ExplorePromotionRow = {
  user_id: string | null;
  is_active: boolean | null;
  promote_in_explore: boolean | null;
  explore_rank: number | null;
};

const EXPLORE_AUTHOR_LIMIT = 80;
const EXPLORE_ALBUM_LIMIT = 160;
const EXPLORE_PURCHASE_LOOKBACK_LIMIT = 1000;

const normalizeAlbumPost = (
  value: AuthorAlbumPost["post"],
): NonNullable<AuthorAlbumPost["post"]> extends Array<infer T>
  ? T | null
  : never =>
  (Array.isArray(value) ? (value[0] ?? null) : value) as never;

const pickRandomItem = <T>(items: T[]) => {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
};

export async function GET(request: Request) {
  try {
    const admin = getAdminSupabase();
    if (!admin) {
      return NextResponse.json(
        { error: "No se pudo inicializar Supabase." },
        { status: 500 },
      );
    }

    const accessToken = getBearerToken(request.headers.get("authorization"));
    const currentUserId = accessToken
      ? (
          await admin.auth.getUser(accessToken)
        ).data.user?.id ?? null
      : null;

    const { data: authorRoles, error: authorRolesError } = await admin
      .from("user_roles")
      .select("user_id, role:roles!inner(code)")
      .eq("role.code", "author")
      .is("revoked_at", null)
      .limit(EXPLORE_AUTHOR_LIMIT);

    if (authorRolesError) {
      throw new Error(authorRolesError.message);
    }

    const authorIds = Array.from(
      new Set(
        ((authorRoles ?? []) as AuthorRoleRow[])
          .map((row) => row.user_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (authorIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const followedIds = new Set<string>();
    if (currentUserId) {
      const { data: followRows, error: followRowsError } = await admin
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      if (followRowsError) {
        throw new Error(followRowsError.message);
      }

      (followRows ?? []).forEach((row) => {
        if (row.following_id) followedIds.add(row.following_id);
      });
    }

    const { data: promotionRows, error: promotionRowsError } = await admin
      .from("author_promotions")
      .select("user_id,is_active,promote_in_explore,explore_rank")
      .eq("is_active", true)
      .eq("promote_in_explore", true);

    if (promotionRowsError) {
      throw new Error(promotionRowsError.message);
    }

    const [
      { data: users, error: usersError },
      { data: albums, error: albumsError },
    ] = await Promise.all([
      admin.from("users").select("id,username,avatar_url").in("id", authorIds),
      admin
        .from("albums")
        .select(
          "id,user_id,description,created_at,album_posts(post_id,post:posts(id,media_url,media_type,is_locked,created_at))",
        )
        .eq("visibility", "published")
        .in("user_id", authorIds)
        .order("created_at", { ascending: false })
        .limit(EXPLORE_ALBUM_LIMIT),
    ]);

    if (usersError) throw new Error(usersError.message);
    if (albumsError) throw new Error(albumsError.message);

    const explorePromotionMap = new Map<string, number>();
    for (const row of (promotionRows ?? []) as ExplorePromotionRow[]) {
      if (!row.user_id || !row.promote_in_explore || row.is_active === false) continue;
      explorePromotionMap.set(row.user_id, Number(row.explore_rank ?? 9999));
    }

    const albumsByUserId = new Map<string, AuthorAlbumRow[]>();
    const candidatePostIds: string[] = [];

    for (const album of (albums ?? []) as AuthorAlbumRow[]) {
      const userId = album.user_id ?? "";
      if (!userId) continue;

      const current = albumsByUserId.get(userId) ?? [];
      current.push(album);
      albumsByUserId.set(userId, current);

      for (const item of album.album_posts ?? []) {
        const post = normalizeAlbumPost(item.post);
        const postId = post?.id ?? item.post_id ?? null;
        if (postId) candidatePostIds.push(postId);
      }
    }

    const { data: purchases, error: purchasesError } = candidatePostIds.length
      ? await admin
          .from("purchases")
          .select("post_id")
          .in("post_id", Array.from(new Set(candidatePostIds)))
          .limit(EXPLORE_PURCHASE_LOOKBACK_LIMIT)
      : { data: [], error: null };

    if (purchasesError) {
      throw new Error(purchasesError.message);
    }

    const purchaseCountByPostId = new Map<string, number>();
    for (const row of purchases ?? []) {
      const postId = typeof row.post_id === "string" ? row.post_id : null;
      if (!postId) continue;
      purchaseCountByPostId.set(
        postId,
        (purchaseCountByPostId.get(postId) ?? 0) + 1,
      );
    }

    const items = ((users ?? []) as UserRow[])
      .map((user) => {
        const userId = user.id ?? "";
        if (!userId || !user.username?.trim()) return null;
        if (currentUserId && userId === currentUserId) return null;

        const userAlbums = albumsByUserId.get(userId) ?? [];
        const postCandidates = userAlbums.flatMap((album) =>
          (album.album_posts ?? [])
            .map((item) => {
              const post = normalizeAlbumPost(item.post);
              const postId = post?.id ?? item.post_id ?? null;
              if (!postId || !post?.media_url) return null;
              if (post.is_locked) return null;
              return {
                postId,
                mediaUrl: post.media_url,
                mediaType: post.media_type ?? "image",
                description: album.description ?? "",
                createdAt: post.created_at ?? album.created_at ?? "",
              };
            })
            .filter(Boolean) as Array<{
            postId: string;
            mediaUrl: string;
            mediaType: string;
            description: string;
            createdAt: string;
          }>,
        );

        if (postCandidates.length === 0) {
          return null;
        }

        const topSellingPost = [...postCandidates].sort((a, b) => {
          const purchaseDiff =
            (purchaseCountByPostId.get(b.postId) ?? 0) -
            (purchaseCountByPostId.get(a.postId) ?? 0);
          if (purchaseDiff !== 0) return purchaseDiff;

          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })[0];

        const fallbackPost = pickRandomItem(postCandidates);
        const coverPost =
          (topSellingPost &&
          (purchaseCountByPostId.get(topSellingPost.postId) ?? 0) > 0
            ? topSellingPost
            : fallbackPost) ?? null;

        if (!coverPost) {
          return null;
        }

        return {
          id: userId,
          mediaUrl: coverPost.mediaUrl,
          mediaType: coverPost.mediaType,
          username: user.username.trim(),
          avatar: user.avatar_url ?? null,
          description: coverPost.description,
          createdAt: coverPost.createdAt,
          isFollowing: followedIds.has(userId),
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      mediaUrl: string | null;
      mediaType: string;
      username: string;
      avatar: string | null;
      description: string;
      createdAt: string;
      isFollowing: boolean;
    }>;

    items.sort((a, b) => {
      const aRank = explorePromotionMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = explorePromotionMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar exploración.",
      },
      { status: 500 },
    );
  }
}
