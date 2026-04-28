import type { SupabaseClient } from "@supabase/supabase-js";

export const recordAdminAction = async ({
  admin,
  actorUserId,
  actionType,
  targetType,
  targetId,
  summary,
  metadata,
}: {
  admin: SupabaseClient;
  actorUserId?: string | null;
  actionType: string;
  targetType: string;
  targetId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) => {
  const { error } = await admin.from("admin_action_logs").insert({
    actor_user_id: actorUserId ?? null,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId ?? null,
    summary,
    metadata: metadata ?? {},
  });

  if (error) {
    throw new Error(
      `No se pudo registrar la accion admin: ${error.message}`,
    );
  }
};
