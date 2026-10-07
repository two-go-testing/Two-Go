// Numeric helpers: clamping, ranges, rounding with precision, and array
// aggregations (sum/mean/min/max with optional iteratees). Zero dependencies.

import { get } from "./object.js";


// Turn a function-or-string into a function. Strings become path accessors.
function toIteratee(iteratee) {
  if (typeof iteratee === "function") return iteratee;
  if (typeof iteratee === "string") return (value) => get(value, iteratee);
  return (value) => value;
}

// Convert a value to a number, returning NaN when it cannot be parsed.
export function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "symbol") return NaN;
  if (value === null) return NaN;
  if (value === undefined) return NaN;
  if (typeof value === "object") {
    const primitive = typeof value.valueOf === "function" ? value.valueOf() : value;
    return Number(typeof primitive === "object" ? String(primitive) : primitive);
  }
  return Number(value);
}

// Convert a value to a finite number, mapping NaN and infinities to safe values.
export function toFinite(value) {
  const n = toNumber(value);
  if (Number.isNaN(n)) return 0;
  if (n === Infinity) return Number.MAX_VALUE;
  if (n === -Infinity) return -Number.MAX_VALUE;
  return n;
}

// Convert a value to a finite, truncated integer.
export function clampToInt(value) {
  const n = toFinite(value);
  return Math.trunc(n);
}

// Clamp a number so it falls within the inclusive [lower, upper] bounds.
export function clamp(n, lower, upper) {
  let low = lower;
  let high = upper;
  if (low > high) {
    const temp = low;
    low = high;
    high = temp;
  }
  if (n < low) return low;
  if (n > high) return high;
  return n;
}

// Check whether a number lies within a range. inRange(n, end) means [0, end);
// inRange(n, start, end) means [start, end). Bounds are normalized if reversed.
export function inRange(n, start, end) {
  let low = start;
  let high = end;
  if (high === undefined) {
    high = low;
    low = 0;
  }
  if (low > high) {
    const temp = low;
    low = high;
    high = temp;
  }
  return n >= low && n < high;
}

// Produce a number within [lower, upper]. With floating=false the bounds are
// inclusive integers; with floating=true a fractional value is returned.
export function random(lower = 0, upper = 1, floating = false) {
  let low = lower;
  let high = upper;
  let useFloat = floating;

  // random(true) -> floating between 0 and 1.
  if (typeof lower === "boolean") {
    useFloat = lower;
    low = 0;
    high = 1;
  } else if (typeof upper === "boolean") {
    useFloat = upper;
    high = 1;
  }

  if (low > high) {
    const temp = low;
    low = high;
    high = temp;
  }

  if (useFloat || low % 1 !== 0 || high % 1 !== 0) {
    return low + Math.random() * (high - low);
  }

  return low + Math.floor(Math.random() * (high - low + 1));
}

// Apply Math[fn] to n at the given decimal precision (scaling by 10**precision).
function adjust(fn, n, precision) {
  const value = toNumber(n);
  if (!precision) return fn(value);
  if (Number.isNaN(value)) return NaN;

  const factor = 10 ** precision;
  return fn(value * factor) / factor;
}

// Round a number to the given decimal precision (default 0).
export function round(n, precision = 0) {
  return adjust(Math.round, n, precision);
}

// Round a number down to the given decimal precision (default 0).
export function floor(n, precision = 0) {
  return adjust(Math.floor, n, precision);
}

// Round a number up to the given decimal precision (default 0).
export function ceil(n, precision = 0) {
  return adjust(Math.ceil, n, precision);
}

// Sum the values of an array. Non-numeric entries contribute NaN.
export function sum(array) {
  return sumBy(array, (value) => value);
}

// Sum an array after mapping each item through the iteratee (function or path).
export function sumBy(array, iteratee) {
  if (!Array.isArray(array) || array.length === 0) return 0;
  const fn = toIteratee(iteratee);
  let total = 0;
  for (const item of array) {
    total += toNumber(fn(item));
  }
  return total;
}

// Arithmetic mean of an array. Returns NaN for an empty array.
export function mean(array) {
  return meanBy(array, (value) => value);
}

// Arithmetic mean after mapping each item through the iteratee.
export function meanBy(array, iteratee) {
  if (!Array.isArray(array) || array.length === 0) return NaN;
  return sumBy(array, iteratee) / array.length;
}

// Smallest value in an array. Returns undefined for an empty array.
export function min(array) {
  return minBy(array, (value) => value);
}

// Item with the smallest mapped value. Returns undefined for an empty array.
export function minBy(array, iteratee) {
  if (!Array.isArray(array) || array.length === 0) return undefined;
  const fn = toIteratee(iteratee);
  let result;
  let lowest;
  for (const item of array) {
    const current = fn(item);
    if (lowest === undefined || current < lowest) {
      lowest = current;
      result = item;
    }
  }
  return result;
}

// Largest value in an array. Returns undefined for an empty array.
export function max(array) {
  return maxBy(array, (value) => value);
}

// Item with the largest mapped value. Returns undefined for an empty array.
export function maxBy(array, iteratee) {
  if (!Array.isArray(array) || array.length === 0) return undefined;
  const fn = toIteratee(iteratee);
  let result;
  let highest;
  for (const item of array) {
    const current = fn(item);
    if (highest === undefined || current > highest) {
      highest = current;
      result = item;
    }
  }
  return result;
}

// Build an ascending or descending array of numbers from a start/end/step.
function buildRange(start, end, step, fromRight) {
  let low = start;
  let high = end;

  if (high === undefined) {
    high = low;
    low = 0;
  }

  let stride = step === undefined ? (high < low ? -1 : 1) : step;
  if (stride === 0) {
    stride = high < low ? -1 : 1;
  }

  const length = Math.max(Math.ceil((high - low) / (stride || 1)), 0);
  const result = new Array(length);

  for (let i = 0; i < length; i += 1) {
    const index = fromRight ? length - 1 - i : i;
    result[index] = low + stride * i;
  }

  return result;
}

// Create an array of numbers progressing from start up to (but not including) end.
// When step is omitted it defaults to 1 ascending, or -1 when end is below start.
export function range(start, end, step) {
  return buildRange(start, end, step, false);
}

// Like range but the populated values are ordered from the end backwards.
export function rangeRight(start, end, step) {
  return buildRange(start, end, step, true);
}
