"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

type DirectThreadPreview = {
  id: string;
  username: string;
  avatarUrl: string | null;
  unread?: boolean;
};

export default function FloatingMessagesButton() {
  const pathname = usePathname();
  const [threads, setThreads] = useState<DirectThreadPreview[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  const hidden =
    pathname === "/mensajes" ||
    pathname === "/ventas" ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/terminos") ||
    pathname?.startsWith("/privacidad") ||
    pathname?.startsWith("/ayuda") ||
    pathname?.startsWith("/faq");

  useEffect(() => {
    if (hidden) return;

    let cancelled = false;

    const loadThreads = async () => {
      try {
        const supabase = getSupabaseClient();
        const session = supabase
          ? await supabase.auth.getSession().then((result) => result.data.session)
          : null;
        const response = await fetch("/api/direct-chats", {
          credentials: "include",
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        const result = (await response.json()) as {
          threads?: DirectThreadPreview[];
        };
        if (!response.ok || cancelled) return;

        const nextThreads = (result.threads ?? []).slice(0, 3);
        setThreads(nextThreads);
        setHasUnread(Boolean((result.threads ?? []).some((thread) => thread.unread)));
      } catch {
        if (!cancelled) {
          setThreads([]);
          setHasUnread(false);
        }
      }
    };

    void loadThreads();
    window.addEventListener("focus", loadThreads);
    window.addEventListener("purchases-updated", loadThreads);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadThreads);
      window.removeEventListener("purchases-updated", loadThreads);
    };
  }, [hidden]);

  const stackedAvatars = useMemo(
    () => threads.filter((thread) => thread.avatarUrl).slice(0, 3),
    [threads],
  );

  if (hidden) return null;

  return (
    <Link
      href="/mensajes"
      className="fixed bottom-7 right-6 z-[120] flex min-h-[68px] items-center gap-4 rounded-full border border-black/8 bg-white/95 px-5 py-3 text-zinc-950 shadow-[0_18px_45px_rgba(15,23,42,0.14)] backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.18)] md:bottom-8 md:right-8"
      aria-label="Abrir mensajes"
    >
      <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-zinc-50 text-zinc-950">
        <Image
          src="/messages-nav-icon.png"
          alt=""
          width={22}
          height={18}
          className="h-[18px] w-[22px] object-contain brightness-0 saturate-100"
          unoptimized
          aria-hidden="true"
        />
        {hasUnread ? (
          <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-[#ff334b]" />
        ) : null}
      </span>

      <span className="pr-1 text-[16px] font-semibold tracking-[-0.02em] text-zinc-950">
        Mensajes
      </span>

      <span className="flex items-center">
        {stackedAvatars.length > 0 ? (
          stackedAvatars.map((thread, index) => (
            <span
              key={thread.id}
              className={`relative ${index === 0 ? "" : "-ml-3"}`}
            >
              <Image
                src={thread.avatarUrl ?? "/default-avatar.svg"}
                alt={thread.username}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm"
                unoptimized
              />
            </span>
          ))
        ) : (
          <>
            {[0, 1, 2].map((index) => (
              <span
                key={`placeholder-avatar-${index}`}
                className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-zinc-100 shadow-sm ${index === 0 ? "" : "-ml-3"}`}
              >
                <span className="h-4 w-4 rounded-full bg-zinc-300" />
              </span>
            ))}
          </>
        )}
      </span>
    </Link>
  );
}
