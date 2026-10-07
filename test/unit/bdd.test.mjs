// Unit tests for the runner-agnostic BDD layer.
import { test } from "node:test";
import assert from "node:assert/strict";

import { scenario, feature, Given, When, Then, And } from "../../src/bdd.js";

test("step builders carry a kind, text, and run", () => {
  const g = Given("a thing", () => {});
  assert.equal(g.kind, "Given");
  assert.equal(g.text, "a thing");
  assert.equal(typeof g.run, "function");
  assert.equal(When("x", () => {}).kind, "When");
  assert.equal(Then("x", () => {}).kind, "Then");
  assert.equal(And("x", () => {}).kind, "And");
});

test("scenario runs steps in order sharing one world", async () => {
  const order = [];
  const run = scenario([
    Given("seed", (w) => { w.n = 1; order.push("g"); }),
    When("increment", (w) => { w.n += 1; order.push("w"); }),
    Then("assert", (w) => { assert.equal(w.n, 2); order.push("t"); }),
  ]);
  const world = await run();
  assert.deepEqual(order, ["g", "w", "t"]);
  assert.equal(world.n, 2);
});

test("scenario awaits async steps", async () => {
  const run = scenario([
    When("async work", async (w) => { w.value = await Promise.resolve(42); }),
    Then("value is set", (w) => assert.equal(w.value, 42)),
  ]);
  await run();
});

test("a throwing step rejects the scenario", async () => {
  const run = scenario([
    Then("fails", () => { throw new Error("boom"); }),
  ]);
  await assert.rejects(run, /boom/);
});

test("scenario can seed the world and log step lines", async () => {
  const lines = [];
  const run = scenario(
    [Given("uses seed", (w) => assert.equal(w.base, 10))],
    { world: { base: 10 }, log: (line) => lines.push(line) }
  );
  await run();
  assert.deepEqual(lines, ["Given uses seed"]);
});

test("feature builds a labelled, runnable list", async () => {
  const built = feature("Math", {
    "adds": [Given("a", (w) => { w.a = 2; }), Then("ok", (w) => assert.equal(w.a, 2))],
    "subtracts": [Then("ok", () => {})],
  });
  assert.equal(built.length, 2);
  assert.equal(built[0].name, "Math: adds");
  assert.equal(built[1].name, "Math: subtracts");
  await built[0].run();
  await built[1].run();
});

test("the module namespace is not a thenable, so dynamic import resolves", async () => {
  const mod = await import("../../src/bdd.js");
  assert.equal(typeof mod.Given, "function");
  assert.equal("then" in mod, false);
});
