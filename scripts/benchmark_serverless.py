"""Measure local native-ASGI cold/warm requests, without an HTTP server."""

import asyncio
import ctypes
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["VERCEL"] = "1"
started = time.perf_counter()
from app import app  # noqa: E402

import_seconds = time.perf_counter() - started


async def request(path):
    pathname, _, query = path.partition("?")
    messages = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        messages.append(message)

    before = time.perf_counter()
    await app(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "https",
            "path": pathname,
            "raw_path": pathname.encode(),
            "query_string": query.encode(),
            "headers": [],
            "server": ("local.test", 443),
            "client": ("127.0.0.1", 1),
            "root_path": "",
        },
        receive,
        send,
    )
    elapsed = time.perf_counter() - before
    status = next(m["status"] for m in messages if m["type"] == "http.response.start")
    body = b"".join(
        m.get("body", b"") for m in messages if m["type"] == "http.response.body"
    )
    assert status == 200, body
    return json.loads(body), elapsed, len(body)


async def main():
    health, cold, health_size = await request("/api/health")
    month, duration, response_size = await request("/api/accuracy?cutoff=10:00")
    _, warm, _ = await request("/api/health")
    peak_mb = None
    if sys.platform == "win32":

        class Counters(ctypes.Structure):
            _fields_ = [("cb", ctypes.c_ulong), ("PageFaultCount", ctypes.c_ulong)] + [
                (name, ctypes.c_size_t)
                for name in (
                    "PeakWorkingSetSize",
                    "WorkingSetSize",
                    "QuotaPeakPagedPoolUsage",
                    "QuotaPagedPoolUsage",
                    "QuotaPeakNonPagedPoolUsage",
                    "QuotaNonPagedPoolUsage",
                    "PagefileUsage",
                    "PeakPagefileUsage",
                )
            ]

        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        if ctypes.windll.psapi.GetProcessMemoryInfo(
            ctypes.c_void_p(-1), ctypes.byref(counters), counters.cb
        ):
            peak_mb = counters.PeakWorkingSetSize / 1024**2
    else:
        import resource

        peak_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    assert month["summary"]["matched"] == 744
    assert abs(month["summary"]["maeMW"] - 1995.5685483870968) < 1e-6
    assert "httpx" not in sys.modules and "uvicorn" not in sys.modules
    from backend.app.main import _cached_snapshot

    report = dict(
        checkedAt=datetime.now(timezone.utc).isoformat(),
        python=sys.version.split()[0],
        scope="Local ASGI timings and process peak working set; not Vercel latency",
        importSeconds=import_seconds,
        firstHealthSeconds=cold,
        warmHealthSeconds=warm,
        monthlyRequestSeconds=duration,
        healthResponseBytes=health_size,
        monthlyResponseBytes=response_size,
        peakWorkingSetMB=peak_mb,
        datasetBytes=(ROOT / "data/snapshot.json.gz").stat().st_size,
        cache=_cached_snapshot.cache_info()._asdict(),
        snapshotSha256=health["snapshotSha256"],
        summary=month["summary"],
        networkClientImported=False,
        uvicornImported=False,
    )
    (ROOT / "docs/serverless-benchmark.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
