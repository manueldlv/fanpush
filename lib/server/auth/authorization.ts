import { getAuthorApplicationForUser } from "@/lib/authorApplications";
import {
  grantRoleByCode,
  hasPermission,
  revokeRoleByCode,
} from "@/lib/server/auth/roles";
import { getAuthenticatedUser } from "@/lib/server/auth/session";

export const requireAdminAccess = async (
  request: Request,
  permissionCode = "admin.access",
) => {
  const result = await getAuthenticatedUser(request);
  if (result.error || !result.admin || !result.user) {
    return {
      ...result,
      isAdmin: false,
    };
  }

  const allowed = await hasPermission(result.admin, result.user, permissionCode);
  if (!allowed) {
    return {
      ...result,
      isAdmin: false,
      error: "Solo admins.",
    };
  }

  return {
    ...result,
    isAdmin: true,
    error: null,
  };
};

export const requireOwnership = ({
  currentUserId,
  resourceOwnerId,
}: {
  currentUserId?: string | null;
  resourceOwnerId?: string | null;
}) => currentUserId != null && resourceOwnerId != null && currentUserId === resourceOwnerId;

const syncAuthorRoleFromApplication = async ({
  admin,
  userId,
}: {
  admin: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["admin"]>;
  userId: string;
}) => {
  const application = await getAuthorApplicationForUser(admin, userId);
  const status = application?.record?.status ?? null;

  if (status === "approved") {
    await grantRoleByCode(admin, userId, "author", userId);
    return true;
  }

  if (status === "pending" || status === "rejected") {
    await revokeRoleByCode(admin, userId, "author");
  }

  return false;
};

export const requireAuthorPermission = async (
  request: Request,
  permissionCode: "content.create" | "withdrawals.request" = "content.create",
  deniedError = "Necesitas aprobación como autor para publicar.",
) => {
  const result = await getAuthenticatedUser(request);
  if (result.error || !result.admin || !result.user) {
    return {
      ...result,
      isAuthor: false,
    };
  }

  const allowedByRole = await hasPermission(result.admin, result.user, permissionCode);
  if (allowedByRole) {
    return {
      ...result,
      isAuthor: true,
      error: null,
    };
  }

  const syncedAuthor = await syncAuthorRoleFromApplication({
    admin: result.admin,
    userId: result.user.id,
  });
  if (syncedAuthor) {
    return {
      ...result,
      isAuthor: true,
      error: null,
    };
  }

  return {
    ...result,
    isAuthor: false,
    error: deniedError,
  };
};

export const requireApprovedAuthor = async (request: Request) =>
  requireAuthorPermission(
    request,
    "content.create",
    "Necesitas aprobación como autor para publicar.",
  );
