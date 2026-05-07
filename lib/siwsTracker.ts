"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "rise:privy:siws-log";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const HARD_CAP = 500;

export type SiwsType = "login" | "link";

export type SiwsEntry = {
  ts: number;
  type: SiwsType;
  walletAddress: string;
  walletClientType: string;
  success: boolean;
  errorCode?: string;
  sessionId: string;
  synthetic?: boolean;
};

type SiwsLog = { version: 1; entries: SiwsEntry[] };

const EMPTY_LOG: SiwsLog = { version: 1, entries: [] };
const EMPTY_ENTRIES: SiwsEntry[] = [];

let cached: SiwsLog | null = null;
const listeners = new Set<() => void>();

let _sessionId: string | null = null;
function getSessionId(): string {
  if (_sessionId) return _sessionId;
  _sessionId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return _sessionId;
}

function isValidEntry(e: unknown): e is SiwsEntry {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.ts === "number" &&
    Number.isFinite(o.ts) &&
    (o.type === "login" || o.type === "link") &&
    typeof o.walletAddress === "string" &&
    typeof o.walletClientType === "string" &&
    typeof o.success === "boolean" &&
    typeof o.sessionId === "string"
  );
}

function read(): SiwsLog {
  if (typeof window === "undefined") return EMPTY_LOG;
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cached = EMPTY_LOG;
      return cached;
    }
    const parsed = JSON.parse(raw) as { entries?: unknown };
    const now = Date.now();
    const validEntries = Array.isArray(parsed.entries)
      ? parsed.entries.filter(isValidEntry)
      : [];
    cached = {
      version: 1,
      entries: validEntries
        .filter((e) => now - e.ts < RETENTION_MS)
        .slice(-HARD_CAP),
    };
    return cached;
  } catch {
    cached = EMPTY_LOG;
    return cached;
  }
}

function write(log: SiwsLog) {
  cached = log;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch {
      // storage full / disabled — silent
    }
  }
  listeners.forEach((fn) => fn());
}

let storageListenerAttached = false;
function ensureStorageListener() {
  if (storageListenerAttached || typeof window === "undefined") return;
  storageListenerAttached = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    cached = null;
    listeners.forEach((fn) => fn());
  });
}

function subscribe(fn: () => void) {
  ensureStorageListener();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const dedupeWindowMs = 2000;
const recentDedupeKeys = new Map<string, number>();

export const siwsTracker = {
  log(entry: Omit<SiwsEntry, "ts" | "sessionId">) {
    const ts = Date.now();
    const sessionId = getSessionId();
    const dedupeKey = `${entry.type}:${entry.walletAddress}:${Math.floor(
      ts / dedupeWindowMs,
    )}:${sessionId}`;
    if (recentDedupeKeys.has(dedupeKey)) return;
    recentDedupeKeys.set(dedupeKey, ts);
    if (recentDedupeKeys.size > 50) {
      const cutoff = ts - 60_000;
      for (const [k, v] of recentDedupeKeys) {
        if (v < cutoff) recentDedupeKeys.delete(k);
      }
    }

    const log = read();
    const next: SiwsLog = {
      version: 1,
      entries: [
        ...log.entries.filter((e) => ts - e.ts < RETENTION_MS),
        { ...entry, ts, sessionId },
      ].slice(-HARD_CAP),
    };
    write(next);
  },

  getCount(walletAddress?: string, opts?: { includeFailed?: boolean }) {
    const log = read();
    const now = Date.now();
    return log.entries.filter(
      (e) =>
        now - e.ts < RETENTION_MS &&
        !e.synthetic &&
        (opts?.includeFailed ? true : e.success) &&
        (!walletAddress || e.walletAddress === walletAddress),
    ).length;
  },

  getAllEntries(): SiwsEntry[] {
    return read().entries;
  },

  clear() {
    write(EMPTY_LOG);
  },

  subscribe,
};

function getSnapshot(): SiwsLog {
  return read();
}

function getServerSnapshot(): SiwsLog {
  return EMPTY_LOG;
}

export function useSiwsLog(): SiwsEntry[] {
  const log = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return log.entries.length === 0 ? EMPTY_ENTRIES : log.entries;
}

export function useSiwsCount(walletAddress?: string): number {
  return useSyncExternalStore(
    subscribe,
    () => siwsTracker.getCount(walletAddress),
    () => 0,
  );
}
