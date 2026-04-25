import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/server/auth/authorization";
import {
  getUserActiveRoles,
  grantRoleByCode,
  revokeRoleByCode,
} from "@/lib/server/auth/roles";

const MANAGED_ADMIN_ROLE_CODES = ["moderator", "admin", "super_admin"] as const;

type ManagedAdminRoleCode = (typeof MANAGED_ADMIN_ROLE_CODES)[number];

type UpdateBody = {
  grant?: string[];
  revoke?: string[];
};

const isManagedAdminRole = (value: string): value is ManagedAdminRoleCode =>
  MANAGED_ADMIN_ROLE_CODES.includes(value as ManagedAdminRoleCode);

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await requireAdminAccess(request, "roles.manage");
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const { data: targetUser, error: targetError } = await admin
      .from("users")
      .select("id,username")
      .eq("id", params.id)
      .maybeSingle();

    if (targetError) {
      throw new Error(`No se pudo leer el usuario: ${targetError.message}`);
    }

    if (!targetUser) {
      return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
    }

    const roles = await getUserActiveRoles(admin, params.id);

    return NextResponse.json({
      ok: true,
      user: targetUser,
      roles: roles.roleCodes,
      managedRoles: MANAGED_ADMIN_ROLE_CODES,
      strictMode: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron leer los roles del usuario.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { admin, user, error } = await requireAdminAccess(request, "roles.manage");
    if (error || !admin || !user) {
      return NextResponse.json(
        { error: error ?? "No autorizado." },
        { status: error === "Solo admins." ? 403 : 401 },
      );
    }

    const body = (await request.json()) as UpdateBody;
    const grant = Array.from(new Set(body.grant ?? [])).filter(isManagedAdminRole);
    const revoke = Array.from(new Set(body.revoke ?? [])).filter(isManagedAdminRole);

    if (grant.length === 0 && revoke.length === 0) {
      return NextResponse.json(
        { error: "Indica al menos un rol para asignar o revocar." },
        { status: 400 },
      );
    }

    const { data: targetUser, error: targetError } = await admin
      .from("users")
      .select("id,username")
      .eq("id", params.id)
      .maybeSingle();

    if (targetError) {
      throw new Error(`No se pudo leer el usuario: ${targetError.message}`);
    }

    if (!targetUser) {
      return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
    }

    if (
      params.id === user.id &&
      revoke.some((roleCode) => roleCode === "admin" || roleCode === "super_admin")
    ) {
      return NextResponse.json(
        { error: "No puedes revocar tus propios roles administrativos sensibles." },
        { status: 400 },
      );
    }

    await Promise.all([
      ...grant.map((roleCode) => grantRoleByCode(admin, params.id, roleCode, user.id)),
      ...revoke.map((roleCode) => revokeRoleByCode(admin, params.id, roleCode)),
    ]);

    const updatedRoles = await getUserActiveRoles(admin, params.id);

    return NextResponse.json({
      ok: true,
      user: targetUser,
      roles: updatedRoles.roleCodes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron actualizar los roles.",
      },
      { status: 500 },
    );
  }
}
