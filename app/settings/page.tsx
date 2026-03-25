"use client";

import { useEffect, useState } from "react";
import { Bell, Landmark, User } from "lucide-react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import type { PayoutProfile } from "@/lib/payouts";
import { parsePayoutProfile, serializePayoutProfile } from "@/lib/payouts";
import {
  normalizeWebsite,
  parseProfileDetails,
  serializeProfileDetails,
} from "@/lib/profileDetails";
import { getSupabaseClient } from "@/lib/supabase";

export default function SettingsPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "notifications" | "payments">(
    "profile",
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [payoutAlias, setPayoutAlias] = useState("");
  const [payoutHolderName, setPayoutHolderName] = useState("");
  const [payoutHolderDocument, setPayoutHolderDocument] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [savedPayoutProfile, setSavedPayoutProfile] = useState<PayoutProfile | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      const { data: userRow } = await supabase
        .from("users")
        .select("username, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      const { data: payoutRow } = await supabase
        .from("notifications")
        .select("message")
        .eq("user_id", userId)
        .eq("type", "payout_profile")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: profileMetaRow } = await supabase
        .from("notifications")
        .select("message")
        .eq("user_id", userId)
        .eq("type", "profile_meta")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setUsername(userRow?.username ?? "usuario");
      setFullName(profileRow?.full_name ?? "");
      const payoutProfile = parsePayoutProfile(payoutRow?.message);
      const profileDetails = parseProfileDetails(profileMetaRow?.message);
      setPayoutAlias(payoutProfile?.alias ?? "");
      setPayoutHolderName(payoutProfile?.holderName ?? "");
      setPayoutHolderDocument(payoutProfile?.holderDocument ?? "");
      setPayoutNotes(payoutProfile?.notes ?? "");
      setSavedPayoutProfile(payoutProfile);
      setBio(profileDetails?.bio ?? "");
      setWebsite(profileDetails?.website ?? "");
      setInstagram(profileDetails?.instagram ?? "");

      const rawAvatar = userRow?.avatar_url ?? null;
      if (rawAvatar && !rawAvatar.startsWith("http")) {
        setAvatarPath(rawAvatar);
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(rawAvatar);
        setAvatarUrl(publicUrl.publicUrl ?? null);
      } else {
        setAvatarPath(rawAvatar);
        setAvatarUrl(rawAvatar);
      }
    };

    loadProfile();
  }, []);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setMessage("Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY.");
      setSaving(false);
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Necesitas iniciar sesion.");

      let uploadedAvatarUrl = avatarUrl;
      let uploadedAvatarPath = avatarPath;
      if (avatarFile) {
        const path = `avatars/${userId}/${Date.now()}-${avatarFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("Imagenes")
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(path);
        uploadedAvatarUrl = publicUrl.publicUrl;
        uploadedAvatarPath = path;
      }

      const avatarDbValue =
        uploadedAvatarPath ??
        (uploadedAvatarUrl && uploadedAvatarUrl.startsWith("http")
          ? uploadedAvatarUrl
          : null);

      const safeUsername =
        username.trim() ||
        authData?.user?.email?.split("@")[0] ||
        "usuario";

      const { error: userError } = await supabase.from("users").upsert(
        {
          id: userId,
          username: safeUsername,
          avatar_url: avatarDbValue,
        },
        { onConflict: "id" },
      );
      if (userError) throw userError;

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName.trim(),
          email: authData?.user?.email ?? "",
        },
        { onConflict: "id" },
      );
      if (profileError) throw profileError;

      const profileMetaPayload = serializeProfileDetails({
        bio,
        website: normalizeWebsite(website),
        instagram,
      });
      const { data: existingProfileMeta } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "profile_meta")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingProfileMeta?.id) {
        const { error: profileMetaError } = await supabase
          .from("notifications")
          .update({ message: profileMetaPayload, is_read: true })
          .eq("id", existingProfileMeta.id);
        if (profileMetaError) throw profileMetaError;
      } else {
        const { error: profileMetaError } = await supabase.from("notifications").insert({
          user_id: userId,
          actor_id: userId,
          type: "profile_meta",
          entity_id: userId,
          message: profileMetaPayload,
          is_read: true,
        });
        if (profileMetaError) throw profileMetaError;
      }

      setAvatarUrl(uploadedAvatarUrl ?? null);
      setAvatarPath(uploadedAvatarPath ?? null);
      setAvatarFile(null);
      setMessage("Perfil actualizado.");
      window.dispatchEvent(
        new CustomEvent("profile-updated", {
          detail: {
            username: safeUsername,
            fullName: fullName.trim(),
            avatarUrl: uploadedAvatarUrl ?? null,
            bio: bio.trim(),
            website: normalizeWebsite(website),
            instagram: instagram.trim(),
          },
        }),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setMessage(null);
    const expected = username.trim().toLowerCase();
    if (!expected || deleteConfirmText.trim().toLowerCase() !== expected) {
      setMessage("Escribe tu nombre de usuario exacto para confirmar.");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setMessage("Falta configurar Supabase.");
      return;
    }

    setDeletingAccount(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Necesitas iniciar sesion.");
      }

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo borrar la cuenta.");
      }

      await supabase.auth.signOut();
      window.location.assign("/auth");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSavePayout = async () => {
    setMessage(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setMessage("Falta configurar Supabase.");
      return;
    }
    if (
      !payoutAlias.trim() ||
      !payoutHolderName.trim() ||
      !payoutHolderDocument.trim()
    ) {
      setMessage("Completa alias, titular y documento para guardar tus datos de cobro.");
      return;
    }

    setSavingPayout(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Necesitas iniciar sesión.");

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "payout_profile")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const payload = serializePayoutProfile({
        alias: payoutAlias.trim(),
        holderName: payoutHolderName.trim(),
        holderDocument: payoutHolderDocument.trim(),
        notes: payoutNotes.trim(),
        updatedAt: new Date().toISOString(),
      });

      if (existing?.id) {
        const { error } = await supabase
          .from("notifications")
          .update({ message: payload, is_read: true })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notifications").insert({
          user_id: userId,
          actor_id: userId,
          type: "payout_profile",
          entity_id: userId,
          message: payload,
          is_read: true,
        });
        if (error) throw error;
      }

      setSavedPayoutProfile({
        alias: payoutAlias.trim(),
        holderName: payoutHolderName.trim(),
        holderDocument: payoutHolderDocument.trim(),
        notes: payoutNotes.trim(),
        updatedAt: new Date().toISOString(),
      });
      setMessage("Datos de cobro actualizados.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setSavingPayout(false);
    }
  };

  const hasSavedPayoutProfile =
    !!savedPayoutProfile?.alias &&
    !!savedPayoutProfile?.holderName &&
    !!savedPayoutProfile?.holderDocument;

  const hasUnsavedPayoutChanges =
    payoutAlias.trim() !== (savedPayoutProfile?.alias ?? "") ||
    payoutHolderName.trim() !== (savedPayoutProfile?.holderName ?? "") ||
    payoutHolderDocument.trim() !== (savedPayoutProfile?.holderDocument ?? "") ||
    payoutNotes.trim() !== (savedPayoutProfile?.notes ?? "");

  const payoutUpdatedLabel = savedPayoutProfile?.updatedAt
    ? new Date(savedPayoutProfile.updatedAt).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SidebarLeft
        searchOpen={searchOpen}
        onSearchClick={() => {
          setNotificationsOpen(false);
          setSearchOpen(true);
        }}
        notificationsOpen={notificationsOpen}
        onNotificationsClick={() => {
          setSearchOpen(false);
          setNotificationsOpen(true);
        }}
      />

      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      <div className="md:pl-60">
        <div className="mx-auto flex w-full max-w-none gap-6 px-4 py-6 md:max-w-[1200px] md:gap-8 md:px-6 md:py-8">
          <aside className="w-[280px] shrink-0">
            <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
              <div className="text-lg font-semibold">Configuración</div>
              <div className="mt-4 space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className={`flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-semibold transition ${
                    activeTab === "profile"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <User className="h-4 w-4" />
                  Editar perfil
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("notifications")}
                  className={`flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-semibold transition ${
                    activeTab === "notifications"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  Notificaciones
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("payments")}
                  className={`flex w-full items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-semibold transition ${
                    activeTab === "payments"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Landmark className="h-4 w-4" />
                  Cobros y retiros
                </button>
              </div>
            </div>
          </aside>

          <section className="flex-1">
            {activeTab === "profile" ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold">Editar perfil</h1>
                  <p className="text-sm text-zinc-500">
                    Actualiza tu informacion publica y preferencias basicas.
                  </p>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <UserAvatar
                        src={avatarUrl}
                        alt={username || "Perfil"}
                        sizeClassName="h-16 w-16"
                        iconClassName="h-6 w-6"
                      />
                      <div>
                        <div className="text-sm font-semibold">
                          {username || "usuario"}
                        </div>
                        <div className="text-sm text-zinc-500">
                          {fullName || "Sin nombre"}
                        </div>
                      </div>
                    </div>
                    <label className="cursor-pointer rounded-[5px] bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
                      Cambiar foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                  <label className="text-sm font-semibold text-zinc-900">
                    Nombre de usuario
                  </label>
                  <div className="mt-2 rounded-[5px] border border-zinc-200 bg-zinc-100 px-3 py-2">
                    <input
                      value={username ? `@${username}` : "@usuario"}
                      readOnly
                      className="w-full cursor-not-allowed bg-transparent text-sm text-zinc-500 outline-none"
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    El nombre de usuario se elige al crear la cuenta y no se
                    puede cambiar.
                  </p>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                  <label className="text-sm font-semibold text-zinc-900">
                    Nombre
                  </label>
                  <div className="mt-2 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <input
                      placeholder="Tu nombre"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="w-full bg-transparent text-sm text-zinc-800 outline-none"
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Asi aparecera tu nombre en tu perfil.
                  </p>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                  <label className="text-sm font-semibold text-zinc-900">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Cuéntale a la gente qué compartes en FanPush."
                    maxLength={220}
                    className="mt-2 min-h-[110px] w-full rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800 outline-none"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    {bio.trim().length}/220 caracteres
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                    <label className="text-sm font-semibold text-zinc-900">
                      Sitio web o link principal
                    </label>
                    <div className="mt-2 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2">
                      <input
                        placeholder="ejemplo.com o https://..."
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                        className="w-full bg-transparent text-sm text-zinc-800 outline-none"
                      />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      Puedes usarlo para tu landing, Telegram o enlace principal.
                    </p>
                  </div>

                  <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                    <label className="text-sm font-semibold text-zinc-900">
                      Instagram
                    </label>
                    <div className="mt-2 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2">
                      <input
                        placeholder="@tuusuario"
                        value={instagram}
                        onChange={(event) => setInstagram(event.target.value)}
                        className="w-full bg-transparent text-sm text-zinc-800 outline-none"
                      />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      Opcional. Se mostrará como contacto social en tu perfil.
                    </p>
                  </div>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-zinc-50 p-5">
                  <div className="text-sm font-semibold text-zinc-900">
                    Ayuda y soporte
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">
                    Si tienes dudas sobre compras, retiros o verificación de autor,
                    puedes revisar la guía rápida o la sección de preguntas frecuentes.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href="/ayuda"
                      className="rounded-[5px] border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                    >
                      Centro de ayuda
                    </a>
                    <a
                      href="/faq"
                      className="rounded-[5px] border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
                    >
                      Preguntas frecuentes
                    </a>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-[5px] bg-zinc-900 px-6 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>

                <div className="rounded-[5px] border border-red-200 bg-red-50 p-6">
                  <div className="text-sm font-semibold text-red-700">
                    Borrar cuenta
                  </div>
                  <p className="mt-2 text-xs text-red-600">
                    Esto elimina tu cuenta y sus datos relacionados. Para
                    confirmar, escribe tu nombre de usuario exacto.
                  </p>
                  <div className="mt-4 rounded-[5px] border border-red-200 bg-white px-3 py-2">
                    <input
                      placeholder={`Escribe ${username || "tu usuario"}`}
                      value={deleteConfirmText}
                      onChange={(event) =>
                        setDeleteConfirmText(event.target.value)
                      }
                      className="w-full bg-transparent text-sm text-zinc-800 outline-none"
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={
                        deletingAccount ||
                        deleteConfirmText.trim().toLowerCase() !==
                          username.trim().toLowerCase()
                      }
                      className="rounded-[5px] bg-red-600 px-6 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingAccount ? "Borrando..." : "Borrar cuenta"}
                    </button>
                  </div>
                </div>

                {message ? (
                  <div className="rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    {message}
                  </div>
                ) : null}
              </div>
            ) : activeTab === "payments" ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold">Cobros y retiros</h1>
                  <p className="text-sm text-zinc-500">
                    Estos datos se usan para procesar tus retiros mensuales de forma manual.
                  </p>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Cuenta de cobro actual
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        Aquí puedes confirmar qué datos están activos para recibir tus retiros.
                      </p>
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        hasSavedPayoutProfile
                          ? hasUnsavedPayoutChanges
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {hasSavedPayoutProfile
                        ? hasUnsavedPayoutChanges
                          ? "Tienes cambios sin guardar"
                          : "Datos guardados"
                        : "Aún no cargaste una cuenta"}
                    </div>
                  </div>

                  {hasSavedPayoutProfile ? (
                    <div className="mt-5 rounded-[5px] border border-zinc-200 bg-zinc-50 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Alias / CVU / CBU activo
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {savedPayoutProfile?.alias}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Titular
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {savedPayoutProfile?.holderName}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Documento
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {savedPayoutProfile?.holderDocument}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Última actualización
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {payoutUpdatedLabel ?? "Sin fecha"}
                          </div>
                        </div>
                      </div>
                      {savedPayoutProfile?.notes ? (
                        <div className="mt-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Notas guardadas
                          </div>
                          <div className="mt-1 text-sm text-zinc-700">
                            {savedPayoutProfile.notes}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[5px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                      Todavía no hay una cuenta de cobro guardada. Completa los campos de abajo y guarda para dejarla activa.
                    </div>
                  )}
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Editar datos de cobro
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        Si cambias tu alias, CBU o titular, guarda nuevamente para reemplazar la cuenta activa.
                      </p>
                    </div>
                    {hasSavedPayoutProfile ? (
                      <div className="rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                        {hasUnsavedPayoutChanges
                          ? "Estás editando una cuenta ya guardada."
                          : "Estos campos coinciden con tu cuenta activa."}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-semibold text-zinc-900">
                        Alias / CVU / CBU
                      </label>
                      <div className="mt-2 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <input
                          value={payoutAlias}
                          onChange={(event) => setPayoutAlias(event.target.value)}
                          placeholder="Ej: juan.mp o tu CBU/CVU"
                          className="w-full bg-transparent text-sm text-zinc-800 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-zinc-900">
                        Titular de la cuenta
                      </label>
                      <div className="mt-2 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <input
                          value={payoutHolderName}
                          onChange={(event) => setPayoutHolderName(event.target.value)}
                          placeholder="Nombre y apellido"
                          className="w-full bg-transparent text-sm text-zinc-800 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-zinc-900">
                        Documento / CUIT / CUIL
                      </label>
                      <div className="mt-2 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <input
                          value={payoutHolderDocument}
                          onChange={(event) =>
                            setPayoutHolderDocument(event.target.value)
                          }
                          placeholder="DNI, CUIT o CUIL"
                          className="w-full bg-transparent text-sm text-zinc-800 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-zinc-900">
                        Notas
                      </label>
                      <div className="mt-2 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <input
                          value={payoutNotes}
                          onChange={(event) => setPayoutNotes(event.target.value)}
                          placeholder="Banco, observaciones u otros datos"
                          className="w-full bg-transparent text-sm text-zinc-800 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[5px] border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                    Los retiros se agrupan una vez por mes. Si no completas estos datos,
                    no podrás solicitar retiros.
                  </div>

                  <button
                    type="button"
                    onClick={handleSavePayout}
                    disabled={savingPayout}
                    className="mt-5 rounded-[5px] bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {savingPayout ? "Guardando..." : "Guardar datos de cobro"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold">Notificaciones</h1>
                  <p className="text-sm text-zinc-500">
                    Personaliza como queres recibir avisos.
                  </p>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white">
                  <button className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
                    <span>Notificaciones push</span>
                    <span className="text-zinc-400">›</span>
                  </button>
                  <button className="flex w-full items-center justify-between border-t border-zinc-200 px-6 py-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
                    <span>Notificaciones por correo electronico</span>
                    <span className="text-zinc-400">›</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
