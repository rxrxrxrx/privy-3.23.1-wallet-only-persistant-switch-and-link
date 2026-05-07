"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// The full DebugPanel module is only loaded when the user has explicitly
// enabled it. In a prod build, the chunk stays out of the initial bundle
// and is only fetched if `?debug=privy` or `localStorage.rise:debug=1`
// (or NODE_ENV === 'development') is present.
const DebugPanelInner = dynamic(
  () => import("./debugPanel").then((m) => ({ default: m.DebugPanel })),
  { ssr: false, loading: () => null },
);

function shouldEnable(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "development") return true;
  if (window.localStorage.getItem("rise:debug") === "1") return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "privy") return true;
  } catch {}
  return false;
}

export function DebugPanelLoader() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(shouldEnable());
  }, []);

  if (!enabled) return null;
  return <DebugPanelInner />;
}
