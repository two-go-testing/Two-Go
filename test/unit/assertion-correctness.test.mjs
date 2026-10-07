// Regression tests for false-pass / false-fail assertion bugs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matches, deepEqual, AssertionError } from "../../src/assertions.js";
import { expect } from "../../src/expect.js";
import { GoResponse } from "../../src/response.js";
import { validate } from "../../src/schema.js";

test("matches no longer treats different Dates as equal", () => {
  assert.equal(matches(new Date(0), new Date(1000)), false);
  assert.equal(matches(new Date(1000), new Date(1000)), true);
});

test("matches distinguishes Maps, Sets, and RegExps", () => {
  assert.equal(matches(new Map([["a", 1]]), new Map([["a", 2]])), false);
  assert.equal(matches(new Set([1, 2]), new Set([1, 3])), false);
  assert.equal(matches(/a/i, /b/i), false);
  assert.equal(deepEqual(new Set([1, 2]), new Set([1, 2])), true);
});

test("plain object deep equality still works", () => {
  assert.equal(matches({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }), true);
  assert.equal(matches({ a: 1 }, { a: 2 }), false);
});

test("schema validator rejects NaN for type number and range", () => {
  assert.equal(validate(NaN, { type: "number" }).valid, false);
  assert.equal(validate(NaN, { type: "number", minimum: 0, maximum: 10 }).valid, false);
  assert.equal(validate(5, { type: "number", minimum: 0, maximum: 10 }).valid, true);
});

test("toStrictEqual compares Date / RegExp / Map / Set by content", () => {
  assert.throws(() => expect(new Date(0)).toStrictEqual(new Date(1000)), AssertionError);
  assert.throws(() => expect(/a/).toStrictEqual(/b/), AssertionError);
  assert.throws(() => expect(new Map([["a", 1]])).toStrictEqual(new Map([["a", 2]])), AssertionError);
  assert.throws(() => expect(new Set([1])).toStrictEqual(new Set([2])), AssertionError);
  expect(new Date(5)).toStrictEqual(new Date(5));
  expect({ at: new Date(5) }).toStrictEqual({ at: new Date(5) });
});

test("toStrictEqual checks array length and sparseness", () => {
  assert.throws(() => expect(new Array(3)).toStrictEqual(new Array(5)), AssertionError);
  // eslint-disable-next-line no-sparse-arrays
  assert.throws(() => expect([, 1]).toStrictEqual([undefined, 1]), AssertionError);
  expect([1, [2]]).toStrictEqual([1, [2]]);
});

test("expectStatusIn accepts codes variadically or as one array", () => {
  const res = new GoResponse({ status: 201, headers: {}, url: "/x", method: "GET" });
  res.expectStatusIn(200, 201);
  res.expectStatusIn([200, 201]);
  assert.throws(() => res.expectStatusIn([200, 204]), AssertionError);
  assert.throws(() => res.expectStatusIn(200, 204), AssertionError);
});
