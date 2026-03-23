"use client";

import { useEffect, useState } from "react";
import SidebarLeft from "@/components/SidebarLeft";
import SearchPanel from "@/components/SearchPanel";
import NotificationsPanel from "@/components/NotificationsPanel";
import { getSupabaseClient } from "@/lib/supabase";
import { getAuthorApplicationForUser } from "@/lib/authorApplications";

export default function AutorSolicitudPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "pending" | "approved" | "rejected">(
    "idle",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [documentType, setDocumentType] = useState("DNI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [country, setCountry] = useState("Argentina");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const maxBirthDate = new Date(
    new Date().getFullYear() - 18,
    new Date().getMonth(),
    new Date().getDate(),
  )
    .toISOString()
    .split("T")[0];

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      const application = await getAuthorApplicationForUser(supabase, userId);
      const current = application?.record;
      if (current) {
        setStatus(current.status);
        setFullName(current.fullName);
        setBirthDate(current.birthDate);
        setDocumentType(current.documentType);
        setDocumentNumber(current.documentNumber);
        setCountry(current.country);
        setProvince(current.province);
        setCity(current.city);
        setAddress(current.address);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = async () => {
    try {
      setError(null);
      setSuccess(null);
      setSubmitting(true);
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || !session.access_token) {
        throw new Error("Necesitas iniciar sesión.");
      }
      if (!frontFile || !backFile) {
        throw new Error("Debes subir frente y dorso del DNI.");
      }

      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("birthDate", birthDate);
      formData.append("documentType", documentType);
      formData.append("documentNumber", documentNumber);
      formData.append("country", country);
      formData.append("province", province);
      formData.append("city", city);
      formData.append("address", address);
      formData.append("documentFront", frontFile);
      formData.append("documentBack", backFile);

      const response = await fetch("/api/author/apply", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar la solicitud.");

      setStatus("pending");
      setSuccess("Solicitud enviada. El equipo de FanPush va a revisar tu identidad.");
      window.dispatchEvent(new Event("creator-status-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <SidebarLeft
        searchOpen={searchOpen}
        onSearchClick={() => {
          setNotificationsOpen(false);
          setSearchOpen(true);
        }}
        notificationsOpen={notificationsOpen}
        onNotificationsClick={() => {
          setSearchOpen(false);
          setNotificationsOpen(true);
        }}
      />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-[980px] flex-col gap-6 overflow-y-auto px-4 py-6 md:px-6 md:py-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
              FanPush
            </div>
            <h1 className="mt-3 text-3xl font-semibold">Convertirme en autor</h1>
            <p className="mt-2 max-w-[720px] text-sm text-zinc-500">
              Para vender contenido debes verificar tu identidad, ser mayor de 18 años
              y subir frente y dorso de tu DNI.
            </p>
          </div>

          {loading ? (
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
              Cargando estado...
            </div>
          ) : (
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                  Estado:{" "}
                  {status === "approved"
                    ? "Aprobado"
                    : status === "pending"
                      ? "Pendiente"
                      : status === "rejected"
                        ? "Rechazado"
                        : "Sin solicitud"}
                </span>
              </div>

              {status === "approved" ? (
                <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                  Tu cuenta ya está aprobada para crear y vender contenido.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" placeholder="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" type="date" max={maxBirthDate} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                    <select
                      className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm"
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                    >
                      <option value="DNI">DNI</option>
                    </select>
                    <input
                      className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm"
                      placeholder="Número de documento"
                      inputMode="numeric"
                      maxLength={8}
                      value={documentNumber}
                      onChange={(e) =>
                        setDocumentNumber(e.target.value.replace(/\D/g, "").slice(0, 8))
                      }
                    />
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" placeholder="País" value={country} onChange={(e) => setCountry(e.target.value)} />
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" placeholder="Provincia" value={province} onChange={(e) => setProvince(e.target.value)} />
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" placeholder="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} />
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" placeholder="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="rounded-[20px] border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                      Frente del DNI
                      <input type="file" accept="image/*" className="mt-3 block w-full text-xs" onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)} />
                    </label>
                    <label className="rounded-[20px] border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                      Dorso del DNI
                      <input type="file" accept="image/*" className="mt-3 block w-full text-xs" onChange={(e) => setBackFile(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>

                  {error ? (
                    <div className="mt-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}
                  {success ? (
                    <div className="mt-4 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {success}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || status === "pending"}
                    className="mt-6 rounded-[18px] bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {submitting
                      ? "Enviando..."
                      : status === "pending"
                        ? "Solicitud en revisión"
                        : status === "rejected"
                          ? "Reenviar solicitud"
                          : "Enviar solicitud"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
