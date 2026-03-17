"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const isAuthed = !!data.session;
      const inAuth = pathname?.startsWith("/auth");
      const hash =
        typeof window !== "undefined" ? window.location.hash : "";
      const search =
        typeof window !== "undefined" ? window.location.search : "";
      const hasRecoveryHash =
        hash.includes("type=recovery") ||
        hash.includes("access_token") ||
        search.includes("reset=1");

      if (hasRecoveryHash && !inAuth) {
        window.location.replace(`/auth${hash}`);
        setReady(false);
        return;
      }
      if (!isAuthed && !inAuth) {
        router.replace("/auth");
        setReady(false);
        return;
      }
      if (inAuth) {
        setReady(true);
        if (isAuthed && !hasRecoveryHash) {
          router.replace("/");
          setReady(false);
        }
        return;
      }
      setReady(true);
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setReady(false);
        router.replace("/auth");
        return;
      }
      check();
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, [pathname, router]);

  if (!ready) return null;
  return <>{children}</>;
}
