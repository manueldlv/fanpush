import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import { USER_META_KEYS } from "@/lib/userMeta";

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const userId = user.id;
    const closedAt = new Date().toISOString();

    const { data: ownedPostsRows } = await admin
      .from("posts")
      .select("id")
      .eq("user_id", userId);
    const ownedPostIds = (ownedPostsRows ?? []).map((row) => row.id);

    const { data: ownedAlbumsRows } = await admin
      .from("albums")
      .select("id")
      .eq("user_id", userId);
    const ownedAlbumIds = (ownedAlbumsRows ?? []).map((row) => row.id);

    const throwIfError = (error: { message: string } | null) => {
      if (error) throw new Error(error.message);
    };

    if (ownedPostIds.length > 0) {
      throwIfError(
        (
          await admin
            .from("posts")
            .update({ is_locked: true, updated_at: closedAt })
            .in("id", ownedPostIds)
        ).error,
      );
    }

    if (ownedAlbumIds.length > 0) {
      throwIfError(
        (
          await admin
            .from("albums")
            .update({ visibility: "removed", updated_at: closedAt })
            .in("id", ownedAlbumIds)
        ).error,
      );
    }

    throwIfError(
      (
        await admin
          .from("user_roles")
          .update({ revoked_at: closedAt })
          .eq("user_id", userId)
          .is("revoked_at", null)
      ).error,
    );

    throwIfError(
      (
        await admin.from("users").update({
          updated_at: closedAt,
        }).eq("id", userId)
      ).error,
    );

    throwIfError(
      (
        await admin.from("profiles").update({
          updated_at: closedAt,
        }).eq("id", userId)
      ).error,
    );

    throwIfError(
      (
        await admin.from("user_meta").upsert(
          {
            user_id: userId,
            meta_key: USER_META_KEYS.accountState,
            meta_value: {
              isBlocked: true,
              blockedReason: "account_closed",
              badges: [],
              isVerified: false,
              isFeatured: false,
              updatedAt: closedAt,
            },
            updated_at: closedAt,
          },
          { onConflict: "user_id,meta_key" },
        )
      ).error,
    );

    return NextResponse.json({ ok: true, mode: "closed" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cerrar la cuenta.",
      },
      { status: 500 },
    );
  }
}
