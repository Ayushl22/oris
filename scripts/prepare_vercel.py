"""Validate the Vite build that is explicitly included in the Python function."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def prepare(root=ROOT):
    root = Path(root)
    source = root / "frontend" / "dist"
    if not (source / "index.html").is_file():
        raise RuntimeError(
            "Build the React frontend first: npm run build --prefix frontend"
        )
    # Vite output is trusted build output, not the repository root/data folder.
    # Refuse symlinks so a static asset cannot expose bundled server data.
    if any(path.is_symlink() for path in source.rglob("*")):
        raise RuntimeError("Frontend output must not contain symlinks")
    assets = re.findall(
        r'(?:src|href)="(/assets/[^\"]+)"', (source / "index.html").read_text()
    )
    if not assets or any(
        not (source / asset.lstrip("/")).is_file() for asset in assets
    ):
        raise RuntimeError("React build is missing referenced JS/CSS assets")
    return source


if __name__ == "__main__":
    output = prepare()
    print(
        f"Validated {sum(p.is_file() for p in output.rglob('*'))} frontend files for the Python bundle"
    )
