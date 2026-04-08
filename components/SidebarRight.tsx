"use client";

import Image from "next/image";
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
    <aside className="hidden w-[380px] shrink-0 lg:block">
      <div className="sticky top-[88px] space-y-6">
        <div className="h-[485px] overflow-hidden rounded-[5px] border border-zinc-200 bg-white">
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

          <div className="px-[18px] pt-[12px] pb-[36px]">
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={`suggestion-skeleton-${index}`}
                    className="flex h-[66px] items-center justify-between"
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
                className="flex h-[66px] items-center justify-between"
              >
                <button
                  type="button"
                  onClick={() => openProfile(profile)}
                  className="flex min-w-0 cursor-pointer items-center gap-[20px] text-left"
                >
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.name}
                      className="h-[50px] w-[50px] rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-[50px] w-[50px] rounded-full bg-zinc-100" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 text-[17px] font-semibold leading-none tracking-[-0.02em] text-zinc-900">
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
                  className={`min-w-[118px] text-right text-[17px] font-semibold leading-none tracking-[-0.02em] ${
                    profile.isFollowing ? "text-[#4b4b4b]" : "text-[#5A3EE7]"
                  }`}
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
