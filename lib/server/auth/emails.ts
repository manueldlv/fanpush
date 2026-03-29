import { sendMailtrapEmail } from "@/lib/server/mailtrap";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildEmailHtml = ({
  title,
  intro,
  actionLabel,
  actionUrl,
  note,
}: {
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  note: string;
}) => `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif;color:#18181b;">
    <div style="margin:0 auto;max-width:560px;padding:32px 16px;">
      <div style="border:1px solid #e4e4e7;border-radius:20px;background:#ffffff;padding:32px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">FanPush</div>
        <h1 style="margin:16px 0 12px;font-size:28px;line-height:1.2;color:#18181b;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">${escapeHtml(intro)}</p>
        <a href="${escapeHtml(actionUrl)}" style="display:inline-block;border-radius:999px;background:#2563eb;color:#ffffff;padding:14px 22px;font-size:15px;font-weight:700;text-decoration:none;">
          ${escapeHtml(actionLabel)}
        </a>
        <p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:#71717a;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </p>
        <p style="margin:0 0 24px;word-break:break-all;font-size:13px;line-height:1.6;color:#2563eb;">
          ${escapeHtml(actionUrl)}
        </p>
        <p style="margin:0;font-size:13px;line-height:1.7;color:#71717a;">${escapeHtml(note)}</p>
      </div>
    </div>
  </body>
</html>`;

const buildEmailText = ({
  title,
  intro,
  actionLabel,
  actionUrl,
  note,
}: {
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  note: string;
}) => `${title}

${intro}

${actionLabel}: ${actionUrl}

${note}`;

export const sendSignupConfirmationEmail = async ({
  to,
  confirmationUrl,
}: {
  to: string;
  confirmationUrl: string;
}) => {
  const title = "Confirma tu cuenta en FanPush";
  const intro =
    "Para activar tu cuenta y poder iniciar sesión, confirma tu correo con el siguiente enlace.";
  const note =
    "Si no creaste esta cuenta, puedes ignorar este mensaje.";

  await sendMailtrapEmail({
    to,
    subject: title,
    text: buildEmailText({
      title,
      intro,
      actionLabel: "Confirmar cuenta",
      actionUrl: confirmationUrl,
      note,
    }),
    html: buildEmailHtml({
      title,
      intro,
      actionLabel: "Confirmar cuenta",
      actionUrl: confirmationUrl,
      note,
    }),
    category: "auth-signup",
  });
};

export const sendPasswordRecoveryEmail = async ({
  to,
  recoveryUrl,
}: {
  to: string;
  recoveryUrl: string;
}) => {
  const title = "Restablece tu contraseña";
  const intro =
    "Recibimos una solicitud para cambiar tu contraseña. Usa el siguiente enlace para continuar.";
  const note =
    "Si no pediste este cambio, ignora este correo y tu contraseña actual seguirá funcionando.";

  await sendMailtrapEmail({
    to,
    subject: title,
    text: buildEmailText({
      title,
      intro,
      actionLabel: "Cambiar contraseña",
      actionUrl: recoveryUrl,
      note,
    }),
    html: buildEmailHtml({
      title,
      intro,
      actionLabel: "Cambiar contraseña",
      actionUrl: recoveryUrl,
      note,
    }),
    category: "auth-recovery",
  });
};
