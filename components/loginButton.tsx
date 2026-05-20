"use client";

import { useConnectWallet } from "@privy-io/react-auth";
import { useState } from "react";
import { errorIndicatesUserRejected } from "@/lib/errors";

type Props = {
  label?: string;
  className?: string;
};

/**
 * Pure `connectWallet()` — NO Privy session, NO SIWS.
 *
 * For external-wallet-only apps that don't need a Privy session
 * (no embedded wallets, no `getAccessToken`, no MFA, no auto-link).
 * The user attaches their wallet via the picker; subsequent signing
 * and transactions go directly through the wallet-standard adapter.
 *
 * Cost: 0 SIWS quota. User can connect/disconnect freely.
 */
export default function LoginButton({
  label = "Connect wallet",
  className,
}: Props) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const { connectWallet } = useConnectWallet({
    onSuccess: () => {
      setConnecting(false);
      setErrorMsg(null);
    },
    onError: (err) => {
      setConnecting(false);
      if (errorIndicatesUserRejected(err)) return;
      const msg = typeof err === "string" ? err.toLowerCase() : "";
      if (msg.includes("exited")) return;
      setErrorMsg("Failed to open wallet picker.");
    },
  });

  const handleClick = () => {
    if (connecting) return;
    setErrorMsg(null);
    setConnecting(true);
    connectWallet({ walletChainType: "solana-only" });
  };

  return (
    <div className="flex flex-col gap-1 items-end">
      <button
        onClick={handleClick}
        disabled={connecting}
        className={
          className ??
          "rounded-full border border-solid border-transparent transition-colors cursor-pointer flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
        }
        type="button"
      >
        {connecting ? "Pick a wallet…" : label}
      </button>
      {errorMsg ? (
        <span className="text-xs text-red-400 max-w-[260px] text-right">
          {errorMsg}
        </span>
      ) : null}
    </div>
  );
}
