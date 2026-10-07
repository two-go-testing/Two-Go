// Unit tests for src/session.js.
// The Session is a stateful wrapper over GoClient that shares a variable
// context across chained requests, interpolating "{{name}}" placeholders into
// the path, headers, and string body just before sending, and extracting
// values from each response back into that context. Tests spin up a real
// node:http server on an ephemeral port so the underlying fetch is exercised
// end-to-end, then close it afterward.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { session, Session } from "../../src/session.js";

// Start a node:http server bound to an ephemeral port (0) and resolve with the
// server plus its base URL once it is listening.
function startServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseURL: `http://127.0.0.1:${port}` });
    });
  });
}

// Close a server and resolve once it has fully shut down.
function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

// Read the full request body as a string.
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

test("session() accepts a base-URL string", () => {
  const s = session("http://example.com/");
  assert.equal(s.client.baseURL, "http://example.com");
  assert.deepEqual(s.vars, {});
});

test("session() accepts an options object", () => {
  const s = session({ baseURL: "http://example.com", timeout: 1234 });
  assert.equal(s.client.baseURL, "http://example.com");
  assert.equal(s.client.timeout, 1234);
});

test("session() with no argument yields an empty base URL", () => {
  const s = session();
  assert.equal(s.client.baseURL, "");
  assert.deepEqual(s.vars, {});
});

test("set() stores a variable and is chainable", () => {
  const s = session("http://example.com");
  const returned = s.set("token", "abc");
  assert.equal(returned, s);
  assert.equal(s.vars.token, "abc");
});

test("get(name) returns a stored variable instead of starting a request", () => {
  const s = session("http://example.com");
  s.set("userId", 42);
  assert.equal(s.get("userId"), 42);
});

test("get(name) returns the stored value even when it is falsy", () => {
  const s = session("http://example.com");
  s.set("flag", 0);
  s.set("empty", "");
  assert.equal(s.get("flag"), 0);
  assert.equal(s.get("empty"), "");
});

test("get(path) starts a request when the name is not a stored variable", async () => {
  const { server, baseURL } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
  try {
    const s = session(baseURL);
    const res = await s.get("/ping");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true, path: "/ping" });
  } finally {
    await stopServer(server);
  }
});

test("all HTTP verbs send the correct method", async () => {
  let lastMethod;
  const { server, baseURL } = await startServer((req, res) => {
    lastMethod = req.method;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ method: req.method }));
  });
  try {
    const s = session(baseURL);
    assert.equal((await s.post("/x")).body.method, "POST");
    assert.equal((await s.put("/x")).body.method, "PUT");
    assert.equal((await s.patch("/x")).body.method, "PATCH");
    assert.equal((await s.delete("/x")).body.method, "DELETE");
    assert.equal((await s.options("/x")).body.method, "OPTIONS");

    // HEAD has no body, but the method must still arrive.
    await s.head("/x");
    assert.equal(lastMethod, "HEAD");
  } finally {
    await stopServer(server);
  }
});

test("extract(name, path) pulls a single value into the context", async () => {
  const { server, baseURL } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ token: "secret-xyz" }));
  });
  try {
    const s = session(baseURL);
    await s.post("/login").extract("token", "token");
    assert.equal(s.vars.token, "secret-xyz");
  } finally {
    await stopServer(server);
  }
});

test("extract({ map }) pulls multiple nested values into the context", async () => {
  const { server, baseURL } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: { user: { id: 7, name: "Ada" } } }));
  });
  try {
    const s = session(baseURL);
    await s.get("/me").extract({ id: "data.user.id", name: "data.user.name" });
    assert.equal(s.vars.id, 7);
    assert.equal(s.vars.name, "Ada");
  } finally {
    await stopServer(server);
  }
});

test("extract() is chainable and returns the SessionRequest", () => {
  const s = session("http://example.com");
  const reqA = s.get("/a");
  assert.equal(reqA.extract("x", "x"), reqA);
});

test("extract() ignores non-string, non-object inputs", async () => {
  const { server, baseURL } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ a: 1 }));
  });
  try {
    const s = session(baseURL);
    const r = s.get("/x");
    assert.equal(r.extract(null), r);
    assert.equal(r.extract(123), r);
    await r;
    assert.deepEqual(s.vars, {});
  } finally {
    await stopServer(server);
  }
});

test("placeholders in the path are interpolated from the context", async () => {
  let receivedPath;
  const { server, baseURL } = await startServer((req, res) => {
    receivedPath = req.url;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  try {
    const s = session(baseURL);
    s.set("id", 99);
    await s.get("/users/{{id}}");
    assert.equal(receivedPath, "/users/99");
  } finally {
    await stopServer(server);
  }
});

test("placeholders in headers and body are interpolated", async () => {
  let receivedAuth;
  let receivedBody;
  const { server, baseURL } = await startServer(async (req, res) => {
    receivedAuth = req.headers["authorization"];
    receivedBody = await readBody(req);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  try {
    const s = session(baseURL);
    s.set("token", "T0K3N");
    s.set("name", "Grace");
    await s
      .post("/things")
      .header("authorization", "Bearer {{token}}")
      .text("hello {{name}}");
    assert.equal(receivedAuth, "Bearer T0K3N");
    assert.equal(receivedBody, "hello Grace");
  } finally {
    await stopServer(server);
  }
});

test("a missing variable resolves to an empty string", async () => {
  let receivedPath;
  const { server, baseURL } = await startServer((req, res) => {
    receivedPath = req.url;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  try {
    const s = session(baseURL);
    await s.get("/a/{{missing}}/b");
    assert.equal(receivedPath, "/a//b");
  } finally {
    await stopServer(server);
  }
});

test("interpolation supports dotted paths and trims whitespace", async () => {
  let receivedPath;
  const { server, baseURL } = await startServer((req, res) => {
    receivedPath = req.url;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  try {
    const s = session(baseURL);
    s.set("user", { id: 5 });
    await s.get("/u/{{ user.id }}");
    assert.equal(receivedPath, "/u/5");
  } finally {
    await stopServer(server);
  }
});

test("end-to-end flow: login extracts a token reused by the next request", async () => {
  const { server, baseURL } = await startServer(async (req, res) => {
    if (req.url === "/login") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ token: "flow-token" }));
      return;
    }
    if (req.url === "/secure") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ auth: req.headers["authorization"] }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  try {
    const s = session(baseURL);
    await s.post("/login").json({ user: "a" }).extract("token", "token");
    const secure = await s.get("/secure").header("authorization", "Bearer {{token}}");
    assert.equal(secure.body.auth, "Bearer flow-token");
  } finally {
    await stopServer(server);
  }
});

test("forwarded config methods are chainable and apply to the request", async () => {
  let receivedAuth;
  let receivedCt;
  let receivedBody;
  const { server, baseURL } = await startServer(async (req, res) => {
    receivedAuth = req.headers["authorization"];
    receivedCt = req.headers["content-type"];
    receivedBody = await readBody(req);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  try {
    const s = session(baseURL);
    const reqBuilder = s.post("/x");
    // Each forwarded method returns the SessionRequest for chaining.
    assert.equal(reqBuilder.bearer("tok"), reqBuilder);
    await reqBuilder.json({ hello: "world" });
    assert.equal(receivedAuth, "Bearer tok");
    assert.ok(receivedCt.includes("application/json"));
    assert.deepEqual(JSON.parse(receivedBody), { hello: "world" });
  } finally {
    await stopServer(server);
  }
});

test("forwarded assertion methods run against the response and are chainable", async () => {
  const { server, baseURL } = await startServer((req, res) => {
    res.writeHead(201, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: 1 }));
  });
  try {
    const s = session(baseURL);
    const reqBuilder = s.post("/create");
    assert.equal(reqBuilder.expectStatus(201), reqBuilder);
    const res = await reqBuilder.expectJson("id", 1);
    assert.equal(res.status, 201);
  } finally {
    await stopServer(server);
  }
});

test("a failing forwarded assertion rejects the awaited request", async () => {
  const { server, baseURL } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  try {
    const s = session(baseURL);
    await assert.rejects(() => s.get("/x").expectStatus(500));
  } finally {
    await stopServer(server);
  }
});

test("then/catch/finally make a SessionRequest awaitable", async () => {
  const { server, baseURL } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ via: "then" }));
  });
  try {
    const s = session(baseURL);

    // then()
    const body = await s.get("/x").then((r) => r.body);
    assert.deepEqual(body, { via: "then" });

    // finally() still resolves to the response
    let ranFinally = false;
    const res = await s.get("/x").finally(() => {
      ranFinally = true;
    });
    assert.equal(ranFinally, true);
    assert.equal(res.status, 200);
  } finally {
    await stopServer(server);
  }
});

test("catch() handles a rejection from a failed assertion", async () => {
  const { server, baseURL } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  try {
    const s = session(baseURL);
    let caught;
    await s.get("/x").expectStatus(404).catch((err) => {
      caught = err;
    });
    assert.ok(caught instanceof Error);
  } finally {
    await stopServer(server);
  }
});

test("extraction of a missing path stores undefined", async () => {
  const { server, baseURL } = await startServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ a: 1 }));
  });
  try {
    const s = session(baseURL);
    await s.get("/x").extract("nope", "deeply.missing.value");
    assert.ok(Object.prototype.hasOwnProperty.call(s.vars, "nope"));
    assert.equal(s.vars.nope, undefined);
  } finally {
    await stopServer(server);
  }
});

test("the same session reuses one client across requests", () => {
  const s = session("http://example.com");
  const a = s.get("/a");
  const b = s.post("/b");
  assert.equal(a.session, s);
  assert.equal(b.session, s);
  assert.equal(a.builder.client, b.builder.client);
  assert.equal(a.builder.client, s.client);
});
test("Session class is exported and session() returns an instance", () => {
  assert.ok(session("http://localhost") instanceof Session);
});
