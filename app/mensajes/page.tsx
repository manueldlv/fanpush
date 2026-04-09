"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  ImagePlus,
  Mail,
  MoreHorizontal,
  Paperclip,
  Pin,
  PinOff,
  Search,
  SendHorizontal,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import {
  loadBlockedChatUsers,
  saveBlockedChatUsers,
  type BlockedChatUser,
} from "@/lib/chatPreferences";
import { useGetViewerQuery } from "@/lib/redux/api/sessionApi";
import { buildUserProfileHref } from "@/lib/profileRoute";

type AttachmentPreview = {
  id: string;
  name: string;
  kind: "foto" | "video";
  previewUrl: string;
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

type ThreadItem = {
  id: string;
  username: string;
  fullName: string;
  handle: string;
  preview: string;
  avatarUrl: string | null;
  participantIsAuthor: boolean;
  lastSeen: string;
  unread?: boolean;
  pinned?: boolean;
  messages: MessageItem[];
};

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

const buildStarterThreads = (prefillUsername: string | null): ThreadItem[] => {
  const base: ThreadItem[] = [
    {
      id: "yoga-con-mari",
      username: "mariela.guzman",
      fullName: "Mariela Guzmán",
      handle: "yogaconmari",
      avatarUrl: buildPlaceholderPreview("M", "#f59e0b"),
      participantIsAuthor: true,
      preview: "Dale ahi te mando.",
      lastSeen: "15 min",
      unread: false,
      pinned: false,
      messages: [
        {
          id: "t-1",
          kind: "text",
          sender: "me",
          body: "Hola",
          createdAt: "06/04/2026 16:45",
        },
        {
          id: "t-2",
          kind: "text",
          sender: "me",
          body: "Haces tutoriales personalizados?",
          createdAt: "06/04/2026 16:45",
        },
        {
          id: "t-3",
          kind: "text",
          sender: "them",
          body: "Hola, sí claro! Enviame los detalles!",
          createdAt: "06/04/2026 16:46",
        },
        {
          id: "t-4",
          kind: "text",
          sender: "me",
          body: "Mandame algo custom para ver, pone tu precio",
          createdAt: "06/04/2026 16:47",
        },
        {
          id: "t-5",
          kind: "text",
          sender: "them",
          body: "Dale ahi te mando.",
          createdAt: "06/04/2026 16:48",
        },
        {
          id: "t-6",
          kind: "premium",
          sender: "them",
          title: "Mariela Guzmán te envió contenido privado",
          caption: "1 video",
          price: 5500,
          attachmentCount: 6,
          attachmentPreviews: [
            {
              id: "pv1",
              name: "vista-1.jpg",
              kind: "foto",
              previewUrl: buildPlaceholderPreview("Vista previa", "#b45309"),
            },
            {
              id: "pv2",
              name: "vista-2.jpg",
              kind: "foto",
              previewUrl: buildPlaceholderPreview("Vista previa", "#7c3aed"),
            },
            {
              id: "pv3",
              name: "vista-3.jpg",
              kind: "foto",
              previewUrl: buildPlaceholderPreview("Vista previa", "#f97316"),
            },
            {
              id: "pv4",
              name: "vista-4.jpg",
              kind: "foto",
              previewUrl: buildPlaceholderPreview("Vista previa", "#e11d48"),
            },
            {
              id: "pv5",
              name: "vista-5.jpg",
              kind: "foto",
              previewUrl: buildPlaceholderPreview("Vista previa", "#0ea5e9"),
            },
            {
              id: "pv6",
              name: "vista-6.mp4",
              kind: "video",
              previewUrl: buildPlaceholderPreview("Vista previa", "#22c55e"),
            },
          ],
          status: "locked",
          createdAt: "Hoy 17:50",
        },
        {
          id: "t-7",
          kind: "system",
          sender: "system",
          body: "seed_author compró el contenido que le enviaste por $5500. Vas a ver el saldo reflejado en tus ventas",
          createdAt: "Hoy 17:51",
        },
        {
          id: "t-8",
          kind: "text",
          sender: "me",
          body: "Buenisimo, ahi te lo compré, gracias!",
          createdAt: "Hoy 17:52",
        },
        {
          id: "t-9",
          kind: "text",
          sender: "them",
          body: "de nada, gracias a vos!",
          createdAt: "Hoy 17:53",
        },
      ],
    },
    {
      id: "bebu",
      username: "bebu",
      fullName: "Bebu",
      handle: "bebukun",
      avatarUrl: null,
      participantIsAuthor: false,
      preview: "Tú · Hola como estas?",
      lastSeen: "15 min",
      unread: false,
      pinned: false,
      messages: [
        {
          id: "b1",
          kind: "text",
          sender: "them",
          body: "Hola como estas?",
          createdAt: "Hoy 14:05",
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
      preview: "Tú · Hola como estas?",
      lastSeen: "15 min",
      unread: false,
      pinned: false,
      messages: [],
    },
    {
      id: "max",
      username: "max",
      fullName: "Max",
      handle: "max.crea",
      avatarUrl: null,
      participantIsAuthor: false,
      preview: "Tú · Hola como estas?",
      lastSeen: "15 min",
      unread: false,
      pinned: false,
      messages: [],
    },
    {
      id: "pedro",
      username: "pedro",
      fullName: "Pedro",
      handle: "pedrito",
      avatarUrl: null,
      participantIsAuthor: false,
      preview: "Tú · Hola como estas?",
      lastSeen: "15 min",
      unread: false,
      pinned: false,
      messages: [],
    },
    {
      id: "jose",
      username: "jose",
      fullName: "Jose",
      handle: "jose84",
      avatarUrl: null,
      participantIsAuthor: false,
      preview: "Tú · Hola como estas?",
      lastSeen: "15 min",
      unread: false,
      pinned: false,
      messages: [],
    },
    {
      id: "joel",
      username: "joel",
      fullName: "Joel",
      handle: "joel.zen",
      avatarUrl: null,
      participantIsAuthor: false,
      preview: "Tú · Hola como estas?",
      lastSeen: "15 min",
      unread: false,
      pinned: false,
      messages: [],
    },
    {
      id: "random",
      username: "nombre-random",
      fullName: "Nombre Random",
      handle: "rand",
      avatarUrl: null,
      participantIsAuthor: false,
      preview: "Tú · Hola como estas?",
      lastSeen: "15 min",
      unread: false,
      pinned: false,
      messages: [],
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
      preview: "Tú · Iniciá la conversación",
      lastSeen: "Ahora",
      unread: false,
      pinned: false,
      messages: [],
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
    attachmentCount: number;
    attachmentPreviews: AttachmentPreview[];
  }) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [price, setPrice] = useState("5500");
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);

  useEffect(() => {
    return () => {
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    };
  }, [attachments]);

  const resetComposer = () => {
    attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    setAttachments([]);
    setTitle("");
    setCaption("");
    setPrice("5500");
  };

  const handleClose = () => {
    resetComposer();
    onClose();
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

  const canSend = attachments.length > 0 && Number(price || 0) > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-[620px] rounded-[5px] border border-[#E0E0E0] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-[#161823]">
              Enviar contenido al usuario
            </h2>
            <p className="mt-2 max-w-[460px] text-[15px] leading-6 text-[#464646]">
              Esta parte la vamos a retocar después con el uploader nuevo. Por ahora
              ya podés armar la oferta desde el chat.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-[5px] border border-[#E0E0E0] bg-[#FAFAFA] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[16px] font-semibold text-[#161823]">
                  Adjuntar archivos
                </div>
                <div className="mt-1 text-[14px] text-[#464646]">
                  Fotos, videos o mezcla para vender por privado.
                </div>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-[5px] bg-[#161823] px-4 py-2 text-[14px] font-semibold text-white"
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
              <div className="mt-4 grid grid-cols-4 gap-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="relative overflow-hidden rounded-[5px] border border-[#E0E0E0] bg-white"
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
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[5px] border border-dashed border-[#E0E0E0] bg-white px-4 py-4 text-[14px] text-[#6b7280]">
                Todavía no elegiste archivos.
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título de la oferta"
              className="h-12 rounded-[5px] border border-[#E0E0E0] px-4 text-[15px] outline-none placeholder:text-zinc-400"
            />
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={3}
              placeholder="Descripción"
              className="rounded-[5px] border border-[#E0E0E0] px-4 py-3 text-[15px] outline-none placeholder:text-zinc-400"
            />
            <div className="flex h-12 items-center gap-3 rounded-[5px] border border-[#E0E0E0] px-4">
              <span className="text-[18px] text-[#5A3EE7]">⚡</span>
              <input
                value={price}
                onChange={(event) =>
                  setPrice(event.target.value.replace(/[^\d]/g, "").slice(0, 9))
                }
                inputMode="numeric"
                placeholder="Precio"
                className="w-full bg-transparent text-[16px] font-semibold outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-[5px] border border-[#E0E0E0] px-4 py-2.5 text-[15px] font-semibold text-[#464646]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => {
              onSend({
                title: title.trim() || "Contenido privado",
                caption: caption.trim() || "Contenido enviado por este chat.",
                price: Number(price || 0),
                attachmentCount: attachments.length,
                attachmentPreviews: attachments.map((attachment) => ({ ...attachment })),
              });
              handleClose();
            }}
            className="rounded-[5px] bg-[#161823] px-4 py-2.5 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Enviar al chat
          </button>
        </div>
      </div>
    </div>
  );
}

function PremiumMessageCard({
  message,
  own,
  confirmUnlock,
  onStartUnlock,
  onUnlock,
  onCancelUnlock,
}: {
  message: PremiumMessageItem;
  own: boolean;
  confirmUnlock: boolean;
  onStartUnlock: () => void;
  onUnlock: () => void;
  onCancelUnlock: () => void;
}) {
  const visibleItems = message.attachmentPreviews.slice(0, 6);
  const canSeeContent = own || message.status === "purchased";

  return (
    <div className="w-full max-w-[345px] rounded-[5px] bg-[#f3f3f3] p-4 text-left text-[#161823]">
      <div className="text-[15px] font-semibold tracking-[-0.02em]">
        {message.title}
      </div>
      <div className="mt-1 text-[12px] text-[#6b7280]">{message.caption}</div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {visibleItems.map((attachment, index) => (
          <div
            key={attachment.id}
            className="relative overflow-hidden rounded-[5px] bg-white"
          >
            {attachment.kind === "video" ? (
              <video
                src={attachment.previewUrl}
                className={`aspect-square h-full w-full object-cover ${
                  canSeeContent ? "" : "scale-105 blur-[8px]"
                }`}
                muted
              />
            ) : (
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className={`aspect-square h-full w-full object-cover ${
                  canSeeContent ? "" : "scale-105 blur-[8px]"
                }`}
              />
            )}
            {!canSeeContent && index < 5 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/15 text-[10px] font-semibold text-white">
                Vista Previa
              </div>
            ) : null}
            {!canSeeContent && index === 5 && message.attachmentPreviews.length > 6 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-[14px] font-semibold text-white">
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
            Confirmá si querés desbloquear este contenido.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancelUnlock}
              className="rounded-[5px] border border-[#E0E0E0] bg-white px-3 py-2 text-[13px] font-semibold text-[#464646]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onUnlock}
              className="rounded-[5px] bg-[#5A3EE7] px-3 py-2 text-[13px] font-semibold text-white"
            >
              Confirmar por ${formatUnits(message.price)}
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

export default function MensajesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const emojiRef = useRef<HTMLDivElement | null>(null);
  const { data: viewer } = useGetViewerQuery();
  const prefillUsername = searchParams.get("user");

  const [threads, setThreads] = useState<ThreadItem[]>(() =>
    buildStarterThreads(prefillUsername),
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string>(
    () => buildStarterThreads(prefillUsername)[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [emojiQuery, setEmojiQuery] = useState("");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [confirmUnlockId, setConfirmUnlockId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "delete" | "block";
    thread: ThreadItem;
  } | null>(null);
  const canSendPremium = Boolean(viewer?.access.canCreate);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visibleThreads = threads
      .filter((thread) => !thread.messages.some((message) => message.kind === "system" && false))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
    if (!term) return visibleThreads;
    return visibleThreads.filter(
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

  useEffect(() => {
    if (!selectedThread && filteredThreads[0]) {
      setSelectedThreadId(filteredThreads[0].id);
    }
  }, [filteredThreads, selectedThread]);

  const appendTextMessage = () => {
    const body = draft.trim();
    if (!body || !selectedThread) return;

    setThreads((current) =>
      current.map((thread) =>
        thread.id !== selectedThread.id
          ? thread
          : {
              ...thread,
              preview: `Tú · ${body}`,
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

  const threadMenuActions = {
    togglePinned: (threadId: string) => {
      setThreads((current) =>
        current.map((thread) =>
          thread.id === threadId ? { ...thread, pinned: !thread.pinned } : thread,
        ),
      );
      setOpenMenuId(null);
    },
    toggleUnread: (threadId: string) => {
      setThreads((current) =>
        current.map((thread) =>
          thread.id === threadId ? { ...thread, unread: !thread.unread } : thread,
        ),
      );
      setOpenMenuId(null);
    },
    deleteThread: (threadId: string) => {
      setThreads((current) => current.filter((thread) => thread.id !== threadId));
      if (selectedThreadId === threadId) {
        const next = threads.find((thread) => thread.id !== threadId);
        setSelectedThreadId(next?.id ?? "");
      }
      setOpenMenuId(null);
    },
    blockThread: (thread: ThreadItem) => {
      const currentBlocked = loadBlockedChatUsers();
      const nextBlocked: BlockedChatUser[] = currentBlocked.some(
        (item) => item.id === thread.id,
      )
        ? currentBlocked
        : [
            ...currentBlocked,
            {
              id: thread.id,
              username: thread.username,
              fullName: thread.fullName,
              avatarUrl: thread.avatarUrl,
              blockedAt: new Date().toISOString(),
            },
          ];
      saveBlockedChatUsers(nextBlocked);
      setThreads((current) => current.filter((item) => item.id !== thread.id));
      if (selectedThreadId === thread.id) {
        const next = threads.find((item) => item.id !== thread.id);
        setSelectedThreadId(next?.id ?? "");
      }
      setOpenMenuId(null);
    },
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
    setConfirmUnlockId(null);
  };

  useEffect(() => {
    const blocked = loadBlockedChatUsers();
    if (blocked.length === 0) return;
    setThreads((current) =>
      current.filter((thread) => !blocked.some((item) => item.id === thread.id)),
    );
  }, []);

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

  const filteredEmojis = EMOJI_OPTIONS.filter((emoji) =>
    emojiQuery.trim() ? emoji.includes(emojiQuery.trim()) : true,
  );

  return (
    <div className="h-screen overflow-hidden bg-[#FAFAFA] text-[#161823]">
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
                    preview: `${payload.title} · $${formatUnits(payload.price)}`,
                    messages: [
                      ...thread.messages,
                      {
                        id: `${thread.id}-${Date.now()}`,
                        kind: "premium",
                        sender: "me",
                        title: payload.title,
                        caption: `${payload.attachmentCount} archivo${payload.attachmentCount === 1 ? "" : "s"}`,
                        price: payload.price,
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

      <main className="h-[calc(100dvh-64px)] w-full overflow-hidden md:pl-[240px]">
        <div className="grid h-full grid-cols-1 border-r border-[#E0E0E0] bg-white md:grid-cols-[420px_minmax(0,1fr)]">
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

            <div className="flex flex-col pb-5">
              {filteredThreads.map((thread) => {
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

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
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
                              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1fb84f] text-[10px] font-bold text-white">
                                ✓
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
                                  onStartUnlock={() => setConfirmUnlockId(message.id)}
                                  onUnlock={() => unlockPremiumMessage(message.id)}
                                  onCancelUnlock={() => setConfirmUnlockId(null)}
                                />
                              ) : (
                                <div
                                  className={`max-w-[430px] rounded-full px-4 py-2.5 ${
                                    isEmojiOnlyMessage(message.body)
                                      ? "text-[30px] leading-none"
                                      : "text-[14px]"
                                  } ${
                                    own
                                      ? "bg-[#ede7ff] text-[#3d3565]"
                                      : "bg-[#f3f3f3] text-[#2f2f2f]"
                                  }`}
                                >
                                  {message.body}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[#E0E0E0] px-6 py-4">
                  <div className="relative flex w-full items-center gap-3 rounded-full bg-[#f5f5f5] px-4 py-3">
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
                          appendTextMessage();
                        }
                      }}
                      placeholder="Envía un mensaje ..."
                      className="w-full bg-transparent text-[14px] text-[#161823] outline-none placeholder:text-[#8b8b8b]"
                    />
                    {canSendPremium ? (
                      <button
                        type="button"
                        onClick={() => setPremiumOpen(true)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-[5px] bg-[#161823] px-3 py-2 text-[12px] font-semibold text-white"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        Enviar contenido al usuario
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={appendTextMessage}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5A3EE7] text-white"
                      aria-label="Enviar"
                    >
                      <SendHorizontal className="h-4 w-4" />
                    </button>

                    {emojiOpen ? (
                      <div
                        ref={emojiRef}
                        className="absolute bottom-[calc(100%+14px)] left-0 z-20 w-[420px] rounded-[24px] border border-[#E0E0E0] bg-white p-4 shadow-[0_18px_35px_rgba(0,0,0,0.08)]"
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
                        <div className="mt-4 flex items-center justify-between border-t border-[#E0E0E0] px-1 pt-3 text-[#8b8b8b]">
                          <Smile className="h-5 w-5 text-[#161823]" />
                          <span className="text-[20px]">🐾</span>
                          <span className="text-[20px]">🍴</span>
                          <span className="text-[20px]">🏀</span>
                          <span className="text-[20px]">🚗</span>
                          <span className="text-[20px]">💡</span>
                          <span className="text-[20px]">➕</span>
                          <span className="text-[20px]">🏳️</span>
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
