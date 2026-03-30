import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { grantRoleByCode } from "@/lib/server/auth/roles";

const readTrimmedEnv = (key: string) => {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const supabaseUrl =
  readTrimmedEnv("SUPABASE_URL") ?? readTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey =
  readTrimmedEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
  readTrimmedEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const supabaseServiceRoleKey =
  readTrimmedEnv("SUPABASE_SERVICE_ROLE_KEY") ??
  readTrimmedEnv("SUPABASE_SECRET_KEY");

export type AuthenticatedUserResult = {
  admin: SupabaseClient | null;
  user: User | null;
  error: string | null;
};

export const getBearerToken = (header: string | null) => {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

export const getAdminSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export const ensureServerUserRows = async (
  admin: ReturnType<typeof getAdminSupabase>,
  user: User,
) => {
  if (!admin || !user?.id) return;

  const fallbackUsername =
    typeof user.user_metadata?.username === "string" &&
    user.user_metadata.username.trim()
      ? user.user_metadata.username.trim()
      : user.email?.split("@")[0] ?? "usuario";

  const fallbackFullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";

  const [
    { data: existingUser, error: userSelectError },
    { data: existingProfile, error: profileSelectError },
  ] = await Promise.all([
    admin.from("users").select("id,username").eq("id", user.id).maybeSingle(),
    admin.from("profiles").select("id,full_name,email").eq("id", user.id).maybeSingle(),
  ]);

  if (userSelectError) {
    throw new Error(`No se pudo validar el usuario público: ${userSelectError.message}`);
  }
  if (profileSelectError) {
    throw new Error(`No se pudo validar el perfil: ${profileSelectError.message}`);
  }

  if (!existingUser) {
    const { error: insertUserError } = await admin.from("users").insert({
      id: user.id,
      username: fallbackUsername,
    });
    if (insertUserError) {
      throw new Error(`No se pudo crear el usuario público: ${insertUserError.message}`);
    }
  } else if (!existingUser.username?.trim()) {
    const { error: updateUserError } = await admin
      .from("users")
      .update({ username: fallbackUsername })
      .eq("id", user.id);
    if (updateUserError) {
      throw new Error(`No se pudo completar el username: ${updateUserError.message}`);
    }
  }

  if (!existingProfile) {
    const { error: insertProfileError } = await admin.from("profiles").insert({
      id: user.id,
      full_name: fallbackFullName,
      email: user.email ?? "",
    });
    if (insertProfileError) {
      throw new Error(`No se pudo crear el perfil: ${insertProfileError.message}`);
    }
  } else if (
    (!existingProfile.full_name?.trim() && fallbackFullName) ||
    !existingProfile.email?.trim()
  ) {
    const { error: updateProfileError } = await admin
      .from("profiles")
      .update({
        full_name: existingProfile.full_name?.trim()
          ? existingProfile.full_name
          : fallbackFullName,
        email: existingProfile.email?.trim()
          ? existingProfile.email
          : user.email ?? "",
      })
      .eq("id", user.id);
    if (updateProfileError) {
      throw new Error(`No se pudo completar el perfil: ${updateProfileError.message}`);
    }
  }
};

export const getAuthenticatedUser = async (
  request: Request,
): Promise<AuthenticatedUserResult> => {
  const admin = getAdminSupabase();
  const accessToken = getBearerToken(request.headers.get("authorization"));

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      admin,
      user: null,
      error: "Falta configurar NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  if (!supabaseServiceRoleKey) {
    return {
      admin,
      user: null,
      error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    };
  }

  if (!accessToken) {
    return {
      admin,
      user: null,
      error: "No encontramos la sesión del usuario para continuar.",
    };
  }

  if (!admin) {
    return {
      admin,
      user: null,
      error: "No se pudo inicializar el cliente de Supabase para el servidor.",
    };
  }

  const {
    data: { user },
    error,
  } = await admin.auth.getUser(accessToken);

  if (error || !user) {
    return { admin, user: null, error: "Sesion invalida." };
  }

  try {
    await ensureServerUserRows(admin, user);
    await grantRoleByCode(admin, user.id, "user", user.id);
  } catch (ensureError) {
    return {
      admin,
      user: null,
      error:
        ensureError instanceof Error
          ? ensureError.message
          : "No se pudo preparar la cuenta del usuario.",
    };
  }

  return { admin, user, error: null };
};

export const requireAuth = async (request: Request) => {
  const result = await getAuthenticatedUser(request);
  return result;
};
