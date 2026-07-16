#!/usr/bin/env python3
"""Create a safe starter theme and register it in themes.json."""

from __future__ import annotations

import argparse
import json
import mimetypes
import re
import shutil
from pathlib import Path


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("resource_root", type=Path, help="plugins/Resources/plugin-skin-manager")
    parser.add_argument("theme_id")
    parser.add_argument("--name", required=True)
    parser.add_argument("--author", required=True)
    parser.add_argument("--description", default="A portable GUI.for.Cores theme.")
    parser.add_argument("--background", required=True, type=Path)
    parser.add_argument("--accent", default="#14b8a6")
    parser.add_argument("--accent-secondary", default="#ec4899")
    parser.add_argument("--tags", default="主题")
    args = parser.parse_args()

    root = args.resource_root.resolve()
    catalog_path = root / "themes.json"
    if not catalog_path.is_file():
        raise SystemExit(f"themes.json not found: {catalog_path}")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", args.theme_id):
        raise SystemExit("theme_id must be lowercase kebab-case")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", args.accent) or not re.fullmatch(r"#[0-9a-fA-F]{6}", args.accent_secondary):
        raise SystemExit("accent colors must be six-digit hex colors")
    if not args.background.is_file():
        raise SystemExit(f"background not found: {args.background}")

    catalog = json.loads(catalog_path.read_text(encoding="utf-8-sig"))
    if catalog.get("schemaVersion") != 1 or not isinstance(catalog.get("themes"), list):
        raise SystemExit("invalid themes.json")
    if any(entry.get("id") == args.theme_id for entry in catalog["themes"]):
        raise SystemExit(f"theme already registered: {args.theme_id}")

    theme_dir = root / args.theme_id
    if theme_dir.exists():
        raise SystemExit(f"theme directory already exists: {theme_dir}")
    theme_dir.mkdir()

    extension = args.background.suffix.lower()
    mime = mimetypes.types_map.get(extension)
    if mime not in {"image/webp", "image/png", "image/jpeg"}:
        shutil.rmtree(theme_dir)
        raise SystemExit("background must be WebP, PNG, JPG, or JPEG")
    background_name = f"{args.theme_id}-background{extension}"
    shutil.copy2(args.background, theme_dir / background_name)

    tags = [item.strip() for item in args.tags.split(",") if item.strip()]
    manifest = {
        "schemaVersion": 2,
        "id": args.theme_id,
        "name": args.name,
        "description": args.description,
        "author": args.author,
        "tags": tags,
        "ui": {
            "accent": args.accent.lower(),
            "accentSecondary": args.accent_secondary.lower(),
            "previewPosition": "center",
        },
        "files": {
            "stylesheet": f"{args.theme_id}.css",
            "background": background_name,
            "backgroundMime": mime,
        },
        "variables": {
            "--primary-color": args.accent.lower(),
            "--secondary-color": args.accent_secondary.lower(),
            "--color-light": "#17354a",
            "--color-dark": "#eefbff",
            "--bg-color-light": "rgba(248, 252, 255, 0.72)",
            "--bg-color-dark": "rgba(10, 25, 39, 0.82)",
            "--card-bg-light": "rgba(255, 255, 255, 0.78)",
            "--card-bg-dark": "rgba(12, 32, 48, 0.82)",
            "--input-bg-light": "rgba(255, 255, 255, 0.88)",
            "--input-bg-dark": "rgba(12, 34, 50, 0.88)",
            "--dropdown-bg-light": "rgba(255, 255, 255, 0.96)",
            "--dropdown-bg-dark": "rgba(9, 28, 43, 0.96)",
            "--modal-bg-light": "rgba(255, 255, 255, 0.96)",
            "--modal-bg-dark": "rgba(9, 28, 43, 0.96)",
        },
    }
    write_json(theme_dir / f"{args.theme_id}.json", manifest)

    css = f"""body[data-gui-skin='{args.theme_id}'] {{
  position: relative;
  isolation: isolate;
  background-color: #eaf7ff !important;
  background-image: linear-gradient(115deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04)), var(--skin-manager-background) !important;
  background-position: center, center !important;
  background-repeat: no-repeat, no-repeat !important;
  background-size: cover, cover !important;
  background-attachment: fixed, fixed !important;
}}

body[data-gui-skin='{args.theme_id}'][theme-mode='dark'] {{
  background-color: #0a1927 !important;
  background-image: linear-gradient(115deg, rgba(4, 16, 28, 0.62), rgba(8, 22, 36, 0.5)), var(--skin-manager-background) !important;
}}

body[data-gui-skin='{args.theme_id}'] .gui-input input:focus-visible {{
  outline: none;
}}

body[data-gui-skin='{args.theme_id}'] .gui-input:focus-within {{
  box-shadow: inset 0 0 0 1px {args.accent.lower()}, 0 0 0 2px {args.accent.lower()}26;
}}
"""
    (theme_dir / f"{args.theme_id}.css").write_text(css, encoding="utf-8")

    next_order = max((int(entry.get("order", 0)) for entry in catalog["themes"]), default=0) + 10
    catalog["themes"].append(
        {
            "id": args.theme_id,
            "manifest": f"{args.theme_id}/{args.theme_id}.json",
            "featured": False,
            "order": next_order,
        }
    )
    write_json(catalog_path, catalog)
    print(f"Created {args.theme_id} in {theme_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
