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

    const [purchaseResult, tipsResult, reportsResult, withdrawalsResult, historyResult] =
      await Promise.all([
        admin.from("purchases").insert(purchaseRows),
        admin.from("notifications").insert(tipRows),
        admin.from("notifications").insert(reportRows),
        admin.from("notifications").insert(withdrawalRows),
        admin.from("notifications").insert(withdrawalHistoryRows),
      ]);

    const firstError =
      purchaseResult.error ||
      tipsResult.error ||
      reportsResult.error ||
      withdrawalsResult.error ||
      historyResult.error;

    if (firstError) throw firstError;

    return NextResponse.json({
      ok: true,
      created: {
        purchases: purchaseRows.length,
        tips: tipRows.length,
        reports: reportRows.length,
        withdrawals: withdrawalRows.length,
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
