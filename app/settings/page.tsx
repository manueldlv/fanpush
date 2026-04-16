"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Bell, Copy, Landmark, User, Users } from "lucide-react";
import AvatarCropModal from "@/components/AvatarCropModal";
import SidebarLeft from "@/components/SidebarLeft";
import UserAvatar from "@/components/UserAvatar";
import {
  CHAT_BLOCKED_USERS_UPDATED_EVENT,
  type BlockedChatUser,
} from "@/lib/chatPreferences";
import { profileApi } from "@/lib/redux/api/profileApi";
import {
  useDeleteAccountMutation,
  useGetSettingsQuery,
  useUpdateNotificationPreferencesMutation,
  useUpdatePayoutProfileMutation,
  useUpdateProfileMutation,
} from "@/lib/redux/api/settingsApi";
import { useAppDispatch } from "@/lib/redux/hooks";
import type { PayoutProfile } from "@/lib/payouts";
import {
  buildDefaultNotificationPreferences,
  NOTIFICATION_PREFERENCE_CATEGORIES,
  type NotificationPreferences,
  type NotificationPreferenceCategory,
} from "@/lib/notificationPreferences";
import { normalizeWebsite } from "@/lib/profileDetails";
import { MAX_AVATAR_IMAGE_BYTES, validateImageFile } from "@/lib/imageFiles";
import { PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import { getSupabaseClient } from "@/lib/supabase";

function ToggleSwitch({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      aria-label={label}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
        checked ? "bg-zinc-900" : "bg-zinc-200"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const { data: settingsData } = useGetSettingsQuery();
  const [updateProfile] = useUpdateProfileMutation();
  const [updatePayoutProfile] = useUpdatePayoutProfileMutation();
  const [updateNotificationPreferences] = useUpdateNotificationPreferencesMutation();
  const [deleteAccount] = useDeleteAccountMutation();
  const invalidateProfileCaches = (userId: string, nextUsername: string) => {
    dispatch(profileApi.util.invalidateTags([
      { type: "ProfileView", id: "self" },
      { type: "ProfileView", id: `id:${userId}` },
      { type: "ProfileView", id: `username:${nextUsername.toLowerCase()}` },
    ]));
  };
  const [activeTab, setActiveTab] = useState<
    "profile" | "notifications" | "payments" | "referrals" | "blocked"
  >(
    "profile",
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [avatarCropSource, setAvatarCropSource] = useState<string | null>(null);
  const [avatarCropFileName, setAvatarCropFileName] = useState("avatar.jpg");
  const [avatarCropMimeType, setAvatarCropMimeType] = useState("image/jpeg");
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
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
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(buildDefaultNotificationPreferences());
  const [savedNotificationPreferences, setSavedNotificationPreferences] =
    useState<NotificationPreferences>(buildDefaultNotificationPreferences());
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedChatUser[]>([]);
  const [blockedUsersLoading, setBlockedUsersLoading] = useState(false);
  const [copiedReferralLink, setCopiedReferralLink] = useState(false);

  useEffect(() => {
    if (!settingsData) return;
    setUsername(settingsData.username || "usuario");
    setFullName(settingsData.fullName || "");
    setPayoutAlias(settingsData.payoutProfile?.alias ?? "");
    setPayoutHolderName(settingsData.payoutProfile?.holderName ?? "");
    setPayoutHolderDocument(settingsData.payoutProfile?.holderDocument ?? "");
    setPayoutNotes(settingsData.payoutProfile?.notes ?? "");
    setSavedPayoutProfile(settingsData.payoutProfile);
    setNotificationPreferences(settingsData.notificationPreferences);
    setSavedNotificationPreferences(settingsData.notificationPreferences);
    setBio(settingsData.bio ?? "");
    setWebsite(settingsData.website ?? "");
    setInstagram(settingsData.instagram ?? "");
    setAvatarPath(settingsData.avatarPath ?? null);
    setAvatarUrl(settingsData.avatarUrl ?? null);
  }, [settingsData]);

  useEffect(() => {
    return () => {
      if (avatarCropSource?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarCropSource);
      }
    };
  }, [avatarCropSource]);

  useEffect(() => {
    const syncBlockedUsers = async () => {
      setBlockedUsersLoading(true);
      try {
        const supabase = getSupabaseClient();
        const session = supabase
          ? await supabase.auth.getSession().then((result) => result.data.session)
          : null;
        const response = await fetch("/api/direct-chats/blocked", {
          credentials: "include",
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        const result = (await response.json()) as {
          error?: string;
          users?: BlockedChatUser[];
        };
        if (!response.ok) {
          throw new Error(result.error ?? "No se pudieron cargar los bloqueados.");
        }
        setBlockedUsers(result.users ?? []);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los bloqueados.",
        );
      } finally {
        setBlockedUsersLoading(false);
      }
    };

    void syncBlockedUsers();
    const handleBlockedUpdate = () => {
      void syncBlockedUsers();
    };
    window.addEventListener(CHAT_BLOCKED_USERS_UPDATED_EVENT, handleBlockedUpdate);
    return () => {
      window.removeEventListener(CHAT_BLOCKED_USERS_UPDATED_EVENT, handleBlockedUpdate);
    };
  }, []);

  const handleUnblockUser = async (userId: string) => {
    try {
      const supabase = getSupabaseClient();
      const session = supabase
        ? await supabase.auth.getSession().then((result) => result.data.session)
        : null;
      const response = await fetch(`/api/direct-chats/blocked/${userId}`, {
        method: "DELETE",
        credentials: "include",
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo desbloquear al usuario.");
      }
      setBlockedUsers((current) => current.filter((user) => user.id !== userId));
      window.dispatchEvent(new CustomEvent(CHAT_BLOCKED_USERS_UPDATED_EVENT));
      setMessage("Usuario desbloqueado.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo desbloquear al usuario.",
      );
    }
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      validateImageFile(file, {
        label: "La foto de perfil",
        maxBytes: MAX_AVATAR_IMAGE_BYTES,
      });
      const nextCropSource = URL.createObjectURL(file);
      if (avatarCropSource?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarCropSource);
      }
      setMessage(null);
      setAvatarCropSource(nextCropSource);
      setAvatarCropFileName(file.name || "avatar.jpg");
      setAvatarCropMimeType(file.type || "image/jpeg");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo cargar la foto.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleAvatarUploaded = async (file: File) => {
    setMessage(null);
    setUpdatingAvatar(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setUpdatingAvatar(false);
      throw new Error("Falta configurar Supabase.");
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        throw new Error("Necesitas iniciar sesión.");
      }

      const safeUsername =
        username.trim() || authData?.user?.email?.split("@")[0] || "usuario";
      const path = `avatars/${userId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (uploadError) {
        if (/bucket not found/i.test(uploadError.message)) {
          throw new Error(
            "El almacenamiento de imágenes todavía no está preparado. Intenta de nuevo en unos minutos.",
          );
        }
        throw uploadError;
      }

      const uploadedAvatarUrl =
        supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;

      if (avatarCropSource?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarCropSource);
      }
      setAvatarCropSource(null);
      setAvatarPath(uploadedAvatarUrl);
      setAvatarUrl(uploadedAvatarUrl);
      await updateProfile({
        userId,
        username: safeUsername,
        avatarUrl: uploadedAvatarUrl,
        avatarPath: path,
        fullName: fullName.trim(),
        bio: bio.trim(),
        website: normalizeWebsite(website),
        instagram: instagram.trim(),
      }).unwrap();
      invalidateProfileCaches(userId, safeUsername);
      setMessage("Foto de perfil actualizada.");
      window.dispatchEvent(
        new CustomEvent("profile-updated", {
          detail: {
            username: safeUsername,
            fullName: fullName.trim(),
            avatarUrl: uploadedAvatarUrl,
            bio: bio.trim(),
            website: normalizeWebsite(website),
            instagram: instagram.trim(),
          },
        }),
      );
    } finally {
      setUpdatingAvatar(false);
    }
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

      const safeUsername =
        username.trim() ||
        authData?.user?.email?.split("@")[0] ||
        "usuario";
      const result = await updateProfile({
        userId,
        username: safeUsername,
        avatarUrl,
        avatarPath,
        fullName: fullName.trim(),
        bio: bio.trim(),
        website: normalizeWebsite(website),
        instagram: instagram.trim(),
      }).unwrap();

      setUsername(result.username);
      setAvatarUrl(result.avatarUrl);
      setAvatarPath(result.avatarPath);
      invalidateProfileCaches(userId, safeUsername);
      setMessage("Perfil actualizado.");
      window.dispatchEvent(
        new CustomEvent("profile-updated", {
          detail: {
            username: safeUsername,
            fullName: fullName.trim(),
            avatarUrl: avatarUrl ?? null,
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

    setDeletingAccount(true);
    try {
      await deleteAccount().unwrap();
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Falta configurar Supabase.");
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
      const supabase = getSupabaseClient();
      if (!supabase) {
        setMessage("Falta configurar Supabase.");
        return;
      }
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Necesitas iniciar sesión.");
      const updatedAt = new Date().toISOString();
      const nextPayoutProfile = {
        alias: payoutAlias.trim(),
        holderName: payoutHolderName.trim(),
        holderDocument: payoutHolderDocument.trim(),
        notes: payoutNotes.trim(),
        updatedAt,
      };
      await updatePayoutProfile({
        userId,
        payoutProfile: nextPayoutProfile,
      }).unwrap();
      setSavedPayoutProfile(nextPayoutProfile);
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

  const hasUnsavedNotificationChanges =
    JSON.stringify(notificationPreferences) !==
    JSON.stringify(savedNotificationPreferences);

  const referralSummary = settingsData?.referrals;
  const referralShareLabel = useMemo(() => {
    if (!referralSummary) return "70% creador / 30% FanPush";
    return `${Math.round(referralSummary.creatorShareRate * 100)}% creador / ${Math.round(
      referralSummary.platformShareRate * 100,
    )}% FanPush`;
  }, [referralSummary]);

  const toggleNotificationPreference = (
    channel: "push" | "email",
    category: NotificationPreferenceCategory,
  ) => {
    setNotificationPreferences((current) => ({
      ...current,
      [channel]: {
        ...current[channel],
        [category]: !current[channel][category],
      },
    }));
  };

  const toggleNotificationChannel = (channel: "push" | "email") => {
    setNotificationPreferences((current) => {
      const allEnabled = NOTIFICATION_PREFERENCE_CATEGORIES.every(
        (category) => current[channel][category.key],
      );
      return {
        ...current,
        [channel]: Object.fromEntries(
          NOTIFICATION_PREFERENCE_CATEGORIES.map((category) => [
            category.key,
            !allEnabled,
          ]),
        ) as NotificationPreferences[typeof channel],
      };
    });
  };

  const handleSaveNotifications = async () => {
    setMessage(null);
    setSavingNotifications(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setMessage("Falta configurar Supabase.");
        return;
      }
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Necesitas iniciar sesión.");
      const payload = {
        ...notificationPreferences,
        updatedAt: new Date().toISOString(),
      };
      await updateNotificationPreferences({
        userId,
        notificationPreferences: payload,
      }).unwrap();
      setNotificationPreferences(payload);
      setSavedNotificationPreferences(payload);
      setMessage("Preferencias de notificaciones actualizadas.");
      window.dispatchEvent(
        new CustomEvent("notification-preferences-updated", {
          detail: payload,
        }),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setSavingNotifications(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <AvatarCropModal
        open={Boolean(avatarCropSource)}
        imageSrc={avatarCropSource ?? ""}
        fileName={avatarCropFileName}
        mimeType={avatarCropMimeType}
        onCancel={() => {
          if (avatarCropSource?.startsWith("blob:")) {
            URL.revokeObjectURL(avatarCropSource);
          }
          setAvatarCropSource(null);
        }}
        onConfirm={handleAvatarUploaded}
      />
      <SidebarLeft />

      <div className="md:pl-60">
        <div className="mx-auto flex w-full max-w-none gap-6 px-4 py-6 md:max-w-[1200px] md:gap-8 md:px-6 md:py-8">
          <aside className="w-[280px] shrink-0">
            <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
              <div className="text-lg font-semibold">Configuración</div>
              <div className="mt-4 space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-semibold transition ${
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
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-semibold transition ${
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
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-semibold transition ${
                    activeTab === "payments"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Landmark className="h-4 w-4" />
                  Cobros y retiros
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("referrals")}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-semibold transition ${
                    activeTab === "referrals"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Referidos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("blocked")}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-[5px] px-3 py-2 text-left text-sm font-semibold transition ${
                    activeTab === "blocked"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Ban className="h-4 w-4" />
                  Personas bloqueadas
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
                    <label
                      className={`rounded-[5px] border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 ${
                        updatingAvatar
                          ? "pointer-events-none opacity-70"
                          : "cursor-pointer"
                      }`}
                    >
                      {updatingAvatar ? "Subiendo foto..." : "Cambiar foto"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
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
                    className="fanpush-button-primary px-6 py-2 disabled:cursor-not-allowed disabled:opacity-70"
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
                    className="fanpush-button-primary mt-5 px-4 py-2 disabled:opacity-60"
                  >
                    {savingPayout ? "Guardando..." : "Guardar datos de cobro"}
                  </button>
                </div>
              </div>
            ) : activeTab === "referrals" ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold">Referidos</h1>
                  <p className="text-sm text-zinc-500">
                    Comparte tu link y gana mejores condiciones a medida que traes
                    más usuarios a FanPush.
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-6">
                    <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                      <div className="text-sm font-semibold text-zinc-900">
                        Tu link de referido
                      </div>
                      <p className="mt-2 text-sm text-zinc-500">
                        Cada persona que se registre con este link queda asociada a
                        tu panel de referidos.
                      </p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <div className="flex-1 rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                          {referralSummary?.link || "Todavía no hay link disponible."}
                        </div>
                        <button
                          type="button"
                          disabled={!referralSummary?.link}
                          onClick={async () => {
                            if (!referralSummary?.link) return;
                            await navigator.clipboard.writeText(referralSummary.link);
                            setCopiedReferralLink(true);
                            window.setTimeout(() => setCopiedReferralLink(false), 1800);
                          }}
                          className="rounded-[5px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-50"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Copy className="h-4 w-4" />
                            {copiedReferralLink ? "Copiado" : "Copiar link"}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                        <div className="text-sm text-zinc-500">Personas referidas</div>
                        <div className="mt-2 text-3xl font-semibold text-zinc-950">
                          {referralSummary?.count ?? 0}
                        </div>
                      </div>
                      <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                        <div className="text-sm text-zinc-500">Nivel actual</div>
                        <div className="mt-2 text-2xl font-semibold text-zinc-950">
                          {referralSummary?.tierLabel ?? "Base"}
                        </div>
                      </div>
                      <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                        <div className="text-sm text-zinc-500">Comisión actual</div>
                        <div className="mt-2 text-lg font-semibold text-zinc-950">
                          {referralShareLabel}
                        </div>
                      </div>
                      <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
                        <div className="text-sm text-zinc-500">Próximo nivel</div>
                        <div className="mt-2 text-lg font-semibold text-zinc-950">
                          {referralSummary?.nextTierTarget
                            ? `${referralSummary.nextTierTarget} referidos`
                            : "Ya estás en el nivel más alto"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold">Usuarios referidos</div>
                        <div className="mt-1 text-sm text-zinc-500">
                          Personas que se registraron usando tu link.
                        </div>
                      </div>
                      <div className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
                        {referralSummary?.count ?? 0}
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {referralSummary?.referredUsers?.length ? (
                        referralSummary.referredUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between gap-4 rounded-[5px] border border-zinc-200 bg-zinc-50 px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                src={user.avatarUrl}
                                alt={user.username}
                                sizeClassName="h-11 w-11"
                                iconClassName="h-4 w-4"
                              />
                              <div>
                                <div className="text-sm font-semibold text-zinc-950">
                                  @{user.username}
                                </div>
                                <div className="text-sm text-zinc-500">
                                  {user.fullName || "Sin nombre cargado"}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-zinc-500">
                              {user.createdAt
                                ? new Date(user.createdAt).toLocaleDateString("es-AR")
                                : "Sin fecha"}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[5px] border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
                          Todavía no tienes personas registradas con tu link.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "blocked" ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold">Personas bloqueadas</h1>
                  <p className="text-sm text-zinc-500">
                    Gestiona las personas que bloqueaste desde los chats.
                  </p>
                </div>

                <div className="rounded-[5px] border border-zinc-200 bg-white p-6">
                  {blockedUsersLoading ? (
                    <div className="text-sm text-zinc-500">Cargando bloqueados...</div>
                  ) : blockedUsers.length > 0 ? (
                    <div className="space-y-3">
                      {blockedUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between gap-4 rounded-[5px] border border-zinc-200 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              src={user.avatarUrl}
                              alt={user.fullName}
                              sizeClassName="h-12 w-12"
                              iconClassName="h-4 w-4"
                            />
                            <div>
                              <div className="text-[15px] font-semibold text-zinc-900">
                                {user.fullName}
                              </div>
                              <div className="text-[13px] text-zinc-500">
                                @{user.username}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleUnblockUser(user.id)}
                            className="rounded-[5px] border border-zinc-200 px-4 py-2 text-[14px] font-semibold text-zinc-700"
                          >
                            Desbloquear
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-500">
                      No tienes personas bloqueadas por ahora.
                    </div>
                  )}
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

                <div className="rounded-[16px] border border-zinc-200 bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Canales activos
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        El canal push afecta las notificaciones visibles dentro de la app. El canal email queda guardado para los envíos por correo.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:items-end">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                          Push
                        </span>
                        <ToggleSwitch
                          checked={NOTIFICATION_PREFERENCE_CATEGORIES.every(
                            (category) => notificationPreferences.push[category.key],
                          )}
                          onClick={() => toggleNotificationChannel("push")}
                          label="Activar o desactivar todas las notificaciones push"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                          Email
                        </span>
                        <ToggleSwitch
                          checked={NOTIFICATION_PREFERENCE_CATEGORIES.every(
                            (category) => notificationPreferences.email[category.key],
                          )}
                          onClick={() => toggleNotificationChannel("email")}
                          label="Activar o desactivar todas las notificaciones por email"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-[14px] border border-zinc-200">
                    {NOTIFICATION_PREFERENCE_CATEGORIES.map((category, index) => (
                      <div
                        key={category.key}
                        className={`grid gap-4 bg-white px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center ${
                          index > 0 ? "border-t border-zinc-200" : ""
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">
                            {category.label}
                          </div>
                          <div className="mt-1 text-sm text-zinc-500">
                            {category.description}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-zinc-200 bg-zinc-50 px-3 py-2 md:min-w-[132px]">
                          <span className="text-sm font-medium text-zinc-700">
                            Push
                          </span>
                          <ToggleSwitch
                            checked={notificationPreferences.push[category.key]}
                            onClick={() =>
                              toggleNotificationPreference("push", category.key)
                            }
                            label={`Cambiar push para ${category.label}`}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-zinc-200 bg-zinc-50 px-3 py-2 md:min-w-[132px]">
                          <span className="text-sm font-medium text-zinc-700">
                            Email
                          </span>
                          <ToggleSwitch
                            checked={notificationPreferences.email[category.key]}
                            onClick={() =>
                              toggleNotificationPreference("email", category.key)
                            }
                            label={`Cambiar email para ${category.label}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNotifications}
                      disabled={savingNotifications || !hasUnsavedNotificationChanges}
                      className="fanpush-button-primary rounded-[12px] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingNotifications
                        ? "Guardando..."
                        : "Guardar preferencias"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
