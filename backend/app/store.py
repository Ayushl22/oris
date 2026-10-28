import gzip
import hashlib
import json
import zlib
from pathlib import Path

from .snapshot import digest


class SnapshotError(RuntimeError):
    pass


def load_snapshot(path):
    try:
        raw = Path(path).read_bytes()
        snapshot = json.loads(gzip.decompress(raw))
        manifest = snapshot["manifest"]
        if manifest["schemaVersion"] != 1 or manifest["complete"] is not True:
            raise ValueError("Unsupported or incomplete snapshot")
        for key in ("forecasts", "actuals"):
            if (
                not isinstance(snapshot[key], list)
                or digest(snapshot[key]) != manifest["dataSha256"][key]
            ):
                raise ValueError("Data checksum mismatch")
            if len(snapshot[key]) != manifest["records"][key]:
                raise ValueError("Record count mismatch")
        snapshot["snapshotSha256"] = hashlib.sha256(raw).hexdigest()
        return snapshot
    except (OSError, ValueError, KeyError, TypeError, EOFError, zlib.error) as exc:
        raise SnapshotError(
            f"Historical snapshot unavailable ({exc}). Run python -m app.ingest and restart the API."
        ) from exc
