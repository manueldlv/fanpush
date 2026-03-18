"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { getSupabaseClient } from "@/lib/supabase";

type Suggestion = {
  id: string;
  name: string;
  fullName: string;
  handle: string;
  note: string;
  avatar: string | null;
  verified?: boolean;
};

export default function SidebarRight() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      setCurrentUserId(userId ?? null);

      if (userId) {
        const { data: followRows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId);
        setFollowingIds(
          new Set((followRows ?? []).map((row) => row.following_id)),
        );
      } else {
        setFollowingIds(new Set());
      }

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
          fullName: row.username ?? "",
          handle: `@${row.username ?? "usuario"}`,
          note: "Sugerencia para ti",
          avatar: await resolveAvatar(row.avatar_url ?? null),
        })),
      );

      setSuggestions(mapped);
    };

    load();
  }, []);

  const openProfile = (profile: Suggestion) => {
    router.push(buildUserProfileHref(profile.name));
  };

  const toggleFollow = async (profileId: string) => {
    if (!currentUserId || profileId === currentUserId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const isFollowing = followingIds.has(profileId);
    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", profileId);
      if (!error) {
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(profileId);
          return next;
        });
      }
      return;
    }

    const { error } = await supabase.from("follows").insert({
      follower_id: currentUserId,
      following_id: profileId,
    });

    if (!error) {
      setFollowingIds((prev) => new Set(prev).add(profileId));
      await supabase.from("notifications").insert({
        user_id: profileId,
        actor_id: currentUserId,
        type: "follow",
        entity_id: currentUserId,
        message: "comenzó a seguirte.",
        is_read: false,
      });
    }
  };

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
                <button
                  type="button"
                  onClick={() => openProfile(profile)}
                  className="flex min-w-0 cursor-pointer items-center gap-3 text-left"
                >
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
                </button>
                {currentUserId && profile.id !== currentUserId ? (
                  <button
                    type="button"
                    onClick={() => toggleFollow(profile.id)}
                    className={`text-sm font-semibold ${
                      followingIds.has(profile.id)
                        ? "text-zinc-700"
                        : "text-blue-600"
                    }`}
                  >
                    {followingIds.has(profile.id) ? "Siguiendo" : "Seguir"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
