"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import Image from "next/image";
import type { CSSProperties } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
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

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [forgot, setForgot] = useState(false);
  const [reset, setReset] = useState(false);
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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

  const pageStyle: CSSProperties = {
    minHeight: "100vh",
    background: "#ffffff",
    color: "#18181b",
  };

  const shellStyle: CSSProperties = {
    margin: "0 auto",
    minHeight: "100vh",
    width: "100%",
    maxWidth: "1400px",
    display: "grid",
    gridTemplateColumns: isMobile
      ? "minmax(0, 1fr)"
      : "minmax(0, 1.2fr) minmax(320px, 1fr)",
  };

  const leftPanelStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRight: isMobile ? "none" : "1px solid #e4e4e7",
    background: "#ffffff",
    padding: isMobile ? "32px 20px 12px" : "40px 24px",
  };

  const rightPanelStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: isMobile ? "12px 20px 40px" : "48px 24px",
  };

  const contentStyle: CSSProperties = {
    width: "100%",
    maxWidth: isMobile ? "100%" : "420px",
  };

  const formStyle: CSSProperties = {
    marginTop: "16px",
    border: "1px solid #e4e4e7",
    borderRadius: "12px",
    background: "#ffffff",
    padding: isMobile ? "20px" : "24px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  };

  const segmentedStyle: CSSProperties = {
    display: "flex",
    gap: "8px",
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    height: "52px",
    borderRadius: "10px",
    border: "1px solid #e4e4e7",
    padding: "12px 16px",
    fontSize: "14px",
    lineHeight: "20px",
    outline: "none",
    background: "#ffffff",
    color: "#18181b",
  };

  const primaryButtonStyle: CSSProperties = {
    width: "100%",
    borderRadius: "9999px",
    background: "#3b82f6",
    color: "#ffffff",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
  };

  const secondaryButtonStyle: CSSProperties = {
    width: "100%",
    borderRadius: "9999px",
    border: "1px solid #e4e4e7",
    background: "#ffffff",
    color: "#18181b",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  };

  const enterResetMode = () => {
    setReset(true);
    setForgot(false);
    setMode("login");
  };

  const normalizeEmail = (value: string) =>
    value.replace(/\s+/g, "").toLowerCase();

  const normalizeUsername = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._]/g, "");

  const validate = () => {
    if (reset) {
      if (newPassword.length < 6) {
        return "La contraseña debe tener al menos 6 caracteres.";
      }
      if (newPassword !== confirmPassword) {
        return "Las contraseñas no coinciden.";
      }
      return null;
    }
    if (forgot) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) return "El correo es obligatorio.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return "El correo no es válido.";
      }
      return null;
    }
    if (mode === "register" && fullName.trim().length < 2) {
      return "El nombre completo es obligatorio.";
    }
    if (mode === "register") {
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
    if (password.length < 6) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
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
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) throw updateError;
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
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          { redirectTo: `${window.location.origin}/auth?reset=1` },
        );
        if (resetError) throw resetError;
        setSuccess("Te enviamos un mail para recuperar tu contraseña.");
        return;
      }

      if (mode === "register") {
        const normalizedEmail = normalizeEmail(email);
        const normalizedUsername = normalizeUsername(username);
        const { error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              username: normalizedUsername,
              accepted_terms: true,
              accepted_terms_at: new Date().toISOString(),
            },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });

        if (signUpError) throw signUpError;

        setSuccess(
          "Cuenta creada. Revisa tu correo para confirmar si es necesario.",
        );
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
      setError(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setSubmitting(false);
    }
  };

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
    const updateViewport = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    setMounted(true);
    updateViewport();
    window.addEventListener("resize", updateViewport);

    const supabase = getSupabaseClient();
    if (!supabase) {
      return () => window.removeEventListener("resize", updateViewport);
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

    if (hasRecoveryHash || search.includes("reset=1")) {
      enterResetMode();
    }

    const settleRecoverySession = async () => {
      if (!hasRecoveryHash) return;
      // Let Supabase read the recovery hash first, then clean the URL.
      await supabase.auth.getSession();
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
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
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
      window.removeEventListener("resize", updateViewport);
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
    <div className="min-h-screen bg-white text-zinc-900" style={pageStyle}>
      <div
        className="mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 gap-0 lg:grid-cols-[1.2fr_1fr]"
        style={shellStyle}
      >
        <div
          className={`relative items-center justify-center bg-white ${
            isMobile ? "flex" : "hidden lg:flex"
          }`}
          style={leftPanelStyle}
        >
          <div
            className={`text-3xl font-semibold ${isMobile ? "absolute left-5 top-5 text-2xl" : "absolute left-10 top-10"}`}
          >
            Fanpush
          </div>
          <div className={`text-center ${isMobile ? "w-full max-w-[380px] pt-10" : "max-w-[480px]"}`}>
            <h1 className={`font-semibold leading-tight ${isMobile ? "text-[30px]" : "text-4xl"}`}>
              Mira los momentos cotidianos de tus <span className="text-pink-500">mejores amigos</span>.
            </h1>
            <div className={`flex items-center justify-center ${isMobile ? "mt-6" : "mt-10"}`}>
              <Image
                src="/auth-illustration.svg"
                alt="Fanpush ilustración"
                width={isMobile ? 240 : 420}
                height={isMobile ? 240 : 420}
                className="rounded-[24px]"
              />
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-center px-6 py-12"
          style={rightPanelStyle}
        >
          <div className="w-full max-w-[420px]" style={contentStyle}>
            <div className="mb-6 text-left">
              <div className="text-sm font-semibold text-zinc-900">
                {forgot
                  ? "Recuperar contraseña"
                  : mode === "login"
                    ? "Iniciar sesión en Fanpush"
                    : "Crear cuenta en Fanpush"}
              </div>
            </div>

            <form
              className="rounded-[12px] border border-zinc-200 bg-white p-6 shadow-sm"
              style={formStyle}
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              {!forgot ? (
                <div className="flex items-center gap-2" style={segmentedStyle}>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    style={{
                      ...secondaryButtonStyle,
                      borderRadius: "8px",
                      width: "100%",
                      background: mode === "login" ? "#18181b" : "#f4f4f5",
                      color: mode === "login" ? "#ffffff" : "#3f3f46",
                      border: "none",
                      padding: "10px 12px",
                    }}
                    className={`flex-1 rounded-[8px] px-3 py-2 text-sm font-semibold ${
                      mode === "login"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    style={{
                      ...secondaryButtonStyle,
                      borderRadius: "8px",
                      width: "100%",
                      background: mode === "register" ? "#18181b" : "#f4f4f5",
                      color: mode === "register" ? "#ffffff" : "#3f3f46",
                      border: "none",
                      padding: "10px 12px",
                    }}
                    className={`flex-1 rounded-[8px] px-3 py-2 text-sm font-semibold ${
                      mode === "register"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    Crear cuenta
                  </button>
                </div>
              ) : null}

              <div className="mt-6 space-y-4">
                {mode === "register" && !forgot && !reset ? (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Nombre de usuario"
                      value={username}
                      onChange={(event) =>
                        setUsername(normalizeUsername(event.target.value))
                      }
                      style={{ ...inputStyle, paddingRight: "44px" }}
                      className="h-[52px] w-full rounded-[10px] border border-zinc-200 px-4 py-3 pr-11 text-sm"
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
                {mode === "register" && !forgot && !reset ? (
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    style={inputStyle}
                    className="h-[52px] w-full rounded-[10px] border border-zinc-200 px-4 py-3 text-sm"
                  />
                ) : null}
                {mode === "register" && !forgot && !reset ? (
                  <label className="flex items-start gap-3 rounded-[10px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
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
                {!reset ? (
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    style={inputStyle}
                    className="h-[52px] w-full rounded-[10px] border border-zinc-200 px-4 py-3 text-sm"
                  />
                ) : null}
                {!forgot && !reset ? (
                  <input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    style={inputStyle}
                    className="h-[52px] w-full rounded-[10px] border border-zinc-200 px-4 py-3 text-sm"
                  />
                ) : null}
                {reset ? (
                  <>
                    <input
                      type="password"
                      placeholder="Nueva contraseña"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      style={inputStyle}
                      className="h-[52px] w-full rounded-[10px] border border-zinc-200 px-4 py-3 text-sm"
                    />
                    <input
                      type="password"
                      placeholder="Confirmar contraseña"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      style={inputStyle}
                      className="h-[52px] w-full rounded-[10px] border border-zinc-200 px-4 py-3 text-sm"
                    />
                  </>
                ) : null}
              </div>

              {error ? (
                <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              ) : null}
              {success ? (
                <div className="mt-4 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {success}
                </div>
              ) : null}

              <button
                type="submit"
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  (mode === "register" &&
                    !forgot &&
                    !reset &&
                    usernameStatus !== "available")
                }
                style={primaryButtonStyle}
                className="mt-6 w-full rounded-[999px] bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
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
                  className="mt-4 w-full text-center text-sm font-semibold text-zinc-700"
                >
                  ¿Has olvidado la contraseña?
                </button>
              ) : forgot ? (
                <button
                  type="button"
                  onClick={() => setForgot(false)}
                  className="mt-4 w-full text-center text-sm font-semibold text-zinc-700"
                >
                  Volver a iniciar sesión
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setReset(false)}
                  className="mt-4 w-full text-center text-sm font-semibold text-zinc-700"
                >
                  Volver a iniciar sesión
                </button>
              )}

              {mode === "login" && !forgot ? (
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  style={secondaryButtonStyle}
                  className="mt-4 w-full rounded-[999px] border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900"
                >
                  Crear una cuenta
                </button>
              ) : null}
            </form>

            <div className="mt-6 text-center text-xs text-zinc-500">
              Al continuar confirmas que eres mayor de 18 años y aceptas los términos y condiciones de Fanpush.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
