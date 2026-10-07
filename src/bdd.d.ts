// Type declarations for the runner-agnostic BDD layer.

export type World = Record<string, any>;

export interface Step {
  kind: "Given" | "When" | "Then" | "And";
  text: string;
  run: (world: World) => unknown | Promise<unknown>;
}

export interface ScenarioOptions {
  world?: World;
  log?: (line: string) => void;
}

export declare function Given(text: string, run: (world: World) => unknown | Promise<unknown>): Step;
export declare function When(text: string, run: (world: World) => unknown | Promise<unknown>): Step;
export declare function Then(text: string, run: (world: World) => unknown | Promise<unknown>): Step;
export declare function And(text: string, run: (world: World) => unknown | Promise<unknown>): Step;

/** Turn a list of steps into an async function for your runner's test(). */
export declare function scenario(steps: Step[], options?: ScenarioOptions): () => Promise<World>;

/** Build a labelled list of scenarios from a feature definition. */
export declare function feature(
  name: string,
  scenarios: Record<string, Step[]>,
  options?: ScenarioOptions
): Array<{ name: string; run: () => Promise<World> }>;
