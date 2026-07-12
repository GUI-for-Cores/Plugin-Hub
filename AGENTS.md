# Repository Guidelines

## Project Structure & Module Organization

The repository distributes plugins for GUI.for.Cores clients. Plugin scripts live under `plugins/` and are grouped by target:

- `plugins/Generic/` contains cross-client plugins.
- `plugins/GFC/` contains GUI.for.Clash plugins.
- `plugins/GFS/` contains GUI.for.SingBox plugins.
- `plugins/generic.json`, `gfc.json`, and `gfs.json` are the corresponding plugin catalogs.
- `plugins/Resources/` stores HTML, shortcuts, and other assets used by plugin scripts.
- `plugins.d.ts` declares the host APIs available to JavaScript plugins; `jsconfig.json` enables editor type checking.

Keep a plugin's script, catalog entry, and resources aligned. Use names such as `plugin-example-name.js` and matching catalog IDs such as `plugin-example-name`.

## Build, Test, and Development Commands

Use pnpm because `pnpm-lock.yaml` is committed.

- `pnpm install` installs Prettier and Vue development dependencies.
- `pnpm format` formats everything under `plugins/` using the repository configuration.
- `pnpm exec prettier --check plugins/` checks formatting without modifying files and is suitable before a PR.

There is no compiled build or local development server in this repository. Load or add the changed plugin through a supported client to exercise it.

## Coding Style & Naming Conventions

Write modern JavaScript compatible with the host APIs declared in `plugins.d.ts`. Prettier enforces two-space indentation, no semicolons, single quotes, a 160-column limit, and no trailing commas. Follow existing lifecycle names such as `onRun` and keep cleanup logic paired with installation or system changes. Catalog JSON uses two-space indentation and stable, kebab-case IDs.

Do not dynamically inject external JavaScript or CSS. Store temporary data under `data/.cache`, bundled third-party tools under `data/third`, and remove created files during uninstall where applicable. Avoid reading unrelated private user directories.

## Testing Guidelines

No automated test framework or coverage threshold is configured. Before submitting, check formatting, ensure edited JSON parses, and manually test each declared trigger, menu, configuration field, and uninstall path in the intended client. Verify referenced resource paths and raw GitHub URLs exactly match repository casing.

## Commit & Pull Request Guidelines

Recent history uses short imperative subjects, commonly `Update plugin-gui-agent`. Prefer `Add plugin-name`, `Update plugin-name`, or `Fix plugin-name: brief reason`; keep each commit focused. PRs should explain the user-visible change, identify affected clients, list manual verification steps, and link related issues. Include screenshots or recordings for UI changes, and update the relevant catalog entry whenever plugin metadata or versions change.
