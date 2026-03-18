"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAdminIdentity } from "@/lib/admin";
import { getSupabaseClient } from "@/lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const inAuth = pathname?.startsWith("/auth");
  const inAdmin = pathname?.startsWith("/admin");
  const inAdminLogin = pathname?.startsWith("/admin/login");
  const inPublicTerms = pathname?.startsWith("/terminos");
  const allowWithoutSession = Boolean(inAuth || inAdminLogin || inPublicTerms);
  const [allowed, setAllowed] = useState(allowWithoutSession);

  useEffect(() => {
    setAllowed(allowWithoutSession);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setAllowed(true);
      return;
    }

    let cancelled = false;

    const redirectToAuth = () => {
      if (cancelled || allowWithoutSession) return;
      setAllowed(false);
      router.replace(inAdmin ? "/admin/login" : "/auth");
    };

    const allowRoute = () => {
      if (cancelled) return;
      setAllowed(true);
    };

    const checkSession = async () => {
      if (allowWithoutSession) {
        allowRoute();
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        if (inAdmin) {
          const isAdmin = isAdminIdentity({
            email: session.user.email,
            username:
              typeof session.user.user_metadata?.username === "string"
                ? session.user.user_metadata.username
                : null,
          });
          if (!isAdmin) {
            redirectToAuth();
            return;
          }
        }
        allowRoute();
        return;
      }

      redirectToAuth();
    };

    void checkSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (allowWithoutSession) {
        allowRoute();
        return;
      }

      if (event === "SIGNED_OUT" || !session?.user) {
        redirectToAuth();
        return;
      }

      if (inAdmin) {
        const isAdmin = isAdminIdentity({
          email: session.user.email,
          username:
            typeof session.user.user_metadata?.username === "string"
              ? session.user.user_metadata.username
              : null,
        });
        if (!isAdmin) {
          redirectToAuth();
          return;
        }
      }

      allowRoute();
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [allowWithoutSession, inAdmin, inAuth, pathname, router]);

  if (allowWithoutSession) return <>{children}</>;
  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 text-sm text-zinc-600 shadow-sm">
          Verificando sesión...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
