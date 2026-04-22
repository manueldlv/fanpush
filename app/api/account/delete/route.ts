import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const userId = user.id;
    const closedAt = new Date().toISOString();
    const deletedSuffix = userId.slice(0, 8);
    const archivedUsername = `deleted_${deletedSuffix}`;
    const archivedEmail = `deleted+${deletedSuffix}@fanpush.invalid`;
    const replacementPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;

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

    throwIfError(
      (
        await admin
          .from("notifications")
          .delete()
          .or(`user_id.eq.${userId},actor_id.eq.${userId}`)
      ).error,
    );

    throwIfError(
      (
        await admin
          .from("follows")
          .delete()
          .or(`follower_id.eq.${userId},following_id.eq.${userId}`)
      ).error,
    );

    throwIfError((await admin.from("likes").delete().eq("user_id", userId)).error);
    throwIfError(
      (await admin.from("purchases").delete().eq("user_id", userId)).error,
    );
    throwIfError((await admin.from("notification_threads").delete().eq("user_id", userId)).error);
    throwIfError((await admin.from("user_meta").delete().eq("user_id", userId)).error);

    throwIfError(
      (
        await admin
          .from("notifications")
          .update({ actor_id: null })
          .eq("actor_id", userId)
      ).error,
    );

    if (ownedPostIds.length > 0) {
      throwIfError(
        (await admin.from("likes").delete().in("post_id", ownedPostIds)).error,
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
          username: archivedUsername,
          avatar_url: null,
          bio: null,
          website: null,
          instagram: null,
          updated_at: closedAt,
        }).eq("id", userId)
      ).error,
    );

    throwIfError(
      (
        await admin.from("profiles").update({
          full_name: "Cuenta eliminada",
          email: archivedEmail,
          country: null,
          locale: null,
          updated_at: closedAt,
        }).eq("id", userId)
      ).error,
    );

    throwIfError(
      (
        await admin.from("user_meta").upsert(
          {
            user_id: userId,
            meta_key: "account.state",
            meta_value: {
              isBlocked: true,
              blockedReason: "account_deleted",
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

    const { error: updateAuthError } = await admin.auth.admin.updateUserById(userId, {
      email: archivedEmail,
      password: replacementPassword,
      user_metadata: {
        username: archivedUsername,
        full_name: "Cuenta eliminada",
        deleted_at: closedAt,
      },
    });
    if (updateAuthError) {
      throw new Error(updateAuthError.message);
    }

    return NextResponse.json({ ok: true, mode: "archived" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo borrar la cuenta.",
      },
      { status: 500 },
    );
  }
}
