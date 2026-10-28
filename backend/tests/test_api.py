from fastapi.testclient import TestClient
import pytest

from app.main import app, get_snapshot
from app.store import SnapshotError


@pytest.fixture
def client():
    app.dependency_overrides[get_snapshot] = lambda: {
        "forecasts": [
            {
                "dataset": "WINDFOR",
                "startTime": "2026-01-02T00:00:00Z",
                "publishTime": "2026-01-01T09:00:00Z",
                "generation": 100,
            }
        ],
        "actuals": [
            {
                "dataset": "FUELHH",
                "fuelType": "WIND",
                "startTime": "2026-01-02T00:00:00Z",
                "publishTime": "2026-01-02T00:30:00Z",
                "generation": 90,
            }
        ],
        "manifest": {"complete": True},
        "snapshotSha256": "test-only",
    }
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_day_endpoint_exposes_selected_publication_and_defined_bias(client):
    response = client.get("/api/day?decision_date=2026-01-01&cutoff=10:00")
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["biasMW"] == 10
    assert body["intervals"][0]["publishTime"] <= body["decisionTime"]
    assert body["deliveryDate"] == "2026-01-02"


@pytest.mark.parametrize(
    "query",
    [
        "decision_date=2026-02-01",
        "decision_date=bad",
        "decision_date=2026-01-01&cutoff=24:00",
    ],
)
def test_invalid_request_returns_422(client, query):
    assert client.get("/api/day?" + query).status_code == 422


def test_pooled_month_weights_by_valid_matches_not_daily_means(client):
    body = client.get("/api/accuracy?cutoff=10:00").json()
    assert len(body["days"]) == 31
    assert body["summary"]["expected"] == 1488
    assert body["summary"]["matched"] == 1
    assert body["summary"]["maeMW"] == 10
    assert body["days"][-1]["deliveryDate"] == "2026-02-01"


def test_provenance_includes_snapshot_identity_and_default_assumption(client):
    body = client.get("/api/provenance").json()
    assert body["snapshotSha256"] == "test-only"
    assert body["timezone"] == "Europe/London"
    assert body["defaultCutoff"] == "10:00"


def test_missing_snapshot_returns_service_unavailable(client):
    def unavailable():
        raise SnapshotError("Snapshot missing; refresh data")

    app.dependency_overrides[get_snapshot] = unavailable
    response = client.get("/api/day?decision_date=2026-01-01")
    assert response.status_code == 503
    assert "Snapshot missing" in response.json()["detail"]


def test_unknown_api_route_is_json_404(client):
    r = client.get("/api/not-a-route")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")
