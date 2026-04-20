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
): Array<{ label: string; href: string; kind: "link" | "copy"; accent: string }> => [
  {
    label: "WhatsApp",
    href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    kind: "link",
    accent: "#25D366",
  },
  {
    label: "Telegram",
    href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    kind: "link",
    accent: "#229ED9",
  },
  {
    label: "X",
    href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    kind: "link",
    accent: "#111111",
  },
  {
    label: "Facebook",
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    kind: "link",
    accent: "#1877F2",
  },
  {
    label: "Instagram",
    href: "",
    kind: "copy",
    accent: "#E1306C",
  },
];

function SocialIcon({ label }: { label: string }) {
  if (label === "WhatsApp") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M19.05 4.94A9.86 9.86 0 0 0 12 2a9.94 9.94 0 0 0-8.6 14.9L2 22l5.25-1.37A10 10 0 1 0 19.05 4.94ZM12 20a8 8 0 0 1-4.08-1.11l-.29-.17-3.12.82.83-3.04-.19-.31A8 8 0 1 1 12 20Zm4.39-5.9c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.18-.7-.63-1.17-1.42-1.3-1.66-.14-.24-.01-.37.1-.49.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.42-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.68 2.57 4.08 3.6.57.25 1.02.4 1.36.51.57.18 1.1.16 1.52.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
      </svg>
    );
  }

  if (label === "Telegram") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M21.94 4.66c.16-.75-.37-1.05-1.03-.79L2.89 10.8c-.73.28-.72.7-.13.88l4.62 1.44 1.8 5.74c.24.67.12.94.83.94.55 0 .79-.25 1.1-.56l2.55-2.48 5.3 3.91c.98.54 1.68.26 1.92-.91l3.06-15.1ZM8.17 12.79l9.86-6.22c.49-.3.94-.14.57.19l-8.12 7.33-.31 3.32-2-4.62Z" />
      </svg>
    );
  }

  if (label === "X") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H21l-4.58 5.24L21.8 22h-5.95l-4.66-6.1L5.86 22H3.75l4.9-5.6L2.2 2h6.1l4.21 5.57L18.9 2Zm-1.04 18h1.16L7.64 3.9H6.4L17.86 20Z" />
      </svg>
    );
  }

  if (label === "Facebook") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M13.5 22v-8.1h2.73l.41-3.16H13.5V8.7c0-.92.26-1.54 1.58-1.54h1.68V4.33c-.29-.04-1.28-.11-2.43-.11-2.4 0-4.05 1.47-4.05 4.18v2.33H7.5v3.16h2.78V22h3.22Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4A5.8 5.8 0 0 1 16.2 22H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 1.8A4 4 0 0 0 3.8 7.8v8.4a4 4 0 0 0 4 4h8.4a4 4 0 0 0 4-4V7.8a4 4 0 0 0-4-4H7.8Zm8.85 1.35a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1ZM12 6.9A5.1 5.1 0 1 1 6.9 12 5.1 5.1 0 0 1 12 6.9Zm0 1.8A3.3 3.3 0 1 0 15.3 12 3.3 3.3 0 0 0 12 8.7Z" />
    </svg>
  );
}

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

  const handleInstagramShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setShareError("Link copiado para compartir en Instagram.");
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    } catch {
      setShareError("No pudimos preparar el link para Instagram.");
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
          <div className="text-[14px] font-semibold text-zinc-900">
            Compartir en redes
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {networks.map((network) => (
              network.kind === "link" ? (
                <a
                  key={network.label}
                  href={network.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={network.label}
                  title={network.label}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 transition hover:scale-[1.03] hover:bg-zinc-50"
                  style={{ color: network.accent }}
                >
                  <SocialIcon label={network.label} />
                </a>
              ) : (
                <button
                  key={network.label}
                  type="button"
                  onClick={handleInstagramShare}
                  aria-label={network.label}
                  title={network.label}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 transition hover:scale-[1.03] hover:bg-zinc-50"
                  style={{ color: network.accent }}
                >
                  <SocialIcon label={network.label} />
                </button>
              )
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
