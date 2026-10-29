# Requirements checklist

Last reviewed: 29 October 2026. Vercel is the primary deployment target. The previous deployment reached Ready with a working API but frontend 404s. Native frontend serving and explicit asset bundling are now verified locally and at https://oris-psi-six.vercel.app. Evidence is in `verification.md` and `vercel-deployment.md`; Ready status alone does not establish a working application.

| Requirement | Status | Evidence / remaining action |
|---|---|---|
| Complete challenge read before implementation | Complete | All DOCX paragraph/table text and deliverables read |
| Official API definitions, parameters and fields verified | Complete | `elexon-openapi-extract.json`, successful live stream requests |
| Timestamp semantics, MW units and scope examined | Reviewed with explicit limitation | alignment-review.md, fresh OpenAPI extract and official sources; hourly/time-targeted MW documented, exact temporal averaging kernel not certified |
| Determine timestamp vs hourly-average comparison | Timestamp-only retained | No official definition justifies a following-hour mean; no actual aggregation, forecast interpolation or forward fill |
| Explain 744 matches / 1,488 half-hours | Complete | 744 hourly targets represented at 10:00; 744 :30 gaps; separate 100% hourly-target diagnostic |
| Independent selection audit for every January decision | Complete | Real-snapshot oracle tests all 31 dates at five cutoffs; latest eligible publication per target, zero leakage |
| Early-cutoff coverage sensitivity | Complete | Midnight: 682 matches, 806 missing forecasts, zero missing actuals; UI note corrected |
| Only FUELHH WIND + WINDFOR | Complete | Retriever and local WIND filter; persisted Elexon-only snapshot |
| Real January availability checked | Complete | 19,856 forecast source rows, 1,488 actuals; hourly forecast cadence documented |
| January decisions; next-day delivery through 1 February | Complete | Domain/API boundary tests and browser check |
| Configurable decision cutoff; default/timezone disclosed | Complete | UI, DEFAULT_CUTOFF, Europe/London, default 10:00 assumption |
| Latest forecast per interval, publishTime <= decision | Complete | Domain tests including exact equality and future exclusion |
| Exact startTime join | Complete | Offset normalization and mismatch tests |
| Duplicates, nulls, conflicts, missing data handled | Complete | Tests, interval statuses, coverage and diagnostics |
| Decision view with chart, units, publication info | Complete | Browser workflow and interval table |
| Accuracy view and actual/forecast comparison | Complete | Selected-day plot, monthly error chart and tables |
| MAE/RMSE/signed bias, valid pairs only | Complete | Hand-calculated tests; positive means overforecast |
| Coverage and missing counts | Complete | 50% default coverage visible; invalid/conflict counts separate |
| Procurement explanation without quantity calculations | Complete | UI and README; no demand or portfolio feed |
| Reliable persisted cache; no fabricated fallback | Complete | Included real snapshot, atomic refresh/checksum/error tests |
| Provenance and retrieval information | Complete | In-app manifest links, times, source counts and hashes |
| React frontend / Python FastAPI backend | Complete | Source and tested local application |
| Dependency files and .env.example | Complete | Self-contained root serverless pins; unchanged local/Docker manifests; version-parity regression and offline pip dry-runs pass; npm lockfile/environment template retained |
| Docker Desktop / engine running | Verified 27 October | Linux engine 29.4.2; 28 October probe returned API500, so current engine health is not asserted |
| Dockerfiles and Compose | Preserved; built/verified 27 October | Full app on port 8001 and standalone API on 8002 passed UID10001/internal/external checks then; Compose still validates; no fresh image rebuild claimed |
| App/backend verified from containers | Complete 27 October | 7 browser tests directly against Docker; both APIs matched default/midnight metrics, snapshot checksum and February boundary |
| Heroku deployment configuration | Retained secondary only | Dockerfile/heroku.yml preserved; no Heroku resource needed or created |
| Same-project Vercel React + FastAPI | Publicly verified | Root app.py/vercel.json, bundled frontend/dist served through ASGI, original /api namespace; no separate host |
| Native Python serverless entrypoint | Implemented | app.py exports existing ASGI app; no production Uvicorn/background job |
| Bundled real snapshot / read-only runtime | Verified locally | Relative-to-source path, checksum, arbitrary-cwd/no-network/no-write/concurrent-cache tests |
| Hobby compatibility and limits | Preflight checked | Personal/non-commercial only; 500MB Python, 2GB memory, 300s Fluid ceiling; configured30s; measured local usage below limits; actual cloud bundle pending |
| Frontend navigation/direct refresh and API404 | Verified locally and publicly | Native isolated-bundle regression, 14 preserved-path config cases; 12 HTTP checks and 10 browser tests on both native local app and public deployment; data not publicly served |
| README directories, commands, methods, assumptions, tests | Complete | README.md |
| Explicit Codex/AI disclosure | Complete | README.md |
| Backend and browser tests actually run | Complete locally | 55 backend tests; 10 native local browser tests; 12 public HTTP checks and 10 public browser tests passed (29 October) |
| Live app deployment URL | Complete | https://oris-psi-six.vercel.app; public frontend/assets/API/data/metrics and direct refresh verified after fdbdbae |
| Maximum-ten-minute demo video | Incomplete | Outline in demo.md; candidate must record/upload unlisted |
| Anonymous-name public GitHub repo | Complete | User-selected https://github.com/Ayushl22/oris; main pushed and public source/config/snapshot verified without authentication |
| Incognito access verification of all submission URLs | Partially complete | Live app and source anonymously readable; fresh-browser app tests passed; video/final submission URL checks remain |
| Submission form | Incomplete | Candidate supplies personal details and submits after URL verification |
| Certify identical forecast/outturn temporal averaging | Not established by published documentation | Provider clarification required before claiming identical hourly-average or instantaneous accuracy; current indicative timestamp method is disclosed |

No authentication, trade execution, consumer-demand data, other energy datasets, synthetic production results, or unrelated product features were added.
