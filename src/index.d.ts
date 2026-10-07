// Ambient type declarations for two-go's public entry point (src/index.js).
import type { GoClient } from "./client.js";

/** Factory. Accepts a base URL string or an options object, returns a GoClient. */
export declare function go(
  optionsOrBaseURL?:
    | string
    | { baseURL?: string; headers?: Record<string, string>; timeout?: number }
): GoClient;

export { GoClient, RequestBuilder } from "./client.js";
export { GoResponse } from "./response.js";
export { AssertionError, resolvePath, matches, deepEqual } from "./assertions.js";
export { suite, run, reset } from "./runner.js";
export { toJUnit, toJSON } from "./reporters.js";
export { expect, Expectation } from "./expect.js";
export { validate, isValid } from "./schema.js";
export { chain } from "./utils/chain.js";

// differentiators
export { soft, softly } from "./soft.js";
export { eventually, pollUntil, retryUntil } from "./eventually.js";
export { toMatchSnapshot, matchSnapshot, readSnapshot } from "./snapshot.js";
export { session } from "./session.js";
export { faker } from "./faker.js";
export {
  parallel,
  parallelLimit,
  series,
  waterfall,
  mapAsync,
  mapLimit,
  withTimeout,
  allSettledMap,
} from "./async.js";
export { toCurl, enableLogging } from "./curl.js";
export { inferSchema } from "./infer-schema.js";
export { fromPostman, fromOpenapi } from "./importers/index.js";
export {
  createProvider,
  aiGenerateTests,
  explainFailure,
  aiReview,
  aiFuzz,
} from "./ai/index.js";

// Namespace of all lodash-inspired utilities, available as both `_` and `utils`.
export declare const _: typeof import("./utils/index.js");
export * as utils from "./utils/index.js";

export default go;
