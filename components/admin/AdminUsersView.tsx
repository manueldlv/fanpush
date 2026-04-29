"use client";

import UserAvatar from "@/components/UserAvatar";
import { cn, formatARS } from "@/lib/utils";

type VisibleUser = {
  id: string;
  username: string;
  avatar: string | null;
  fullName: string;
  email: string;
  role: "author" | "user";
  followersCount: number;
  posts: Array<unknown>;
  creatorNet: number;
  commissionPercent: number;
};

export default function AdminUsersView({
  usersView,
  setUsersView,
  visibleUsers,
  onOpenUser,
}: {
  usersView: "all" | "authors" | "users";
  setUsersView: (view: "all" | "authors" | "users") => void;
  visibleUsers: VisibleUser[];
  onOpenUser: (user: VisibleUser) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["all", "Todos"],
              ["authors", "Autores"],
              ["users", "Usuarios normales"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setUsersView(id)}
              className={cn(
                "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                usersView === id
                  ? "bg-zinc-950 text-white"
                  : "border border-zinc-200 bg-zinc-100 text-zinc-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-zinc-950">Usuarios del sitio</div>
        <div className="mt-1 text-sm text-zinc-500">
          Revisa cada cuenta, su rendimiento, sus relaciones y ajusta la comisión
          individual cuando haga falta.
        </div>
        <div className="mt-4 max-h-[560px] overflow-auto rounded-[20px] border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-100 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Seguidores</th>
                <th className="px-4 py-3 font-medium">Posts</th>
                <th className="px-4 py-3 font-medium">Ventas</th>
                <th className="px-4 py-3 font-medium">Comisión creador</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    No hay usuarios para este filtro.
                  </td>
                </tr>
              ) : (
                visibleUsers.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar src={item.avatar} alt={item.username} />
                        <div>
                          <div className="font-medium text-zinc-900">@{item.username}</div>
                          <div className="text-xs text-zinc-500">
                            {item.fullName || item.email || "Sin datos"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {item.role === "author" ? "Autor" : "Usuario"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{item.followersCount}</td>
                    <td className="px-4 py-3 text-zinc-700">{item.posts.length}</td>
                    <td className="px-4 py-3 text-zinc-900">
                      {formatARS(item.role === "author" ? item.creatorNet : 0)}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{item.commissionPercent}%</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenUser(item)}
                        className="rounded-[12px] border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
