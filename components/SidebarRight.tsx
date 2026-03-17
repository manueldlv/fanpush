import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Suggestion = {
  id: string;
  name: string;
  handle: string;
  note: string;
  avatar: string | null;
  verified?: boolean;
};

export default function SidebarRight() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      let query = supabase.from("users").select("id,username,avatar_url").limit(5);
      if (userId) {
        query = query.neq("id", userId);
      }
      const { data } = await query;

      const resolveAvatar = async (value: string | null) => {
        if (!value) return null;
        if (value.startsWith("http")) return value;
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(value);
        return publicUrl.publicUrl;
      };

      const mapped = await Promise.all(
        (data ?? []).map(async (row) => ({
          id: row.id,
          name: row.username ?? "usuario",
          handle: `@${row.username ?? "usuario"}`,
          note: "Sugerencia para ti",
          avatar: await resolveAvatar(row.avatar_url ?? null),
        })),
      );

      setSuggestions(mapped);
    };

    load();
  }, []);

  return (
    <aside className="hidden w-[320px] shrink-0 lg:block">
      <div className="sticky top-8 space-y-6">
        <div className="rounded-[5px] border border-zinc-200 bg-white px-6 py-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">
              Sugerencias para ti
            </h3>
            <button className="text-xs font-semibold text-zinc-600">
              Ver todo
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {suggestions.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-zinc-100" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <span>{profile.name}</span>
                      {profile.verified ? (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] bg-sky-500 text-[10px] font-bold text-white">
                          ✓
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-500">{profile.note}</div>
                  </div>
                </div>
                <button className="text-sm font-semibold text-blue-600">
                  Seguir
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
