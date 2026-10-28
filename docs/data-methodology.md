# Data research notes

## Pre-deployment review

See [alignment-review.md](alignment-review.md) for the rechecked official semantics and method decision, and `elexon-alignment-openapi.json` for a fresh API-contract extract. Exact timestamp alignment is retained. Elexon describes hourly, time-targeted forecast MW; no reviewed official definition establishes a forward hourly mean. Averaging two actual half-hours would therefore be an unsupported target change. The comparison remains indicative because FUELHH is explicitly a half-hour mean and WINDFOR's averaging kernel is not fully specified.

At default 10:00, the fresh audit found 744/1,488 half-hour matches, zero missing actuals and zero future-publication leaks. All 744 hourly targets are represented. At midnight there are instead 682 matches and 806 missing forecast half-hours: next-day 22:00/23:00 targets have not yet been published. Tests independently reconstruct all targets for all January decisions at five cutoffs, including the 31 January decision delivering 1 February. No alignment logic, data values or default-cutoff metrics were changed.

The live official OpenAPI was inspected before implementation on 27 October 2026. `elexon-openapi-extract.json` preserves the relevant paths, schema definitions, descriptions and retrieval timestamp. The full challenge DOCX, including its table paragraphs and all deliverable sections, was read. Its instructions to upload/publish/submit are kept as checklist items and are not treated as user authorization to operate external accounts.

## Evidence

1. The [official OpenAPI](https://data.elexon.co.uk/swagger/v1/swagger.json) defines FUELHH stream publication filters, mutually exclusive settlement-date filters, an optional array `fuelType`, and an array JSON response. It describes FUELHH as 30-minute mean MW.
2. WINDFOR stream defines only `publishDateTimeFrom` and `publishDateTimeTo`, defaulting to the latest forecast if these are omitted. Its schema contains `dataset`, `publishTime`, `startTime`, nullable integer `generation`. We always supply publication bounds.
3. The [official wind forecast description](https://bmrs.elexon.co.uk/api-documentation/endpoint/forecast/generation/wind/latest) concerns wind farms visible to the operator with operational metering. This opinionated endpoint was consulted for semantics, not used to retrieve data. The only production datasets are WINDFOR and FUELHH WIND.
4. Elexon's [interface definitions](https://bscdocs.elexon.co.uk/bsc-module/interface-definition-documents/neta-interface-definition-and-design-document-part-1-interfaces-with-bsc-parties-and-their-agents) identify both wind forecast and half-hour generation values in MW. Legacy WINDFOR wording includes peak generation. API rows do not define an interval end or averaging convention for forecasts. We therefore disclose the limitation rather than imply exact measurement-method equivalence.
5. Direct January stream queries succeeded with status 200. FUELHH settlement `From=2026-01-02`, `To=2026-02-01` returned 1,488 WIND records, demonstrating the final delivery date is included. Local exact-date grids make upstream boundary behavior immaterial to output selection.
6. All 19,856 retrieved forecast records have `startTime` on minute 00. At 10:00 each January decision has 24 eligible next-day forecasts, including the 31 January → 1 February boundary. All FUELHH half-hours have actuals. We retain the missing 24 forecast slots per day.

Successful requests and raw-response hashes are stored in the snapshot manifest and exposed in the app. Six publication windows run from 29 December 2025 to 1 February 2026 00:00Z. No undocumented `from`, delivery filter or synthetic fuel filter is sent to WINDFOR. Retrieval time is distinct from historical publication time. Official endpoint example clocks/publication schedules are not used to infer missing publications: actual returned timestamps govern every selection.

## Comparison boundary

Both sources describe operationally metered wind MW, suitable for the brief's direct timestamp-paired indicative comparison; neither is asserted here to cover all national embedded wind. FUELHH values are half-hour means; forecast MW averaging details are not supplied per record. A timestamp match does not prove portfolio availability, contracted entitlement or identical measurement methodology. No energy conversion or average-of-two-half-hours substitution is performed. Forecasts remain at their real timestamps.

## Selection details

All timestamps must include timezone information. Python normalizes aware instants to UTC. Decision date and cutoff are interpreted in Europe/London using zoneinfo and tzdata for Windows portability. January and 1 February are GMT. For every half-hour in the next London calendar day, choose the latest eligible forecast publication, then join on exact UTC startTime. The default 10:00 cutoff is an assumption chosen for the demonstration.

The latest eligible publication is determined before testing its generation value, so a null never resurrects an older forecast. Generation must be a finite number, excluding booleans and numeric strings. Exact semantic duplicates collapse without summing or multiplying coverage. Conflicting values at a tied latest publication are excluded, even if one is null. Conflicts at older publications do not invalidate an unambiguous newer publication. Actual revisions use the latest retrieved publication, independent of the decision cutoff.

Counts distinguish missing, invalid, conflicting, valid and unmatched records. Invalid timestamp diagnostics count rows examined across the supplied snapshot because those cannot always be assigned to a delivery date. Off-grid diagnostics count otherwise parseable delivery-day records; duplicate diagnostics count eligible delivery-day rows beyond unique normalized publication/value pairs. Monthly diagnostics are available per decision day; monthly coverage and metrics pool rows and never average daily RMSE.

## Reliability and limits

The checked-in gzip file is the runtime dataset. It preserves original field values and all retrieved publications, including out-of-delivery-scope rows and possible query-boundary duplicates. The analysis filters these explicitly. Every required retrieval must return a nonempty valid dataset array before atomic replacement; this is not a guarantee of interval completeness. HTTP 429 and transient server/transport errors retry twice. Permanent HTTP/schema errors fail immediately. A failed refresh does not replace an older snapshot.

No synthetic data are served, no actuals are substituted for forecasts, and post-decision publications are never used. The application can still show missing data honestly if the provider returns incomplete history. The full historical retention policy and exact source metering reconciliation were not independently certified. The results should be explained as a bounded pilot, with the precise coverage and source-definition limitations visible.
