"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Film,
  ImagePlus,
  Info,
  Paperclip,
  Phone,
  Search,
  Send,
  Video,
  X,
} from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import { useGetViewerQuery } from "@/lib/redux/api/sessionApi";
import { buildUserProfileHref } from "@/lib/profileRoute";

type MessageItem =
  | {
      id: string;
      kind: "text";
      sender: "me" | "them";
      body: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "premium";
      sender: "me" | "them";
      title: string;
      caption: string;
      price: number;
      contentType: "foto" | "video" | "post";
      attachmentCount: number;
      attachmentPreviews: AttachmentPreview[];
      status: "locked" | "purchased";
      createdAt: string;
    };

type PremiumMessageItem = Extract<MessageItem, { kind: "premium" }>;

type ThreadItem = {
  id: string;
  username: string;
  fullName: string;
  handle: string;
  preview: string;
  avatarUrl: string | null;
  participantIsAuthor: boolean;
  messages: MessageItem[];
};

const formatUnits = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

type AttachmentPreview = {
  id: string;
  name: string;
  kind: "foto" | "video";
  previewUrl: string;
};

const buildPlaceholderPreview = (label: string, tone: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${tone}"/>
          <stop offset="100%" stop-color="#111827"/>
        </linearGradient>
      </defs>
      <rect width="480" height="480" fill="url(#g)"/>
      <circle cx="360" cy="120" r="58" fill="rgba(255,255,255,0.18)"/>
      <path d="M0 360L110 260L220 330L310 220L480 360V480H0Z" fill="rgba(255,255,255,0.18)"/>
      <text x="36" y="430" fill="white" font-family="Arial, sans-serif" font-size="38" font-weight="700">${label}</text>
    </svg>`,
  )}`;

function PremiumMessageCard({
  message,
  own,
  onUnlock,
}: {
  message: PremiumMessageItem;
  own: boolean;
  onUnlock: () => void;
}) {
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>(
    () => message.attachmentPreviews[0]?.id ?? "",
  );

  useEffect(() => {
    setSelectedPreviewId(message.attachmentPreviews[0]?.id ?? "");
  }, [message.attachmentPreviews]);

  const selectedPreview =
    message.attachmentPreviews.find((attachment) => attachment.id === selectedPreviewId) ??
    message.attachmentPreviews[0] ??
    null;
  const canSeeContent = own || message.status === "purchased";

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
          Contenido pago
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-zinc-950">
          ⚡ {formatUnits(message.price)}
        </div>
      </div>

      <div>
        <div className="text-[18px] font-semibold text-zinc-950">{message.title}</div>
        <div className="mt-1 text-[14px] leading-6 text-zinc-600">{message.caption}</div>
      </div>

      {canSeeContent && selectedPreview ? (
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-[20px] border border-amber-200 bg-white">
            <div className="aspect-[4/3] bg-zinc-100">
              {selectedPreview.kind === "video" ? (
                <video
                  src={selectedPreview.previewUrl}
                  className="h-full w-full object-cover"
                  controls
                />
              ) : (
                <img
                  src={selectedPreview.previewUrl}
                  alt={selectedPreview.name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>

          {message.attachmentPreviews.length > 1 ? (
            <div className="grid grid-cols-4 gap-2">
              {message.attachmentPreviews.map((attachment) => {
                const active = attachment.id === selectedPreview.id;
                return (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => setSelectedPreviewId(attachment.id)}
                    className={`overflow-hidden rounded-[14px] border transition ${
                      active ? "border-zinc-950" : "border-zinc-200"
                    }`}
                  >
                    <div className="aspect-square bg-zinc-100">
                      {attachment.kind === "video" ? (
                        <video
                          src={attachment.previewUrl}
                          className="h-full w-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={attachment.previewUrl}
                          alt={attachment.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {message.attachmentPreviews.map((attachment) => (
            <div
              key={attachment.id}
              className="relative overflow-hidden rounded-[16px] border border-amber-200 bg-white"
            >
              <div className="aspect-square bg-zinc-100">
                {attachment.kind === "video" ? (
                  <video
                    src={attachment.previewUrl}
                    className="h-full w-full scale-110 object-cover blur-[10px]"
                    muted
                  />
                ) : (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="h-full w-full scale-110 object-cover blur-[10px]"
                  />
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/28 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                Bloqueado
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-[18px] border border-amber-200 bg-white px-4 py-3">
        <div>
          <div className="text-[13px] font-semibold text-zinc-950">
            {message.contentType === "foto"
              ? "Fotos privadas"
              : message.contentType === "video"
                ? "Videos privados"
                : "Post privado"}
          </div>
          <div className="text-[13px] text-zinc-500">
            {message.attachmentCount} archivo
            {message.attachmentCount === 1 ? "" : "s"}{" "}
            {canSeeContent ? "disponible" : "bloqueado"}
            {message.attachmentCount === 1 ? "" : "s"} para este chat.
          </div>
        </div>
        {own ? (
          <div className="rounded-full bg-zinc-100 px-3 py-2 text-[13px] font-semibold text-zinc-700">
            Oferta enviada
          </div>
        ) : message.status === "purchased" ? (
          <div className="rounded-full bg-emerald-100 px-3 py-2 text-[13px] font-semibold text-emerald-700">
            Contenido desbloqueado
          </div>
        ) : (
          <button
            type="button"
            onClick={onUnlock}
            className="rounded-full bg-zinc-950 px-4 py-2 text-[13px] font-semibold text-white"
          >
            Comprar por ⚡ {formatUnits(message.price)}
          </button>
        )}
      </div>
    </div>
  );
}

const buildStarterThreads = (prefillUsername: string | null): ThreadItem[] => {
  const base: ThreadItem[] = [
    {
      id: "seed_author",
      username: "seed_author",
      fullName: "Seed Author",
      handle: "seed.author",
      avatarUrl: null,
      participantIsAuthor: true,
      preview: "Te envié un set premium para desbloquear cuando quieras.",
      messages: [
        {
          id: "m1",
          kind: "text",
          sender: "them",
          body: "Hola, te dejé por acá una propuesta privada.",
          createdAt: "Hoy · 18:42",
        },
        {
          id: "m2",
          kind: "premium",
          sender: "them",
          title: "Set privado exclusivo",
          caption: "3 archivos bloqueados para este chat.",
          price: 3500,
          contentType: "post",
          attachmentCount: 3,
          attachmentPreviews: [
            {
              id: "seed-1",
              name: "preview-1.jpg",
              kind: "foto",
              previewUrl: buildPlaceholderPreview("Preview 1", "#a16207"),
            },
            {
              id: "seed-2",
              name: "preview-2.jpg",
              kind: "foto",
              previewUrl: buildPlaceholderPreview("Preview 2", "#7c3aed"),
            },
            {
              id: "seed-3",
              name: "preview-3.mp4",
              kind: "video",
              previewUrl: buildPlaceholderPreview("Preview 3", "#2563eb"),
            },
          ],
          status: "locked",
          createdAt: "Hoy · 18:43",
        },
      ],
    },
    {
      id: "lore",
      username: "lore",
      fullName: "Lore",
      handle: "lore.fanpush",
      avatarUrl: null,
      participantIsAuthor: false,
      preview: "¿Te llegó el último mensaje?",
      messages: [
        {
          id: "m3",
          kind: "text",
          sender: "them",
          body: "¿Te llegó el último mensaje?",
          createdAt: "Ayer · 22:14",
        },
      ],
    },
  ];

  if (
    prefillUsername &&
    !base.some((thread) => thread.username.toLowerCase() === prefillUsername.toLowerCase())
  ) {
    base.unshift({
      id: `prefill-${prefillUsername}`,
      username: prefillUsername,
      fullName: prefillUsername,
      handle: `${prefillUsername}.fanpush`,
      avatarUrl: null,
      participantIsAuthor: false,
      preview: "Inicia la conversación.",
      messages: [
        {
          id: `hello-${prefillUsername}`,
          kind: "text",
          sender: "them",
          body: "Este chat ya está listo para arrancar.",
          createdAt: "Ahora",
        },
      ],
    });
  }

  return base;
};

function PremiumComposer({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (payload: {
    title: string;
    caption: string;
    price: number;
    contentType: "foto" | "video" | "post";
    attachmentCount: number;
    attachmentPreviews: AttachmentPreview[];
  }) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [price, setPrice] = useState("3500");
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);

  useEffect(() => {
    return () => {
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    };
  }, [attachments]);

  const hasAttachments = attachments.length > 0;
  const hasValidPrice = Number(price || 0) > 0;
  const contentType: "foto" | "video" | "post" = !hasAttachments
    ? "post"
    : attachments.every((attachment) => attachment.kind === "foto")
      ? "foto"
      : attachments.every((attachment) => attachment.kind === "video")
        ? "video"
        : "post";

  const resetComposer = () => {
    attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    setAttachments([]);
    setTitle("");
    setCaption("");
    setPrice("3500");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setAttachments((current) => {
      const next = [
        ...current,
        ...files.map((file, index) => ({
          id: `${file.name}-${file.size}-${Date.now()}-${index}`,
          name: file.name,
          kind: (file.type.startsWith("video/") ? "video" : "foto") as
            | "video"
            | "foto",
          previewUrl: URL.createObjectURL(file),
        })),
      ];
      return next.slice(0, 8);
    });

    event.target.value = "";
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === attachmentId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== attachmentId);
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="w-full max-w-[560px] rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[28px] font-semibold tracking-tight text-zinc-950">
              Enviar contenido premium
            </h2>
            <p className="mt-2 max-w-[420px] text-[15px] leading-6 text-zinc-500">
              Primero adjuntá los archivos. Después definís el texto y el precio de
              la oferta antes de mandarla al chat.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetComposer();
              onClose();
            }}
            className="rounded-full border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-[20px] border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-zinc-950">
                  1. Adjuntar contenido
                </div>
                <div className="mt-1 text-[14px] leading-6 text-zinc-500">
                  Podés subir fotos, videos o una mezcla de ambos para venderlos por
                  privado.
                </div>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-zinc-800"
              >
                <Paperclip className="h-4 w-4" />
                Adjuntar
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {attachments.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="relative overflow-hidden rounded-[18px] border border-zinc-200 bg-white"
                  >
                    <div className="aspect-square bg-zinc-100">
                      {attachment.kind === "video" ? (
                        <video
                          src={attachment.previewUrl}
                          className="h-full w-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={attachment.previewUrl}
                          alt={attachment.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="border-t border-zinc-200 px-3 py-2">
                      <div className="truncate text-[12px] font-semibold text-zinc-900">
                        {attachment.name}
                      </div>
                      <div className="mt-1 text-[12px] text-zinc-500">
                        {attachment.kind === "video" ? "Video" : "Foto"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white transition hover:bg-black"
                      aria-label="Quitar archivo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[16px] border border-dashed border-zinc-300 bg-white px-4 py-5 text-[14px] text-zinc-500">
                Todavía no elegiste archivos. Hasta no adjuntar contenido, la oferta
                no se puede enviar.
              </div>
            )}
          </div>

          <div className="rounded-[20px] border border-zinc-200 bg-white p-4">
            <div className="text-[15px] font-semibold text-zinc-950">
              2. Configurar la oferta
            </div>
            <div className="mt-1 text-[14px] leading-6 text-zinc-500">
              Cuando tengas adjuntos, completá el texto y definí el precio que verá
              el receptor.
            </div>

            <div className="mt-4 grid gap-4">
          <label className="grid gap-2">
            <span className="text-[15px] font-semibold text-zinc-900">Título</span>
            <input
              disabled={!hasAttachments}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Set exclusivo para vos"
              className="h-12 rounded-[16px] border border-zinc-200 px-4 text-[15px] text-zinc-950 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-[15px] font-semibold text-zinc-900">Descripción</span>
            <textarea
              disabled={!hasAttachments}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Contá qué incluye: fotos, videos o un post completo."
              rows={3}
              className="rounded-[16px] border border-zinc-200 px-4 py-3 text-[15px] text-zinc-950 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-[1fr_170px]">
            <div className="grid gap-2">
              <span className="text-[15px] font-semibold text-zinc-900">Tipo detectado</span>
              <div className="flex h-12 items-center gap-3 rounded-[16px] border border-zinc-200 px-4 text-[15px] font-semibold text-zinc-900">
                {contentType === "foto" ? (
                  <ImagePlus className="h-4 w-4 text-zinc-500" />
                ) : contentType === "video" ? (
                  <Film className="h-4 w-4 text-zinc-500" />
                ) : (
                  <Video className="h-4 w-4 text-zinc-500" />
                )}
                {contentType === "foto"
                  ? "Pack de fotos"
                  : contentType === "video"
                    ? "Pack de videos"
                    : "Post mixto"}
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-[15px] font-semibold text-zinc-900">Precio</span>
              <div className="flex h-12 items-center gap-3 rounded-[16px] border border-zinc-200 px-4">
                <span className="text-[20px]">⚡</span>
                <input
                  disabled={!hasAttachments}
                  value={price}
                  onChange={(event) =>
                    setPrice(event.target.value.replace(/[^\d]/g, "").slice(0, 9))
                  }
                  inputMode="numeric"
                  className="w-full bg-transparent text-[18px] font-semibold text-zinc-950 outline-none disabled:cursor-not-allowed disabled:text-zinc-400"
                />
              </div>
            </label>
          </div>

          <div className="rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] leading-6 text-zinc-600">
            Vista previa de la oferta:{" "}
            <span className="font-semibold text-zinc-900">
              {attachments.length || 0} archivo{attachments.length === 1 ? "" : "s"}
            </span>{" "}
            ·{" "}
            <span className="font-semibold text-zinc-900">
              ⚡ {formatUnits(Number(price || 0))}
            </span>
          </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              resetComposer();
              onClose();
            }}
            className="rounded-[16px] border border-zinc-200 px-5 py-3 text-[15px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!hasAttachments || !hasValidPrice}
            onClick={() => {
              onSend({
                title: title.trim() || "Contenido premium",
                caption: caption.trim() || "Oferta privada enviada por este chat.",
                price: Number(price || 0),
                contentType,
                attachmentCount: attachments.length,
                attachmentPreviews: attachments.map((attachment) => ({
                  ...attachment,
                })),
              });
              resetComposer();
            }}
            className="rounded-[16px] bg-zinc-950 px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Enviar al chat
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MensajesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: viewer } = useGetViewerQuery();
  const prefillUsername = searchParams.get("user");

  const [threads, setThreads] = useState<ThreadItem[]>(() =>
    buildStarterThreads(prefillUsername),
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string>(
    () => buildStarterThreads(prefillUsername)[0]?.id ?? "",
  );
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const canSendPremium = Boolean(viewer?.access.canCreate);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter(
      (thread) =>
        thread.fullName.toLowerCase().includes(term) ||
        thread.username.toLowerCase().includes(term),
    );
  }, [search, threads]);

  const selectedThread =
    filteredThreads.find((thread) => thread.id === selectedThreadId) ??
    threads.find((thread) => thread.id === selectedThreadId) ??
    filteredThreads[0] ??
    threads[0] ??
    null;

  const appendTextMessage = () => {
    const body = draft.trim();
    if (!body || !selectedThread) return;

    setThreads((current) =>
      current.map((thread) =>
        thread.id !== selectedThread.id
          ? thread
          : {
              ...thread,
              preview: body,
              messages: [
                ...thread.messages,
                {
                  id: `${thread.id}-${Date.now()}`,
                  kind: "text",
                  sender: "me",
                  body,
                  createdAt: "Ahora",
                },
              ],
            },
      ),
    );
    setDraft("");
  };

  const unlockPremiumMessage = (messageId: string) => {
    if (!selectedThread) return;

    setThreads((current) =>
      current.map((thread) =>
        thread.id !== selectedThread.id
          ? thread
          : {
              ...thread,
              preview: "Contenido desbloqueado en el chat.",
              messages: thread.messages.map((message) =>
                message.kind === "premium" && message.id === messageId
                  ? { ...message, status: "purchased" }
                  : message,
              ),
            },
      ),
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-950">
      <SidebarLeft />
      <PremiumComposer
        open={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        onSend={(payload) => {
          if (!selectedThread) return;
          setThreads((current) =>
            current.map((thread) =>
              thread.id !== selectedThread.id
                ? thread
                : {
                    ...thread,
                    preview: `${payload.title} · ⚡ ${formatUnits(payload.price)}`,
                    messages: [
                      ...thread.messages,
                      {
                        id: `${thread.id}-${Date.now()}`,
                        kind: "premium",
                        sender: "me",
                        title: payload.title,
                        caption: payload.caption,
                        price: payload.price,
                        contentType: payload.contentType,
                        attachmentCount: payload.attachmentCount,
                        attachmentPreviews: payload.attachmentPreviews,
                        status: "locked",
                        createdAt: "Ahora",
                      },
                    ],
                  },
            ),
          );
          setPremiumOpen(false);
        }}
      />

      <main className="mx-auto w-full max-w-[1440px] px-0 pb-16 pt-0 md:pl-[240px]">
        <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 border-zinc-200 bg-white md:grid-cols-[360px_minmax(0,1fr)] md:border-x">
          <aside className="border-b border-zinc-200 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between px-5 pb-4 pt-5">
              <div>
                <div className="text-[14px] font-medium text-zinc-500">Inbox</div>
                <h1 className="text-[34px] font-semibold tracking-tight text-zinc-950">
                  Mensajes
                </h1>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!canSendPremium) return;
                  setPremiumOpen(true);
                }}
                disabled={!canSendPremium}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-2 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                <ImagePlus className="h-4 w-4" />
                Premium
              </button>
            </div>

            <div className="px-5">
              <div className="flex h-12 items-center gap-3 rounded-full bg-zinc-100 px-4">
                <Search className="h-4 w-4 text-zinc-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar"
                  className="w-full bg-transparent text-[15px] text-zinc-950 outline-none placeholder:text-zinc-400"
                />
              </div>
            </div>

            <div className="mt-5 px-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Conversaciones
            </div>

            <div className="mt-2 flex flex-col">
              {filteredThreads.map((thread) => {
                const active = selectedThread?.id === thread.id;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`flex items-center gap-3 px-5 py-3 text-left transition ${
                      active ? "bg-zinc-100" : "hover:bg-zinc-50"
                    }`}
                  >
                    <UserAvatar
                      src={thread.avatarUrl}
                      alt={thread.fullName}
                      sizeClassName="h-12 w-12"
                      iconClassName="h-5 w-5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[16px] font-semibold text-zinc-950">
                        {thread.fullName}
                      </div>
                      <div className="truncate text-[14px] text-zinc-500">
                        {thread.preview}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-[calc(100vh-4rem)] flex-col">
            {selectedThread ? (
              <>
                <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={selectedThread.avatarUrl}
                      alt={selectedThread.fullName}
                      sizeClassName="h-12 w-12"
                      iconClassName="h-5 w-5"
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(buildUserProfileHref(selectedThread.username))
                        }
                        className="text-left text-[24px] font-semibold tracking-tight text-zinc-950"
                      >
                        {selectedThread.fullName}
                      </button>
                      <div className="text-[14px] text-zinc-500">
                        {selectedThread.handle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full p-2.5 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                    >
                      <Phone className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-2.5 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                    >
                      <Video className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-2.5 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                    >
                      <Info className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white px-5 py-6">
                  <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
                    {selectedThread.messages.map((message) => {
                      const own = message.sender === "me";
                      return (
                        <div
                          key={message.id}
                          className={`flex ${own ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-[24px] px-4 py-3 ${
                              message.kind === "premium"
                                ? "border border-amber-200 bg-amber-50 text-zinc-950"
                                : own
                                  ? "bg-indigo-600 text-white"
                                  : "bg-zinc-100 text-zinc-950"
                            }`}
                          >
                            {message.kind === "text" ? (
                              <div className="text-[15px] leading-6">{message.body}</div>
                            ) : (
                              <PremiumMessageCard
                                message={message}
                                own={own}
                                onUnlock={() => unlockPremiumMessage(message.id)}
                              />
                            )}

                            <div
                              className={`mt-2 text-[12px] ${
                                own && message.kind === "text"
                                  ? "text-indigo-100"
                                  : "text-zinc-400"
                              }`}
                            >
                              {message.createdAt}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-zinc-200 px-5 py-4">
                  <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {canSendPremium ? (
                        <button
                          type="button"
                          onClick={() => setPremiumOpen(true)}
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-2 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
                        >
                          <ImagePlus className="h-4 w-4" />
                          Enviar contenido premium
                        </button>
                      ) : null}
                      <div className="text-[13px] text-zinc-500">
                        {canSendPremium
                          ? selectedThread.participantIsAuthor
                            ? "Ambos son autores. Podés mandar fotos, videos o un post con precio."
                            : "Sos autor. Podés enviar contenido premium a este usuario por chat."
                          : "Como usuario comprador podés chatear, recibir ofertas privadas y desbloquearlas desde esta conversación."}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-full border border-zinc-200 px-4 py-3">
                      <input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            appendTextMessage();
                          }
                        }}
                        placeholder="Envía un mensaje..."
                        className="w-full bg-transparent text-[15px] text-zinc-950 outline-none placeholder:text-zinc-400"
                      />
                      <button
                        type="button"
                        onClick={appendTextMessage}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800"
                        aria-label="Enviar mensaje"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="max-w-[420px] text-center">
                  <div className="text-[28px] font-semibold tracking-tight text-zinc-950">
                    Sin conversación seleccionada
                  </div>
                  <div className="mt-2 text-[15px] leading-6 text-zinc-500">
                    Elegí una conversación o entra desde un perfil con “Enviar mensaje”.
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
