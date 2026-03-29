"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { getSupabaseClient } from "@/lib/supabase";

type ExploreItem = {
  id: string;
  mediaUrl: string | null;
  mediaType: string;
  username: string;
  avatar: string | null;
  description: string;
  createdAt: string;
};

function ExploreCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-zinc-200 bg-white shadow-sm">
      <div className="fanpush-skeleton aspect-[3/4] w-full bg-zinc-100" />
      <div className="flex items-center gap-3 p-3">
        <div className="fanpush-skeleton h-10 w-10 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="fanpush-skeleton h-4 w-24 rounded-full" />
          <div className="mt-2 fanpush-skeleton h-3 w-36 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function ExplorarPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExplore = async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data } = await supabase
          .from("albums")
          .select(
            "id,description,created_at,price,users(username,avatar_url),album_posts(post_id,post:posts(id,media_url,media_type,is_locked,created_at))",
          )
          .lte("price", 0)
          .order("created_at", { ascending: false })
          .limit(60);

        const resolvePublicUrl = (value: string | null) => {
          if (!value) return null;
          if (value.startsWith("http")) return value;
          return supabase.storage.from("Imagenes").getPublicUrl(value).data.publicUrl;
        };

        const mapped: ExploreItem[] = (data ?? [])
          .flatMap((album) => {
            const owner = Array.isArray(album.users) ? album.users[0] : album.users;
            const username = owner?.username ?? "usuario";
            const avatar = resolvePublicUrl(owner?.avatar_url ?? null);
            const description = album.description ?? "";

            return Array.isArray(album.album_posts)
              ? album.album_posts
                  .map((link) => {
                    const post = Array.isArray(link.post) ? link.post[0] : link.post;
                    if (!post?.media_url) return null;
                    if (post.is_locked) return null;
                    return {
                      id: post.id ?? link.post_id,
                      mediaUrl: resolvePublicUrl(post.media_url ?? null),
                      mediaType: post.media_type ?? "image",
                      username,
                      avatar,
                      description,
                      createdAt: post.created_at ?? album.created_at,
                    };
                  })
                  .filter(Boolean) as ExploreItem[]
              : [];
          })
          .filter((item) => Boolean(item.mediaUrl));

        setItems(mapped);
      } finally {
        setLoading(false);
      }
    };

    void loadExplore();
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <SidebarLeft
        searchOpen={searchOpen}
        onSearchClick={() => {
          setNotificationsOpen(false);
          setSearchOpen(true);
        }}
        notificationsOpen={notificationsOpen}
        onNotificationsClick={() => {
          setSearchOpen(false);
          setNotificationsOpen(true);
        }}
      />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[1280px] md:px-6 md:py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Explorar</h1>
              <p className="text-sm text-zinc-500">
                Descubre perfiles y contenido gratuito publicado en FanPush.
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-8">
            {loading ? (
              <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 12 }).map((_, index) => (
                  <ExploreCardSkeleton key={`explore-skeleton-${index}`} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-[24px] border border-zinc-200 bg-white px-6 py-10 text-center">
                <div className="text-lg font-semibold text-zinc-950">
                  Aún no hay contenido gratuito para explorar
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Cuando los creadores publiquen fotos o videos públicos, los verás acá sin blur ni bloqueo.
                </p>
              </div>
            ) : (
              <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={buildUserProfileHref(item.username)}
                    className="group overflow-hidden rounded-[18px] border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-zinc-100">
                      {item.mediaType === "video" ? (
                        <>
                          <video
                            src={item.mediaUrl ?? undefined}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow">
                            <Play className="h-4 w-4 text-zinc-900" />
                          </div>
                        </>
                      ) : (
                        <MediaImage
                          src={item.mediaUrl ?? undefined}
                          alt={item.description || item.username}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          fallbackClassName="h-full w-full"
                          iconClassName="h-7 w-7"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-3 p-3">
                      <UserAvatar
                        src={item.avatar}
                        alt={item.username}
                        sizeClassName="h-10 w-10"
                        iconClassName="h-4 w-4"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-950">
                          @{item.username}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {item.description || "Contenido gratuito"}
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
    </div>
  );
}
