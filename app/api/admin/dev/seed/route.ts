import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getAuthenticatedUser } from "@/lib/mercadopago";
import { serializeContentReport } from "@/lib/reports";
import { serializeWithdrawalHistory, serializeWithdrawalRecord } from "@/lib/withdrawals";

const REPORT_REASONS = [
  "Contenido fuera de contexto",
  "Spam o engañoso",
  "Contenido sexual explícito",
  "Violencia o abuso",
];

const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80",
];

const DEMO_VIDEOS = [
  "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
  "https://samplelib.com/lib/preview/mp4/sample-10s.mp4",
];

const DEMO_CAPTIONS = [
  "Sesion nueva para suscriptores.",
  "Backstage del dia de hoy.",
  "Preview exclusiva del set.",
  "Contenido gratis para explorar.",
  "Nueva publicacion en venta.",
  "Material reciente para el feed.",
];

export async function POST(request: Request) {
  try {
    const host = request.headers.get("host") ?? "";
    const isLocalHost =
      host.includes("localhost") || host.includes("127.0.0.1");

    if (process.env.NODE_ENV === "production" && !isLocalHost) {
      return NextResponse.json({ error: "Solo disponible en desarrollo." }, { status: 403 });
    }

    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    if (!(await isAdminUser(admin, user))) {
      return NextResponse.json({ error: "Solo admins." }, { status: 403 });
    }

    const [{ data: users }, { data: albums }, { data: links }] = await Promise.all([
      admin.from("users").select("id,username").limit(10),
      admin.from("albums").select("id,user_id,price,description").limit(10),
      admin.from("album_posts").select("album_id,post_id").limit(50),
    ]);

    if (!users?.length || !albums?.length || !links?.length) {
      return NextResponse.json(
        { error: "Necesitas al menos usuarios, álbumes y posts para generar demo." },
        { status: 400 },
      );
    }

    const sellerAlbum = albums[0];
    const sellerId = sellerAlbum.user_id;
    const buyer = users.find((item) => item.id !== sellerId) ?? users[0];
    const albumPostIds = links
      .filter((row) => row.album_id === sellerAlbum.id)
      .map((row) => row.post_id)
      .filter(Boolean);

    if (!albumPostIds.length) {
      return NextResponse.json(
        { error: "El álbum elegido no tiene posts asociados." },
        { status: 400 },
      );
    }

    const purchaseRows = Array.from({ length: 14 }).map((_, index) => ({
      user_id: buyer.id,
      post_id: albumPostIds[index % albumPostIds.length],
      payment_id: `demo-purchase-${Date.now()}-${index}`,
      amount: Number(sellerAlbum.price || 1500),
      status: "approved",
    }));

    const tipRows = Array.from({ length: 12 }).map((_, index) => ({
      user_id: sellerId,
      actor_id: buyer.id,
      entity_id: buyer.id,
      type: "tip",
      message: `te envió una propina de ${Number(500 + index * 125).toFixed(2)} ARS.`,
      is_read: index % 3 === 0,
    }));

    const reportRows = Array.from({ length: 8 }).map((_, index) => ({
      user_id: sellerId,
      actor_id: buyer.id,
      entity_id: sellerAlbum.id,
      type: "content_report",
      message: serializeContentReport({
        albumId: sellerAlbum.id,
        reason: REPORT_REASONS[index % REPORT_REASONS.length],
        reportedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
        status: "open",
      }),
      is_read: true,
    }));

    const withdrawalRows = Array.from({ length: 6 }).map((_, index) => ({
      user_id: sellerId,
      actor_id: sellerId,
      entity_id: sellerId,
      type: "withdrawal_request",
      message: serializeWithdrawalRecord({
        amount: 50000 + index * 5000,
        status:
          index % 3 === 0 ? "requested" : index % 3 === 1 ? "sent" : "rejected",
        requestedAt: new Date(Date.now() - index * 172_800_000).toISOString(),
        monthKey: `2026-${String((index % 12) + 1).padStart(2, "0")}`,
      }),
      is_read: true,
    }));

    const withdrawalHistoryRows = withdrawalRows.map((row, index) => ({
      user_id: user.id,
      actor_id: user.id,
      entity_id: sellerId,
      type: "withdrawal_history",
      message: serializeWithdrawalHistory({
        withdrawalId: `demo-withdrawal-${index}`,
        status: index % 2 === 0 ? "sent" : "rejected",
        amount: 50000 + index * 5000,
        actedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
        reason: index % 2 === 0 ? "" : "No cumple con los requisitos del retiro.",
      }),
      is_read: true,
    }));

    const contentOwners =
      users.filter((item) => item.id !== buyer.id).slice(0, 3).length > 0
        ? users.filter((item) => item.id !== buyer.id).slice(0, 3)
        : users.slice(0, 1);

    const createdAlbums: Array<{ id: string; ownerId: string }> = [];
    for (let index = 0; index < 12; index += 1) {
      const owner = contentOwners[index % contentOwners.length];
      const isPaid = index % 3 !== 0;
      const mediaCount = index % 4 === 0 ? 3 : index % 2 === 0 ? 2 : 1;

      const { data: album, error: albumError } = await admin
        .from("albums")
        .insert({
          user_id: owner.id,
          description: DEMO_CAPTIONS[index % DEMO_CAPTIONS.length],
          price: isPaid ? 1500 + index * 250 : 0,
        })
        .select("id")
        .single();

      if (albumError || !album?.id) {
        throw new Error(albumError?.message ?? "No se pudo crear el album demo.");
      }

      const postPayload = Array.from({ length: mediaCount }).map((_, mediaIndex) => {
        const useVideo = (index + mediaIndex) % 5 === 0;
        const mediaUrl = useVideo
          ? DEMO_VIDEOS[(index + mediaIndex) % DEMO_VIDEOS.length]
          : DEMO_IMAGES[(index + mediaIndex) % DEMO_IMAGES.length];

        return {
          user_id: owner.id,
          media_url: mediaUrl,
          media_type: useVideo ? "video" : "image",
          is_locked: isPaid,
          likes_count: 0,
          caption: DEMO_CAPTIONS[(index + mediaIndex) % DEMO_CAPTIONS.length],
        };
      });

      const { data: posts, error: postsError } = await admin
        .from("posts")
        .insert(postPayload)
        .select("id");

      if (postsError || !posts?.length) {
        throw new Error(postsError?.message ?? "No se pudieron crear posts demo.");
      }

      const { error: linkError } = await admin.from("album_posts").insert(
        posts.map((post) => ({
          album_id: album.id,
          post_id: post.id,
        })),
      );

      if (linkError) {
        throw new Error(linkError.message);
      }

      createdAlbums.push({ id: album.id, ownerId: owner.id });
    }

    const additionalReportRows = createdAlbums.slice(0, 5).map((album, index) => ({
      user_id: album.ownerId,
      actor_id: buyer.id,
      entity_id: album.id,
      type: "content_report",
      message: serializeContentReport({
        albumId: album.id,
        reason: REPORT_REASONS[index % REPORT_REASONS.length],
        reportedAt: new Date(Date.now() - index * 43_200_000).toISOString(),
        status: "open",
      }),
      is_read: true,
    }));

    const [purchaseResult, tipsResult, reportsResult, withdrawalsResult, historyResult, extraReportsResult] =
      await Promise.all([
        admin.from("purchases").insert(purchaseRows),
        admin.from("notifications").insert(tipRows),
        admin.from("notifications").insert(reportRows),
        admin.from("notifications").insert(withdrawalRows),
        admin.from("notifications").insert(withdrawalHistoryRows),
        admin.from("notifications").insert(additionalReportRows),
      ]);

    const firstError =
      purchaseResult.error ||
      tipsResult.error ||
      reportsResult.error ||
      withdrawalsResult.error ||
      historyResult.error ||
      extraReportsResult.error;

    if (firstError) throw firstError;

    return NextResponse.json({
      ok: true,
      created: {
        purchases: purchaseRows.length,
        tips: tipRows.length,
        reports: reportRows.length + additionalReportRows.length,
        withdrawals: withdrawalRows.length,
        content: createdAlbums.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron generar datos demo.",
      },
      { status: 500 },
    );
  }
}
