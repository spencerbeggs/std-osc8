---
"std-osc8": minor
---

## Build System

Migrated `savvy.build.ts` to the new `@savvy-web/bundler` `build()` API, replacing the previous `defineBuild()` + `runBuild()` pair with a single call. Also added a targeted `ae-forgotten-export` suppression for the synthetic `_base` classes that Effect's `Context.Tag` generates internally — these cannot be exported or release-tagged from source, so API Extractor was flagging a pattern the toolchain itself produces.

## Documentation

Added `@public` release tags across the entire exported surface (`supportsHyperlinks`, `supportsHyperlinksStderr`, `osc8`, `supportsHyperlinksFor`, `link`, `openHyperlink`, `closeHyperlink`, and every exported type in `src/types.ts`). This clears all 14 outstanding `ae-*` / `tsdoc-*` API Extractor diagnostics and restores clean `.d.ts` rollup generation for consumers.

## Dependencies

| Dependency | Type | Action | From | To |
| :--- | :--- | :--- | :--- | :--- |
| @savvy-web/bundler | devDependency | updated | 1.0.1 | 1.1.1 |
| @savvy-web/silk | devDependency | updated | 1.3.6 | 1.3.7 |
| @vitest-agent/plugin | devDependency | updated | 1.1.2 | 1.1.4 |
| @types/node | devDependency | added | — | 26.0.1 |
| @typescript/native-preview | devDependency | added | — | 7.0.0-dev.20260630.1 |
| typescript | devDependency | added | — | 6.0.3 |
| @savvy-web/pnpm-plugin-silk | config | updated | 0.18.1 | 0.18.2 |
