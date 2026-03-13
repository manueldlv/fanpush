import { Suspense } from "react";
import PerfilPageClient from "./PerfilPageClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Cargando perfil...</div>}>
      <PerfilPageClient />
    </Suspense>
  );
}