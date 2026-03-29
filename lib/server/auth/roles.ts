import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/admin";

const enforcePersistedRoles =
  (process.env.AUTH_ENFORCE_PERSISTED_ROLES ?? "").trim().toLowerCase() === "true";

const isMissingRelationError = (message?: string | null) =>
  Boolean(message && /relation .* does not exist/i.test(message));

const normalizeRoleRelation = (
  role: { code?: string | null } | Array<{ code?: string | null }> | null,
) => {
  if (Array.isArray(role)) return role[0]?.code ?? null;
  return role?.code ?? null;
};

const normalizePermissionRelation = (
  permission:
    | { code?: string | null }
    | Array<{ code?: string | null }>
    | null,
) => {
  if (Array.isArray(permission)) return permission[0]?.code ?? null;
  return permission?.code ?? null;
};

export const getUserActiveRoles = async (
  admin: SupabaseClient,
  userId: string,
) => {
  const { data, error } = await admin
    .from("user_roles")
    .select("role_id, role:roles!inner(code)")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error) {
    if (isMissingRelationError(error.message)) {
      return { available: false as const, roleIds: [] as string[], roleCodes: [] as string[] };
    }
    throw new Error(`No se pudieron leer los roles del usuario: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    role_id: string;
    role: { code?: string | null } | Array<{ code?: string | null }> | null;
  }>;

  return {
    available: true as const,
    roleIds: rows.map((row) => row.role_id).filter(Boolean),
    roleCodes: rows
      .map((row) => normalizeRoleRelation(row.role))
      .filter((value): value is string => Boolean(value)),
  };
};

const resolveRoleIdByCode = async (
  admin: SupabaseClient,
  roleCode: string,
) => {
  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("code", roleCode)
    .maybeSingle();

  if (roleError) {
    if (isMissingRelationError(roleError.message)) return false;
    throw new Error(`No se pudo resolver el rol ${roleCode}: ${roleError.message}`);
  }

  if (!role?.id) return false;

  return role.id;
};

export const grantRoleByCode = async (
  admin: SupabaseClient,
  userId: string,
  roleCode: string,
  grantedBy?: string | null,
) => {
  const roleId = await resolveRoleIdByCode(admin, roleCode);
  if (!roleId) return false;

  const { error: insertError } = await admin.from("user_roles").insert({
    user_id: userId,
    role_id: roleId,
    granted_by: grantedBy ?? userId,
  });

  if (insertError && !/duplicate key/i.test(insertError.message)) {
    throw new Error(`No se pudo asignar el rol ${roleCode}: ${insertError.message}`);
  }

  return true;
};

export const revokeRoleByCode = async (
  admin: SupabaseClient,
  userId: string,
  roleCode: string,
) => {
  const roleId = await resolveRoleIdByCode(admin, roleCode);
  if (!roleId) return false;

  const { error } = await admin
    .from("user_roles")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("role_id", roleId)
    .is("revoked_at", null);

  if (error) {
    throw new Error(`No se pudo revocar el rol ${roleCode}: ${error.message}`);
  }

  return true;
};

export const hasRole = async (
  admin: SupabaseClient,
  user: User,
  roleCode: string,
) => {
  const roles = await getUserActiveRoles(admin, user.id);
  if (roles.available) {
    if (roles.roleCodes.includes(roleCode)) return true;

    if (enforcePersistedRoles) return false;

    const legacyAdmin = await isAdminUser(admin, user);
    if (legacyAdmin && (roleCode === "admin" || roleCode === "super_admin")) {
      await grantRoleByCode(admin, user.id, "admin");
      return roleCode === "admin";
    }

    return false;
  }

  if (enforcePersistedRoles) return false;

  if (roleCode === "admin" || roleCode === "super_admin") {
    return isAdminUser(admin, user);
  }

  return false;
};

const LEGACY_ADMIN_PERMISSIONS = new Set([
  "admin.access",
  "admin.dashboard.read",
  "content.moderate",
  "authors.review",
  "withdrawals.review",
  "commissions.manage",
  "roles.manage",
  "dev.seed",
]);

export const hasPermission = async (
  admin: SupabaseClient,
  user: User,
  permissionCode: string,
) => {
  const roles = await getUserActiveRoles(admin, user.id);

  if (roles.available) {
    if (roles.roleIds.length === 0) {
      const legacyAdmin = await isAdminUser(admin, user);
      if (!legacyAdmin) return false;
      await grantRoleByCode(admin, user.id, "admin");
      return LEGACY_ADMIN_PERMISSIONS.has(permissionCode);
    }

    const { data, error } = await admin
      .from("role_permissions")
      .select("permission:permissions!inner(code)")
      .in("role_id", roles.roleIds);

    if (error) {
      if (isMissingRelationError(error.message)) {
        return false;
      }
      throw new Error(`No se pudieron leer los permisos del usuario: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{
      permission:
        | { code?: string | null }
        | Array<{ code?: string | null }>
        | null;
    }>;

    const grantedPermissions = rows
      .map((row) => normalizePermissionRelation(row.permission))
      .filter((value): value is string => Boolean(value));

    if (grantedPermissions.includes(permissionCode)) return true;

    if (enforcePersistedRoles) return false;

    const legacyAdmin = await isAdminUser(admin, user);
    if (legacyAdmin) {
      await grantRoleByCode(admin, user.id, "admin");
      return LEGACY_ADMIN_PERMISSIONS.has(permissionCode);
    }

    return false;
  }

  if (enforcePersistedRoles) return false;

  const legacyAdmin = await isAdminUser(admin, user);
  if (!legacyAdmin) return false;

  return LEGACY_ADMIN_PERMISSIONS.has(permissionCode);
};
