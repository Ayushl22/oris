"""Exercise the actual ASGI export with a bundled cache and no local cwd/network."""

import importlib.util
from pathlib import Path
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import time

from fastapi.testclient import TestClient
import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def serverless(monkeypatch, tmp_path):
    monkeypatch.setenv("VERCEL", "1")
    # A local-only data override must never be necessary for Vercel.
    monkeypatch.setenv("DATA_PATH", str(tmp_path / "not-bundled.json.gz"))
    monkeypatch.chdir(tmp_path)
    spec = importlib.util.spec_from_file_location("vercel_entry", ROOT / "app.py")
    entry = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(entry)
    from backend.app.main import get_snapshot, _cached_snapshot

    _cached_snapshot.cache_clear()
    yield entry.app, get_snapshot
    _cached_snapshot.cache_clear()


def test_serverless_export_loads_bundled_data_from_any_cwd_without_writes_or_network(
    serverless,
):
    app, loader = serverless
    import backend.app.main as main

    with (
        patch.object(Path, "write_bytes", side_effect=AssertionError("runtime write")),
        patch.object(Path, "write_text", side_effect=AssertionError("runtime write")),
        patch(
            "socket.create_connection", side_effect=AssertionError("runtime network")
        ),
        patch.object(main, "load_snapshot", wraps=main.load_snapshot) as read,
    ):
        with TestClient(app) as client:
            health = client.get("/api/health")
            provenance = client.get("/api/provenance")
            assert health.status_code == provenance.status_code == 200
            assert (
                health.json()["snapshotSha256"]
                == "1a79b61208823de9de417987d7caf563a1791df9faf23b9176341607b7b8650a"
            )
            assert provenance.json()["records"] == {"forecasts": 19856, "actuals": 1488}
            assert read.call_count == 1
            assert main._cached_snapshot.cache_info().hits >= 1


def test_serverless_default_metrics_and_february_boundary(serverless):
    app, _ = serverless
    with TestClient(app) as client:
        response = client.get("/api/accuracy?cutoff=10:00")
        assert response.status_code == 200
        summary = response.json()["summary"]
        assert summary["matched"] == 744
        assert summary["expected"] == 1488
        assert summary["maeMW"] == pytest.approx(1995.5685483870968)
        assert summary["rmseMW"] == pytest.approx(2498.8245110107187)
        assert summary["biasMW"] == pytest.approx(1727.9825268817203)
        day = client.get("/api/day?decision_date=2026-01-31&cutoff=10:00").json()
        assert day["deliveryDate"] == "2026-02-01"
        assert day["summary"]["matched"] == 24
        assert all(
            r["publishTime"] <= day["decisionTime"]
            for r in day["intervals"]
            if r["publishTime"]
        )


def test_unknown_api_is_json_and_backend_does_not_mount_frontend_on_vercel(serverless):
    app, _ = serverless
    with TestClient(app) as client:
        response = client.get("/api/not-real")
        assert response.status_code == 404
        assert response.headers["content-type"].startswith("application/json")
        # Static responses belong to Vercel's CDN, not the Python function.
        assert client.get("/").status_code == 404
        assert client.get("/data/snapshot.json.gz").status_code == 404


def test_simultaneous_cold_requests_share_one_snapshot_load(serverless):
    _, loader = serverless
    import backend.app.main as main

    ready = Barrier(2)

    def read(_):
        time.sleep(0.05)
        return {"snapshotSha256": "one-initialization"}

    def concurrent_request(_):
        ready.wait(timeout=3)
        return loader()

    with patch.object(main, "load_snapshot", side_effect=read) as loading:
        with ThreadPoolExecutor(max_workers=2) as executor:
            snapshots = list(executor.map(concurrent_request, range(2)))
        assert loading.call_count == 1
        assert snapshots[0] is snapshots[1]
