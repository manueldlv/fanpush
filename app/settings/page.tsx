"use client";

import { useEffect, useState } from "react";
import { Bell, User } from "lucide-react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import { getSupabaseClient } from "@/lib/supabase";

export default function SettingsPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "notifications">(
    "profile",
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

      setUsername(userRow?.username ?? "usuario");
      setFullName(profileRow?.full_name ?? "");

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

      setAvatarPath(uploadedAvatarPath ?? null);
      setMessage("Perfil actualizado.");
      window.dispatchEvent(
        new CustomEvent("profile-updated", {
          detail: {
            fullName: fullName.trim(),
            avatarUrl: uploadedAvatarUrl ?? null,
          },
        }),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
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

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none gap-6 px-4 py-6 md:max-w-[1200px] md:gap-8 md:px-6 md:py-8">
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
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={username || "Perfil"}
                          className="h-16 w-16 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-500">
                          <User className="h-6 w-6" />
                        </span>
                      )}
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

                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-[5px] bg-zinc-900 px-6 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>

                {message ? (
                  <div className="rounded-[5px] border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    {message}
                  </div>
                ) : null}
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
