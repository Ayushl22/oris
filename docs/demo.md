# Ten-minute submission video outline

Status: outline prepared; recording and unlisted YouTube upload remain for the candidate. The challenge says evaluation starts with the video, so do not submit without it. Replace local URLs with the verified deployed URL before recording.

## Part 1: customer pilot (0:00–5:00 maximum)

- 0:00–0:45: Introduce Wind window: reconstruct the wind forecast available when the day-ahead decision was made. State January 2026 scope, Elexon only, no purchase quantities without demand.
- 0:45–2:00: Decision forecast view. Select 15 January and 10:00 GMT. Explain decision date vs next-day delivery, MW, forecast peak/low, and publication check. Change the cutoff and show real changes. Open the table to demonstrate the publication cutoff.
- 2:00–3:00: Accuracy view. Explain forecast minus actual bias, MAE and RMSE in everyday terms. Positive wind bias can understate other supply needed if demand is fixed. Do not claim cost savings or prescribe a reserve.
- 3:00–4:00: All January decisions. Read the displayed live snapshot metrics. At 10:00 the recorded baseline is MAE 1,995.6 MW, RMSE 2,498.8 MW, bias +1,728.0 MW. Explain 744/1,488 = 50% half-hour coverage, all 744 hourly targets represented, and the point-indexed forecast versus half-hour-mean actual limitation. No official hourly averaging window was found, so actuals are not aggregated. At 00:00 the late-hour targets are not yet published and coverage is lower.
- 4:00–5:00: Show 31 January → 1 February and provenance. State that the pilot uses an immutable Elexon snapshot; publication, delivery and retrieval are different times. Finish with the missing demand/portfolio requirements for a future procurement-quantity tool.

## Part 2: technical review (5:00–10:00 maximum)

- 5:00–6:00: Architecture: native Python FastAPI serves the bundled React build and API in one Vercel project, using the immutable bundled snapshot. Show root app.py/vercel.json, explicit frontend/dist and snapshot inclusion, and dependency split. Docker/Compose remain for local execution. No runtime Elexon download or persistent storage dependency.
- 6:00–7:15: Explain documented query parameters and the saved OpenAPI extract. Show `analysis.py`: timezone normalization, inclusive cutoff, latest publication separately per exact startTime, null/conflict policy, exact join.
- 7:15–8:15: Explain missing counts, valid-only pooled metrics and bias formula. Mention same operational MW scope and the forecast averaging-method limitation. Show tests for cutoff equality, future exclusion, duplicates, actual revisions and February boundary.
- 8:15–9:15: Run test and build commands. Show the real status in verification.md. Explain atomic refresh and checksums, explicit 503 on a bad snapshot, frontend loading/error/retry and cancellation. Never describe unexecuted container/deployment checks as passing.
- 9:15–10:00: Explain hosting settings, account actions, limitations, and Codex/AI use. Open the deployed URL and source repository. Keep the total below ten minutes; each part below five.

## After recording

Upload as **unlisted** to the candidate's YouTube account. Put the resulting actual link in README and the submission form. Open video, public repository and deployed app in an incognito/private window and confirm no login is needed. The public repo should use an anonymous name as requested in the challenge. The original submission form is [Microsoft Forms](https://forms.cloud.microsoft/r/FTX6K2bbnU); the application does not submit it automatically.
