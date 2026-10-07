// Core assertion primitives shared by GoResponse and RequestBuilder.
// Deep equality is delegated to isEqual from the utility belt so there is a
// single, correct source of truth (it handles Date, RegExp, Map, Set, NaN).
import { isEqual } from "./utils/lang.js";
import { get } from "./utils/object.js";

// Error thrown by every failing assertion. Carries the expected/actual values
// so test runners (and humans) can inspect the mismatch.
export class AssertionError extends Error {
  constructor(message, { expected, actual } = {}) {
    super(message);
    this.name = "AssertionError";
    this.expected = expected;
    this.actual = actual;
  }
}

// Resolve a dot + bracket path against an object.
// Supports "data[0].user.name" and "items.2.id" styles.
// Returns undefined for any missing segment instead of throwing.
export function resolvePath(obj, path) {
  return get(obj, path);
}

// Flexible value matcher used by expectJson / expectHeader / expectBody.
// - RegExp:   test against String(actual)
// - function: treat as predicate, truthy return means match
// - object/array: deep equality (Date/RegExp/Map/Set aware via isEqual)
// - primitive: strict ===
export function matches(actual, expected) {
  if (expected instanceof RegExp) {
    return expected.test(String(actual));
  }
  if (typeof expected === "function") {
    return Boolean(expected(actual));
  }
  if (expected !== null && typeof expected === "object") {
    return isEqual(actual, expected);
  }
  return actual === expected;
}

// Deep structural equality. Kept as a named export for back-compat; it is the
// same correct implementation used everywhere else.
export { isEqual as deepEqual };
