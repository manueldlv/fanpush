"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import MediaImage from "@/components/MediaImage";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import {
  useGetHashtagFeedQuery,
  type ExploreItem,
} from "@/lib/redux/api/discoveryApi";
import { buildUserProfileHref } from "@/lib/profileRoute";

function HashtagCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[5px] border border-zinc-200 bg-white">
      <div className="fanpush-skeleton aspect-[280/370] w-full bg-zinc-100" />
      <div className="flex min-h-[72px] items-center gap-3 border-t border-zinc-200 px-4 py-3">
        <div className="fanpush-skeleton h-10 w-10 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="fanpush-skeleton h-3.5 w-28 rounded-full" />
          <div className="mt-2 fanpush-skeleton h-3 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

const buildDisplayItems = (items: ExploreItem[]) => {
  if (items.length === 0) return [];
  return items.slice(0, 24);
};

export default function HashtagPage() {
  const params = useParams<{ tag: string }>();
  const rawTag = Array.isArray(params?.tag) ? params.tag[0] : params?.tag ?? "";
  const hashtag = `#${decodeURIComponent(rawTag)}`;
  const { data: items = [], isLoading: loading } = useGetHashtagFeedQuery(rawTag);
  const displayItems = useMemo(() => buildDisplayItems(items), [items]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SidebarLeft />

      <div className="md:pl-60">
        <div className="mx-auto w-full max-w-[1495px] px-4 py-6 md:px-6 md:py-7">
          <h1 className="mb-2 text-[25px] font-semibold leading-none text-zinc-900">
            {hashtag}
          </h1>
          <p className="mb-6 text-[15px] text-[#464646]">
            Publicaciones relacionadas con este hashtag.
          </p>

          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, index) => (
                <HashtagCardSkeleton key={`hashtag-skeleton-${index}`} />
              ))}
            </div>
          ) : displayItems.length === 0 ? (
            <div className="rounded-[5px] border border-zinc-200 bg-white px-6 py-10 text-[15px] text-[#464646]">
              No encontramos publicaciones para {hashtag}.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
              {displayItems.map((item) => (
                <Link
                  key={item.id}
                  href={buildUserProfileHref(item.username)}
                  className="group overflow-hidden rounded-[5px] border border-zinc-200 bg-white"
                >
                  <div className="relative aspect-[280/370] overflow-hidden bg-zinc-100">
                    <MediaImage
                      src={item.mediaUrl ?? undefined}
                      alt={item.description || item.username}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      fallbackClassName="h-full w-full"
                      iconClassName="h-7 w-7"
                    />
                  </div>

                  <div className="flex min-h-[72px] items-center gap-3 border-t border-zinc-200 px-4 py-3">
                    <UserAvatar
                      src={item.avatar}
                      alt={item.username}
                      sizeClassName="h-10 w-10"
                      iconClassName="h-5 w-5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold leading-none text-zinc-900">
                        {item.username}
                      </div>
                      <div className="mt-2 truncate text-[14px] leading-none text-[#464646]">
                        {item.description || hashtag}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
