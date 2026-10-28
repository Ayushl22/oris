"""Audit the persisted Elexon snapshot against an independent timestamp oracle.

These tests use real source records. No new production data is generated.
"""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

import pytest

from app.analysis import analyse, summarise
from app.ingest import DEFAULT_PATH
from app.store import load_snapshot


@pytest.fixture(scope="module")
def source():
    snapshot = load_snapshot(DEFAULT_PATH)
    forecast_index = defaultdict(list)
    actual_index = defaultdict(list)
    for row in snapshot["forecasts"]:
        forecast_index[datetime.fromisoformat(row["startTime"])].append(row)
    for row in snapshot["actuals"]:
        assert row["fuelType"] == "WIND"
        actual_index[datetime.fromisoformat(row["startTime"])].append(row)
    return snapshot, forecast_index, actual_index


@pytest.mark.parametrize(
    "cutoff,expected_matches",
    [("00:00", 682), ("08:00", 744), ("10:00", 744), ("16:00", 744), ("23:59", 744)],
)
def test_all_january_decisions_against_independent_per_timestamp_oracle(
    source, cutoff, expected_matches
):
    snapshot, forecast_index, actual_index = source
    all_rows = []
    for offset in range(31):
        decision_day = date(2026, 1, 1) + timedelta(days=offset)
        decision = datetime.fromisoformat(f"{decision_day}T{cutoff}:00+00:00")
        result = analyse(
            snapshot["forecasts"], snapshot["actuals"], decision_day, cutoff
        )
        assert result["deliveryDate"] == str(decision_day + timedelta(days=1))
        for selected in result["intervals"]:
            start = datetime.fromisoformat(selected["startTime"])
            candidates = [
                r
                for r in forecast_index[start]
                if datetime.fromisoformat(r["publishTime"]) <= decision
            ]
            actual_candidates = actual_index[start]
            assert actual_candidates, (
                "Every delivery half-hour must have actual data in this snapshot"
            )
            latest_actual = max(
                actual_candidates,
                key=lambda r: datetime.fromisoformat(r["publishTime"]),
            )
            assert selected["actualMW"] == latest_actual["generation"]
            if candidates:
                latest_time = max(
                    datetime.fromisoformat(r["publishTime"]) for r in candidates
                )
                latest_values = {
                    r["generation"]
                    for r in candidates
                    if datetime.fromisoformat(r["publishTime"]) == latest_time
                }
                assert len(latest_values) == 1, (
                    "Any real source conflict must be inspected"
                )
                assert datetime.fromisoformat(selected["publishTime"]) == latest_time
                assert latest_time <= decision
                assert selected["forecastMW"] == next(iter(latest_values))
                assert (
                    selected["errorMW"]
                    == selected["forecastMW"] - latest_actual["generation"]
                )
            else:
                assert selected["forecastMW"] is None
                assert selected["forecastStatus"] == "missing"
        all_rows.extend(result["intervals"])
    summary = summarise(all_rows)
    assert summary["expected"] == 1488
    assert summary["matched"] == expected_matches
    assert summary["missingForecast"] == 1488 - expected_matches
    assert summary["missingActual"] == 0
    # At midnight the source's horizon has not yet reached the next day's
    # 22:00 and 23:00 targets. Later tested cutoffs contain all hourly targets.
    assert (
        len(
            [
                r
                for r in all_rows
                if r["startTime"][14:16] == "00" and r["forecastMW"] is not None
            ]
        )
        == expected_matches
    )
    assert all(
        r["forecastMW"] is None for r in all_rows if r["startTime"][14:16] == "30"
    )


def test_february_first_delivery_has_complete_actuals_and_eligible_hourly_forecasts(
    source,
):
    snapshot, _, _ = source
    result = analyse(
        snapshot["forecasts"], snapshot["actuals"], date(2026, 1, 31), "10:00"
    )
    assert result["intervals"][0]["startTime"] == "2026-02-01T00:00:00Z"
    assert result["intervals"][-1]["startTime"] == "2026-02-01T23:30:00Z"
    assert result["summary"]["actualAvailable"] == 48
    assert result["summary"]["forecastAvailable"] == 24
    assert result["summary"]["matched"] == 24
    assert all(
        datetime.fromisoformat(r["publishTime"])
        <= datetime(2026, 1, 31, 10, tzinfo=timezone.utc)
        for r in result["intervals"]
        if r["publishTime"]
    )
