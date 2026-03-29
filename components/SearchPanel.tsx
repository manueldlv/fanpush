"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { getSupabaseClient } from "@/lib/supabase";
import { Loader2, Search, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

type SearchResult = {
  id: string;
  name: string;
  fullName: string;
  detail: string;
  avatar: string | null;
};

type SearchPanelProps = {
  open: boolean;
  onClose: () => void;
};

const RECENT_SEARCHES_KEY = "fanpush_recent_searches";

function SearchResultSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-[12px] p-2">
      <div className="fanpush-skeleton h-12 w-12 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="fanpush-skeleton h-4 w-28 rounded-full" />
        <div className="mt-2 fanpush-skeleton h-3 w-40 rounded-full" />
      </div>
    </div>
  );
}

export default function SearchPanel({ open, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SearchResult[];
      setRecentSearches(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    const refreshRecentAvatars = async () => {
      if (!recentSearches.length) return;
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const ids = recentSearches.map((item) => item.id).filter(Boolean);
      if (!ids.length) return;

      const { data } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .in("id", ids);

      const resolveAvatar = async (value: string | null) => {
        if (!value) return null;
        if (value.startsWith("http")) return value;
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(value);
        return publicUrl.publicUrl;
      };

      const avatarEntries = await Promise.all(
        (data ?? []).map(async (row) => {
          const entry: [string, { username: string; avatar: string | null }] = [
            row.id,
            {
              username: row.username ?? "usuario",
              avatar: await resolveAvatar(row.avatar_url ?? null),
            },
          ];
          return entry;
        }),
      );

      const avatarMap = new Map<string, { username: string; avatar: string | null }>(
        avatarEntries,
      );

      const refreshed = recentSearches.map((item) => {
        const next = avatarMap.get(item.id);
        if (!next) return item;
        return {
          ...item,
          name: next.username || item.name,
          fullName: next.username || item.fullName,
          avatar: next.avatar,
        };
      });

      const changed = refreshed.some(
        (item, index) =>
          item.avatar !== recentSearches[index]?.avatar ||
          item.name !== recentSearches[index]?.name ||
          item.fullName !== recentSearches[index]?.fullName,
      );

      if (changed) {
        setRecentSearches(refreshed);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            RECENT_SEARCHES_KEY,
            JSON.stringify(refreshed),
          );
        }
      }
    };

    void refreshRecentAvatars();
  }, [recentSearches]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLoading(false);
    }
  }, [open]);

  const persistRecentSearches = (items: SearchResult[]) => {
    setRecentSearches(items);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items));
  };

  useEffect(() => {
    const load = async () => {
      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("id,username,avatar_url")
        .ilike("username", `%${query.trim()}%`)
        .limit(10);

      const resolveAvatar = async (value: string | null) => {
        if (!value) return null;
        if (value.startsWith("http")) return value;
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(value);
        return publicUrl.publicUrl;
      };

      const mapped = await Promise.all(
        (data ?? []).map(async (row) => ({
          id: row.id,
          name: row.username ?? "usuario",
          fullName: row.username ?? "",
          detail: "Sugerencia para ti",
          avatar: await resolveAvatar(row.avatar_url ?? null),
        })),
      );
      setResults(mapped);
      setLoading(false);
    };

    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const handleSelect = (item: SearchResult) => {
    const nextRecent = [
      item,
      ...recentSearches.filter((recent) => recent.id !== item.id),
    ].slice(0, 8);
    persistRecentSearches(nextRecent);
    router.push(buildUserProfileHref(item.name));
    onClose();
  };

  const removeRecentSearch = (id: string) => {
    persistRecentSearches(recentSearches.filter((item) => item.id !== id));
  };

  const clearRecentSearches = () => {
    persistRecentSearches([]);
  };

  return (
    <>
      {open ? (
        <button
          type="button"
          onClick={onClose}
        className="fixed inset-0 z-30 h-full w-full cursor-default bg-black/10"
          aria-label="Cerrar búsqueda"
        />
      ) : null}
      <aside
        className={`fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-[420px] border-r border-zinc-200 bg-white shadow-xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col px-6 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-zinc-900">Búsqueda</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[5px] p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Cerrar búsqueda"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 py-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar"
                className="flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
              />
              {query ? (
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded-[5px] bg-zinc-200 p-1 text-zinc-600"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex-1 overflow-y-auto">
            {!query.trim() ? (
              recentSearches.length > 0 ? (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-lg font-semibold text-zinc-900">
                      Recientes
                    </div>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-sm font-semibold text-blue-600"
                    >
                      Borrar todo
                    </button>
                  </div>
                  <div className="space-y-3">
                    {recentSearches.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 rounded-[5px] p-2 text-left transition hover:bg-zinc-100"
                        >
                          <UserAvatar
                            src={item.avatar}
                            alt={item.name}
                            sizeClassName="h-12 w-12"
                            iconClassName="h-5 w-5"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zinc-900">
                              {item.name}
                            </div>
                            <div className="truncate text-xs text-zinc-500">
                              {item.fullName}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecentSearch(item.id)}
                          className="rounded-[5px] p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                          aria-label={`Quitar ${item.name} de recientes`}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-zinc-500">
                  No hay búsquedas recientes.
                </div>
              )
            ) : (
              <div className="space-y-4">
                {loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <SearchResultSkeleton
                        key={`search-result-skeleton-${index}`}
                      />
                    ))
                  : null}
                {!loading && results.length === 0 ? (
                  <div className="rounded-[16px] border border-zinc-200 bg-zinc-50 px-4 py-5 text-center">
                    <div className="text-sm font-semibold text-zinc-900">
                      No encontramos resultados para "{query.trim()}"
                    </div>
                    <p className="mt-2 text-xs leading-6 text-zinc-500">
                      Prueba con otro nombre de usuario o revisa si está escrito correctamente.
                    </p>
                  </div>
                ) : null}
                {results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full cursor-pointer items-center gap-4 rounded-[5px] p-2 text-left transition hover:bg-zinc-100"
                  >
                    <UserAvatar
                      src={item.avatar}
                      alt={item.name}
                      sizeClassName="h-12 w-12"
                      iconClassName="h-5 w-5"
                    />
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {item.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {item.fullName} · {item.detail}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
