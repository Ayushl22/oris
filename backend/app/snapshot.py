"""Bundled snapshot location and hashing; no network or maintenance imports."""

import hashlib
import json
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "snapshot.json.gz"


def digest(records):
    return hashlib.sha256(
        json.dumps(
            records, sort_keys=True, separators=(",", ":"), allow_nan=False
        ).encode()
    ).hexdigest()
