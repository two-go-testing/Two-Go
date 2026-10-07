// Jest-style standalone assertion API. `expect(value)` returns an Expectation
// whose matchers throw an AssertionError on failure. Supports negation via
// `.not` and async assertions via `.resolves` / `.rejects`.

import { AssertionError, resolvePath } from "./assertions.js";
import { isEqual, isEmpty } from "./utils/lang.js";

// Human readable description of a value for error messages.
function describe(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "function") {
    return value.name ? `[Function ${value.name}]` : "[Function]";
  }
  if (typeof value === "symbol") return value.toString();
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// Strict deep equality: like isEqual but also requires identical prototypes at
// every level (so {} !== [] and class instances are distinguished), equal array
// lengths and sparseness, and no extra undefined-valued keys.
function strictEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  // Value-like built-ins carry no own keys; compare them by content.
  if (a instanceof Date || a instanceof RegExp || a instanceof Map || a instanceof Set) {
    return isEqual(a, b);
  }

  if (Array.isArray(a) && a.length !== b.length) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!strictEqual(a[key], b[key])) return false;
  }
  return true;
}

// Partial deep match: every key in `expected` must exist in `actual` and match.
// Nested plain objects are compared recursively; everything else via isEqual.
function matchObject(actual, expected) {
  if (expected === null || typeof expected !== "object") {
    return isEqual(actual, expected);
  }
  if (actual === null || typeof actual !== "object") return false;

  for (const key of Object.keys(expected)) {
    if (!Object.prototype.hasOwnProperty.call(actual, key)) return false;
    const expectedValue = expected[key];
    const actualValue = actual[key];
    if (
      expectedValue !== null &&
      typeof expectedValue === "object" &&
      !Array.isArray(expectedValue) &&
      !(expectedValue instanceof RegExp) &&
      !(expectedValue instanceof Date)
    ) {
      if (!matchObject(actualValue, expectedValue)) return false;
    } else if (!isEqual(actualValue, expectedValue)) {
      return false;
    }
  }
  return true;
}

// Resolve the JS "type" of a value, special-casing array and null.
function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export class Expectation {
  constructor(value, negated = false) {
    this.value = value;
    this.negated = negated;
  }

  // Returns an Expectation whose matchers invert pass/fail.
  get not() {
    return new Expectation(this.value, !this.negated);
  }

  // Async view: awaits the promise, then runs matchers against the resolved value.
  get resolves() {
    return makeAsyncProxy(this, "resolves");
  }

  // Async view: awaits the promise, expecting rejection, then runs matchers
  // against the rejection reason.
  get rejects() {
    return makeAsyncProxy(this, "rejects");
  }

  // Core: throw or pass based on `pass` and the current negation state.
  #assert(pass, verb, info = {}) {
    const ok = this.negated ? !pass : pass;
    if (ok) return this;
    const not = this.negated ? "not " : "";
    const message = `expected ${describe(this.value)} ${not}${verb}`;
    throw new AssertionError(message, {
      expected: "expected" in info ? info.expected : undefined,
      actual: "actual" in info ? info.actual : this.value
    });
  }

  // Same as #assert but with a fully custom message and explicit values.
  #assertWith(pass, message, expected, actual) {
    const ok = this.negated ? !pass : pass;
    if (ok) return this;
    throw new AssertionError(message, { expected, actual });
  }

  // Object.is equality.
  toBe(expected) {
    return this.#assert(
      Object.is(this.value, expected),
      `to be ${describe(expected)}`,
      { expected, actual: this.value }
    );
  }

  // Deep equality via isEqual.
  toEqual(expected) {
    return this.#assert(
      isEqual(this.value, expected),
      `to equal ${describe(expected)}`,
      { expected, actual: this.value }
    );
  }

  // Deep equality that also compares types and array-vs-object shape.
  toStrictEqual(expected) {
    return this.#assert(
      strictEqual(this.value, expected),
      `to strictly equal ${describe(expected)}`,
      { expected, actual: this.value }
    );
  }

  // Value must be truthy.
  toBeTruthy() {
    return this.#assert(Boolean(this.value), "to be truthy", {
      expected: true,
      actual: this.value
    });
  }

  // Value must be falsy.
  toBeFalsy() {
    return this.#assert(!this.value, "to be falsy", {
      expected: false,
      actual: this.value
    });
  }

  // Value must be null.
  toBeNull() {
    return this.#assert(this.value === null, "to be null", {
      expected: null,
      actual: this.value
    });
  }

  // Value must be undefined.
  toBeUndefined() {
    return this.#assert(this.value === undefined, "to be undefined", {
      expected: undefined,
      actual: this.value
    });
  }

  // Value must not be undefined.
  toBeDefined() {
    return this.#assert(this.value !== undefined, "to be defined", {
      actual: this.value
    });
  }

  // Value must be NaN.
  toBeNaN() {
    return this.#assert(Number.isNaN(this.value), "to be NaN", {
      expected: NaN,
      actual: this.value
    });
  }

  // Numeric greater-than.
  toBeGreaterThan(n) {
    return this.#assert(this.value > n, `to be greater than ${describe(n)}`, {
      expected: n,
      actual: this.value
    });
  }

  // Numeric greater-than-or-equal.
  toBeGreaterThanOrEqual(n) {
    return this.#assert(
      this.value >= n,
      `to be greater than or equal to ${describe(n)}`,
      { expected: n, actual: this.value }
    );
  }

  // Numeric less-than.
  toBeLessThan(n) {
    return this.#assert(this.value < n, `to be less than ${describe(n)}`, {
      expected: n,
      actual: this.value
    });
  }

  // Numeric less-than-or-equal.
  toBeLessThanOrEqual(n) {
    return this.#assert(
      this.value <= n,
      `to be less than or equal to ${describe(n)}`,
      { expected: n, actual: this.value }
    );
  }

  // Floating point closeness within `digits` decimal places.
  toBeCloseTo(n, digits = 2) {
    const tolerance = Math.pow(10, -digits) / 2;
    const pass = Math.abs(this.value - n) < tolerance;
    return this.#assert(
      pass,
      `to be close to ${describe(n)} (within ${digits} digits)`,
      { expected: n, actual: this.value }
    );
  }

  // String substring or array element via ===.
  toContain(item) {
    let pass = false;
    if (typeof this.value === "string") {
      pass = this.value.includes(item);
    } else if (Array.isArray(this.value)) {
      pass = this.value.includes(item);
    }
    return this.#assert(pass, `to contain ${describe(item)}`, {
      expected: item,
      actual: this.value
    });
  }

  // Array element via deep equality.
  toContainEqual(item) {
    const pass =
      Array.isArray(this.value) &&
      this.value.some((entry) => isEqual(entry, item));
    return this.#assert(pass, `to contain equal ${describe(item)}`, {
      expected: item,
      actual: this.value
    });
  }

  // String must match a RegExp or contain a substring.
  toMatch(regexpOrString) {
    const subject = String(this.value);
    const pass =
      regexpOrString instanceof RegExp
        ? regexpOrString.test(subject)
        : subject.includes(String(regexpOrString));
    return this.#assert(pass, `to match ${describe(regexpOrString)}`, {
      expected: regexpOrString,
      actual: this.value
    });
  }

  // Partial deep match against a subset object.
  toMatchObject(obj) {
    return this.#assert(
      matchObject(this.value, obj),
      `to match object ${describe(obj)}`,
      { expected: obj, actual: this.value }
    );
  }

  // Length of a string or array (or anything with a numeric `length`).
  toHaveLength(n) {
    const length = this.value == null ? undefined : this.value.length;
    return this.#assert(length === n, `to have length ${describe(n)}`, {
      expected: n,
      actual: length
    });
  }

  // Property existence at a path, optionally matching a deep-equal value.
  toHaveProperty(path, ...rest) {
    const hasValue = rest.length > 0;
    const expectedValue = rest[0];
    const actual = resolvePath(this.value, path);
    const exists = actual !== undefined;

    if (!hasValue) {
      return this.#assert(exists, `to have property ${describe(path)}`, {
        expected: path,
        actual: this.value
      });
    }

    const pass = exists && isEqual(actual, expectedValue);
    return this.#assert(
      pass,
      `to have property ${describe(path)} equal to ${describe(expectedValue)}`,
      { expected: expectedValue, actual }
    );
  }

  // instanceof check.
  toBeInstanceOf(cls) {
    const name = cls && cls.name ? cls.name : describe(cls);
    return this.#assert(
      this.value instanceof cls,
      `to be an instance of ${name}`,
      { expected: cls, actual: this.value }
    );
  }

  // typeof check with "array" and "null" special-cased.
  toBeType(typeName) {
    return this.#assert(
      typeOf(this.value) === typeName,
      `to be of type ${describe(typeName)}`,
      { expected: typeName, actual: typeOf(this.value) }
    );
  }

  // Value must be one of the given array entries (via ===).
  toBeOneOf(arr) {
    const list = Array.isArray(arr) ? arr : [];
    return this.#assert(
      list.includes(this.value),
      `to be one of ${describe(arr)}`,
      { expected: arr, actual: this.value }
    );
  }

  // Value must be a function; calls it and asserts it throws. Optionally
  // matches the thrown error by string, RegExp, or constructor.
  toThrow(expected) {
    if (typeof this.value !== "function") {
      throw new AssertionError(
        `expected ${describe(this.value)} to be a function to assert toThrow`,
        { expected: "function", actual: typeOf(this.value) }
      );
    }

    let thrown;
    let didThrow = false;
    try {
      this.value();
    } catch (err) {
      didThrow = true;
      thrown = err;
    }

    if (!didThrow) {
      return this.#assertWith(
        false,
        this.negated
          ? "expected function not to throw"
          : "expected function to throw",
        "throw",
        "did not throw"
      );
    }

    if (expected === undefined) {
      return this.#assertWith(
        true,
        this.negated ? "expected function not to throw" : "",
        "throw",
        thrown
      );
    }

    const message = thrown && thrown.message ? thrown.message : String(thrown);
    let pass;
    if (typeof expected === "string") {
      pass = message.includes(expected);
    } else if (expected instanceof RegExp) {
      pass = expected.test(message);
    } else if (typeof expected === "function") {
      pass = thrown instanceof expected;
    } else {
      pass = isEqual(thrown, expected);
    }

    const not = this.negated ? "not " : "";
    return this.#assertWith(
      pass,
      `expected thrown error ${not}to match ${describe(expected)}, got ${describe(thrown)}`,
      expected,
      thrown
    );
  }

  // Value must satisfy a predicate (truthy return).
  toSatisfy(predicate) {
    const pass = Boolean(predicate(this.value));
    return this.#assert(pass, "to satisfy predicate", {
      expected: "predicate pass",
      actual: this.value
    });
  }

  // Value must be empty (nil, "", [], {}, empty Map/Set; see utils isEmpty).
  toBeEmpty() {
    return this.#assert(isEmpty(this.value), "to be empty", {
      expected: "empty",
      actual: this.value
    });
  }
}

// List of matcher method names exposed on the async proxy.
const MATCHER_NAMES = Object.getOwnPropertyNames(Expectation.prototype).filter(
  (name) => name.startsWith("to") && typeof Expectation.prototype[name] === "function"
);

// Build an object exposing every matcher as an async method that first awaits
// the wrapped promise (mode "resolves") or its rejection (mode "rejects"),
// then runs the matcher against the resulting value.
function makeAsyncProxy(expectation, mode) {
  const proxy = {};

  for (const name of MATCHER_NAMES) {
    proxy[name] = async (...args) => {
      let resolvedValue;

      if (mode === "resolves") {
        try {
          resolvedValue = await expectation.value;
        } catch (err) {
          throw new AssertionError(
            `expected promise to resolve but it rejected with ${describe(err)}`,
            { expected: "resolved", actual: err }
          );
        }
      } else {
        let rejected = false;
        let reason;
        try {
          await expectation.value;
        } catch (err) {
          rejected = true;
          reason = err;
        }
        if (!rejected) {
          throw new AssertionError(
            "expected promise to reject but it resolved",
            { expected: "rejected", actual: "resolved" }
          );
        }
        resolvedValue = reason;
      }

      const inner = new Expectation(resolvedValue, expectation.negated);
      return inner[name](...args);
    };
  }

  // Mirror negation onto the async view as well.
  Object.defineProperty(proxy, "not", {
    get() {
      return makeAsyncProxy(new Expectation(expectation.value, !expectation.negated), mode);
    }
  });

  return proxy;
}

// Entry point: wrap a value in an Expectation.
export function expect(value) {
  return new Expectation(value);
}
