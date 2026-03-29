const defaultMailtrapApiUrl = "https://send.api.mailtrap.io/api/send";

const mailtrapApiUrl = process.env.MAILTRAP_API_URL || defaultMailtrapApiUrl;
const mailtrapAccessToken = process.env.MAILTRAP_ACCESS_TOKEN;
const mailtrapSenderEmail =
  process.env.MAILTRAP_SENDER_EMAIL || "hello@fanpush.app";
const mailtrapSenderName = process.env.MAILTRAP_SENDER_NAME || "FanPush";

type SendMailtrapEmailArgs = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  category?: string;
};

export const sendMailtrapEmail = async ({
  to,
  subject,
  text,
  html,
  category,
}: SendMailtrapEmailArgs) => {
  if (!mailtrapAccessToken) {
    throw new Error("Falta configurar MAILTRAP_ACCESS_TOKEN.");
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

  if (recipients.length === 0) {
    throw new Error("Falta al menos un destinatario para enviar el email.");
  }

  const response = await fetch(mailtrapApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mailtrapAccessToken}`,
      "Api-Token": mailtrapAccessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: {
        email: mailtrapSenderEmail,
        name: mailtrapSenderName,
      },
      to: recipients,
      subject,
      text,
      ...(html ? { html } : {}),
      ...(category ? { category } : {}),
    }),
    cache: "no-store",
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      json &&
      typeof json === "object" &&
      "message" in json &&
      typeof json.message === "string"
        ? json.message
        : `Mailtrap devolvió ${response.status}.`;

    throw new Error(message);
  }

  return json;
};
