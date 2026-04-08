"use client";

import Link from "next/link";
import { useMemo } from "react";
import MediaImage from "@/components/MediaImage";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import { useGetExploreFeedQuery, type ExploreItem } from "@/lib/redux/api/discoveryApi";
import { buildUserProfileHref } from "@/lib/profileRoute";

const exploreMockItems: ExploreItem[] = [
  {
    id: "mock-explore-1",
    mediaUrl: "https://picsum.photos/seed/explore-1/700/920",
    mediaType: "image",
    username: "camimiranda_10",
    avatar: "https://picsum.photos/seed/explore-avatar-1/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-2",
    mediaUrl: "https://picsum.photos/seed/explore-2/700/920",
    mediaType: "image",
    username: "miliestudio",
    avatar: "https://picsum.photos/seed/explore-avatar-2/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-3",
    mediaUrl: "https://picsum.photos/seed/explore-3/700/920",
    mediaType: "image",
    username: "sofiecraft",
    avatar: "https://picsum.photos/seed/explore-avatar-3/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-4",
    mediaUrl: "https://picsum.photos/seed/explore-4/700/920",
    mediaType: "image",
    username: "luna.makeup",
    avatar: "https://picsum.photos/seed/explore-avatar-4/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-5",
    mediaUrl: "https://picsum.photos/seed/explore-5/700/920",
    mediaType: "image",
    username: "valen.vibes",
    avatar: "https://picsum.photos/seed/explore-avatar-5/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-6",
    mediaUrl: "https://picsum.photos/seed/explore-6/700/920",
    mediaType: "image",
    username: "paula.daily",
    avatar: "https://picsum.photos/seed/explore-avatar-6/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-7",
    mediaUrl: "https://picsum.photos/seed/explore-7/700/920",
    mediaType: "image",
    username: "noe.creator",
    avatar: "https://picsum.photos/seed/explore-avatar-7/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-8",
    mediaUrl: "https://picsum.photos/seed/explore-8/700/920",
    mediaType: "image",
    username: "marti.zone",
    avatar: "https://picsum.photos/seed/explore-avatar-8/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-9",
    mediaUrl: "https://picsum.photos/seed/explore-9/700/920",
    mediaType: "image",
    username: "agus.scene",
    avatar: "https://picsum.photos/seed/explore-avatar-9/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-10",
    mediaUrl: "https://picsum.photos/seed/explore-10/700/920",
    mediaType: "image",
    username: "alma.glow",
    avatar: "https://picsum.photos/seed/explore-avatar-10/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-11",
    mediaUrl: "https://picsum.photos/seed/explore-11/700/920",
    mediaType: "image",
    username: "juli.color",
    avatar: "https://picsum.photos/seed/explore-avatar-11/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-explore-12",
    mediaUrl: "https://picsum.photos/seed/explore-12/700/920",
    mediaType: "image",
    username: "cata.house",
    avatar: "https://picsum.photos/seed/explore-avatar-12/120/120",
    description: "Contenido gratuito",
    createdAt: new Date().toISOString(),
  },
];

function ExploreCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[5px] border border-zinc-200 bg-white">
      <div className="fanpush-skeleton aspect-[280/370] w-full bg-zinc-100" />
      <div className="flex items-center gap-2 border-t border-zinc-200 px-3 py-2">
        <div className="fanpush-skeleton h-7 w-7 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="fanpush-skeleton h-3 w-24 rounded-full" />
          <div className="mt-1 fanpush-skeleton h-2.5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

const buildDisplayItems = (items: ExploreItem[]) => {
  const isLocalPreview =
    typeof window !== "undefined" &&
    (window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost");
  const sourceItems =
    isLocalPreview && items.length < 12 ? exploreMockItems : items;

  if (sourceItems.length === 0) return [];
  const target = 12;
  return Array.from({ length: target }, (_, index) => {
    const base = sourceItems[index % sourceItems.length];
    return {
      ...base,
      cardKey: `${base.id}-${index}`,
    };
  });
};

export default function ExplorarPage() {
  const { data: items = [], isLoading: loading } = useGetExploreFeedQuery();

  const displayItems = useMemo(() => buildDisplayItems(items), [items]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SidebarLeft />

      <div className="md:pl-60">
        <div className="mx-auto w-full max-w-[1495px] px-4 py-6 md:px-6 md:py-7">
          <h1 className="mb-6 text-[25px] font-semibold leading-none text-zinc-900">
            Explorar perfiles
          </h1>

          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, index) => (
                <ExploreCardSkeleton key={`explore-skeleton-${index}`} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
              {displayItems.map((item) => (
                <Link
                  key={item.cardKey}
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
                      <div className="mt-2 text-[14px] font-semibold leading-none text-[#5A3EE7]">
                        Seguir
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
