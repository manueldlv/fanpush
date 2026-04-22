"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import { buildUserProfileHref } from "@/lib/profileRoute";
import {
  useGetNotificationCenterQuery,
  useMarkNotificationsAsReadMutation,
} from "@/lib/redux/api/notificationsApi";
import { getSupabaseClient } from "@/lib/supabase";
import type { NotificationActivityItem } from "@/lib/server/repositories/notification-center";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

const buildDayLabel = (value: string) =>
  new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

function NotificationsSkeleton() {
  return (
    <div className="overflow-hidden rounded-[5px] border border-[#E0E0E0] bg-white">
      <div className="border-b border-[#E0E0E0] px-5 py-4">
        <div className="fanpush-skeleton h-4 w-32 rounded-full" />
      </div>
      <div className="divide-y divide-[#F1F1F1]">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={`notifications-page-skeleton-${index}`}
            className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 px-5 py-4"
          >
            <div className="fanpush-skeleton h-11 w-11 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <div className="fanpush-skeleton h-7 w-28 rounded-full" />
                <div className="fanpush-skeleton h-4 w-14 rounded-full" />
              </div>
              <div className="mt-3 fanpush-skeleton h-3.5 w-full rounded-full" />
              <div className="mt-2 fanpush-skeleton h-4 w-3/4 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  isFollowing,
  followLoading,
  onFollow,
}: {
  item: NotificationActivityItem;
  isFollowing: boolean;
  followLoading: boolean;
  onFollow: (item: NotificationActivityItem) => Promise<void>;
}) {
  const content = (
    <div className="flex items-center gap-3 px-5 py-4 transition hover:bg-zinc-50/80">
      <UserAvatar
        src={item.avatar}
        alt={item.text}
        sizeClassName="h-11 w-11"
        iconClassName="h-4 w-4"
      />

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium leading-[1.4] text-zinc-900">
          {item.text}
          <span className="ml-2 text-[14px] text-zinc-400">{item.dateLabel}</span>
        </p>
      </div>

      {item.type === "follow" && item.actorId ? (
        <button
          type="button"
          onClick={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await onFollow(item);
          }}
          disabled={followLoading}
          className={cn(
            "inline-flex min-w-[112px] items-center justify-center rounded-[10px] px-4 py-2.5 text-[14px] font-semibold transition",
            isFollowing
              ? "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              : "bg-[#5A3EE7] text-white hover:bg-[#4931bc]",
            followLoading ? "cursor-wait opacity-60" : "",
          )}
        >
          {isFollowing ? "Siguiendo" : "Seguir"}
        </button>
      ) : null}

      {!item.isRead ? (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#5A3EE7]" aria-hidden="true" />
      ) : null}
    </div>
  );

  if (item.actorUsername) {
    return (
      <Link href={buildUserProfileHref(item.actorUsername)} className="block">
        {content}
      </Link>
    );
  }

  if (item.action) {
    return (
      <Link href={item.action.href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export default function NotificacionesPage() {
  const {
    data: centerData,
    isLoading,
    isFetching,
    error,
  } = useGetNotificationCenterQuery();
  const [markNotificationsAsRead] = useMarkNotificationsAsReadMutation();
  const activity = centerData?.activity ?? [];
  const [followingActorIds, setFollowingActorIds] = useState<Set<string>>(new Set());
  const [followPendingIds, setFollowPendingIds] = useState<Set<string>>(new Set());
  const followActorIdsKey = useMemo(
    () =>
      Array.from(
        new Set(
          activity
            .filter((item) => item.type === "follow" && item.actorId)
            .map((item) => item.actorId as string),
        ),
      )
        .sort()
        .join(","),
    [activity],
  );
  const unreadIds = activity
    .filter((item) => !item.isRead)
    .map((item) => item.id);

  useEffect(() => {
    const loadFollowState = async () => {
      const actorIds = followActorIdsKey
        ? followActorIdsKey.split(",").filter(Boolean)
        : [];
      if (actorIds.length === 0) {
        setFollowingActorIds((prev) => (prev.size === 0 ? prev : new Set()));
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (!currentUserId) return;

      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .in("following_id", actorIds);

      setFollowingActorIds(
        (prev) => {
          const next = new Set(
            (data ?? []).map((row) => row.following_id).filter(Boolean),
          );
          const prevKey = Array.from(prev).sort().join(",");
          const nextKey = Array.from(next).sort().join(",");
          return prevKey === nextKey ? prev : next;
        },
      );
    };

    void loadFollowState();
  }, [followActorIdsKey]);

  useEffect(() => {
    if (unreadIds.length > 0) {
      void markNotificationsAsRead(unreadIds);
    }
  }, [markNotificationsAsRead, unreadIds]);

  const errorMessage =
    error && typeof error === "object" && "error" in error
      ? ((error as { error?: string }).error ??
        "No se pudieron cargar las notificaciones.")
      : "No se pudieron cargar las notificaciones.";
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(activity.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => activity.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [activity, page],
  );
  const groupedItems = useMemo(() => {
    const groups: Array<{ day: string; items: NotificationActivityItem[] }> = [];
    for (const item of pageItems) {
      const day = buildDayLabel(item.createdAt);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.day === day) {
        lastGroup.items.push(item);
      } else {
        groups.push({ day, items: [item] });
      }
    }
    return groups;
  }, [pageItems]);

  useEffect(() => {
    setPage(1);
  }, [activity.length]);

  const unreadCount = unreadIds.length;

  const handleFollow = async (item: NotificationActivityItem) => {
    if (!item.actorId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;
    if (!currentUserId || currentUserId === item.actorId) return;

    setFollowPendingIds((prev) => new Set(prev).add(item.actorId as string));
    try {
      if (followingActorIds.has(item.actorId)) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", item.actorId);
        if (error) throw error;

        setFollowingActorIds((prev) => {
          const next = new Set(prev);
          next.delete(item.actorId as string);
          return next;
        });
        return;
      }

      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: item.actorId,
      });
      if (error) throw error;

      setFollowingActorIds((prev) => new Set(prev).add(item.actorId as string));
    } finally {
      setFollowPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.actorId as string);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <SidebarLeft />

      <main className="mx-auto w-full max-w-[1540px] px-3 pb-24 pt-3 sm:px-4 md:pl-[280px] md:pr-8 md:pt-4">

        {error ? (
          <div className="rounded-[5px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[5px] border border-[#E0E0E0] bg-white">
          <div className="flex items-center justify-between border-b border-[#E0E0E0] px-5 py-4">
            <div>
              <div className="text-[20px] font-semibold text-zinc-950">
                Todas las notificaciones
              </div>
              <div className="mt-1 text-[13px] text-[#464646]">
                {activity.length} eventos · {unreadCount} sin leer
              </div>
            </div>
            {isFetching ? (
              <div className="text-[12px] font-medium text-zinc-400">
                Actualizando...
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <NotificationsSkeleton />
          ) : activity.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <p className="mt-4 text-[15px] font-semibold text-zinc-900">
                No tienes notificaciones todavía.
              </p>
            </div>
          ) : (
            <div className="grid gap-0">
              {groupedItems.map((group) => (
                <div key={group.day}>
                  <div className="border-b border-[#F1F1F1] bg-white px-5 py-3 text-[13px] font-medium text-zinc-400">
                    {group.day}
                  </div>
                  <div className="divide-y divide-[#F1F1F1] bg-white">
                    {group.items.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        isFollowing={Boolean(item.actorId && followingActorIds.has(item.actorId))}
                        followLoading={Boolean(item.actorId && followPendingIds.has(item.actorId))}
                        onFollow={handleFollow}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E0E0E0] bg-white px-4 py-3">
                <div className="text-[13px] text-zinc-500">
                  Mostrando {(page - 1) * PAGE_SIZE + 1}-
                  {Math.min(page * PAGE_SIZE, activity.length)} de {activity.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="inline-flex h-10 items-center justify-center rounded-[5px] border border-[#E0E0E0] bg-white px-4 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    disabled={page === totalPages}
                    className="inline-flex h-10 items-center justify-center rounded-[5px] border border-[#E0E0E0] bg-white px-4 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
