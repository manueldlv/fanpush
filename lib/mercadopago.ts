import { createClient, type User } from "@supabase/supabase-js";

const mercadopagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type MercadoPagoPayment = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
};

export type FinalizedPaymentResult =
  | { ok: true; kind: "purchase" }
  | { ok: true; kind: "tip"; amount: number }
  | { ok: false; status: string; statusDetail?: string | null };

export const getBearerToken = (header: string | null) => {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

export const getMercadoPagoAccessToken = () => mercadopagoAccessToken;

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

  const [{ data: existingUser, error: userSelectError }, { data: existingProfile, error: profileSelectError }] =
    await Promise.all([
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
  } else if ((!existingProfile.full_name?.trim() && fallbackFullName) || !existingProfile.email?.trim()) {
    const { error: updateProfileError } = await admin
      .from("profiles")
      .update({
        full_name: existingProfile.full_name?.trim() ? existingProfile.full_name : fallbackFullName,
        email: existingProfile.email?.trim() ? existingProfile.email : user.email ?? "",
      })
      .eq("id", user.id);
    if (updateProfileError) {
      throw new Error(`No se pudo completar el perfil: ${updateProfileError.message}`);
    }
  }
};

export const getAuthenticatedUser = async (request: Request) => {
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

export const isPublicHttpsUrl = (value: string) => /^https:\/\//i.test(value);

export const resolveAppBaseUrl = (request: Request) => {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin.replace(/\/$/, "");
};

export const mercadopagoFetch = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  if (!mercadopagoAccessToken) {
    throw new Error("Falta configurar MERCADOPAGO_ACCESS_TOKEN.");
  }

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mercadopagoAccessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (json &&
        typeof json === "object" &&
        "message" in json &&
        typeof json.message === "string" &&
        json.message) ||
      `Mercado Pago devolvio ${response.status}.`;
    throw new Error(message);
  }

  return json as T;
};

export const parseExternalReference = (reference?: string | null) => {
  if (!reference) return null;
  const [kind, buyerId, targetId, amountValue] = reference.split(":");
  if (!kind || !buyerId || !targetId) return null;
  return {
    kind,
    buyerId,
    targetId,
    amount: amountValue ? Number(amountValue) : null,
  };
};

export const finalizeMercadoPagoPayment = async ({
  admin,
  paymentId,
  expectedBuyerId,
}: {
  admin: NonNullable<ReturnType<typeof getAdminSupabase>>;
  paymentId: string | number;
  expectedBuyerId?: string | null;
}): Promise<FinalizedPaymentResult> => {
  const payment = await mercadopagoFetch<{
    id: number | string;
    status?: string;
    status_detail?: string;
    external_reference?: string;
  }>(`/v1/payments/${paymentId}`);

  if (payment.status !== "approved") {
    return {
      ok: false,
      status: payment.status ?? "unknown",
      statusDetail: payment.status_detail ?? null,
    };
  }

  const reference = parseExternalReference(payment.external_reference);
  if (!reference) {
    throw new Error("No se pudo interpretar el pago recibido.");
  }

  if (expectedBuyerId && reference.buyerId !== expectedBuyerId) {
    throw new Error("Este pago no pertenece a la sesión actual.");
  }

  const {
    data: { user: buyerUser },
    error: buyerError,
  } = await admin.auth.admin.getUserById(reference.buyerId);

  if (buyerError || !buyerUser) {
    throw new Error("No se pudo validar al comprador del pago.");
  }

  await ensureServerUserRows(admin, buyerUser);

  if (reference.kind === "purchase") {
    const albumId = reference.targetId;
    const { data: album } = await admin
      .from("albums")
      .select("id,user_id,description,price")
      .eq("id", albumId)
      .maybeSingle();

    if (!album) {
      throw new Error("No se encontró el álbum pagado.");
    }

    const { data: links } = await admin
      .from("album_posts")
      .select("post_id")
      .eq("album_id", albumId);

    const postIds = (links ?? []).map((row) => row.post_id).filter(Boolean);
    if (postIds.length === 0) {
      throw new Error("No se encontró contenido para acreditar.");
    }

    const rows = postIds.map((postId, index) => ({
      user_id: buyerUser.id,
      post_id: postId,
      payment_id: `${payment.id}-${postId}`,
      amount: index === 0 ? Number(reference.amount || album.price || 0) : 0,
      status: "approved",
    }));

    const { data: existingRows } = await admin
      .from("purchases")
      .select("payment_id")
      .in(
        "payment_id",
        rows.map((row) => row.payment_id),
      );

    if ((existingRows ?? []).length === 0) {
      const { error: insertError } = await admin.from("purchases").insert(rows);
      if (insertError) throw insertError;

      await admin.from("notifications").insert({
        user_id: album.user_id,
        actor_id: buyerUser.id,
        type: "purchase",
        entity_id: buyerUser.id,
        message: "compró tu contenido.",
        is_read: false,
      });
    }

    return { ok: true, kind: "purchase" };
  }

  if (reference.kind === "tip") {
    const targetUserId = reference.targetId;
    const amount = Number(reference.amount || 0);

    const { data: existingTip } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("actor_id", buyerUser.id)
      .eq("type", "tip")
      .eq("message", `te envió una propina de ${amount.toFixed(2)} ARS.`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingTip) {
      const { error: tipError } = await admin.from("notifications").insert({
        user_id: targetUserId,
        actor_id: buyerUser.id,
        type: "tip",
        entity_id: buyerUser.id,
        message: `te envió una propina de ${amount.toFixed(2)} ARS.`,
        is_read: false,
      });
      if (tipError) throw tipError;
    }

    return { ok: true, kind: "tip", amount };
  }

  throw new Error("Tipo de pago no soportado.");
};
