"""Explicit maintenance command. Runtime requests never depend on Elexon uptime."""

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import time

import httpx

from .snapshot import DEFAULT_PATH, digest

BASE = "https://data.elexon.co.uk/bmrs/api/v1"


def fetch(client, dataset, params, retries):
    for attempt in range(retries + 1):
        try:
            response = client.get(f"{BASE}/datasets/{dataset}/stream", params=params)
            response.raise_for_status()
            break
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            retryable = isinstance(
                exc, httpx.TransportError
            ) or exc.response.status_code in (429, 500, 502, 503, 504)
            if not retryable or attempt == retries:
                raise
            time.sleep(2**attempt)
    rows = response.json()
    if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
        raise ValueError(f"{dataset}: expected JSON array of records")
    if not rows:
        raise ValueError(f"{dataset}: empty response; previous snapshot retained")
    if any(r.get("dataset") != dataset for r in rows):
        raise ValueError(f"{dataset}: unexpected dataset in response")
    if dataset == "FUELHH" and any(r.get("fuelType") != "WIND" for r in rows):
        raise ValueError("FUELHH response contains non-WIND fuel types")
    return rows, dict(
        url=str(response.request.url),
        dataset=dataset,
        status=response.status_code,
        retrievedAt=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        records=len(rows),
        responseSha256=hashlib.sha256(response.content).hexdigest(),
    )


def refresh(output: Path = DEFAULT_PATH, *, client=None, retries=2):
    if client is None:
        with httpx.Client(
            timeout=60,
            headers={
                "Accept": "application/json",
                "User-Agent": "wind-window-assignment/1.0",
            },
        ) as owned:
            return refresh(output, client=owned, retries=retries)
    forecasts, requests = [], []
    # Includes earlier publications needed for early January decisions. Adjacent
    # windows deliberately overlap at endpoints; domain selection deduplicates.
    bounds = [
        "2025-12-29",
        "2026-01-01",
        "2026-01-08",
        "2026-01-15",
        "2026-01-22",
        "2026-01-29",
        "2026-02-01",
    ]
    for start, end in zip(bounds, bounds[1:]):
        rows, receipt = fetch(
            client,
            "WINDFOR",
            dict(
                publishDateTimeFrom=start + "T00:00:00Z",
                publishDateTimeTo=end + "T00:00:00Z",
            ),
            retries,
        )
        forecasts.extend(rows)
        requests.append(receipt)
    actuals, receipt = fetch(
        client,
        "FUELHH",
        dict(
            settlementDateFrom="2026-01-02",
            settlementDateTo="2026-02-01",
            fuelType="WIND",
        ),
        retries,
    )
    requests.append(receipt)
    manifest = dict(
        schemaVersion=1,
        complete=True,
        retrievedAt=requests[-1]["retrievedAt"],
        decisionRange=["2026-01-01", "2026-01-31"],
        deliveryRange=["2026-01-02", "2026-02-01"],
        forecastPublicationRange=[bounds[0] + "T00:00:00Z", bounds[-1] + "T00:00:00Z"],
        requests=requests,
        records={"forecasts": len(forecasts), "actuals": len(actuals)},
        dataSha256={"forecasts": digest(forecasts), "actuals": digest(actuals)},
    )
    payload = json.dumps(
        dict(manifest=manifest, forecasts=forecasts, actuals=actuals),
        separators=(",", ":"),
        allow_nan=False,
    ).encode()
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    try:
        temporary.write_bytes(gzip.compress(payload, mtime=0))
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Retrieve only real Elexon WINDFOR and FUELHH WIND records, atomically."
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_PATH)
    args = parser.parse_args()
    print(json.dumps(refresh(args.output), indent=2))
