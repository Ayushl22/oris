// Read-only checks. Run after a Vercel URL is available; never deploys anything.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2]?.replace(/\/$/, "");
if (!base)
  throw new Error(
    "Usage: npm run verify:deployed -- https://YOUR-PROJECT.vercel.app",
  );
const origin = new URL(base);
assert(
  origin.protocol === "https:" ||
    ["localhost", "127.0.0.1"].includes(origin.hostname),
  "Use HTTPS for public deployments",
);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
async function request(route, expected = 200) {
  const response = await fetch(base + route, {
    signal: AbortSignal.timeout(30000),
    redirect: "follow",
  });
  assert.equal(response.status, expected, `${route}: HTTP ${response.status}`);
  checks.push({
    route,
    status: response.status,
    contentType: response.headers.get("content-type"),
  });
  return response;
}
const html = await (await request("/")).text();
assert(
  html.includes('<div id="root">'),
  "Expected React document, not a login/protection page",
);
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(
  (m) => m[1],
);
assert(assets.length >= 2);
for (const asset of assets) await request(asset);
for (const route of [
  "/?view=accuracy&period=month&cutoff=10:00",
  "/review?view=accuracy&date=2026-01-31&cutoff=10:00",
]) {
  const page = await (await request(route)).text();
  assert(
    page.includes('<div id="root">'),
    `${route}: navigation refresh did not return React document`,
  );
}
const health = await (await request("/api/health")).json();
assert.equal(health.status, "ok");
assert.equal(
  health.snapshotSha256,
  "1a79b61208823de9de417987d7caf563a1791df9faf23b9176341607b7b8650a",
);
const provenance = await (await request("/api/provenance")).json();
assert.deepEqual(provenance.records, { forecasts: 19856, actuals: 1488 });
const month = await (await request("/api/accuracy?cutoff=10:00")).json();
assert.equal(month.summary.matched, 744);
assert.equal(month.summary.expected, 1488);
for (const [metric, expected] of Object.entries({
  maeMW: 1995.5685483870968,
  rmseMW: 2498.8245110107187,
  biasMW: 1727.9825268817203,
}))
  assert(Math.abs(month.summary[metric] - expected) < 0.000001, metric);
const day = await (
  await request("/api/day?decision_date=2026-01-31&cutoff=10:00")
).json();
assert.equal(day.deliveryDate, "2026-02-01");
assert.equal(day.summary.matched, 24);
assert(
  day.intervals.every(
    (r) => !r.publishTime || r.publishTime <= day.decisionTime,
  ),
);
const unknown = await request("/api/not-real", 404);
assert(unknown.headers.get("content-type").includes("application/json"));
await request("/data/snapshot.json.gz", 404);
await request("/assets/not-real.js", 404);
const report = {
  checkedAt: new Date().toISOString(),
  base,
  checks,
  snapshotSha256: health.snapshotSha256,
  summary: month.summary,
  deliveryBoundary: day.deliveryDate,
  scope:
    "Read-only HTTP/static/JSON checks; browser interaction suite is separate",
};
const filename = ["localhost", "127.0.0.1"].includes(origin.hostname)
  ? "vercel-local-http.json"
  : "vercel-public-http.json";
fs.writeFileSync(
  path.join(root, "docs", filename),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
