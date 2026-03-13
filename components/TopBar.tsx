"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Search } from "lucide-react";

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

const notifications = [
  {
    id: "month",
    section: "Este mes",
    items: [
      {
        id: "social-like",
        avatar: "https://picsum.photos/seed/notif-like/64/64",
        text: "maria.soria le gusto tu publicacion.",
        date: "03 mar",
      },
    ],
  },
  {
    id: "followers",
    section: "Seguidores",
    items: [
      {
        id: "follow",
        avatar: "https://picsum.photos/seed/notif-follow/64/64",
        text: "alejandro.v comenzó a seguirte.",
        date: "02 mar",
        action: "Seguir tambien",
      },
      {
        id: "follow-multi",
        avatar: "https://picsum.photos/seed/notif-follow-2/64/64",
        text: "luli y otros 3 comenzaron a seguirte.",
        date: "01 mar",
        action: "Seguir tambien",
      },
      {
        id: "follow-mentions",
        avatar: "https://picsum.photos/seed/notif-follow-3/64/64",
        text: "fede.cl activó notificaciones de tu perfil.",
        date: "28 feb",
      },
    ],
  },
  {
    id: "sales",
    section: "Ventas",
    items: [
      {
        id: "sale-1",
        avatar: "https://picsum.photos/seed/notif-sale-1/64/64",
        text: "roma.ux compró tu foto.",
        date: "27 feb",
        action: "Ver venta",
      },
      {
        id: "sale-2",
        avatar: "https://picsum.photos/seed/notif-sale-2/64/64",
        text: "noah.d compró tu video.",
        date: "26 feb",
        action: "Ver venta",
      },
      {
        id: "sale-3",
        avatar: "https://picsum.photos/seed/notif-sale-3/64/64",
        text: "lucas_m compró tu pack de contenido.",
        date: "25 feb",
        action: "Ver venta",
      },
    ],
  },
  {
    id: "subs",
    section: "Suscripciones",
    items: [
      {
        id: "sub-1",
        avatar: "https://picsum.photos/seed/notif-sub-1/64/64",
        text: "jaz.min se suscribió a tu perfil.",
        date: "23 feb",
        action: "Ver suscripcion",
      },
    ],
  },
];

export default function TopBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return results.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        item.fullName.toLowerCase().includes(lower),
    );
  }, [query]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchOpen && searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
      if (
        notificationsOpen &&
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [searchOpen, notificationsOpen, profileOpen]);

  const handleSelect = (item: (typeof results)[number]) => {
    const params = new URLSearchParams({
      user: item.name,
      full: item.fullName,
      avatar: item.avatar,
    });
    router.push(`/perfil?${params.toString()}`);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <header className="fixed left-0 top-0 z-50 h-16 w-full border-b border-zinc-200 bg-white">
      <div className="h-full">
        <div className="flex h-full w-full items-center justify-between px-6">
          <div className="flex items-center gap-10">
            <Link href="/" className="text-xl font-semibold text-zinc-900">
              FanPush
            </Link>
            <nav className="flex items-center gap-6 text-sm font-semibold text-zinc-500">
              <Link href="/" className="text-zinc-900">
                Feed
              </Link>
              <Link href="/explorar" className="hover:text-zinc-900">
                Descubrir
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={searchRef}>
              <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2">
                <Search className="h-4 w-4 text-zinc-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Buscar"
                  className="w-[240px] bg-transparent text-sm text-zinc-800 outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              {searchOpen ? (
                <div className="absolute right-0 top-12 z-50 w-[360px] rounded-[10px] border border-zinc-200 bg-white p-4 shadow-xl">
                  {!query.trim() ? (
                    <div className="text-sm text-zinc-500">
                      No hay búsquedas recientes.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filtered.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelect(item)}
                          className="flex w-full items-center gap-3 rounded-[5px] p-2 text-left transition hover:bg-zinc-100"
                        >
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
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100"
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4" />
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 top-12 z-50 w-[360px] rounded-[12px] border border-zinc-200 bg-white p-4 shadow-xl">
                  <div className="max-h-[520px] space-y-6 overflow-y-auto pr-2">
                    {notifications.map((section) => (
                      <div key={section.id}>
                        <h3 className="text-sm font-semibold text-zinc-900">
                          {section.section}
                        </h3>
                        <div className="mt-3 space-y-3">
                          {section.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 rounded-[10px] bg-zinc-50 px-3 py-3"
                            >
                              <img
                                src={item.avatar}
                                alt="avatar"
                                className="h-10 w-10 rounded-full object-cover"
                              />
                              <div className="flex-1 text-sm text-zinc-700">
                                <div className="font-medium text-zinc-900">
                                  {item.text}
                                </div>
                                <div className="text-xs text-zinc-400">
                                  {item.date}
                                </div>
                              </div>
                              {item.action ? (
                                <button className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                                  {item.action}
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/ventas"
                className="cursor-pointer text-sm font-semibold text-zinc-900"
              >
                $12.480
              </Link>
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="rounded-full"
                  aria-label="Abrir menu de perfil"
                >
                  <img
                    src="https://picsum.photos/seed/bebudlv/64/64"
                    alt="Perfil"
                    className="h-9 w-9 rounded-full object-cover"
                  />
                </button>
                {profileOpen ? (
                  <div className="absolute right-0 top-12 z-50 w-48 rounded-[10px] border border-zinc-200 bg-white p-2 shadow-xl">
                    <Link
                      href="/perfil"
                      className="block rounded-[6px] px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setProfileOpen(false)}
                    >
                      Ver perfil
                    </Link>
                    <Link
                      href="/settings"
                      className="block rounded-[6px] px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setProfileOpen(false)}
                    >
                      Settings
                    </Link>
                    <Link
                      href="/auth"
                      className="block rounded-[6px] px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setProfileOpen(false)}
                    >
                      Cerrar sesion
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
