"use client";

import { useMemo } from "react";
import {
  useGetSessionQuery,
  useGetViewerQuery,
} from "@/lib/redux/api/sessionApi";

export function useViewerSession() {
  const sessionQuery = useGetSessionQuery();
  const viewerQuery = useGetViewerQuery();

  return useMemo(() => {
    const session = sessionQuery.data;
    const viewer = viewerQuery.data;
    const userId = session?.userId ?? null;
    const username = viewer?.profile.username ?? null;

    return {
      session,
      viewer,
      userId,
      username,
      isAuthenticated: Boolean(session?.isAuthenticated && userId),
      isAuthor: Boolean(viewer?.access.isAuthor),
      canCreate: Boolean(viewer?.access.canCreate),
      canWithdraw: Boolean(viewer?.access.canWithdraw),
      canAccessAdmin: Boolean(viewer?.access.canAccessAdmin),
      isBlocked: Boolean(viewer?.access.isBlocked),
      blockedReason: viewer?.access.blockedReason ?? null,
      balance: viewer?.commerce.balance ?? 0,
      isLoading: Boolean(sessionQuery.isLoading || viewerQuery.isLoading),
      sessionQuery,
      viewerQuery,
    };
  }, [sessionQuery, viewerQuery]);
}
