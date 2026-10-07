// Extra HTTP assertion methods for GoResponse, installed plugin-style onto
// GoResponse.prototype at module load. Importing this module for its side
// effect adds status helpers, header/cookie checks, JSON schema/length/contains
// assertions, body checks, and an expectValue() bridge into the expect() API.
// Every method returns `this` for chaining and throws AssertionError on failure,
// with messages formatted as `${this.method} ${this.url} -> <description>`.

import { GoResponse } from "./response.js";
import { RequestBuilder } from "./client.js";
import { resolvePath, matches } from "./assertions.js";
import { failResponse as fail, describeMatcher as describe } from "./internal.js";
import { validate } from "./schema.js";
import { expect } from "./expect.js";
import { isArray, isString, isObject, isEmpty, isPlainObject } from "./utils/lang.js";

// Read a header by name using the lowercase-keyed headers map.
function header(response, name) {
  return response.headers[String(name).toLowerCase()];
}

// Collect raw set-cookie header values into an array, regardless of how the
// underlying headers map stored them (single string or already an array).
function setCookieValues(response) {
  const raw = response.headers["set-cookie"];
  if (raw === undefined) return [];
  if (isArray(raw)) return raw;
  return [raw];
}

// Parse a single Set-Cookie header value into { name, value, attributes }.
function parseCookie(raw) {
  const parts = String(raw).split(";");
  const first = parts[0] || "";
  const eq = first.indexOf("=");
  const name = eq === -1 ? first.trim() : first.slice(0, eq).trim();
  const value = eq === -1 ? "" : first.slice(eq + 1).trim();

  const attributes = {};
  for (let i = 1; i < parts.length; i += 1) {
    const segment = parts[i].trim();
    if (segment === "") continue;
    const aEq = segment.indexOf("=");
    if (aEq === -1) {
      attributes[segment.toLowerCase()] = true;
    } else {
      attributes[segment.slice(0, aEq).trim().toLowerCase()] = segment.slice(aEq + 1).trim();
    }
  }

  return { name, value, attributes };
}

// Assert the status falls within an inclusive [min, max] range.
function expectStatusRange(response, min, max, label) {
  if (response.status < min || response.status > max) {
    fail(
      response,
      `expected ${label} status but got ${response.status}`,
      { expected: `${min}-${max}`, actual: response.status }
    );
  }
  return response;
}

// Assert the status equals a specific code.
function expectExactStatus(response, code, label) {
  if (response.status !== code) {
    fail(
      response,
      `expected ${label} (${code}) but got ${response.status}`,
      { expected: code, actual: response.status }
    );
  }
  return response;
}

const methods = {
  // Any 4xx status.
  expectClientError() {
    return expectStatusRange(this, 400, 499, "a 4xx client error");
  },

  // Any 5xx status.
  expectServerError() {
    return expectStatusRange(this, 500, 599, "a 5xx server error");
  },

  // Any 3xx status.
  expectRedirect() {
    return expectStatusRange(this, 300, 399, "a 3xx redirect");
  },

  // Exactly 201 Created.
  expectCreated() {
    return expectExactStatus(this, 201, "status Created");
  },

  // Exactly 202 Accepted.
  expectAccepted() {
    return expectExactStatus(this, 202, "status Accepted");
  },

  // Exactly 204 No Content.
  expectNoContent() {
    return expectExactStatus(this, 204, "status No Content");
  },

  // Exactly 400 Bad Request.
  expectBadRequest() {
    return expectExactStatus(this, 400, "status Bad Request");
  },

  // Exactly 401 Unauthorized.
  expectUnauthorized() {
    return expectExactStatus(this, 401, "status Unauthorized");
  },

  // Exactly 403 Forbidden.
  expectForbidden() {
    return expectExactStatus(this, 403, "status Forbidden");
  },

  // Exactly 404 Not Found.
  expectNotFound() {
    return expectExactStatus(this, 404, "status Not Found");
  },

  // The content-type header includes the given type substring.
  expectContentType(type) {
    const value = header(this, "content-type");
    if (value === undefined || !String(value).includes(type)) {
      fail(
        this,
        `expected content-type to contain ${describe(type)} but got ${describe(value)}`,
        { expected: type, actual: value }
      );
    }
    return this;
  },

  // The named header is present and its value includes the given substring.
  expectHeaderContains(name, substr) {
    const value = header(this, name);
    if (value === undefined) {
      fail(
        this,
        `expected header "${String(name).toLowerCase()}" to be present`,
        { expected: String(name).toLowerCase(), actual: undefined }
      );
    }
    if (!String(value).includes(substr)) {
      fail(
        this,
        `expected header "${String(name).toLowerCase()}" to contain ${describe(substr)} but got ${describe(value)}`,
        { expected: substr, actual: value }
      );
    }
    return this;
  },

  // The named header must NOT be present.
  expectHeaderAbsent(name) {
    const key = String(name).toLowerCase();
    const value = this.headers[key];
    if (value !== undefined) {
      fail(
        this,
        `expected header "${key}" to be absent but got ${describe(value)}`,
        { expected: undefined, actual: value }
      );
    }
    return this;
  },

  // Validate the parsed body against a schema, listing every error on failure.
  expectJsonSchema(schema) {
    const result = validate(this.body, schema);

    // Support either a { valid, errors } result or a bare errors array.
    let valid;
    let errors;
    if (isArray(result)) {
      errors = result;
      valid = result.length === 0;
    } else if (result && typeof result === "object") {
      errors = isArray(result.errors) ? result.errors : [];
      valid = result.valid === undefined ? errors.length === 0 : Boolean(result.valid);
    } else {
      valid = Boolean(result);
      errors = [];
    }

    if (!valid) {
      const list = errors.length > 0 ? errors.join("; ") : "schema validation failed";
      fail(
        this,
        `expected body to match schema but: ${list}`,
        { expected: schema, actual: this.body }
      );
    }
    return this;
  },

  // The array or string at the given path has exactly the given length.
  expectJsonLength(path, n) {
    const target = resolvePath(this.body, path);
    if (!isArray(target) && !isString(target)) {
      fail(
        this,
        `expected JSON path "${path}" to be an array or string but got ${describe(target)}`,
        { expected: n, actual: target }
      );
    }
    if (target.length !== n) {
      fail(
        this,
        `expected JSON path "${path}" to have length ${n} but got ${target.length}`,
        { expected: n, actual: target.length }
      );
    }
    return this;
  },

  // The array at the path contains a matching item, or the object at the path
  // partially matches the given value's keys.
  expectJsonContains(path, value) {
    const target = resolvePath(this.body, path);

    if (isArray(target)) {
      // For plain-object values, match array items by SUBSET (partial deep);
      // otherwise fall back to the standard matcher (primitive/regex/predicate).
      const itemMatches = (item) => {
        if (isPlainObject(value)) {
          return isObject(item) && Object.keys(value).every((k) => matches(item[k], value[k]));
        }
        return matches(item, value);
      };
      const found = target.some(itemMatches);
      if (!found) {
        fail(
          this,
          `expected JSON path "${path}" to contain ${describe(value)}`,
          { expected: value, actual: target }
        );
      }
      return this;
    }

    if (isObject(target) && isPlainObject(value)) {
      for (const key of Object.keys(value)) {
        if (!matches(target[key], value[key])) {
          fail(
            this,
            `expected JSON path "${path}" to contain ${describe(value)} but key "${key}" did not match`,
            { expected: value, actual: target }
          );
        }
      }
      return this;
    }

    fail(
      this,
      `expected JSON path "${path}" to be an array or object but got ${describe(target)}`,
      { expected: value, actual: target }
    );
    return this;
  },

  // The value at the path is an array with exactly the given length.
  expectArrayLength(path, n) {
    const target = resolvePath(this.body, path);
    if (!isArray(target)) {
      fail(
        this,
        `expected JSON path "${path}" to be an array but got ${describe(target)}`,
        { expected: n, actual: target }
      );
    }
    if (target.length !== n) {
      fail(
        this,
        `expected array at "${path}" to have length ${n} but got ${target.length}`,
        { expected: n, actual: target.length }
      );
    }
    return this;
  },

  // The array at the path is sorted. Options: { key, order } where order is
  // "asc" (default) or "desc"; key picks a field from object items.
  expectSorted(path, options = {}) {
    const target = resolvePath(this.body, path);
    if (!isArray(target)) {
      fail(
        this,
        `expected JSON path "${path}" to be an array but got ${describe(target)}`,
        { expected: "sorted array", actual: target }
      );
    }

    const key = options.key;
    const order = options.order === "desc" ? "desc" : "asc";
    const pick = (item) => (key === undefined || key === null ? item : item[key]);

    for (let i = 1; i < target.length; i += 1) {
      const prev = pick(target[i - 1]);
      const curr = pick(target[i]);
      const inOrder = order === "asc" ? prev <= curr : prev >= curr;
      if (!inOrder) {
        fail(
          this,
          `expected "${path}" to be sorted ${order} but ${describe(prev)} and ${describe(curr)} are out of order`,
          { expected: order, actual: target }
        );
      }
    }
    return this;
  },

  // A Set-Cookie cookie with the given name is present. With a matcher, the
  // cookie value must match it (string, RegExp, predicate, or deep value).
  expectCookie(name, matcher) {
    const cookies = setCookieValues(this).map(parseCookie);
    const cookie = cookies.find((c) => c.name === name);

    if (cookie === undefined) {
      fail(
        this,
        `expected cookie "${name}" to be set`,
        { expected: name, actual: cookies.map((c) => c.name) }
      );
    }

    if (matcher !== undefined && !matches(cookie.value, matcher)) {
      fail(
        this,
        `expected cookie "${name}" to match ${describe(matcher)} but got ${describe(cookie.value)}`,
        { expected: matcher, actual: cookie.value }
      );
    }
    return this;
  },

  // The raw text body includes the given substring.
  expectBodyContains(substr) {
    const text = this.text === undefined || this.text === null ? "" : String(this.text);
    if (!text.includes(substr)) {
      fail(
        this,
        `expected body to contain ${describe(substr)}`,
        { expected: substr, actual: this.text }
      );
    }
    return this;
  },

  // The parsed body is empty (null/undefined, "", [], {}, empty Map/Set).
  expectEmpty() {
    if (!isEmpty(this.body)) {
      fail(
        this,
        `expected body to be empty but got ${describe(this.body)}`,
        { expected: "empty", actual: this.body }
      );
    }
    return this;
  },

  // The parsed body is not empty.
  expectNotEmpty() {
    if (isEmpty(this.body)) {
      fail(
        this,
        `expected body to be non-empty`,
        { expected: "non-empty", actual: this.body }
      );
    }
    return this;
  },

  // Return an expect() wrapper around the value at the path so callers can
  // chain Jest-style matchers (e.g. .toBe, .toEqual, .toContain).
  expectValue(path) {
    return expect(resolvePath(this.body, path));
  },
};

// Install each method onto GoResponse.prototype as a non-enumerable, writable,
// configurable property so the plugin can be loaded once without surprises.
for (const [name, fn] of Object.entries(methods)) {
  Object.defineProperty(GoResponse.prototype, name, {
    value: fn,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

// Also make these assertions chainable on the (thenable) RequestBuilder, so you
// can write api.get("/x").expectStatus(200).expectJsonSchema(schema) instead of
// awaiting first. They are queued and replayed on the resolved GoResponse, just
// like the core assertions. expectValue is excluded because it returns an
// Expectation rather than the response, so it only makes sense post-await.
for (const name of Object.keys(methods)) {
  if (name === "expectValue") continue;
  if (typeof RequestBuilder.prototype[name] === "function") continue;
  Object.defineProperty(RequestBuilder.prototype, name, {
    value: function (...args) {
      this._assertions.push({ name, args });
      return this;
    },
    writable: true,
    enumerable: false,
    configurable: true,
  });
}
