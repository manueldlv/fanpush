import { Suspense } from "react";
import ProfileConnectionsPageClient from "@/components/ProfileConnectionsPageClient";

export default function ProfileConnectionsPage() {
  return (
    <Suspense fallback={<div>Cargando conexiones...</div>}>
      <ProfileConnectionsPageClient />
    </Suspense>
  );
}
