"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import AvatarCropModal from "@/components/AvatarCropModal";
import SidebarLeft from "@/components/SidebarLeft";
import {
  useGetAuthorApplicationQuery,
  useSubmitAuthorApplicationMutation,
} from "@/lib/redux/api/authorApi";
import {
  DOCUMENT_IMAGE_ACCEPT,
  MAX_DOCUMENT_IMAGE_BYTES,
  validateImageFile,
} from "@/lib/imageFiles";

type DocumentSide = "front" | "back";

function AuthorApplicationSkeleton() {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <div className="fanpush-skeleton h-8 w-36 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={`author-skeleton-input-${index}`} className="space-y-2">
            <div className="fanpush-skeleton h-4 w-24 rounded" />
            <div className="fanpush-skeleton h-[50px] w-full rounded-[16px]" />
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={`author-skeleton-upload-${index}`}
            className="rounded-[20px] border border-zinc-200 bg-zinc-50 p-4"
          >
            <div className="fanpush-skeleton h-4 w-36 rounded" />
            <div className="mt-2 fanpush-skeleton h-3 w-28 rounded" />
            <div className="mt-4 fanpush-skeleton h-[126px] w-full rounded-[14px]" />
          </div>
        ))}
      </div>

      <div className="mt-6 fanpush-skeleton h-12 w-40 rounded-[18px]" />
    </div>
  );
}

function DocumentUploadCard({
  title,
  previewUrl,
  fileName,
  disabled,
  onChange,
}: {
  title: string;
  previewUrl: string | null;
  fileName: string | null;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className={`block rounded-[20px] border border-dashed p-4 transition ${
        disabled
          ? "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-70"
          : "cursor-pointer border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-white"
      }`}
    >
      <input
        type="file"
        accept={DOCUMENT_IMAGE_ACCEPT}
        className="hidden"
        onChange={onChange}
        disabled={disabled}
      />
      <div className="text-sm font-semibold text-zinc-700">{title}</div>
      <p className="mt-1 text-xs text-zinc-500">JPG, PNG o WEBP. Hasta 10 MB.</p>

      {previewUrl ? (
        <div className="mt-4 flex items-center gap-4">
          <div className="h-[92px] w-[146px] overflow-hidden rounded-[14px] border border-zinc-200 bg-white">
            <img
              src={previewUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-zinc-900">
              {fileName ?? "Documento listo"}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Haz click para ajustar o reemplazar esta imagen.
            </div>
            <div className="mt-3 inline-flex rounded-[10px] border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">
              Ajustar imagen
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[14px] border border-zinc-200 bg-white px-4 py-5 text-sm text-zinc-500">
          Sube una foto nítida, completa y bien iluminada.
        </div>
      )}
    </label>
  );
}

export default function AutorSolicitudPage() {
  const { data: applicationData, isLoading: loading } = useGetAuthorApplicationQuery();
  const [submitAuthorApplication] = useSubmitAuthorApplicationMutation();
  const [status, setStatus] = useState<"idle" | "pending" | "approved" | "rejected">("idle");
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
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null);
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null);
  const [documentCrop, setDocumentCrop] = useState<{
    side: DocumentSide;
    imageSrc: string;
    fileName: string;
    mimeType: string;
  } | null>(null);
  const maxBirthDate = new Date(
    new Date().getFullYear() - 18,
    new Date().getMonth(),
    new Date().getDate(),
  )
    .toISOString()
    .split("T")[0];

  useEffect(() => {
    const current = applicationData?.current;
    if (!current) return;
    setStatus(applicationData.status);
    setFullName(current.fullName);
    setBirthDate(current.birthDate);
    setDocumentType(current.documentType);
    setDocumentNumber(current.documentNumber);
    setCountry(current.country);
    setProvince(current.province);
    setCity(current.city);
    setAddress(current.address);
    setFrontPreviewUrl(current.documentFrontUrl);
    setBackPreviewUrl(current.documentBackUrl);
  }, [applicationData]);

  useEffect(() => {
    return () => {
      if (documentCrop?.imageSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(documentCrop.imageSrc);
      }
      if (frontPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(frontPreviewUrl);
      }
      if (backPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(backPreviewUrl);
      }
    };
  }, [backPreviewUrl, documentCrop, frontPreviewUrl]);

  const resetFeedback = () => {
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const handleDocumentSelected =
    (side: DocumentSide) => (event: ChangeEvent<HTMLInputElement>) => {
      try {
        const file = event.target.files?.[0];
        if (!file) return;
        validateImageFile(file, {
          label:
            side === "front"
              ? "El frente del documento"
              : "El dorso del documento",
          maxBytes: MAX_DOCUMENT_IMAGE_BYTES,
        });
        if (documentCrop?.imageSrc?.startsWith("blob:")) {
          URL.revokeObjectURL(documentCrop.imageSrc);
        }
        resetFeedback();
        setDocumentCrop({
          side,
          imageSrc: URL.createObjectURL(file),
          fileName: file.name || `${side}-documento.jpg`,
          mimeType: file.type || "image/jpeg",
        });
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "No se pudo cargar la imagen del documento.",
        );
      } finally {
        event.target.value = "";
      }
    };

  const handleDocumentConfirmed = async (file: File) => {
    if (!documentCrop) return;

    const nextPreviewUrl = URL.createObjectURL(file);
    if (documentCrop.side === "front") {
      if (frontPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(frontPreviewUrl);
      }
      setFrontFile(file);
      setFrontPreviewUrl(nextPreviewUrl);
    } else {
      if (backPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(backPreviewUrl);
      }
      setBackFile(file);
      setBackPreviewUrl(nextPreviewUrl);
    }

    if (documentCrop.imageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(documentCrop.imageSrc);
    }
    setDocumentCrop(null);
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      setSuccess(null);
      setSubmitting(true);
      if (!frontFile || !backFile) {
        throw new Error("Debes subir frente y dorso del documento.");
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

      await submitAuthorApplication(formData).unwrap();

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
      <AvatarCropModal
        open={Boolean(documentCrop)}
        imageSrc={documentCrop?.imageSrc ?? ""}
        fileName={documentCrop?.fileName ?? "documento.jpg"}
        mimeType={documentCrop?.mimeType ?? "image/jpeg"}
        title={
          documentCrop?.side === "back"
            ? "Ajustar dorso del documento"
            : "Ajustar frente del documento"
        }
        description="Recorta la imagen para que el documento quede centrado, completo y bien legible."
        aspect={1.58}
        cropShape="rect"
        previewShape="rect"
        previewLabel="Recorte"
        confirmLabel="Usar esta imagen"
        outputWidth={1600}
        outputHeight={1000}
        onCancel={() => {
          if (documentCrop?.imageSrc?.startsWith("blob:")) {
            URL.revokeObjectURL(documentCrop.imageSrc);
          }
          setDocumentCrop(null);
        }}
        onConfirm={handleDocumentConfirmed}
      />

      <SidebarLeft />

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-[980px] flex-col gap-6 overflow-y-auto px-4 py-6 md:px-6 md:py-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
              FanPush
            </div>
            <h1 className="mt-3 text-3xl font-semibold">Convertirme en autor</h1>
            <p className="mt-2 max-w-[720px] text-sm text-zinc-500">
              Para vender contenido debes verificar tu identidad, ser mayor de 18 años
              y subir frente y dorso de tu documento.
            </p>
          </div>

          {loading ? (
            <AuthorApplicationSkeleton />
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
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" placeholder="Nombre completo" value={fullName} onChange={(e) => { resetFeedback(); setFullName(e.target.value); }} />
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" type="date" max={maxBirthDate} value={birthDate} onChange={(e) => { resetFeedback(); setBirthDate(e.target.value); }} />
                    <select
                      className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm"
                      value={documentType}
                      onChange={(e) => {
                        resetFeedback();
                        setDocumentType(e.target.value);
                      }}
                    >
                      <option value="DNI">DNI</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="Documento extranjero">Documento extranjero</option>
                    </select>
                    <input
                      className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm"
                      placeholder="Número de documento"
                      maxLength={20}
                      value={documentNumber}
                      onChange={(e) => {
                        resetFeedback();
                        setDocumentNumber(
                          e.target.value
                            .replace(/[^0-9a-zA-Z]/g, "")
                            .slice(0, 20)
                            .toUpperCase(),
                        );
                      }}
                    />
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" placeholder="País" value={country} onChange={(e) => { resetFeedback(); setCountry(e.target.value); }} />
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" placeholder="Provincia" value={province} onChange={(e) => { resetFeedback(); setProvince(e.target.value); }} />
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" placeholder="Ciudad" value={city} onChange={(e) => { resetFeedback(); setCity(e.target.value); }} />
                    <input className="rounded-[16px] border border-zinc-200 px-4 py-3 text-sm" placeholder="Dirección" value={address} onChange={(e) => { resetFeedback(); setAddress(e.target.value); }} />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <DocumentUploadCard
                      title="Frente del documento"
                      previewUrl={frontPreviewUrl}
                      fileName={frontFile?.name ?? null}
                      disabled={submitting || status === "pending"}
                      onChange={handleDocumentSelected("front")}
                    />
                    <DocumentUploadCard
                      title="Dorso del documento"
                      previewUrl={backPreviewUrl}
                      fileName={backFile?.name ?? null}
                      disabled={submitting || status === "pending"}
                      onChange={handleDocumentSelected("back")}
                    />
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
                    className="fanpush-button-primary mt-6 rounded-[18px] px-5 py-3 text-sm disabled:opacity-60"
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
