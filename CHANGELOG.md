# Changelog

All notable changes to this project are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- **`toStrictEqual` no longer passes for different Dates, RegExps, Maps or Sets.**
  These carry no own keys, so two different dates were reported strictly equal.
  It now compares them by content, and also checks array length and sparseness.
- **`expectStatusIn` accepts an array.** The chained (`RequestBuilder`) and
  session typings declared `expectStatusIn(number[])`, but the runtime only
  accepted variadic codes, so the typed form always failed. Both forms now work
  everywhere, and the typings declare both.
- **Declarations match the runtime.** `index.d.ts` now declares `toJUnit`,
  `toJSON`, `fromPostman`, `fromOpenapi`, `createProvider`,
  `aiGenerateTests`, `explainFailure`, `aiReview` and `aiFuzz`, which were
  exported but undeclared. `Session`, which was declared as a class, is now
  actually exported from `two-go/session`.

### Changed

- **No toolchain dependency at all.** The `typecheck` script (which needed an
  undeclared TypeScript install) is replaced by a `node:test` suite that checks
  every `.d.ts` against its module's runtime exports and class prototypes.
- `expect(x).toBeEmpty()` now shares `isEmpty` from the utility belt, so a
  function counts as empty (lodash semantics), matching `expectEmpty()`.
- Internal cleanup: one implementation each for path resolution, matcher
  formatting, response failure messages and `sleep`, instead of copies.

## [1.1.1]

### Fixed

- **expectJsonSchema actually validates now.** It was calling the validator with
  its arguments swapped, so schema checks silently passed for most bodies. It now
  validates the response body against the schema.
- **Deep equality no longer reports false matches for Date / RegExp / Map / Set.**
  `matches()` (used by `expectJson`, `expectBody`, `expectHeader`, `expectCookie`)
  now delegates to the correct `isEqual`, so `expectJson(path, new Date(...))` and
  similar comparisons are meaningful instead of always passing.
- **The JSON-schema validator rejects `NaN`** for `type: "number"` (and therefore
  for `minimum`/`maximum`), since JSON has no `NaN`.

## [1.1.0]

### Added

- **GraphQL helper**: `client.graphql(query, variables, { path })` POSTs
  `{ query, variables }` and returns the usual chainable builder.
- **Request retry/backoff**: `.retry({ attempts, delay, factor, on })` on the
  builder retries on a thrown error or when `on(response)` is truthy.
- **Cookie jar**: `go({ cookies: true })` (or pass a `Map`) captures Set-Cookie
  and replays Cookie on later requests from that client.
- **Reporters** (`two-go/reporters`): `toJUnit(result)` and `toJSON(result)`
  turn a `run()` result into CI-friendly output. The CLI gained
  `--reporter junit|json [--out <file>]`, and `run()` now returns a `tests`
  array with per-test status, duration, and error.
- **BDD layer** (`two-go/bdd`): runner-agnostic `given` / `when` / `then` /
  `and` plus `scenario(steps)` and `feature(...)`. Works with node:test, Jest,
  Vitest, and Mocha.

### Changed

- The extended HTTP assertions (`expectClientError`, `expectJsonSchema`,
  `expectJsonContains`, `expectCookie`, `expectSorted`, and the rest) are now
  chainable on the request builder too, not only on a resolved response. So
  `api.get("/x").expectStatus(200).expectJsonSchema(schema)` works. `expectValue`
  stays response-only since it returns an `expect()`.

## [1.0.0] - 2026-06-02

First stable release. The HTTP client, assertions, utilities, and the AI and MCP
layers are all considered stable from here.

### Added

- **Importers**: `fromOpenapi` and `fromPostman` generate runnable
  `*.twogo.mjs` suites from an OpenAPI 3 document or a Postman v2.1 collection
  (JSON). New CLI command `two-go gen <openapi|postman> <file> [-o <out>]` and
  the `two-go/importers` subpath.
- **AI layer** (`two-go/ai`): an optional, dependency-free LLM client over
  fetch (`createProvider`, bring your own key, OpenAI/Anthropic/custom baseURL)
  and `aiGenerateTests` to draft a suite from an endpoint or sample response.
  New CLI command `two-go ai gen <url|file> [-o out]`.
- **AI failure explanation** (`explainFailure`): send a failed assertion plus
  the request and response context to an LLM and get a likely cause and a
  suggested fix. Advisory only, it never changes pass or fail.
- **AI bug catching**: `aiReview(response)` returns a list of likely problems
  (bad types, missing fields, leaked secrets, status/body mismatches), and
  `aiFuzz(options)` generates adversarial request payloads to probe an endpoint.
- **MCP server** (`two-go-mcp` binary, `two-go/mcp`): a zero-dependency Model
  Context Protocol server over stdio so agents can call `http_request` and the
  importer and schema helpers as tools.

## [0.4.0]

### Added

- **TypeScript types**: hand-checked `.d.ts` declarations for the entire public
  API (core, assertions, utilities, and every feature), wired through the
  `types` field and per-subpath `exports` conditions. Full editor autocomplete
  with no runtime dependency.
- **GitHub Actions CI** running the suite on Node 18 / 20 / 22.
- **Dockerfile** + `.dockerignore` to run the test suite in a container.
- `prepublishOnly` (tests gate publishing) and `typecheck` scripts.

## [0.3.0]

### Added

- **Soft assertions** (`soft` / `softly`): collect every failure and report
  them together instead of failing fast.
- **Polling** (`eventually`, `pollUntil`, `retryUntil`): retry an assertion or
  request until it passes or a timeout elapses.
- **Snapshot testing** (`toMatchSnapshot`, `matchSnapshot`, `readSnapshot`)
  with an update mode (`TWO_GO_UPDATE_SNAPSHOTS`).
- **Session chaining** (`session`): extract values from a response and reuse
  them in later requests via `{{var}}` interpolation.
- **Faker-lite** (`faker`): zero-dependency fake test data (uuid, email, names,
  numbers, dates, and more).
- **Async control-flow** (`parallel`, `parallelLimit`, `series`, `waterfall`,
  `mapAsync`, `mapLimit`, `withTimeout`, `allSettledMap`).
- **curl export** (`RequestBuilder.toCurl()`, `toCurl`) and request/response
  **logging** (`enableLogging`).
- **Schema inference** (`inferSchema`, `GoResponse.toSchema()`).
- Subpath exports for every feature area.

## [0.2.0]

### Added

- A lodash-inspired, zero-dependency **utility belt** (~170 functions) across
  array, collection, object, string, number, function, lang, and misc groups,
  plus an eager `chain()` wrapper. Available from `two-go/utils` and the `_`
  namespace.
- A **Jest-style `expect()`** with `.not` negation and `.resolves` / `.rejects`.
- Extended **HTTP assertions** on `GoResponse` (status classes, headers,
  cookies, JSON length/contains, schema, sorted, `expectValue`).
- A tiny **JSON-schema validator** (`validate`, `isValid`).
- Subpath exports `two-go/utils`, `two-go/expect`, `two-go/schema`.

## [0.1.0]

### Added

- Initial release: zero-dependency fluent HTTP client (`go`), thenable
  `RequestBuilder`, `GoResponse` with inline assertions, a minimal `suite()` /
  `run()` runner, and the `two-go` CLI.
