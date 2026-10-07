// Tiny dependency-free JSON-schema-style validator used by HTTP assertions.
// Walks a value against a schema and collects human-readable error strings
// (each prefixed with the failing path) instead of throwing.

import {
  isString,
  isNumber,
  isInteger,
  isBoolean,
  isNull,
  isArray,
  isPlainObject,
} from "./utils/lang.js";
import { describeMatcher as describe } from "./internal.js";

// Map of supported "type" keyword values to their predicate.
const TYPE_CHECKS = {
  string: isString,
  // JSON has no NaN/Infinity, so a "number" must be finite (rejects NaN).
  number: (v) => isNumber(v) && Number.isFinite(v),
  integer: isInteger,
  boolean: isBoolean,
  object: isPlainObject,
  array: isArray,
  null: isNull,
};

// Validate a value against a schema, collecting all errors.
// Returns { valid: boolean, errors: string[] }.
export function validate(value, schema) {
  const errors = [];
  validateNode(value, schema, "data", errors);
  return { valid: errors.length === 0, errors };
}

// Convenience wrapper that returns only whether the value matches the schema.
export function isValid(value, schema) {
  return validate(value, schema).valid;
}

// Recursively validate a single node, pushing errors onto the shared array.
function validateNode(value, schema, path, errors) {
  if (!isPlainObject(schema)) return;

  // nullable allows an explicit null regardless of the declared type.
  if (isNull(value)) {
    if (schema.nullable === true) return;
    if (schema.type === "null") return;
  }

  checkType(value, schema, path, errors);
  checkConst(value, schema, path, errors);
  checkEnum(value, schema, path, errors);
  checkLength(value, schema, path, errors);
  checkRange(value, schema, path, errors);
  checkPattern(value, schema, path, errors);
  checkProperties(value, schema, path, errors);
  checkRequired(value, schema, path, errors);
  checkItems(value, schema, path, errors);
}

// Validate the "type" keyword.
function checkType(value, schema, path, errors) {
  if (schema.type === undefined) return;

  const check = TYPE_CHECKS[schema.type];
  if (!check) {
    errors.push(`${path}: unknown schema type "${schema.type}"`);
    return;
  }

  if (!check(value)) {
    errors.push(`${path}: expected ${schema.type}`);
  }
}

// Validate the "const" keyword (strict deep-ish equality via JSON shape).
function checkConst(value, schema, path, errors) {
  if (!Object.prototype.hasOwnProperty.call(schema, "const")) return;
  if (!sameValue(value, schema.const)) {
    errors.push(`${path}: expected constant ${describe(schema.const)}`);
  }
}

// Validate the "enum" keyword.
function checkEnum(value, schema, path, errors) {
  if (!isArray(schema.enum)) return;
  const found = schema.enum.some((candidate) => sameValue(value, candidate));
  if (!found) {
    errors.push(`${path}: expected one of ${describe(schema.enum)}`);
  }
}

// Validate minLength / maxLength for strings and arrays.
function checkLength(value, schema, path, errors) {
  if (!isString(value) && !isArray(value)) return;

  if (isNumber(schema.minLength) && value.length < schema.minLength) {
    errors.push(`${path}: expected length >= ${schema.minLength}`);
  }
  if (isNumber(schema.maxLength) && value.length > schema.maxLength) {
    errors.push(`${path}: expected length <= ${schema.maxLength}`);
  }
}

// Validate minimum / maximum for numbers.
function checkRange(value, schema, path, errors) {
  if (!isNumber(value)) return;

  if (isNumber(schema.minimum) && value < schema.minimum) {
    errors.push(`${path}: expected >= ${schema.minimum}`);
  }
  if (isNumber(schema.maximum) && value > schema.maximum) {
    errors.push(`${path}: expected <= ${schema.maximum}`);
  }
}

// Validate the "pattern" keyword against strings.
function checkPattern(value, schema, path, errors) {
  if (schema.pattern === undefined) return;
  if (!isString(value)) return;

  let regex;
  try {
    regex = new RegExp(schema.pattern);
  } catch {
    errors.push(`${path}: invalid pattern "${schema.pattern}"`);
    return;
  }

  if (!regex.test(value)) {
    errors.push(`${path}: expected to match /${schema.pattern}/`);
  }
}

// Validate "properties" subschemas for object values.
function checkProperties(value, schema, path, errors) {
  if (!isPlainObject(schema.properties)) return;
  if (!isPlainObject(value)) return;

  for (const key of Object.keys(schema.properties)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    validateNode(value[key], schema.properties[key], `${path}.${key}`, errors);
  }
}

// Validate the "required" keyword (array of keys) for object values.
function checkRequired(value, schema, path, errors) {
  if (!isArray(schema.required)) return;
  if (!isPlainObject(value)) return;

  for (const key of schema.required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push(`${path}.${key}: required`);
    }
  }
}

// Validate the "items" subschema against every element of an array.
function checkItems(value, schema, path, errors) {
  if (schema.items === undefined) return;
  if (!isArray(value)) return;

  for (let i = 0; i < value.length; i += 1) {
    validateNode(value[i], schema.items, `${path}[${i}]`, errors);
  }
}

// Lightweight equality for const/enum comparisons.
// Handles primitives, NaN, and shallow JSON-comparable structures.
function sameValue(a, b) {
  if (a === b) return true;
  if (isNumber(a) && isNumber(b) && Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }
  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => sameValue(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) && sameValue(a[key], b[key])
    );
  }
  return false;
}
