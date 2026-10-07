// Internal helpers shared by the response assertion modules. Not part of the
// public API (not listed in package.json "exports").

import { AssertionError } from "./assertions.js";

// Throw an AssertionError using the standard `METHOD URL -> description` prefix.
export function failResponse(response, description, info) {
  throw new AssertionError(`${response.method} ${response.url} -> ${description}`, info);
}

// Human readable rendering of a matcher/value for error messages.
export function describeMatcher(value) {
  if (value instanceof RegExp) return value.toString();
  if (typeof value === "function") return value.name ? `predicate ${value.name}` : "predicate";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
