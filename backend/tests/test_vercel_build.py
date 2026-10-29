import importlib.util
from pathlib import Path

from packaging.requirements import Requirement
import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "prepare_vercel", ROOT / "scripts/prepare_vercel.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_serverless_requirements_are_self_contained_and_match_local_versions(tmp_path):
    isolated = tmp_path / "requirements.txt"
    isolated.write_bytes((ROOT / "requirements.txt").read_bytes())

    def dependencies(path):
        return {
            Requirement(line.split("#", 1)[0].strip())
            for line in path.read_text().splitlines()
            if line.split("#", 1)[0].strip()
        }

    # Parsing an isolated file rejects recursive -r directives and prevents
    # root/serverless version drift while local/Docker keeps its own manifest.
    assert dependencies(isolated) == dependencies(
        ROOT / "backend/requirements-serverless.txt"
    )


def test_cdn_preparation_only_copies_frontend_build_not_backend_data(tmp_path):
    source = tmp_path / "frontend/dist"
    (source / "assets").mkdir(parents=True)
    (source / "index.html").write_text('<script src="/assets/app.js"></script>')
    (source / "assets/app.js").write_text("console.log('built frontend')")
    (tmp_path / "data").mkdir()
    (tmp_path / "data/snapshot.json.gz").write_bytes(b"backend-only")
    destination = module.prepare(tmp_path)
    assert (destination / "index.html").read_text() == (
        source / "index.html"
    ).read_text()
    assert (destination / "assets/app.js").is_file()
    assert not (destination / "data").exists()


def test_missing_frontend_build_fails_before_creating_public(tmp_path):
    with pytest.raises(RuntimeError, match="Build the React frontend first"):
        module.prepare(tmp_path)
    assert not (tmp_path / "public").exists()
