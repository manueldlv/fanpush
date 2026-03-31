"use client";

import { useRouter } from "next/navigation";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { useGetSuggestionsQuery } from "@/lib/redux/api/socialApi";

export default function SidebarRight() {
  const router = useRouter();
  const { data: suggestions = [], isLoading: loading } = useGetSuggestionsQuery();

  const openProfile = (profile: { name: string }) => {
    router.push(buildUserProfileHref(profile.name));
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
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={`suggestion-skeleton-${index}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="fanpush-skeleton h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <div className="fanpush-skeleton h-4 w-24 rounded-full" />
                        <div className="fanpush-skeleton h-3 w-20 rounded-full" />
                      </div>
                    </div>
                    <div className="fanpush-skeleton h-4 w-14 rounded-full" />
                  </div>
                ))
              : null}
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
