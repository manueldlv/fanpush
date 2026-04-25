import { NextResponse } from "next/server";
import {
  inferDisplayKind,
  PUBLIC_MEDIA_BUCKET,
  PREMIUM_MEDIA_BUCKET,
} from "@/lib/media";
import { parseTipNoteFromMessage, resolveTipAmountMap } from "@/lib/earnings";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { createSignedUrlMap } from "@/lib/server/storage";

type PurchaseResponseItem = {
  id: string;
  title: string;
  creator: string;
  date: string;
  price: number;
  cover: string;
  covers: string[];
  media: { url: string; kind: "image" | "video" }[];
  status: string;
  source: "post" | "chat";
  createdAt: string;
};

type SentTipResponseItem = {
  id: string;
  recipient: string;
  recipientAvatar: string | null;
  date: string;
  amount: number;
  message: string;
  createdAt: string;
};

const PURCHASE_HISTORY_LIMIT = 100;
const TIP_HISTORY_LIMIT = 100;

const resolvePublicUrl = (
  admin: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["admin"]>,
  value: string | null,
) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return admin.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data
    .publicUrl;
};

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: 401 },
      );
    }

    const { data: purchaseRows, error: purchaseError } = await admin
      .from("purchases")
      .select("id,post_id,payment_id,amount,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PURCHASE_HISTORY_LIMIT);

    if (purchaseError) throw new Error(purchaseError.message);

    const { data: directMessagePurchaseRows, error: directPurchaseError } =
      await admin
        .from("direct_message_purchases")
        .select("message_id,amount,created_at")
        .eq("buyer_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(PURCHASE_HISTORY_LIMIT);

    if (directPurchaseError) throw new Error(directPurchaseError.message);

    const postIds = Array.from(
      new Set((purchaseRows ?? []).map((row) => row.post_id)),
    );
    const directMessageIds = Array.from(
      new Set((directMessagePurchaseRows ?? []).map((row) => row.message_id)),
    );

    const { data: postRows, error: postsError } = postIds.length
      ? await admin
          .from("posts")
          .select(
            "id,user_id,media_url,media_type,is_locked,caption,album_posts(album_id)",
          )
          .in("id", postIds)
      : { data: [], error: null };

    if (postsError) throw new Error(postsError.message);

    const { data: directMessageRows, error: directMessagesError } =
      directMessageIds.length
        ? await admin
            .from("direct_messages")
            .select("id,sender_id,metadata,created_at")
            .in("id", directMessageIds)
        : { data: [], error: null };

    if (directMessagesError) throw new Error(directMessagesError.message);

    const creatorIds = Array.from(
      new Set((postRows ?? []).map((row) => row.user_id)),
    );
    const directCreatorIds = Array.from(
      new Set((directMessageRows ?? []).map((row) => row.sender_id)),
    );

    const { data: creators, error: creatorsError } = creatorIds.length
      ? await admin
          .from("users")
          .select("id,username,avatar_url")
          .in("id", creatorIds)
      : { data: [], error: null };

    if (creatorsError) throw new Error(creatorsError.message);

    const { data: directCreators, error: directCreatorsError } =
      directCreatorIds.length
        ? await admin
            .from("users")
            .select("id,username,avatar_url")
            .in("id", directCreatorIds)
        : { data: [], error: null };

    if (directCreatorsError) throw new Error(directCreatorsError.message);

    const creatorMap = new Map(
      [...(creators ?? []), ...(directCreators ?? [])].map((row) => [
        row.id,
        {
          username: row.username ?? "usuario",
          avatar: resolvePublicUrl(admin, row.avatar_url ?? null),
        },
      ]),
    );

    const postMap = new Map((postRows ?? []).map((row) => [row.id, row]));
    const directMessageMap = new Map(
      (directMessageRows ?? []).map((row) => [row.id, row]),
    );
    const directPremiumPaths = (directMessageRows ?? []).flatMap((message) => {
      const attachments = Array.isArray((message.metadata as any)?.attachments)
        ? ((message.metadata as any).attachments as Array<
            Record<string, unknown>
          >)
        : [];
      return attachments
        .map((item) =>
          typeof item.premiumPath === "string" ? item.premiumPath : null,
        )
        .filter((path): path is string => Boolean(path));
    });
    const directSignedPremiumUrls = await createSignedUrlMap({
      admin,
      bucket: PREMIUM_MEDIA_BUCKET,
      paths: directPremiumPaths,
      expiresIn: 60 * 5,
    });

    const albumIds = Array.from(
      new Set(
        (postRows ?? [])
          .map((row) => row.album_posts?.[0]?.album_id)
          .filter(Boolean) as string[],
      ),
    );

    const { data: albumRows, error: albumsError } = albumIds.length
      ? await admin
          .from("albums")
          .select(
            "id,description,price,album_posts(post_id,post:posts(id,media_url,media_type,is_locked))",
          )
          .in("id", albumIds)
      : { data: [], error: null };

    if (albumsError) throw new Error(albumsError.message);

    const albumMap = new Map((albumRows ?? []).map((row) => [row.id, row]));

    const normalizedPurchaseRows = (purchaseRows ?? []).map((row) => {
      const post = postMap.get(row.post_id);
      return {
        ...row,
        album_id: post?.album_posts?.[0]?.album_id ?? row.post_id,
      };
    });

    const groupedPurchaseRows = new Map<
      string,
      {
        id: string;
        post_id: string;
        payment_id: string | null;
        amount: number | null;
        status: string | null;
        created_at: string;
        album_id: string;
      }
    >();

    normalizedPurchaseRows.forEach((row) => {
      const current = groupedPurchaseRows.get(row.album_id);
      if (!current) {
        groupedPurchaseRows.set(row.album_id, row);
        return;
      }

      const currentAmount = Number(current.amount || 0);
      const nextAmount = Number(row.amount || 0);
      const currentCreatedAt = new Date(current.created_at).getTime();
      const nextCreatedAt = new Date(row.created_at).getTime();

      if (
        nextAmount > currentAmount ||
        (nextAmount === currentAmount && nextCreatedAt > currentCreatedAt)
      ) {
        groupedPurchaseRows.set(row.album_id, row);
      }
    });

    const postItems: PurchaseResponseItem[] = Array.from(
      groupedPurchaseRows.values(),
    ).map((row) => {
      const post = postMap.get(row.post_id);
      const albumId = row.album_id;
      const album = albumMap.get(albumId);

      const albumMedia = (album?.album_posts ?? [])
        .map((item: any) => {
          const rawUrl = item?.post?.media_url ?? item?.media_url ?? null;
          const url = resolvePublicUrl(admin, rawUrl) ?? "";
          return {
            url,
            kind: inferDisplayKind(
              rawUrl,
              item?.post?.media_type ?? item?.media_type ?? null,
              item?.post?.is_locked ?? true,
            ),
          };
        })
        .filter((item) => item.url);

      const albumCovers = albumMedia.map((item) => item.url);
      const fallbackCover =
        resolvePublicUrl(admin, post?.media_url ?? null) ?? "";

      return {
        id: albumId,
        title: album?.description || post?.caption || "Publicación",
        creator: creatorMap.get(post?.user_id ?? "")?.username ?? "usuario",
        date: new Date(row.created_at).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "short",
        }),
        price: Number(row.amount || 0),
        cover: albumCovers[0] ?? fallbackCover,
        covers:
          albumCovers.length > 0
            ? albumCovers
            : fallbackCover
              ? [fallbackCover]
              : [],
        media:
          albumMedia.length > 0
            ? albumMedia
            : fallbackCover
              ? [{ url: fallbackCover, kind: "image" as const }]
              : [],
        status: row.status ?? "Desbloqueado",
        source: "post",
        createdAt: row.created_at,
      };
    });

    const chatItems = (directMessagePurchaseRows ?? []).map((row) => {
      const message = directMessageMap.get(row.message_id);
      if (!message) return null;

      const creator = creatorMap.get(message.sender_id);
      const attachments = Array.isArray((message.metadata as any)?.attachments)
        ? ((message.metadata as any).attachments as Array<
            Record<string, unknown>
          >)
        : [];

      const resolvedMedia = attachments
        .map((item) => {
          const rawPremium =
            typeof item.premiumPath === "string" ? item.premiumPath : null;
          const rawPublic =
            typeof item.publicPath === "string" ? item.publicPath : null;
          const rawPreview =
            typeof item.previewPath === "string" ? item.previewPath : null;

          let url = "";
          if (rawPremium) {
            url =
              directSignedPremiumUrls.get(rawPremium) ??
              resolvePublicUrl(admin, rawPublic ?? rawPreview) ??
              "";
          } else {
            url = resolvePublicUrl(admin, rawPublic ?? rawPreview) ?? "";
          }

          const kind =
            item.kind === "video" ? ("video" as const) : ("image" as const);

          return url ? { url, kind } : null;
        })
        .filter((item): item is { url: string; kind: "image" | "video" } =>
          Boolean(item),
        );

      const fallbackCover = resolvedMedia[0]?.url ?? "";

      return {
        id: `chat-${row.message_id}`,
        title: `Chat con @${creator?.username ?? "usuario"}`,
        creator: creator?.username ?? "usuario",
        date: new Date(row.created_at).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "short",
        }),
        price: Number(row.amount || 0),
        cover: fallbackCover,
        covers: resolvedMedia.map((item) => item.url),
        media: resolvedMedia,
        status: "Desbloqueado",
        source: "chat" as const,
        createdAt: row.created_at,
      } satisfies PurchaseResponseItem;
    });

    const { data: tipRows, error: tipRowsError } = await admin
      .from("notifications")
      .select("id,user_id,entity_id,message,created_at")
      .eq("actor_id", user.id)
      .eq("type", "tip")
      .order("created_at", { ascending: false })
      .limit(TIP_HISTORY_LIMIT);

    if (tipRowsError) throw new Error(tipRowsError.message);

    const recipientIds = Array.from(
      new Set((tipRows ?? []).map((row) => row.user_id).filter(Boolean)),
    );

    const { data: recipientRows, error: recipientError } = recipientIds.length
      ? await admin
          .from("users")
          .select("id,username,avatar_url")
          .in("id", recipientIds)
      : { data: [], error: null };

    if (recipientError) throw new Error(recipientError.message);

    const recipientMap = new Map(
      (recipientRows ?? []).map((row) => [
        row.id,
        {
          username: row.username ?? "usuario",
          avatar: resolvePublicUrl(admin, row.avatar_url ?? null),
        },
      ]),
    );
    const tipAmountMap = await resolveTipAmountMap(admin, tipRows ?? []);

    const sentTips: SentTipResponseItem[] = (tipRows ?? []).map((row) => {
      const recipient = recipientMap.get(row.user_id);
      return {
        id: row.id,
        recipient: recipient?.username ?? "usuario",
        recipientAvatar: recipient?.avatar ?? null,
        date: new Date(row.created_at).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "short",
        }),
        amount: Number(tipAmountMap.get(row.id) || 0),
        message: parseTipNoteFromMessage(row.message) || "Sin mensaje",
        createdAt: row.created_at,
      };
    });

    const normalizedChatItems = chatItems.filter(Boolean) as Array<
      NonNullable<(typeof chatItems)[number]>
    >;

    const items = [...postItems, ...normalizedChatItems]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .map(({ createdAt: _createdAt, ...item }) => item);

    return NextResponse.json({ ok: true, items, sentTips });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las compras.",
      },
      { status: 500 },
    );
  }
}
