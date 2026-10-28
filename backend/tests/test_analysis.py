"""Small hand-calculated fixtures are test inputs only, never application data."""

from datetime import date
import math
import pytest

from app.analysis import analyse, summarise

D = date(2026, 1, 1)


def forecast(start="2026-01-02T00:00:00Z", publish="2026-01-01T09:00:00Z", value=100):
    return dict(
        dataset="WINDFOR", startTime=start, publishTime=publish, generation=value
    )


def actual(
    start="2026-01-02T00:00:00Z", publish="2026-01-02T00:30:00Z", value=90, fuel="WIND"
):
    return dict(
        dataset="FUELHH",
        startTime=start,
        publishTime=publish,
        generation=value,
        fuelType=fuel,
    )


def test_cutoff_inclusive_and_after_cutoff_excluded():
    result = analyse(
        [
            forecast(value=80),
            forecast(publish="2026-01-01T10:00:00Z", value=110),
            forecast(publish="2026-01-01T10:00:00.001Z", value=900),
        ],
        [actual()],
        D,
        "10:00",
    )
    assert result["intervals"][0]["forecastMW"] == 110
    assert result["intervals"][0]["publishTime"] == "2026-01-01T10:00:00Z"
    assert result["summary"]["matched"] == 1


def test_latest_eligible_is_per_interval_not_global():
    result = analyse(
        [
            forecast(),
            forecast("2026-01-02T00:30:00Z", value=120),
            forecast(publish="2026-01-01T09:30:00Z", value=130),
        ],
        [],
        D,
        "10:00",
    )
    assert [r["forecastMW"] for r in result["intervals"][:2]] == [130, 120]


def test_timezone_offsets_normalize_and_exact_starttime_only():
    result = analyse(
        [
            forecast(
                start="2026-01-02T01:00:00+01:00", publish="2026-01-01T11:00:00+01:00"
            )
        ],
        [actual(), actual(start="2026-01-02T00:30:00Z")],
        D,
        "10:00",
    )
    assert result["intervals"][0]["errorMW"] == 10
    assert result["intervals"][1]["forecastMW"] is None


def test_equal_duplicates_collapse_and_conflicting_latest_excluded():
    f = forecast()
    result = analyse(
        [f, f.copy(), forecast(value=101)], [actual(), actual()], D, "10:00"
    )
    assert result["summary"]["forecastConflicts"] == 1
    assert result["summary"]["matched"] == 0
    assert result["diagnostics"]["forecastDuplicateRows"] == 1
    assert result["diagnostics"]["actualDuplicateRows"] == 1
    assert result["intervals"][0]["forecastStatus"] == "conflict"


def test_conflict_in_old_publication_does_not_invalidate_newer():
    r = analyse(
        [
            forecast(),
            forecast(value=101),
            forecast(publish="2026-01-01T09:30:00Z", value=120),
        ],
        [actual()],
        D,
        "10:00",
    )
    assert r["summary"]["matched"] == 1
    assert r["intervals"][0]["forecastMW"] == 120


def test_latest_actual_revision_and_no_fuel_substitution():
    r = analyse(
        [forecast()],
        [
            actual(),
            actual(publish="2026-01-03T00:00:00Z", value=95),
            actual(value=500, fuel="CCGT"),
        ],
        D,
        "10:00",
    )
    assert r["intervals"][0]["actualMW"] == 95
    assert r["intervals"][0]["actualPublishTime"] == "2026-01-03T00:00:00Z"


def test_tied_conflicting_actuals_excluded():
    r = analyse([forecast()], [actual(), actual(value=91)], D, "10:00")
    assert r["summary"]["actualConflicts"] == 1
    assert r["summary"]["matched"] == 0


@pytest.mark.parametrize("value", [None, "bad", float("nan"), float("inf"), True])
def test_latest_invalid_does_not_fall_back(value):
    r = analyse(
        [forecast(), forecast(publish="2026-01-01T09:30:00Z", value=value)],
        [actual()],
        D,
        "10:00",
    )
    assert r["intervals"][0]["forecastStatus"] == "invalid"
    assert r["intervals"][0]["forecastMW"] is None
    assert r["summary"]["forecastInvalid"] == 1


def test_missing_actual_and_missing_forecast_counted_separately():
    r = analyse([forecast()], [actual(start="2026-01-02T00:30:00Z")], D, "10:00")
    s = r["summary"]
    assert (
        s["expected"],
        s["missingForecast"],
        s["missingActual"],
        s["matched"],
        s["unmatched"],
    ) == (48, 47, 47, 0, 48)
    assert s["maeMW"] is None and s["rmseMW"] is None and s["biasMW"] is None


def test_metrics_hand_calculated_and_valid_only():
    r = analyse(
        [forecast(value=110), forecast("2026-01-02T00:30:00Z", value=80)],
        [actual(value=100), actual("2026-01-02T00:30:00Z", value=100)],
        D,
        "10:00",
    )
    s = r["summary"]
    assert s["maeMW"] == 15 and s["biasMW"] == -5
    assert s["rmseMW"] == pytest.approx(math.sqrt(250))
    assert s["coveragePercent"] == pytest.approx(100 * 2 / 48)
    assert summarise(r["intervals"] * 2)["matched"] == 4


@pytest.mark.parametrize(
    "day,delivery",
    [(date(2026, 1, 1), "2026-01-02"), (date(2026, 1, 31), "2026-02-01")],
)
def test_january_decision_boundaries(day, delivery):
    r = analyse([], [], day, "23:59")
    assert r["deliveryDate"] == delivery
    assert len(r["intervals"]) == 48
    assert r["intervals"][0]["startTime"] == delivery + "T00:00:00Z"
    assert r["intervals"][-1]["startTime"] == delivery + "T23:30:00Z"


@pytest.mark.parametrize("day", [date(2025, 12, 31), date(2026, 2, 1)])
def test_out_of_scope_decision_rejected(day):
    with pytest.raises(ValueError, match="January 2026"):
        analyse([], [], day, "10:00")


@pytest.mark.parametrize("cutoff", ["24:00", "9:00", "10:60", "10:00:01", "invalid"])
def test_invalid_cutoff_rejected(cutoff):
    with pytest.raises(ValueError, match="HH:MM"):
        analyse([], [], D, cutoff)


def test_wrong_day_and_off_grid_and_naive_timestamps_not_aligned():
    r = analyse(
        [
            forecast(start="2026-01-02T00:00:01Z"),
            forecast(start="2026-01-01T00:00:00Z"),
            forecast(start="2026-01-02T00:00:00"),
        ],
        [actual()],
        D,
        "10:00",
    )
    assert r["summary"]["matched"] == 0
    assert r["diagnostics"]["forecastInvalidTimestampRows"] == 1
    assert r["diagnostics"]["forecastOffGridRows"] == 1


def test_real_zero_generation_is_valid():
    r = analyse([forecast(value=0)], [actual(value=0)], D, "00:00")
    assert r["summary"]["matched"] == 0
    r = analyse([forecast(value=0)], [actual(value=0)], D, "10:00")
    assert r["summary"]["matched"] == 1
    assert r["summary"]["maeMW"] == 0
