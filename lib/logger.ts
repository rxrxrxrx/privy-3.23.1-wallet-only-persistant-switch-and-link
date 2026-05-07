/**
 * Production-safe logger. In dev, logs to console with a prefix. In prod,
 * `debug` and `info` are no-ops (replace with Sentry/Datadog client when ready);
 * `warn` and `error` always log to console so prod issues are visible in
 * browser dev tools and reachable from a `console.error` capture in your
 * monitoring stack.
 */

const isDev = process.env.NODE_ENV === "development";

function fmt(level: string, msg: string) {
  return `[${level}] ${msg}`;
}

export const logger = {
  debug(msg: string, ...rest: unknown[]) {
    if (isDev) console.log(fmt("DEBUG", msg), ...rest);
  },
  info(msg: string, ...rest: unknown[]) {
    if (isDev) console.info(fmt("INFO", msg), ...rest);
  },
  warn(msg: string, ...rest: unknown[]) {
    console.warn(fmt("WARN", msg), ...rest);
  },
  error(msg: string, ...rest: unknown[]) {
    console.error(fmt("ERROR", msg), ...rest);
  },
};
