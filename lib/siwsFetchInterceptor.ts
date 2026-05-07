"use client";

import { siwsTracker } from "./siwsTracker";

/**
 * HTTP-level SIWS tracker. We monkeypatch `window.fetch` once per page load
 * and observe responses from Privy's SIWS endpoints directly. This is the
 * only reliable signal — the React hook callbacks (`useLogin().onComplete`,
 * `useLinkWithSiws.linkWithSiws()`) don't always fire depending on Privy's
 * internal flow, but every SIWS auth that consumes the rate-limit budget
 * MUST hit one of these two HTTP endpoints.
 *
 * Side-effect import: just `import "@/lib/siwsFetchInterceptor"` once before
 * PrivyProvider mounts.
 */

const FLAG = "__riseSiwsFetchInstalled" as const;

type WindowWithFlag = Window & { [FLAG]?: boolean };

function urlOf(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (
    input &&
    typeof input === "object" &&
    "url" in input &&
    typeof (input as { url: unknown }).url === "string"
  ) {
    return (input as { url: string }).url;
  }
  return "";
}

async function inspectAndLog(url: string, response: Response) {
  if (!response.ok) return;

  const isAuth = /\/api\/v[0-9]+\/siws\/authenticate(\?|$|\/)/.test(url);
  const isLink = /\/api\/v[0-9]+\/siws\/link(\?|$|\/)/.test(url);
  if (!isAuth && !isLink) return;

  let walletAddress = "";
  let walletClientType = "";
  try {
    const clone = response.clone();
    const data = await clone.json();
    if (isAuth) {
      walletAddress =
        data?.user?.wallet?.address ?? data?.user?.linked_accounts?.[0]?.address ?? "";
      walletClientType =
        data?.user?.wallet?.wallet_client_type ??
        data?.user?.linked_accounts?.[0]?.wallet_client_type ??
        "";
    } else {
      walletAddress =
        data?.linked_account?.address ?? data?.user?.wallet?.address ?? "";
      walletClientType =
        data?.linked_account?.wallet_client_type ??
        data?.user?.wallet?.wallet_client_type ??
        "";
    }
  } catch {
    // body not JSON or already consumed — log without address
  }

  siwsTracker.log({
    type: isAuth ? "login" : "link",
    walletAddress,
    walletClientType,
    success: true,
  });
}

if (typeof window !== "undefined") {
  const w = window as WindowWithFlag;
  if (!w[FLAG]) {
    w[FLAG] = true;
    const orig = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const res = await orig(...(args as Parameters<typeof fetch>));
      try {
        const url = urlOf(args[0]);
        if (url.includes("privy.io")) {
          // Fire-and-forget; never block the original response on logging.
          void inspectAndLog(url, res);
        }
      } catch {
        // Never let logging break the actual fetch.
      }
      return res;
    };
  }
}
