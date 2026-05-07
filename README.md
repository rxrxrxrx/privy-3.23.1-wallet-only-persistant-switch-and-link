# Privy v3.23 + Solana — wallet-only, persistent switch & link

Fork of [`privy-io/create-solana-next-app`](https://github.com/privy-io/create-solana-next-app) (originally v2.24, archived upstream) — migrated to `@privy-io/react-auth@3.23.1`, refactored for an external-wallet-only Solana app with action-triggered auth, persistent multi-wallet switching, and a built-in SIWS quota tracker.

This is a Next.js 15 (App Router) + React 19 starter for Solana dApps using Privy as auth + wallet aggregation, with no embedded wallets, no email/SMS login, just SIWS via Phantom / Solflare / Backpack / WalletConnect-mobile.

## What this fork adds vs. upstream

- **Migrated to Privy v3.23.1** (upstream is on v2.24.0).
- **De-gated app** — homepage redirects to `/dashboard`, dashboard is publicly viewable, login is triggered only when the user attempts a protected action (sign / send / link).
- **Wallet-only login** (`loginMethods: ["wallet"]`, `embeddedWallets.solana.createOnLogin: "off"`).
- **Multi-wallet management** with `useLinkWithSiws` headless flow — link N wallets to one Privy user, switch between them at zero SIWS cost.
- **Live wallet-switch handling** — listens to `wallet-standard:events.change` + `visibilitychange` so the dashboard stays in sync when the user switches accounts inside Phantom/Solflare without forcing a hard refresh.
- **SIWS quota tracker** — a `fetch` interceptor that observes `/api/v1/siws/{authenticate,link}` responses and writes to `localStorage` with a 7-day sliding window matching Privy's rate-limit window. Privy doesn't expose `x-ratelimit-*` via CORS, so this is the only way to surface usage to the user. Includes a debug panel showing remaining quota.
- **Session keepalive** — calls `getAccessToken()` on mount and on focus to rotate the refresh token; an active user never needs to re-do SIWS.
- **Production headers** — strict CSP allowlist for Privy + WalletConnect + Solana RPC, HSTS, COOP `same-origin-allow-popups` (for SIWS popup), X-Frame-Options DENY, Permissions-Policy lockdown. CSP is dev-gated so HMR/source maps still work.
- **Error boundaries** for `/` and `/dashboard`.
- **Env validation** — boot-time check that `NEXT_PUBLIC_PRIVY_APP_ID` is set; safe defaults for Solana RPC URLs.
- **Mobile-aware wallet list** — drops `wallet_connect_qr_*` / `detected_solana_wallets` on mobile (browsers don't inject extension wallets there).
- **Logout confirm** to avoid accidental SIWS burns on next login.
- **Debug panel** (auto in dev, opt-in via `?debug=privy` or `localStorage.rise:debug=1` in prod) — Privy state, linked vs connected wallets, JWT exp, SIWS counter, and a "+1 test SIWS" button to validate the pipeline without burning quota.

## Setup

```bash
# Use Node 22 (Privy v3 + Next.js 15 + Node 25's experimental Web Storage = SSR crash; pinned via .nvmrc + engines)
nvm use

npm install              # or pnpm / yarn

cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_PRIVY_APP_ID at minimum (from https://dashboard.privy.io)

npm run dev
```

Then visit [http://localhost:3000](http://localhost:3000).

## Architecture

| File | Role |
|---|---|
| `components/providers.tsx` | `PrivyProvider` config: Solana-only, no embedded wallets, mobile-aware `walletList`, side-effect import of the SIWS fetch interceptor. |
| `app/layout.tsx` | Mounts `<SessionKeepalive />` and the dynamic-imported `<DebugPanelLoader />`. |
| `app/dashboard/page.tsx` | Open-browse dashboard. Renders connected + linked wallets (merged view), gates actions behind login. |
| `components/loginButton.tsx` | Calls `useLogin().login()` (wrapped). |
| `components/addWalletButton.tsx` | Headless `useConnectWallet` → `generateSiwsMessage` → `wallet.signMessage` → `linkWithSiws` flow. |
| `components/walletEntryCard.tsx` | Wallet card with `Linked` / `In extension` / `Offline` / `Active` badges. |
| `components/sessionKeepalive.tsx` | `getAccessToken()` on mount + focus + visibilitychange. |
| `components/debugPanel.tsx` | Floating dev/diag panel — Privy state, linked vs connected, SIWS counter, recent log entries. |
| `lib/siwsFetchInterceptor.ts` | `window.fetch` monkeypatch that detects successful `/api/v1/siws/*` responses and logs to the SIWS tracker. The authoritative SIWS counter source. |
| `lib/siwsTracker.ts` | localStorage-backed store, 7-day sliding window, cross-tab sync via `storage` event, StrictMode-safe dedupe, `useSyncExternalStore` hooks. |
| `hooks/usePrivyTracking.ts` | Thin wrappers around `useLogin` / `useLinkWithSiws` — used to log failed link attempts (interceptor only sees responses). |
| `hooks/useGatedAction.ts` | State machine for "trigger login on action click, replay action after auth". |
| `lib/env.ts` | Boot-time env validation. |
| `lib/errors.ts` | `errorIndicatesRateLimit` (HTTP 429), `errorIndicatesUserRejected`. |
| `lib/logger.ts` | Dev-only `debug`/`info`; prod-visible `warn`/`error`. Wire to Sentry/Datadog when ready. |
| `next.config.ts` | CSP + security headers (prod only — relaxed in dev). |

## Things to know before deploying

- **Allowed domains** must be set in the Privy dashboard for the production host. Vercel preview URLs (`*.vercel.app`) shouldn't be whitelisted directly; set up a custom preview domain (`*.preview.your-domain.com`) and add that.
- **Verified domain** in the Privy dashboard switches Privy auth tokens to `HttpOnly` cookies. Recommended for prod. Once enabled, the SDK auto-detects and stops writing JS-readable cookie copies.
- **App clients** — create one per environment (`prod`, `preview`, `local-dev`) and pass `NEXT_PUBLIC_PRIVY_CLIENT_ID` accordingly. Already wired in `lib/env.ts` + `providers.tsx`.
- **Captcha** — enable Cloudflare Turnstile in the Privy dashboard for SIWS bot protection. Already allow-listed in the CSP.
- **Server-side token verification** — when API routes are added, verify the Privy access token via `@privy-io/server-auth`. `PRIVY_APP_SECRET` must stay strictly server-only.
- **Node version** — pinned to `>=20 <25` in `package.json` engines + `.nvmrc`. Privy v3 has unguarded `localStorage.getItem` calls during SSR that crash on Node 25's experimental Web Storage proxy. Use Node 22 LTS (also Vercel's default).

## SIWS quota notes

Privy rate-limits SIWS at 180 per wallet per rolling 7 days (undocumented; confirmed via support). The `x-ratelimit-{limit,remaining,reset}` response headers are sent by Privy but not exposed via CORS, so JS can't read them. The interceptor in `lib/siwsFetchInterceptor.ts` counts client-side as a workaround.

What burns a SIWS:
- `useLogin().login()` when the user picks a wallet (`loginMethod: "siws"` flow → `POST /api/v1/siws/authenticate`)
- `linkWithSiws()` (`POST /api/v1/siws/link`)

What does NOT burn a SIWS:
- Session restoration via refresh token (silent, hits `/api/v1/sessions`)
- `useConnectWallet` (just attaches the wallet adapter)
- `setActiveWallet` (pure local state)
- Signing a transaction (wallet-side signature, not Privy auth)
- User cancelling the wallet popup before signing

## License

[MIT](LICENSE) — same as upstream.
