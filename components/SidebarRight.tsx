const suggestions = [
  {
    name: "S O F I",
    handle: "@sofi",
    note: "Sugerencia para ti",
    avatar: "https://picsum.photos/seed/sofi-sug/56/56",
  },
  {
    name: "Lore",
    handle: "@lore",
    note: "Sugerencia para ti",
    avatar: "https://picsum.photos/seed/lore-sug/56/56",
  },
  {
    name: "Instagram",
    handle: "@instagram",
    note: "agustina_cortassa y 47 mas",
    avatar: "https://picsum.photos/seed/instagram-sug/56/56",
    verified: true,
  },
  {
    name: "Sofi Rodriguez ✨",
    handle: "@sofi.rodriguez",
    note: "juanmatorresiy y 2 mas",
    avatar: "https://picsum.photos/seed/sofi2-sug/56/56",
  },
  {
    name: "mile",
    handle: "@mile",
    note: "Sugerencia para ti",
    avatar: "https://picsum.photos/seed/mile-sug/56/56",
  },
];

export default function SidebarRight() {
  return (
    <aside className="hidden w-[320px] shrink-0 lg:block">
      <div className="sticky top-8 space-y-6">
        <div className="rounded-[5px] border border-zinc-200 bg-white px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="https://picsum.photos/seed/bebudlv/64/64"
                alt="bebudlv"
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  bebudlv
                </div>
                <div className="text-sm text-zinc-500">Manu</div>
              </div>
            </div>
            <button className="text-sm font-semibold text-blue-600">
              Ver perfil
            </button>
          </div>
        </div>

        <div className="rounded-[5px] border border-zinc-200 bg-white px-6 py-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">
              Sugerencias para ti
            </h3>
            <button className="text-xs font-semibold text-zinc-600">
              Ver todo
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {suggestions.map((profile) => (
              <div
                key={profile.handle}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <span>{profile.name}</span>
                      {profile.verified ? (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] bg-sky-500 text-[10px] font-bold text-white">
                          ✓
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-500">{profile.note}</div>
                  </div>
                </div>
                <button className="text-sm font-semibold text-blue-600">
                  Seguir
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
