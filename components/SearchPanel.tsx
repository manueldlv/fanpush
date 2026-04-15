"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useGetUsersByIdsQuery,
  useSearchUsersQuery,
} from "@/lib/redux/api/searchApi";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  addRecentSearch,
  clearRecentSearches,
  clearSearchQuery,
  removeRecentSearch,
  setRecentSearches,
  setSearchQuery,
  type SearchResultItem,
} from "@/lib/redux/slices/searchSlice";
import { closeSearchPanel } from "@/lib/redux/slices/uiSlice";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { Clock3, Loader2, Search, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

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

export default function SearchPanel() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.ui.searchPanelOpen);
  const query = useAppSelector((state) => state.search.query);
  const recentSearches = useAppSelector((state) => state.search.recentSearches);
  const router = useRouter();
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { data: results = [], isFetching: loading } = useSearchUsersQuery(
    debouncedQuery,
    {
      skip: !debouncedQuery,
    },
  );
  const recentSearchIds = recentSearches.map((item) => item.id).filter(Boolean);
  const { data: refreshedRecentUsers = [] } = useGetUsersByIdsQuery(recentSearchIds, {
    skip: recentSearchIds.length === 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SearchResultItem[];
      dispatch(setRecentSearches(Array.isArray(parsed) ? parsed : []));
    } catch {
      dispatch(setRecentSearches([]));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!recentSearches.length || !refreshedRecentUsers.length) return;

    const avatarMap = new Map(
      refreshedRecentUsers.map((item) => [
        item.id,
        {
          username: item.name,
          avatar: item.avatar,
        },
      ]),
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
      dispatch(setRecentSearches(refreshed));
    }
  }, [dispatch, recentSearches, refreshedRecentUsers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(recentSearches),
    );
  }, [recentSearches]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch(closeSearchPanel());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch, open]);

  useEffect(() => {
    if (!open) {
      dispatch(clearSearchQuery());
    }
  }, [dispatch, open]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const handleSelect = (item: SearchResultItem) => {
    dispatch(addRecentSearch(item));
    router.push(buildUserProfileHref(item.name));
    dispatch(closeSearchPanel());
    dispatch(clearSearchQuery());
  };

  const handleRemoveRecentSearch = (id: string) => {
    dispatch(removeRecentSearch(id));
  };

  const handleClearRecentSearches = () => {
    dispatch(clearRecentSearches());
  };

  return (
    <>
      {open ? (
        <button
          type="button"
          onClick={() => dispatch(closeSearchPanel())}
          className="fixed inset-0 z-[110] h-full w-full cursor-default bg-black/10"
          aria-label="Cerrar búsqueda"
        />
      ) : null}
      <aside
        className={`fixed left-0 top-16 z-[120] h-[calc(100vh-4rem)] w-[420px] border-r border-zinc-200 bg-white shadow-xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col px-6 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-zinc-900">Búsqueda</h2>
            <button
              type="button"
              onClick={() => dispatch(closeSearchPanel())}
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
                onChange={(event) => dispatch(setSearchQuery(event.target.value))}
                placeholder="Buscar"
                className="flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
              />
              {query ? (
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                ) : (
                  <button
                    type="button"
                    onClick={() => dispatch(clearSearchQuery())}
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
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
                        <Clock3 className="h-4 w-4 text-zinc-400" />
                        Búsquedas recientes
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        Vuelve rápido a los perfiles que buscaste hace poco.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearRecentSearches}
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
                          onClick={() => handleRemoveRecentSearch(item.id)}
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
                <div className="rounded-[16px] border border-zinc-200 bg-zinc-50 px-4 py-5">
                  <div className="text-sm font-semibold text-zinc-900">
                    No hay búsquedas recientes
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Cuando abras un perfil desde esta búsqueda, va a quedar guardado acá para volver más rápido.
                  </p>
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
