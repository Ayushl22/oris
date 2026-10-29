"""Serve the immutable React build and extensionless navigation from ASGI."""

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles


class FrontendFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            # API/docs and asset misses must stay errors, never React HTML.
            url_path = path.replace("\\", "/")
            reserved = url_path.strip("/").split("/", 1)[0] in {
                "api",
                "assets",
                "docs",
                "redoc",
            }
            if (
                exc.status_code == 404
                and scope["method"] in {"GET", "HEAD"}
                and not reserved
                and "." not in path
            ):
                return await super().get_response("index.html", scope)
            raise
