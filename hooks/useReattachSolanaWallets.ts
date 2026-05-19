"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { getWallets } from "@wallet-standard/app";
import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

/**
 * Workaround for a Privy v3 bug where WalletConnect-discovered Solana
 * wallets (TokenPocket, Trust, Bitget mobile, OKX mobile, SafePal) are
 * stored internally with `walletClientType: "walletconnect_solana"`,
 * but the SDK's `SolanaAdapterConnector.shouldAttemptAutoConnect()`
 * allow-list (see `dist/esm/use-unlink-wallet-*.mjs`, `me` array) only
 * contains `"walletconnect"` (the EVM variant). So Privy skips the silent
 * reconnect on page refresh — even though the WalletConnect session is
 * still persisted in localStorage (`wc@2:*` keys).
 *
 * Symptom: after refresh, `useWallets()` returns `[]` even though the
 * user is still authenticated and has a linked Solana wallet. The user
 * clicks "Reconnect" which triggers a fresh SIWS → burns a slot of the
 * 180/wallet/7d quota.
 *
 * The fix bypasses Privy's faulty allow-list by calling the
 * Wallet Standard `standard:connect({silent: true})` directly on every
 * Solana wallet in the registry. Silent connect is a wallet-standard
 * handshake — NOT a Privy auth call — so it costs 0 SIWS quota.
 *
 * One-shot per mount via `tried.current` to avoid loops if a wallet
 * fails to connect silently. User can refresh to retry.
 *
 * Delete this hook once Privy adds `"walletconnect_solana"` to the
 * allow-list upstream.
 */
export function useReattachSolanaWallets() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const tried = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || tried.current) return;
    if (wallets.length > 0) return;

    const linkedSolana = (user?.linkedAccounts ?? []).filter(
      (a) =>
        a.type === "wallet" && "chainType" in a && a.chainType === "solana",
    );
    if (linkedSolana.length === 0) return;

    tried.current = true;

    try {
      const { get } = getWallets();
      const standardWallets = get();
      let attempted = 0;
      for (const w of standardWallets) {
        const isSolana = w.chains.some(
          (c) => typeof c === "string" && c.startsWith("solana:"),
        );
        if (!isSolana) continue;
        const connectFeature = w.features["standard:connect"] as
          | { connect: (opts?: { silent?: boolean }) => Promise<unknown> }
          | undefined;
        if (!connectFeature?.connect) continue;
        attempted++;
        connectFeature.connect({ silent: true }).catch((err) => {
          logger.debug(`[reattach] silent connect failed for ${w.name}`, err);
        });
      }
      logger.debug(`[reattach] attempted ${attempted} Solana wallet(s)`);
    } catch (err) {
      logger.warn("[reattach] failed to query wallet-standard registry", err);
    }
  }, [ready, authenticated, user, wallets.length]);
}
