"use client";

import { useRef } from "react";
import { Provider } from "react-redux";
import AppStateBootstrap from "@/components/AppStateBootstrap";
import { makeStore, type AppStore } from "@/lib/redux/store";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return (
    <Provider store={storeRef.current}>
      <AppStateBootstrap />
      {children}
    </Provider>
  );
}
