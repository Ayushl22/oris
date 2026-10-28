"""LOCAL TEST HARNESS ONLY, not a Vercel entrypoint or production server.

Uses Vercel-compiled rewrite rules and real public files around the native ASGI
export. This verifies application/routing integration; it does not emulate the
Vercel build infrastructure, edge network, billing or production runtime.
"""

import json
import os
from pathlib import Path
import re

from starlette.responses import FileResponse

os.environ["VERCEL"] = "1"
from backend.app.main import app as api_app  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
compiled = json.loads((ROOT / "docs" / "vercel-routing.json").read_text())
rules = [
    (re.compile(route["src"]), route["dest"])
    for route in compiled["routes"]
    if "src" in route
]


async def app(scope, receive, send):
    if scope["type"] != "http":
        return await api_app(scope, receive, send)
    pathname = scope["path"]
    candidate = (PUBLIC / pathname.lstrip("/")).resolve()
    if (
        scope["method"] in ("GET", "HEAD")
        and candidate.is_relative_to(PUBLIC.resolve())
        and candidate.is_file()
    ):
        return await FileResponse(candidate)(scope, receive, send)
    for regex, destination in rules:
        if scope["method"] in ("GET", "HEAD") and regex.fullmatch(pathname):
            return await FileResponse(PUBLIC / destination.lstrip("/"))(
                scope, receive, send
            )
    return await api_app(scope, receive, send)
