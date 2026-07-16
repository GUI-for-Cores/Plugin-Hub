# Pull request checklist

## Before committing

- Theme directory contains only the manifest, stylesheet, required bitmap assets, and intentionally bundled files.
- `themes.json` contains one correctly ordered entry.
- `validate_theme.py` reports zero errors.
- Repository formatting check passes.
- Background size is appropriate for distribution; prefer WebP when transparency is unnecessary.
- No external CSS, JavaScript, fonts, trackers, or remote runtime assets are injected.
- No unrelated files or generated caches are included.

## Manual verification

- Apply, reapply, close, and restore-after-reload work.
- Skin Center preview, status badge, tags, and action button work in light and dark modes.
- Input focus wraps all four sides and hover creates no scrollbar.
- Card and modal dropdowns stay adjacent to their triggers and above content.
- Decoration never blocks clicks and stops when animations are disabled.
- GUI.for.Clash and GUI.for.SingBox results are recorded separately. Mark an unavailable client as untested.

## PR content

Use an imperative title such as `Add aurora-night skin`.

Describe:

1. The visual concept and primary colors.
2. New files and the catalog entry.
3. Supported light/dark behavior and motion.
4. Manual verification steps and client versions.
5. Any known limitation.

Attach screenshots of the Skin Center card and at least one content-heavy page in light and dark modes. Do not claim dual-client verification without running both clients.
