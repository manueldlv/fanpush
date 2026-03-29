"use client";

import { Provider } from "react-redux";
import AppStateBootstrap from "@/components/AppStateBootstrap";
import { store } from "@/lib/redux/store";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider store={store}>
      <AppStateBootstrap />
      {children}
    </Provider>
  );
}
