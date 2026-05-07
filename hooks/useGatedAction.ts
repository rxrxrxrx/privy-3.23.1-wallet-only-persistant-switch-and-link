"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLogin } from "@/hooks/usePrivyTracking";

const DEFAULT_AUTH_TIMEOUT_MS = 90_000;

export type GatedActionErrorKind =
  | "auth_cancelled"
  | "auth_failed"
  | "session_expired"
  | "execution_failed"
  | "replaced";

export class GatedActionError extends Error {
  kind: GatedActionErrorKind;
  cause?: unknown;
  constructor(kind: GatedActionErrorKind, cause?: unknown) {
    super(kind);
    this.kind = kind;
    this.cause = cause;
  }
}

type GatedActionOptions = {
  timeoutMs?: number;
};

export function useGatedAction<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult> | TResult,
  options?: GatedActionOptions,
) {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();

  const pendingRef = useRef<{
    args: TArgs;
    resolve: (v: TResult | undefined) => void;
    reject: (e: GatedActionError) => void;
  } | null>(null);
  const drainingRef = useRef(false);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const [isAwaitingAuth, setIsAwaitingAuth] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const clearCancelTimer = useCallback(() => {
    if (cancelTimerRef.current) {
      clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
    }
  }, []);

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    const pending = pendingRef.current;
    if (!pending) return;
    drainingRef.current = true;
    pendingRef.current = null;
    setIsAwaitingAuth(false);
    clearCancelTimer();
    try {
      const result = await Promise.resolve(handlerRef.current(...pending.args));
      pending.resolve(result);
    } catch (err) {
      pending.reject(new GatedActionError("execution_failed", err));
    } finally {
      drainingRef.current = false;
      setIsPending(false);
    }
  }, [clearCancelTimer]);

  useEffect(() => {
    if (authenticated && pendingRef.current) {
      drain();
    } else if (!authenticated && pendingRef.current && !isAwaitingAuth) {
      const p = pendingRef.current;
      pendingRef.current = null;
      setIsPending(false);
      p.reject(new GatedActionError("session_expired"));
    }
  }, [authenticated, drain, isAwaitingAuth]);

  useEffect(() => {
    return () => {
      clearCancelTimer();
      if (pendingRef.current) {
        pendingRef.current.reject(new GatedActionError("replaced"));
        pendingRef.current = null;
      }
    };
  }, [clearCancelTimer]);

  const run = useCallback(
    (...args: TArgs): Promise<TResult | undefined> => {
      return new Promise<TResult | undefined>((resolve, reject) => {
        if (!ready) {
          reject(new GatedActionError("execution_failed", "privy not ready"));
          return;
        }

        if (pendingRef.current) {
          pendingRef.current.reject(new GatedActionError("replaced"));
        }
        pendingRef.current = { args, resolve, reject };
        setIsPending(true);

        if (authenticated) {
          drain();
          return;
        }

        setIsAwaitingAuth(true);
        clearCancelTimer();
        cancelTimerRef.current = setTimeout(() => {
          if (pendingRef.current && !drainingRef.current) {
            const p = pendingRef.current;
            pendingRef.current = null;
            setIsAwaitingAuth(false);
            setIsPending(false);
            p.reject(new GatedActionError("auth_cancelled"));
          }
        }, options?.timeoutMs ?? DEFAULT_AUTH_TIMEOUT_MS);
        login();
      });
    },
    [ready, authenticated, drain, login, clearCancelTimer, options?.timeoutMs],
  );

  const cancel = useCallback(() => {
    clearCancelTimer();
    if (pendingRef.current) {
      pendingRef.current.reject(new GatedActionError("replaced"));
      pendingRef.current = null;
    }
    setIsAwaitingAuth(false);
    setIsPending(false);
  }, [clearCancelTimer]);

  return { run, cancel, isPending, isAwaitingAuth, ready, authenticated };
}
