import type { Metadata } from "next";
import AppProviders from "@/components/AppProviders";
import "../styles/globals.css";
import AppChrome from "@/components/AppChrome";

export const metadata: Metadata = {
  title: "FanPush",
  description: "FanPush: compra, desbloquea y vende contenido digital.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppProviders>
          <AppChrome>{children}</AppChrome>
        </AppProviders>
      </body>
    </html>
  );
}
