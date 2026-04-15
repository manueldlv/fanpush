"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildUserProfileHref } from "@/lib/profileRoute";
import {
  getProfileViewCacheKey,
  profileApi,
} from "@/lib/redux/api/profileApi";
import { socialApi, useGetSuggestionsQuery } from "@/lib/redux/api/socialApi";
import { useGetViewerQuery } from "@/lib/redux/api/sessionApi";
import { useAppDispatch } from "@/lib/redux/hooks";
import { getSupabaseClient } from "@/lib/supabase";
import UserAvatar from "@/components/UserAvatar";

export default function SidebarRight() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { data: viewer } = useGetViewerQuery();
  const { data: suggestions = [], isLoading: loading } = useGetSuggestionsQuery();
  const [pendingFollowId, setPendingFollowId] = useState<string | null>(null);
  const selfProfileQueryArg = {
    userId: null,
    username: viewer?.profile.username ?? null,
  };

  const openProfile = (profile: { name: string }) => {
    router.push(buildUserProfileHref(profile.name));
  };

  const toggleFollowSuggestion = async (profileId: string, isFollowing: boolean) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (pendingFollowId === profileId) return;

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;
    if (!currentUserId || currentUserId === profileId) return;
    setPendingFollowId(profileId);

    const { data: existingFollow } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUserId)
      .eq("following_id", profileId)
      .limit(1);

    const actualIsFollowing = Boolean(existingFollow?.length);

    if (actualIsFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", profileId);
      if (error) {
        setPendingFollowId(null);
        return;
      }

      dispatch(
        profileApi.util.updateQueryData(
          "getProfileView",
          selfProfileQueryArg,
          (draft) => {
            draft.stats.following = Math.max((draft.stats.following ?? 0) - 1, 0);
          },
        ),
      );
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: profileId,
      });
      const duplicateFollow = error && "code" in error && error.code === "23505";
      if (error && !duplicateFollow) {
        setPendingFollowId(null);
        return;
      }

      dispatch(
        profileApi.util.updateQueryData(
          "getProfileView",
          selfProfileQueryArg,
          (draft) => {
            draft.stats.following = (draft.stats.following ?? 0) + 1;
          },
        ),
      );
    }

    dispatch(socialApi.util.invalidateTags(["SocialSuggestions"]));
    dispatch(
      profileApi.util.invalidateTags([
        { type: "ProfileView", id: "self" },
        { type: "ProfileView", id: `id:${currentUserId}` },
        {
          type: "ProfileView",
          id: getProfileViewCacheKey(selfProfileQueryArg),
        },
        { type: "ProfileView", id: `id:${profileId}` },
      ]),
    );
    window.dispatchEvent(new Event("follow-updated"));
    setPendingFollowId(null);
  };

  return (
    <aside className="hidden w-[380px] shrink-0 lg:block">
      <div className="sticky top-[88px] space-y-6">
        <div className="overflow-hidden rounded-[5px] border border-zinc-200 bg-white">
          <div className="relative border-b border-zinc-200">
            <Image
              src="/suggestions-header.png"
              alt="Decoración de sugerencias"
              width={487}
              height={157}
              className="h-[112px] w-full object-cover"
              priority
            />
            <h3 className="absolute left-[18px] top-[42px] text-[22px] font-bold leading-none tracking-[-0.03em] text-zinc-950">
              Sugerencias para ti
            </h3>
          </div>

          <div className="px-[16px] py-[10px]">
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={`suggestion-skeleton-${index}`}
                    className="flex h-[62px] items-center justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="fanpush-skeleton h-11 w-11 rounded-full" />
                      <div className="space-y-2">
                        <div className="fanpush-skeleton h-4 w-28 rounded-full" />
                        <div className="fanpush-skeleton h-3 w-20 rounded-full" />
                      </div>
                    </div>
                    <div className="fanpush-skeleton h-4 w-18 rounded-full" />
                  </div>
                ))
              : null}
            {suggestions.map((profile) => (
              <div
                key={profile.id}
                className="flex h-[62px] items-center justify-between"
              >
                <button
                  type="button"
                  onClick={() => openProfile(profile)}
                  className="flex min-w-0 cursor-pointer items-center gap-4 text-left"
                >
                  <UserAvatar
                    src={profile.avatar}
                    alt={profile.name}
                    sizeClassName="h-[46px] w-[46px]"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-[16px] font-semibold leading-none tracking-[-0.02em] text-zinc-900">
                      <span>{profile.name}</span>
                      {profile.verified ? (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] bg-sky-500 text-[10px] font-bold text-white">
                          ✓
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toggleFollowSuggestion(profile.id, Boolean(profile.isFollowing))
                  }
                  disabled={pendingFollowId === profile.id}
                  className={`min-w-[108px] text-right text-[16px] font-semibold leading-none tracking-[-0.02em] ${
                    profile.isFollowing ? "text-[#4b4b4b]" : "text-[#5A3EE7]"
                  } ${pendingFollowId === profile.id ? "opacity-50" : ""}`}
                >
                  {profile.isFollowing ? "Siguiendo" : "Seguir"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
