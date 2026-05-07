"use client";

import { useLinkAccount, usePrivy } from "@privy-io/react-auth";
import { Plus } from "lucide-react";
import { useState } from "react";
import { errorIndicatesRateLimit, errorIndicatesUserRejected } from "@/lib/errors";

/**
 * Privy-modal-based variant of <AddWalletButton>. Both coexist:
 * - <AddWalletButton> uses our headless useLinkWithSiws flow (white-label).
 * - <AddWalletButtonModal> (this) opens Privy's own UI via useLinkAccount.
 *
 * Both consume 1 SIWS per added wallet. The HTTP-level
 * `lib/siwsFetchInterceptor.ts` captures /api/v1/siws/link in either
 * case, so the counter increments correctly regardless of which path
 * the user takes.
 */
export function AddWalletButtonModal() {
  const { ready, authenticated } = usePrivy();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { linkWallet } = useLinkAccount({
    onSuccess: () => setErrorMsg(null),
    onError: (err) => {
      if (errorIndicatesUserRejected(err)) {
        setErrorMsg("Signature canceled.");
      } else if (errorIndicatesRateLimit(err)) {
        setErrorMsg("Too many wallet auths this week. Try again later.");
      } else if (
        typeof err === "string" &&
        err.toLowerCase().includes("exited")
      ) {
        // Privy emits string codes like "exited_link_flow" when the user
        // closes the modal without finishing — treat as silent cancel.
        setErrorMsg(null);
      } else {
        setErrorMsg("Failed to link wallet.");
      }
    },
  });

  if (!ready || !authenticated) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => linkWallet({ walletChainType: "solana-only" })}
        className="rounded-full border border-solid border-blue-500/40 hover:border-blue-500 transition-colors flex items-center gap-2 h-10 px-4 text-sm font-medium text-blue-300"
      >
        <Plus className="h-4 w-4" />
        Add wallet (modal)
      </button>
      {errorMsg ? <span className="text-xs text-red-400">{errorMsg}</span> : null}
    </div>
  );
}
