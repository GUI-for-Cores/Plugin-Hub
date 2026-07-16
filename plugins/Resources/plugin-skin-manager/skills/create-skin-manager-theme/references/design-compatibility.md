# Design and compatibility rules

## Visual translation

- Extract color relationships and material qualities instead of copying a reference layout.
- Put focal art toward an edge. Keep the central reading region smooth and low-detail.
- Use more saturation in decoration than behind text.
- Provide distinct light and dark surfaces. Do not rely only on `prefers-color-scheme`; the host exposes `[theme-mode='dark']`.
- Check headings, secondary text, disabled states, tags, tables, charts, scrollbars, modals, menus, and toasts.

## Safe selectors

Scope every rule to the theme body attribute. Shared host classes include `.gui-card`, `.gui-button`, `.gui-input`, `.gui-select`, `.gui-radio`, `.gui-switch`, `.gui-dropdown-overlay`, and `.gui-menu`.

Never use `.gfc-*`, `.gfs-*`, `[data-gfc-*]`, or `[data-gfs-*]`. Avoid selectors tied to translated visible text.

## Typography and layout

Do not change host `font`, `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, margin, padding, gap, dimensions, display, grid, flex, position, or overflow. Geometry is allowed only on decoration owned by the theme.

## Inputs and overlays

Use `.gui-input:focus-within` for the complete focus ring and suppress only the nested native outline. Never translate or scale an input on hover.

Do not put `transform`, `filter`, `perspective`, `contain: paint`, or `backdrop-filter` on `.gui-card`, modal ancestors, or other containers that may contain a fixed dropdown. Style overlay surfaces directly without replacing their position, inset, transform, or z-index.

## Motion and interaction

Decoration belongs in `[data-skin-motion-layer]` and must use `pointer-events: none` with a non-positive z-index. Do not create a positive-z-index full-window layer.

Disable nonessential animation under both:

```css
@media (prefers-reduced-motion: reduce) {
}
body[data-gui-skin='theme-id'][feature-no-animation='true'] {
}
```

## Required live checks

For each available client, inspect Overview, Configuration, Subscriptions, Rulesets, Plugins, Scheduled Tasks, and Settings. Open a card ellipsis menu and a modal dropdown. Focus and hover an input. Verify light, dark, and follow-system modes, then restore the original setting.
