"use client";

import { cn, formatARS } from "@/lib/utils";

type CommerceView =
  | "purchases"
  | "tips"
  | "withdrawals"
  | "withdrawal-history";

type CommerceData = {
  recentPurchases: Array<{
    id: string;
    amount: number;
    createdAt: string;
    buyer: string;
    seller: string;
  }>;
  recentTips: Array<{
    id: string;
    amount: number;
    actor: string;
    receiver: string;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: string;
    username: string;
    amount: number;
    statusLabel: string;
    createdAt: string;
    payoutAlias: string | null;
    payoutHolder: string | null;
    payoutDocument: string | null;
  }>;
  withdrawalHistory: Array<{
    id: string;
    statusLabel: string;
    amount: number;
    actedAt: string;
    actor: string;
    reason: string;
  }>;
};

export default function AdminCommerceView({
  commerceView,
  setCommerceView,
  commerce,
  handleExportWithdrawals,
  updatingWithdrawalId,
  handleUpdateWithdrawal,
  openRejectWithdrawal,
}: {
  commerceView: CommerceView;
  setCommerceView: (view: CommerceView) => void;
  commerce: CommerceData;
  handleExportWithdrawals: () => void;
  updatingWithdrawalId: string | null;
  handleUpdateWithdrawal: (id: string, status: "sent") => void;
  openRejectWithdrawal: (payload: { id: string; username: string }) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["purchases", "Compras"],
              ["tips", "Propinas"],
              ["withdrawals", "Retiros"],
              ["withdrawal-history", "Historial de retiros"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCommerceView(id)}
              className={cn(
                "rounded-[16px] px-4 py-3 text-sm font-semibold transition",
                commerceView === id
                  ? "bg-zinc-950 text-white"
                  : "border border-zinc-200 bg-zinc-100 text-zinc-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {commerceView === "purchases" ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-zinc-950">Compras</div>
          <div className="mt-4 max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Comprador</th>
                  <th className="px-4 py-3 font-medium">Vendedor</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {commerce.recentPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                      Todavía no hay compras.
                    </td>
                  </tr>
                ) : (
                  commerce.recentPurchases.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900">@{item.buyer}</td>
                      <td className="px-4 py-3 text-zinc-700">@{item.seller}</td>
                      <td className="px-4 py-3 text-zinc-900">{formatARS(item.amount)}</td>
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
      ) : null}

      {commerceView === "tips" ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-zinc-950">Propinas</div>
          <div className="mt-4 max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario que envía</th>
                  <th className="px-4 py-3 font-medium">Usuario que recibe</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {commerce.recentTips.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                      Todavía no hay propinas.
                    </td>
                  </tr>
                ) : (
                  commerce.recentTips.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900">@{item.actor}</td>
                      <td className="px-4 py-3 text-zinc-700">@{item.receiver}</td>
                      <td className="px-4 py-3 text-zinc-900">{formatARS(item.amount)}</td>
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
      ) : null}

      {commerceView === "withdrawals" ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-zinc-950">Retiros</div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleExportWithdrawals}
              className="rounded-[12px] border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700"
            >
              Exportar CSV
            </button>
          </div>
          <div className="mt-4 max-h-[420px] overflow-auto rounded-[20px] border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Alias / CVU / CBU</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {commerce.withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                      No hay retiros solicitados.
                    </td>
                  </tr>
                ) : (
                  commerce.withdrawals.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900">@{item.username}</td>
                      <td className="px-4 py-3 text-zinc-900">{formatARS(item.amount)}</td>
                      <td className="px-4 py-3 text-zinc-700">{item.statusLabel}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(item.createdAt).toLocaleString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        <div>{item.payoutAlias ?? "Sin datos"}</div>
                        {item.payoutHolder ? (
                          <div className="text-xs text-zinc-500">
                            {item.payoutHolder} · {item.payoutDocument ?? "Sin doc"}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateWithdrawal(item.id, "sent")}
                            disabled={updatingWithdrawalId === item.id}
                            className="rounded-[12px] bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-60"
                          >
                            Enviado
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openRejectWithdrawal({
                                id: item.id,
                                username: item.username,
                              })
                            }
                            disabled={updatingWithdrawalId === item.id}
                            className="rounded-[12px] bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                          >
                            Rechazar
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
      ) : null}

      {commerceView === "withdrawal-history" ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-zinc-950">Historial de retiros</div>
          <div className="mt-4 max-h-[320px] overflow-auto rounded-[20px] border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Acción</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium">Admin</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {commerce.withdrawalHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                      No hay movimientos todavía.
                    </td>
                  </tr>
                ) : (
                  commerce.withdrawalHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{item.statusLabel}</td>
                      <td className="px-4 py-3 text-zinc-700">{formatARS(item.amount)}</td>
                      <td className="px-4 py-3 text-zinc-700">{item.reason || "Sin motivo"}</td>
                      <td className="px-4 py-3 text-zinc-700">@{item.actor}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(item.actedAt).toLocaleString("es-AR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
