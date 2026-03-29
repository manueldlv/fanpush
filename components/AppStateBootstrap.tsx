"use client";

import { useEffect } from "react";
import { hydrateAuthState } from "@/lib/redux/slices/authSlice";
import { hydrateNotificationsState } from "@/lib/redux/slices/notificationsSlice";
import { hydrateViewerState } from "@/lib/redux/slices/viewerSlice";
import { useAppDispatch } from "@/lib/redux/hooks";
import { getSupabaseClient } from "@/lib/supabase";

const APP_REFRESH_EVENTS = [
  "purchases-updated",
  "earnings-updated",
  "creator-status-updated",
  "notification-preferences-updated",
  "profile-updated",
] as const;

export default function AppStateBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const refresh = () => {
      void dispatch(hydrateAuthState());
      void dispatch(hydrateViewerState());
      void dispatch(hydrateNotificationsState());
    };

    refresh();

    const interval = window.setInterval(refresh, 15000);
    APP_REFRESH_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, refresh),
    );

    const supabase = getSupabaseClient();
    const authSubscription = supabase?.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      window.clearInterval(interval);
      APP_REFRESH_EVENTS.forEach((eventName) =>
        window.removeEventListener(eventName, refresh),
      );
      authSubscription?.data.subscription.unsubscribe();
    };
  }, [dispatch]);

  return null;
}
