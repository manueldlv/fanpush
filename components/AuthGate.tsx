"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useGetAdminAccessQuery,
  useGetSessionQuery,
} from "@/lib/redux/api/sessionApi";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const inAuth = pathname?.startsWith("/auth");
  const inAdmin = pathname?.startsWith("/admin");
  const inAdminLogin = pathname?.startsWith("/admin/login");
  const inCheckoutReturn = pathname?.startsWith("/checkout/return");
  const inBalance = pathname?.startsWith("/saldo");
  const inPublicTerms = pathname?.startsWith("/terminos");
  const inPublicPrivacy = pathname?.startsWith("/privacidad");
  const inPublicHelp = pathname?.startsWith("/ayuda");
  const inPublicFaq = pathname?.startsWith("/faq");
  const allowWithoutSession = Boolean(
    inAuth ||
    inAdminLogin ||
    inCheckoutReturn ||
    inBalance ||
    inPublicTerms ||
    inPublicPrivacy ||
    inPublicHelp ||
    inPublicFaq,
  );
  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useGetSessionQuery(undefined, {
    skip: allowWithoutSession || inAdmin,
  });
  const {
    data: adminAccess,
    isLoading: adminAccessLoading,
    error: adminAccessError,
  } = useGetAdminAccessQuery(undefined, {
    skip: allowWithoutSession || !inAdmin,
  });
  const loading =
    !allowWithoutSession && (inAdmin ? adminAccessLoading : sessionLoading);
  const configError = Boolean(inAdmin ? adminAccessError : sessionError);
  const allowed = allowWithoutSession
    ? true
    : inAdmin
      ? Boolean(adminAccess?.isAdmin)
      : Boolean(session?.isAuthenticated);

  useEffect(() => {
    if (allowWithoutSession || loading || configError || allowed) {
      return;
    }
    router.replace(inAdmin ? "/admin/login" : "/auth");
  }, [
    allowWithoutSession,
    allowed,
    configError,
    inAdmin,
    loading,
    pathname,
    router,
  ]);

  if (allowWithoutSession) return <>{children}</>;
  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 text-sm text-zinc-600 shadow-sm">
          {configError
            ? "Falta configurar la autenticación para acceder a esta sección."
            : "Verificando sesión..."}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
