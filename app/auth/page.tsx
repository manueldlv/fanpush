"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient, getSupabaseSessionSafely } from "@/lib/supabase";
import Image from "next/image";
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import {
  useRegisterMutation,
  useRequestPasswordRecoveryMutation,
  useResendConfirmationMutation,
  useUpdateCurrentPasswordMutation,
} from "@/lib/redux/api/authApi";
import {
  clearPendingCheckout,
  readPendingCheckout,
} from "@/lib/auth";

const JUST_SIGNED_IN_KEY = "fanpush_just_signed_in";

const isRecoveryUrl = () => {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes("type=recovery") || search.includes("reset=1")
  );
};

const normalizeEmail = (value: string) =>
  value.replace(/\s+/g, "").toLowerCase();

const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");

const formatAuthErrorMessage = (value: unknown) => {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "Ocurrió un error.";

  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "Tu correo todavía no fue confirmado. Revisa tu bandeja de entrada y spam antes de iniciar sesión.";
  }
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password")
  ) {
    return "Correo o contraseña incorrectos.";
  }
  if (
    normalized.includes("already registered") ||
    normalized.includes("already been registered")
  ) {
    return "Ya existe una cuenta con ese correo.";
  }
  if (normalized.includes("signup is disabled")) {
    return "El registro por correo no está habilitado en este momento.";
  }
  if (
    normalized.includes("mailtrap") ||
    normalized.includes("correo de confirmación") ||
    normalized.includes("no se pudo conectar")
  ) {
    return "No pudimos enviarte el correo en este momento. Intenta de nuevo en unos minutos.";
  }
  if (normalized.includes("failed to fetch")) {
    return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo otra vez.";
  }

  return message;
};

const hasPasswordLetter = (value: string) => /[a-z]/i.test(value);
const hasPasswordNumber = (value: string) => /\d/.test(value);

const getPasswordValidationError = ({
  value,
  confirmation,
}: {
  value: string;
  confirmation?: string;
}) => {
  if (value.length < 6) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (!hasPasswordLetter(value)) {
    return "La contraseña debe incluir al menos una letra.";
  }
  if (!hasPasswordNumber(value)) {
    return "La contraseña debe incluir al menos un número.";
  }
  if (confirmation !== undefined && value !== confirmation) {
    return "Las contraseñas no coinciden.";
  }
  return null;
};

const getPasswordChecks = ({
  value,
  confirmation,
}: {
  value: string;
  confirmation?: string;
}) => [
  {
    label: "Al menos 6 caracteres",
    passed: value.length >= 6,
  },
  {
    label: "Al menos una letra",
    passed: hasPasswordLetter(value),
  },
  {
    label: "Al menos un número",
    passed: hasPasswordNumber(value),
  },
  ...(confirmation !== undefined
    ? [
        {
          label: "Las contraseñas coinciden",
          passed: confirmation.length > 0 && value === confirmation,
        },
      ]
    : []),
];

function PasswordChecklist({
  title,
  checks,
}: {
  title: string;
  checks: Array<{ label: string; passed: boolean }>;
}) {
  return (
    <div className="rounded-[14px] border border-zinc-200 bg-zinc-50 px-4 py-3">
      <div className="text-xs font-medium text-zinc-500">
        {title}
      </div>
      <div className="mt-3 space-y-2">
        {checks.map((check) => (
          <div
            key={check.label}
            className={`flex items-center gap-2 text-xs ${
              check.passed ? "text-emerald-700" : "text-zinc-500"
            }`}
          >
            {check.passed ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-zinc-300" />
            )}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PasswordField({
  value,
  placeholder,
  visible,
  onChange,
  onToggle,
}: {
  value: string;
  placeholder: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[52px] w-full rounded-[14px] border border-zinc-200 px-4 py-3 pr-12 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-0 flex h-[52px] items-center justify-center text-zinc-400 transition hover:text-zinc-700"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [forgot, setForgot] = useState(false);
  const [reset, setReset] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [requestPasswordRecovery] = useRequestPasswordRecoveryMutation();
  const [registerUser] = useRegisterMutation();
  const [resendConfirmation] = useResendConfirmationMutation();
  const [updateCurrentPassword] = useUpdateCurrentPasswordMutation();

  const showRegisterFields = mode === "register" && !forgot && !reset;
  const showLoginPasswordField = !forgot && !reset;
  const registerPasswordChecks = getPasswordChecks({ value: password });
  const resetPasswordChecks = getPasswordChecks({
    value: newPassword,
    confirmation: confirmPassword,
  });
  const title = forgot
    ? "Recuperar contraseña"
    : reset
      ? "Crea una nueva contraseña"
      : mode === "login"
        ? "Iniciar sesión en Fanpush"
        : "Crear cuenta en Fanpush";
  const subtitle = forgot
    ? "Te enviaremos un enlace seguro para recuperar el acceso."
    : reset
      ? "Elige una contraseña segura para volver a entrar."
    : mode === "login"
      ? "Accede a tus compras, mensajes y contenido desbloqueado."
      : "Crea tu cuenta para comprar, seguir perfiles y desbloquear contenido.";

  const resumePendingCheckout = () => {
    const pendingCheckout = readPendingCheckout();
    if (!pendingCheckout) return false;

    const checkoutUrl = new URL("/checkout/return", window.location.origin);
    checkoutUrl.searchParams.set("payment_id", pendingCheckout.paymentId);
    checkoutUrl.searchParams.set("status", pendingCheckout.status || "approved");
    if (pendingCheckout.kind) {
      checkoutUrl.searchParams.set("kind", pendingCheckout.kind);
    }
    if (pendingCheckout.target) {
      checkoutUrl.searchParams.set("target", pendingCheckout.target);
    }
    window.location.assign(`${checkoutUrl.pathname}${checkoutUrl.search}`);
    return true;
  };

  const enterResetMode = () => {
    setReset(true);
    setForgot(false);
    setMode("login");
  };

  const validate = () => {
    if (reset) {
      return getPasswordValidationError({
        value: newPassword,
        confirmation: confirmPassword,
      });
    }
    if (forgot) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) return "El correo es obligatorio.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return "El correo no es válido.";
      }
      return null;
    }
    if (showRegisterFields && fullName.trim().length < 2) {
      return "El nombre completo es obligatorio.";
    }
    if (showRegisterFields) {
      const normalizedUsername = normalizeUsername(username);
      if (normalizedUsername.length < 3) {
        return "El nombre de usuario debe tener al menos 3 caracteres.";
      }
      if (!/^[a-z0-9._]+$/.test(normalizedUsername)) {
        return "El nombre de usuario solo puede tener letras, numeros, punto y guion bajo.";
      }
      if (usernameStatus !== "available") {
        return "Elegi un nombre de usuario disponible.";
      }
      if (!acceptedTerms) {
        return "Debes aceptar los términos y condiciones.";
      }
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return "El correo es obligatorio.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return "El correo no es válido.";
    }
    if (mode === "register") {
      return getPasswordValidationError({ value: password });
    }
    if (showLoginPasswordField && password.length === 0) {
      return "La contraseña es obligatoria.";
    }
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setCanResendConfirmation(false);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Falta configurar Supabase.");
      if (reset) {
        await updateCurrentPassword({ password: newPassword }).unwrap();
        setSuccess("Contraseña actualizada. Ya podes iniciar sesión.");
        setReset(false);
        setForgot(false);
        setNewPassword("");
        setConfirmPassword("");
        await supabase.auth.signOut();
        window.location.assign("/auth?reset=done");
        return;
      }
      if (forgot) {
        const normalizedEmail = normalizeEmail(email);
        const result = await requestPasswordRecovery({
          email: normalizedEmail,
        }).unwrap();
        setSuccess(
          result.message ??
            "Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña.",
        );
        return;
      }

      if (mode === "register") {
        const normalizedEmail = normalizeEmail(email);
        const normalizedUsername = normalizeUsername(username);
        const result = await registerUser({
          fullName: fullName.trim(),
          username: normalizedUsername,
          email: normalizedEmail,
          password,
          acceptedTerms: acceptedTerms,
          referralCode: referralCode || undefined,
        }).unwrap();

        setSuccess(
          result.message ??
            "Cuenta creada. Revisa tu correo para confirmar tu dirección antes de iniciar sesión.",
        );
        setPassword("");
        setAcceptedTerms(false);
        setMode("login");
      } else {
        const normalizedEmail = normalizeEmail(email);
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) throw signInError;
        if (signInData.session && typeof window !== "undefined") {
          window.sessionStorage.setItem(
            JUST_SIGNED_IN_KEY,
            String(Date.now()),
          );
        }
        if (typeof window !== "undefined" && resumePendingCheckout()) {
          return;
        }
        window.location.assign("/");
      }
    } catch (err) {
      const nextError = formatAuthErrorMessage(err);
      setCanResendConfirmation(
        nextError.toLowerCase().includes("todavía no fue confirmado"),
      );
      setError(nextError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setError("Escribe tu correo para reenviar la confirmación.");
      return;
    }

    setResendingConfirmation(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await resendConfirmation({
        email: normalizedEmail,
      }).unwrap();
      setSuccess(
        result.message ??
          "Te reenviamos el correo de confirmación. Revisa también la carpeta de spam.",
      );
      setCanResendConfirmation(false);
    } catch (err) {
      setError(formatAuthErrorMessage(err));
    } finally {
      setResendingConfirmation(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setReferralCode(params.get("ref")?.trim().toLowerCase() ?? "");
  }, []);

  useEffect(() => {
    if (mode !== "register" || forgot || reset) {
      setUsernameStatus("idle");
      setUsernameMessage(null);
      return;
    }

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      setUsernameStatus("idle");
      setUsernameMessage("Elegi tu nombre de usuario.");
      return;
    }
    if (normalizedUsername.length < 3) {
      setUsernameStatus("invalid");
      setUsernameMessage("Minimo 3 caracteres.");
      return;
    }
    if (!/^[a-z0-9._]+$/.test(normalizedUsername)) {
      setUsernameStatus("invalid");
      setUsernameMessage("Solo letras, numeros, punto y guion bajo.");
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      setUsernameStatus("checking");
      setUsernameMessage("Comprobando disponibilidad...");

      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setUsernameStatus("invalid");
        setUsernameMessage("No se pudo verificar el usuario.");
        return;
      }
      if (data?.id) {
        setUsernameStatus("taken");
        setUsernameMessage("Ese nombre de usuario ya esta en uso.");
        return;
      }

      setUsernameStatus("available");
      setUsernameMessage("Nombre de usuario disponible.");
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [forgot, mode, reset, username]);

  useEffect(() => {
    setMounted(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      return () => {};
    }
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    const hasRecoveryHash = hash.includes("type=recovery");

    if (search.includes("reset=done")) {
      setReset(false);
      setForgot(false);
      setMode("login");
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/auth");
      }
      return;
    }

    if (search.includes("reset=expired")) {
      setReset(false);
      setForgot(true);
      setMode("login");
      setError(
        "El enlace para cambiar la contraseña es inválido o ya expiró. Solicita uno nuevo para continuar.",
      );
      setSuccess(null);
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/auth?reset=expired");
      }
      return;
    }

    if (hasRecoveryHash || search.includes("reset=1")) {
      enterResetMode();
    }

    const settleRecoverySession = async () => {
      if (!hasRecoveryHash) return;
      // Let Supabase read the recovery hash first, then clean the URL.
      await getSupabaseSessionSafely(supabase, { useInFlightRequest: false });
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          window.history.replaceState({}, "", "/auth?reset=1");
        }, 250);
      }
    };

    settleRecoverySession();

    if (
      typeof window !== "undefined" &&
      search.includes("checkout=resume")
    ) {
      void (async () => {
        const session = await getSupabaseSessionSafely(supabase);
        if (session?.access_token) {
          resumePendingCheckout();
        }
      })();
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        enterResetMode();
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/auth?reset=1");
        }
        clearPendingCheckout();
      }
    });
    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white text-zinc-900">
        <div className="mx-auto flex min-h-screen w-full max-w-[420px] items-center justify-center px-6">
          <div className="text-sm font-medium text-zinc-500">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(560px,0.92fr)_minmax(0,1.08fr)]">
        <div className="relative flex min-h-screen items-start bg-white px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
          <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-between">
            <div>
              <Image
                src="/fanpush-logo.png"
                alt="FanPush"
                width={89}
                height={67}
                priority
                className="h-[58px] w-auto sm:h-[66px]"
              />
            </div>

            <div className="my-10 lg:my-12">
              <div className="mb-8 text-left">
                <div className="text-[34px] font-semibold leading-[1.02] tracking-[-0.03em] text-zinc-900 sm:text-[42px]">
                  {title}
                </div>
                <p className="mt-4 max-w-[420px] text-[15px] leading-7 text-zinc-500 sm:text-[16px]">
                  {subtitle}
                </p>
              </div>

              <form
                className="rounded-[24px] border border-black/8 bg-white p-5 shadow-[0_18px_48px_rgba(24,24,27,0.08)] sm:p-7"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSubmit();
                }}
              >
              {!forgot ? (
                <div className="flex items-center gap-2 rounded-[16px] bg-zinc-100 p-1.5">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={`flex-1 rounded-[12px] px-3 py-3 text-sm font-semibold transition ${
                      mode === "login"
                        ? "bg-white text-zinc-700 shadow-sm"
                        : "bg-transparent text-zinc-600"
                    }`}
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className={`flex-1 rounded-[12px] px-3 py-3 text-sm font-semibold transition ${
                      mode === "register"
                        ? "bg-white text-zinc-700 shadow-sm"
                        : "bg-transparent text-zinc-600"
                    }`}
                  >
                    Crear cuenta
                  </button>
                </div>
              ) : null}

              <div className="mt-6 space-y-4">
                {mode === "register" && !forgot && !reset ? (
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="h-[52px] w-full rounded-[14px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
                  />
                ) : null}
                {mode === "register" && !forgot && !reset ? (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Nombre de usuario"
                      value={username}
                      onChange={(event) =>
                        setUsername(normalizeUsername(event.target.value))
                      }
                      className="h-[52px] w-full rounded-[14px] border border-zinc-200 px-4 py-3 pr-11 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
                    />
                    <span className="pointer-events-none absolute right-3 top-0 flex h-[52px] items-center justify-center text-zinc-400">
                      {usernameStatus === "checking" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : usernameStatus === "available" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : usernameStatus === "taken" ||
                        usernameStatus === "invalid" ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : null}
                    </span>
                    {usernameMessage ? (
                      <div
                        className={`mt-2 text-xs ${
                          usernameStatus === "available"
                            ? "text-emerald-600"
                            : usernameStatus === "taken" ||
                                usernameStatus === "invalid"
                              ? "text-red-500"
                              : "text-zinc-500"
                        }`}
                      >
                        {usernameMessage}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!reset ? (
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-[52px] w-full rounded-[14px] border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
                  />
                ) : null}
                {!forgot && !reset ? (
                  <>
                    <PasswordField
                      value={password}
                      placeholder="Contraseña"
                      visible={showPassword}
                      onChange={setPassword}
                      onToggle={() => setShowPassword((current) => !current)}
                    />
                    {mode === "register" ? (
                      <PasswordChecklist
                        title="Tu contraseña debe cumplir esto"
                        checks={registerPasswordChecks}
                      />
                    ) : null}
                  </>
                ) : null}
                {reset ? (
                  <>
                    <PasswordField
                      value={newPassword}
                      placeholder="Nueva contraseña"
                      visible={showNewPassword}
                      onChange={setNewPassword}
                      onToggle={() => setShowNewPassword((current) => !current)}
                    />
                    <PasswordField
                      value={confirmPassword}
                      placeholder="Confirmar contraseña"
                      visible={showConfirmPassword}
                      onChange={setConfirmPassword}
                      onToggle={() =>
                        setShowConfirmPassword((current) => !current)
                      }
                    />
                    <PasswordChecklist
                      title="Requisitos para la nueva contraseña"
                      checks={resetPasswordChecks}
                    />
                  </>
                ) : null}
                {mode === "register" && !forgot && !reset ? (
                  <label className="flex items-start gap-3 rounded-[14px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(event) => setAcceptedTerms(event.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      Acepto los{" "}
                      <a
                        href="/terminos"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-600"
                      >
                        términos y condiciones
                      </a>
                      {" "}y la{" "}
                      <a
                        href="/privacidad"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-600"
                      >
                        política de privacidad
                      </a>
                      . Declaro además que soy mayor de 18 años y que, si quiero
                      vender contenido, podré ser requerido a verificar mi identidad.
                    </span>
                  </label>
                ) : null}
              </div>

              {error ? (
                <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                  {error}
                </div>
              ) : null}
              {canResendConfirmation && mode === "login" && !forgot && !reset ? (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendingConfirmation}
                  className="mt-3 w-full rounded-[14px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resendingConfirmation
                    ? "Reenviando..."
                    : "Reenviar correo de confirmación"}
                </button>
              ) : null}
              {success ? (
                <div className="mt-4 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                  {success}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  submitting ||
                  (mode === "register" &&
                    !forgot &&
                    !reset &&
                    usernameStatus !== "available")
                }
                className="mt-6 w-full rounded-[14px] bg-[var(--brand-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting
                  ? "Procesando..."
                  : reset
                    ? "Actualizar contraseña"
                    : forgot
                    ? "Enviar enlace"
                    : mode === "login"
                      ? "Iniciar sesión"
                      : "Crear cuenta"}
              </button>

              {!forgot && !reset ? (
                <button
                  type="button"
                  onClick={() => setForgot(true)}
                  className="mt-4 w-full text-center text-sm font-semibold text-zinc-700 transition hover:text-zinc-900"
                >
                  ¿Has olvidado la contraseña?
                </button>
              ) : forgot ? (
                <button
                  type="button"
                  onClick={() => setForgot(false)}
                  className="mt-4 w-full text-center text-sm font-semibold text-zinc-700 transition hover:text-zinc-900"
                >
                  Volver a iniciar sesión
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setReset(false)}
                  className="mt-4 w-full text-center text-sm font-semibold text-zinc-700 transition hover:text-zinc-900"
                >
                  Volver a iniciar sesión
                </button>
              )}

              {mode === "login" && !forgot ? (
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="mt-4 w-full rounded-[14px] border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:border-zinc-300"
                >
                  Crear una cuenta
                </button>
              ) : null}
              </form>
            </div>

            <div className="max-w-[420px] text-left text-xs leading-6 text-zinc-500">
              Al continuar confirmas que eres mayor de 18 años y aceptas los términos y condiciones de Fanpush.
            </div>
          </div>
        </div>

        <div className="relative hidden min-h-screen overflow-hidden bg-[#d7cab0] lg:block">
          <Image
            src="/auth-side-image.png"
            alt="Fanpush community"
            fill
            priority
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,24,27,0.26),rgba(24,24,27,0.55))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.24),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(255,212,147,0.18),transparent_22%),linear-gradient(135deg,rgba(0,0,0,0.12),rgba(0,0,0,0.28))]" />
          <div className="relative flex h-full flex-col justify-end px-10 py-12 text-white xl:px-12 xl:py-12">
            <div className="relative z-10 max-w-[580px] rounded-[28px] border border-white/14 bg-black/30 p-7 backdrop-blur-[8px] xl:max-w-[660px] xl:p-8">
              <div className="mt-5 max-w-[560px] text-[34px] font-semibold leading-[0.98] tracking-[-0.04em] text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.45)] xl:text-[46px]">
                Publicá, conectá y convertí tu contenido en comunidad.
              </div>
              <p
                className="relative z-10 mt-5 max-w-[500px] text-[16px] leading-7 [text-shadow:0_2px_14px_rgba(0,0,0,0.72)]"
                style={{ color: "#ffffff", opacity: 1 }}
              >
                Entra para compartir contenido, hablar con tu audiencia y mover todo desde un solo lugar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
