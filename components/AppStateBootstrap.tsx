"use client";

import { useEffect } from "react";
import { setDeviceRuntime } from "@/lib/redux/slices/deviceSlice";
import { notificationsApi } from "@/lib/redux/api/notificationsApi";
import { profileApi } from "@/lib/redux/api/profileApi";
import { sessionApi } from "@/lib/redux/api/sessionApi";
import { useAppDispatch } from "@/lib/redux/hooks";
import { getSupabaseClient, getSupabaseSessionSafely } from "@/lib/supabase";

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
    let referralFinalizePromise: Promise<void> | null = null;

    const finalizeReferralIfNeeded = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const session = await getSupabaseSessionSafely(supabase);

      const userId = session?.user?.id;
      if (!session?.access_token || !userId) return;
      const finalizeKey = `fanpush_referral_finalized:${userId}`;
      if (window.sessionStorage.getItem(finalizeKey) === "1") return;
      if (!referralFinalizePromise) {
        referralFinalizePromise = fetch("/api/referrals/finalize", {
          method: "POST",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })
          .then(() => {
            window.sessionStorage.setItem(finalizeKey, "1");
          })
          .catch(() => undefined)
          .finally(() => {
            referralFinalizePromise = null;
          });
      }
      await referralFinalizePromise;
    };

    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const search = window.location.search;
      const pathname = window.location.pathname;
      const hasRecoveryToken =
        hash.includes("type=recovery") ||
        search.includes("type=recovery") ||
        search.includes("reset=1");
      const hasRecoveryError =
        hash.includes("error_code=otp_expired") ||
        hash.includes("error=access_denied");

      if ((hasRecoveryToken || hasRecoveryError) && pathname !== "/auth") {
        const nextUrl = new URL("/auth", window.location.origin);
        nextUrl.searchParams.set(
          "reset",
          hasRecoveryError ? "expired" : "1",
        );
        window.location.replace(
          hasRecoveryError
            ? `${nextUrl.pathname}${nextUrl.search}`
            : `${nextUrl.pathname}${nextUrl.search}${hash || ""}`,
        );
        return;
      }
    }

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
      dispatch(sessionApi.util.invalidateTags(["Session", "Viewer", "AdminAccess"]));
      dispatch(profileApi.util.invalidateTags(["ProfileView"]));
    };

    const refreshNotifications = () => {
      dispatch(notificationsApi.util.invalidateTags(["NotificationCenter"]));
    };

    refreshViewer();
    refreshNotifications();
    updateDeviceRuntime();
    void finalizeReferralIfNeeded();

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
    const reducedMotionQueryLegacy = reducedMotionQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };

    if ("addEventListener" in reducedMotionQuery) {
      reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    } else {
      reducedMotionQueryLegacy.addListener?.(handleReducedMotionChange);
    }

    const supabase = getSupabaseClient();
    const authSubscription = supabase?.auth.onAuthStateChange(() => {
      refreshViewer();
      refreshNotifications();
      void finalizeReferralIfNeeded();
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
      if ("removeEventListener" in reducedMotionQuery) {
        reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      } else {
        reducedMotionQueryLegacy.removeListener?.(handleReducedMotionChange);
      }
      authSubscription?.data.subscription.unsubscribe();
    };
  }, [dispatch]);

  return null;
}
