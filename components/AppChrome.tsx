"use client";

import { usePathname } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import SearchPanel from "@/components/SearchPanel";
import TopBar from "@/components/TopBar";

export default function AppChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isStandalone =
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/terminos") ||
    pathname?.startsWith("/privacidad") ||
    pathname?.startsWith("/ayuda") ||
    pathname?.startsWith("/faq");

  return (
    <AuthGate>
      {!isStandalone ? <TopBar /> : null}
      {!isStandalone ? <SearchPanel /> : null}
      <div className={isStandalone ? "" : "pb-16 pt-16 md:pb-0"}>{children}</div>
    </AuthGate>
  );
}
