"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  BadgeDollarSign,
  Bell,
  CreditCard,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Wallet,
  type LucideProps,
} from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import {
  useGetNotificationCenterQuery,
  useMarkNotificationsAsReadMutation,
} from "@/lib/redux/api/notificationsApi";
import type { NotificationActivityItem } from "@/lib/server/repositories/notification-center";
import { cn } from "@/lib/utils";

type Tone = {
  pillClassName: string;
  iconWrapClassName: string;
  iconClassName: string;
  label: string;
  icon: ComponentType<LucideProps>;
};

const NOTIFICATION_TONES: Record<string, Tone> = {
  follow: {
    label: "Nuevo seguidor",
    pillClassName: "bg-sky-50 text-sky-700",
    iconWrapClassName: "bg-sky-100",
    iconClassName: "text-sky-700",
    icon: UserPlus,
  },
  tip: {
    label: "Nueva propina",
    pillClassName: "bg-emerald-50 text-emerald-700",
    iconWrapClassName: "bg-emerald-100",
    iconClassName: "text-emerald-700",
    icon: BadgeDollarSign,
  },
  purchase: {
    label: "Nueva venta",
    pillClassName: "bg-violet-50 text-violet-700",
    iconWrapClassName: "bg-violet-100",
    iconClassName: "text-violet-700",
    icon: CreditCard,
  },
  withdrawal_update: {
    label: "Retiro",
    pillClassName: "bg-amber-50 text-amber-700",
    iconWrapClassName: "bg-amber-100",
    iconClassName: "text-amber-700",
    icon: Wallet,
  },
  author_application_update: {
    label: "Solicitud de autor",
    pillClassName: "bg-indigo-50 text-indigo-700",
    iconWrapClassName: "bg-indigo-100",
    iconClassName: "text-indigo-700",
    icon: Sparkles,
  },
  content_removed_update: {
    label: "Moderación",
    pillClassName: "bg-rose-50 text-rose-700",
    iconWrapClassName: "bg-rose-100",
    iconClassName: "text-rose-700",
    icon: ShieldAlert,
  },
};

const getTone = (type: string): Tone =>
  NOTIFICATION_TONES[type] ?? {
    label: "Notificación",
    pillClassName: "bg-zinc-100 text-zinc-700",
    iconWrapClassName: "bg-zinc-100",
    iconClassName: "text-zinc-600",
    icon: Bell,
  };

const PAGE_SIZE = 12;

const buildDayLabel = (value: string) =>
  new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

function NotificationsSkeleton() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-sm">
      <div className="grid grid-cols-[72px_minmax(0,1fr)] border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="fanpush-skeleton h-3 w-12 rounded-full" />
        <div className="fanpush-skeleton h-3 w-32 rounded-full" />
      </div>
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={`notifications-page-skeleton-${index}`}
            className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 px-4 py-4"
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
}: {
  item: NotificationActivityItem;
}) {
  const tone = getTone(item.type);
  const Icon = tone.icon;
  const content = (
    <div className="group grid grid-cols-[72px_minmax(0,1fr)] gap-3 px-4 py-4 transition hover:bg-zinc-50">
      {item.avatar ? (
        <UserAvatar
          src={item.avatar}
          alt={item.text}
          sizeClassName="h-11 w-11"
          iconClassName="h-4 w-4"
        />
      ) : (
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            tone.iconWrapClassName,
          )}
        >
          <Icon className={cn("h-[18px] w-[18px]", tone.iconClassName)} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold",
              tone.pillClassName,
            )}
          >
            {tone.label}
          </span>
          <span className="text-[12px] font-medium text-zinc-400">
            {item.dateLabel}
          </span>
          {!item.isRead ? (
            <span className="h-2 w-2 rounded-full bg-zinc-950" aria-hidden="true" />
          ) : null}
        </div>

        <p className="mt-2.5 max-w-[980px] text-[15px] leading-[1.35] text-zinc-900">
          {item.text}
        </p>
      </div>
    </div>
  );

  if (item.action) {
    return (
      <Link href={item.action.href} className="block hover:bg-zinc-50">
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
    refetch,
  } = useGetNotificationCenterQuery();
  const [markNotificationsAsRead] = useMarkNotificationsAsReadMutation();
  const activity = centerData?.activity ?? [];
  const unreadIds = activity
    .filter((item) => !item.isRead)
    .map((item) => item.id);

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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <SidebarLeft />

      <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-24 md:pl-[280px] md:pr-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-semibold leading-none tracking-tight text-zinc-950 md:text-[42px]">
              Notifications
            </h1>
          </div>

          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching ? "animate-spin" : "")}
            />
            {isFetching ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        <div className="mt-6 h-px w-full bg-zinc-200" />

        {error ? (
          <div className="mt-6 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="mt-6">
          {isLoading ? (
            <NotificationsSkeleton />
          ) : activity.length === 0 ? (
            <div className="rounded-[20px] border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <p className="mt-4 text-[15px] font-semibold text-zinc-900">
                No tienes notificaciones todavía.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {groupedItems.map((group) => (
                <div
                  key={group.day}
                  className="overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                      {group.day}
                    </div>
                  </div>
                  <div className="grid grid-cols-[72px_minmax(0,1fr)] border-b border-zinc-100 bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    <span>Tipo</span>
                    <span>Detalle</span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {group.items.map((item) => (
                      <NotificationRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 rounded-[18px] border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-[13px] text-zinc-500">
                  Página {page} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    disabled={page === totalPages}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
