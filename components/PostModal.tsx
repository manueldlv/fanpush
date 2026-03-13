"use client";

import { useEffect, useState } from "react";
import { Lock, X } from "lucide-react";
import type { Post } from "@/lib/store";

type PostModalProps = {
  post: Post;
  onClose: () => void;
};

export default function PostModal({ post, onClose }: PostModalProps) {
  const [index, setIndex] = useState(0);
  const lockedCount = post.media.filter((m) => m.locked).length;
  const current = post.media[index];

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Cerrar"
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-6 top-6 rounded-[5px] bg-white/90 p-2"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex w-full max-w-[1100px] overflow-hidden rounded-[5px] bg-white">
        <div className="relative flex-1 bg-black min-h-[520px] max-h-[680px]">
          {current.kind === "image" ? (
            <img
              src={current.url}
              alt={post.author}
              className={`h-full w-full object-cover ${
                current.locked ? "blur-[10px]" : ""
              }`}
              style={{ filter: current.locked ? "blur(10px)" : "none" }}
            />
          ) : (
            <video
              src={current.url}
              className={`h-full w-full object-cover ${
                current.locked ? "blur-[10px]" : ""
              }`}
              muted
              playsInline
              style={{ filter: current.locked ? "blur(10px)" : "none" }}
            />
          )}

          {post.media.length > 1 ? (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <button
                type="button"
                onClick={() =>
                  setIndex((prev) =>
                    (prev - 1 + post.media.length) % post.media.length,
                  )
                }
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
                onClick={() =>
                  setIndex((prev) => (prev + 1) % post.media.length)
                }
                className="rounded-[5px] bg-white/80 px-2 py-1 text-xs font-semibold text-zinc-700"
              >
                ›
              </button>
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
          {current.locked ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-[5px] bg-white/95 px-8 py-6 text-center shadow-md">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[5px] bg-zinc-100">
                  <Lock className="h-5 w-5 text-zinc-600" />
                </div>
                <div className="mt-3 text-sm font-semibold text-zinc-900">
                  Desbloquear post completo
                </div>
                <div className="text-xs text-zinc-500">
                  1 contenido bloqueado
                </div>
                <div className="mt-3 rounded-[5px] bg-zinc-900 px-6 py-2 text-sm font-semibold text-white">
                  ${post.price?.toFixed(2) ?? "0.00"}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="w-[360px] border-l border-zinc-200 p-6">
          {lockedCount > 0 ? (
            <div className="rounded-[5px] border border-zinc-200 p-4">
              <div className="text-sm font-semibold text-zinc-900">
                Desbloquear post completo
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                {lockedCount} contenido bloqueado
              </div>
              <button className="mt-4 w-full rounded-[5px] bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
                Desbloquear por ${post.price?.toFixed(2) ?? "0.00"}
              </button>
            </div>
          ) : (
            <div className="text-sm text-zinc-500">Sin contenido bloqueado.</div>
          )}
        </div>
      </div>
    </div>
  );
}
