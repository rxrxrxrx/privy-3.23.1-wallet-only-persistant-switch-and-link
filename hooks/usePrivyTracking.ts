"use client";

import {
  useLogin as useLoginRaw,
  useLinkWithSiws as useLinkWithSiwsRaw,
  type PrivyEvents,
} from "@privy-io/react-auth";
import { logger } from "@/lib/logger";
import { siwsTracker } from "@/lib/siwsTracker";
import { errorIndicatesUserRejected } from "@/lib/errors";

// The fetch interceptor in `lib/siwsFetchInterceptor.ts` is the authoritative
// counter. The wrapper below is a thin pass-through that just preserves the
// shape of `useLogin` — we used to log here too, but it was unreliable.
export function useLogin(callbacks?: PrivyEvents["login"]) {
  return useLoginRaw({
    ...callbacks,
    onComplete: (params) => {
      logger.debug("[Privy onComplete]", {
        loginMethod: params.loginMethod,
        wasAlreadyAuthenticated: params.wasAlreadyAuthenticated,
      });
      callbacks?.onComplete?.(params);
    },
    onError: (err) => {
      logger.debug("[Privy onError]", err);
      callbacks?.onError?.(err);
    },
  });
}

type LinkWithSiwsOpts = {
  signature: string;
  message: string;
  walletClientType?: string;
  connectorType?: string;
};

// Same comment as useLogin: the fetch interceptor is the source of truth for
// SUCCESSFUL siws/link calls. We only log FAILED links here (so the user can
// see "X failed link attempts" in the debug panel) — the fetch interceptor
// only sees responses, not user-cancellation errors that never hit the wire.
export function useLinkWithSiws() {
  const raw = useLinkWithSiwsRaw();
  return {
    generateSiwsMessage: raw.generateSiwsMessage,
    linkWithSiws: async (opts: LinkWithSiwsOpts) => {
      try {
        return await raw.linkWithSiws(opts);
      } catch (err) {
        if (!errorIndicatesUserRejected(err)) {
          const e = err as { code?: string; message?: string };
          siwsTracker.log({
            type: "link",
            walletAddress: "",
            walletClientType: opts.walletClientType ?? "",
            success: false,
            errorCode: e?.code ?? e?.message ?? "unknown",
          });
        }
        throw err;
      }
    },
  };
}
