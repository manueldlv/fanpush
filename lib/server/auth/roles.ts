import type { SupabaseClient, User } from "@supabase/supabase-js";

const isMissingRelationError = (message?: string | null) =>
  Boolean(
    message &&
    (/relation .* does not exist/i.test(message) ||
      /could not find the table .* in the schema cache/i.test(message) ||
      /could not find (?:a )?relationship .* in the schema cache/i.test(
        message,
      )),
  );

const normalizeRoleRelation = (
  role: { code?: string | null } | Array<{ code?: string | null }> | null,
) => {
  if (Array.isArray(role)) return role[0]?.code ?? null;
  return role?.code ?? null;
};

const normalizePermissionRelation = (
  permission: { code?: string | null } | Array<{ code?: string | null }> | null,
) => {
  if (Array.isArray(permission)) return permission[0]?.code ?? null;
  return permission?.code ?? null;
};

type RoleWithPermissionsRelation = {
  code?: string | null;
  role_permissions?: Array<{
    permission:
      | { code?: string | null }
      | Array<{ code?: string | null }>
      | null;
  }> | null;
};

const normalizeRoleWithPermissionsRelation = (
  role: RoleWithPermissionsRelation | RoleWithPermissionsRelation[] | null,
) => {
  if (Array.isArray(role)) return role[0] ?? null;
  return role;
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
      return {
        available: false as const,
        roleIds: [] as string[],
        roleCodes: [] as string[],
      };
    }
    throw new Error(
      `No se pudieron leer los roles del usuario: ${error.message}`,
    );
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

const resolveRoleIdByCode = async (admin: SupabaseClient, roleCode: string) => {
  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("code", roleCode)
    .maybeSingle();

  if (roleError) {
    if (isMissingRelationError(roleError.message)) return false;
    throw new Error(
      `No se pudo resolver el rol ${roleCode}: ${roleError.message}`,
    );
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

  if (insertError && isMissingRelationError(insertError.message)) {
    return false;
  }

  if (insertError && !/duplicate key/i.test(insertError.message)) {
    throw new Error(
      `No se pudo asignar el rol ${roleCode}: ${insertError.message}`,
    );
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

  if (error && isMissingRelationError(error.message)) {
    return false;
  }

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
    return roles.roleCodes.includes(roleCode);
  }

  return false;
};

export type UserAccessSnapshot = {
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
};

const getPermissionCodesForRoleIds = async (
  admin: SupabaseClient,
  roleIds: string[],
) => {
  if (roleIds.length === 0) return [] as string[];

  const { data, error } = await admin
    .from("role_permissions")
    .select("permission:permissions!inner(code)")
    .in("role_id", roleIds);

  if (error) {
    if (isMissingRelationError(error.message)) return [] as string[];
    throw new Error(
      `No se pudieron leer los permisos del usuario: ${error.message}`,
    );
  }

  const rows = (data ?? []) as Array<{
    permission:
      | { code?: string | null }
      | Array<{ code?: string | null }>
      | null;
  }>;

  return rows
    .map((row) => normalizePermissionRelation(row.permission))
    .filter((value): value is string => Boolean(value));
};

export const getUserAccessSnapshot = async (
  admin: SupabaseClient,
  user: User,
): Promise<UserAccessSnapshot> => {
  const { data, error } = await admin
    .from("user_roles")
    .select(
      "role_id, role:roles!inner(code, role_permissions(permission:permissions!inner(code)))",
    )
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (error) {
    if (isMissingRelationError(error.message)) {
      const roles = await getUserActiveRoles(admin, user.id);
      const permissionCodes = roles.available
        ? await getPermissionCodesForRoleIds(admin, roles.roleIds)
        : [];
      return {
        roles: roles.available ? roles.roleCodes : [],
        permissions: Array.from(new Set(permissionCodes)),
        isAdmin:
          roles.available &&
          (roles.roleCodes.includes("admin") ||
            roles.roleCodes.includes("super_admin") ||
            permissionCodes.includes("admin.access")),
      };
    }
    throw new Error(
      `No se pudieron leer los permisos del usuario: ${error.message}`,
    );
  }

  const rows = (data ?? []) as Array<{
    role_id: string;
    role: RoleWithPermissionsRelation | RoleWithPermissionsRelation[] | null;
  }>;
  const roleCodes: string[] = [];
  const permissionCodes: string[] = [];

  rows.forEach((row) => {
    const role = normalizeRoleWithPermissionsRelation(row.role);
    if (role?.code) roleCodes.push(role.code);
    for (const permissionRow of role?.role_permissions ?? []) {
      const permissionCode = normalizePermissionRelation(
        permissionRow.permission,
      );
      if (permissionCode) permissionCodes.push(permissionCode);
    }
  });

  if (roleCodes.length > 0 || permissionCodes.length > 0) {
    return {
      roles: Array.from(new Set(roleCodes)),
      permissions: Array.from(new Set(permissionCodes)),
      isAdmin:
        roleCodes.includes("admin") ||
        roleCodes.includes("super_admin") ||
        permissionCodes.includes("admin.access"),
    };
  }

  return {
    roles: [],
    permissions: [],
    isAdmin: false,
  };
};

export const hasPermission = async (
  admin: SupabaseClient,
  user: User,
  permissionCode: string,
) => {
  const snapshot = await getUserAccessSnapshot(admin, user);
  return snapshot.permissions.includes(permissionCode);
};
