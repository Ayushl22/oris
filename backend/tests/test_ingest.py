import gzip
import json
from pathlib import Path
import httpx
import pytest

from app.ingest import refresh
from app.store import load_snapshot, SnapshotError


def test_corrupt_deflate_has_actionable_snapshot_error(monkeypatch):
    damaged = bytearray(gzip.compress(b'{"manifest":{}}', mtime=0))
    damaged[10] ^= 0xFF
    monkeypatch.setattr(Path, "read_bytes", lambda _: bytes(damaged))
    with pytest.raises(SnapshotError, match="Historical snapshot unavailable"):
        load_snapshot("damaged.json.gz")


def handler(request):
    if "WINDFOR" in request.url.path:
        assert "publishDateTimeFrom" in request.url.params
        assert "publishDateTimeTo" in request.url.params
        return httpx.Response(
            200,
            json=[
                {
                    "dataset": "WINDFOR",
                    "publishTime": "2026-01-01T09:00:00Z",
                    "startTime": "2026-01-02T00:00:00Z",
                    "generation": 100,
                }
            ],
        )
    assert request.url.params["fuelType"] == "WIND"
    assert request.url.params["settlementDateFrom"] == "2026-01-02"
    assert request.url.params["settlementDateTo"] == "2026-02-01"
    return httpx.Response(
        200,
        json=[
            {
                "dataset": "FUELHH",
                "fuelType": "WIND",
                "publishTime": "2026-01-02T00:30:00Z",
                "startTime": "2026-01-02T00:00:00Z",
                "generation": 90,
            }
        ],
    )


def test_refresh_uses_documented_queries_and_writes_verifiable_provenance(tmp_path):
    path = tmp_path / "snapshot.json.gz"
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        refresh(path, client=client)
    snapshot = load_snapshot(path)
    assert len(snapshot["actuals"]) == 1
    assert snapshot["manifest"]["requests"][0]["url"].startswith(
        "https://data.elexon.co.uk/"
    )
    assert snapshot["manifest"]["requests"][0]["retrievedAt"]
    assert snapshot["manifest"]["requests"][0]["responseSha256"]
    assert snapshot["manifest"]["complete"] is True


def test_failed_refresh_preserves_previous_snapshot(tmp_path):
    path = tmp_path / "snapshot.json.gz"
    path.write_bytes(b"previous snapshot")
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(503))
    ) as client:
        with pytest.raises(httpx.HTTPStatusError):
            refresh(path, client=client, retries=0)
    assert path.read_bytes() == b"previous snapshot"


def test_unexpected_object_payload_does_not_publish(tmp_path):
    path = tmp_path / "snapshot.json.gz"
    with httpx.Client(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, json={"error": "not data"})
        )
    ) as client:
        with pytest.raises(ValueError, match="array"):
            refresh(path, client=client)
    assert not path.exists()


def test_empty_required_response_fails_instead_of_claiming_complete(tmp_path):
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=[]))
    ) as client:
        with pytest.raises(ValueError, match="empty"):
            refresh(tmp_path / "snapshot.json.gz", client=client)


def test_corrupt_or_missing_snapshot_is_explicit(tmp_path):
    with pytest.raises(SnapshotError):
        load_snapshot(tmp_path / "missing")
    path = tmp_path / "bad.json.gz"
    path.write_bytes(b"not gzip")
    with pytest.raises(SnapshotError):
        load_snapshot(path)


def test_snapshot_hash_detects_data_changes(tmp_path):
    path = tmp_path / "snapshot.json.gz"
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        refresh(path, client=client)
    data = json.loads(gzip.decompress(path.read_bytes()))
    data["actuals"][0]["generation"] = 99999
    path.write_bytes(gzip.compress(json.dumps(data).encode()))
    with pytest.raises(SnapshotError, match="checksum"):
        load_snapshot(path)
