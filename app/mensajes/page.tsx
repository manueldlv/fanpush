"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  Check,
  ImagePlus,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Search,
  SendHorizontal,
  Smile,
  Trash2,
  X,
  Video,
  Package2,
} from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import TipModal from "@/components/TipModal";
import UserAvatar from "@/components/UserAvatar";
import {
  CHAT_BLOCKED_USERS_UPDATED_EVENT,
} from "@/lib/chatPreferences";
import { MAX_CONTENT_PRICE_ARS, MIN_CONTENT_PRICE_ARS } from "@/lib/pricing";
import { useGetViewerQuery } from "@/lib/redux/api/sessionApi";
import { isInsufficientBalanceMessage } from "@/lib/purchaseRedirect";
import { buildUserProfileHref } from "@/lib/profileRoute";
import { getSupabaseClient } from "@/lib/supabase";

type AttachmentPreview = {
  id: string;
  name: string;
  kind: "foto" | "video";
  previewUrl: string;
  previewMode?: "preview" | "locked";
  file?: File;
};

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
      kind: "attachment";
      sender: "me" | "them";
      body?: string;
      attachments: AttachmentPreview[];
      createdAt: string;
    }
  | {
      id: string;
      kind: "system";
      sender: "system";
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
      attachmentCount: number;
      attachmentPreviews: AttachmentPreview[];
      status: "locked" | "purchased";
      createdAt: string;
    };

type PremiumMessageItem = Extract<MessageItem, { kind: "premium" }>;

type ChatPreviewState = {
  attachments: AttachmentPreview[];
  index: number;
  unlocked: boolean;
};

type ThreadItem = {
  id: string;
  participantUserId: string;
  username: string;
  fullName: string;
  handle: string;
  preview: string;
  avatarUrl: string | null;
  participantIsAuthor: boolean;
  lastSeen: string;
  lastMessageAt?: string;
  unread?: boolean;
  pinned?: boolean;
  messages: MessageItem[];
};

type ThreadSummaryItem = Omit<ThreadItem, "messages">;

const formatUnits = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const buildPlaceholderPreview = (label: string, tone: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${tone}"/>
          <stop offset="100%" stop-color="#f5f5f5"/>
        </linearGradient>
      </defs>
      <rect width="720" height="720" fill="url(#g)"/>
      <circle cx="565" cy="150" r="96" fill="rgba(255,255,255,0.22)"/>
      <rect x="58" y="456" width="604" height="170" rx="26" fill="rgba(255,255,255,0.14)"/>
      <text x="58" y="640" fill="white" font-family="Arial, sans-serif" font-size="56" font-weight="700">${label}</text>
    </svg>`,
  )}`;

const EMOJI_OPTIONS = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😘",
  "😎",
  "🥹",
  "😉",
  "😇",
  "🤭",
  "🤔",
  "😮",
  "😴",
  "😜",
  "🥳",
  "🤩",
  "😌",
  "🫶",
  "❤️",
  "🔥",
  "✨",
  "🙏",
  "💜",
  "👍",
  "🎉",
  "💯",
];

const emojiOnlyRegex =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\s)+$/u;

const isEmojiOnlyMessage = (value: string) => {
  const trimmed = value.trim();
  return Boolean(trimmed) && emojiOnlyRegex.test(trimmed);
};

const chatRequest = async <T,>(input: string, init?: RequestInit) => {
  const supabase = getSupabaseClient();
  const session = supabase
    ? await supabase.auth.getSession().then((result) => result.data.session)
    : null;

  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(result.error ?? "No se pudo completar la operación del chat.");
  }
  return result;
};

const toThreadSummary = (thread: ThreadSummaryItem | ThreadItem): ThreadSummaryItem => ({
  id: thread.id,
  participantUserId: thread.participantUserId,
  username: thread.username,
  fullName: thread.fullName,
  handle: thread.handle,
  preview: thread.preview,
  avatarUrl: thread.avatarUrl,
  participantIsAuthor: thread.participantIsAuthor,
  lastSeen: thread.lastSeen,
  lastMessageAt: thread.lastMessageAt,
  unread: Boolean(thread.unread),
  pinned: Boolean(thread.pinned),
});

const toThreadDetail = (thread: ThreadItem): ThreadItem => ({
  ...toThreadSummary(thread),
  messages: thread.messages ?? [],
});

function PremiumComposer({
  open,
  onClose,
  onSend,
  mode,
  initialAttachments,
}: {
  open: boolean;
  onClose: () => void;
  mode: "photo" | "photo-paid" | "video-paid" | "pack-paid";
  initialAttachments: AttachmentPreview[];
  onSend: (payload: {
    price: number;
    attachmentCount: number;
    attachmentPreviews: AttachmentPreview[];
    originalFiles: File[];
  }) => void;
}) {
  const [price, setPrice] = useState("5500");
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const mediaLabel = useMemo(() => {
    const photos = attachments.filter((attachment) => attachment.kind === "foto").length;
    const videos = attachments.filter((attachment) => attachment.kind === "video").length;
    const parts: string[] = [];
    if (videos > 0) parts.push(`${videos} ${videos === 1 ? "video" : "videos"}`);
    if (photos > 0) parts.push(`${photos} ${photos === 1 ? "foto" : "fotos"}`);
    return parts.join(", ") || "Sin archivos";
  }, [attachments]);
  const composerTitle =
    mode === "photo-paid"
      ? "Enviar foto paga"
      : mode === "video-paid"
        ? "Enviar video pago"
        : "Enviar pack pago";
  const composerHelp =
    mode === "photo-paid"
      ? "Configura el precio para enviar esta foto paga por el chat."
      : mode === "video-paid"
        ? "Configura el precio para enviar este video pago por el chat."
        : "Configura el precio para enviar este pack pago por el chat.";

  useEffect(() => {
    return () => {
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    };
  }, [attachments]);

  useEffect(() => {
    if (!open) return;
    setAttachments(initialAttachments.map((attachment) => ({ ...attachment })));
    setPrice(String(Math.max(5500, MIN_CONTENT_PRICE_ARS)));
  }, [initialAttachments, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const resetComposer = () => {
    setAttachments([]);
    setPrice(String(Math.max(5500, MIN_CONTENT_PRICE_ARS)));
  };

  const handleClose = () => {
    resetComposer();
    onClose();
  };

  const canSend =
    attachments.length > 0 && Number(price || 0) >= MIN_CONTENT_PRICE_ARS;
  const hasInvalidPrice =
    price.trim().length > 0 && Number(price || 0) < MIN_CONTENT_PRICE_ARS;

  const toggleAttachmentPreviewMode = (attachmentId: string) => {
    setAttachments((current) =>
      current.map((attachment) =>
        attachment.id === attachmentId
          ? {
              ...attachment,
              previewMode:
                attachment.previewMode === "locked" ? "preview" : "locked",
            }
          : attachment,
      ),
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-[700px] rounded-[22px] bg-white shadow-2xl">
        <div className="p-5 md:px-7 md:pb-7 md:pt-7">
          <div className="flex items-start justify-between gap-4">
            <div className="pr-4">
              <h2 className="text-[22px] font-semibold leading-none tracking-tight text-zinc-900 md:text-[26px]">
                {composerTitle}
              </h2>
              <p className="mt-3 max-w-[520px] text-[13px] leading-[1.45] text-zinc-500 md:text-[14px]">
                {composerHelp}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-[12px] p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-7 rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-4 md:px-5 md:py-5">
            <div className="text-[15px] font-semibold text-zinc-700 md:text-[16px]">
              Archivos seleccionados
            </div>
            <div className="mt-2 text-[13px] leading-[1.45] text-zinc-500 md:text-[14px]">
              {mode === "photo-paid"
                ? "Esta foto se enviará como contenido pago en el chat."
                : mode === "video-paid"
                  ? "Este video se enviará como contenido pago en el chat."
                  : "Este pack se enviará como contenido pago en el chat."}
            </div>
            <div className="mt-1 text-[12px] leading-[1.45] text-zinc-500 md:text-[13px]">
              Por defecto todos salen bloqueados. Haz click en una miniatura si quieres dejarla como vista previa.
            </div>

            {attachments.length > 0 ? (
              <div
                className={`mt-4 grid gap-3 ${
                  attachments.length === 1
                    ? "grid-cols-1 max-w-[120px]"
                    : attachments.length === 2
                      ? "grid-cols-2 max-w-[252px]"
                      : attachments.length === 3
                        ? "grid-cols-3 max-w-[384px]"
                        : "grid-cols-4 max-w-[516px]"
                }`}
              >
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="relative h-[120px] w-[120px] overflow-hidden rounded-[14px] border border-zinc-200 bg-white"
                  >
                    {attachment.kind === "video" ? (
                      <video
                        src={attachment.previewUrl}
                        className="aspect-square h-full w-full object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.name}
                        className="aspect-square h-full w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => toggleAttachmentPreviewMode(attachment.id)}
                      className={`absolute inset-0 flex items-center justify-center text-center text-[12px] font-semibold text-white transition ${
                        attachment.previewMode === "locked"
                          ? "bg-black/40"
                          : "bg-black/15"
                      }`}
                    >
                      {attachment.previewMode === "locked" ? "Bloqueado" : "Vista previa"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[14px] border border-dashed border-zinc-200 bg-white px-4 py-4 text-[14px] text-zinc-500">
                Todavía no elegiste archivos.
              </div>
            )}
          </div>

          <div className="mt-7">
            <label className="block text-[15px] font-semibold text-zinc-700 md:text-[16px]">
              Precio del contenido
            </label>
            <div
              className={`mt-3 flex h-[64px] items-center rounded-[18px] border px-5 md:h-[72px] ${
                hasInvalidPrice
                  ? "border-rose-400 bg-rose-50"
                  : "border-zinc-300"
              }`}
            >
              <img
                src="/tip-lightning.png"
                alt=""
                aria-hidden="true"
                className="h-[22px] w-[22px] object-contain md:h-[24px] md:w-[24px]"
              />
              <input
                value={price}
                onChange={(event) => {
                  const numeric = event.target.value.replace(/[^\d]/g, "");
                  const nextValue = Math.min(
                    Number(numeric || 0),
                    MAX_CONTENT_PRICE_ARS,
                  );
                  setPrice(numeric ? String(nextValue) : "");
                }}
                inputMode="numeric"
                placeholder="Precio"
                className="w-full bg-transparent pl-3 text-[20px] font-semibold text-zinc-900 outline-none md:text-[22px]"
              />
            </div>
            <div
              className={`mt-2 text-[12px] leading-[1.45] md:text-[13px] ${
                hasInvalidPrice ? "text-rose-600" : "text-zinc-500"
              }`}
            >
              Mínimo ARS {MIN_CONTENT_PRICE_ARS.toLocaleString("es-AR")} · Máximo ARS {MAX_CONTENT_PRICE_ARS.toLocaleString("es-AR")}
            </div>
            {hasInvalidPrice ? (
              <div className="mt-2 text-[12px] font-medium text-rose-600 md:text-[13px]">
                El mínimo para enviar contenido pago por chat es ARS {MIN_CONTENT_PRICE_ARS.toLocaleString("es-AR")}.
              </div>
            ) : null}
          </div>

          <div className="mt-7 rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-4 md:px-5 md:py-5">
            <div className="flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
              <span>Precio final</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950">
                <img
                  src="/tip-lightning.png"
                  alt=""
                  aria-hidden="true"
                  className="h-3.5 w-3.5 object-contain"
                />
                {formatUnits(Number(price || 0))}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
              <span>Archivos</span>
              <span className="font-semibold text-zinc-950">{mediaLabel}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 text-[14px] text-zinc-700 md:text-[15px]">
              <span>Entrega</span>
              <span className="font-semibold text-zinc-950">Se envía por chat</span>
            </div>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-[14px] border border-zinc-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-700 md:min-w-[150px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canSend}
              onClick={() => {
                onSend({
                  price: Number(price || 0),
                  attachmentCount: attachments.length,
                  attachmentPreviews: attachments.map((attachment) => ({ ...attachment })),
                  originalFiles: attachments
                    .map((attachment) => attachment.file)
                    .filter((file): file is File => Boolean(file)),
                });
                handleClose();
              }}
              className="fanpush-button-primary rounded-[14px] px-5 py-2.5 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 md:min-w-[210px]"
            >
              Enviar al chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PremiumMessageCard({
  message,
  own,
  confirmUnlock,
  unlocking,
  canDelete,
  menuOpen,
  onToggleMenu,
  onDelete,
  onStartUnlock,
  onUnlock,
  onCancelUnlock,
  onOpenPreview,
}: {
  message: PremiumMessageItem;
  own: boolean;
  confirmUnlock: boolean;
  unlocking: boolean;
  canDelete: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onDelete: () => void;
  onStartUnlock: () => void;
  onUnlock: () => void;
  onCancelUnlock: () => void;
  onOpenPreview: (index: number) => void;
}) {
  const visibleItems = message.attachmentPreviews.slice(0, 6);
  const canSeeContent = message.status === "purchased";

  return (
    <div className="relative w-full max-w-[345px] rounded-[5px] bg-[#f3f3f3] p-4 text-left text-[#161823]">
      {canDelete ? (
        <div
          className="absolute right-3 top-3"
          data-message-menu-root="true"
        >
          <button
            type="button"
            onClick={onToggleMenu}
            className="rounded-full bg-white/95 p-1.5 text-[#6b7280] shadow-sm transition hover:bg-white hover:text-[#161823]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-9 z-10 min-w-[140px] rounded-[10px] border border-zinc-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={onDelete}
                className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="text-[15px] font-semibold tracking-[-0.02em]">
        {message.title}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="text-[12px] text-[#6b7280]">{message.caption}</div>
        <span className="inline-flex rounded-full bg-[#ede7ff] px-2 py-1 text-[11px] font-semibold text-[#5A3EE7]">
          ${formatUnits(message.price)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {visibleItems.map((attachment, index) => (
          <div
            key={attachment.id}
            className="relative overflow-hidden rounded-[5px] bg-white"
          >
            <button
              type="button"
              onClick={() => onOpenPreview(index)}
              className="block w-full"
            >
              {attachment.kind === "video" ? (
                <video
                  src={attachment.previewUrl}
                  className={`aspect-square h-full w-full object-cover ${
                    canSeeContent || attachment.previewMode !== "locked"
                      ? ""
                      : "scale-105 blur-[8px]"
                  }`}
                  muted
                />
              ) : (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className={`aspect-square h-full w-full object-cover ${
                    canSeeContent || attachment.previewMode !== "locked"
                      ? ""
                      : "scale-105 blur-[8px]"
                  }`}
                />
              )}
            </button>
            {!canSeeContent && index < 5 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15 text-[10px] font-semibold text-white">
                {attachment.previewMode === "locked" ? "Bloqueado" : "Vista Previa"}
              </div>
            ) : null}
            {!canSeeContent && index === 5 && message.attachmentPreviews.length > 6 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 text-[14px] font-semibold text-white">
                +{message.attachmentPreviews.length - 5}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {own ? (
        <div className="mt-3 inline-flex rounded-[5px] bg-[#e9e9e9] px-3 py-2 text-[13px] font-semibold text-[#464646]">
          Oferta enviada
        </div>
      ) : message.status === "purchased" ? (
        <div className="mt-3 inline-flex rounded-[5px] bg-[#dff7e6] px-3 py-2 text-[13px] font-semibold text-[#127a38]">
          Contenido desbloqueado
        </div>
      ) : confirmUnlock ? (
        <div className="mt-3 grid gap-2">
          <div className="text-[12px] text-[#464646]">
            {unlocking
              ? "Procesando la compra de este contenido..."
              : "Confirmá si querés desbloquear este contenido."}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={unlocking}
              onClick={onCancelUnlock}
              className="rounded-[5px] border border-[#E0E0E0] bg-white px-3 py-2 text-[13px] font-semibold text-[#464646] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={unlocking}
              onClick={onUnlock}
              className="inline-flex items-center gap-2 rounded-[5px] bg-[#5A3EE7] px-3 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {unlocking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>Confirmar por ${formatUnits(message.price)}</>
              )}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onStartUnlock}
          className="mt-3 inline-flex items-center rounded-[5px] bg-[#5A3EE7] px-3 py-2 text-[13px] font-semibold text-white"
        >
          Desbloquear por ${formatUnits(message.price)}
        </button>
      )}

      <div className="mt-2 text-right text-[11px] text-[#8b8b8b]">{message.createdAt}</div>
    </div>
  );
}

function AttachmentMessageCard({
  attachments,
  canDelete,
  menuOpen,
  onToggleMenu,
  onDelete,
  onOpenPreview,
}: {
  attachments: AttachmentPreview[];
  canDelete: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onDelete: () => void;
  onOpenPreview: (index: number) => void;
}) {
  const visibleItems = attachments.slice(0, 4);
  const extraCount = Math.max(attachments.length - 4, 0);
  const isSingleAttachment = attachments.length === 1;

  return (
    <div className="relative w-full max-w-[345px] rounded-[12px] bg-[#f3f3f3] p-3">
      {canDelete ? (
        <div
          className="absolute right-3 top-3"
          data-message-menu-root="true"
        >
          <button
            type="button"
            onClick={onToggleMenu}
            className="rounded-full p-1.5 text-[#6b7280] transition hover:bg-black/5 hover:text-[#161823]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-9 z-10 min-w-[140px] rounded-[10px] border border-zinc-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={onDelete}
                className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={`grid gap-2 ${isSingleAttachment ? "grid-cols-1" : "grid-cols-2"}`}>
        {visibleItems.map((attachment, index) => (
          <div
            key={attachment.id}
            className="relative overflow-hidden rounded-[10px] bg-white"
          >
            <button
              type="button"
              onClick={() => onOpenPreview(index)}
              className="block w-full"
            >
              {attachment.kind === "video" ? (
                <video
                  src={attachment.previewUrl}
                  className={`h-full w-full object-cover ${
                    isSingleAttachment ? "aspect-[4/5]" : "aspect-square"
                  }`}
                  muted
                />
              ) : (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className={`h-full w-full object-cover ${
                    isSingleAttachment ? "aspect-[4/5]" : "aspect-square"
                  }`}
                />
              )}
            </button>
            {extraCount > 0 && index === visibleItems.length - 1 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[15px] font-semibold text-white">
                +{extraCount}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MensajesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const emojiRef = useRef<HTMLDivElement | null>(null);
  const composeMenuRef = useRef<HTMLDivElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const paidPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const paidVideoInputRef = useRef<HTMLInputElement | null>(null);
  const paidPackInputRef = useRef<HTMLInputElement | null>(null);
  const prefillHandledRef = useRef(false);
  const { data: viewer, refetch: refetchViewer } = useGetViewerQuery();
  const prefillUsername = searchParams.get("user");

  const [threads, setThreads] = useState<ThreadSummaryItem[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [selectedThread, setSelectedThread] = useState<ThreadItem | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [emojiQuery, setEmojiQuery] = useState("");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [premiumMode, setPremiumMode] = useState<
    "photo" | "photo-paid" | "video-paid" | "pack-paid"
  >("pack-paid");
  const [premiumDraftAttachments, setPremiumDraftAttachments] = useState<
    AttachmentPreview[]
  >([]);
  const [confirmUnlockId, setConfirmUnlockId] = useState<string | null>(null);
  const [unlockingMessageId, setUnlockingMessageId] = useState<string | null>(null);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [openPreview, setOpenPreview] = useState<ChatPreviewState | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [composeMenuOpen, setComposeMenuOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "delete" | "block";
    thread: ThreadSummaryItem;
  } | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const canSendPremium = Boolean(viewer?.access.canCreate);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visibleThreads = [...threads].sort((a, b) => {
      if (Number(Boolean(b.pinned)) !== Number(Boolean(a.pinned))) {
        return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      }
      return (
        new Date(b.lastMessageAt ?? 0).getTime() -
        new Date(a.lastMessageAt ?? 0).getTime()
      );
    });
    if (!term) return visibleThreads;
    return visibleThreads.filter(
      (thread) =>
        thread.fullName.toLowerCase().includes(term) ||
        thread.username.toLowerCase().includes(term),
    );
  }, [search, threads]);

  useEffect(() => {
    if (!selectedThreadId && filteredThreads[0]) {
      setSelectedThreadId(filteredThreads[0].id);
    }
  }, [filteredThreads, selectedThreadId]);

  useEffect(() => {
    let cancelled = false;

    const loadThreads = async () => {
      setLoadingThreads(true);
      try {
        const result = await chatRequest<{
          ok: true;
          threads: ThreadSummaryItem[];
        }>("/api/direct-chats");
        if (cancelled) return;
        setThreads(result.threads.map(toThreadSummary));
        setChatError(null);
      } catch (error) {
        if (cancelled) return;
        setThreads([]);
        setChatError(
          error instanceof Error ? error.message : "No se pudieron cargar los chats.",
        );
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    };

    void loadThreads();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!prefillUsername || prefillHandledRef.current) return;
    prefillHandledRef.current = true;

    const openPrefilledThread = async () => {
      try {
        const result = await chatRequest<{
          ok: true;
          thread: ThreadItem;
        }>("/api/direct-chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: prefillUsername }),
        });
        const detail = toThreadDetail(result.thread);
        setSelectedThread(detail);
        setSelectedThreadId(detail.id);
        setThreads((current) => {
          const summary = toThreadSummary(detail);
          const withoutCurrent = current.filter((item) => item.id !== summary.id);
          return [summary, ...withoutCurrent];
        });
        setChatError(null);
      } catch (error) {
        setChatError(
          error instanceof Error ? error.message : "No se pudo abrir el chat.",
        );
      }
    };

    void openPrefilledThread();
  }, [prefillUsername]);

  useEffect(() => {
    if (!selectedThreadId) {
      setSelectedThread(null);
      return;
    }
    if (selectedThread?.id === selectedThreadId) return;

    let cancelled = false;
    const loadThread = async () => {
      setLoadingThread(true);
      try {
        const result = await chatRequest<{
          ok: true;
          thread: ThreadItem;
        }>(`/api/direct-chats/threads/${selectedThreadId}`);
        if (cancelled) return;
        const detail = toThreadDetail(result.thread);
        setSelectedThread(detail);
        setThreads((current) =>
          current.map((thread) =>
            thread.id === detail.id ? toThreadSummary(detail) : thread,
          ),
        );
        setChatError(null);
      } catch (error) {
        if (cancelled) return;
        setChatError(
          error instanceof Error ? error.message : "No se pudo cargar el chat.",
        );
      } finally {
        if (!cancelled) setLoadingThread(false);
      }
    };

    void loadThread();
    return () => {
      cancelled = true;
    };
  }, [selectedThreadId, selectedThread?.id]);

  const appendTextMessage = async () => {
    const body = draft.trim();
    if (!body || !selectedThread) return;
    setSendingMessage(true);
    try {
      const formData = new FormData();
      formData.append("kind", "text");
      formData.append("body", body);
      const result = await chatRequest<{
        ok: true;
        thread: ThreadItem;
      }>(`/api/direct-chats/threads/${selectedThread.id}/messages`, {
        method: "POST",
        body: formData,
      });
      const detail = toThreadDetail(result.thread);
      setSelectedThread(detail);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === detail.id ? toThreadSummary(detail) : thread,
        ),
      );
      setDraft("");
      setChatError(null);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "No se pudo enviar el mensaje.",
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const createAttachmentPreviews = (files: File[]) =>
    files.map((file, index) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${index}`,
      name: file.name,
      kind: (file.type.startsWith("video/") ? "video" : "foto") as
        | "video"
        | "foto",
      previewUrl: URL.createObjectURL(file),
      previewMode: "locked" as const,
      file,
    }));

  const sendDirectAttachments = async (attachments: AttachmentPreview[]) => {
    if (!selectedThread || attachments.length === 0) return;
    setSendingMessage(true);
    try {
      const formData = new FormData();
      formData.append("kind", "attachment");
      attachments.forEach((attachment, index) => {
        if (attachment.file) {
          formData.append(`original_${index}`, attachment.file);
        }
      });
      const result = await chatRequest<{
        ok: true;
        thread: ThreadItem;
      }>(`/api/direct-chats/threads/${selectedThread.id}/messages`, {
        method: "POST",
        body: formData,
      });
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
      const detail = toThreadDetail(result.thread);
      setSelectedThread(detail);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === detail.id ? toThreadSummary(detail) : thread,
        ),
      );
      setChatError(null);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "No se pudo enviar el adjunto.",
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const openPremiumComposerWithFiles = (
    mode: "photo-paid" | "video-paid" | "pack-paid",
    files: File[],
  ) => {
    const attachments = createAttachmentPreviews(files);
    setPremiumDraftAttachments(attachments);
    setPremiumMode(mode);
    setPremiumOpen(true);
  };

  const handlePhotoSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files[0]) {
      sendDirectAttachments(createAttachmentPreviews([files[0]]));
    }
    event.target.value = "";
  };

  const handlePaidPhotoSelected = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files[0]) {
      openPremiumComposerWithFiles("photo-paid", [files[0]]);
    }
    event.target.value = "";
  };

  const handlePaidVideoSelected = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("video/"),
    );
    if (files[0]) {
      openPremiumComposerWithFiles("video-paid", [files[0]]);
    }
    event.target.value = "";
  };

  const handlePaidPackSelected = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? [])
      .filter(
        (file) =>
          file.type.startsWith("image/") || file.type.startsWith("video/"),
      )
      .slice(0, 10);
    if (files.length > 0) {
      openPremiumComposerWithFiles("pack-paid", files);
    }
    event.target.value = "";
  };

  const threadMenuActions = {
    togglePinned: async (threadId: string) => {
      try {
        const result = await chatRequest<{
          ok: true;
          thread: ThreadItem;
        }>(`/api/direct-chats/threads/${threadId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "togglePinned" }),
        });
        const detail = toThreadDetail(result.thread);
        setSelectedThread((current) => (current?.id === detail.id ? detail : current));
        setThreads((current) =>
          current.map((thread) =>
            thread.id === detail.id ? toThreadSummary(detail) : thread,
          ),
        );
        setChatError(null);
      } catch (error) {
        setChatError(
          error instanceof Error ? error.message : "No se pudo actualizar el chat.",
        );
      }
      setOpenMenuId(null);
    },
    toggleUnread: async (threadId: string) => {
      try {
        const result = await chatRequest<{
          ok: true;
          thread: ThreadItem;
        }>(`/api/direct-chats/threads/${threadId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggleUnread" }),
        });
        const detail = toThreadDetail(result.thread);
        setSelectedThread((current) => (current?.id === detail.id ? detail : current));
        setThreads((current) =>
          current.map((thread) =>
            thread.id === detail.id ? toThreadSummary(detail) : thread,
          ),
        );
        setChatError(null);
      } catch (error) {
        setChatError(
          error instanceof Error ? error.message : "No se pudo actualizar el chat.",
        );
      }
      setOpenMenuId(null);
    },
    deleteThread: async (threadId: string) => {
      try {
        await chatRequest<{ ok: true; deleted: true }>(
          `/api/direct-chats/threads/${threadId}/actions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete" }),
          },
        );
        setThreads((current) => {
          const nextThreads = current.filter((thread) => thread.id !== threadId);
          if (selectedThreadId === threadId) {
            setSelectedThread(null);
            setSelectedThreadId(nextThreads[0]?.id ?? "");
          }
          return nextThreads;
        });
        setChatError(null);
      } catch (error) {
        setChatError(
          error instanceof Error ? error.message : "No se pudo eliminar el chat.",
        );
      }
      setOpenMenuId(null);
    },
    blockThread: async (thread: ThreadSummaryItem) => {
      try {
        await chatRequest<{ ok: true; blocked: true }>(
          `/api/direct-chats/threads/${thread.id}/actions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "block" }),
          },
        );
        setThreads((current) => {
          const nextThreads = current.filter((item) => item.id !== thread.id);
          if (selectedThreadId === thread.id) {
            setSelectedThread(null);
            setSelectedThreadId(nextThreads[0]?.id ?? "");
          }
          return nextThreads;
        });
        window.dispatchEvent(new CustomEvent(CHAT_BLOCKED_USERS_UPDATED_EVENT));
        setChatError(null);
      } catch (error) {
        setChatError(
          error instanceof Error ? error.message : "No se pudo bloquear el chat.",
        );
      }
      setOpenMenuId(null);
    },
  };

  const unlockPremiumMessage = async (messageId: string) => {
    if (!selectedThread) return;
    try {
      setUnlockingMessageId(messageId);
      setChatError(null);
      const result = await chatRequest<{
        ok: true;
        thread: ThreadItem;
        balance: number;
      }>(`/api/direct-chats/messages/${messageId}/purchase`, {
        method: "POST",
      });
      const detail = toThreadDetail(result.thread);
      setSelectedThread(detail);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === detail.id ? toThreadSummary(detail) : thread,
        ),
      );
      window.dispatchEvent(new Event("purchases-updated"));
      window.dispatchEvent(new Event("balance-updated"));
      setChatError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo comprar el contenido del chat.";
      if (isInsufficientBalanceMessage(message)) {
        setChatError("No tienes saldo suficiente para comprar este contenido. Te redirigimos para cargar saldo.");
        window.setTimeout(() => {
          window.location.assign("/saldo?reason=insufficient-balance");
        }, 1200);
        return;
      }
      setChatError(
        message,
      );
    } finally {
      setUnlockingMessageId(null);
      setConfirmUnlockId(null);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!selectedThread) return;
    try {
      const result = await chatRequest<{
        ok: true;
        thread: ThreadItem;
      }>(`/api/direct-chats/messages/${messageId}?threadId=${selectedThread.id}`, {
        method: "DELETE",
      });
      const detail = toThreadDetail(result.thread);
      setSelectedThread(detail);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === detail.id ? toThreadSummary(detail) : thread,
        ),
      );
      setMessageMenuId(null);
      setChatError(null);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "No se pudo eliminar el mensaje.",
      );
    }
  };

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpenMenuId(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    if (!emojiOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (emojiRef.current && !emojiRef.current.contains(target)) {
        setEmojiOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [emojiOpen]);

  useEffect(() => {
    if (!composeMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (composeMenuRef.current && !composeMenuRef.current.contains(target)) {
        setComposeMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [composeMenuOpen]);

  useEffect(() => {
    if (!messageMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-message-menu-root='true']")) {
        setMessageMenuId(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [messageMenuId]);

  useEffect(() => {
    if (!openPreview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPreview(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openPreview]);

  const filteredEmojis = EMOJI_OPTIONS.filter((emoji) =>
    emojiQuery.trim() ? emoji.includes(emojiQuery.trim()) : true,
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#161823] md:h-screen md:overflow-hidden">
      <SidebarLeft />
      <PremiumComposer
        open={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        mode={premiumMode}
        initialAttachments={premiumDraftAttachments}
        onSend={async (payload) => {
          if (!selectedThread) return;
          setSendingMessage(true);
          try {
            const formData = new FormData();
            formData.append("kind", "premium");
            formData.append("title", "Contenido privado");
            formData.append("price", String(payload.price));
            payload.originalFiles.forEach((file, index) => {
              formData.append(`original_${index}`, file);
            });
            payload.attachmentPreviews.forEach((attachment, index) => {
              formData.append(
                `preview_mode_${index}`,
                attachment.previewMode === "locked" ? "locked" : "preview",
              );
            });
            const result = await chatRequest<{
              ok: true;
              thread: ThreadItem;
            }>(`/api/direct-chats/threads/${selectedThread.id}/messages`, {
              method: "POST",
              body: formData,
            });
            payload.attachmentPreviews.forEach((attachment) =>
              URL.revokeObjectURL(attachment.previewUrl),
            );
            const detail = toThreadDetail(result.thread);
            setSelectedThread(detail);
            setThreads((current) =>
              current.map((thread) =>
                thread.id === detail.id ? toThreadSummary(detail) : thread,
              ),
            );
            setPremiumOpen(false);
            setChatError(null);
          } catch (error) {
            setChatError(
              error instanceof Error
                ? error.message
                : "No se pudo enviar el contenido pago.",
            );
          } finally {
            setSendingMessage(false);
          }
        }}
      />
      <TipModal
        open={tipOpen}
        availableBalance={viewer?.commerce.balance ?? 0}
        recipientLabel={selectedThread?.username ?? "usuario"}
        recipientUserId={selectedThread?.participantUserId ?? null}
        threadId={selectedThread?.id ?? null}
        onClose={() => setTipOpen(false)}
        onSubmitted={async () => {
          setTipOpen(false);
          setChatError(null);
          window.dispatchEvent(new Event("purchases-updated"));
          window.dispatchEvent(new Event("balance-updated"));
          await refetchViewer();
        }}
      />
      {openPreview ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-6">
          <div
            className="absolute inset-0"
            onClick={() => setOpenPreview(null)}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => setOpenPreview(null)}
            className="absolute right-6 top-6 z-[111] rounded-[10px] bg-white/90 p-2"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative z-[111] flex w-full max-w-[960px] overflow-hidden rounded-[12px] bg-black">
            <div className="relative h-[70vh] w-full bg-black">
              {openPreview.attachments[openPreview.index]?.kind === "video" ? (
                <video
                  src={openPreview.attachments[openPreview.index]?.previewUrl}
                  className={`h-full w-full object-contain ${
                    openPreview.unlocked ||
                    openPreview.attachments[openPreview.index]?.previewMode !== "locked"
                      ? ""
                      : "blur-[14px]"
                  }`}
                  controls
                  playsInline
                />
              ) : (
                <img
                  src={openPreview.attachments[openPreview.index]?.previewUrl}
                  alt={openPreview.attachments[openPreview.index]?.name ?? "Vista previa"}
                  className={`h-full w-full object-contain ${
                    openPreview.unlocked ||
                    openPreview.attachments[openPreview.index]?.previewMode !== "locked"
                      ? ""
                      : "blur-[14px]"
                  }`}
                />
              )}
              {!openPreview.unlocked &&
              openPreview.attachments[openPreview.index]?.previewMode === "locked" ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-[10px] bg-white/20 p-4 text-white shadow-sm backdrop-blur-[2px]">
                    <Lock className="h-8 w-8" strokeWidth={2.2} />
                  </div>
                </div>
              ) : null}
              {openPreview.attachments.length > 1 ? (
                <>
                  <div className="absolute inset-y-0 left-0 z-20 flex items-center pl-3">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenPreview((current) =>
                          current
                            ? {
                                ...current,
                                index:
                                  (current.index - 1 + current.attachments.length) %
                                  current.attachments.length,
                              }
                            : current,
                        )
                      }
                      className="rounded-[10px] bg-white/80 px-3 py-2 text-sm font-semibold text-zinc-700"
                    >
                      ‹
                    </button>
                  </div>
                  <div className="absolute inset-y-0 right-0 z-20 flex items-center pr-3">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenPreview((current) =>
                          current
                            ? {
                                ...current,
                                index: (current.index + 1) % current.attachments.length,
                              }
                            : current,
                        )
                      }
                      className="rounded-[10px] bg-white/80 px-3 py-2 text-sm font-semibold text-zinc-700"
                    >
                      ›
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {pendingAction ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[420px] rounded-[20px] bg-white p-6">
            <div className="text-[22px] font-semibold tracking-[-0.03em] text-[#161823]">
              {pendingAction.type === "delete"
                ? "Eliminar chat"
                : "Bloquear usuario"}
            </div>
            <p className="mt-3 text-[15px] leading-6 text-[#464646]">
              {pendingAction.type === "delete"
                ? `¿Seguro que quieres eliminar el chat con ${pendingAction.thread.fullName}?`
                : `¿Seguro que quieres bloquear a ${pendingAction.thread.fullName}? Podrás desbloquearlo después desde Configuración.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-[5px] border border-[#E0E0E0] px-4 py-2.5 text-[15px] font-semibold text-[#464646]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingAction.type === "delete") {
                    threadMenuActions.deleteThread(pendingAction.thread.id);
                  } else {
                    threadMenuActions.blockThread(pendingAction.thread);
                  }
                  setPendingAction(null);
                }}
                className={`rounded-[5px] px-4 py-2.5 text-[15px] font-semibold text-white ${
                  pendingAction.type === "delete" ? "bg-[#ff4b57]" : "bg-[#161823]"
                }`}
              >
                {pendingAction.type === "delete" ? "Eliminar" : "Bloquear"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="min-h-[calc(100dvh-64px)] w-full md:h-[calc(100dvh-64px)] md:overflow-hidden md:pl-[240px]">
        <div className="grid min-h-[calc(100dvh-64px)] grid-cols-1 border-r border-[#E0E0E0] bg-white md:h-full md:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-b border-[#E0E0E0] md:border-b-0 md:border-r">
            <div className="px-5 pb-5 pt-4">
              <div className="text-[28px] font-semibold tracking-[-0.03em] text-[#161823]">
                {viewer?.profile.username ?? "seed_author"}
              </div>
              <div className="mt-3 flex h-10 items-center rounded-[999px] border border-[#E0E0E0] bg-white px-3">
                <Search className="h-4 w-4 text-[#9ca3af]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar usuarios"
                  className="w-full bg-transparent px-2 text-[13px] text-[#161823] outline-none placeholder:text-[#9ca3af]"
                />
              </div>
            </div>

            <div className="px-5 pb-3 text-[20px] font-semibold tracking-[-0.04em] text-[#161823]">
              Mensajes
            </div>

            {chatError ? (
              <div className="mx-5 mb-3 rounded-[5px] border border-[#fecaca] bg-[#fff5f5] px-3 py-2 text-[13px] text-[#b42318]">
                {chatError}
              </div>
            ) : null}

            <div className="flex flex-col pb-5">
              {loadingThreads ? (
                <div className="px-5 py-8 text-[14px] text-[#8b8b8b]">Cargando chats...</div>
              ) : filteredThreads.length === 0 ? (
                search.trim() ? (
                  <div className="px-5 py-8 text-[14px] text-[#8b8b8b]">
                    No encontramos chats para tu búsqueda.
                  </div>
                ) : (
                  <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="flex h-[92px] w-[92px] items-center justify-center rounded-full border-2 border-[#b9d9b6] bg-[#edfbe8]">
                      <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full border-2 border-[#b9d9b6] bg-[#f7fff3]">
                        <Check className="h-9 w-9 text-[#36503a]" strokeWidth={2.5} />
                      </div>
                    </div>
                    <h3 className="mt-8 text-[22px] font-semibold tracking-[-0.03em] text-[#161823]">
                      Todavía no tienes chats
                    </h3>
                    <p className="mt-3 text-[15px] text-[#464646]">
                      Cuando empieces una conversación, va a aparecer acá.
                    </p>
                  </div>
                )
              ) : filteredThreads.map((thread) => {
                const active = selectedThread?.id === thread.id;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`grid grid-cols-[42px_minmax(0,1fr)_18px] items-center gap-3 px-5 py-2.5 text-left transition ${
                      active ? "bg-[#f7f7f7]" : "hover:bg-[#fafafa]"
                    }`}
                  >
                    <UserAvatar
                      src={thread.avatarUrl}
                      alt={thread.fullName}
                      sizeClassName="h-[42px] w-[42px]"
                      iconClassName="h-4 w-4"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[#161823]">
                        {thread.fullName}
                      </div>
                      <div
                        className={`truncate text-[12px] ${
                          thread.unread ? "font-semibold text-[#464646]" : "text-[#8b8b8b]"
                        }`}
                      >
                        {thread.preview} · {thread.lastSeen}
                      </div>
                    </div>
                    <div className="relative" ref={openMenuId === thread.id ? menuRef : null}>
                      {thread.unread ? (
                        <span className="absolute -left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#ff334b]" />
                      ) : null}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId((current) =>
                            current === thread.id ? null : thread.id,
                          );
                        }}
                        className="rounded-full p-1 text-[#161823]"
                        aria-label="Opciones del chat"
                      >
                        <MoreHorizontal className="h-4 w-4 text-[#161823]" />
                      </button>
                      {openMenuId === thread.id ? (
                        <div className="absolute right-0 top-8 z-20 w-[230px] rounded-[28px] border border-[#E0E0E0] bg-white p-3 shadow-[0_18px_35px_rgba(0,0,0,0.08)]">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              threadMenuActions.toggleUnread(thread.id);
                            }}
                            className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left text-[14px] text-[#161823] hover:bg-[#fafafa]"
                          >
                            <span>Marcar como no leído</span>
                            <Mail className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              threadMenuActions.togglePinned(thread.id);
                            }}
                            className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left text-[14px] text-[#161823] hover:bg-[#fafafa]"
                          >
                            <span>{thread.pinned ? "Unpin" : "Pin"}</span>
                            {thread.pinned ? (
                              <PinOff className="h-5 w-5" />
                            ) : (
                              <Pin className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingAction({ type: "block", thread });
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left text-[14px] text-[#161823] hover:bg-[#fafafa]"
                          >
                            <span>Bloquear</span>
                            <Ban className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingAction({ type: "delete", thread });
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left text-[14px] text-[#ff4b57] hover:bg-[#fff5f5]"
                          >
                            <span>Delete</span>
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex h-full min-h-0 flex-col">
            {selectedThread ? (
              <>
                <div className="flex items-center justify-between border-b border-[#E0E0E0] px-6 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={selectedThread.avatarUrl}
                      alt={selectedThread.fullName}
                      sizeClassName="h-[42px] w-[42px]"
                      iconClassName="h-4 w-4"
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(buildUserProfileHref(selectedThread.username))
                        }
                        className="text-left text-[18px] font-semibold tracking-[-0.03em] text-[#161823]"
                      >
                        {selectedThread.fullName}
                      </button>
                      <div className="text-[13px] text-[#6b7280]">{selectedThread.handle}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-2 text-[#161823] transition hover:bg-[#f5f5f5]"
                    aria-label="Más acciones"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
                  {loadingThread ? (
                    <div className="pb-4 text-center text-[14px] text-[#8b8b8b]">
                      Cargando conversación...
                    </div>
                  ) : null}
                  <div className="flex min-h-full w-full flex-col justify-end gap-4">
                    {selectedThread.messages.map((message, index) => {
                      const own = message.sender === "me";
                      const showDate =
                        index === 0 ||
                        selectedThread.messages[index - 1]?.createdAt !== message.createdAt;

                      return (
                        <div key={message.id}>
                          {showDate ? (
                            <div className="mb-3 text-center text-[11px] text-[#a1a1aa]">
                              {message.createdAt}
                            </div>
                          ) : null}

                          {message.kind === "system" ? (
                            <div className="flex items-center gap-2 text-[12px] text-[#5b5b5b]">
                              <span className="inline-flex h-4 w-4 items-center justify-center">
                                <img
                                  src="/tip-lightning.png"
                                  alt=""
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 object-contain"
                                />
                              </span>
                              <span>{message.body}</span>
                            </div>
                          ) : (
                            <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
                              {message.kind === "premium" ? (
                                <PremiumMessageCard
                                  message={message}
                                  own={own}
                                  confirmUnlock={confirmUnlockId === message.id}
                                  unlocking={unlockingMessageId === message.id}
                                  canDelete={own}
                                  menuOpen={messageMenuId === message.id}
                                  onToggleMenu={() =>
                                    setMessageMenuId((current) =>
                                      current === message.id ? null : message.id,
                                    )
                                  }
                                  onDelete={() => deleteMessage(message.id)}
                                  onStartUnlock={() => setConfirmUnlockId(message.id)}
                                  onUnlock={() => unlockPremiumMessage(message.id)}
                                  onCancelUnlock={() => setConfirmUnlockId(null)}
                                  onOpenPreview={(index) =>
                                    setOpenPreview({
                                      attachments: message.attachmentPreviews,
                                      index,
                                      unlocked: message.status === "purchased",
                                    })
                                  }
                                />
                              ) : message.kind === "attachment" ? (
                                <AttachmentMessageCard
                                  attachments={message.attachments}
                                  canDelete={own}
                                  menuOpen={messageMenuId === message.id}
                                  onToggleMenu={() =>
                                    setMessageMenuId((current) =>
                                      current === message.id ? null : message.id,
                                    )
                                  }
                                  onDelete={() => deleteMessage(message.id)}
                                  onOpenPreview={(index) =>
                                    setOpenPreview({
                                      attachments: message.attachments,
                                      index,
                                      unlocked: true,
                                    })
                                  }
                                />
                              ) : (
                                <div className="relative inline-block max-w-[430px]">
                                  {own ? (
                                    <div
                                      className="absolute right-1 top-1 z-10"
                                      data-message-menu-root="true"
                                      ref={messageMenuId === message.id ? menuRef : null}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMessageMenuId((current) =>
                                            current === message.id ? null : message.id,
                                          )
                                        }
                                        className="rounded-full p-1.5 text-[#6b7280] transition hover:bg-black/5 hover:text-[#161823]"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </button>
                                      {messageMenuId === message.id ? (
                                        <div className="absolute right-0 top-9 z-10 min-w-[140px] rounded-[10px] border border-zinc-200 bg-white p-1 shadow-lg">
                                          <button
                                            type="button"
                                            onClick={() => deleteMessage(message.id)}
                                            className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium text-red-600 transition hover:bg-red-50"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            Eliminar
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <div
                                    className={`inline-flex max-w-[430px] rounded-full px-4 py-2.5 font-semibold ${
                                      isEmojiOnlyMessage(message.body)
                                        ? "text-[30px] leading-none"
                                        : "text-[14px]"
                                    } ${
                                      own
                                        ? "bg-[#ede7ff] pr-10 text-[#3d3565]"
                                        : "bg-[#f3f3f3] text-[#2f2f2f]"
                                    }`}
                                  >
                                    {message.body}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[#E0E0E0] px-4 py-4 md:px-6">
                  <div className="relative flex w-full items-center gap-3 rounded-full bg-[#f5f5f5] px-4 py-3">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelected}
                    />
                    <input
                      ref={paidPhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePaidPhotoSelected}
                    />
                    <input
                      ref={paidVideoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handlePaidVideoSelected}
                    />
                    <input
                      ref={paidPackInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handlePaidPackSelected}
                    />
                    {canSendPremium ? (
                      <div className="relative shrink-0" ref={composeMenuRef}>
                        <button
                          type="button"
                          onClick={() => setComposeMenuOpen((current) => !current)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#161823] transition hover:bg-white"
                          aria-label="Abrir menú de contenido"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                        {composeMenuOpen ? (
                          <div className="absolute bottom-[calc(100%+14px)] left-0 z-20 w-[240px] rounded-[24px] border border-[#E0E0E0] bg-white p-2 shadow-[0_18px_35px_rgba(0,0,0,0.08)]">
                            {[
                              {
                                key: "photo" as const,
                                label: "Foto",
                                icon: <ImagePlus className="h-4 w-4 text-[#2563eb]" />,
                              },
                              {
                                key: "photo-paid" as const,
                                label: "Foto paga",
                                icon: <ImagePlus className="h-4 w-4 text-[#5A3EE7]" />,
                              },
                              {
                                key: "video-paid" as const,
                                label: "Video pago",
                                icon: <Video className="h-4 w-4 text-[#ef4444]" />,
                              },
                              {
                                key: "pack-paid" as const,
                                label: "Pack pago",
                                icon: <Package2 className="h-4 w-4 text-[#16a34a]" />,
                              },
                            ].map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => {
                                  setComposeMenuOpen(false);
                                  if (option.key === "photo") {
                                    photoInputRef.current?.click();
                                    return;
                                  }
                                  if (option.key === "photo-paid") {
                                    paidPhotoInputRef.current?.click();
                                    return;
                                  }
                                  if (option.key === "video-paid") {
                                    paidVideoInputRef.current?.click();
                                    return;
                                  }
                                  paidPackInputRef.current?.click();
                                }}
                                className="flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left text-[15px] font-medium text-[#161823] hover:bg-[#fafafa]"
                              >
                                <span className="inline-flex h-6 w-6 items-center justify-center">
                                  {option.icon}
                                </span>
                                <span>{option.label}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setTipOpen(true)}
                      disabled={!selectedThread || sendingMessage}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8b8b8b] transition hover:bg-white hover:text-[#161823] disabled:opacity-50"
                      aria-label="Enviar propina"
                    >
                      <img
                        src="/tip-lightning.png"
                        alt=""
                        aria-hidden="true"
                        className="h-4 w-4 object-contain"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmojiOpen((current) => !current)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8b8b8b] transition hover:bg-white hover:text-[#161823]"
                      aria-label="Abrir emojis"
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void appendTextMessage();
                        }
                      }}
                      placeholder="Envía un mensaje ..."
                      disabled={!selectedThread || sendingMessage}
                      className="w-full bg-transparent text-[14px] text-[#161823] outline-none placeholder:text-[#8b8b8b]"
                    />
                    <button
                      type="button"
                      onClick={() => void appendTextMessage()}
                      disabled={!selectedThread || sendingMessage}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5A3EE7] text-white disabled:opacity-50"
                      aria-label="Enviar"
                    >
                      <SendHorizontal className="h-4 w-4" />
                    </button>

                    {emojiOpen ? (
                      <div
                        ref={emojiRef}
                        className="absolute bottom-[calc(100%+14px)] left-0 z-20 w-[min(420px,calc(100vw-48px))] rounded-[24px] border border-[#E0E0E0] bg-white p-4 shadow-[0_18px_35px_rgba(0,0,0,0.08)]"
                      >
                        <div className="flex h-12 items-center rounded-full border border-[#E0E0E0] bg-[#f7f7f7] px-4">
                          <Search className="h-4 w-4 text-[#9ca3af]" />
                          <input
                            value={emojiQuery}
                            onChange={(event) => setEmojiQuery(event.target.value)}
                            placeholder="Buscar emojis"
                            className="w-full bg-transparent px-3 text-[14px] text-[#161823] outline-none placeholder:text-[#9ca3af]"
                          />
                        </div>
                        <div className="mt-5 text-[15px] font-semibold text-[#6b7280]">
                          Caras y personas
                        </div>
                        <div className="mt-4 grid grid-cols-7 gap-3">
                          {filteredEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setDraft((current) => `${current}${emoji}`);
                                setEmojiOpen(false);
                                setEmojiQuery("");
                              }}
                              className="flex h-11 w-11 items-center justify-center rounded-full text-[28px] transition hover:bg-[#f5f5f5]"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <div className="text-[22px] font-semibold text-[#161823]">
                    Elegí una conversación
                  </div>
                  <div className="mt-2 text-[15px] text-[#464646]">
                    Seleccioná un chat para empezar.
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
