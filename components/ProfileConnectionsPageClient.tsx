"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import { useViewerSession } from "@/lib/redux/useViewerSession";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import { getSupabaseClient } from "@/lib/supabase";

type Props = {
  forcedUsername?: string;
};

type ConnectionRow = {
  id: string;
  username: string;
  avatar: string | null;
};

type TabKey = "followers" | "following";

const resolveAvatarUrl = async (value: string | null) => {
  const supabase = getSupabaseClient();
  if (!supabase || !value) return null;
  if (value.startsWith("http")) return value;
  return supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data.publicUrl;
};

export default function ProfileConnectionsPageClient({
  forcedUsername,
}: Props) {
  const searchParams = useSearchParams();
  const { userId: currentUserId, username: viewerUsername } = useViewerSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("usuario");
  const [rows, setRows] = useState<ConnectionRow[]>([]);

  const tab = useMemo<TabKey>(() => {
    const value = searchParams.get("tab");
    return value === "followers" ? "followers" : "following";
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error("Falta configurar Supabase.");
        }

        let viewedUserId: string | null = null;
        let viewedUsername = forcedUsername?.trim() || null;

        if (viewedUsername) {
          const { data, error: userError } = await supabase
            .from("users")
            .select("id, username")
            .eq("username", viewedUsername)
            .maybeSingle();

          if (userError) throw userError;
          viewedUserId = data?.id ?? null;
          viewedUsername = data?.username ?? viewedUsername;
        } else {
          if (!currentUserId) {
            throw new Error("No encontramos la sesión del usuario para continuar.");
          }

          viewedUserId = currentUserId;

          viewedUsername =
            viewerUsername ??
            "usuario";
        }

        if (!viewedUserId) {
          throw new Error("No encontramos el perfil solicitado.");
        }

        setProfileName(viewedUsername || "usuario");

        const relationField =
          tab === "followers" ? "follower_id" : "following_id";
        const { data: followRows, error: followError } = await supabase
          .from("follows")
          .select(relationField)
          .eq(tab === "followers" ? "following_id" : "follower_id", viewedUserId);

        if (followError) throw followError;

        const ids = Array.from(
          new Set(
            (followRows ?? [])
              .map((row) => row[relationField as keyof typeof row] as string | null)
              .filter(Boolean) as string[],
          ),
        );

        if (!ids.length) {
          if (!cancelled) setRows([]);
          return;
        }

        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .in("id", ids);

        if (usersError) throw usersError;

        const mapped = await Promise.all(
          (users ?? []).map(async (item) => ({
            id: item.id,
            username: item.username ?? "usuario",
            avatar: await resolveAvatarUrl(item.avatar_url ?? null),
          })),
        );

        const order = new Map(ids.map((id, index) => [id, index]));
        mapped.sort(
          (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        );

        if (!cancelled) setRows(mapped);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las conexiones.",
          );
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, forcedUsername, tab, viewerUsername]);

  const title = tab === "followers" ? "Seguidores" : "Seguidos";
  const subtitle =
    tab === "followers"
      ? `Usuarios que siguen a @${profileName}`
      : `Perfiles que sigue @${profileName}`;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-8">
      <div className="rounded-[5px] border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-5">
          <h1 className="text-[28px] font-semibold text-zinc-900">{title}</h1>
          <p className="mt-1 text-[15px] text-[#464646]">{subtitle}</p>
        </div>

        {error ? (
          <div className="px-6 py-6 text-[15px] text-red-600">{error}</div>
        ) : loading ? (
          <div className="px-6 py-6 text-[15px] text-zinc-500">Cargando...</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-8 text-[15px] text-zinc-500">
            No hay usuarios para mostrar en esta lista todavía.
          </div>
        ) : (
          <div className="overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_140px] border-b border-zinc-200 bg-zinc-50 px-6 py-3 text-[14px] font-medium text-zinc-500">
              <span>Usuario</span>
              <span className="text-right">Acción</span>
            </div>
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_140px] items-center border-b border-zinc-200 px-6 py-4 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <UserAvatar
                    src={row.avatar}
                    alt={row.username}
                    sizeClassName="h-12 w-12"
                    iconClassName="h-5 w-5"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[17px] font-semibold text-zinc-900">
                      @{row.username}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Link
                    href={buildUserProfileHref(row.username)}
                    className="text-[15px] font-medium text-[#5A3EE7]"
                  >
                    Ver perfil
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
