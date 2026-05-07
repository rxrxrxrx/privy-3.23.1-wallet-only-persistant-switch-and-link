"use client";

import { useToken } from "@privy-io/react-auth";
import { useEffect } from "react";

/**
 * Calls getAccessToken() on mount and on window focus to keep the Privy
 * refresh token rotating. The refresh token has a 30-day default lifetime;
 * a user who triggers a token refresh at least once every 30 days never
 * has to re-do SIWS.
 */
export function SessionKeepalive() {
  const { getAccessToken } = useToken();

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      getAccessToken().catch(() => {
        // refresh failed: user is effectively logged out.
        // Privy SDK already cleared local state; UI will reflect it.
      });
    };

    tick();
    const onFocus = () => {
      if (!cancelled) tick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [getAccessToken]);

  return null;
}
