"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";

const exploreItems = [
  {
    id: 1,
    type: "video",
    poster: "https://picsum.photos/seed/explore-1/600/800",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    id: 2,
    type: "video",
    poster: "https://picsum.photos/seed/explore-2/600/800",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
  },
  { id: 3, type: "photo", src: "https://picsum.photos/seed/explore-3/600/800" },
  { id: 4, type: "photo", src: "https://picsum.photos/seed/explore-4/600/800" },
  { id: 5, type: "photo", src: "https://picsum.photos/seed/explore-5/600/800" },
  {
    id: 6,
    type: "video",
    poster: "https://picsum.photos/seed/explore-6/600/800",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  { id: 7, type: "photo", src: "https://picsum.photos/seed/explore-7/600/800" },
  {
    id: 8,
    type: "video",
    poster: "https://picsum.photos/seed/explore-8/600/800",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
  },
  { id: 9, type: "photo", src: "https://picsum.photos/seed/explore-9/600/800" },
  { id: 10, type: "photo", src: "https://picsum.photos/seed/explore-10/600/800" },
  {
    id: 11,
    type: "video",
    poster: "https://picsum.photos/seed/explore-11/600/800",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  { id: 12, type: "photo", src: "https://picsum.photos/seed/explore-12/600/800" },
];

export default function ExplorarPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
                Descubre fotos y videos destacados.
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-8">
            <div className="grid w-full grid-cols-[repeat(4,minmax(0,1fr))] gap-4">
              {exploreItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-[3/4] overflow-hidden rounded-[5px] bg-zinc-200"
                >
                  {item.type === "video" ? (
                    <video
                      className="h-full w-full object-cover"
                      poster={item.poster}
                      muted
                      playsInline
                      preload="metadata"
                      onMouseEnter={(event) => {
                        event.currentTarget.play();
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.pause();
                        event.currentTarget.currentTime = 0;
                      }}
                    >
                      <source src={item.video} />
                    </video>
                  ) : (
                    <img
                      src={item.src}
                      alt="Explorar"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  )}
                  {item.type === "video" ? (
                    <div className="pointer-events-none absolute right-3 top-3 rounded-[5px] bg-white/90 p-1 shadow">
                      <Play className="h-4 w-4 text-zinc-900" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
