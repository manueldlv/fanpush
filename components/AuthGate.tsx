"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useGetAdminAccessQuery,
  useGetSessionQuery,
} from "@/lib/redux/api/sessionApi";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const hasPathname = typeof pathname === "string" && pathname.length > 0;
  const inAuth = pathname?.startsWith("/auth");
  const inAdmin = pathname?.startsWith("/admin");
  const inAdminLogin = pathname?.startsWith("/admin/login");
  const inCheckoutReturn = pathname?.startsWith("/checkout/return");
  const inBalance = pathname?.startsWith("/saldo");
  const inPublicTerms = pathname?.startsWith("/terminos");
  const inPublicPrivacy = pathname?.startsWith("/privacidad");
  const inPublicHelp = pathname?.startsWith("/ayuda");
  const inPublicFaq = pathname?.startsWith("/faq");
  const inPublicExplore = pathname?.startsWith("/explorar");
  const inPublicHashtag = pathname?.startsWith("/hashtags/");
  const inPublicUserProfile = pathname?.startsWith("/user/");
  const allowWithoutSession = Boolean(
    inAuth ||
    inAdminLogin ||
    inCheckoutReturn ||
    inBalance ||
    inPublicTerms ||
    inPublicPrivacy ||
    inPublicHelp ||
    inPublicFaq ||
    inPublicExplore ||
    inPublicHashtag ||
    inPublicUserProfile,
  );
  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useGetSessionQuery(undefined, {
    skip: !hasPathname || allowWithoutSession || inAdmin,
  });
  const {
    data: adminAccess,
    isLoading: adminAccessLoading,
    error: adminAccessError,
  } = useGetAdminAccessQuery(undefined, {
    skip: !hasPathname || allowWithoutSession || !inAdmin,
  });
  const loading =
    hasPathname &&
    !allowWithoutSession &&
    (inAdmin ? adminAccessLoading : sessionLoading);
  const configError = Boolean(inAdmin ? adminAccessError : sessionError);
  const allowed = allowWithoutSession
    ? true
    : inAdmin
      ? Boolean(adminAccess?.isAdmin)
      : Boolean(session?.isAuthenticated);

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLoadingTimedOut(true);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [loading]);

  useEffect(() => {
    if (
      !hasPathname ||
      allowWithoutSession ||
      loading ||
      configError ||
      allowed
    ) {
      return;
    }
    router.replace(inAdmin ? "/admin/login" : "/auth");
  }, [
    hasPathname,
    allowWithoutSession,
    allowed,
    configError,
    inAdmin,
    loading,
    pathname,
    router,
  ]);

  if (!hasPathname || allowWithoutSession) return <>{children}</>;
  if (loading && !loadingTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 text-sm text-zinc-600 shadow-sm">
          Verificando sesión...
        </div>
      </div>
    );
  }
  if (configError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 text-sm text-zinc-600 shadow-sm">
          Falta configurar la autenticación para acceder a esta sección.
        </div>
      </div>
    );
  }
  if (!allowed) return null;

  return <>{children}</>;
}
