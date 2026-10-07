# two-go

[![npm version](https://img.shields.io/npm/v/two-go.svg)](https://www.npmjs.com/package/two-go)
[![npm downloads](https://img.shields.io/npm/dm/two-go.svg)](https://www.npmjs.com/package/two-go)
[![CI](https://github.com/two-go-testing/two-go/actions/workflows/ci.yml/badge.svg)](https://github.com/two-go-testing/two-go/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/two-go.svg)](./LICENSE)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](./package.json)
[![types](https://img.shields.io/badge/types-included-blue.svg)](./src/index.d.ts)

two-go is a small library for testing HTTP APIs from Node. You build a request
with a chainable API, attach the checks you care about, and `await` it. If a
check fails it throws, so you don't need a special test runner. It works on its
own, and it works inside `node:test`, Jest, Vitest, or Mocha without any plugin.

I got tired of either clicking through a GUI or wiring up an HTTP client plus an
assertion library plus a dozen helpers for every project. two-go puts the parts
I keep reaching for in one place, and it has no dependencies, so installing it
doesn't drag in half of npm.

```js
import { go } from "two-go";

await go("https://api.example.com")
  .get("/users")
  .bearer(token)
  .expectStatus(200)
  .expectHeader("content-type", /json/)
  .expectJson("data[0].id", 1);
```

That one chain sends the request and runs all three checks. If any of them
fails you get an error like `GET https://api.example.com/users -> expected
status 200 but got 500`.

## What's in the box

The HTTP client and inline checks are the core. Around them there's a value
assertion API (`expect`), soft assertions, polling for slow endpoints, JSON
snapshots, session/auth chaining, a fake-data generator, async helpers, a
general utility belt, JSON schema validation, and importers that turn an
OpenAPI or Postman file into a test suite.

There's also an optional AI layer (`two-go/ai`): it can draft a test suite from
a live endpoint, explain why a test failed, review a response for likely bugs,
and generate adversarial payloads to fuzz an endpoint. It talks to providers
over fetch with your own key, so the core stays dependency free. And there's an
MCP server (`two-go-mcp`) so an agent like Claude can drive two-go as a set of
tools.

All of it ships with TypeScript types and zero runtime dependencies.

## Who actually uses this

Two groups, and the package works for both:

If you do test automation or QA, you get HTTP checks, polling for eventual
consistency, soft assertions so one run reports every problem, snapshots, login
chaining, fake data, and a CLI to run whole folders of tests.

If you're a backend or full-stack dev, you write integration tests right next
to your unit tests in whatever runner you already use, and you can reuse the
`expect`, the utility belt, and the schema tools in app code too.

One thing to be clear about: two-go is for API and service testing
(integration and e2e). It is not a unit test runner. It plugs into the runner
you already have. The checks just happen to read like the unit test assertions
you're used to.

## Table of contents

- [Install](#install)
- [Five minute tour](#five-minute-tour)
- [The three pieces](#the-three-pieces)
- [Subpath imports](#subpath-imports)
- [Building a request](#building-a-request)
- [HTTP checks](#http-checks)
- [expect() for any value](#expect-for-any-value)
- [Soft assertions](#soft-assertions)
- [Polling slow endpoints](#polling-slow-endpoints)
- [Snapshots](#snapshots)
- [Sessions and chaining](#sessions-and-chaining)
- [Fake data](#fake-data)
- [Async helpers](#async-helpers)
- [Utility belt](#utility-belt)
- [Schema validation and inference](#schema-validation-and-inference)
- [Debugging with curl and logging](#debugging-with-curl-and-logging)
- [Running tests](#running-tests)
- [BDD style](#bdd-style)
- [Importing from OpenAPI or Postman](#importing-from-openapi-or-postman)
- [Generating tests with AI](#generating-tests-with-ai)
- [TypeScript](#typescript)
- [Docker](#docker)
- [Recipes](#recipes)
- [two-go next to other tools](#two-go-next-to-other-tools)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Install

```bash
npm install two-go --save-dev
```

You need Node 18 or newer, because it uses the built-in `fetch`. It's ESM only,
so use `import` (or a dynamic `import()` from CommonJS). There are no runtime
dependencies.

## Five minute tour

```js
import { go } from "two-go";

const api = go("https://api.example.com");

const res = await api
  .get("/users")
  .query({ page: 1 })
  .expectStatus(200)
  .expectJson("data[0].id", 1);

// You still get the response back to poke at.
console.log(res.status, res.time, res.get("data[0].name"));
```

`go()` takes a base URL, or an options object if you want default headers and a
timeout for every request:

```js
const api = go({
  baseURL: "https://api.example.com",
  headers: { "x-api-key": "secret" },
  timeout: 10000,
});
```

## The three pieces

There isn't much to learn. There's a client, a request builder, and a response.

`GoClient` comes from `go()`. It holds the base URL, default headers, and
timeout, and it has one method per HTTP verb.

`RequestBuilder` is what `api.get("/x")` returns. You chain configuration and
checks onto it, then `await` it. It's a thenable, so awaiting it is what
actually sends the request. You can also call `.run()` if you prefer.

`GoResponse` is the resolved result. It carries the parsed body and the
metadata, plus every check method.

```js
const builder = api.get("/users"); // nothing sent yet
const res = await builder;          // now it's sent, checks ran
```

A `GoResponse` gives you:

| Field | Type | What it is |
| ----- | ---- | ---------- |
| `status` | number | HTTP status code |
| `statusText` | string | HTTP status text |
| `headers` | object | response headers, keys lowercased |
| `body` | any | parsed JSON when the content type is JSON, otherwise the raw text |
| `text` | string | the raw body as text |
| `time` | number | round trip time in ms |
| `url` | string | the final URL that was called |
| `method` | string | the HTTP method |
| `get(path)` | method | pull a value out of `body` with a dot/bracket path |

## Subpath imports

Pull everything from `two-go`, or grab just one area from a subpath. Every
subpath ships its own types.

| Import | What you get |
| ------ | ------------ |
| `two-go` | everything (the default `go`, all checks, utilities, features) |
| `two-go/utils` | the utility belt as flat named exports |
| `two-go/expect` | the standalone `expect()` |
| `two-go/schema` | `validate` and `isValid` |
| `two-go/soft` | soft assertions |
| `two-go/eventually` | `eventually` and `pollUntil` |
| `two-go/snapshot` | snapshot testing |
| `two-go/session` | stateful request chaining |
| `two-go/faker` | the fake data generator |
| `two-go/async` | async control flow helpers |
| `two-go/curl` | curl export and logging |
| `two-go/infer-schema` | schema inference |
| `two-go/importers` | OpenAPI and Postman importers |
| `two-go/ai` | optional AI layer (provider plus test generation) |
| `two-go/mcp` | the MCP server |
| `two-go/bdd` | runner-agnostic given/when/then helpers |

## Building a request

Every verb (`get`, `put`, `post`, `patch`, `delete`, `head`, `options`) returns
a builder you can chain.

```js
await api.post("/users")
  .header("x-request-id", "abc")           // one header
  .headers({ "x-trace": "1", lang: "en" }) // several at once
  .query({ page: 1, tags: ["a", "b"] })    // array values repeat the key
  .bearer("TOKEN")                         // authorization: Bearer TOKEN
  .json({ name: "Ada", role: "admin" })    // JSON body and content-type
  .timeout(5000)                           // overrides the client default
  .expectStatus(201);
```

| Method | What it does |
| ------ | ------------ |
| `.header(name, value)` | set one header |
| `.headers(obj)` | merge several headers |
| `.query(obj)` | add query params (array values repeat the key) |
| `.bearer(token)` | set `authorization: Bearer <token>` |
| `.json(obj)` | JSON body plus `content-type: application/json` |
| `.form(obj)` | URL encoded body plus the matching content type |
| `.text(str)` | raw text body (`text/plain` unless you already set a type) |
| `.timeout(ms)` | per request timeout, overrides the client default |
| `.run()` | send now and return a `Promise<GoResponse>` |

A few things worth knowing. If you pass an absolute `http(s)://` URL to a verb,
the base URL is ignored. Timeouts use `AbortController` and reject with a clear
message when they fire. Header keys are lowercased so merging behaves the same
every time.

## HTTP checks

You can queue checks on the builder, where they run in order once you await it,
or call them on a resolved response. Either way they return the response so you
can keep chaining, and they throw an `AssertionError` on failure. Messages look
like `<METHOD> <URL> -> <what went wrong>`.

Status:

| Check | Passes when |
| ----- | ----------- |
| `expectStatus(code)` | status equals `code` |
| `expectStatusIn(...codes)` | status is one of `codes` |
| `expectOk()` | status is 2xx |
| `expectClientError()` / `expectServerError()` / `expectRedirect()` | 4xx / 5xx / 3xx |
| `expectCreated()` / `expectAccepted()` / `expectNoContent()` | 201 / 202 / 204 |
| `expectBadRequest()` / `expectUnauthorized()` / `expectForbidden()` / `expectNotFound()` | 400 / 401 / 403 / 404 |

Headers and cookies:

| Check | Passes when |
| ----- | ----------- |
| `expectHeader(name, matcher?)` | header is present, and matches if you pass a matcher |
| `expectHeaderContains(name, substr)` | header value contains the substring |
| `expectHeaderAbsent(name)` | header is not present |
| `expectContentType(type)` | content type contains `type` |
| `expectCookie(name, matcher?)` | a `set-cookie` is present, and matches if given |

Body and JSON:

| Check | Passes when |
| ----- | ----------- |
| `expectJson(path, expected?)` | value at `path` exists, and matches if you pass `expected` |
| `expectJsonLength(path, n)` | array or string at `path` has length `n` |
| `expectArrayLength(path, n)` | same thing, named for arrays |
| `expectJsonContains(path, value)` | array contains a matching item (objects match by subset) |
| `expectJsonSchema(schema)` | the body validates against a JSON schema |
| `expectSorted(path, options?)` | the array at `path` is sorted (`{ key?, order? }`) |
| `expectBody(matcher)` | the whole body matches (deep compare for objects) |
| `expectBodyContains(substr)` | the raw text body contains `substr` |
| `expectEmpty()` / `expectNotEmpty()` | the body is empty / not empty |
| `expectTimeBelow(ms)` | the round trip was under `ms` |
| `check(label, fn)` | fails if `fn(response)` returns `false` or throws |
| `expectValue(path)` | hands you an `expect()` bound to the value at `path` |

```js
const res = await api.get("/users").expectOk();

res.expectValue("data[0].id").toBeGreaterThan(0);
res.expectValue("data").toHaveLength(2);
res.expectJsonContains("users", { id: 2 });            // subset match
res.expectSorted("data", { key: "id", order: "asc" });
```

About matchers: `expectHeader`, `expectJson`, and `expectBody` take a flexible
matcher. A RegExp is tested against the stringified value. A function is treated
as a predicate, so a truthy return passes. An object or array is compared
deeply. Anything else is compared with `===`.

```js
await api.get("/users")
  .expectJson("data[0].role", (role) => role === "admin")
  .expectJson("meta", { page: 1, total: 2 })
  .expectHeader("x-trace-id", /^[0-9a-f-]+$/);
```

## expect() for any value

`expect(value)` is not tied to responses, you can use it on anything. It has
`.not` for negation and `.resolves` / `.rejects` for promises.

```js
import { expect } from "two-go";

expect(2 + 2).toBe(4);
expect({ a: 1, b: 2 }).toMatchObject({ a: 1 });
expect([1, 2, 3]).toContain(2);
expect("hello").toMatch(/ell/);
expect(value).not.toBeNull();
expect(() => boom()).toThrow(/boom/);

await expect(Promise.resolve(5)).resolves.toBe(5);
await expect(Promise.reject(new Error("x"))).rejects.toMatch(/x/);
```

The matchers: `toBe`, `toEqual`, `toStrictEqual`, `toBeTruthy`, `toBeFalsy`,
`toBeNull`, `toBeUndefined`, `toBeDefined`, `toBeNaN`, `toBeGreaterThan`,
`toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeLessThanOrEqual`, `toBeCloseTo`,
`toContain`, `toContainEqual`, `toMatch`, `toMatchObject`, `toHaveLength`,
`toHaveProperty`, `toBeInstanceOf`, `toBeType`, `toBeOneOf`, `toThrow`,
`toSatisfy`, `toBeEmpty`. Each one also works negated through `.not`.

## Soft assertions

Sometimes you want to see every problem with a response in one run, not just the
first. That's what soft assertions are for. They collect failures and throw once
at the end.

```js
import { softly } from "two-go";

softly((expect) => {
  expect(res.status).toBe(200);
  expect(res.get("data")).toHaveLength(2);
  expect(res.get("data[0].role")).toBe("admin");
});
```

If you want to control when it throws, use `soft()` directly:

```js
import { soft } from "two-go";

const s = soft();
s.expect(res.status).toBe(200);
s.expect(res.get("total")).toBeGreaterThan(0);
console.log(s.failures); // what's failed so far, as strings
s.verify();              // throws one error listing everything, if anything failed
```

## Polling slow endpoints

When a value shows up eventually (a job finishes, a record gets indexed), retry
until it's there or you hit a timeout.

```js
import { eventually, pollUntil } from "two-go";

// Retry the whole block until it stops throwing.
await eventually(async () => {
  await api.get("/jobs/123").expectJson("status", "done");
}, { timeout: 5000, interval: 200 });

// Or poll a request until a predicate on the result is true. Returns the result.
const done = await pollUntil(
  () => api.get("/jobs/123"),
  (r) => r.get("status") === "done",
  { timeout: 5000, interval: 200, message: "job never finished" },
);
```

Options are `{ timeout = 5000, interval = 100, message }`. `retryUntil` is just
another name for `eventually`.

## Snapshots

Record a response once, then catch it when it changes later.

```js
import { toMatchSnapshot } from "two-go";

const res = await api.get("/users");
toMatchSnapshot(res.body, "users-list");
```

The first run writes `__snapshots__/users-list.json` and passes. After that it
compares and throws if anything differs. To accept a new version, pass
`{ update: true }` or set `TWO_GO_UPDATE_SNAPSHOTS=1`. Use `{ dir: "..." }` for
a different folder. `readSnapshot(name, options?)` gives you the stored value,
and `matchSnapshot` is another name for `toMatchSnapshot`.

## Sessions and chaining

Pull a value out of one response and reuse it in the next one with `{{var}}`
placeholders. The usual case is login, grab the token, call something that needs
it.

```js
import { session } from "two-go";

const s = session("https://api.example.com");

await s.post("/login")
  .json({ user: "ada", pass: "secret" })
  .extract("token", "data.token"); // saves body.data.token as {{token}}

await s.get("/me")
  .header("authorization", "Bearer {{token}}") // filled in before sending
  .expectOk()
  .expectJson("user", "ada");
```

`extract` takes either a name and a path, or a map like
`extract({ token: "data.token", id: "data.id" })`. You can also set and read the
context yourself with `s.set(name, value)`, `s.get(name)`, and `s.vars`.
Placeholders are replaced in the path, header values, and a string body.

## Fake data

Test payloads without pulling in a faker dependency.

```js
import { faker } from "two-go";

const payload = {
  id: faker.uuid(),
  email: faker.email(),
  name: faker.fullName(),
  age: faker.int(18, 80),
  active: faker.boolean(),
  tags: faker.arrayOf(() => faker.word(), 3),
  createdAt: faker.pastDate(),
};
```

There's `uuid`, `email`, `firstName`, `lastName`, `fullName`, `username`,
`word`, `words(n)`, `sentence(n)`, `paragraph(n)`, `number({min,max})`,
`int(min,max)`, `float(min,max,decimals)`, `boolean`, `pick(array)`,
`pickMany(array,n)`, `date(options)`, `pastDate`, `futureDate`, `hexColor`,
`ipv4`, `url`, `phone`, and `arrayOf(fn,n)`.

## Async helpers

The stuff plain utility libraries tend to skip.

```js
import {
  parallel, parallelLimit, series, waterfall, mapLimit, withTimeout,
} from "two-go";

await parallel([() => a(), () => b()]);          // all at once, results in order
await parallelLimit(tasks, 4);                   // cap concurrency at 4
await series([() => step1(), () => step2()]);    // one after another
await waterfall([() => seed(), (v) => next(v)]); // feed each result to the next
await mapLimit(ids, 5, (id) => api.get(`/items/${id}`));
await withTimeout(slowPromise, 1000, "too slow");
```

There's also `mapAsync(items, fn)` and `allSettledMap(items, fn)`, which never
rejects and gives you `{ status, value | reason }[]`.

## Utility belt

A general toolkit, about 170 functions, no dependencies. Import them flat from
`two-go/utils`, or use the `_` namespace and `chain()` from the main entry.

```js
import { chunk, groupBy, get, set, camelCase, debounce, retry, sleep } from "two-go/utils";
import { _, chain } from "two-go";

_.uniqBy([{ id: 1 }, { id: 1 }, { id: 2 }], "id"); // [{id:1},{id:2}]

chain([1, 2, 2, 3, 4])
  .uniq()
  .filter((n) => n % 2 === 0)
  .map((n) => n * 10)
  .value(); // [20, 40]
```

The groups: array (`chunk`, `uniq`, `difference`, `flatten`, `zip`, and so on),
collection (`map`, `filter`, `groupBy`, `keyBy`, `orderBy`, `partition`,
`sample`), object (`get`, `set`, `pick`, `omit`, `merge`, `mapValues`), string
(`camelCase`, `kebabCase`, `truncate`, `template`, `deburr`), number (`clamp`,
`sum`, `mean`, `range`), function (`debounce`, `throttle`, `memoize`, `sleep`,
`retry`), lang (`isString`, `isPlainObject`, `isEqual`, `cloneDeep`, and the
rest of the type guards), and a few odds and ends (`identity`, `times`,
`uniqueId`, `flow`).

## Schema validation and inference

A small JSON schema validator, plus a way to build a schema from a real
response for light contract testing.

```js
import { validate } from "two-go/schema";
import { inferSchema } from "two-go";

validate(
  { id: 1, name: "Ada" },
  { type: "object", required: ["id"], properties: { id: { type: "integer" } } },
);
// { valid: true, errors: [] }

const res = await api.get("/users");
const schema = res.toSchema();        // or inferSchema(res.body)
await api.get("/users").expectJsonSchema(schema);
```

It understands `type`, `required`, `properties`, `items`, `enum`, `const`,
`minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, and `nullable`.

## Debugging with curl and logging

```js
import { enableLogging } from "two-go";

// Print a curl command you can paste anywhere, including Postman.
console.log(api.get("/users").bearer("x").toCurl());

// Log every request and response (method, url, status, time).
const off = enableLogging(api);
await api.get("/users");
off(); // back to quiet
```

## Running tests

Because the checks throw, there's nothing to configure. Pick whatever you use.

With `node:test`:

```js
import { test } from "node:test";
import { go } from "two-go";

const api = go("https://api.example.com");

test("GET /users", async () => {
  await api.get("/users").expectStatus(200).expectJson("data[0].id");
});
```

```bash
node --test
```

With Jest, Vitest, or Mocha it's the same idea, just their `describe`/`it`.

There's also a built-in runner and CLI if you don't want to bring your own. Put
suites in `*.twogo.mjs` files (the old `*.2go.mjs` suffix still works). Each
file calls `suite()`, and the CLI finds and runs them.

```js
// test/users.twogo.mjs
import { go, suite } from "two-go";

const api = go("https://api.example.com");

suite("users API", ({ test, before, after }) => {
  before(async () => { /* setup */ });
  test("lists users", async () => {
    await api.get("/users").expectStatus(200).expectJson("data[0].id");
  });
  after(async () => { /* teardown */ });
});
```

```bash
npx two-go            # finds *.twogo.mjs under ./test
npx two-go path/to/dir
```

It prints a green check or a red cross with the error, ends with
`N passed, M failed`, and exits non-zero if anything failed. You can also drive
it yourself:

```js
import { suite, run } from "two-go";

suite("smoke", ({ test }) => {
  test("health", async () => {
    await go("https://api.example.com").get("/health").expectOk();
  });
});

const { passed, failed } = await run();
```

## BDD style

If you like given/when/then, `two-go/bdd` gives you a small, runner-agnostic
layer. `scenario(steps)` returns an async function you pass to your runner's
`test()`. Steps share a `world` object, and two-go's assertions decide pass or
fail. It does not import any runner, so it works with node:test, Jest, Vitest,
and Mocha.

```js
import { test } from "node:test";
import { go } from "two-go";
import { scenario, Given, When, Then, And } from "two-go/bdd";

const api = go("https://api.example.com");

test("creating a user", scenario([
  Given("a valid payload", (w) => { w.payload = { name: "Ada", email: "ada@example.com" }; }),
  When("the user is created", async (w) => { w.res = await api.post("/users").json(w.payload); }),
  Then("the response is 201", (w) => w.res.expectStatus(201)),
  And("the body echoes the name", (w) => w.res.expectJson("name", "Ada")),
]));
```

A `When` stashes the response on `world`, a `Then` asserts on it. Step helpers
are capitalized as in Gherkin. For a runnable
end to end suite (a shop with login, cart, checkout, and more) see the
`ecommerce-bdd` example in
[two-go-examples](https://github.com/two-go-testing/two-go-examples).

## Importing from OpenAPI or Postman

If you already have an OpenAPI document or a Postman collection, you can turn it
into a starting test suite instead of writing one by hand. JSON input for now.

```bash
two-go gen openapi ./openapi.json -o test/api.twogo.mjs
two-go gen postman ./collection.json -o test/api.twogo.mjs
# drop -o to print to stdout
```

Or from code:

```js
import { fromOpenapi, fromPostman } from "two-go/importers";

const code = fromOpenapi(JSON.parse(specJson)); // returns the suite source
```

For OpenAPI it writes one test per operation and asserts the documented 2xx
status, fills path params with a sample value, and takes the base URL from
`servers[0]`. For Postman it writes one test per request (folders get
flattened) and maps the method, path, headers, and JSON or urlencoded body. The
generated checks start at `.expectOk()` or `.expectStatus(...)` so you can
tighten them.

## Generating tests with AI

This part is optional. Point two-go at an LLM and it can draft a suite from a
live endpoint or a sample response. The core stays dependency free: the AI layer
talks to the provider over fetch, you bring your own key, and you can use OpenAI,
Anthropic, or any compatible endpoint including a local model.

```bash
export OPENAI_API_KEY=sk-...
two-go ai gen https://api.example.com/users -o test/users.twogo.mjs
# or from a saved response, with a different provider
two-go ai gen ./sample.json --provider anthropic -o test/users.twogo.mjs
```

From code:

```js
import { aiGenerateTests, createProvider } from "two-go/ai";

const code = await aiGenerateTests({
  endpoint: "/users",
  baseUrl: "https://api.example.com",
  sample: { data: [{ id: 1, name: "Ada" }] },
  provider: "openai", // or "anthropic", or pass a custom { baseURL } for a local model
});
```

The output is a normal `*.twogo.mjs` file, so it goes into git and runs in CI
like any other test. Treat it as a first draft and tighten the checks. The
default models are `gpt-5.3` for OpenAI and `claude-opus-4-8` for Anthropic, and
you can override either with `{ model }`.

When a test fails you can also ask the model what probably went wrong. This is
advisory, it runs after the failure and never changes pass or fail.

```js
import { explainFailure } from "two-go/ai";

try {
  await api.get("/users").expectStatus(200);
} catch (err) {
  const why = await explainFailure(err, { response: err.response, provider: "openai" });
  console.log(why); // likely cause plus a suggested fix
}
```

You can also use the model to hunt for bugs. `aiReview` looks at a response and
returns a list of likely problems, and `aiFuzz` generates adversarial payloads
you send with the normal client.

```js
import { aiReview, aiFuzz } from "two-go/ai";

const res = await api.get("/me");
const findings = await aiReview(res, { provider: "openai" });
// findings: [{ severity, field, message }], e.g. a leaked token or a wrong type

const payloads = await aiFuzz({
  endpoint: "/users",
  method: "POST",
  schema: { type: "object", properties: { name: { type: "string" } } },
});
for (const body of payloads) {
  const r = await api.post("/users").json(body);
  if (r.status >= 500) console.log("possible bug on payload", body, "->", r.status);
}
```

Both are advisory. `aiReview` hands you findings, `aiFuzz` hands you inputs, and
you decide what to do with them.

## MCP server

two-go ships an MCP (Model Context Protocol) server so an AI agent like Claude
can drive it directly: make HTTP calls, generate suites, infer and validate
schemas. It runs over stdio with no dependencies.

It is a local stdio server, so there is no URL, no account, and no API key.
Install it once so the `two-go-mcp` command is on your PATH:

```bash
npm install -g two-go
```

Then pick your client below and copy the block in. (If you would rather not
install globally, replace `two-go-mcp` with `npx -y two-go-mcp` everywhere.)

### Claude Code

Run this once:

```bash
claude mcp add two-go two-go-mcp
```

Or add it to a `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "two-go": { "command": "two-go-mcp" }
  }
}
```

### Claude Desktop

Add this to `claude_desktop_config.json` (Settings, Developer, Edit Config):

```json
{
  "mcpServers": {
    "two-go": { "command": "two-go-mcp" }
  }
}
```

### Cursor

Add this to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "two-go": { "command": "two-go-mcp" }
  }
}
```

### VS Code

Add this to `.vscode/mcp.json` (note the top-level key is `servers`):

```json
{
  "servers": {
    "two-go": { "type": "stdio", "command": "two-go-mcp" }
  }
}
```

### Windsurf

Add this to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "two-go": { "command": "two-go-mcp" }
  }
}
```

### Codex CLI

Run this:

```bash
codex mcp add two-go two-go-mcp
```

Or add it to `~/.codex/config.toml`:

```toml
[mcp_servers.two-go]
command = "two-go-mcp"
```

### Gemini CLI

Run this:

```bash
gemini mcp add two-go two-go-mcp
```

Or add it to `~/.gemini/settings.json` (or `.gemini/settings.json` in the project):

```json
{
  "mcpServers": {
    "two-go": { "command": "two-go-mcp" }
  }
}
```

### GitHub Copilot CLI

Add this to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "two-go": { "command": "two-go-mcp" }
  }
}
```

### Kiro

Add this to `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "two-go": { "command": "two-go-mcp" }
  }
}
```

The tools it exposes:

- `http_request`: send a request and get back status, headers, timing, and body.
- `gen_openapi` / `gen_postman`: generate a suite from a spec or collection.
- `infer_schema`: infer a JSON schema from a value.
- `validate_schema`: validate a value against a schema.

The server logic is also importable if you want to host it yourself:

```js
import { createServer } from "two-go/mcp";

const server = createServer();
const response = await server.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" });
```

## TypeScript

Types are written by hand and shipped with the package, so you get
autocomplete and checking with no `@types` install and nothing at runtime. It
works from `two-go` and every subpath.

```ts
import go, { expect, faker } from "two-go";
import { chunk } from "two-go/utils";

const res = await go("https://api.example.com").get("/users").expectOk();
res.expectValue("data[0].id").toBeGreaterThan(0);
const ids: number[][] = chunk([1, 2, 3, 4], 2);
```

## Docker

Run the test suite in a container if you want it reproducible:

```bash
docker build -t two-go .
docker run --rm two-go
```

## Recipes

For full runnable setups, including a Docker Compose example that tests a
microservice next to MySQL and MSSQL, see
[two-go-examples](https://github.com/two-go-testing/two-go-examples).

Log in, then use the token:

```js
import { session } from "two-go";

const s = session(process.env.BASE_URL);
await s.post("/auth/login").json({ email, password }).extract("token", "data.token");
await s.get("/account").header("authorization", "Bearer {{token}}").expectOk();
```

Wait for a flaky or async endpoint:

```js
import { eventually } from "two-go";

await eventually(() => api.get("/report/42").expectJson("ready", true),
  { timeout: 10000, interval: 500 });
```

Table driven tests with `node:test`:

```js
import { test } from "node:test";
import { go } from "two-go";

const api = go(process.env.BASE_URL);
const cases = [
  { id: 1, status: 200 },
  { id: 999999, status: 404 },
];

for (const c of cases) {
  test(`GET /users/${c.id} -> ${c.status}`, async () => {
    await api.get(`/users/${c.id}`).expectStatus(c.status);
  });
}
```

Page through and collect:

```js
import { mapLimit } from "two-go";

const pages = await mapLimit([1, 2, 3, 4, 5], 2, (p) =>
  api.get("/users").query({ page: p }));
const all = pages.flatMap((r) => r.get("data"));
```

Lock a response shape as a contract:

```js
import { inferSchema } from "two-go";

const golden = (await api.get("/users")).body;
const schema = inferSchema(golden);
// later, in CI:
await api.get("/users").expectJsonSchema(schema);
```

## two-go next to other tools

| | two-go | Postman | supertest | chai or jest alone |
| --- | --- | --- | --- | --- |
| HTTP client included | yes (native fetch) | yes (GUI) | yes (around an app) | no |
| Tests are code in git | yes | collections as JSON | yes | yes |
| Runs in node:test/Jest/Vitest/Mocha | yes | no (sandbox) | yes | yes |
| Inline HTTP checks | yes | `pm.*` | partial | no |
| Value assertions | yes | Chai | no | yes |
| Polling, soft, snapshot, sessions | yes | partial | no | no |
| Utility belt and fake data | yes | limited | no | no |
| Runtime dependencies | 0 | n/a | several | several |

A note on Postman: you can't run two-go inside Postman, because its script
sandbox doesn't allow arbitrary npm packages. The bridge goes the other way.
Use `toCurl()` to take a request out of two-go and paste it into Postman.

## FAQ

Is this a unit testing framework? No. It's for API and service testing, and it
runs inside the unit test runner you already use. (Its own internals are covered
by real unit tests.)

Can I use it inside Postman scripts? No, see the note above. Use `toCurl()` to
go the other direction.

Do I need TypeScript? No. It's plain ESM JavaScript. The types are there for
editors and TS users but they're never required.

What about CommonJS? two-go is ESM only. Use `import`, or a dynamic `import()`
from a CommonJS file.

Why zero dependencies? Faster installs, nothing to audit, and it runs anywhere
Node 18 runs.

## Roadmap

Rough order, suggestions welcome in issues:

1. Reporters: JUnit XML and JSON output from the built-in runner for CI.
2. A GraphQL helper, `.graphql(query, variables)`.
3. A cookie jar so sessions carry cookies automatically.
4. Request level retry and backoff, `.retry({ attempts, backoff })`.
5. A one liner mock server for fixtures.
6. Performance checks over repeated calls.

## Contributing

Pull requests are welcome. Keep the zero dependency rule, add tests for new
behavior, and run `npm test` before you open a PR. The unit suite also checks
that every `.d.ts` file matches its module's runtime exports, so keep the
declarations in sync when you add or rename an export.

```bash
npm test          # unit tests plus the end to end self test
npm run test:unit # just the unit tests
npm run test:e2e  # just the self test
```

## License

[MIT](./LICENSE), Tugkan Boz, 2026.
