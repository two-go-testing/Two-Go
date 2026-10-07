// Ambient declarations for the stateful session request-chaining module.
import type { GoResponse } from "./response.js";

export interface SessionRequest extends PromiseLike<GoResponse> {
  // Forwarded configuration methods (chainable).
  headers(headers: Record<string, string>): this;
  header(name: string, value: string): this;
  query(params: Record<string, unknown>): this;
  bearer(token: string): this;
  json(body: unknown): this;
  form(body: Record<string, unknown>): this;
  text(body: string): this;
  timeout(ms: number): this;

  // Forwarded queued assertion methods (chainable).
  expectStatus(status: number): this;
  expectStatusIn(...codes: number[]): this;
  expectStatusIn(codes: number[]): this;
  expectOk(): this;
  expectHeader(name: string, expected?: unknown): this;
  expectJson(path: string, expected?: unknown): this;
  expectBody(expected: unknown): this;
  expectTimeBelow(ms: number): this;
  check(name: string, fn: (response: GoResponse) => boolean): this;

  // Register values to pull from the response into the session context.
  extract(map: Record<string, string>): this;
  extract(name: string, path: string): this;

  // Send the request, interpolating placeholders and applying extracts.
  run(): Promise<GoResponse>;

  // Thenable surface.
  then<TResult1 = GoResponse, TResult2 = never>(
    onFulfilled?: ((value: GoResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<GoResponse | TResult>;
  finally(onFinally?: (() => void) | null): Promise<GoResponse>;
}

export declare class Session {
  constructor(baseURLorOptions: string | object);

  // Shared variable context for interpolation and extraction.
  vars: Record<string, unknown>;

  // GET verb, or accessor for a known context variable.
  get(pathOrName: string): SessionRequest | unknown;

  // Set a context variable; chainable.
  set(name: string, value: unknown): this;

  // HTTP verbs, each returning a chainable SessionRequest.
  put(path: string): SessionRequest;
  post(path: string): SessionRequest;
  patch(path: string): SessionRequest;
  delete(path: string): SessionRequest;
  head(path: string): SessionRequest;
  options(path: string): SessionRequest;
}

export declare function session(baseURLorOptions: string | object): Session;