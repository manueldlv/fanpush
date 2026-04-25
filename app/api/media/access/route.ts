import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import {
  buildPremiumMediaPath,
  inferDisplayKind,
  parseLockedPreviewPath,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";
import { createSignedUrlMap } from "@/lib/server/storage";

type AccessBody = {
  postIds?: string[];
};

const MAX_POST_IDS = 50;

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as AccessBody;
    const postIds = Array.from(new Set(body.postIds ?? [])).filter(Boolean);

    if (postIds.length === 0) {
      return NextResponse.json({ items: {} });
    }

    if (postIds.length > MAX_POST_IDS) {
      return NextResponse.json(
        {
          error: `Solo puedes consultar hasta ${MAX_POST_IDS} publicaciones por vez.`,
        },
        { status: 400 },
      );
    }

    const { data: posts, error: postsError } = await admin
      .from("posts")
      .select("id,user_id,media_url,media_type,is_locked")
      .in("id", postIds);

    if (postsError) throw new Error(postsError.message);

    const lockedPostIds = (posts ?? [])
      .filter((post) => post.is_locked)
      .map((post) => post.id);

    const { data: purchases, error: purchasesError } = lockedPostIds.length
      ? await admin
          .from("purchases")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", lockedPostIds)
      : { data: [], error: null };

    if (purchasesError) throw new Error(purchasesError.message);

    const purchasedPostIds = new Set(
      (purchases ?? []).map((row) => row.post_id),
    );
    const premiumPathByPostId = new Map<string, string>();

    for (const post of posts ?? []) {
      const canAccessPremium =
        Boolean(post.is_locked) &&
        (post.user_id === user.id || purchasedPostIds.has(post.id));
      if (!canAccessPremium) continue;

      const parsed = parseLockedPreviewPath(post.media_url);
      if (!parsed) continue;

      premiumPathByPostId.set(
        post.id,
        buildPremiumMediaPath(post.user_id, parsed.token, parsed.originalExt),
      );
    }

    const signedPremiumUrls = await createSignedUrlMap({
      admin,
      bucket: PREMIUM_MEDIA_BUCKET,
      paths: Array.from(premiumPathByPostId.values()),
      expiresIn: 60 * 5,
    });

    const resolvedEntries = (posts ?? []).map((post) => {
      const canAccessPremium =
        Boolean(post.is_locked) &&
        (post.user_id === user.id || purchasedPostIds.has(post.id));

      if (canAccessPremium) {
        const premiumPath = premiumPathByPostId.get(post.id);
        const signedUrl = premiumPath
          ? signedPremiumUrls.get(premiumPath)
          : null;
        if (signedUrl) {
          return [
            post.id,
            {
              url: signedUrl,
              kind: inferDisplayKind(post.media_url, post.media_type, false),
              locked: false,
            },
          ] as const;
        }
      }

      if (!post.media_url) {
        return [
          post.id,
          {
            url: "",
            kind: inferDisplayKind(
              post.media_url,
              post.media_type,
              post.is_locked,
            ),
            locked: Boolean(post.is_locked) && !canAccessPremium,
          },
        ] as const;
      }

      const { data: publicUrl } = admin.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .getPublicUrl(post.media_url);

      return [
        post.id,
        {
          url: publicUrl.publicUrl,
          kind: inferDisplayKind(
            post.media_url,
            post.media_type,
            post.is_locked,
          ),
          locked: Boolean(post.is_locked) && !canAccessPremium,
        },
      ] as const;
    });

    const requestedFallbackEntries = postIds
      .filter((postId) => !(posts ?? []).some((post) => post.id === postId))
      .map(
        (postId) =>
          [
            postId,
            {
              url: "",
              kind: "image" as const,
              locked: true,
            },
          ] as const,
      );

    return NextResponse.json({
      items: Object.fromEntries([
        ...resolvedEntries,
        ...requestedFallbackEntries,
      ]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo resolver el acceso al contenido.",
      },
      { status: 500 },
    );
  }
}
