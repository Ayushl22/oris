# Wind procurement pilot

Authority: the user's explicit scope and complete challenge document. Embedded submission instructions are deliverable requirements, not authorization to publish or submit externally.

Build a small React/TypeScript dashboard and FastAPI backend. Persist only Elexon FUELHH (WIND) and WINDFOR. No authentication, trading, demand, extra energy feeds, or purchase quantity calculations. January 1–31 decision dates target January 2–February 1 delivery dates. Use configurable 10:00 Europe/London as a disclosed assumption; all comparisons use aware UTC instants.

## Approaches
Chosen by implementer under the user's build instruction: immutable gzip JSON snapshot, loaded once by FastAPI; React bundled and served by the same service for Heroku, or separately by Vercel. This is sufficient for a fixed one-month assignment. SQLite adds migrations without useful query scale here; browser-to-Elexon calls make reliability and publication selection harder to audit.

## Data behavior
Fetch publication history, including three days before January 1, never a latest-only forecast endpoint. Filter forecast publications <= decision instant, choose latest per exact delivery startTime, and join FUELHH WIND by aware timestamp. Latest null/invalid values do not fall back to older publications. Collapse equal duplicates; tied latest publications with conflicting values are ambiguous and excluded. Actuals use latest available revision as retrieved, without decision cutoff. Explicitly count absent, invalid, and conflicting values. No interpolation or filling. Every delivery day has a 48-slot expected grid in this scope. API observation shows hourly forecast timestamps, which may limit exact-match coverage to 50%; inspect full snapshot rather than assuming completeness.

Metrics are descriptive MW errors on valid matches only: error = forecast - actual; MAE = mean absolute error; RMSE = square root mean squared error; bias = mean error. Empty metrics are null. Positive bias means wind was overestimated and other procurement could be underestimated if demand were fixed. No purchase quantities without demand.

## Interface
Two views share date/cutoff controls. Decision forecast shows next-day series and each selected publication in an accessible table. Accuracy shows daily or pooled January metrics, actual/forecast series and missing counts. Provenance includes sources, retrieval times, snapshot hash and refresh command. Loading/error/empty states never show invented results. Changes cancel old requests. Persist applied view/date/cutoff/range in URL.

## Delivery
Dockerfiles, Compose, pinned dependencies/lockfile, .env.example, Heroku container manifest, optional Vercel frontend config. Tests prove boundaries, timestamp normalization, ties, nulls, selection, coverage, metrics and API errors. Runtime/browser verification and truthful test/deployment status documented. Video/public repo/form require user's account actions; supply demo outline and checklist.
