"use client";

import { useEffect } from "react";
import { setDeviceRuntime } from "@/lib/redux/slices/deviceSlice";
import { notificationsApi } from "@/lib/redux/api/notificationsApi";
import { profileApi } from "@/lib/redux/api/profileApi";
import { sessionApi } from "@/lib/redux/api/sessionApi";
import { hydrateViewerState } from "@/lib/redux/slices/viewerSlice";
import { useAppDispatch } from "@/lib/redux/hooks";
import { getSupabaseClient } from "@/lib/supabase";

const APP_REFRESH_EVENTS = [
  "balance-updated",
  "purchases-updated",
  "earnings-updated",
  "creator-status-updated",
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

    const refreshViewer = () => {
      void dispatch(hydrateViewerState());
      dispatch(sessionApi.util.invalidateTags(["Session", "Viewer", "AdminAccess"]));
      dispatch(profileApi.util.invalidateTags(["ProfileView"]));
    };

    const refreshNotifications = () => {
      dispatch(notificationsApi.util.invalidateTags(["NotificationCenter"]));
    };

    refreshViewer();
    refreshNotifications();
    updateDeviceRuntime();

    APP_REFRESH_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, refreshViewer),
    );
    window.addEventListener("purchases-updated", refreshNotifications);
    window.addEventListener("earnings-updated", refreshNotifications);
    window.addEventListener("creator-status-updated", refreshNotifications);
    window.addEventListener("notification-preferences-updated", refreshNotifications);
    window.addEventListener("resize", updateDeviceRuntime);
    window.addEventListener("orientationchange", updateDeviceRuntime);

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleReducedMotionChange = () => updateDeviceRuntime();
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    const supabase = getSupabaseClient();
    const authSubscription = supabase?.auth.onAuthStateChange(() => {
      refreshViewer();
      refreshNotifications();
    });

    return () => {
      APP_REFRESH_EVENTS.forEach((eventName) =>
        window.removeEventListener(eventName, refreshViewer),
      );
      window.removeEventListener("purchases-updated", refreshNotifications);
      window.removeEventListener("earnings-updated", refreshNotifications);
      window.removeEventListener("creator-status-updated", refreshNotifications);
      window.removeEventListener(
        "notification-preferences-updated",
        refreshNotifications,
      );
      window.removeEventListener("resize", updateDeviceRuntime);
      window.removeEventListener("orientationchange", updateDeviceRuntime);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      authSubscription?.data.subscription.unsubscribe();
    };
  }, [dispatch]);

  return null;
}
