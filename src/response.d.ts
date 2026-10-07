// Ambient declarations for GoResponse: core assertions plus http-assertions and infer-schema prototype extensions.
import type { Expectation } from "./expect.js";

export interface GoResponseInit {
  status: number;
  statusText: string;
  headers?: Record<string, string>;
  body: unknown;
  text: string;
  time: number;
  url: string;
  method: string;
}

export interface SortOptions {
  key?: string;
  order?: "asc" | "desc";
}

export type Matcher = string | RegExp | ((value: unknown) => boolean) | unknown;

export declare class GoResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  text: string;
  time: number;
  url: string;
  method: string;

  constructor(init: GoResponseInit);

  // Core assertions (response.js)
  expectStatus(code: number): this;
  expectStatusIn(...codes: number[]): this;
  expectStatusIn(codes: number[]): this;
  expectOk(): this;
  expectHeader(name: string, matcher?: Matcher): this;
  expectJson(path: string, expected?: unknown): this;
  expectBody(matcher: Matcher): this;
  expectTimeBelow(ms: number): this;
  check(label: string, fn: (response: this) => unknown): this;
  get(path: string): unknown;

  // HTTP assertions (http-assertions.js)
  expectClientError(): this;
  expectServerError(): this;
  expectRedirect(): this;
  expectCreated(): this;
  expectAccepted(): this;
  expectNoContent(): this;
  expectBadRequest(): this;
  expectUnauthorized(): this;
  expectForbidden(): this;
  expectNotFound(): this;
  expectContentType(type: string): this;
  expectHeaderContains(name: string, substr: string): this;
  expectHeaderAbsent(name: string): this;
  expectJsonSchema(schema: unknown): this;
  expectJsonLength(path: string, n: number): this;
  expectJsonContains(path: string, value: unknown): this;
  expectArrayLength(path: string, n: number): this;
  expectSorted(path: string, options?: SortOptions): this;
  expectCookie(name: string, matcher?: Matcher): this;
  expectBodyContains(substr: string): this;
  expectEmpty(): this;
  expectNotEmpty(): this;
  expectValue(path: string): Expectation;

  // Schema inference (infer-schema.js)
  toSchema(path?: string | null): unknown;
}
