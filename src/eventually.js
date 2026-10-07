// Eventual-consistency helpers: retry an assertion or poll a value until a
// condition holds or a timeout elapses. Useful for APIs whose state converges
// asynchronously (caches, queues, replicas). Zero dependencies.

import { sleep as delay } from "./utils/function.js";

// Repeatedly invoke `fn` (awaiting any promise it returns) until it does not
// throw, resolving with its return value. If it keeps throwing past `timeout`,
// reject with the LAST error (its message prefixed with `message` if provided).
export async function eventually(fn, options = {}) {
  const { timeout = 5000, interval = 100, message } = options;
  const start = performance.now();
  let lastError;

  for (;;) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }

    if (performance.now() - start >= timeout) {
      if (message) {
        lastError = decorateError(lastError, message);
      }
      throw lastError;
    }

    await delay(interval);
  }
}

// Alias of `eventually` for callers who prefer retry-oriented naming.
export const retryUntil = eventually;

// Repeatedly call `fn` (awaiting any promise) and resolve with its result once
// `predicate(result)` is truthy. On timeout, throw an Error explaining that the
// predicate never became true (prefixed with `message` if provided).
export async function pollUntil(fn, predicate, options = {}) {
  const { timeout = 5000, interval = 100, message } = options;
  const start = performance.now();
  let lastResult;

  for (;;) {
    lastResult = await fn();
    if (predicate(lastResult)) return lastResult;

    if (performance.now() - start >= timeout) {
      const base = `pollUntil: predicate never became true within ${timeout}ms`;
      throw new Error(message ? `${message}: ${base}` : base);
    }

    await delay(interval);
  }
}

// Prefix an error's message with `message`, preserving the original error type
// when possible so callers can still inspect it.
function decorateError(error, message) {
  if (error instanceof Error) {
    error.message = `${message}: ${error.message}`;
    return error;
  }
  return new Error(`${message}: ${String(error)}`);
}
