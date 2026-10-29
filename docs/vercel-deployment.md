# Vercel deployment readiness — updated 29 October 2026

**Primary deployment target:** one personal Vercel Hobby project with a native FastAPI Python function serving the bundled React build and API. **Publicly verified:** [oris-psi-six.vercel.app](https://oris-psi-six.vercel.app), serving fix commit `fdbdbae4408627507eb72d5fa3809e7f055ec260`. All 12 public HTTP checks and all 10 public browser tests passed on 29 October 2026. Source: [Ayushl22/oris](https://github.com/Ayushl22/oris). No paid plan or resource was purchased.

**Earlier 29 October build repair:** the user reported a requirements include parse failure. Root `requirements.txt` is now self-contained, with the same three serverless versions. The backend manifest exists and is not ignored; no packaging exclusions needed changing. Local/Docker manifests remain unchanged. See [the fix verification](verification.md) for the failing/passing regression, 53-test run, pip checks and explicit cloud-verification limits. That build reached Ready and the public API works, but the homepage/assets returned FastAPI 404s. Ready was not evidence of a working frontend.

## Current official documentation inspected first

- [FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi): root ASGI app export, supported build-command override and StaticFiles mounts. Middleware keeps static mounts in the function by default; the documented public/CDN alternative is not used by this app.
- [Python runtime](https://vercel.com/docs/functions/runtimes/python): native ASGI loading; Python 3.12/3.13/3.14; dependency manifests; package exclusions and relative-file handling.
- [Function configuration and routing](https://vercel.com/docs/project-configuration/vercel-json): function key `app.py`, include/exclude files, maximum duration and rewrites.
- [Function limits](https://vercel.com/docs/functions/limitations): 500 MB uncompressed Python bundle; Hobby 2 GB / 1 vCPU; Fluid Compute default/maximum 300 seconds. No Large Functions beta is required.
- [Hobby plan](https://vercel.com/docs/plans/hobby): personal/non-commercial use, 4 active CPU-hours, 360 GB-hours provisioned memory, 1 million invocations and 100 GB transfer. Quota exhaustion can pause the service.
- [Platform limits](https://vercel.com/docs/limits): personal Hobby projects cannot connect organization-owned Git repositories.

No technical blocker identified for this fixed-data personal assignment demonstration. Commercial client hosting would be a Hobby policy blocker. This is not a commercial service launch. No billing-enabled storage/database/API service is used.

## Implementation

| File | Role |
|---|---|
| Root `app.py` | Exports `backend.app.main.app`; no run/start command |
| Root `vercel.json` | Native FastAPI framework, build command, 30s cap, explicit snapshot + frontend/dist inclusion, development-file exclusions; no URL rewrites |
| `.python-version` | Python 3.12 |
| Root `requirements.txt` | Self-contained pinned FastAPI, dotenv and tzdata dependencies; no recursive include, Uvicorn or httpx; versions match the backend serverless manifest |
| `backend/app/snapshot.py` | Standard-library-only file location/hash shared by loader and local maintenance command |
| `backend/app/main.py` | Bundled snapshot forced on Vercel; cold-cache lock; built frontend mounted after API/docs in every environment |
| `backend/app/frontend.py` | Read-only static serving and GET/HEAD extensionless navigation fallback; reserved API/docs/asset misses remain errors |
| `scripts/prepare_vercel.py` | Validates built frontend HTML and referenced JS/CSS before packaging; no public copy, data copy or source symlinks |
| `.vercelignore` | Excludes local environments/build outputs/docs/secrets from upload; retains source, build scripts and real snapshot |
| `functions.app.py.excludeFiles` | Excludes frontend source/tests, node_modules, local environments, public, docs and scripts; retains the explicitly included frontend/dist build |
| Dockerfiles / Compose | Preserved local execution; requirement-file copy updated for the shared serverless requirements include |

The former frontend-only `frontend/vercel.json` was removed. The repository root is the required project root. No separate backend host, cross-origin API URL, reverse proxy container or Vercel Services beta is needed.

`data/snapshot.json.gz` remains the identical 127,972-byte Elexon artifact. It resolves from the bundled Python source location rather than cwd or a workstation absolute path. It is never copied to public/. Cold functions verify/read/decompress it once, including when two requests arrive together; warm requests reuse it. There is no HTTP fetch, write, background job, startup server or refresh endpoint in the serverless request path. Refresh locally with the existing maintenance command and redeploy the artifact.

The native runtime handles ASGI invocation. `scripts/local_vercel.py` is now only a compatibility alias for the actual native ASGI entry. It contains no CDN simulation or rewrite layer. Local Uvicorn does not deploy to Vercel and is excluded from the Python function. Docker/Uvicorn remain valid local assignment execution paths.

## Verified locally and publicly

| Check | Actual result |
|---|---|
| Backend suite | **55 passed** in 13.08s on 29 October, including isolated native frontend serving and missing-build-asset regressions; one third-party Starlette/AnyIO deprecation warning; all existing forecast/alignment/metric tests remain |
| Frontend TypeScript and production Vite build | Passed, including the exact root build command and three-file frontend/dist output; existing 554.17 KB JavaScript chunk warning remains; same UI assets and behavior preserved |
| Browser suite, including same-origin routing/refresh | **10 local tests passed in 24.5s; 10 public tests passed in 42.9s**, one Edge worker, fresh browser contexts; no CDN shim |
| Read-only HTTP verification | **12 checks passed both locally and publicly**; root and direct accuracy-page refresh return HTML, API returns real JSON, data and missing assets remain 404 |
| Official Vercel route compiler | 14 path cases passed with no URL rewrites; original paths reach ASGI, which handles navigation and namespace precedence |
| Official JSON schema | Root config validates; see schema-dialect note below |
| Static asset preparation | Real Vite index/JS/CSS validated and explicitly included in the Python function; backend snapshot not publicly served |
| Arbitrary cwd, no network/no writes | Native entry tests passed; checksum/provenance work with local DATA_PATH pointing to a nonexistent file |
| Cache and concurrency | One load across repeated requests and two simultaneous cold requests; warm cache reused |
| Runtime import surface | No httpx or Uvicorn imported by native ASGI path |
| Local dependency audit | Root verification tooling and frontend report zero known npm vulnerabilities after patching |
| Docker preservation | Compose config parses; prior container verification retained. Fresh engine probe on 28 October returned Docker API500; current Docker image rebuild not claimed |
| Actual Vercel build / public URL | **Verified after fdbdbae** at https://oris-psi-six.vercel.app: HTML and JS/CSS 200, real API data, direct refresh and browser workflows pass |

The former local CDN shim returned files that the deployed ASGI app could not serve, creating false confidence. It has been removed. Local checks now target `app.py:app` directly with `VERCEL=1`, and an isolated-package test copies only backend/data/frontend build files into a temporary directory with no public/ directory. It reproduced the old root JSON404 before the fix and now checks HTML, asset MIME types, deep refresh, HEAD, API/docs precedence, private data paths, missing assets and non-GET behavior. Public HTTP and browser checks are still required after every serving-layer change.

A historical 28 October simultaneous backend/browser run encountered local Windows memory-commit exhaustion: gzip allocation failed in Python, while an Edge context timed out and a Node worker could not commit heap memory. The unchanged snapshot independently decompressed and retained its checksum. The full backend suite then passed alone, followed by the complete browser suite with one worker. No analysis code, data or test assertions were changed to obtain those passes.

### Timing and size preflight

`scripts/benchmark_serverless.py` invokes native ASGI directly in a fresh local Python 3.13 process, with no HTTP server or HTTP client imports. Final local measurement: import **1.41s**, first health/data load **0.14s**, full monthly request **1.43s**, warm health **0.002s**, peak process working set **56.2 MiB**. The monthly response is **20,349 bytes**. These support the 30s/2GB preflight but are not Vercel latency guarantees. `serverless-benchmark.json` records raw values.

The snapshot is 127,972 bytes, and production assets are about 568 KB uncompressed. Python includes the 568,013-byte React build while excluding frontend source/tests, local virtualenv, node_modules, public, docs and scripts from its function. `serverless-package-preflight.json` measures **11,739,653 bytes (11.20 MiB)** for a clean minimal dependency install plus source/data on the local OS; the exact Vercel Linux adapter/package size remains a deployment-build check. The function's 500 MB limit is a hard requirement, not an entitlement to bundle development environments.

### Schema/tooling note

The current official `openapi.vercel.sh/vercel.json` schema declares draft-04 but contains three numeric exclusive minimum bounds using a later dialect in experimental trigger definitions. The verifier translates those exact bounds to their equivalent draft-04 form, then validates the full config; it does not disable config validation. The source schema is retained in `vercel-schema.json`. Vercel's `@vercel/routing-utils` 6.6.0 checks that no URL rewrites obscure native ASGI routes; its older path-to-regexp dependency is overridden with API-compatible 6.3.0 to remove a reported development-tool vulnerability. Neither tool ships in the Python runtime.

## Preserved default results

At 10:00 Europe/London for all January 2026 decisions:

| Measure | Value |
|---|---:|
| Matches / expected half-hours | 744 / 1,488 |
| Coverage | 50% |
| Missing forecast / actual | 744 / 0 |
| MAE | 1,995.5685483870968 MW |
| RMSE | 2,498.8245110107187 MW |
| Bias = forecast − actual | +1,727.9825268817203 MW |

Snapshot SHA-256: `1a79b61208823de9de417987d7caf563a1791df9faf23b9176341607b7b8650a`.

The 31 January decision still targets 1 February, with 48 actuals and 24 matches at the default cutoff. No selection, exact timestamp matching, units, duplicate/missing policy, timezone, January scope, data values or averaging methodology changed. All previous source/averaging limitations and AI-use disclosure remain applicable.

## Reproduce local checks

From the repository root, after the normal Python/frontend dependency setup:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run verify:routing
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe scripts/benchmark_serverless.py
$env:VERCEL='1'
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8013
```

The Uvicorn line starts the actual native ASGI app locally only. In another terminal:

```powershell
npm.cmd run verify:deployed -- http://127.0.0.1:8013
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8013'
$env:VERCEL_ROUTING_CHECK='1'
cd frontend
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd test -- --reporter=line --workers=1
```

## Account handoff and later public verification

The user has signed in and selected [Ayushl22/oris](https://github.com/Ayushl22/oris); source is pushed to `main`. The existing Vercel project at https://oris-psi-six.vercel.app automatically rebuilds pushes to main; keep the personal **Hobby** plan. No payment card or Pro trial is required. Account authorization stays in your own browser; do not send tokens/passwords here. Confirm Root Directory `.` / Framework FastAPI / no Output Directory override / no API-base URL before deploying.

After the free deployment completes, verify its actual public URL using `npm run verify:deployed -- https://...vercel.app` plus the same browser suite with that base URL. Confirm frontend assets, API health/provenance, unchanged checksum/default metrics, 1 February delivery, JSON404 for unknown API paths, hidden dataset path, UI navigation and direct refresh. Inspect Vercel build logs/function size/duration and anonymous/incognito production access. A protected Vercel login page must not be mistaken for the assignment UI.

Remaining assignment actions: unlisted maximum-ten-minute video, anonymous access checks of all final submission URLs, and submission form. The live app URL is verified; public HTTP/fresh browser contexts required no Vercel login. GitHub source publication is complete. No plan purchase or paid resource creation was performed.
