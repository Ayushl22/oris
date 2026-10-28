// Configuration/routing verification using Vercel's own route compiler.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv-draft-04";
import addFormats from "ajv-formats";
import { getTransformedRoutes } from "@vercel/routing-utils";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  fs.readFileSync(path.join(root, "vercel.json"), "utf8"),
);
const schemaPath = path.join(root, "docs", "vercel-schema.json");
const schema = JSON.parse(
  fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, ""),
);
// The current official schema declares draft-04 but contains numeric exclusive
// bounds (draft-06+) in experimental trigger definitions. Translate those exact
// bounds to their equivalent draft-04 form; do not disable config validation.
let normalizedBounds = 0;
function normalizeBounds(value) {
  if (!value || typeof value !== "object") return;
  for (const [exclusive, inclusive] of [
    ["exclusiveMinimum", "minimum"],
    ["exclusiveMaximum", "maximum"],
  ]) {
    if (typeof value[exclusive] === "number") {
      assert.equal(
        value[inclusive],
        undefined,
        "Inspect the upstream schema bound before translating",
      );
      value[inclusive] = value[exclusive];
      value[exclusive] = true;
      normalizedBounds++;
    }
  }
  for (const child of Object.values(value)) normalizeBounds(child);
}
normalizeBounds(schema);
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
addFormats(ajv);
const validate = ajv.compile(schema);
assert(validate(config), JSON.stringify(validate.errors, null, 2));
const compiled = getTransformedRoutes(config);
assert.equal(compiled.error, null, JSON.stringify(compiled.error));
const rewrites = compiled.routes.filter((route) => route.src && route.dest);
const cases = [
  ["/", "/index.html"],
  ["/?view=accuracy", "/index.html"],
  ["/review?view=accuracy&date=2026-01-31", "/index.html"],
  ["/api/day?decision_date=2026-01-31&cutoff=10:00", null],
  ["/api/accuracy?cutoff=10:00", null],
  ["/api/provenance", null],
  ["/api/health", null],
  ["/api/not-real", null],
  ["/api", null],
  ["/docs", null],
  ["/redoc", null],
  ["/openapi.json", null],
  ["/assets/missing.js", null],
  ["/data/snapshot.json.gz", null],
];
for (const [url, expected] of cases) {
  const pathname = new URL(url, "http://local.test").pathname;
  const actual =
    rewrites.find((route) => new RegExp(route.src).test(pathname))?.dest ||
    null;
  assert.equal(actual, expected, `Wrong rewrite for ${url}`);
}
const publicDir = path.join(root, "public");
assert(
  fs.existsSync(path.join(publicDir, "index.html")),
  "Build and prepare public/ first",
);
const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(
  (m) => m[1],
);
assert(assets.length >= 2);
for (const asset of assets)
  assert(fs.existsSync(path.join(publicDir, asset)), `Missing ${asset}`);
assert(
  !fs.existsSync(path.join(publicDir, "data")),
  "Backend data must not be in CDN output",
);
assert.equal(config.functions["app.py"].includeFiles, "data/snapshot.json.gz");
assert(fs.existsSync(path.join(root, config.functions["app.py"].includeFiles)));
assert(config.functions["app.py"].maxDuration <= 300);
const output = {
  checkedAt: new Date().toISOString(),
  schemaSource: "https://openapi.vercel.sh/vercel.json",
  schemaDialectBoundsTranslated: normalizedBounds,
  framework: config.framework,
  routes: compiled.routes,
  routeCases: cases.length,
  assetFiles: assets,
  bundledDatasetBytes: fs.statSync(path.join(root, "data/snapshot.json.gz"))
    .size,
};
fs.writeFileSync(
  path.join(root, "docs/vercel-routing.json"),
  JSON.stringify(output, null, 2),
);
console.log(JSON.stringify(output, null, 2));
