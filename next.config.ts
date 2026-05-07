import type { NextConfig } from "next";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const WS_URL =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL ?? "wss://api.mainnet-beta.solana.com";

const rpcOrigin = (() => {
  try {
    return new URL(RPC_URL).origin;
  } catch {
    return "https://api.mainnet-beta.solana.com";
  }
})();

const wsOrigin = (() => {
  try {
    return new URL(WS_URL).origin;
  } catch {
    return "wss://api.mainnet-beta.solana.com";
  }
})();

// CSP merged from Privy's docs (https://docs.privy.io/security/implementation-guide/content-security-policy)
// + Solana wallet-standard + WalletConnect + analytics + Cloudflare Turnstile.
const csp = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  // Tailwind v4 + Next.js inject styles inline.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com",
  "child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
  [
    "connect-src 'self'",
    "https://auth.privy.io",
    "https://api.privy.io",
    "https://*.rpc.privy.systems",
    "wss://relay.walletconnect.com",
    "wss://relay.walletconnect.org",
    "wss://www.walletlink.org",
    "https://explorer-api.walletconnect.com",
    rpcOrigin,
    wsOrigin,
  ].join(" "),
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // `same-origin` would break Privy's OAuth / SIWS popup flow which relies on
  // `window.opener.postMessage`. `same-origin-allow-popups` keeps the cross-origin
  // isolation benefits while permitting Privy's popup-based auth handshake.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const isDev = process.env.NODE_ENV !== "production";

// In dev, Next.js needs 'unsafe-eval' for HMR/source maps and the React error
// overlay. CSP is therefore PROD-ONLY. In dev we keep the lighter headers
// (X-Content-Type-Options, etc.) but skip CSP entirely so the dev server
// (and Privy SDK init) can run without the strict allowlist getting in the way.
const devHeaders = securityHeaders.filter(
  (h) => h.key !== "Content-Security-Policy" && h.key !== "Strict-Transport-Security",
);

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.externals["@solana/web3.js"] = "commonjs @solana/web3.js";
    config.externals["@solana/spl-token"] = "commonjs @solana/spl-token";

    // Silence harmless "Module not found" warnings for optional peer deps
    // that the Privy SDK declares but we never use (Farcaster mini-app,
    // Abstract Global Wallet, permissionless smart accounts). Listed as
    // peerOptional in @privy-io/react-auth's package.json.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /@privy-io[\\/]react-auth/,
        message: /Can't resolve '@farcaster\/mini-app-solana'/,
      },
      {
        module: /@privy-io[\\/]react-auth/,
        message: /Can't resolve '@abstract-foundation\/agw-client'/,
      },
      {
        module: /@privy-io[\\/]react-auth/,
        message: /Can't resolve 'permissionless/,
      },
    ];
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: isDev ? devHeaders : securityHeaders,
      },
    ];
  },
};

export default nextConfig;
