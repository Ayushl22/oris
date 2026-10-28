# Pre-deployment alignment decision

Reviewed 27 October 2026. **Retain exact `startTime` matching. Do not average two half-hourly actuals into an hour, interpolate forecasts or forward-fill them.** No generation values, selection rules or metric definitions changed in this review.

## Official semantics and rationale

| Official source | What it establishes | Consequence |
|---|---|---|
| [Elexon developer portal](https://developer.data.elexon.co.uk/) → API Patterns | The wind/latest API provides forecast MW for a specific point in time; publication history preserves superseded forecasts | Treat forecasts as values indexed by target time; choose a historical publication explicitly |
| [Elexon wind generation page](https://bmrs.elexon.co.uk/wind-generation) | Forecasts are hourly, updated several times a day; forecast is one MW figure across operationally metered Power Park Modules; the site directly compares forecast with fuel-type outturn | Hourly spacing is documented; it does not by itself establish an hourly mean |
| [Official Elexon OpenAPI](https://data.elexon.co.uk/swagger/v1/swagger.json) | WINDFOR records have `publishTime`, `startTime`, nullable `generation`; there is no interval end, duration or averaging-method field. FUELHH is explicitly average MW over 30 minutes | `startTime` is the target/delivery key, not publication time; retain actuals at their supplied startTime |
| [NESO-hosted BMRA & SAA Interface Specification, Issue 16, 25 July 2011](https://www.neso.energy/document/34076/download), section 14, printed page 13 / PDF page 19, and WINDFOR table printed page 44 / PDF page 50 | Forecasts are specified at hourly target times, including both endpoints of the described horizon; the table identifies a forecast time and MW. Section 11 explicitly calls FUELHH half-hour average period values | Historical primary-source corroboration of timestamp-based/hourly sampling; not a current publication-schedule promise |

**Decision and confidence:** The supported method for this pilot is a point-indexed / timestamp-only comparison. None of the reviewed official definitions states that `generation` is the mean over `[startTime, startTime + 1 hour)`. Consequently there is no official basis for replacing the actual at `t` with `(actual[t] + actual[t+30min]) / 2`. That would change the target without establishing that WINDFOR forecasts that target.

This does **not** prove that WINDFOR is a mathematically instantaneous measurement. The published material does not fully specify its temporal averaging kernel. FUELHH remains a half-hour mean. The metrics therefore remain **timestamp-matched forecast-versus-half-hour-outturn MW errors**, not certified like-for-like instantaneous errors or hourly-energy errors. Provider confirmation would be needed before claiming identical averaging conventions. No provider contact was sent.

If an authoritative future definition confirms a forward hourly mean, change the comparison to the duration-weighted mean of actuals at `t` and `t+30min`, require both valid halves, preserve latest eligible selection per hourly forecast target, use 744 expected hourly slots, and then recompute all errors. That alternative is not activated on the basis of hourly timestamp spacing alone.

## Why 744 matches, not 1,488

31 January decision days target the 31 delivery days from 2 January through 1 February. Each has 48 half-hours: `31 × 48 = 1,488`. The persisted WINDFOR history supplies target times on the hour only: `31 × 24 = 744`. All those targets have eligible forecasts at the default cutoff and exact-startTime WIND actuals. The `:30` rows have actuals but no forecast target; they stay missing on the requested half-hour grid.

Thus the **half-hour-grid coverage is 744 / 1,488 = 50%**, with **744 missing forecast half-hours, zero missing actuals**, and zero invalid/conflicting selected values. Relative to the documented hourly timestamp cadence there are **744 / 744 represented hourly targets**, with **zero absent hourly targets** in this snapshot. This 100% hourly-target count is a separate completeness diagnostic, not a relabelling of half-hour coverage or proof of 100% energy coverage.

**Cutoff sensitivity:** At 00:00, only 22 next-day hourly targets per decision are published. The `22:00` and `23:00` targets are still outside the available forecast horizon. This gives 682 matches, 806 missing half-hour forecasts, zero missing actuals and 45.83% half-hour-grid coverage. There are 62 absent hourly targets in addition to the 744 structural half-hour gaps. The app already excluded these unavailable targets correctly; the review corrected a fixed 50% explanatory note so it no longer misstates early-cutoff coverage. For example, next-day 2 January 22:00 and 23:00 first appear at 1 January 02:30Z in the persisted source history.

## Decision-time and boundary checks

An independent test oracle enumerates source candidates separately for each target and selects the maximum eligible `publishTime`. It compares the result with the app for all 31 decisions at 00:00, 08:00, 10:00, 16:00 and 23:59 Europe/London. Existing unit tests cover equality at cutoff, one millisecond after, per-target publication differences, offset normalization, latest nulls and tied conflicts.

The end-boundary audit requires 31 January 10:00 → 1 February delivery, target range `00:00Z` through `23:30Z`, 48 actuals and 24 selected hourly forecast values. It verifies all selected publications are on or before 31 January 10:00Z. London is GMT throughout this scope.

## Metrics

No alignment change was justified. The fresh 10:00 recalculation gives **MAE 1,995.5685 MW**, **RMSE 2,498.8245 MW**, **bias +1,727.9825 MW**, using **744 valid pairs**. Both running container APIs reproduce the values. All metrics are in **MW** with **error/bias = forecast minus actual**. Positive bias means wind overforecast. Only valid timestamp matches contribute; missing values are not zero.

See `alignment-audit.json` for recalculated values and per-day publication bounds, and `verification.md` for executed test and container results. The real snapshot is unchanged and its identity remains independently checkable through `/api/health` and provenance.
