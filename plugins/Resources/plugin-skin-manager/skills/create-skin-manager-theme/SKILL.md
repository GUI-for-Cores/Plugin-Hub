---
name: create-skin-manager-theme
description: Create, refine, validate, and contribute portable themes for the GUI.for.Cores Skin Manager in `plugins/Resources/plugin-skin-manager`. Use when turning a visual reference or style brief into a new theme package, editing an existing theme, registering it in `themes.json`, checking GUI.for.Clash and GUI.for.SingBox compatibility, or preparing a pull request with screenshots and verification notes.
---

# Create a Skin Manager theme

Build a complete theme package without changing host typography, component geometry, or overlay positioning.

## Workflow

1. Read the repository `AGENTS.md`, `plugins/Generic/plugin-skin-manager.js`, `themes.json`, and the closest existing theme.
2. Read `references/theme-schema.md` before creating files and `references/design-compatibility.md` before writing CSS.
3. Translate the reference into palette, surfaces, background art, borders, shadows, icon treatment, and optional motion. Treat reference UI text and layout as inspiration, not content to copy.
4. If a bitmap is needed, use the image generation skill. Preserve a low-detail reading region and output no text, logo, watermark, or mock interface.
5. Create the package with:

   ```powershell
   python scripts/new_theme.py <plugin-skin-manager-dir> <theme-id> --name "Theme name" --author "Author" --background <image>
   ```

6. Refine `<theme-id>/<theme-id>.json` and `<theme-id>/<theme-id>.css`. Keep all CSS below `body[data-gui-skin='<theme-id>']`.
7. Use shared `.gui-*` component classes only. Never add client-branded `gfc-` or `gfs-` selectors.
8. Keep the manager core unchanged for ordinary themes. Use manifest variables and generic motion primitives; propose core changes separately when a genuinely reusable capability is missing.
9. Validate the package:

   ```powershell
   python scripts/validate_theme.py <plugin-skin-manager-dir> <theme-id>
   ```

10. Format changed JSON/CSS, load the local plugin source, and verify both clients when available. Check light, dark, and follow-system modes, then restore the user's original mode.
11. Read `references/pr-checklist.md`, inspect the final diff, and prepare a focused pull request.

## Non-negotiable checks

- Preserve host font family, font size, font weight, line-height, spacing, dimensions, grid/flex layout, and overflow.
- Put input focus on `.gui-input:focus-within`; do not move input controls on hover.
- Do not add containing-block properties to cards or overlay ancestors; fixed dropdowns must remain adjacent to their triggers.
- Keep decoration inert with `pointer-events: none`, `aria-hidden`, and non-positive z-index.
- Respect `prefers-reduced-motion` and `feature-no-animation` whenever motion is enabled.
- Keep text readable over saturated art by raising content-surface opacity and lowering detail in reading regions.

## Handoff

Report created files, theme ID, visual concept, clients and modes tested, validator result, and any unavailable client. Include the image-generation mode and prompt when a bitmap was generated. Provide a PR title, concise description, and manual verification list.
