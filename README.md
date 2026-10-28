# Wind window

A compact day-ahead wind forecast pilot for **purchase decisions made 1–31 January 2026**, with delivery on **2 January–1 February 2026**. React + TypeScript frontend, Python FastAPI backend, Docker and Docker Compose. Uses only Elexon **WINDFOR** and **FUELHH filtered to WIND**.

The app reconstructs what was published at a selected decision time, then measures timestamp-aligned forecast error. There is no authentication, demand feed, trading execution or purchase quantity calculation.

**Primary deployment: one Vercel project for both React and FastAPI**, using Vercel's native Python ASGI runtime and CDN assets. The real Elexon snapshot is bundled with the function. No always-running server, Docker service, database, background job or writable persistent storage is needed in Vercel production. **Public deployment is pending your Vercel login/account step; no public URL has been verified.** Dockerfiles and Compose remain for local execution. See [Vercel verification](docs/vercel-deployment.md), [verification history](docs/verification.md) and the [requirements checklist](docs/requirements-checklist.md).

## Run locally

Prerequisites: Python 3.12 or 3.13, Node.js 22.12+ or 24, npm. Vercel targets Python **3.12** via `.python-version`; root Node engine range supports 22.12–24. The real historical snapshot is included; **no Elexon key or initial download is required**.

PowerShell, from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite development proxy forwards `/api` to FastAPI. API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Health: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health).

On macOS/Linux replace `.\.venv\Scripts\python.exe` with `.venv/bin/python`, `Copy-Item .env.example .env` with `cp .env.example .env`, and `npm.cmd` with `npm`. Create the environment with `python3 -m venv .venv` if required.

### Local one-server production preview

```powershell
cd frontend
npm.cmd ci
npm.cmd run build
cd ..
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Start/restart FastAPI **after** the frontend build so it mounts `frontend/dist`. No Node server is required at runtime.

Uvicorn in this command and Docker is a **local execution option**. Vercel imports `app.py:app` directly; it does not run this command or the Dockerfile.

### Docker Compose

Start Docker Desktop in Linux-container mode first:

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
curl.exe --fail http://localhost:8000/api/health
```

Open [http://localhost:8000](http://localhost:8000). Stop with `docker compose down`. One multi-stage container serves the React bundle and API together, reducing deployment plumbing for a 16-hour assignment. Runtime uses a non-root user and the baked-in snapshot; no writable database or external service is needed. For an API-only image: `docker build -f backend/Dockerfile -t wind-api .` from the root.

If port 8000 is already used, set `$env:APP_PORT='8001'` before the Compose commands; then open `http://localhost:8001`. The verification run used 8001 for Compose and 8002 for the optional API-only container, leaving the earlier local preview untouched. To reproduce both verified options:

```powershell
$env:APP_PORT='8001'
docker compose up --build -d
docker compose ps
docker compose exec -T app python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/health').read().decode())"
docker build -f backend/Dockerfile -t wind-api:verification .
docker run -d --name wind-window-api-verify -p 8002:8000 wind-api:verification
curl.exe --fail http://localhost:8001/api/health
curl.exe --fail http://localhost:8002/api/health
```

Run the named standalone container only if it does not already exist. Stop/remove that verification container with `docker stop wind-window-api-verify` and `docker rm wind-window-api-verify`. These commands do not affect other Docker workloads.

## How to use

1. Choose a January decision date and a cutoff, then **Apply settings**. The delivery day is always the following London calendar day.
2. **Decision forecast** shows MW forecast points, the peak/low of available points, and publication information. Expand the 48-row interval table to inspect every selected forecast and its publication time.
3. **Forecast accuracy** compares the selected decision-time forecast with WIND actuals. Select **All January decisions** for pooled metrics and daily error bars. The selected-day interval table and decision strip remain explicitly labelled as that day.
4. Review coverage, invalid/conflicting/missing counts, procurement context, and provenance. Applied settings are in the URL for sharing/reloading.

The chart plots forecast dots only where real records exist; it does not draw invented half-hour values. Actuals appear as a dashed line. Tables provide values without requiring chart hover.

## Official API verification and data methodology

Documentation and actual response fields were checked **before implementation** against Elexon's live OpenAPI document and successful January requests. The relevant definitions and retrieval time are saved in [docs/elexon-openapi-extract.json](docs/elexon-openapi-extract.json). Details and caveats are in [docs/data-methodology.md](docs/data-methodology.md).

Official sources:

- [Elexon OpenAPI specification](https://data.elexon.co.uk/swagger/v1/swagger.json)
- [FUELHH stream documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)
- [WINDFOR stream documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)
- [Wind forecast scope](https://bmrs.elexon.co.uk/api-documentation/endpoint/forecast/generation/wind/latest)
- [Elexon developer portal](https://developer.data.elexon.co.uk/)
- [Elexon wind generation explanation](https://bmrs.elexon.co.uk/wind-generation)
- [Elexon interface definitions](https://bscdocs.elexon.co.uk/bsc-module/interface-definition-documents/neta-interface-definition-and-design-document-part-1-interfaces-with-bsc-parties-and-their-agents)

### Queries and fields

Base: `https://data.elexon.co.uk/bmrs/api/v1`.

| Dataset | Endpoint and query | Fields used |
|---|---|---|
| Forecast | `/datasets/WINDFOR/stream?publishDateTimeFrom=…&publishDateTimeTo=…` | `dataset`, `startTime`, `publishTime`, nullable `generation` |
| Actual | `/datasets/FUELHH/stream?settlementDateFrom=2026-01-02&settlementDateTo=2026-02-01&fuelType=WIND` | same fields plus `fuelType`; settlement date/period preserved |

Stream responses are JSON arrays, not a `{data: …}` envelope. WINDFOR has publication filters; no invented delivery-date or fuel filters are sent. FUELHH's settlement filters cannot be combined with publication filters. We also enforce `fuelType == WIND` locally. Never use the forecast endpoint's unfiltered/latest response to backtest decisions.

`startTime` identifies delivery start; `publishTime` identifies publication, not delivery or retrieval. Z timestamps are UTC. Timezone-aware ISO offsets normalize to UTC; naive timestamps are rejected. UI date/time controls mean **Europe/London**, not the viewer's machine timezone. January and 1 February 2026 are GMT (UTC+00:00), so all delivery days here have 48 half-hours. No DST transition falls in scope.

The brief leaves cutoff unspecified. **10:00 Europe/London is an analyst assumption, not a claimed market gate closure.** Change it in the UI or set `DEFAULT_CUTOFF=HH:MM` in `.env`/hosting environment. The backend validates it; the frontend retrieves the default from `/api/provenance`. You can compare cutoffs, but selecting a cutoff after examining outcomes is hindsight and should not be presented as an independently validated trading strategy.

### Selection and matching

- Retrieve publication history from **29 December 2025 through 1 February 2026 00:00Z**, in six bounded windows. The earlier days support decisions at the start of January. Adjacent API boundaries may overlap; no undocumented inclusive/exclusive assumption is needed because local filters and duplicate handling govern selection.
- For each next-day half-hour, keep only forecasts with `publishTime <= decision timestamp`, then take the maximum publication time **separately per startTime**. A forecast exactly at cutoff is eligible; one millisecond later is not.
- A newer eligible null/invalid record does **not** fall back to an older valid publication. Equal normalized `(startTime, publishTime, generation)` rows collapse. Different values tied at the latest eligible publication are conflicting, unavailable and excluded.
- Actuals use the latest available publication/revision per exact `startTime` in the retrieved snapshot. They are retrospective outcomes and do not use the decision cutoff. Tied conflicting actuals are excluded by the same policy.
- Join on normalized **exact delivery `startTime`**, never nearest time, row order, publication time or settlement period alone. No averaging, resampling, forward fill, interpolation, or zero fill. Off-grid records are counted in diagnostics.
- Missing forecast and missing actual counts refer to absent eligible records. Invalid values and conflicts are separate counts. A half-hour can miss both, so these counts overlap; `unmatched = expected - valid pairs` counts each unmatched interval once.

### Units, generation scope and availability

FUELHH is half-hour mean **MW**, not MWh. WINDFOR is forecast generation **MW** for wind farms visible to the system operator with operational metering. FUELHH WIND concerns operationally metered wind too. This supports the challenge's timestamp-aligned operational forecast/outturn comparison, without including embedded wind estimates or other generation types.

**Alignment review: retain timestamp-only comparison.** Elexon's developer portal describes forecast MW for a specific point in time, and its wind generation page documents hourly forecasts. The API's WINDFOR row has no duration/end-time or averaging-method field. Hourly timestamp spacing does not establish a mean over the following hour, so there is no documented basis for averaging the actuals at `t` and `t+30min`. The [pre-deployment alignment review](docs/alignment-review.md) sets out the official evidence, including historical NESO interface documentation, and the decision.

We treat WINDFOR as a **point-indexed/time-targeted MW value**, without claiming its physical averaging kernel is certified instantaneous. FUELHH is explicitly a half-hour mean. These are therefore **indicative timestamp-matched forecast-versus-half-hour-outturn errors**, not verified hourly-average or like-for-like instantaneous errors. Identical temporal averaging conventions remain unconfirmed by the published definitions. We do not aggregate actuals, interpolate or forward-fill forecasts to hide that limitation.

**Observed January availability differs from the brief's implied resolution:** every one of the **19,856 retrieved WINDFOR rows** has an hourly `startTime`; FUELHH supplies all **1,488 half-hour actuals** for the delivery scope. At the default cutoff, every day has 24 eligible forecast timestamps and 24 matched actuals. Therefore there are **744 valid pairs / 1,488 expected half-hours = 50% coverage**. Forecast coverage is not made artificially complete. No claim is made about the provider's full historical retention policy; these dates were successfully retrieved and are persisted.

At 10:00 there are **zero absent hourly targets out of 744**; the 744 missing half-hours are all `:30` timestamps. This 100% hourly-target representation is a separate cadence diagnostic, not 100% coverage of half-hour intervals or energy. Coverage also depends on cutoff: at **00:00**, the next-day `22:00` and `23:00` targets are not yet available, giving **682 / 1,488 = 45.83%** half-hour-grid coverage, **806 missing forecasts** (744 `:30` slots plus 62 late hourly targets), and no missing actuals. Independent real-snapshot tests verify each January decision at 00:00, 08:00, 10:00, 16:00 and 23:59 and explicitly check 1 February delivery.

### Metrics and interpretation

For valid matched records only, define `eᵢ = forecastᵢ − actualᵢ`:

- **MAE** = `sum(abs(eᵢ)) / N` MW: typical absolute error.
- **RMSE** = `sqrt(sum(eᵢ²) / N)` MW: increases more with large misses.
- **Signed bias** = `sum(eᵢ) / N` MW: positive = wind **overforecast**, negative = wind **underforecast**.
- **Coverage** = `N / expected half-hours × 100%`. Empty metrics are `null` and displayed as `—`, never zero.

Monthly metrics pool the individual matched errors; they are not averages of daily MAE/RMSE. At default 10:00: MAE **1,995.57 MW**, RMSE **2,498.82 MW**, bias **+1,727.98 MW**, based on 744 pairs. These are descriptive for this snapshot and cutoff.

These values were freshly recalculated during the alignment review and verified again through both Docker APIs. They are unchanged because the official evidence did not justify changing alignment. `docs/alignment-audit.json` records the recalculation, per-day selected publication bounds, zero post-cutoff publications and five-cutoff sensitivity results.

With fixed demand, overestimating wind could understate additional procurement needs; underestimating wind could overstate them. Larger RMSE suggests exposure to larger misses. Sparse coverage limits interpretation, and national wind generation is not the client's contracted supply. No purchase amount, reserve recommendation, cost saving or demand shortfall is calculated without demand and portfolio data.

## Snapshot, provenance and refresh

`data/snapshot.json.gz` contains the real records unchanged in value plus a manifest: exact request URLs, UTC retrieval timestamps, row counts, raw HTTP-response SHA-256 hashes and canonical record-array hashes. The API verifies the array hashes/counts when loading and exposes the file SHA-256. `complete` means all required retrieval requests completed successfully; it does **not** mean interval coverage is 100%.

Retrieved **27 October 2026 at 15:30 UTC (21:00 Asia/Calcutta)**. The snapshot is about 128 KB compressed. It is loaded once per process, so the application works without Elexon network access at runtime. A missing/corrupt file produces an explicit 503 and corrective instruction. There is no synthetic fallback.

To refresh real data, with network access:

```powershell
cd backend
..\.venv\Scripts\python.exe -m app.ingest
```

On macOS/Linux: `../.venv/bin/python -m app.ingest`. Optional `--output /path/snapshot.json.gz` changes the output. Only transient upstream statuses/network failures receive two bounded retries. HTTP errors, malformed/empty responses and unexpected datasets fail the refresh. The complete replacement is written atomically only after all requests succeed; a failure preserves the old snapshot. Restart the API after refresh. For hosted demos, rebuild/redeploy with the refreshed snapshot; do not rely on Heroku's ephemeral writable filesystem to retain refreshes.

## Tests and checks

From the root:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check backend
.\.venv\Scripts\python.exe -m ruff format --check backend
cd frontend
npm.cmd ci
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd test
```

Keep FastAPI running on port 8000 for browser tests. Playwright starts Vite automatically. If Microsoft Edge is already installed on Windows, skip downloading Chromium and use `$env:PLAYWRIGHT_CHANNEL='msedge'` before `npm.cmd test`. The suites cover selection before/at/after cutoff, latest per interval, equivalent offset timestamps, exact alignment, missing/invalid/duplicate/conflicting data, latest actual revisions, hand-calculated metrics, January boundaries, API validation and missing-cache errors, atomic refresh failure, real-data browser flows, empty/error/loading/retry, stale requests, mobile layout, keyboard and automated accessibility.

To exercise the built Docker frontend/API instead of Vite, set `$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8001'` before `npm.cmd test`. When this variable is set, Playwright does not start a development server. Remove the variable to resume normal Vite tests. The suite also checks the genuinely unpublished late-hour targets at a midnight cutoff.

Handwritten numbers and intercepted responses appear **only in tests** to exercise logic and error states. Production data always comes from Elexon. [Actual verification results](docs/verification.md) distinguish checks run from those still unavailable.

## Deployment

### Vercel — primary, React and FastAPI together

Use the **repository root** as the Vercel Root Directory, not `frontend`. The root `vercel.json` selects the **FastAPI** framework preset. The root `app.py` exports the existing FastAPI ASGI app; Vercel manages function invocation without a Uvicorn start process. This follows the current [FastAPI deployment guide](https://vercel.com/docs/frameworks/backend/fastapi) and [Python runtime documentation](https://vercel.com/docs/functions/runtimes/python).

The configured Build Command installs/builds the existing Vite app and copies only its generated web assets into Vercel's documented root `public/` CDN directory:

```text
npm ci --prefix frontend && npm run build --prefix frontend && python scripts/prepare_vercel.py
```

`public/` is generated, Git-ignored and uploaded as build output, not committed source. Do not mount it in FastAPI: Vercel serves it. `/api/day`, `/api/accuracy`, `/api/provenance`, `/api/health`, `/docs` and `/openapi.json` reach the Python app under the same origin. Root/query URLs and extensionless frontend navigation use `index.html` fallback. Missing assets/data do not return the SPA page; unknown API paths remain JSON 404. No API prefix is stripped or rewritten to another host.

**Vercel project settings:**

- Personal **Hobby** scope for this non-commercial assignment demo; do not select a Pro trial, purchase a plan, add paid services or use a commercial client deployment under Hobby.
- Root Directory: repository root (`.`); Framework Preset: **FastAPI**. Keep Install Command and Output Directory at the framework defaults. Do **not** override Output Directory to `frontend/dist` or `public`.
- Build Command: use the root config above. Python: 3.12 via `.python-version`; a compatible Node 22/24 runtime handles the Vite build.
- Optional environment variable: `DEFAULT_CUTOFF=10:00`. Leave `DATA_PATH` and `VITE_API_BASE_URL` **unset**. `VERCEL` is set by the platform automatically; it is not a secret or a manual setting.
- No Heroku account, payment card, Elexon key, external API origin, database or storage add-on is required. The former `frontend/vercel.json` was removed to prevent accidental frontend-only deployment.

#### Bundled data and Hobby limits

The 127,972-byte `data/snapshot.json.gz` is explicitly included in the Python function. It is **not** in `public/`. The function resolves its location from its bundled source file, not a workstation path or cwd, verifies checksums/counts and caches it once per warm instance. Cold instances reread the bundled file. There are no runtime Elexon downloads, background refreshes or persisted writes. Updating data is a local maintenance operation followed by redeployment. The runtime requirements exclude Uvicorn and httpx; local requirements retain them for Docker/refresh commands.

Current official limits were checked on 28 October 2026: Python's standard uncompressed function bundle limit is **500 MB**, Hobby memory is **2 GB / 1 vCPU**, and with Fluid Compute enabled the Hobby duration maximum is **300 seconds**. The config sets **30 seconds**. The snapshot is about 125 KiB, the monthly JSON response about 20 KiB, and measured local memory/time are comfortably below these ceilings. Actual Vercel bundle size, cold starts and build results must still be confirmed after login/deployment; local measurements are not a cloud guarantee. [Function limits](https://vercel.com/docs/functions/limitations).

Hobby is free for **personal, non-commercial** use. Current included quotas include 4 active CPU-hours, 360 GB-hours of provisioned memory, 1 million function invocations and 100 GB transfer. Exceeding Hobby quotas can pause service; this is a small assignment demo, not a capacity guarantee. Commercial use is a plan-policy blocker for Hobby, even if the technical workload fits. Use a personal repository/scope; Hobby does not support linking organization-owned Git repositories. No technical limit identified prevents this bounded personal demo from running. No paid resource or plan has been created. [Hobby plan](https://vercel.com/docs/plans/hobby), [platform limits](https://vercel.com/docs/limits).

#### Account steps and deployment verification

We will proceed **one step at a time**. First sign in to [Vercel](https://vercel.com/login) using your personal account; no payment or Pro trial is needed. After that, import the reviewed source from a personal Git repository, or use the Vercel CLI (48.1.8+; the current native FastAPI docs specify that floor). Authorize GitHub or CLI login in your own browser; never paste credentials/tokens into chat. This workspace originally had no Git repository, so a Git-based route also needs repository creation/push; CLI upload can be used without first publishing source publicly.

Do not deploy until the personal Hobby scope and root settings above are confirmed. Once a deployment exists, provide its real `https://...vercel.app` URL. We will verify the public frontend, assets, every API, checksum/provenance, default metrics, February boundary, API404 behavior, and navigation/direct refreshes. For evaluator access, confirm production Deployment Protection does not require a Vercel login; verify in incognito. Deployment Protection changes should be made deliberately on the demo project only.

The reusable read-only verification command is:

```powershell
npm.cmd ci
npm.cmd run verify:deployed -- https://YOUR-PROJECT.vercel.app
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:PLAYWRIGHT_BASE_URL='https://YOUR-PROJECT.vercel.app'
$env:VERCEL_ROUTING_CHECK='1'
cd frontend
npm.cmd test -- --reporter=line --workers=1
```

The first command installs local verification tooling, not cloud resources. The HTTP command writes `docs/vercel-public-http.json` only after all checks pass. The browser suite separately verifies JavaScript interaction and refresh behavior. A successful local harness run does not certify Vercel's actual routing/dependency bundle: public checks remain pending until an actual deployment exists.

### Heroku — retained secondary configuration only

`heroku.yml` and the root Dockerfile remain available, but Heroku is no longer the primary deployment method and is not needed for Vercel. Dockerfiles/Compose continue to satisfy the assignment's local Docker requirement. No Heroku resource has been created.

## Directory guide

```text
backend/app/analysis.py       Pure cutoff selection, normalization, join and metrics
backend/app/ingest.py         Explicit Elexon retrieval and atomic snapshot writer
backend/app/store.py          Snapshot validation and checksum checks
backend/app/snapshot.py       Bundled data path and hashing, without maintenance imports
backend/app/main.py           FastAPI routes, settings, CORS and static frontend serving
backend/tests/               Domain, cache/retrieval and API tests
backend/requirements*.txt    Pinned direct Python dependencies and development tools
backend/Dockerfile           Optional standalone API image (root build context)
frontend/src/                React views, shared controls/chart/table and styles
frontend/tests/              Playwright browser/error/accessibility checks
frontend/package-lock.json   Reproducible frontend dependency resolution
app.py                       Native Vercel ASGI export for the existing Python app
vercel.json                  Same-project FastAPI/CDN routing and function packaging
.vercelignore                Source-upload exclusions (keeps real dataset)
requirements.txt            Minimal root Vercel dependency entry
.python-version              Vercel Python 3.12 selection
scripts/prepare_vercel.py     Build-only React assets → public/ CDN output
scripts/verify_vercel.mjs     Official-schema and Vercel-compiler routing checks
scripts/verify_deployment.mjs Read-only public/local HTTP checks
scripts/local_vercel.py       Local test harness only; not a production entrypoint
public/                      Generated CDN assets; not committed or a data store
data/snapshot.json.gz        Persisted real Elexon data plus retrieval manifest
docs/                       Methodology, verification, checklist and demo outline
DESIGN.md                    Shared visual, interaction and UI ownership decisions
Dockerfile                   Multi-stage full-app production image
docker-compose.yml          Full app, environment, port and health check
heroku.yml                   Retained secondary Heroku configuration
.env.example                Optional settings; no credentials required for Elexon
```

The API has four read-only endpoints: `/api/day?decision_date=2026-01-15&cutoff=10:00`, `/api/accuracy?cutoff=10:00`, `/api/provenance`, `/api/health`. FastAPI supplies `/docs`. There is no mutation/refresh endpoint exposed to visitors.

## Assignment deliverables and AI disclosure

**OpenAI Codex/AI was used** to read the challenge, research official documentation, design and implement code, author tests/documentation, retrieve data, and run checks. Elexon supplied all production generation values. AI did not invent production data. The candidate should review the implementation and understand its assumptions before submitting it as their work.

The project deliberately stays small: no auth, cloud database, background scheduler, demand integrations or execution engine. Work is scoped to the challenge's 16-hour budget; no claim is made of exactly 16 hours of human effort. A maximum-10-minute two-part [video demo outline](docs/demo.md) and [requirements/submission checklist](docs/requirements-checklist.md) are included. The actual unlisted YouTube video, public anonymous-name GitHub repo, deployment URL, incognito access verification and Microsoft form submission are **not completed**.
