"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Link as LinkIcon, Send, Share2, X } from "lucide-react";
import type { Post } from "@/lib/store/posts";

type SharePostModalProps = {
  open: boolean;
  post: Post | null;
  sharePath: string | null;
  onClose: () => void;
};

const shareNetworks = (
  url: string,
  text: string,
): Array<{ label: string; href: string }> => [
  {
    label: "WhatsApp",
    href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    label: "Telegram",
    href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    label: "X",
    href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    label: "Facebook",
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
];

export default function SharePostModal({
  open,
  post,
  sharePath,
  onClose,
}: SharePostModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const shareUrl = useMemo(() => {
    if (!sharePath || typeof window === "undefined") return "";
    return `${window.location.origin}${sharePath}`;
  }, [sharePath]);

  const shareText = useMemo(() => {
    if (!post) return "Mira esta publicación en FanPush";
    return `Mira la publicación de @${post.author} en FanPush`;
  }, [post]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setShareError(null);
    } catch {
      setShareError("No pudimos copiar el link. Intenta de nuevo.");
    }
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !navigator.share) return;
    try {
      await navigator.share({
        title: "FanPush",
        text: shareText,
        url: shareUrl,
      });
      setShareError(null);
    } catch {
      // Ignore aborts from native share sheet.
    }
  };

  if (!open || !post || !sharePath) return null;

  const networks = shareNetworks(shareUrl, shareText);

  return (
    <div className="fixed inset-0 z-[112] flex items-center justify-center bg-black/55 px-4 py-8">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Cerrar compartir"
      />
      <div className="relative w-full max-w-[460px] rounded-[18px] bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-[8px] p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f1ebff] text-[#5A3EE7]">
            <Share2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[24px] font-semibold leading-none text-zinc-950">
              Compartir publicación
            </h3>
            <p className="mt-2 text-[15px] leading-6 text-[#464646]">
              Comparte este post con un link directo o por tus redes.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[12px] border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="text-[14px] font-semibold text-zinc-900">
            Link del post
          </div>
          <div className="mt-2 flex items-center gap-3">
            <LinkIcon className="h-4 w-4 text-zinc-400" />
            <div className="min-w-0 flex-1 truncate text-[14px] text-zinc-700">
              {shareUrl}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="fanpush-button-primary inline-flex h-11 items-center justify-center gap-2 px-4"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Link copiado" : "Copiar link"}
          </button>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <button
              type="button"
              onClick={handleNativeShare}
              className="fanpush-button-secondary inline-flex h-11 items-center justify-center gap-2 px-4"
            >
              <Send className="h-4 w-4" />
              Compartir
            </button>
          ) : null}
        </div>

        <div className="mt-6">
          <div className="text-[13px] font-semibold text-zinc-500">
            Compartir en redes
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {networks.map((network) => (
              <a
                key={network.label}
                href={network.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-[12px] border border-zinc-200 bg-white px-4 text-[14px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                {network.label}
              </a>
            ))}
          </div>
        </div>

        {shareError ? (
          <div className="mt-4 rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-700">
            {shareError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
