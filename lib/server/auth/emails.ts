import { sendMailtrapEmail } from "@/lib/server/mailtrap";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildEmailHtml = ({
  eyebrow,
  title,
  intro,
  actionLabel,
  actionUrl,
  note,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  note: string;
}) => `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#18181b;">
    <div style="margin:0 auto;max-width:620px;padding:28px 16px 40px;">
      <div style="margin-bottom:16px;text-align:center;font-size:12px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#71717a;">
        FanPush
      </div>
      <div style="overflow:hidden;border:1px solid #e4e4e7;border-radius:28px;background:#ffffff;box-shadow:0 20px 45px rgba(15,23,42,0.08);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#18181b 0%,#2563eb 62%,#ec4899 100%);color:#ffffff;">
          <div style="display:inline-block;border-radius:999px;background:rgba(255,255,255,0.14);padding:8px 12px;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">
            ${escapeHtml(eyebrow)}
          </div>
          <h1 style="margin:18px 0 10px;font-size:34px;line-height:1.12;font-weight:800;color:#ffffff;">
            ${escapeHtml(title)}
          </h1>
          <p style="margin:0;max-width:440px;font-size:16px;line-height:1.7;color:rgba(255,255,255,0.9);">
            ${escapeHtml(intro)}
          </p>
        </div>
        <div style="padding:30px 32px 32px;">
          <div style="border:1px solid #e4e4e7;border-radius:22px;background:#fafafa;padding:22px;">
            <div style="font-size:13px;line-height:1.7;color:#52525b;">
              Este enlace abre FanPush de forma segura y está asociado a tu cuenta.
            </div>
            <a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:18px;border-radius:16px;background:#18181b;color:#ffffff;padding:15px 22px;font-size:15px;font-weight:700;text-decoration:none;">
              ${escapeHtml(actionLabel)}
            </a>
          </div>
          <div style="margin-top:20px;border-radius:18px;background:#eff6ff;padding:16px 18px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#2563eb;">
              Seguridad
            </div>
            <p style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#334155;">
              Si el botón no funciona, copia y pega este enlace en tu navegador.
            </p>
            <p style="margin:12px 0 0;word-break:break-all;font-size:13px;line-height:1.7;color:#1d4ed8;">
              ${escapeHtml(actionUrl)}
            </p>
          </div>
          <p style="margin:22px 0 0;font-size:13px;line-height:1.8;color:#71717a;">
            ${escapeHtml(note)}
          </p>
        </div>
      </div>
      <div style="margin-top:16px;text-align:center;font-size:12px;line-height:1.7;color:#a1a1aa;">
        FanPush · hello@fanpush.app
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

${note}

FanPush · hello@fanpush.app`;

export const sendSignupConfirmationEmail = async ({
  to,
  confirmationUrl,
}: {
  to: string;
  confirmationUrl: string;
}) => {
  const title = "Confirma tu cuenta en FanPush";
  const intro =
    "Activa tu cuenta para iniciar sesión, desbloquear contenido y completar tu perfil.";
  const note =
    "Si no creaste esta cuenta, puedes ignorar este mensaje sin hacer nada.";

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
      eyebrow: "Activación de cuenta",
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
    "Recibimos una solicitud para cambiar tu contraseña. Usa este acceso seguro para continuar.";
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
      eyebrow: "Recuperación de acceso",
      title,
      intro,
      actionLabel: "Cambiar contraseña",
      actionUrl: recoveryUrl,
      note,
    }),
    category: "auth-recovery",
  });
};
