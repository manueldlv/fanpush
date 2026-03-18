import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getBearerToken = (header: string | null) => {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Falta configurar SUPABASE_SERVICE_ROLE_KEY para borrar cuentas.",
        },
        { status: 500 },
      );
    }

    const accessToken = getBearerToken(request.headers.get("authorization"));
    if (!accessToken) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
    }

    const userId = user.id;

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

    if (ownedPostIds.length > 0) {
      throwIfError(
        (await admin.from("likes").delete().in("post_id", ownedPostIds)).error,
      );
      throwIfError(
        (
          await admin.from("purchases").delete().in("post_id", ownedPostIds)
        ).error,
      );
      throwIfError(
        (
          await admin.from("album_posts").delete().in("post_id", ownedPostIds)
        ).error,
      );
    }

    if (ownedAlbumIds.length > 0) {
      throwIfError(
        (
          await admin.from("album_posts").delete().in("album_id", ownedAlbumIds)
        ).error,
      );
    }

    if (ownedAlbumIds.length > 0) {
      throwIfError(
        (await admin.from("albums").delete().in("id", ownedAlbumIds)).error,
      );
    }

    if (ownedPostIds.length > 0) {
      throwIfError(
        (await admin.from("posts").delete().in("id", ownedPostIds)).error,
      );
    }

    throwIfError((await admin.from("users").delete().eq("id", userId)).error);
    throwIfError(
      (await admin.from("profiles").delete().eq("id", userId)).error,
    );

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      throw new Error(deleteAuthError.message);
    }

    return NextResponse.json({ ok: true });
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
