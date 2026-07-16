# Theme package schema

## Directory layout

```text
plugin-skin-manager/
├── themes.json
└── <theme-id>/
    ├── <theme-id>.json
    ├── <theme-id>.css
    └── <background>.(webp|png|jpg|jpeg)
```

Use lowercase kebab-case IDs. File names are case-sensitive after publication.

## Catalog

Register the theme once in `themes.json`:

```json
{
  "id": "aurora-night",
  "manifest": "aurora-night/aurora-night.json",
  "featured": false,
  "order": 20
}
```

Keep `schemaVersion` at `1`. Give each entry a unique ID and order. The scaffold script appends an entry and selects the next order in increments of ten.

## Manifest

Theme manifests use `schemaVersion: 2` and require:

- `id`, `name`, `description`, and `author`.
- `tags`: short product-facing labels.
- `ui.accent`, `ui.accentSecondary`, and `ui.previewPosition` for Skin Center cards.
- `files.stylesheet`, `files.background`, and an accurate `files.backgroundMime`.
- `variables`: CSS custom properties consumed by both clients. Every key must start with `--` and every value must be a string.

The manager injects the background as `--skin-manager-background`. Use that variable in the theme's scoped body background.

## Motion

Omit `motion` for a static theme. When present, it may contain:

- `particles`: up to 12 groups. Each group accepts `type`, `count`, optional `symbols`, and numeric distribution fields.
- Distribution fields: `xOffset`, `xStep`, `yOffset`, `yStep`, `sizeBase`, `sizeStep`, `sizeCycle`, `driftBase`, `driftStep`, `driftCycle`, `delayStep`, `delayCycle`, `durationBase`, `durationStep`, and `durationCycle`.
- `equalizerBarCount`: `0` disables the equalizer.
- `interactiveGlow`: follows the pointer using `--skin-pointer-x` and `--skin-pointer-y`.
- `clickBursts`, `clickBurstCount`, and `clickBurstSymbols`.

Style generated elements with generic selectors:

```css
body[data-gui-skin='aurora-night'] [data-skin-motion-layer] {
}
body[data-gui-skin='aurora-night'] [data-skin-particle='star'] {
}
body[data-gui-skin='aurora-night'] [data-skin-equalizer] {
}
body[data-gui-skin='aurora-night'] [data-skin-equalizer-bar] {
}
body[data-gui-skin='aurora-night'] [data-skin-burst] {
}
```

The manager creates the nodes and sets `--skin-x`, `--skin-y`, `--skin-size`, `--skin-drift`, `--skin-delay`, `--skin-duration`, `--skin-height`, `--skin-dx`, and `--skin-dy`.

Use the Miku manifest and CSS as the complete motion example.
