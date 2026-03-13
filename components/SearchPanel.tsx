"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

const results = [
  {
    id: 1,
    name: "willyska",
    fullName: "Juan Matias Vega",
    detail: "mevaf4 y 3 mas siguen esta cuenta",
    avatar: "https://picsum.photos/seed/willyska/96/96",
  },
  {
    id: 2,
    name: "elcapowilly",
    fullName: "El Capo Willy (N. Fernandez)",
    detail: "1,1 mill. seguidores",
    avatar: "https://picsum.photos/seed/elcapowilly/96/96",
  },
  {
    id: 3,
    name: "willybronca_",
    fullName: "Willy Bronca",
    detail: "133 mil seguidores",
    avatar: "https://picsum.photos/seed/willybronca/96/96",
  },
  {
    id: 4,
    name: "willy_luna_tattoo",
    fullName: "Willy Luna Tattoo",
    detail: "ludmila42_ sigue a este usuario",
    avatar: "https://picsum.photos/seed/willyluna/96/96",
  },
  {
    id: 5,
    name: "willyrockk",
    fullName: "Willy Rock",
    detail: "leleyelli_ y 6 mas siguen esta cuenta",
    avatar: "https://picsum.photos/seed/willyrockk/96/96",
  },
];

type SearchPanelProps = {
  open: boolean;
  onClose: () => void;
};

export default function SearchPanel({ open, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(handle);
  }, [query]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return results.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        item.fullName.toLowerCase().includes(lower),
    );
  }, [query]);

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
        className={`fixed left-0 top-0 z-50 h-screen w-[420px] border-r border-zinc-200 bg-white shadow-xl transition-transform duration-300 ease-out ${
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
                {filtered.map((item) => (
                  <div key={item.id} className="flex items-center gap-4">
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {item.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {item.fullName} · {item.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
