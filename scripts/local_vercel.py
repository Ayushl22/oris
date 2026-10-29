"""Local compatibility entry: use the actual native ASGI app, with no CDN shim."""

import os

os.environ["VERCEL"] = "1"
from app import app  # noqa: E402, F401
