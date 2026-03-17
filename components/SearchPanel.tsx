"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { Loader2, Search, X } from "lucide-react";

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

export default function SearchPanel({ open, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();

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
    const params = new URLSearchParams({
      user: item.name,
      full: item.fullName,
      avatar: item.avatar,
    });
    router.push(`/perfil?${params.toString()}`);
    onClose();
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
              <div className="text-sm text-zinc-500">
                No hay búsquedas recientes.
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full cursor-pointer items-center gap-4 rounded-[5px] p-2 text-left transition hover:bg-zinc-100"
                  >
                    {item.avatar ? (
                      <img
                        src={item.avatar}
                        alt={item.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-zinc-100" />
                    )}
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
