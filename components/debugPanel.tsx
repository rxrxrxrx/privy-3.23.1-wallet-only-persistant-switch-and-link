"use client";

import { useIdentityToken, usePrivy, useToken, useUser } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { useEffect, useState } from "react";
import {
  siwsTracker,
  useSiwsCount,
  useSiwsLog,
  type SiwsEntry,
} from "@/lib/siwsTracker";

const SIWS_LIMIT = 180;

function decodeJwtExp(jwt: string | null): number | null {
  if (!jwt) return null;
  try {
    const [, payload] = jwt.split(".");
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

function shortAddr(addr: string): string {
  if (!addr) return "—";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function formatRelative(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function DebugPanel() {
  const [open, setOpen] = useState(true);

  return (
    <div className="fixed bottom-4 right-4 z-[2147483000] font-mono text-xs">
      {open ? (
        <DebugBody onClose={() => setOpen(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-2 rounded-lg shadow-lg"
        >
          🔍 Debug
        </button>
      )}
    </div>
  );
}

function DebugBody({ onClose }: { onClose: () => void }) {
  const { ready, authenticated, logout } = usePrivy();
  const { user, refreshUser } = useUser();
  const { wallets } = useWallets();
  const { getAccessToken } = useToken();
  const { identityToken } = useIdentityToken();

  const totalCount = useSiwsCount();
  const entries = useSiwsLog();

  const [accessTokenExp, setAccessTokenExp] = useState<number | null>(null);
  const [accessTokenError, setAccessTokenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!authenticated) {
      setAccessTokenExp(null);
      return;
    }
    getAccessToken()
      .then((token) => {
        if (cancelled) return;
        setAccessTokenExp(decodeJwtExp(token));
        setAccessTokenError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setAccessTokenError(String(err?.message ?? err));
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  const linkedWallets = (user?.linkedAccounts ?? []).filter(
    (a) => a.type === "wallet",
  ) as Array<{ address: string; chainType: string; walletClientType?: string }>;

  const counterColor =
    totalCount >= SIWS_LIMIT * 0.9
      ? "text-red-400"
      : totalCount >= SIWS_LIMIT * 0.66
        ? "text-amber-400"
        : "text-green-400";

  const expSec = accessTokenExp;
  const expRelative = expSec
    ? Math.max(0, expSec * 1000 - Date.now())
    : null;

  return (
    <div className="bg-zinc-950/95 border border-purple-700 rounded-lg shadow-2xl text-white max-h-[80vh] overflow-y-auto w-80">
      <header className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 sticky top-0 bg-zinc-950">
        <span className="font-bold">🔍 Privy Debug</span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Copy debug state to clipboard"
            onClick={() => {
              const snapshot = JSON.stringify(
                {
                  ready,
                  authenticated,
                  userId: user?.id ?? null,
                  linkedWallets,
                  wallets: wallets.map((w) => ({
                    address: w.address,
                    name: w.standardWallet.name,
                  })),
                  siws: { count7d: totalCount, limit: SIWS_LIMIT, entries },
                },
                null,
                2,
              );
              navigator.clipboard
                ?.writeText(snapshot)
                .catch(() => alert("Clipboard write blocked. State logged to console instead."))
                ?.finally(() => console.log("[Privy debug snapshot]", snapshot));
            }}
            className="text-zinc-400 hover:text-white"
            title="Copy state"
          >
            📋
          </button>
          <button
            type="button"
            aria-label="Close debug panel"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      </header>

      <Section label="Privy state">
        <Row k="ready" v={String(ready)} />
        <Row k="authenticated" v={String(authenticated)} />
        <Row k="user.id" v={user?.id ? shortAddr(user.id) : "—"} />
        <Row k="isGuest" v={String(user?.isGuest ?? false)} />
      </Section>

      <Section label="SIWS counter (7d)">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${counterColor}`}>
            {totalCount}
          </span>
          <span className="text-zinc-500">/ {SIWS_LIMIT}</span>
        </div>
        {entries.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {entries
              .slice(-5)
              .reverse()
              .map((e: SiwsEntry, i: number) => (
                <li
                  key={`${e.ts}-${i}`}
                  className="flex justify-between gap-2 text-[11px]"
                >
                  <span
                    className={
                      e.success ? "text-green-400" : "text-red-400"
                    }
                  >
                    {e.success ? "✓" : "✗"} {e.type}
                  </span>
                  <span className="text-zinc-400 truncate">
                    {shortAddr(e.walletAddress)}
                  </span>
                  <span className="text-zinc-500">{formatRelative(e.ts)}</span>
                </li>
              ))}
          </ul>
        ) : (
          <span className="text-zinc-500">No SIWS yet.</span>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm("Clear SIWS log?")) siwsTracker.clear();
          }}
          className="mt-2 text-[11px] text-zinc-500 hover:text-white underline"
        >
          Clear log
        </button>
      </Section>

      <Section label={`Linked wallets (${linkedWallets.length})`}>
        {linkedWallets.length === 0 ? (
          <span className="text-zinc-500">None</span>
        ) : (
          linkedWallets.map((w) => (
            <Row
              key={w.address}
              k={w.walletClientType ?? "wallet"}
              v={`${shortAddr(w.address)} (${w.chainType})`}
            />
          ))
        )}
      </Section>

      <Section label={`Connected wallets (${wallets.length})`}>
        {wallets.length === 0 ? (
          <span className="text-zinc-500">None</span>
        ) : (
          wallets.map((w) => (
            <Row
              key={w.address}
              k={w.standardWallet.name}
              v={shortAddr(w.address)}
            />
          ))
        )}
      </Section>

      <Section label="Token">
        {accessTokenError ? (
          <span className="text-red-400">{accessTokenError}</span>
        ) : (
          <>
            <Row
              k="access exp"
              v={
                expSec
                  ? `${new Date(expSec * 1000).toLocaleTimeString()} (${
                      expRelative !== null
                        ? Math.floor(expRelative / 1000) + "s"
                        : "?"
                    })`
                  : "—"
              }
            />
            <Row k="identity" v={identityToken ? "present" : "—"} />
          </>
        )}
      </Section>

      <Section label="Actions">
        <div className="flex flex-wrap gap-1">
          <Btn onClick={() => refreshUser()}>refreshUser</Btn>
          <Btn onClick={() => getAccessToken().catch(() => {})}>
            getAccessToken
          </Btn>
          <Btn
            onClick={() =>
              siwsTracker.log({
                type: "login",
                walletAddress: "test_" + Math.random().toString(36).slice(2, 8),
                walletClientType: "test",
                success: true,
              })
            }
          >
            +1 test SIWS
          </Btn>
          {authenticated ? (
            <Btn onClick={() => logout()}>logout</Btn>
          ) : null}
        </div>
      </Section>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-3 py-2 border-b border-zinc-800">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </div>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-zinc-400">{k}</span>
      <span className="text-white truncate" title={v}>
        {v}
      </span>
    </div>
  );
}

function Btn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded"
    >
      {children}
    </button>
  );
}
