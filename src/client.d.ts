// Type declarations for the two-go HTTP client (GoClient + thenable RequestBuilder).
import type { GoResponse } from "./response.js";

export interface GoClientOptions {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  /** Enable a cookie jar (true) or supply your own Map of name to value. */
  cookies?: boolean | Map<string, string>;
}

export interface RetryOptions {
  attempts?: number;
  delay?: number;
  factor?: number;
  on?: (response: GoResponse) => boolean;
}

export type HttpMethod =
  | "GET"
  | "PUT"
  | "POST"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export declare class GoClient {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;

  constructor(opts?: GoClientOptions);

  get(path: string): RequestBuilder;
  put(path: string): RequestBuilder;
  post(path: string): RequestBuilder;
  patch(path: string): RequestBuilder;
  delete(path: string): RequestBuilder;
  head(path: string): RequestBuilder;
  options(path: string): RequestBuilder;

  send(req: RequestBuilder): Promise<GoResponse>;

  /** POST a GraphQL query (added by graphql.js). */
  graphql(
    query: string,
    variables?: Record<string, unknown>,
    options?: { path?: string }
  ): RequestBuilder;
}

export declare class RequestBuilder implements PromiseLike<GoResponse> {
  client: GoClient;
  method: HttpMethod;
  path: string;

  constructor(client: GoClient, method: HttpMethod, path: string);

  // --- request configuration (chainable) ---
  headers(obj: Record<string, string>): this;
  header(name: string, value: string): this;
  query(obj: Record<string, unknown>): this;
  bearer(token: string): this;
  json(body: unknown): this;
  form(obj: Record<string, string> | URLSearchParams): this;
  text(str: string): this;
  timeout(ms: number): this;
  retry(options?: RetryOptions): this;

  // --- queued assertions (chainable) ---
  expectStatus(status: number): this;
  expectStatusIn(...codes: number[]): this;
  expectStatusIn(codes: number[]): this;
  expectOk(): this;
  expectHeader(name: string, value?: unknown): this;
  expectJson(path: string, value?: unknown): this;
  expectBody(value: unknown): this;
  expectTimeBelow(ms: number): this;
  check(fn: (response: GoResponse) => unknown): this;

  // --- extended HTTP assertions, also chainable here (added by http-assertions.js) ---
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
  expectSorted(path: string, options?: { key?: string; order?: "asc" | "desc" }): this;
  expectCookie(name: string, matcher?: unknown): this;
  expectBodyContains(substr: string): this;
  expectEmpty(): this;
  expectNotEmpty(): this;

  // --- run + thenable ---
  run(): Promise<GoResponse>;

  then<TResult1 = GoResponse, TResult2 = never>(
    onFulfilled?: ((value: GoResponse) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined
  ): Promise<TResult1 | TResult2>;

  catch<TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null | undefined
  ): Promise<GoResponse | TResult>;

  finally(onFinally?: (() => void) | null | undefined): Promise<GoResponse>;

  // --- added by curl.js (prototype augmentation) ---
  toCurl(): string;
}