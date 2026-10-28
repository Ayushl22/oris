# Vercel deployment readiness — 28 October 2026

**Primary deployment target:** one personal Vercel Hobby project containing the React CDN assets and one native FastAPI Python function. **Status:** implementation/local verification complete; actual Vercel build, public deployment and anonymous access verification are pending account login and an actual deployment URL. No Vercel project, paid resource, trial or plan purchase has been created by this work.

## Current official documentation inspected first

- [FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi): root `app.py` exporting an `app` ASGI object; supported build-command override; generated root `public/` files served by the CDN without mounting public in FastAPI.
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
| Root `vercel.json` | Native FastAPI framework, build command, 30s function cap, snapshot inclusion, development-file exclusions, frontend navigation fallback |
| `.python-version` | Python 3.12 |
| Root `requirements.txt` → `backend/requirements-serverless.txt` | FastAPI, dotenv, tzdata only; neither Uvicorn nor httpx installed for this function |
| `backend/app/snapshot.py` | Standard-library-only file location/hash shared by loader and local maintenance command |
| `backend/app/main.py` | Bundled file forced on Vercel; local dotenv/static mount omitted there; process cache with cold-initialization lock |
| `scripts/prepare_vercel.py` | Build-only copy of the unchanged Vite output to root public; no data copy or source symlinks |
| `.vercelignore` | Excludes local environments/build outputs/docs/secrets from upload; retains source, build scripts and real snapshot |
| `functions.app.py.excludeFiles` | Excludes frontend/public/development files from Python function, independently of CDN build output |
| Dockerfiles / Compose | Preserved local execution; requirement-file copy updated for the shared serverless requirements include |

The former frontend-only `frontend/vercel.json` was removed. The repository root is the required project root. No separate backend host, cross-origin API URL, reverse proxy container or Vercel Services beta is needed.

`data/snapshot.json.gz` remains the identical 127,972-byte Elexon artifact. It resolves from the bundled Python source location rather than cwd or a workstation absolute path. It is never copied to public/. Cold functions verify/read/decompress it once, including when two requests arrive together; warm requests reuse it. There is no HTTP fetch, write, background job, startup server or refresh endpoint in the serverless request path. Refresh locally with the existing maintenance command and redeploy the artifact.

The native runtime handles ASGI invocation. `scripts/local_vercel.py` is a **local test harness**, not a production start command. Its Uvicorn use does not deploy to Vercel and is excluded from the Python function. Docker/Uvicorn remain valid local assignment execution paths.

## Verified locally

| Check | Actual result |
|---|---|
| Backend suite | **52 passed** in 12.24s after the concurrent-cache regression fix; one third-party Starlette/AnyIO deprecation warning; all existing forecast/alignment/metric tests remain |
| Frontend TypeScript and production Vite build | Passed, including the exact root build command and three-file public output; existing 554.17 KB JavaScript chunk warning remains; same UI assets and behavior preserved |
| Browser suite, including same-origin routing/refresh | **10 passed** in 27.6s with one worker against real ASGI plus the local CDN/rewrite harness |
| Read-only HTTP verification | 12 routes/assets checked successfully; root and direct accuracy-page refresh return HTML, API returns real JSON, data and missing assets remain 404 |
| Official Vercel route compiler | 14 path cases passed; preserves `/api`, `/docs`, `/redoc`, `/openapi.json` and assets; generates frontend fallback |
| Official JSON schema | Root config validates; see schema-dialect note below |
| Static asset preparation | Real Vite index/JS/CSS copied; backend snapshot not publicly served |
| Arbitrary cwd, no network/no writes | Native entry tests passed; checksum/provenance work with local DATA_PATH pointing to a nonexistent file |
| Cache and concurrency | One load across repeated requests and two simultaneous cold requests; warm cache reused |
| Runtime import surface | No httpx or Uvicorn imported by native ASGI path |
| Local dependency audit | Root verification tooling and frontend report zero known npm vulnerabilities after patching |
| Docker preservation | Compose config parses; prior container verification retained. Fresh engine probe on 28 October returned Docker API500; current Docker image rebuild not claimed |
| Actual Vercel build / public URL | **Not yet performed**; needs personal account login/project settings and deployment |

The local harness combines real public files, the actual ASGI app and the regex produced by Vercel's compiler. It does **not** reproduce Vercel's builder, routing infrastructure, generated function bundle, server lifetime or cloud performance. Its passing tests are not a claim of successful Vercel deployment.

A final simultaneous backend/browser run encountered local Windows memory-commit exhaustion: gzip allocation failed in Python, while an Edge context timed out and a Node worker could not commit heap memory. The unchanged snapshot independently decompressed and retained its checksum. The full backend suite then passed alone, followed by the complete browser suite with one worker. No analysis code, data or test assertions were changed to obtain those passes.

### Timing and size preflight

`scripts/benchmark_serverless.py` invokes native ASGI directly in a fresh local Python 3.13 process, with no HTTP server or HTTP client imports. Final local measurement: import **1.41s**, first health/data load **0.14s**, full monthly request **1.43s**, warm health **0.002s**, peak process working set **56.2 MiB**. The monthly response is **20,349 bytes**. These support the 30s/2GB preflight but are not Vercel latency guarantees. `serverless-benchmark.json` records raw values.

The snapshot is 127,972 bytes, and production assets are about 568 KB uncompressed. Python excludes the entire frontend, local virtualenv, node_modules, public assets, tests, docs and scripts from its function. `serverless-package-preflight.json` measures **11,170,572 bytes (10.65 MiB)** for a clean minimal dependency install plus source/data on the local OS; the exact Vercel Linux adapter/package size remains a deployment-build check. The function's 500 MB limit is a hard requirement, not an entitlement to bundle development environments.

### Schema/tooling note

The current official `openapi.vercel.sh/vercel.json` schema declares draft-04 but contains three numeric exclusive minimum bounds using a later dialect in experimental trigger definitions. The verifier translates those exact bounds to their equivalent draft-04 form, then validates the full config; it does not disable config validation. The source schema is retained in `vercel-schema.json`. Vercel's `@vercel/routing-utils` 6.6.0 compiles the actual rewrites; its older path-to-regexp dependency is overridden with API-compatible 6.3.0 to remove a reported development-tool vulnerability. Neither tool ships in the Python runtime.

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
.\.venv\Scripts\python.exe -m uvicorn scripts.local_vercel:app --host 127.0.0.1 --port 8003
```

The Uvicorn line starts the test harness only. In another terminal:

```powershell
npm.cmd run verify:deployed -- http://127.0.0.1:8003
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8003'
$env:VERCEL_ROUTING_CHECK='1'
cd frontend
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd test -- --reporter=line --workers=1
```

## Account handoff and later public verification

First action only: sign in to **your personal Vercel account**, keeping the **Hobby** plan. No payment card or Pro trial is required. Account authorization stays in your own browser; do not send tokens/passwords here. After confirmation, choose a Git import from a personal repo or CLI upload and confirm Root Directory `.` / Framework FastAPI / no Output Directory override / no API-base URL before deploying.

After the free deployment completes, verify its actual public URL using `npm run verify:deployed -- https://...vercel.app` plus the same browser suite with that base URL. Confirm frontend assets, API health/provenance, unchanged checksum/default metrics, 1 February delivery, JSON404 for unknown API paths, hidden dataset path, UI navigation and direct refresh. Inspect Vercel build logs/function size/duration and anonymous/incognito production access. A protected Vercel login page must not be mistaken for the assignment UI.

Remaining assignment actions: live URL, public anonymous-name GitHub repo, unlisted maximum-ten-minute video, incognito URL checks and submission form. No plan purchase, paid resource creation or external publication was performed in this implementation turn.
