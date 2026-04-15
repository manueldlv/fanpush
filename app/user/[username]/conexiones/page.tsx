import ProfileConnectionsPageClient from "@/components/ProfileConnectionsPageClient";

export default function UserConnectionsPage({
  params,
}: {
  params: { username: string };
}) {
  return (
    <ProfileConnectionsPageClient
      forcedUsername={decodeURIComponent(params.username)}
    />
  );
}
