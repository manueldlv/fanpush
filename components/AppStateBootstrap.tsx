"use client";

import { useEffect } from "react";
import { setDeviceRuntime } from "@/lib/redux/slices/deviceSlice";
import { hydrateAuthState } from "@/lib/redux/slices/authSlice";
import { hydrateNotificationsState } from "@/lib/redux/slices/notificationsSlice";
import { hydrateViewerState } from "@/lib/redux/slices/viewerSlice";
import { useAppDispatch } from "@/lib/redux/hooks";
import { getSupabaseClient } from "@/lib/supabase";

const APP_REFRESH_EVENTS = [
  "balance-updated",
  "purchases-updated",
  "earnings-updated",
  "creator-status-updated",
  "notification-preferences-updated",
  "profile-updated",
] as const;

export default function AppStateBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const updateDeviceRuntime = () => {
      const prefersReducedMotionQuery = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      dispatch(
        setDeviceRuntime({
          hydrated: true,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          devicePixelRatio: window.devicePixelRatio || 1,
          isMobileViewport: window.innerWidth < 1024,
          isTouch:
            "ontouchstart" in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.maxTouchPoints > 0,
          orientation:
            window.innerWidth >= window.innerHeight ? "landscape" : "portrait",
          prefersReducedMotion: prefersReducedMotionQuery.matches,
        }),
      );
    };

    const refresh = () => {
      void dispatch(hydrateAuthState());
      void dispatch(hydrateViewerState());
      void dispatch(hydrateNotificationsState());
    };

    refresh();
    updateDeviceRuntime();

    const interval = window.setInterval(refresh, 15000);
    APP_REFRESH_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, refresh),
    );
    window.addEventListener("resize", updateDeviceRuntime);
    window.addEventListener("orientationchange", updateDeviceRuntime);

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleReducedMotionChange = () => updateDeviceRuntime();
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    const supabase = getSupabaseClient();
    const authSubscription = supabase?.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      window.clearInterval(interval);
      APP_REFRESH_EVENTS.forEach((eventName) =>
        window.removeEventListener(eventName, refresh),
      );
      window.removeEventListener("resize", updateDeviceRuntime);
      window.removeEventListener("orientationchange", updateDeviceRuntime);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      authSubscription?.data.subscription.unsubscribe();
    };
  }, [dispatch]);

  return null;
}
