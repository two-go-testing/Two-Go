// GoResponse wraps a resolved HTTP response and exposes inline assertion
// methods. Every assertion returns `this` for chaining and throws an
// AssertionError on failure, so it works with any test runner.

import { resolvePath, matches } from "./assertions.js";
import { failResponse, describeMatcher as describe } from "./internal.js";

export class GoResponse {
  constructor({ status, statusText, headers, body, text, time, url, method }) {
    this.status = status;
    this.statusText = statusText;
    this.headers = headers || {};
    this.body = body;
    this.text = text;
    this.time = time;
    this.url = url;
    this.method = method;
  }

  // Throw with the standard `METHOD URL -> description` prefix.
  #fail(description, info) {
    failResponse(this, description, info);
  }

  // Exact status match.
  expectStatus(code) {
    if (this.status !== code) {
      this.#fail(
        `expected status ${code} but got ${this.status}`,
        { expected: code, actual: this.status }
      );
    }
    return this;
  }

  // Status must be one of the given codes, passed variadically or as one array.
  expectStatusIn(...args) {
    const codes = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    if (!codes.includes(this.status)) {
      this.#fail(
        `expected status in [${codes.join(", ")}] but got ${this.status}`,
        { expected: codes, actual: this.status }
      );
    }
    return this;
  }

  // Any 2xx status.
  expectOk() {
    if (this.status < 200 || this.status >= 300) {
      this.#fail(
        `expected a 2xx status but got ${this.status}`,
        { expected: "2xx", actual: this.status }
      );
    }
    return this;
  }

  // Header existence (no matcher) or value match (with matcher).
  expectHeader(name, matcher) {
    const key = String(name).toLowerCase();
    const value = this.headers[key];

    if (value === undefined) {
      this.#fail(
        `expected header "${key}" to be present`,
        { expected: key, actual: undefined }
      );
    }

    if (matcher !== undefined && !matches(value, matcher)) {
      this.#fail(
        `expected header "${key}" to match ${describe(matcher)} but got "${value}"`,
        { expected: matcher, actual: value }
      );
    }
    return this;
  }

  // One arg: assert the path exists (value is not undefined).
  // Two args: assert the value at path matches the expected matcher.
  expectJson(path, expected) {
    const actual = resolvePath(this.body, path);

    if (arguments.length < 2) {
      if (actual === undefined) {
        this.#fail(
          `expected JSON path "${path}" to exist`,
          { expected: path, actual: undefined }
        );
      }
      return this;
    }

    if (!matches(actual, expected)) {
      this.#fail(
        `expected JSON path "${path}" to match ${describe(expected)} but got ${describe(actual)}`,
        { expected, actual }
      );
    }
    return this;
  }

  // Match against the raw text body (string) or parsed body, via matches().
  expectBody(matcher) {
    const target = typeof matcher === "object" && matcher !== null && !(matcher instanceof RegExp)
      ? this.body
      : this.text;

    if (!matches(target, matcher)) {
      this.#fail(
        `expected body to match ${describe(matcher)}`,
        { expected: matcher, actual: target }
      );
    }
    return this;
  }

  // Response time ceiling in milliseconds.
  expectTimeBelow(ms) {
    if (!(this.time < ms)) {
      this.#fail(
        `expected response time below ${ms}ms but took ${this.time}ms`,
        { expected: ms, actual: this.time }
      );
    }
    return this;
  }

  // Custom check. The function receives this response. It fails if it returns
  // false (strictly) or throws.
  check(label, fn) {
    let result;
    try {
      result = fn(this);
    } catch (err) {
      this.#fail(
        `check "${label}" threw: ${err && err.message ? err.message : err}`,
        { expected: true, actual: err }
      );
    }
    if (result === false) {
      this.#fail(
        `check "${label}" failed`,
        { expected: true, actual: result }
      );
    }
    return this;
  }

  // Read a value from the parsed body using a dot + bracket path.
  get(path) {
    return resolvePath(this.body, path);
  }
}
