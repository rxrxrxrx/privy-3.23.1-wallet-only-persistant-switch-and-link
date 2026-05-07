/**
 * Validated public env vars. Throws at boot if a required variable is missing,
 * so we fail loudly instead of shipping a silently broken app.
 *
 * Server-only secrets (e.g. PRIVY_APP_SECRET) are read in their respective
 * server modules to avoid bundling them into the client.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required env var: ${name}. Set it in .env.local for dev or your hosting provider for prod.`,
    );
  }
  return value;
}

function optional(value: string | undefined, fallback: string): string {
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  PRIVY_APP_ID: required(
    "NEXT_PUBLIC_PRIVY_APP_ID",
    process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  ),
  PRIVY_CLIENT_ID: process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || undefined,
  SOLANA_RPC_URL: optional(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    "https://api.mainnet-beta.solana.com",
  ),
  SOLANA_WS_URL: optional(
    process.env.NEXT_PUBLIC_SOLANA_WS_URL,
    "wss://api.mainnet-beta.solana.com",
  ),
} as const;
