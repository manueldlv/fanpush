import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import {
  buildPremiumMediaPath,
  inferDisplayKind,
  parseLockedPreviewPath,
  PREMIUM_MEDIA_BUCKET,
  PUBLIC_MEDIA_BUCKET,
} from "@/lib/media";

type AccessBody = {
  postIds?: string[];
};

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as AccessBody;
    const postIds = Array.from(new Set(body.postIds ?? [])).filter(Boolean);

    if (postIds.length === 0) {
      return NextResponse.json({ items: {} });
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

    const purchasedPostIds = new Set((purchases ?? []).map((row) => row.post_id));

    const resolvedEntries = await Promise.all(
      (posts ?? []).map(async (post) => {
        const canAccessPremium =
          Boolean(post.is_locked) &&
          (post.user_id === user.id || purchasedPostIds.has(post.id));

        if (canAccessPremium) {
          const parsed = parseLockedPreviewPath(post.media_url);
          if (parsed) {
            const premiumPath = buildPremiumMediaPath(
              post.user_id,
              parsed.token,
              parsed.originalExt,
            );
            const { data: signedData, error: signedError } = await admin.storage
              .from(PREMIUM_MEDIA_BUCKET)
              .createSignedUrl(premiumPath, 60 * 5);

            if (!signedError && signedData?.signedUrl) {
              return [
                post.id,
                {
                  url: signedData.signedUrl,
                  kind: inferDisplayKind(post.media_url, post.media_type, false),
                  locked: false,
                },
              ] as const;
            }
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
            kind: inferDisplayKind(post.media_url, post.media_type, post.is_locked),
            locked: Boolean(post.is_locked) && !canAccessPremium,
          },
        ] as const;
      }),
    );

    return NextResponse.json({
      items: Object.fromEntries(resolvedEntries),
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
