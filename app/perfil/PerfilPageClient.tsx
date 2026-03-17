"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Grid, Lock, User } from "lucide-react";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import PostModal from "@/components/PostModal";
import { getSupabaseClient } from "@/lib/supabase";
import type { Post } from "@/lib/store/posts";

export default function PerfilPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [earnings, setEarnings] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    posts: 0,
    followers: 0,
    following: 0,
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "purchased">("posts");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [profileName, setProfileName] = useState(
    searchParams.get("user") ?? "usuario",
  );
  const [profileFullName, setProfileFullName] = useState(
    searchParams.get("full") ?? "Sin nombre",
  );
  const [profileAvatar, setProfileAvatar] = useState(
    searchParams.get("avatar") ?? "",
  );
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const userParam = searchParams.get("user");
    const fullParam = searchParams.get("full");
    const avatarParam = searchParams.get("avatar");
    if (userParam || fullParam || avatarParam) {
      setProfileName(userParam ?? "");
      setProfileFullName(fullParam ?? "");
      setProfileAvatar(avatarParam ?? "");
      setProfileLoading(false);
      return;
    }

    const loadProfile = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;
      setViewedUserId(userId);

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

      const fallbackUser = authData?.user?.email
        ? authData.user.email.split("@")[0]
        : "usuario";

      let avatarUrl = userRow?.avatar_url ?? "";
      if (avatarUrl && !avatarUrl.startsWith("http")) {
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(avatarUrl);
        avatarUrl = publicUrl.publicUrl;
      }

      setProfileName(userRow?.username ?? fallbackUser);
      setProfileAvatar(avatarUrl);
      setProfileFullName(profileRow?.full_name ?? "Sin nombre");
      setProfileLoading(false);
    };

    loadProfile();
  }, [searchParams]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        username?: string;
        fullName?: string;
        avatarUrl?: string | null;
      };
      if (detail?.username) setProfileName(detail.username);
      if (detail?.fullName) setProfileFullName(detail.fullName);
      if (detail?.avatarUrl !== undefined) {
        setProfileAvatar(detail.avatarUrl ?? "");
      }
    };
    window.addEventListener("profile-updated", handler as EventListener);
    return () =>
      window.removeEventListener("profile-updated", handler as EventListener);
  }, []);

  useEffect(() => {
    const loadPosts = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: authData } = await supabase.auth.getUser();
      setCurrentUserId(authData?.user?.id ?? null);

      let userId: string | null = null;
      let userRow: { username: string | null; avatar_url: string | null } | null =
        null;
      const userParam = searchParams.get("user");
      if (userParam) {
        const { data } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .eq("username", userParam)
          .maybeSingle();
        userId = data?.id ?? null;
        userRow = data
          ? { username: data.username ?? null, avatar_url: data.avatar_url ?? null }
          : null;
      } else {
        userId = authData?.user?.id ?? null;
        setCurrentUserId(authData?.user?.id ?? null);
      }


      if (!userId) return;
      if (!userRow) {
        const { data } = await supabase
          .from("users")
          .select("username, avatar_url")
          .eq("id", userId)
          .maybeSingle();
        userRow = data
          ? { username: data.username ?? null, avatar_url: data.avatar_url ?? null }
          : null;
      }
      const { data: albums } = await supabase
        .from("albums")
        .select(
          "id,user_id,description,price,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count))",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const resolveMediaUrl = async (value: string | null) => {
        if (!value) return "";
        if (value.startsWith("http")) return value;
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(value);
        return publicUrl.publicUrl;
      };

      const resolveAvatarUrl = async (value: string | null) => {
        if (!value) return "";
        if (value.startsWith("http")) return value;
        const { data: publicUrl } = supabase.storage
          .from("Imagenes")
          .getPublicUrl(value);
        return publicUrl.publicUrl;
      };

      if ((albums ?? []).length > 0) {
        const mapped = await Promise.all(
          (albums ?? []).map(async (album) => {
            const media =
              album.album_posts?.map((item) => item.post) ?? [];
            const mediaWithUrls = await Promise.all(
              media.map(async (item) => ({
                url: await resolveMediaUrl(item?.media_url ?? ""),
                kind: item?.media_type === "video" ? "video" : "image",
                locked: item?.is_locked ?? false,
              })),
            );
            const mediaPostIds = media.map((item) => item?.id ?? "");
            const avatarUrl = await resolveAvatarUrl(
              album.users?.avatar_url ?? userRow?.avatar_url ?? "",
            );
            return {
              id: album.id,
              userId: album.user_id ?? userId,
              mediaPostIds,
              author:
                album.users?.username ??
                userRow?.username ??
                profileName ??
                "usuario",
              verified: false,
              time: "Ahora",
              suggestion: "Perfil",
              caption: album.description ?? "",
              likes:
                album.album_posts?.reduce(
                  (sum, item) => sum + (item.post?.likes_count ?? 0),
                  0,
                ) ?? 0,
              avatar:
                avatarUrl ||
                "https://picsum.photos/seed/default-avatar/64/64",
              price: album.price ?? 0,
              media: mediaWithUrls,
            } satisfies Post;
          }),
        );

        const allMediaIds = mapped.flatMap((post) => post.mediaPostIds);
        if (currentUserId && allMediaIds.length > 0) {
          const { data: purchaseRows } = await supabase
            .from("purchases")
            .select("post_id")
            .eq("user_id", currentUserId)
            .in("post_id", allMediaIds);
          const purchased = new Set(
            (purchaseRows ?? []).map((row) => row.post_id),
          );
          const unlocked = mapped.map((post) => ({
            ...post,
            media: post.media.map((item, index) => {
              const postId = post.mediaPostIds[index];
              const canView =
                post.userId === currentUserId || purchased.has(postId);
              return { ...item, locked: canView ? false : item.locked };
            }),
          }));
          setProfilePosts(unlocked);
        } else {
          setProfilePosts(mapped);
        }
      } else {
        const { data: legacyPosts } = await supabase
          .from("posts")
          .select("id,media_url,media_type,is_locked,likes_count,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        const avatarUrl = await resolveAvatarUrl(userRow?.avatar_url ?? "");
        const mapped = await Promise.all(
          (legacyPosts ?? []).map(async (post) => ({
            id: post.id,
            userId,
            mediaPostIds: [post.id],
            author: userRow?.username ?? profileName ?? "usuario",
            verified: false,
            time: "Ahora",
            suggestion: "Perfil",
            caption: "",
            likes: post.likes_count ?? 0,
            avatar:
              avatarUrl ||
              "https://picsum.photos/seed/default-avatar/64/64",
            price: 0,
            media: [
              {
                url: await resolveMediaUrl(post.media_url),
                kind: post.media_type === "video" ? "video" : "image",
                locked: post.is_locked ?? false,
              },
            ],
          })),
        );

        if (currentUserId && mapped.length > 0) {
          const { data: purchaseRows } = await supabase
            .from("purchases")
            .select("post_id")
            .eq("user_id", currentUserId)
            .in(
              "post_id",
              mapped.flatMap((post) => post.mediaPostIds),
            );
          const purchased = new Set(
            (purchaseRows ?? []).map((row) => row.post_id),
          );
          const unlocked = mapped.map((post) => ({
            ...post,
            media: post.media.map((item, index) => {
              const postId = post.mediaPostIds[index];
              const canView =
                post.userId === currentUserId || purchased.has(postId);
              return { ...item, locked: canView ? false : item.locked };
            }),
          }));
          setProfilePosts(unlocked);
        } else {
          setProfilePosts(mapped);
        }
      }

      const { count: postsCount } = await supabase
        .from("albums")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      const { count: followersCount } = await supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", userId);
      const { count: followingCount } = await supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("follower_id", userId);

      setStats({
        posts: postsCount ?? 0,
        followers: followersCount ?? 0,
        following: followingCount ?? 0,
      });

      if (authData?.user?.id && userId && authData.user.id !== userId) {
        const { data: followRow } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", authData.user.id)
          .eq("following_id", userId)
          .maybeSingle();
        setIsFollowing(Boolean(followRow));
      } else {
        setIsFollowing(false);
      }

      const { data: ownedPosts } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", userId);
      const ownedIds = (ownedPosts ?? []).map((row) => row.id);
      if (ownedIds.length === 0) {
        setEarnings(0);
      } else {
        const { data: purchaseRows } = await supabase
          .from("purchases")
          .select("amount, post_id")
          .in("post_id", ownedIds);
        const total = (purchaseRows ?? []).reduce(
          (sum, row) => sum + Number(row.amount || 0) * 0.7,
          0,
        );
        setEarnings(total);
      }
    };

    loadPosts();
  }, [searchParams]);

  const openPostFromProfile = async (post: Post) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setOpenPost(post);
      return;
    }

    const resolveMediaUrl = async (value: string | null) => {
      if (!value) return "";
      if (value.startsWith("http")) return value;
      const { data: publicUrl } = supabase.storage
        .from("Imagenes")
        .getPublicUrl(value);
      return publicUrl.publicUrl;
    };

    const resolveAvatarUrl = async (value: string | null) => {
      if (!value) return "";
      if (value.startsWith("http")) return value;
      const { data: publicUrl } = supabase.storage
        .from("Imagenes")
        .getPublicUrl(value);
      return publicUrl.publicUrl;
    };

    try {
      const { data: album } = await supabase
        .from("albums")
        .select(
          "id,user_id,description,price,created_at,users(username,avatar_url),album_posts(post:posts(id,media_url,media_type,is_locked,likes_count))",
        )
        .eq("id", post.id)
        .maybeSingle();

      if (album) {
        const media = album.album_posts?.map((item) => item.post) ?? [];
        const mediaWithUrls = await Promise.all(
          media.map(async (item) => ({
            url: await resolveMediaUrl(item?.media_url ?? ""),
            kind: item?.media_type === "video" ? "video" : "image",
            locked: item?.is_locked ?? false,
          })),
        );
        const mediaPostIds = media.map((item) => item?.id ?? "");
        const avatarUrl = await resolveAvatarUrl(
          album.users?.avatar_url ?? post.avatar ?? "",
        );
        setOpenPost({
          id: album.id,
          userId: album.user_id ?? post.userId,
          mediaPostIds,
          author: album.users?.username ?? post.author ?? "usuario",
          verified: false,
          time: "Ahora",
          suggestion: "Perfil",
          caption: album.description ?? "",
          likes:
            album.album_posts?.reduce(
              (sum, item) => sum + (item.post?.likes_count ?? 0),
              0,
            ) ?? 0,
          avatar:
            avatarUrl ||
            "https://picsum.photos/seed/default-avatar/64/64",
          price: album.price ?? post.price ?? 0,
          media: mediaWithUrls,
        });
        return;
      }

      setOpenPost(post);
    } catch (err) {
      console.error(err);
      setOpenPost(post);
    }
  };

  const toggleFollow = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId || !viewedUserId) return;
    if (currentUserId === viewedUserId) return;

    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", viewedUserId);
      if (!error) {
        setIsFollowing(false);
        setStats((prev) => ({
          ...prev,
          followers: Math.max(prev.followers - 1, 0),
        }));
      }
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: viewedUserId,
      });
      if (!error) {
        setIsFollowing(true);
        setStats((prev) => ({
          ...prev,
          followers: prev.followers + 1,
        }));
      }
    }
  };

  const handleDelete = async (albumId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId) return;

    try {
      const { data: links, error: linksError } = await supabase
        .from("album_posts")
        .select("post_id, post:posts(media_url)")
        .eq("album_id", albumId);
      if (linksError) throw linksError;
      const postIds = (links ?? []).map((row) => row.post_id);
      const mediaPaths = (links ?? [])
        .map((row) => row.post?.media_url)
        .filter(Boolean) as string[];

      const { error: albumPostsError } = await supabase
        .from("album_posts")
        .delete()
        .eq("album_id", albumId);
      if (albumPostsError) throw albumPostsError;

      if (postIds.length > 0) {
        const { error: postsError } = await supabase
          .from("posts")
          .delete()
          .in("id", postIds)
          .eq("user_id", currentUserId);
        if (postsError) throw postsError;
      }

      if (mediaPaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("Imagenes")
          .remove(mediaPaths);
        if (storageError) throw storageError;
      }

      const { error: albumsError } = await supabase
        .from("albums")
        .delete()
        .eq("id", albumId)
        .eq("user_id", currentUserId);
      if (albumsError) throw albumsError;

      setProfilePosts((prev) => prev.filter((post) => post.id !== albumId));
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar la publicación. Revisa los permisos (RLS).");
    }
  };

  const handlePurchase = async (albumId: string) => {
    if (!currentUserId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const post = profilePosts.find((item) => item.id === albumId);
    if (!post) return;

    const rows = post.mediaPostIds.map((postId, index) => ({
      user_id: currentUserId,
      post_id: postId,
      payment_id: `sim-${Date.now()}`,
      amount: index === 0 ? post.price ?? 0 : 0,
      status: "approved",
    }));
    const { error } = await supabase.from("purchases").insert(rows);
    if (error) {
      console.error(error);
      alert("No se pudo registrar la compra. Revisa permisos (RLS).");
      return false;
    }
    if (!error) {
      setProfilePosts((prev) =>
        prev.map((p) =>
          p.id === albumId
            ? {
                ...p,
                media: p.media.map((item) => ({ ...item, locked: false })),
              }
            : p,
        ),
      );
      window.dispatchEvent(new Event("purchases-updated"));
    }
    return true;
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
      {openPost ? (
        <PostModal
          post={openPost}
          onClose={() => setOpenPost(null)}
          currentUserId={currentUserId}
          onDelete={handleDelete}
          onPurchase={handlePurchase}
        />
      ) : null}

      <div className="flex h-full md:pl-60">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-6 px-4 py-6 md:max-w-[1360px] md:gap-8 md:px-6 md:py-8">
          <div className="rounded-[12px] border border-zinc-200 bg-white p-8">
            <div className="flex flex-col gap-10 md:flex-row md:items-start">
              <div className="flex flex-1 items-start gap-10">
                {profileAvatar ? (
                  <img
                    src={profileAvatar}
                    alt={profileName}
                    className="h-32 w-32 rounded-full object-cover md:h-36 md:w-36"
                  />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-500 md:h-36 md:w-36">
                    <User className="h-12 w-12" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold md:text-3xl">
                      {profileName || "usuario"}
                    </h1>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                      ✓
                    </span>
                  </div>
                  <div className="mt-3 text-base font-medium text-zinc-700">
                    {profileFullName || "Sin nombre"}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-8 text-base text-zinc-600">
                    <span>
                      <span className="font-semibold text-zinc-900">
                        {stats.posts}
                      </span>{" "}
                      publicaciones
                    </span>
                    <span>
                      <span className="font-semibold text-zinc-900">
                        {stats.followers}
                      </span>{" "}
                      seguidores
                    </span>
                    <span>
                      <span className="font-semibold text-zinc-900">
                        {stats.following}
                      </span>{" "}
                      seguidos
                    </span>
                    <span>
                      <span className="font-semibold text-zinc-900">
                        ${earnings.toFixed(2)}
                      </span>{" "}
                      ventas
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:w-[320px]">
                {currentUserId && viewedUserId && currentUserId !== viewedUserId ? (
                  <button
                    type="button"
                    onClick={toggleFollow}
                    className={`rounded-[12px] px-4 py-3 text-sm font-semibold ${
                      isFollowing
                        ? "bg-zinc-100 text-zinc-900"
                        : "bg-zinc-900 text-white"
                    }`}
                  >
                    {isFollowing ? "Siguiendo" : "Seguir"}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/settings")}
                    className="rounded-[12px] bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900"
                  >
                    Editar perfil
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border border-zinc-200 bg-white">
            <div className="flex items-center justify-center gap-8 border-b border-zinc-200 px-6 pt-4 text-sm font-semibold text-zinc-500">
              <button
                onClick={() => setActiveTab("posts")}
                className={`pb-3 ${
                  activeTab === "posts"
                    ? "border-b-2 border-zinc-900 text-zinc-900"
                    : ""
                }`}
              >
                <Grid className="mr-2 inline h-4 w-4" />
                Posteos
              </button>
              <button
                onClick={() => setActiveTab("purchased")}
                className={`pb-3 ${
                  activeTab === "purchased"
                    ? "border-b-2 border-zinc-900 text-zinc-900"
                    : ""
                }`}
              >
                <Bookmark className="mr-2 inline h-4 w-4" />
                Comprados
              </button>
            </div>

            <div className="grid grid-cols-2 gap-[2px] p-2 sm:grid-cols-3 md:grid-cols-5 md:gap-[2px] md:p-4">
              {activeTab === "posts" ? (
                profilePosts.map((post) => {
                  const firstMedia = post.media[0];
                  if (!firstMedia) return null;
                  return (
                    <div
                      key={post.id}
                      className="relative aspect-[3/4] cursor-pointer overflow-hidden border border-zinc-200"
                      onClick={() => openPostFromProfile(post)}
                    >
                      <img
                        src={firstMedia.url}
                        alt={profileName}
                        className="h-full w-full object-cover"
                      />
                      {firstMedia.locked ? (
                        <div className="absolute right-2 top-2 rounded-[5px] bg-white/90 px-2 py-1 text-[10px] font-semibold text-zinc-700">
                          <Lock className="mr-1 inline h-3 w-3" />
                          Locked
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-3 rounded-[5px] border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">
                  Aun no tienes compras.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
