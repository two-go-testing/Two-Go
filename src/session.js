// Stateful request chaining: a thin wrapper over GoClient that shares a
// context of named variables across requests. Values extracted from one
// response can be reused in later requests via "{{name}}" placeholders,
// enabling flows like login -> token -> authorized call.

import { GoClient, RequestBuilder } from "./client.js";
import { resolvePath } from "./assertions.js";

// Configuration methods forwarded verbatim from SessionRequest to RequestBuilder.
const FORWARD = [
  "headers",
  "header",
  "query",
  "bearer",
  "json",
  "form",
  "text",
  "timeout",
];

// Queued assertion methods forwarded from SessionRequest to RequestBuilder.
const FORWARD_ASSERTIONS = [
  "expectStatus",
  "expectStatusIn",
  "expectOk",
  "expectHeader",
  "expectJson",
  "expectBody",
  "expectTimeBelow",
  "check",
];

// HTTP verbs exposed on a Session, mapped to their method names.
const VERBS = {
  put: "PUT",
  post: "POST",
  patch: "PATCH",
  delete: "DELETE",
  head: "HEAD",
  options: "OPTIONS",
};

// Replace every "{{name}}" placeholder in a string using the given context.
// A missing variable resolves to an empty string.
function interpolate(value, context) {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, name) => {
    const resolved = resolvePath(context, name);
    return resolved === undefined || resolved === null ? "" : String(resolved);
  });
}

// A single request bound to a session. Wraps a RequestBuilder, applying
// context interpolation just before sending and supporting value extraction.
class SessionRequest {
  constructor(session, builder) {
    this.session = session;
    this.builder = builder;

    // Extraction rules: { name -> path } applied once the response resolves.
    this._extracts = {};
  }

  // Register one or more values to pull from the response into the session
  // context. Forms: extract({ name: path, ... }) or extract(name, path).
  extract(mapOrName, path) {
    if (typeof mapOrName === "string") {
      this._extracts[mapOrName] = path;
    } else if (mapOrName && typeof mapOrName === "object") {
      Object.assign(this._extracts, mapOrName);
    }
    return this;
  }

  // Send the request, interpolating placeholders first and applying extracts after.
  async run() {
    const context = this.session.vars;
    const builder = this.builder;

    builder.path = interpolate(builder.path, context);

    for (const key of Object.keys(builder._headers)) {
      builder._headers[key] = interpolate(builder._headers[key], context);
    }

    if (typeof builder._body === "string") {
      builder._body = interpolate(builder._body, context);
    }

    const response = await builder.run();

    for (const [name, p] of Object.entries(this._extracts)) {
      context[name] = resolvePath(response.body, p);
    }

    return response;
  }

  // Make the request awaitable; awaiting it triggers run().
  then(onFulfilled, onRejected) {
    return this.run().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.run().catch(onRejected);
  }

  finally(onFinally) {
    return this.run().finally(onFinally);
  }
}

// Forward chainable configuration methods to the wrapped RequestBuilder.
for (const name of FORWARD) {
  SessionRequest.prototype[name] = function (...args) {
    this.builder[name](...args);
    return this;
  };
}

// Forward queued assertion methods to the wrapped RequestBuilder.
for (const name of FORWARD_ASSERTIONS) {
  SessionRequest.prototype[name] = function (...args) {
    this.builder[name](...args);
    return this;
  };
}

// A stateful client that shares a variable context across chained requests.
export class Session {
  constructor(baseURLorOptions) {
    const options =
      typeof baseURLorOptions === "string"
        ? { baseURL: baseURLorOptions }
        : baseURLorOptions || {};
    this.client = new GoClient(options);

    // Shared variable context for interpolation and extraction.
    this.vars = {};
  }

  // Start a GET request, or, when called with a known variable name, read it.
  // This keeps both the documented session.get(path) verb and session.get(name)
  // accessor on one method: a bare name present in the context returns its value.
  get(pathOrName) {
    if (
      typeof pathOrName === "string" &&
      Object.prototype.hasOwnProperty.call(this.vars, pathOrName)
    ) {
      return this.vars[pathOrName];
    }
    return this.#request("GET", pathOrName);
  }

  // Set a context variable; chainable.
  set(name, value) {
    this.vars[name] = value;
    return this;
  }

  #request(method, path) {
    const builder = new RequestBuilder(this.client, method, path);
    return new SessionRequest(this, builder);
  }
}

// Install the remaining HTTP verbs, each returning a chainable SessionRequest.
for (const [verb, method] of Object.entries(VERBS)) {
  Session.prototype[verb] = function (path) {
    return new SessionRequest(this, new RequestBuilder(this.client, method, path));
  };
}

// Create a Session bound to a base URL or options object.
export function session(baseURLorOptions) {
  return new Session(baseURLorOptions);
}
