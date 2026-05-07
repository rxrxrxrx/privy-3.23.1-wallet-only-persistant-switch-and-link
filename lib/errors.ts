export function errorIndicatesRateLimit(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; status?: unknown };
  return e.code === "too_many_requests" || e.status === 429;
}

export function errorIndicatesUserRejected(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === "user_rejected_request" || e.code === "user_rejected") return true;
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return msg.includes("user rejected") || msg.includes("user denied");
}
