# Verification results

## GitHub source publication

User-selected public repository: [Ayushl22/oris](https://github.com/Ayushl22/oris), branch `main`. Initial source commit `d333e81d28e44173a17c3aac516d8459b5f3200d` was pushed and its remote SHA matched the local SHA. Unauthenticated public raw-file reads verified the Vercel configuration, ASGI export, AI-use disclosure and 127,972-byte Elexon snapshot with unchanged SHA-256 `1a79b61208823de9de417987d7caf563a1791df9faf23b9176341607b7b8650a`. The staged 80-file source set excluded local dependencies, environments, caches, secrets and generated output; common credential-pattern checks found no matches. Backend tests immediately before publication: **52 passed in 10.31s**, one third-party deprecation warning. No application/data/methodology changes were made for publication. Vercel app deployment remains unperformed.

## Latest: Vercel adaptation, 28 October 2026

Vercel is now the primary same-project deployment method for both React and FastAPI. **52 backend tests passed** after serverless/cwd/offline/read-only/cache/concurrency and build-copy checks. **10 browser tests passed** against the real ASGI app with a local CDN/compiled-routing harness; TypeScript, frontend production build and formatting passed. Root config validates against the current official schema (with three equivalent draft-dialect bound translations), and Vercel's own route compiler passed 14 path cases. No actual Vercel cloud build/deployment or public URL has yet been verified.

Native ASGI import and requests do not import Uvicorn/httpx. The identical bundled snapshot is reused across warm and concurrent requests. Latest local measurements are approximately 1.41s import, 0.14s first load, 1.43s monthly request and 56.2 MiB peak working set; raw results are in `serverless-benchmark.json`. Default results remain **744 matches, MAE 1995.57 MW, RMSE 2498.82 MW, bias +1727.98 MW** (forecast minus actual). The exact data/alignment methodology is unchanged.

Details, sources, Hobby compatibility, packaging limitations and account/public-verification steps are in [vercel-deployment.md](vercel-deployment.md). New evidence: `vercel-routing.json`, `vercel-local-http.json`, `serverless-benchmark.json`, `serverless-package-preflight.json`; public evidence will be written only after a real deployment. The previous Docker results below are historical 27 October verification; the preserved Compose config still parses, but a 28 October engine probe returned API500, so no fresh container rebuild is claimed.

Final isolated backend run: **52 passed in 12.24s**, one third-party deprecation warning. Final single-worker browser run: **10 passed in 27.6s**; TypeScript and formatting passed. An earlier simultaneous rerun failed due to local memory allocation/Edge worker setup exhaustion; successful isolated reruns followed without changing data, analysis code or assertions. See the deployment report for details.

## Previous local/Docker verification, 27 October 2026

Executed and rechecked before deployment on 27 October 2026. These are actual local/container results, not hosted deployment claims. The original Docker engine timeout was superseded by a successful engine check, builds and runtime verification in this review.

| Check | Actual result |
|---|---|
| Official Elexon stream requests | Seven HTTP 200 responses; manifest persisted with exact URLs, times and response hashes |
| Included data | 19,856 WINDFOR rows; 1,488 FUELHH WIND rows; gzip file 127,972 bytes |
| Backend `python -m pytest backend/tests -q` | **46 passed**, latest full run 12.84s; includes six new real-snapshot alignment audits |
| Backend `ruff check backend` | Passed |
| Backend `ruff format --check backend` | Passed, 9 files formatted |
| Frontend `npm run typecheck` | Passed |
| Frontend `npm run format:check` | Passed |
| Frontend `npm run build` | Passed inside the rebuilt Docker image with Vite 7.3.7; JS bundle 554.17 KB / 170.30 KB gzip |
| Browser `PLAYWRIGHT_CHANNEL=msedge PLAYWRIGHT_BASE_URL=http://127.0.0.1:8001 npm test -- --reporter=line` | **7 passed**, full final run 24.1s, directly against the Docker app; Vite dev server not used |
| Automated accessibility | Axe reported zero WCAG A/AA violations on the tested narrow accuracy screen |
| Browser production preview | Desktop forecast, monthly accuracy and 390px mobile accuracy recaptured from Docker port 8001; no page errors, no mobile document overflow |
| Production frontend `/` | HTTP 200 on container-published localhost:8001; browser loaded built assets and API successfully |
| `/api/health` | `status: ok`, identical verified snapshot identity from both container-published ports 8001 and 8002 |
| Month endpoint | 744 valid matches / 1,488 half-hours; 50% coverage, no missing actuals |
| January end boundary | `/api/day?decision_date=2026-01-31&cutoff=10:00` returned delivery `2026-02-01` |
| `docker compose config --quiet` | Passed |
| Static UI contract audit | Passed, zero findings; `premium-audit.json` |
| Frontend dependency audit | Patched Vite to 7.3.7; npm reported zero known vulnerabilities after installation |
| Docker Desktop / engine | Running; `docker info` succeeded, Linux engine version **29.4.2** |
| Root Dockerfile + Compose runtime | **Passed**: image built; `weatherforecast-app-1` running and healthcheck **healthy**, host port **8001** |
| Standalone `backend/Dockerfile` | **Passed**: image `wind-api:verification` built; `wind-window-api-verify` running, host port **8002**, `/docs` and API HTTP checks passed |
| Container-internal checks | Both containers served health, monthly metrics and 1 February boundary through internal HTTP; both run as UID **10001** |
| Container-published HTTP checks | Full app `/`, API-only `/docs`, both `/api/health`, `/api/accuracy` at 10:00 and 00:00, and 31 January `/api/day` passed and matched independent audit |
| Heroku / Vercel deployment | **Not performed**; no account login, hosting app or credentials supplied |
| Public repo, video upload, incognito public URL verification, submission form | **Not performed**; candidate account actions remain |

## Tests and review

The backend tests cover before/at/after cutoff, latest eligible publication separately per interval, explicit timezone-offset alignment, no nearest-time matching, latest-null exclusion, duplicate collapse, tied-conflict exclusion, latest actual revision, WIND filtering, missing/invalid/off-grid values, zero generation, metrics against small hand-calculated test fixtures, January date limits and 1 February delivery, request validation, cache checksums, malformed/empty upstream responses, and atomic preservation of an existing snapshot on failure.

The seven browser tests exercise the real snapshot and date/cutoff changes; daily/monthly navigation and publication/provenance tables; explicit API failure and retry; loading and out-of-order request cancellation; empty data; mobile keyboard/reduced-motion/accessibility; a provenance timeout followed by retry with a different configured default cutoff; and genuinely unpublished late-hour targets at a midnight cutoff. They run against the container's built production UI/API. Browser intercepts/fake numbers are limited to tests. Production runtime has no synthetic fallback.

The six new real-snapshot tests independently enumerate eligible source publications for every delivery target and check the maximum publication separately per target for **all 31 January decisions at five cutoffs** (00:00, 08:00, 10:00, 16:00, 23:59), plus a dedicated 31 January → 1 February audit. They compare forecast values, publication times, actual revisions and signed error with production output. No post-cutoff publication was selected. Existing equality/one-millisecond-after-cutoff and tied/null tests remain in the passing suite.

The first additional audit assumed the same 744 matches at midnight and correctly failed on 682. Inspection of raw records showed the next-day 22:00/23:00 forecasts were not yet published; the expected audit counts were corrected to reflect the source. No selection logic was changed. A new browser regression then reproduced the misleading fixed 50% explanatory note; the note now explains the cadence gap and additional early-cutoff horizon gaps. The production calculation already showed the lower coverage correctly.

A fresh read-only code review found no Critical issues and two Important failure-path issues. Both were first reproduced with failing regression tests, then fixed: corrupt DEFLATE data now becomes an actionable `SnapshotError`/503; provenance timeout now shows an error and prevents analysis with an unverified default, and retry loads the server default. The final backend and browser suites passed after these changes. A minor off-grid diagnostic label was corrected to state its counting scope accurately.

## Observed results at default 10:00 Europe/London

| Measure | Result |
|---|---:|
| MAE | 1,995.5685 MW |
| RMSE | 2,498.8245 MW |
| Signed bias, forecast minus actual | +1,727.9825 MW |
| Valid matched pairs | 744 |
| Expected half-hours | 1,488 |
| Missing forecast half-hours | 744 |
| Missing actual half-hours | 0 |
| Invalid forecast / actual | 0 / 0 |
| Conflicting forecast / actual | 0 / 0 |

All retrieved WINDFOR delivery timestamps fall on the hour. The app leaves the intervening half-hours missing. These metrics describe timestamp-aligned operational MW values; see the documented scope/averaging limitations. Procurement quantities cannot be inferred without demand and portfolio information.

**Method decision:** Keep exact timestamp matching. Elexon's portal describes specific-time forecast MW and its wind page documents hourly forecasts; the API does not define a following-hour average. No official justification was found to average actuals at `t` and `t+30min`. FUELHH is explicitly a half-hour mean, so these remain indicative timestamp-matched errors rather than certified instantaneous or hourly-average accuracy. Full rationale and official source links: `alignment-review.md`; freshly saved API contract: `elexon-alignment-openapi.json`.

At default 10:00, all **744 / 744 hourly targets** are represented; the 744 missing half-hour slots are all `:30` values. At **00:00**, only **682** hourly targets have forecasts, giving **45.83%** half-hour-grid coverage, **806** missing half-hour forecasts and **zero** missing actuals. The extra 62 missing values are the late 22:00/23:00 targets across 31 delivery days. Midnight metrics, from valid matches only, are MAE **2,108.7419 MW**, RMSE **2,589.3063 MW**, bias **+1,795.4897 MW**. Other audited cutoffs are recorded in `alignment-audit.json`.

For the 31 January 10:00 decision, the API returns delivery 1 February from **00:00Z through 23:30Z**, with **48 actuals, 24 forecasts and 24 matches**. All selected publications are **31 January 09:30Z** in this snapshot, before the 10:00 cutoff. Both running container APIs reproduce this boundary and the pooled metrics above.

Snapshot SHA-256: `1a79b61208823de9de417987d7caf563a1791df9faf23b9176341607b7b8650a`.

## Warnings and environment limitations

- Backend tests emit one third-party Starlette/AnyIO `BlockingPortal` deprecation warning; tests still pass. It is not suppressed.
- Vite reports a bundle-size advisory above 500 KB. This small pilot retains one bundle rather than adding code-splitting machinery; the production build exits successfully.
- Browser test tooling emits a `NO_COLOR` / `FORCE_COLOR` environment warning. No browser page errors were observed in the production preview.
- The restricted Windows test process could not create pytest temporary directories. Tests were rerun with the required execution permission and passed; no application logic was changed to accommodate the harness.
- No claim is made of manual screen-reader certification, full cross-browser/mobile-device certification, complete upstream historical retention, exact source metering/averaging reconciliation or public deployment. Docker runtime and the stated container checks have now been verified.

## Evidence files

- `runtime-smoke.json`: real HTTP summary, health checksum and February boundary.
- `premium-audit.json`: strict static UI audit.
- `forecast.png`, `accuracy.png`, `mobile.png`: production previews refreshed from Docker.
- `alignment-review.md`, `alignment-audit.json`, `elexon-alignment-openapi.json`: source-backed method decision, fresh metrics/per-day publications/cutoff sensitivity and API contract.
- `docker-info.json`, `container-verification.json`: minimal engine metadata, running image IDs, health status and successful HTTP results for both containers.
- Snapshot manifest and `elexon-openapi-extract.json`: official data requests and API contract evidence.

## Remaining account actions

On 27 October, Docker runtime verification completed with the full app on localhost:8001 and API-only container on localhost:8002. No other existing Docker workloads were stopped or removed. The former Heroku/separate-frontend deployment recommendation is superseded by the same-project Vercel instructions above. Remaining submission actions are the public anonymous-name GitHub repo, unlisted maximum-ten-minute demo, incognito URL checks and submission form. No Elexon credential is needed.

The published WINDFOR material does not certify an exact temporal averaging kernel. Obtain provider clarification before advertising the metrics as identical-interval or instantaneous accuracy, or changing to hourly-average scoring. This limitation is disclosed in the UI, README and alignment review; no clarification message has been sent externally.
