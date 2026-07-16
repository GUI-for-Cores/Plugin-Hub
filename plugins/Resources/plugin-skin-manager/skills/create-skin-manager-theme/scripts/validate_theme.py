#!/usr/bin/env python3
"""Validate one or all Skin Manager theme packages."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


SAFE_PATH = re.compile(r"^[a-zA-Z0-9_./-]+$")
BRANDED_SELECTOR = re.compile(r"(?:[.#]|\[data-)(?:gfc|gfs)-[\w-]+", re.I)
EXTERNAL_ASSET = re.compile(r"(?:@import\s+|url\(\s*['\"]?https?://)", re.I)
HOST_LAYOUT = re.compile(
    r"(?:font(?:-family|-size|-weight)?|line-height|letter-spacing|margin|padding|gap|display|(?:min-|max-)?(?:width|height)|grid(?:-[\w-]+)?|flex(?:-[\w-]+)?|position|overflow)\s*:",
    re.I,
)
CONTAINING_BLOCK = re.compile(r"(?:transform|filter|perspective|contain|backdrop-filter|-webkit-backdrop-filter)\s*:", re.I)


def load_json(path: Path, errors: list[str]):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"cannot parse {path}: {exc}")
        return None


def safe_relative(value: object) -> bool:
    text = str(value or "").replace("\\", "/")
    return bool(text and not text.startswith("/") and "../" not in text and SAFE_PATH.fullmatch(text))


def validate_theme(root: Path, entry: dict, errors: list[str], warnings: list[str]) -> None:
    theme_id = str(entry.get("id", ""))
    manifest_relative = entry.get("manifest")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", theme_id):
        errors.append(f"invalid catalog id: {theme_id}")
        return
    if not safe_relative(manifest_relative):
        errors.append(f"unsafe manifest path for {theme_id}: {manifest_relative}")
        return

    manifest_path = root / str(manifest_relative)
    manifest = load_json(manifest_path, errors)
    if not isinstance(manifest, dict):
        return
    if manifest.get("schemaVersion") != 2:
        errors.append(f"{theme_id}: schemaVersion must be 2")
    if manifest.get("id") != theme_id:
        errors.append(f"{theme_id}: manifest id does not match catalog")
    if manifest_path.parent.name != theme_id:
        errors.append(f"{theme_id}: directory must match theme id")
    for field in ("name", "description", "author"):
        if not isinstance(manifest.get(field), str) or not manifest[field].strip():
            errors.append(f"{theme_id}: missing {field}")

    ui = manifest.get("ui")
    if not isinstance(ui, dict):
        errors.append(f"{theme_id}: ui must be an object")
    else:
        for color in ("accent", "accentSecondary"):
            if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(ui.get(color, ""))):
                errors.append(f"{theme_id}: ui.{color} must be a six-digit hex color")

    files = manifest.get("files")
    if not isinstance(files, dict):
        errors.append(f"{theme_id}: files must be an object")
        return
    for field in ("stylesheet", "background"):
        if not safe_relative(files.get(field)):
            errors.append(f"{theme_id}: invalid files.{field}")
        elif not (manifest_path.parent / files[field]).is_file():
            errors.append(f"{theme_id}: missing {files[field]}")
    if files.get("backgroundMime") not in {"image/webp", "image/png", "image/jpeg"}:
        errors.append(f"{theme_id}: unsupported backgroundMime")

    variables = manifest.get("variables")
    if not isinstance(variables, dict):
        errors.append(f"{theme_id}: variables must be an object")
    else:
        for key, value in variables.items():
            if not re.fullmatch(r"--[a-z0-9-]+", str(key)) or not isinstance(value, str):
                errors.append(f"{theme_id}: invalid variable {key}")

    stylesheet = manifest_path.parent / str(files.get("stylesheet", ""))
    if not stylesheet.is_file():
        return
    css = stylesheet.read_text(encoding="utf-8-sig")
    scope = f"body[data-gui-skin='{theme_id}']"
    if scope not in css:
        errors.append(f"{theme_id}: stylesheet is not scoped to {scope}")
    branded = sorted(set(BRANDED_SELECTOR.findall(css)))
    if branded:
        errors.append(f"{theme_id}: client-branded selectors found: {', '.join(branded)}")
    if EXTERNAL_ASSET.search(css):
        errors.append(f"{theme_id}: external CSS/runtime assets are not allowed")
    if "var(--skin-manager-background)" not in css:
        errors.append(f"{theme_id}: stylesheet does not use --skin-manager-background")

    for selector, block in re.findall(r"([^{{}}]+)\{{([^{{}}]*)\}}", css, re.S):
        normalized = " ".join(selector.split())
        targets_host = ".gui-" in selector or "> #app" in selector or ">#app" in selector
        if targets_host and HOST_LAYOUT.search(block):
            errors.append(f"{theme_id}: host layout declaration in {normalized}")
        overlay_ancestor = any(token in selector for token in (".gui-card", "[role='dialog']", "[aria-modal='true']"))
        if overlay_ancestor and CONTAINING_BLOCK.search(block):
            errors.append(f"{theme_id}: dropdown-breaking containing block in {normalized}")
        if ".gui-input:hover" in selector and re.search(r"transform\s*:", block, re.I):
            errors.append(f"{theme_id}: input hover must not transform")

    if manifest.get("motion"):
        if "[data-skin-motion-layer]" not in css:
            errors.append(f"{theme_id}: motion requires a data-skin-motion-layer rule")
        if "prefers-reduced-motion" not in css:
            errors.append(f"{theme_id}: motion must respect prefers-reduced-motion")
        if "feature-no-animation" not in css:
            errors.append(f"{theme_id}: motion must respect feature-no-animation")
        layer = re.search(r"[^{{}}]*\[data-skin-motion-layer\][^{{}}]*\{{([^{{}}]*)\}}", css, re.S)
        if layer:
            if not re.search(r"pointer-events\s*:\s*none", layer.group(1), re.I):
                errors.append(f"{theme_id}: motion layer must use pointer-events: none")
            z_index = re.search(r"z-index\s*:\s*(-?\d+)", layer.group(1), re.I)
            if not z_index or int(z_index.group(1)) > 0:
                errors.append(f"{theme_id}: motion layer needs a non-positive z-index")

    if len(manifest.get("description", "")) > 100:
        warnings.append(f"{theme_id}: description may be too long for the Skin Center card")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("resource_root", type=Path, help="plugins/Resources/plugin-skin-manager")
    parser.add_argument("theme_ids", nargs="*")
    args = parser.parse_args()

    root = args.resource_root.resolve()
    errors: list[str] = []
    warnings: list[str] = []
    catalog = load_json(root / "themes.json", errors)
    if not isinstance(catalog, dict) or catalog.get("schemaVersion") != 1 or not isinstance(catalog.get("themes"), list):
        errors.append("themes.json must use schemaVersion 1 and contain a themes array")
    else:
        entries = catalog["themes"]
        ids = [entry.get("id") for entry in entries if isinstance(entry, dict)]
        duplicates = sorted({theme_id for theme_id in ids if ids.count(theme_id) > 1})
        if duplicates:
            errors.append("duplicate catalog ids: " + ", ".join(duplicates))
        selected = set(args.theme_ids)
        if selected:
            missing = sorted(selected - set(ids))
            if missing:
                errors.append("themes not found: " + ", ".join(missing))
        for entry in entries:
            if isinstance(entry, dict) and (not selected or entry.get("id") in selected):
                validate_theme(root, entry, errors, warnings)

    for warning in warnings:
        print(f"WARN: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    if errors:
        print(f"FAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"PASS: 0 errors, {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
