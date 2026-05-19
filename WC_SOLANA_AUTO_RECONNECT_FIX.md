# WalletConnect-Solana auto-reconnect bug in `@privy-io/react-auth@3.23.1`

> **Status:** Bug reproduces on this repo. We have a working workaround but
> intentionally **reverted it** so Privy support can confirm the underlying SDK
> bug. The fix code is still in git history at commit
> `f7050616742b5b46f8eb22f6624d9eef79b8d77d` and can be re-applied with
> `git cherry-pick f705061` or `git revert <the-revert-commit>`.

## TL;DR

After a page refresh, the Privy SDK skips silent reconnect for any Solana wallet
discovered via WalletConnect — TokenPocket, Trust, Bitget mobile, OKX mobile,
SafePal — even though the WalletConnect session is still persisted in
`localStorage` (`wc@2:*` keys). The user appears authenticated to Privy
(`usePrivy().authenticated === true`, `user.linkedAccounts` intact) but
`useWallets()` returns `[]`, forcing them to click "Reconnect", which triggers
a fresh SIWS challenge and burns one slot of the 180/wallet/7d SIWS quota.

For mobile-heavy traffic on WC-Solana wallets, this is the dominant source of
SIWS quota exhaustion.

## Root cause

File: `node_modules/@privy-io/react-auth/dist/esm/use-unlink-wallet-*.mjs`
Class: `SolanaAdapterConnector`

### The allow-list miss

```js
// Allow-list checked by shouldAttemptAutoConnect():
let me = [
  "phantom", "metamask", "glow", "solflare", "backpack",
  "okx_wallet", "walletconnect", "mobile_wallet_adapter", "jupiter"
];

shouldAttemptAutoConnect() {
  return !(!this.autoConnectEnabled || !me.includes(this.walletClientType))
    && (... extra check for phantom/metamask ...);
}
```

### The walletClientType assignment

```js
class ge extends pe {  // SolanaAdapterConnector
  constructor(e, t) {
    super(we(Ce(e) ? "walletconnect_solana" : e.name)),
    // ...
  }
}

function Ce(e) {
  return "isWalletConnectSolana" in e && e.isWalletConnectSolana;
}
```

So every WC-discovered Solana wallet gets `walletClientType = "walletconnect_solana"`,
which is NOT in the `me` allow-list → `shouldAttemptAutoConnect()` returns
`false` → silent reconnect is skipped on init.

`me` contains `"walletconnect"` (EVM variant) but is missing `"walletconnect_solana"`.

### The connector DOES try to restore the WC session

`SolanaAdapterConnector.initialize()` calls `restoreSession()` which reads the
existing WC session from `client.session.getAll()` (i.e. the `wc@2:*` keys in
`localStorage`). It logs `"Restored Solana WalletConnect session"`. But the
final `standard:connect({silent:true})` call is gated by the allow-list
filter, so the accounts never get hydrated into `useWallets()`.

## Reproduction

Tested in this repo (`create-solana-next-app` migrated to `@privy-io/react-auth@3.23.1`).

1. `npm install && npm run dev`
2. Open the dev URL in **TokenPocket mobile in-app browser** (or use a desktop
   browser pretending to be one via UA spoof — `?ua=tokenpocket` if you wire it,
   else use a real device).
3. Click "Connect wallet" → pick TokenPocket → sign SIWS. Wallet is connected.
4. Inspect `localStorage` in DevTools: confirm `wc@2:client:0.3:session`,
   `wc@2:core:0.3:pairing`, `wc@2:core:0.3:keychain` keys present.
5. Refresh the page.
6. `usePrivy().authenticated === true` (Privy session via cookie/JWT)
7. `usePrivy().user.linkedAccounts` still contains the Solana wallet.
8. `useWallets().wallets` returns `[]`. **Bug confirmed.**
9. Click "Reconnect" → fresh WC pairing → SIWS challenge → burns 1 quota slot.

Generic across all WC-Solana wallets — not TokenPocket-specific.

## Upstream fix (one line)

In `dist/esm/use-unlink-wallet-*.mjs`, add `"walletconnect_solana"` to the
`me` allow-list:

```diff
- let me = ["phantom","metamask","glow","solflare","backpack","okx_wallet","walletconnect","mobile_wallet_adapter","jupiter"];
+ let me = ["phantom","metamask","glow","solflare","backpack","okx_wallet","walletconnect","walletconnect_solana","mobile_wallet_adapter","jupiter"];
```

Or, equivalently, change the connector constructor to use a canonical name
that's already in the allow-list.

## App-side workaround (the reverted fix)

A layout-mounted hook that bypasses Privy's faulty allow-list by calling
Wallet Standard `standard:connect({silent: true})` directly on every Solana
wallet in the registry, when:

- `usePrivy().ready === true`
- `usePrivy().authenticated === true`
- `useWallets().wallets.length === 0`
- `usePrivy().user.linkedAccounts` has at least one wallet with `chainType: "solana"`

Silent connect is a Wallet Standard handshake — not a Privy auth call — so it
costs **0 SIWS quota**.

### Files (in commit `f705061`)

- `hooks/useReattachSolanaWallets.ts` — the hook (~70 lines, one-shot via `tried.current` ref)
- `components/walletReattach.tsx` — null-render wrapper, mirrors `<SessionKeepalive />` pattern
- `app/layout.tsx` — mounts `<WalletReattach />` alongside other infra components
- `package.json` — declares `@wallet-standard/app` explicitly (was transitive via Privy)

### Re-apply locally

```bash
git cherry-pick f705061
# or, to revert the revert:
git revert <revert-commit-hash>
```

### Verified behavior with fix applied

- TokenPocket mobile in-app browser: page refresh → wallet stays connected,
  zero new SIWS, action buttons immediately usable.
- Desktop Phantom: no change in behavior (already in Privy's allow-list).
- Solflare, Backpack (native): no change.
- OKX (browser extension, not mobile WC): no change.

## Why we reverted

To leave this repo in a state where Privy support can:

1. Clone, `npm install`, `npm run dev`.
2. Reproduce the bug in 5 minutes.
3. Confirm the one-line SDK fix.
4. Cherry-pick `f705061` to verify the workaround is no longer needed once
   the SDK is patched.

Once Privy ships the SDK fix, the workaround commit becomes obsolete and can
be ignored. Anyone who hits the bug in production today can apply the
workaround with `git cherry-pick f705061`.

## Contact

Bug reported via the Privy Slack support thread (Toyosi). The one-sentence
description sent to support:

> In `@privy-io/react-auth@3.23.1`, the
> `SolanaAdapterConnector.shouldAttemptAutoConnect()` allow-list (`me` array)
> in `dist/esm/use-unlink-wallet-*.mjs` includes `"walletconnect"` but not
> `"walletconnect_solana"`, yet WC-discovered Solana wallets (TokenPocket,
> Trust, Bitget mobile, OKX mobile, SafePal) get
> `walletClientType: "walletconnect_solana"` via the
> `Ce(e)?"walletconnect_solana":e.name` ternary in the connector constructor —
> so silent reconnect is skipped after page refresh even though the WC session
> is still persisted in `localStorage` (`wc@2:*` keys), forcing our users to
> re-trigger SIWS and burn quota. One-line fix on your side (add
> `"walletconnect_solana"` to the allow-list).
