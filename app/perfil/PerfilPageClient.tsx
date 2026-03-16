"use client";




import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bookmark,
  Grid,
  Lock,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import { usePostsStore } from "@/lib/store";

export default function PerfilPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const posts = usePostsStore((state) => state.posts);
  const [activeTab, setActiveTab] = useState<"posts" | "purchased">("posts");
  const searchParams = useSearchParams();
  const profileName = searchParams.get("user") ?? "creativestudio";
  const profileFullName = searchParams.get("full") ?? "Creative Studio";
  const profileAvatar =
    searchParams.get("avatar") ??
    "https://picsum.photos/seed/creative-profile/120/120";

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
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[1100px] md:gap-8 md:px-6 md:py-8">
          <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <img
                  src={profileAvatar}
                  alt={profileName}
                  className="h-24 w-24 rounded-full object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold">{profileName}</h1>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-sky-500 text-[10px] font-bold text-white">
                      ✓
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold">
                    {profileFullName}
                  </div>
                </div>
              </div>

              <button className="rounded-[5px] border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700">
                Editar perfil
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-zinc-600">
              <div>
                <span className="text-lg font-semibold text-zinc-900">6</span>
                <span className="ml-2">Publicaciones</span>
              </div>
              <div>
                <span className="text-lg font-semibold text-zinc-900">
                  45.230
                </span>
                <span className="ml-2">Seguidores</span>
              </div>
              <div>
                <span className="text-lg font-semibold text-zinc-900">892</span>
                <span className="ml-2">Seguidos</span>
              </div>
              <div className="flex items-center gap-2 rounded-[5px] bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-900">
                <Sparkles className="h-4 w-4" />
                $12.480 ventas
              </div>
            </div>
          </div>

          <div className="rounded-[5px] border border-zinc-200 bg-white">
            <div className="flex items-center gap-8 border-b border-zinc-200 px-6 pt-4 text-sm font-semibold text-zinc-500">
              <button
                onClick={() => setActiveTab("posts")}
                className={`pb-3 ${
                  activeTab === "posts"
                    ? "border-b-2 border-zinc-900 text-zinc-900"
                    : ""
                }`}
              >
                <Grid className="mr-2 inline h-4 w-4" />
                Posteos
              </button>
              <button
                onClick={() => setActiveTab("purchased")}
                className={`pb-3 ${
                  activeTab === "purchased"
                    ? "border-b-2 border-zinc-900 text-zinc-900"
                    : ""
                }`}
              >
                <Bookmark className="mr-2 inline h-4 w-4" />
                Comprados
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 p-6">
              {activeTab === "posts" ? (
                posts.map((post) => (
                  <div
                    key={post.id}
                    className="relative aspect-square overflow-hidden rounded-[5px] border border-zinc-200"
                  >
                    <img
                      src={post.media[0]?.url}
                      alt={post.author}
                      className="h-full w-full object-cover"
                    />
                    {post.media.some((item) => item.locked) ? (
                      <div className="absolute right-2 top-2 rounded-[5px] bg-white/90 px-2 py-1 text-[10px] font-semibold text-zinc-700">
                        <Lock className="mr-1 inline h-3 w-3" />
                        Locked
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="col-span-3 rounded-[5px] border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">
                  Aun no tienes compras.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
