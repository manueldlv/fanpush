import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  cachedClient = createClient(url, anonKey);
  return cachedClient;
};

export const ensureUserRow = async (
  supabase: SupabaseClient,
  user: User | null | undefined,
) => {
  if (!user?.id) return;

  const fallbackUsername =
    typeof user.user_metadata?.username === "string" &&
    user.user_metadata.username.trim()
      ? user.user_metadata.username.trim()
      : user.email?.split("@")[0] ?? "usuario";

  const { data: existingUser, error: selectError } = await supabase
    .from("users")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;

  if (!existingUser) {
    const { error } = await supabase.from("users").insert({
      id: user.id,
      username: fallbackUsername,
    });
    if (error) throw error;
    return;
  }

  if (!existingUser.username?.trim()) {
    const { error } = await supabase
      .from("users")
      .update({ username: fallbackUsername })
      .eq("id", user.id);
    if (error) throw error;
  }
};
