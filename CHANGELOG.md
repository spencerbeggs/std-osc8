# std-osc8

## 0.2.0

### Documentation

* [`2598bfb`](https://github.com/spencerbeggs/std-osc8/commit/2598bfb57b1dcf0eb5e3e0c7b5fbec44395c5709) Added `@public` release tags across the entire exported surface (`supportsHyperlinks`, `supportsHyperlinksStderr`, `osc8`, `supportsHyperlinksFor`, `link`, `openHyperlink`, `closeHyperlink`, and every exported type in `src/types.ts`). This clears all 14 outstanding `ae-*` / `tsdoc-*` API Extractor diagnostics and restores clean `.d.ts` rollup generation for consumers.

### Build System

* [`2598bfb`](https://github.com/spencerbeggs/std-osc8/commit/2598bfb57b1dcf0eb5e3e0c7b5fbec44395c5709) Migrated `savvy.build.ts` to the new `@savvy-web/bundler` `build()` API, replacing the previous `defineBuild()` + `runBuild()` pair with a single call. Also added a targeted `ae-forgotten-export` suppression for the synthetic `_base` classes that Effect's `Context.Tag` generates internally — these cannot be exported or release-tagged from source, so API Extractor was flagging a pattern the toolchain itself produces.

### Dependencies

* [`2598bfb`](https://github.com/spencerbeggs/std-osc8/commit/2598bfb57b1dcf0eb5e3e0c7b5fbec44395c5709) | Dependency | Type | Action | From | To |
  \| :-------------------------- | :------------ | :------ | :----- | :------------------- |
  \| @savvy-web/bundler | devDependency | updated | 1.0.1 | 1.1.1 |
  \| @savvy-web/silk | devDependency | updated | 1.3.6 | 1.3.7 |
  \| @vitest-agent/plugin | devDependency | updated | 1.1.2 | 1.1.4 |
  \| @types/node | devDependency | added | — | 26.0.1 |
  \| @typescript/native-preview | devDependency | added | — | 7.0.0-dev.20260630.1 |
  \| typescript | devDependency | added | — | 6.0.3 |
  \| @savvy-web/pnpm-plugin-silk | config | updated | 0.18.1 | 0.18.2 |

## 0.1.0

### Features

* [`82a39bf`](https://github.com/spencerbeggs/pnpm-module-template/commit/82a39bfe12dd066f3062441cee1fa214a16b6094) ### Detection

- Detect OSC8 hyperlink support across 21 known terminal emulators with version-gated entries for iTerm2, VTE-based terminals, Konsole, VS Code, Hyper, mintty, and Alacritty.
- Honor `FORCE_HYPERLINK`, `NO_HYPERLINK`, and `NO_COLOR` overrides with a documented precedence ladder.
- Conservative wrapper handling for `tmux` and `screen`; users can opt in via `FORCE_HYPERLINK=1`.

### Public API

* Eager constants: `supportsHyperlinks`, `supportsHyperlinksStderr`, `osc8`.
* Function form: `supportsHyperlinksFor(stream | fd)`.
* Formatter helpers: `link()`, `openHyperlink()`, `closeHyperlink()`.
