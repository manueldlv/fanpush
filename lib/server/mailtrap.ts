const defaultMailtrapApiUrl = "https://send.api.mailtrap.io/api/send";

const readTrimmedEnv = (key: string) => {
  const value = process.env[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeMailtrapApiUrl = (value?: string) => {
  if (!value) {
    return defaultMailtrapApiUrl;
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("MAILTRAP_API_URL no es válida.");
  }

  if (!parsed.pathname || parsed.pathname === "/") {
    parsed.pathname = "/api/send";
  }

  return parsed.toString();
};

const mailtrapApiUrl = normalizeMailtrapApiUrl(readTrimmedEnv("MAILTRAP_API_URL"));
const mailtrapAccessToken = readTrimmedEnv("MAILTRAP_ACCESS_TOKEN");
const mailtrapSenderEmail =
  readTrimmedEnv("MAILTRAP_SENDER_EMAIL") || "hello@fanpush.app";
const mailtrapSenderName = readTrimmedEnv("MAILTRAP_SENDER_NAME") || "FanPush";

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

  let response: Response;
  try {
    response = await fetch(mailtrapApiUrl, {
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
  } catch {
    throw new Error(
      "No se pudo conectar con Mailtrap. Revisa MAILTRAP_API_URL y las credenciales configuradas.",
    );
  }

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
