"use client";

import {
  Check,
  CircleDollarSign,
  Eye,
  Landmark,
  Layers3,
  LayoutList,
  LineChart,
  Package,
  PieChart,
  ReceiptText,
  Search,
  Wallet,
  X,
} from "lucide-react";
import {
  FINANCE_COLUMN_LABELS,
  FINANCE_COLUMN_ORDER,
  type FinanceColumnKey,
  type FinanceTableRow,
  type FinanceView,
} from "@/lib/admin/finance";
import { cn, formatARS } from "@/lib/utils";

export default function AdminFinanceView({
  financeHeroStats,
  financeView,
  setFinanceView,
  financeSearch,
  setFinanceSearch,
  financeGroupBy,
  setFinanceGroupBy,
  financePeriodFilter,
  setFinancePeriodFilter,
  financeStatusFilter,
  setFinanceStatusFilter,
  financeFiltersOpen,
  setFinanceFiltersOpen,
  financeColumnsOpen,
  setFinanceColumnsOpen,
  visibleFinanceColumns,
  toggleFinanceColumn,
  financeAllSelected,
  toggleFinanceSelectAll,
  financeTableRows,
  financeSelectedIds,
  toggleFinanceRowSelection,
  setSelectedFinanceRow,
  exportFinanceRows,
  selectedFinanceRow,
}: {
  financeHeroStats: Array<{ label: string; value: string; tone?: "emerald" | "blue" }>;
  financeView: FinanceView;
  setFinanceView: (view: FinanceView) => void;
  financeSearch: string;
  setFinanceSearch: (value: string) => void;
  financeGroupBy: "flow" | "author" | "status";
  setFinanceGroupBy: (value: "flow" | "author" | "status") => void;
  financePeriodFilter: "all" | "7d" | "30d";
  setFinancePeriodFilter: (value: "all" | "7d" | "30d") => void;
  financeStatusFilter: "all" | "approved" | "settled" | "requested" | "sent" | "rejected";
  setFinanceStatusFilter: (
    value: "all" | "approved" | "settled" | "requested" | "sent" | "rejected",
  ) => void;
  financeFiltersOpen: boolean;
  setFinanceFiltersOpen: (next: boolean) => void;
  financeColumnsOpen: boolean;
  setFinanceColumnsOpen: (next: boolean) => void;
  visibleFinanceColumns: FinanceColumnKey[];
  toggleFinanceColumn: (column: FinanceColumnKey) => void;
  financeAllSelected: boolean;
  toggleFinanceSelectAll: () => void;
  financeTableRows: FinanceTableRow[];
  financeSelectedIds: string[];
  toggleFinanceRowSelection: (rowId: string) => void;
  setSelectedFinanceRow: (row: FinanceTableRow | null) => void;
  exportFinanceRows: () => void;
  selectedFinanceRow: FinanceTableRow | null;
}) {
  return (
    <>
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white px-6 py-6 shadow-sm md:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-[760px]">
              <div className="flex items-center gap-3 text-zinc-500">
                <Layers3 className="h-4 w-4" />
                <div className="text-sm font-medium">Resumen operativo</div>
              </div>
              <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-zinc-950 md:text-[2.55rem]">
                Finanzas
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[900px]">
              {financeHeroStats.map((item) => (
                <div
                  key={item.label}
                  className="min-w-0 rounded-[18px] border border-zinc-200 bg-white px-5 py-4"
                >
                  <div className="text-sm font-medium text-zinc-500">
                    {item.label}
                  </div>
                  <div
                    className={cn(
                      "mt-2.5 break-words text-[1.85rem] font-semibold tracking-tight text-zinc-950",
                      item.tone === "emerald" && "text-emerald-700",
                      item.tone === "blue" && "text-sky-700",
                    )}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-zinc-200 bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["overview", "Finanzas", LayoutList],
                ["sales", "Ventas", ReceiptText],
                ["tips", "Propinas", CircleDollarSign],
                ["withdrawals", "Retiros", Landmark],
                ["creators", "Creadores", Wallet],
                ["classification", "Clasificación", Package],
                ["analysis", "Análisis", LineChart],
                ["pnl", "P&L", PieChart],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFinanceView(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[14px] border px-4 py-3 text-sm font-semibold transition",
                  financeView === id
                    ? "border-zinc-200 bg-zinc-950 text-white"
                    : "border-transparent bg-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_repeat(3,minmax(0,0.95fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={financeSearch}
                onChange={(event) => setFinanceSearch(event.target.value)}
                placeholder="Buscar por descripción, usuario, payout o concepto..."
                className="h-[46px] w-full rounded-[14px] border border-zinc-200 bg-white pl-11 pr-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
            <select
              value={financeGroupBy}
              onChange={(event) =>
                setFinanceGroupBy(event.target.value as "flow" | "author" | "status")
              }
              className="h-[46px] rounded-[14px] border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 outline-none"
            >
              <option value="flow">Vista por flujo</option>
              <option value="author">Vista por autor</option>
              <option value="status">Vista por estado</option>
            </select>
            <select
              value={financePeriodFilter}
              onChange={(event) => setFinancePeriodFilter(event.target.value as "all" | "7d" | "30d")}
              className="h-[46px] rounded-[14px] border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 outline-none"
            >
              <option value="all">Todos los períodos</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
            </select>
            <select
              value={financeStatusFilter}
              onChange={(event) =>
                setFinanceStatusFilter(
                  event.target.value as
                    | "all"
                    | "approved"
                    | "settled"
                    | "requested"
                    | "sent"
                    | "rejected",
                )
              }
              className="h-[46px] rounded-[14px] border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="approved">Aprobado</option>
              <option value="settled">Liquidada</option>
              <option value="requested">Solicitado</option>
              <option value="sent">Enviado</option>
              <option value="rejected">Rechazado</option>
            </select>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-zinc-950">Tabla financiera</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Base única para iterar filtros, clasificación y análisis.
              </p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setFinanceFiltersOpen(!financeFiltersOpen)}
                className="rounded-[14px] border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Filtros
              </button>
              <button
                type="button"
                onClick={() => setFinanceColumnsOpen(!financeColumnsOpen)}
                className="rounded-[14px] border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Columnas
              </button>
              <button
                type="button"
                onClick={exportFinanceRows}
                className="rounded-[14px] border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Exportar
              </button>
              {financeColumnsOpen ? (
                <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[208px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[18px] border border-zinc-200 bg-white text-zinc-900 shadow-xl">
                  <div className="border-b border-zinc-200 px-4 py-2.5 text-[0.95rem] font-semibold">
                    Mostrar columnas
                  </div>
                  <div className="max-h-[70vh] overflow-auto px-2.5 py-2.5">
                    <div className="space-y-0.5">
                      {FINANCE_COLUMN_ORDER.filter((column) => column !== "actions").map(
                        (column) => (
                          <button
                            key={column}
                            type="button"
                            onClick={() => toggleFinanceColumn(column)}
                            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left text-zinc-700 transition hover:bg-zinc-50"
                          >
                            <span className="flex h-5 w-5 items-center justify-center text-zinc-900">
                              {visibleFinanceColumns.includes(column) ? (
                                <Check className="h-4 w-4" />
                              ) : null}
                            </span>
                            <span className="text-[0.92rem] leading-6">
                              {FINANCE_COLUMN_LABELS[column]}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {financeFiltersOpen ? (
            <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Los filtros activos se aplican arriba sobre búsqueda, período, estado y tipo de vista.
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-[0.95rem] text-zinc-600">
                  <tr>
                    <th className="w-12 px-4 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={toggleFinanceSelectAll}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md border transition",
                          financeAllSelected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-emerald-400 bg-white text-transparent",
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </th>
                    {FINANCE_COLUMN_ORDER.filter((column) =>
                      visibleFinanceColumns.includes(column),
                    ).map((column) => (
                      <th
                        key={column}
                        className={cn("px-4 py-3 font-semibold", column === "actions" && "w-16")}
                      >
                        {FINANCE_COLUMN_LABELS[column]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {financeTableRows.map((row) => {
                    const selected = financeSelectedIds.includes(row.id);
                    return (
                      <tr key={row.id} className="align-top">
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleFinanceRowSelection(row.id)}
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-md border transition",
                              selected
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-emerald-400 bg-white text-transparent",
                            )}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </td>
                        {visibleFinanceColumns.includes("date") ? (
                          <td className="px-4 py-2.5 text-zinc-700">
                            {new Date(row.createdAt).toLocaleDateString("es-AR")}
                          </td>
                        ) : null}
                        {visibleFinanceColumns.includes("description") ? (
                          <td className="max-w-[380px] px-4 py-2.5 font-medium text-zinc-700">
                            {row.description}
                          </td>
                        ) : null}
                        {visibleFinanceColumns.includes("provider") ? (
                          <td className="px-4 py-2.5 text-zinc-700">{row.provider}</td>
                        ) : null}
                        {visibleFinanceColumns.includes("amount") ? (
                          <td className="px-4 py-2.5 font-semibold text-red-500">
                            -{formatARS(Math.abs(row.amount))}
                          </td>
                        ) : null}
                        {visibleFinanceColumns.includes("origin") ? (
                          <td className="px-4 py-2.5 text-zinc-700">{row.origin}</td>
                        ) : null}
                        {visibleFinanceColumns.includes("category") ? (
                          <td className="px-4 py-2.5 text-zinc-700">{row.category}</td>
                        ) : null}
                        {visibleFinanceColumns.includes("project") ? (
                          <td className="px-4 py-2.5 text-zinc-700">{row.project}</td>
                        ) : null}
                        {visibleFinanceColumns.includes("costCenter") ? (
                          <td className="px-4 py-2.5 text-zinc-700">{row.costCenter}</td>
                        ) : null}
                        {visibleFinanceColumns.includes("percentage") ? (
                          <td className="px-4 py-2.5 text-zinc-700">{row.percentage}</td>
                        ) : null}
                        {visibleFinanceColumns.includes("period") ? (
                          <td className="px-4 py-2.5 text-zinc-700">{row.period}</td>
                        ) : null}
                        {visibleFinanceColumns.includes("account") ? (
                          <td className="px-4 py-2.5 font-medium text-zinc-700 underline decoration-zinc-400 underline-offset-2">
                            {row.account}
                          </td>
                        ) : null}
                        {visibleFinanceColumns.includes("actions") ? (
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setSelectedFinanceRow(row)}
                              className="rounded-[12px] border border-zinc-200 bg-white p-2 text-zinc-600 hover:bg-zinc-50"
                              aria-label="Abrir detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                  {financeTableRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={FINANCE_COLUMN_ORDER.filter((column) =>
                          visibleFinanceColumns.includes(column),
                        ).length + 1}
                        className="px-4 py-10 text-center text-sm text-zinc-500"
                      >
                        No hay movimientos para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {selectedFinanceRow ? (
        <div className="fixed inset-0 z-[136] flex items-center justify-center bg-black/60 p-4">
          <button
            type="button"
            aria-label="Cerrar detalle financiero"
            onClick={() => setSelectedFinanceRow(null)}
            className="absolute inset-0"
          />
          <div className="relative z-10 w-full max-w-[640px] rounded-[26px] border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-zinc-500">
                  Movimiento financiero
                </div>
                <h3 className="mt-2 text-2xl font-semibold text-zinc-950">
                  {selectedFinanceRow.description}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFinanceRow(null)}
                className="rounded-[12px] border border-zinc-200 p-2 text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-zinc-500">
                  Usuario
                </div>
                <div className="mt-1 text-base text-zinc-900">{selectedFinanceRow.user}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500">
                  Contraparte
                </div>
                <div className="mt-1 text-base text-zinc-900">
                  {selectedFinanceRow.counterparty}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500">
                  Monto
                </div>
                <div className="mt-1 text-base font-semibold text-red-500">
                  -{formatARS(Math.abs(selectedFinanceRow.amount))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500">
                  Estado
                </div>
                <div className="mt-1 text-base text-zinc-900">{selectedFinanceRow.status}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500">
                  Cuenta
                </div>
                <div className="mt-1 text-base text-zinc-900">{selectedFinanceRow.account}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500">
                  Periodo
                </div>
                <div className="mt-1 text-base text-zinc-900">{selectedFinanceRow.period}</div>
              </div>
            </div>
            <div className="mt-6">
              <div className="text-xs font-medium text-zinc-500">
                Detalle extendido
              </div>
              <div className="mt-2 rounded-[18px] bg-zinc-50 p-4 text-sm leading-7 text-zinc-700">
                {selectedFinanceRow.detail}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
