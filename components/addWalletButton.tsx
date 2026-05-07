"use client";

import { useConnectWallet, usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { base64 } from "@scure/base";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLinkWithSiws } from "@/hooks/usePrivyTracking";
import { errorIndicatesRateLimit, errorIndicatesUserRejected } from "@/lib/errors";

type Status = "idle" | "connecting" | "linking" | "error";

export function AddWalletButton() {
  const { ready, authenticated, user } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets } = useWallets();
  const { generateSiwsMessage, linkWithSiws } = useLinkWithSiws();

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const linkedAddresses = useMemo(
    () =>
      new Set(
        user?.linkedAccounts
          .filter((a) => a.type === "wallet")
          .map((a) => ("address" in a ? a.address : "")) ?? [],
      ),
    [user?.linkedAccounts],
  );

  // Reset pending flag if component unmounts mid-flow so a remount doesn't
  // accidentally pick up a stale unlinked wallet.
  useEffect(() => {
    return () => {
      pendingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingRef.current) return;
    if (status !== "connecting") return;
    if (wallets.length === 0) return;

    // Find the most-recently-connected wallet that isn't already linked.
    // If everything is already linked, the user just reconnected an existing
    // wallet — that's a no-op success, not an error.
    const unlinked = wallets.find((w) => !linkedAddresses.has(w.address));

    if (!unlinked) {
      pendingRef.current = false;
      setStatus("idle");
      setErrorMsg("That wallet is already linked.");
      return;
    }

    pendingRef.current = false;
    (async () => {
      setStatus("linking");
      try {
        const message = await generateSiwsMessage({ address: unlinked.address });
        const encoded = new TextEncoder().encode(message);
        const { signature } = await unlinked.signMessage({ message: encoded });
        await linkWithSiws({
          signature: base64.encode(signature),
          message,
          walletClientType: unlinked.standardWallet.name.toLowerCase(),
          connectorType: "solana_adapter",
        });
        setStatus("idle");
        setErrorMsg(null);
      } catch (err) {
        setStatus("error");
        if (errorIndicatesUserRejected(err)) {
          setErrorMsg("Signature canceled.");
        } else if (errorIndicatesRateLimit(err)) {
          setErrorMsg("Too many wallet auths this week. Try again later.");
        } else {
          setErrorMsg("Failed to link wallet.");
        }
      }
    })();
  }, [wallets, linkedAddresses, generateSiwsMessage, linkWithSiws, status]);

  const handleClick = async () => {
    if (!ready || !authenticated || status !== "idle") return;
    setErrorMsg(null);
    setStatus("connecting");
    pendingRef.current = true;
    try {
      await connectWallet({ walletChainType: "solana-only" });
    } catch (err) {
      pendingRef.current = false;
      setStatus("idle");
      if (!errorIndicatesUserRejected(err)) {
        setErrorMsg("Failed to open wallet picker.");
      }
    }
  };

  if (!authenticated) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={status !== "idle"}
        className="rounded-full border border-solid border-white/15 hover:border-white/30 transition-colors flex items-center gap-2 h-10 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {status === "connecting" && "Pick a wallet…"}
        {status === "linking" && "Sign to link…"}
        {status === "idle" && "Add wallet"}
        {status === "error" && "Add wallet"}
      </button>
      {errorMsg ? (
        <span className="text-xs text-red-400">{errorMsg}</span>
      ) : null}
    </div>
  );
}
