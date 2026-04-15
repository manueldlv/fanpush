"use client";

import Link from "next/link";
import MediaImage from "@/components/MediaImage";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import { useGetExploreFeedQuery, type ExploreItem } from "@/lib/redux/api/discoveryApi";
import { buildUserProfileHref } from "@/lib/profileRoute";

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

export default function ExplorarPage() {
  const { data: items = [], isLoading: loading } = useGetExploreFeedQuery();

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
          ) : items.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
              {items.map((item) => (
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
                      <div className="mt-2 text-[14px] font-semibold leading-none text-[#5A3EE7]">
                        Seguir
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[5px] border border-zinc-200 bg-white px-6 py-10 text-center">
              <div className="text-[24px] font-semibold text-zinc-900">
                Todavía no hay perfiles para explorar
              </div>
              <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-7 text-[#464646]">
                Cuando los autores publiquen contenido público, vas a poder descubrirlos
                desde acá.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
