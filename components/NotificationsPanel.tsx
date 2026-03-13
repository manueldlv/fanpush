"use client";

import { X } from "lucide-react";

type NotificationsPanelProps = {
  open: boolean;
  onClose: () => void;
};

const notifications = [
  {
    id: 1,
    section: "Este mes",
    items: [
      {
        id: "social-like",
        avatar: "https://picsum.photos/seed/notif-like/64/64",
        text: "maria.soria le gusto tu publicacion.",
        date: "03 mar",
        action: "",
      },
    ],
  },
  {
    id: 2,
    section: "Seguidores",
    items: [
      {
        id: "follow",
        avatar: "https://picsum.photos/seed/notif-follow/64/64",
        text: "alejandro.v comenzó a seguirte.",
        date: "02 mar",
        action: "Seguir tambien",
      },
      {
        id: "follow-multi",
        avatar: "https://picsum.photos/seed/notif-follow-multi/64/64",
        text: "luli y otros 3 comenzaron a seguirte.",
        date: "01 mar",
        action: "Seguir tambien",
      },
      {
        id: "follow-bell",
        avatar: "https://picsum.photos/seed/notif-bell/64/64",
        text: "fede.cl activó notificaciones de tu perfil.",
        date: "28 feb",
        action: "",
      },
    ],
  },
  {
    id: 3,
    section: "Ventas",
    items: [
      {
        id: "buy-photo",
        avatar: "https://picsum.photos/seed/notif-buy-photo/64/64",
        text: "roma.ux compró tu foto.",
        date: "27 feb",
        action: "Ver venta",
      },
      {
        id: "buy-video",
        avatar: "https://picsum.photos/seed/notif-buy-video/64/64",
        text: "noah.d compró tu video.",
        date: "26 feb",
        action: "Ver venta",
      },
      {
        id: "buy-pack",
        avatar: "https://picsum.photos/seed/notif-buy-pack/64/64",
        text: "lucas_m compró tu pack de contenido.",
        date: "25 feb",
        action: "Ver venta",
      },
    ],
  },
  {
    id: 4,
    section: "Suscripciones",
    items: [
      {
        id: "sub-new",
        avatar: "https://picsum.photos/seed/notif-sub-new/64/64",
        text: "jaz.min se suscribió a tu perfil.",
        date: "23 feb",
        action: "Ver suscripcion",
      },
      {
        id: "sub-renew",
        avatar: "https://picsum.photos/seed/notif-sub-renew/64/64",
        text: "tomi.p renovó su suscripción.",
        date: "22 feb",
        action: "",
      },
      {
        id: "sub-cancel",
        avatar: "https://picsum.photos/seed/notif-sub-cancel/64/64",
        text: "mica.rios canceló su suscripción.",
        date: "21 feb",
        action: "",
      },
    ],
  },
  {
    id: 5,
    section: "Propinas",
    items: [
      {
        id: "tip",
        avatar: "https://picsum.photos/seed/notif-tip/64/64",
        text: "fer.b te envio una propina.",
        date: "20 feb",
        action: "",
      },
      {
        id: "super-tip",
        avatar: "https://picsum.photos/seed/notif-super-tip/64/64",
        text: "martu.w te envio una super propina.",
        date: "19 feb",
        action: "",
      },
    ],
  },
  {
    id: 6,
    section: "Compras",
    items: [
      {
        id: "unlock-photo",
        avatar: "https://picsum.photos/seed/notif-unlock-photo/64/64",
        text: "Desbloqueaste una foto.",
        date: "18 feb",
        action: "",
      },
      {
        id: "unlock-video",
        avatar: "https://picsum.photos/seed/notif-unlock-video/64/64",
        text: "Desbloqueaste un video.",
        date: "18 feb",
        action: "",
      },
      {
        id: "unlock-pack",
        avatar: "https://picsum.photos/seed/notif-unlock-pack/64/64",
        text: "Desbloqueaste un pack.",
        date: "17 feb",
        action: "",
      },
      {
        id: "purchase-ok",
        avatar: "https://picsum.photos/seed/notif-purchase-ok/64/64",
        text: "Compra realizada con exito.",
        date: "17 feb",
        action: "",
      },
      {
        id: "content-available",
        avatar: "https://picsum.photos/seed/notif-content/64/64",
        text: "Tu contenido desbloqueado esta disponible.",
        date: "16 feb",
        action: "",
      },
      {
        id: "album-new",
        avatar: "https://picsum.photos/seed/notif-album/64/64",
        text: "Se agrego contenido nuevo al album que compraste.",
        date: "16 feb",
        action: "",
      },
    ],
  },
  {
    id: 7,
    section: "Actividad",
    items: [
      {
        id: "views",
        avatar: "https://picsum.photos/seed/notif-views/64/64",
        text: "Tu publicacion esta recibiendo muchas visitas.",
        date: "15 feb",
        action: "Ver",
      },
      {
        id: "trending",
        avatar: "https://picsum.photos/seed/notif-trending/64/64",
        text: "Tu publicacion es tendencia.",
        date: "14 feb",
        action: "",
      },
      {
        id: "featured",
        avatar: "https://picsum.photos/seed/notif-featured/64/64",
        text: "Tu publicacion fue destacada.",
        date: "14 feb",
        action: "",
      },
      {
        id: "new-post",
        avatar: "https://picsum.photos/seed/notif-new-post/64/64",
        text: "caro.g subio una nueva publicacion.",
        date: "13 feb",
        action: "",
      },
    ],
  },
  {
    id: 8,
    section: "Sistema",
    items: [
      {
        id: "withdraw",
        avatar: "https://picsum.photos/seed/notif-withdraw/64/64",
        text: "Tu retiro fue procesado.",
        date: "12 feb",
        action: "",
      },
      {
        id: "payment-issue",
        avatar: "https://picsum.photos/seed/notif-issue/64/64",
        text: "Hubo un problema con un pago.",
        date: "11 feb",
        action: "",
      },
      {
        id: "payment",
        avatar: "https://picsum.photos/seed/notif-payment/64/64",
        text: "Recibiste un pago.",
        date: "10 feb",
        action: "",
      },
      {
        id: "earnings",
        avatar: "https://picsum.photos/seed/notif-earnings/64/64",
        text: "Tus ganancias de hoy estan disponibles.",
        date: "09 feb",
        action: "",
      },
    ],
  },
];

export default function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  return (
    <>
      {open ? (
        <button
          type="button"
          onClick={onClose}
        className="fixed inset-0 z-30 h-full w-full cursor-default bg-black/10"
          aria-label="Cerrar notificaciones"
        />
      ) : null}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-[420px] border-r border-zinc-200 bg-white shadow-xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col px-6 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-zinc-900">Notificaciones</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[5px] p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Cerrar notificaciones"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 flex-1 overflow-y-auto space-y-8">
            {notifications.map((section) => (
              <div key={section.id}>
                <h3 className="text-sm font-semibold text-zinc-900">
                  {section.section}
                </h3>
                <div className="mt-3 space-y-3">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-[5px] bg-zinc-50 px-3 py-3"
                    >
                      <img
                        src={item.avatar}
                        alt="avatar"
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div className="flex-1 text-sm text-zinc-700">
                        <div className="font-medium text-zinc-900">
                          {item.text}
                        </div>
                        <div className="text-xs text-zinc-400">{item.date}</div>
                      </div>
                      {item.action ? (
                        <button className="rounded-[5px] bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                          {item.action}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
