"""Pure, exact-timestamp decision reconstruction. No filling or interpolation."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
import math
import re
from zoneinfo import ZoneInfo

UTC = timezone.utc
LONDON = ZoneInfo("Europe/London")


def instant(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("Timestamp requires an explicit timezone")
    return dt.astimezone(UTC)


def iso(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def decision_time(day: date, cutoff: str) -> datetime:
    if not date(2026, 1, 1) <= day <= date(2026, 1, 31):
        raise ValueError("Decision date must be in January 2026")
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", cutoff):
        raise ValueError("Cutoff must be HH:MM (00:00–23:59)")
    return datetime.combine(day, time.fromisoformat(cutoff), LONDON).astimezone(UTC)


def number(value):
    # bool is an int subclass; strings are not part of Elexon's numeric schema.
    if (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    ):
        return float(value)
    return None


def select(records, grid, cutoff, dataset):
    groups = defaultdict(list)
    diagnostics = dict(DuplicateRows=0, InvalidTimestampRows=0, OffGridRows=0)
    lower, upper = grid[0], grid[-1] + timedelta(minutes=30)
    grid_set = set(grid)
    for record in records:
        if record.get("dataset") != dataset:
            continue
        if dataset == "FUELHH" and record.get("fuelType") != "WIND":
            continue
        try:
            start = instant(record["startTime"])
            publication = instant(record["publishTime"])
        except (ValueError, TypeError, KeyError, AttributeError):
            diagnostics["InvalidTimestampRows"] += 1
            continue
        if not lower <= start < upper:
            continue
        if start not in grid_set:
            diagnostics["OffGridRows"] += 1
            continue
        if cutoff is not None and publication > cutoff:
            continue
        groups[start].append((publication, number(record.get("generation"))))

    selected = {}
    for start, candidates in groups.items():
        unique = set(candidates)
        diagnostics["DuplicateRows"] += len(candidates) - len(unique)
        latest = max(p for p, _ in unique)
        values = {v for p, v in unique if p == latest}
        if len(values) > 1:
            selected[start] = (None, iso(latest), "conflict")
        else:
            value = values.pop()
            selected[start] = (
                value,
                iso(latest),
                "valid" if value is not None else "invalid",
            )
    return selected, diagnostics


def summarise(rows):
    errors = [r["errorMW"] for r in rows if r["errorMW"] is not None]
    n = len(errors)
    expected = len(rows)
    result = dict(
        expected=expected,
        matched=n,
        unmatched=expected - n,
        coveragePercent=100 * n / expected if expected else 0,
        maeMW=sum(abs(e) for e in errors) / n if n else None,
        rmseMW=math.sqrt(sum(e * e for e in errors) / n) if n else None,
        biasMW=sum(errors) / n if n else None,
    )
    for label, key in (("Forecast", "forecast"), ("Actual", "actual")):
        result["missing" + label] = sum(r[key + "Status"] == "missing" for r in rows)
        result[key + "Invalid"] = sum(r[key + "Status"] == "invalid" for r in rows)
        result[key + "Conflicts"] = sum(r[key + "Status"] == "conflict" for r in rows)
        result[key + "Available"] = sum(r[key + "Status"] == "valid" for r in rows)
    return result


def analyse(forecasts, actuals, decision_date: date, cutoff: str):
    decision = decision_time(decision_date, cutoff)
    delivery = decision_date + timedelta(days=1)
    begin = datetime.combine(delivery, time.min, LONDON).astimezone(UTC)
    end = datetime.combine(delivery + timedelta(days=1), time.min, LONDON).astimezone(
        UTC
    )
    grid = [
        begin + timedelta(minutes=30 * i)
        for i in range(int((end - begin).total_seconds() / 1800))
    ]
    forecast, fd = select(forecasts, grid, decision, "WINDFOR")
    actual, ad = select(actuals, grid, None, "FUELHH")
    rows = []
    for start in grid:
        f, fp, fs = forecast.get(start, (None, None, "missing"))
        a, ap, ats = actual.get(start, (None, None, "missing"))
        rows.append(
            dict(
                startTime=iso(start),
                forecastMW=f,
                actualMW=a,
                publishTime=fp,
                actualPublishTime=ap,
                forecastStatus=fs,
                actualStatus=ats,
                errorMW=f - a if f is not None and a is not None else None,
            )
        )
    return dict(
        decisionDate=str(decision_date),
        decisionTime=iso(decision),
        cutoff=cutoff,
        deliveryDate=str(delivery),
        timezone="Europe/London",
        unit="MW",
        intervals=rows,
        summary=summarise(rows),
        diagnostics={
            **{"forecast" + k: v for k, v in fd.items()},
            **{"actual" + k: v for k, v in ad.items()},
        },
    )
