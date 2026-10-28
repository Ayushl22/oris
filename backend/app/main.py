from datetime import date, timedelta
from functools import lru_cache
import os
from pathlib import Path
from threading import Lock

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .analysis import analyse, decision_time, summarise
from .snapshot import DEFAULT_PATH
from .store import SnapshotError, load_snapshot

ROOT = Path(__file__).resolve().parents[2]
if not os.getenv("VERCEL"):
    load_dotenv(ROOT / ".env")
DEFAULT_CUTOFF = os.getenv("DEFAULT_CUTOFF", "10:00")
decision_time(date(2026, 1, 1), DEFAULT_CUTOFF)
app = FastAPI(
    title="Wind window",
    version="1.0.0",
    description="January 2026 decision-time wind forecast reconstruction; values in MW.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        s.strip()
        for s in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if s.strip()
    ],
    allow_methods=["GET"],
    allow_headers=["Accept"],
)


_snapshot_lock = Lock()


@lru_cache(maxsize=1)
def _cached_snapshot():
    # Serverless deployment always uses the bundled snapshot. Local-only path
    # overrides cannot accidentally point a Vercel function at a workstation.
    path = (
        DEFAULT_PATH
        if os.getenv("VERCEL")
        else os.getenv("DATA_PATH", str(DEFAULT_PATH))
    )
    return load_snapshot(path)


def get_snapshot():
    # lru_cache alone allows duplicate simultaneous cold loads. Serialize the
    # lookup so initialization/decompression happens once per successful cache.
    with _snapshot_lock:
        return _cached_snapshot()


@app.exception_handler(SnapshotError)
async def snapshot_error(_: Request, exc: SnapshotError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


def day_result(snapshot, day, cutoff):
    try:
        return analyse(snapshot["forecasts"], snapshot["actuals"], day, cutoff)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/health")
def health(snapshot=Depends(get_snapshot)):
    return {"status": "ok", "snapshotSha256": snapshot["snapshotSha256"]}


@app.get("/api/day")
def day(
    decision_date: date = Query(...),
    cutoff: str = DEFAULT_CUTOFF,
    snapshot=Depends(get_snapshot),
):
    return day_result(snapshot, decision_date, cutoff)


@app.get("/api/accuracy")
def accuracy(cutoff: str = DEFAULT_CUTOFF, snapshot=Depends(get_snapshot)):
    results = [
        day_result(snapshot, date(2026, 1, 1) + timedelta(days=i), cutoff)
        for i in range(31)
    ]
    return dict(
        cutoff=cutoff,
        timezone="Europe/London",
        unit="MW",
        decisionRange=["2026-01-01", "2026-01-31"],
        deliveryRange=["2026-01-02", "2026-02-01"],
        summary=summarise([row for result in results for row in result["intervals"]]),
        days=[{k: v for k, v in r.items() if k != "intervals"} for r in results],
    )


@app.get("/api/provenance")
def provenance(snapshot=Depends(get_snapshot)):
    return dict(
        **snapshot["manifest"],
        snapshotSha256=snapshot["snapshotSha256"],
        defaultCutoff=DEFAULT_CUTOFF,
        timezone="Europe/London",
        biasDefinition="forecast minus actual; positive means wind overforecast",
        method="Latest publishTime <= decision timestamp, selected separately per exact delivery startTime. No filling.",
        refresh="cd backend && python -m app.ingest; restart API or rebuild deployment afterwards.",
    )


@app.get("/api/{path:path}", include_in_schema=False)
def unknown_api(path: str):
    raise HTTPException(status_code=404, detail="Unknown API endpoint")


dist = ROOT / "frontend" / "dist"
if not os.getenv("VERCEL") and dist.exists():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
