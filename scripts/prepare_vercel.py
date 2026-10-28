"""Copy only Vite's built web assets into Vercel's documented public/ CDN root."""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def prepare(root=ROOT):
    root = Path(root)
    source = root / "frontend" / "dist"
    destination = root / "public"
    if not (source / "index.html").is_file():
        raise RuntimeError(
            "Build the React frontend first: npm run build --prefix frontend"
        )
    # Vite output is trusted build output, not the repository root/data folder.
    # Refuse symlinks so a static asset cannot expose bundled server data.
    if any(path.is_symlink() for path in source.rglob("*")):
        raise RuntimeError("Frontend output must not contain symlinks")
    shutil.copytree(source, destination, dirs_exist_ok=True)
    return destination


if __name__ == "__main__":
    output = prepare()
    print(
        f"Prepared {sum(p.is_file() for p in output.rglob('*'))} static files in public/"
    )
