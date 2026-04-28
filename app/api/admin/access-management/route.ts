import { NextResponse } from "next/server";
import { recordAdminAction } from "@/lib/server/admin/audit";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import {
  getUserActiveRoles,
  grantRoleByCode,
} from "@/lib/server/auth/roles";
import { ensureServerUserRows } from "@/lib/server/auth/session";

type CreateAdminBody = {
  email?: string;
  password?: string;
  username?: string;
  fullName?: string;
  accessLevel?: "super_admin" | "content_admin";
};

const ADMIN_ROLE_CODES = ["content_admin", "admin", "super_admin"] as const;

const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");

const normalizeEmail = (value: string) =>
  value.trim().toLowerCase();

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await requireAdminAccess(
      request,
      "roles.manage",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const { data: roleRows, error: roleRowsError } = await admin
      .from("user_roles")
      .select("user_id,role:roles!inner(code)")
      .is("revoked_at", null);

    if (roleRowsError) {
      throw new Error(`No se pudieron leer los roles admin: ${roleRowsError.message}`);
    }

    const roleMap = new Map<string, string[]>();
    for (const row of roleRows ?? []) {
      const role = Array.isArray(row.role) ? row.role[0] : row.role;
      const code = role?.code ?? null;
      if (!code || !ADMIN_ROLE_CODES.includes(code as (typeof ADMIN_ROLE_CODES)[number])) {
        continue;
      }
      const current = roleMap.get(row.user_id) ?? [];
      current.push(code);
      roleMap.set(row.user_id, current);
    }

    const adminUserIds = Array.from(roleMap.keys());
    const [{ data: usersRows, error: usersError }, { data: profilesRows, error: profilesError }] =
      await Promise.all([
        adminUserIds.length
          ? admin
              .from("users")
              .select("id,username")
              .in("id", adminUserIds)
          : Promise.resolve({ data: [], error: null }),
        adminUserIds.length
          ? admin
              .from("profiles")
              .select("id,full_name,email")
              .in("id", adminUserIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (usersError) throw new Error(usersError.message);
    if (profilesError) throw new Error(profilesError.message);

    const userMap = new Map((usersRows ?? []).map((row) => [row.id, row]));
    const profileMap = new Map((profilesRows ?? []).map((row) => [row.id, row]));

    const { data: logRows, error: logError } = await admin
      .from("admin_action_logs")
      .select("id,actor_user_id,action_type,target_type,target_id,summary,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (logError) {
      throw new Error(`No se pudo leer el historial admin: ${logError.message}`);
    }

    const actorIds = Array.from(
      new Set((logRows ?? []).map((row) => row.actor_user_id).filter(Boolean) as string[]),
    );
    const { data: actorRows, error: actorError } = actorIds.length
      ? await admin.from("users").select("id,username").in("id", actorIds)
      : { data: [], error: null };

    if (actorError) throw new Error(actorError.message);

    const actorMap = new Map((actorRows ?? []).map((row) => [row.id, row]));

    const adminUsers = adminUserIds
      .map((userId) => {
        const roles = Array.from(new Set(roleMap.get(userId) ?? []));
        const currentUser = userMap.get(userId);
        const profile = profileMap.get(userId);
        return {
          id: userId,
          username: currentUser?.username ?? "usuario",
          email: profile?.email ?? "",
          fullName: profile?.full_name ?? "",
          roles,
          accessLevel: roles.includes("super_admin")
            ? "super_admin"
            : "content_admin",
        };
      })
      .sort((a, b) => a.username.localeCompare(b.username));

    const actionLogs = (logRows ?? []).map((row) => ({
      id: row.id,
      actionType: row.action_type,
      targetType: row.target_type,
      targetId: row.target_id ?? null,
      summary: row.summary,
      actor: actorMap.get(row.actor_user_id ?? "")?.username ?? "admin",
      createdAt: row.created_at,
      metadata: row.metadata ?? {},
    }));

    return NextResponse.json({ ok: true, adminUsers, actionLogs });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la gestion admin.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await requireAdminAccess(
      request,
      "roles.manage",
    );
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const body = (await request.json()) as CreateAdminBody;
    const email = normalizeEmail(body.email ?? "");
    const password = (body.password ?? "").trim();
    const username = normalizeUsername(body.username ?? "");
    const fullName = (body.fullName ?? "").trim();
    const accessLevel =
      body.accessLevel === "super_admin" ? "super_admin" : "content_admin";

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: "Email, password y username son obligatorios." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La password debe tener al menos 6 caracteres." },
        { status: 400 },
      );
    }

    const { data: existingUser, error: existingUserError } = await admin
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingUserError) {
      throw new Error(existingUserError.message);
    }
    if (existingUser) {
      return NextResponse.json(
        { error: "Ese username ya existe." },
        { status: 400 },
      );
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
      },
    });

    if (createError || !created.user) {
      throw new Error(createError?.message ?? "No se pudo crear el usuario admin.");
    }

    await ensureServerUserRows(admin, created.user);
    const { error: userUpdateError } = await admin
      .from("users")
      .update({ username })
      .eq("id", created.user.id);
    if (userUpdateError) {
      throw new Error(`No se pudo guardar el username: ${userUpdateError.message}`);
    }

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        email,
      })
      .eq("id", created.user.id);
    if (profileUpdateError) {
      throw new Error(`No se pudo guardar el perfil: ${profileUpdateError.message}`);
    }

    const grantedUserRole = await grantRoleByCode(admin, created.user.id, "user", user.id);
    if (!grantedUserRole) {
      throw new Error("No se pudo asignar el rol base del usuario.");
    }

    const grantedAccessRole = await grantRoleByCode(
      admin,
      created.user.id,
      accessLevel,
      user.id,
    );
    if (!grantedAccessRole) {
      throw new Error(
        `No se pudo asignar el rol ${accessLevel}. Revisa las migraciones de acceso.`,
      );
    }

    const roles = await getUserActiveRoles(admin, created.user.id);

    await recordAdminAction({
      admin,
      actorUserId: user.id,
      actionType: "admin.user.created",
      targetType: "user",
      targetId: created.user.id,
      summary: `Creo usuario admin @${username} con acceso ${accessLevel}.`,
      metadata: {
        email,
        accessLevel,
        roles: roles.roleCodes,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: created.user.id,
        username,
        email,
        fullName,
        roles: roles.roleCodes,
        accessLevel,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el usuario admin.",
      },
      { status: 500 },
    );
  }
}
