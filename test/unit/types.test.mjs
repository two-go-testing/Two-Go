// Dependency-free consistency check between every src/**/*.js module and its
// hand-written .d.ts declarations. Replaces the old tsc-based typecheck: it
// asserts that each runtime export is declared, that each declared value
// export exists at runtime, and that every public prototype method of an
// exported class (including plugin-installed ones) is declared on that class.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Load the full entry point first so prototype plugins (http-assertions,
// graphql, curl, infer-schema) are installed before classes are inspected.
import "../../src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "src");

// Modules that only patch prototypes or are internal-only have no .d.ts.
const NO_DECLARATIONS = new Set(["graphql.js", "http-assertions.js", "internal.js"]);

function listFiles(dir, ext) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, ext));
    else if (entry.name.endsWith(ext) && !entry.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function rel(file) {
  return relative(SRC, file).split(sep).join("/");
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function declarationPath(jsFile) {
  return jsFile.replace(/\.js$/, ".d.ts");
}

// Collect the exported names of a .d.ts file, following `export * from`.
// `values` holds names that must exist at runtime (functions, consts,
// classes, default); `all` additionally includes types and re-exports.
function declaredExports(dtsFile, seen = new Set()) {
  const result = { all: new Set(), values: new Set() };
  if (seen.has(dtsFile)) return result;
  seen.add(dtsFile);

  const source = stripComments(readFileSync(dtsFile, "utf8"));

  for (const m of source.matchAll(/^export\s+(?:declare\s+)?(function|const|let|var|class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/gm)) {
    result.all.add(m[2]);
    if (!["interface", "type"].includes(m[1])) result.values.add(m[2]);
  }
  if (/^export\s+default\b/m.test(source)) {
    result.all.add("default");
    result.values.add("default");
  }
  for (const m of source.matchAll(/^export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from/gm)) {
    result.all.add(m[1]);
    result.values.add(m[1]);
  }
  for (const m of source.matchAll(/^export\s+(type\s+)?\{([^}]*)\}/gm)) {
    for (const part of m[2].split(",")) {
      const spec = part.trim().replace(/^type\s+/, "");
      if (spec === "") continue;
      const name = spec.split(/\s+as\s+/).pop().trim();
      result.all.add(name);
    }
  }
  for (const m of source.matchAll(/^export\s+\*\s+from\s+["']([^"']+)["']/gm)) {
    const target = join(dirname(dtsFile), m[1]).replace(/\.js$/, ".d.ts");
    assert.ok(existsSync(target), `${rel(dtsFile)} re-exports missing ${m[1]}`);
    const nested = declaredExports(target, seen);
    nested.all.forEach((n) => result.all.add(n));
    nested.values.forEach((n) => result.values.add(n));
  }
  return result;
}

// Public prototype members of a class, including non-enumerable plugin methods.
function prototypeMembers(cls) {
  return Object.getOwnPropertyNames(cls.prototype).filter(
    (name) => name !== "constructor" && !name.startsWith("_")
  );
}

const jsFiles = listFiles(SRC, ".js");

test("every src module ships a .d.ts (except prototype plugins/internal)", () => {
  const missing = jsFiles
    .filter((f) => !NO_DECLARATIONS.has(rel(f)) && !existsSync(declarationPath(f)))
    .map(rel);
  assert.deepEqual(missing, []);
});

test("package.json exports point at existing files", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.dependencies, undefined, "no runtime dependencies");
  assert.equal(pkg.devDependencies, undefined, "no dev dependencies");
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    for (const file of [target.types, target.default]) {
      assert.ok(existsSync(join(ROOT, file)), `${subpath} -> ${file} missing`);
    }
  }
  for (const bin of Object.values(pkg.bin)) {
    assert.ok(existsSync(join(ROOT, bin)), `bin ${bin} missing`);
  }
});

for (const jsFile of jsFiles) {
  const dts = declarationPath(jsFile);
  if (!existsSync(dts)) continue;

  test(`${rel(dts)} matches the runtime exports of ${rel(jsFile)}`, async () => {
    const mod = await import(pathToFileURL(jsFile).href);
    const declared = declaredExports(dts);
    const runtime = Object.keys(mod);

    const undeclared = runtime.filter((name) => !declared.all.has(name));
    assert.deepEqual(undeclared, [], "runtime exports missing from .d.ts");

    const phantom = [...declared.values].filter((name) => !(name in mod));
    assert.deepEqual(phantom, [], ".d.ts declares values that do not exist at runtime");

    const source = stripComments(readFileSync(dts, "utf8"));
    for (const name of runtime) {
      const value = mod[name];
      if (typeof value !== "function" || !/^\s*class\b/.test(Function.prototype.toString.call(value))) {
        continue;
      }
      if (!new RegExp(`export\\s+declare\\s+class\\s+${name}\\b`).test(source)) continue;
      const missing = prototypeMembers(value).filter(
        (member) => !new RegExp(`\\b${member}\\??\\s*[(<:]`).test(source)
      );
      assert.deepEqual(missing, [], `${name} prototype members missing from ${rel(dts)}`);
    }
  });
}
