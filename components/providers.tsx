"use client";

// Side-effect import: installs the SIWS fetch interceptor BEFORE Privy
// is loaded. This is our authoritative SIWS counter — Privy's hook callbacks
// can be flaky depending on the flow, but every SIWS auth/link that
// consumes the rate-limit MUST hit `/api/v1/siws/authenticate` or
// `/api/v1/siws/link` at the HTTP layer.
import "@/lib/siwsFetchInterceptor";

import { PrivyProvider, type WalletListEntry } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { isMobile } from "react-device-detect";
import { env } from "@/lib/env";

// Note: cross-tab sync is built into the SDK (BroadcastChannel + storage
// event listener); no plugin registration needed.

const desktopWalletList: WalletListEntry[] = [
  "phantom",
  "solflare",
  "backpack",
  "wallet_connect_qr_solana",
  "detected_solana_wallets",
];

const mobileWalletList: WalletListEntry[] = [
  "phantom",
  "solflare",
  "backpack",
  "wallet_connect",
];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={env.PRIVY_APP_ID}
      clientId={env.PRIVY_CLIENT_ID}
      config={{
        solana: {
          rpcs: {
            "solana:mainnet": {
              rpc: createSolanaRpc(env.SOLANA_RPC_URL),
              rpcSubscriptions: createSolanaRpcSubscriptions(env.SOLANA_WS_URL),
            },
          },
        },
        appearance: {
          showWalletLoginFirst: true,
          walletChainType: "solana-only",
          walletList: isMobile ? mobileWalletList : desktopWalletList,
        },
        loginMethods: ["wallet"],
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
        embeddedWallets: {
          solana: {
            createOnLogin: "off",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
