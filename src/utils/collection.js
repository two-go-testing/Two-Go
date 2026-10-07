// Collection helpers that work uniformly on arrays and plain objects.
// For objects, iteration is over values while the callback also receives the key.
// fn callbacks receive (value, keyOrIndex, coll). Iteratees may be a function
// or a string property path (e.g. "user.id" / "items[0].name").
// All type guards and deep equality come from the shared lang.js module.

import { isArray, isFunction, isNil, isString, isEqual } from "./lang.js";
import { get } from "./object.js";


// Turn an iteratee (function or string path) into a value-producing function.
function toIteratee(iteratee) {
  if (isFunction(iteratee)) return iteratee;
  if (isString(iteratee)) return (value) => get(value, iteratee);
  // null/undefined iteratee acts as identity.
  return (value) => value;
}

// Return the ordered list of keys for a collection (indices for arrays).
function keysOf(coll) {
  if (isArray(coll)) {
    const keys = [];
    for (let i = 0; i < coll.length; i += 1) keys.push(i);
    return keys;
  }
  if (isNil(coll)) return [];
  return Object.keys(coll);
}

// Iterate a collection, invoking fn(value, keyOrIndex, coll) for each entry.
export function forEach(coll, fn) {
  const keys = keysOf(coll);
  for (const key of keys) {
    fn(coll[key], key, coll);
  }
  return coll;
}

// Map each entry to a new value, returning a flat array of results.
export function map(coll, fn) {
  const callback = toIteratee(fn);
  const keys = keysOf(coll);
  const result = [];
  for (const key of keys) {
    result.push(callback(coll[key], key, coll));
  }
  return result;
}

// Return an array of values for which fn returns truthy.
export function filter(coll, fn) {
  const keys = keysOf(coll);
  const result = [];
  for (const key of keys) {
    if (fn(coll[key], key, coll)) result.push(coll[key]);
  }
  return result;
}

// Return an array of values for which fn returns falsy (inverse of filter).
export function reject(coll, fn) {
  const keys = keysOf(coll);
  const result = [];
  for (const key of keys) {
    if (!fn(coll[key], key, coll)) result.push(coll[key]);
  }
  return result;
}

// Reduce a collection left-to-right. If acc is omitted, the first value is used.
export function reduce(coll, fn, acc) {
  const keys = keysOf(coll);
  let accumulator = acc;
  let startIndex = 0;

  if (arguments.length < 3) {
    if (keys.length === 0) return undefined;
    accumulator = coll[keys[0]];
    startIndex = 1;
  }

  for (let i = startIndex; i < keys.length; i += 1) {
    const key = keys[i];
    accumulator = fn(accumulator, coll[key], key, coll);
  }

  return accumulator;
}

// Reduce a collection right-to-left. If acc is omitted, the last value is used.
export function reduceRight(coll, fn, acc) {
  const keys = keysOf(coll);
  let accumulator = acc;
  let startIndex = keys.length - 1;

  if (arguments.length < 3) {
    if (keys.length === 0) return undefined;
    accumulator = coll[keys[startIndex]];
    startIndex -= 1;
  }

  for (let i = startIndex; i >= 0; i -= 1) {
    const key = keys[i];
    accumulator = fn(accumulator, coll[key], key, coll);
  }

  return accumulator;
}

// Return the first value for which fn returns truthy, or undefined.
export function find(coll, fn) {
  const keys = keysOf(coll);
  for (const key of keys) {
    if (fn(coll[key], key, coll)) return coll[key];
  }
  return undefined;
}

// Return the last value for which fn returns truthy, or undefined.
export function findLast(coll, fn) {
  const keys = keysOf(coll);
  for (let i = keys.length - 1; i >= 0; i -= 1) {
    const key = keys[i];
    if (fn(coll[key], key, coll)) return coll[key];
  }
  return undefined;
}

// Return true if fn returns truthy for at least one value.
export function some(coll, fn) {
  const keys = keysOf(coll);
  for (const key of keys) {
    if (fn(coll[key], key, coll)) return true;
  }
  return false;
}

// Return true if fn returns truthy for every value (true for empty collections).
export function every(coll, fn) {
  const keys = keysOf(coll);
  for (const key of keys) {
    if (!fn(coll[key], key, coll)) return false;
  }
  return true;
}

// Return true if value is present among the collection's values (deep equality).
export function includes(coll, value) {
  const keys = keysOf(coll);
  for (const key of keys) {
    if (isEqual(coll[key], value)) return true;
  }
  return false;
}

// Group values into an object keyed by the iteratee result for each value.
export function groupBy(coll, iteratee) {
  const callback = toIteratee(iteratee);
  const keys = keysOf(coll);
  const result = {};

  for (const key of keys) {
    const value = coll[key];
    const groupKey = callback(value, key, coll);
    if (!Object.prototype.hasOwnProperty.call(result, groupKey)) {
      result[groupKey] = [];
    }
    result[groupKey].push(value);
  }

  return result;
}

// Build an object keyed by the iteratee result, keeping the last value per key.
export function keyBy(coll, iteratee) {
  const callback = toIteratee(iteratee);
  const keys = keysOf(coll);
  const result = {};

  for (const key of keys) {
    const value = coll[key];
    const mapKey = callback(value, key, coll);
    result[mapKey] = value;
  }

  return result;
}

// Count occurrences of each iteratee result across the collection's values.
export function countBy(coll, iteratee) {
  const callback = toIteratee(iteratee);
  const keys = keysOf(coll);
  const result = {};

  for (const key of keys) {
    const countKey = callback(coll[key], key, coll);
    if (!Object.prototype.hasOwnProperty.call(result, countKey)) {
      result[countKey] = 0;
    }
    result[countKey] += 1;
  }

  return result;
}

// Compare two resolved values for sorting; mirrors default numeric/string order.
function compareValues(a, b) {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (a === null) return 1;
  if (b === null) return -1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Stable sort the collection's values by multiple iteratees and parallel orders.
// orders is an array of "asc"/"desc"; missing entries default to "asc".
export function orderBy(coll, iteratees, orders) {
  const iterateeList = isArray(iteratees) ? iteratees : [iteratees];
  const orderList = isArray(orders) ? orders : [];
  const callbacks = iterateeList.map((it) => toIteratee(it));

  const keys = keysOf(coll);
  const decorated = keys.map((key, index) => ({
    value: coll[key],
    key,
    index,
    criteria: callbacks.map((cb) => cb(coll[key], key, coll))
  }));

  decorated.sort((left, right) => {
    for (let i = 0; i < callbacks.length; i += 1) {
      const direction = orderList[i] === "desc" ? -1 : 1;
      const result = compareValues(left.criteria[i], right.criteria[i]);
      if (result !== 0) return result * direction;
    }
    // Preserve original order for equal entries (stable sort).
    return left.index - right.index;
  });

  return decorated.map((item) => item.value);
}

// Sort the collection's values ascending by one or more iteratees.
export function sortBy(coll, iteratees) {
  const iterateeList = isArray(iteratees) ? iteratees : [iteratees];
  return orderBy(coll, iterateeList, []);
}

// Split values into [pass, fail] arrays based on fn's truthiness.
export function partition(coll, fn) {
  const keys = keysOf(coll);
  const pass = [];
  const fail = [];

  for (const key of keys) {
    const value = coll[key];
    if (fn(value, key, coll)) {
      pass.push(value);
    } else {
      fail.push(value);
    }
  }

  return [pass, fail];
}

// Map each value to a value/array via fn, then flatten one level into an array.
export function flatMap(coll, fn) {
  const keys = keysOf(coll);
  const result = [];

  for (const key of keys) {
    const mapped = fn(coll[key], key, coll);
    if (isArray(mapped)) {
      for (const item of mapped) result.push(item);
    } else {
      result.push(mapped);
    }
  }

  return result;
}

// Return the number of entries in the collection (length for arrays, key count
// for objects, character count for strings).
export function size(coll) {
  if (isNil(coll)) return 0;
  if (isArray(coll) || isString(coll)) return coll.length;
  return Object.keys(coll).length;
}

// Return a single random value from the collection, or undefined when empty.
export function sample(coll) {
  const keys = keysOf(coll);
  if (keys.length === 0) return undefined;
  const index = Math.floor(Math.random() * keys.length);
  return coll[keys[index]];
}

// Return up to n random values from the collection without repeats.
export function sampleSize(coll, n) {
  const values = map(coll, (value) => value);
  const count = Math.max(0, Math.min(Number(n) || 0, values.length));
  // Partial Fisher-Yates: shuffle only the first `count` slots.
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(Math.random() * (values.length - i));
    const temp = values[i];
    values[i] = values[j];
    values[j] = temp;
  }
  return values.slice(0, count);
}

// Return a new array containing the collection's values in random order.
export function shuffle(coll) {
  const values = map(coll, (value) => value);
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = values[i];
    values[i] = values[j];
    values[j] = temp;
  }
  return values;
}
