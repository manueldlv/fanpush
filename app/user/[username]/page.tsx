import PerfilPageClient from "@/app/perfil/PerfilPageClient";

export default function UserProfilePage({
  params,
}: {
  params: { username: string };
}) {
  return <PerfilPageClient forcedUsername={decodeURIComponent(params.username)} />;
}
