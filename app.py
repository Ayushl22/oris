"""Native Vercel ASGI entrypoint. The runtime imports app; no server is started."""

from backend.app.main import app

__all__ = ["app"]
