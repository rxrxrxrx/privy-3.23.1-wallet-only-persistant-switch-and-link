"use client";

import { useReattachSolanaWallets } from "@/hooks/useReattachSolanaWallets";

/**
 * Null-render component that mounts the WalletConnect-Solana reattach
 * hook at layout level. See `hooks/useReattachSolanaWallets.ts` for
 * the full bug analysis and workaround.
 */
export function WalletReattach() {
  useReattachSolanaWallets();
  return null;
}
