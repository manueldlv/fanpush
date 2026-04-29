"use client";

import { cn } from "@/lib/utils";

type AccessManagementData = {
  adminUsers: Array<{
    id: string;
    username: string;
    email: string;
    fullName: string;
    roles: string[];
    accessLevel: "super_admin" | "content_admin";
  }>;
  actionLogs: Array<{
    id: string;
    actionType: string;
    targetType: string;
    targetId: string | null;
    summary: string;
    actor: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
};

export default function AdminAccessView({
  adminCreateForm,
  setAdminCreateForm,
  accessMutationUserId,
  handleCreateAdminUser,
  accessLoading,
  accessData,
  handleUpdateAdminAccess,
  canOpenActionLogResource,
  handleOpenActionLogResource,
  formatCompactId,
}: {
  adminCreateForm: {
    email: string;
    password: string;
    username: string;
    fullName: string;
    accessLevel: "content_admin" | "super_admin";
  };
  setAdminCreateForm: (
    updater: (current: {
      email: string;
      password: string;
      username: string;
      fullName: string;
      accessLevel: "content_admin" | "super_admin";
    }) => {
      email: string;
      password: string;
      username: string;
      fullName: string;
      accessLevel: "content_admin" | "super_admin";
    },
  ) => void;
  accessMutationUserId: string | null;
  handleCreateAdminUser: () => void;
  accessLoading: boolean;
  accessData: AccessManagementData | null;
  handleUpdateAdminAccess: (
    userId: string,
    accessLevel: "content_admin" | "super_admin",
  ) => void;
  canOpenActionLogResource: boolean;
  handleOpenActionLogResource: (
    item: AccessManagementData["actionLogs"][number],
  ) => void;
  formatCompactId: (value?: string | null) => string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-zinc-950">Crear usuario admin</div>
        <div className="mt-1 text-sm text-zinc-500">
          Puedes crear un `super admin` o un admin de moderación con acceso
          solo a contenido y reportes, sin datos financieros.
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={adminCreateForm.email}
            onChange={(event) =>
              setAdminCreateForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            className="rounded-[14px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
          />
          <input
            type="text"
            placeholder="Nombre completo"
            value={adminCreateForm.fullName}
            onChange={(event) =>
              setAdminCreateForm((current) => ({
                ...current,
                fullName: event.target.value,
              }))
            }
            className="rounded-[14px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
          />
          <input
            type="text"
            placeholder="Username"
            value={adminCreateForm.username}
            onChange={(event) =>
              setAdminCreateForm((current) => ({
                ...current,
                username: event.target.value,
              }))
            }
            className="rounded-[14px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={adminCreateForm.password}
            onChange={(event) =>
              setAdminCreateForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            className="rounded-[14px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              setAdminCreateForm((current) => ({
                ...current,
                accessLevel: "content_admin",
              }))
            }
            className={cn(
              "rounded-[14px] px-4 py-3 text-sm font-semibold transition",
              adminCreateForm.accessLevel === "content_admin"
                ? "border border-zinc-200 bg-zinc-200 text-zinc-900"
                : "border border-zinc-200 bg-zinc-100 text-zinc-700",
            )}
          >
            Solo moderación
          </button>
          <button
            type="button"
            onClick={() =>
              setAdminCreateForm((current) => ({
                ...current,
                accessLevel: "super_admin",
              }))
            }
            className={cn(
              "rounded-[14px] px-4 py-3 text-sm font-semibold transition",
              adminCreateForm.accessLevel === "super_admin"
                ? "border border-zinc-200 bg-zinc-200 text-zinc-900"
                : "border border-zinc-200 bg-zinc-100 text-zinc-700",
            )}
          >
            Super admin
          </button>
          <button
            type="button"
            onClick={handleCreateAdminUser}
            disabled={accessMutationUserId === "create"}
            className="fanpush-button-primary rounded-[14px] px-5 py-3 text-sm disabled:opacity-60"
          >
            {accessMutationUserId === "create" ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-zinc-950">Usuarios con acceso admin</div>
        <div className="mt-4 overflow-auto rounded-[20px] border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-100 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Acceso</th>
                <th className="px-4 py-3 font-medium">Roles</th>
                <th className="px-4 py-3 font-medium">Cambiar acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {accessLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    Cargando accesos...
                  </td>
                </tr>
              ) : (accessData?.adminUsers.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No hay usuarios admin cargados.
                  </td>
                </tr>
              ) : (
                accessData?.adminUsers.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      @{item.username}
                      <div className="text-xs font-normal text-zinc-500">
                        {item.fullName || "Sin nombre"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{item.email}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      {item.accessLevel === "super_admin" ? "Super admin" : "Solo moderación"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{item.roles.join(", ")}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateAdminAccess(item.id, "content_admin")}
                          disabled={accessMutationUserId === item.id}
                          className={cn(
                            "rounded-[12px] border px-3 py-2 text-xs font-semibold disabled:opacity-60",
                            item.accessLevel === "content_admin"
                              ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white"
                              : "border-zinc-200 bg-zinc-100 text-zinc-700",
                          )}
                        >
                          Solo moderación
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateAdminAccess(item.id, "super_admin")}
                          disabled={accessMutationUserId === item.id}
                          className={cn(
                            "rounded-[12px] border px-3 py-2 text-xs font-semibold disabled:opacity-60",
                            item.accessLevel === "super_admin"
                              ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white"
                              : "border-zinc-200 bg-zinc-100 text-zinc-700",
                          )}
                        >
                          Super admin
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-zinc-950">Historial de acciones admin</div>
        <div className="mt-4 max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-100 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Acción</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Recurso</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {accessLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    Cargando historial...
                  </td>
                </tr>
              ) : (accessData?.actionLogs.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    Todavía no hay acciones registradas.
                  </td>
                </tr>
              ) : (
                accessData?.actionLogs.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-zinc-900">{item.summary}</td>
                    <td className="px-4 py-3 text-zinc-700">@{item.actor}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {canOpenActionLogResource ? (
                        <button
                          type="button"
                          onClick={() => handleOpenActionLogResource(item)}
                          className="text-left font-medium text-[var(--brand-accent)] hover:underline"
                        >
                          {item.targetType}
                          {item.targetId ? ` · ${formatCompactId(item.targetId)}` : ""}
                        </button>
                      ) : (
                        <>
                          {item.targetType}
                          {item.targetId ? ` · ${formatCompactId(item.targetId)}` : ""}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(item.createdAt).toLocaleString("es-AR")}
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
