"use client";

import { Bookmark, Heart, Lock, MoreHorizontal, Send } from "lucide-react";
import { usePostsStore } from "@/lib/store";
import { useEffect, useState } from "react";
import PostModal from "@/components/PostModal";

export default function FeedLayout() {
  const posts = usePostsStore((state) => state.posts);
  const [activeIndex, setActiveIndex] = useState<Record<string, number>>({});
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);

  const openPost = posts.find((post) => post.id === selectedPost) ?? null;
  const menuPost = posts.find((post) => post.id === menuPostId) ?? null;

  useEffect(() => {
    if (!menuPostId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuPostId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [menuPostId]);

  return (
    <section className="flex w-full max-w-none flex-col gap-6 md:max-w-[630px] md:pr-2">
      {openPost ? (
        <PostModal post={openPost} onClose={() => setSelectedPost(null)} />
      ) : null}
      {menuPost ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-6 py-10">
          <button
            type="button"
            onClick={() => setMenuPostId(null)}
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Cerrar menu"
          />
          <div className="relative w-full max-w-[520px] overflow-hidden rounded-[18px] bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMenuPostId(null)}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-semibold text-red-600"
            >
              Denunciar
            </button>
            <button
              type="button"
              onClick={() => setMenuPostId(null)}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-semibold text-red-600"
            >
              Dejar de seguir
            </button>
            <button
              type="button"
              onClick={() => setMenuPostId(null)}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
            >
              Añadir a favoritos
            </button>
            <button
              type="button"
              onClick={() => setMenuPostId(null)}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
            >
              Ir a la publicación
            </button>
            <button
              type="button"
              onClick={() => setMenuPostId(null)}
              className="w-full border-b border-zinc-200 py-4 text-center text-sm font-medium text-zinc-900"
            >
              Información sobre esta cuenta
            </button>
            <button
              type="button"
              onClick={() => setMenuPostId(null)}
              className="w-full py-4 text-center text-sm font-medium text-zinc-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {posts.map((post) => (
        <article
          key={post.id}
          className="rounded-[5px] border border-zinc-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <img
                src={post.avatar}
                alt={post.author}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <span>{post.author}</span>
                  {post.verified ? (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] bg-sky-500 text-[10px] font-bold text-white">
                      ✓
                    </span>
                  ) : null}
                  <span className="text-xs font-normal text-zinc-500">
                    · {post.time}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">{post.suggestion}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="text-sm font-semibold text-blue-600">
                Seguir
              </button>
              <button
                type="button"
                onClick={() => setMenuPostId(post.id)}
                className="rounded-[5px] p-2 text-zinc-500 hover:bg-zinc-100"
                aria-label="Mas opciones"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedPost(post.id)}
            className="relative aspect-square w-full overflow-hidden text-left"
          >
            {post.media.map((item, index) => {
              const current = activeIndex[post.id] ?? 0;
              const isActive = index === current;
              const lockedCount = post.media.filter((m) => m.locked).length;
              return (
                <div
                  key={`${post.id}-${index}`}
                  className={`absolute inset-0 transition-opacity duration-300 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {item.kind === "image" ? (
                    <img
                      src={item.url}
                      alt={`Media de ${post.author}`}
                      className={`h-full w-full object-cover ${
                        item.locked ? "blur-[6px]" : ""
                      }`}
                    />
                  ) : (
                    <video
                      src={item.url}
                      className={`h-full w-full object-cover ${
                        item.locked ? "blur-[6px]" : ""
                      }`}
                      muted
                      playsInline
                    />
                  )}
                  {item.locked ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-[5px] bg-white/95 px-6 py-5 text-center shadow-md">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[5px] bg-zinc-100">
                          <Lock className="h-5 w-5 text-zinc-600" />
                        </div>
                        <div className="mt-3 text-sm font-semibold text-zinc-900">
                          Desbloquear post completo
                        </div>
                        <div className="text-xs text-zinc-500">
                          {lockedCount} contenido bloqueado
                        </div>
                        <div className="mt-3 rounded-[5px] bg-zinc-900 px-5 py-2 text-sm font-semibold text-white">
                          ${post.price?.toFixed(2) ?? "0.00"}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {lockedCount > 0 ? (
                    <div className="absolute right-4 top-4 rounded-[5px] bg-white/90 px-3 py-1 text-xs font-semibold text-zinc-700">
                      <span className="inline-flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        {lockedCount} locked
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {post.media.length > 1 ? (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
                {post.media.map((_, index) => {
                  const current = activeIndex[post.id] ?? 0;
                  return (
                    <button
                      key={`dot-${post.id}-${index}`}
                      type="button"
                      onClick={() =>
                        setActiveIndex((prev) => ({ ...prev, [post.id]: index }))
                      }
                      className={`h-2 w-2 rounded-[5px] ${
                        current === index ? "bg-white" : "bg-white/50"
                      }`}
                      aria-label="Cambiar slide"
                    />
                  );
                })}
              </div>
            ) : null}
            {post.media.length > 1 ? (
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveIndex((prev) => {
                      const current = prev[post.id] ?? 0;
                      const next =
                        (current - 1 + post.media.length) % post.media.length;
                      return { ...prev, [post.id]: next };
                    });
                  }}
                  className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
                >
                  ‹
                </button>
              </div>
            ) : null}
            {post.media.length > 1 ? (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveIndex((prev) => {
                      const current = prev[post.id] ?? 0;
                      const next = (current + 1) % post.media.length;
                      return { ...prev, [post.id]: next };
                    });
                  }}
                  className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
                >
                  ›
                </button>
              </div>
            ) : null}
          </button>

          <div className="px-5 py-4">
            <div className="text-sm font-semibold text-zinc-900">
              {post.likes.toLocaleString("es-AR")} Me gusta
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-4 text-zinc-700">
                <button className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  <span className="text-xs">{post.likes}</span>
                </button>
                <button className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <button aria-label="Guardar">
                <Bookmark className="h-5 w-5 text-zinc-700" />
              </button>
            </div>

            <div className="mt-4 text-sm text-zinc-700">
              <span className="font-semibold text-zinc-900">
                {post.author}
              </span>{" "}
              {post.caption}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
