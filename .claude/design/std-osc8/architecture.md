---
status: current
module: std-osc8
category: architecture
created: 2026-04-28
updated: 2026-04-28
last-synced: 2026-04-28
completeness: 85
related:
  - detection-precedence.md
  - terminal-allowlist.md
  - out-of-scope.md
dependencies: []
---

# std-osc8 - Architecture

A focused, synchronous, ESM-only complement to `unjs/std-env` that detects
OSC8 terminal hyperlink support from environment variables and TTY flags.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [System Architecture](#system-architecture)
5. [Data Flow](#data-flow)
6. [Integration Points](#integration-points)
7. [Testing Strategy](#testing-strategy)
8. [Future Enhancements](#future-enhancements)
9. [Related Documentation](#related-documentation)

---

## Overview

`std-osc8` answers a single question: "should I emit an OSC8 hyperlink to
this stream?" It is intentionally narrow — it does not detect color, unicode,
or other TTY features (use `std-env` for those). Detection is purely
synchronous and reads only `process.env` plus `process.stdout.isTTY` /
`process.stderr.isTTY`. No subprocesses are spawned. This keeps the package
edge-runtime safe, cheap to import, and trivially mockable in tests.

The package exposes a **3-tier public API** so consumers can pick the
ergonomics they want without paying for what they don't need:

1. **Eager constants** — `supportsHyperlinks`, `supportsHyperlinksStderr`,
   `osc8` — computed once at module import. Zero-overhead "is it on?" checks.
2. **Function form** — `supportsHyperlinksFor(streamOrFd)` — re-runs detection
   against a specific stream's TTY state, reusing the import-time env snapshot.
3. **Diagnostic record** — `Osc8Info` (the `osc8` constant and the return
   shape of the internal `detect()`) — full structured reasoning: terminal
   name + version, wrapper, capabilities, override, and the
   `Osc8Reason` discriminator.

On top of detection, the package provides **formatter helpers** — `link()`
for one-shot formatting with configurable fallback, and the low-level
`openHyperlink()` / `closeHyperlink()` for streaming output.

**Key Design Principles:**

- **Synchronous and pure.** `detect(snapshot)` is a pure function. The eager
  constants are simply `detect(readProcessSnapshot())` evaluated once.
- **No subprocess spawning.** All signals come from env vars. This keeps us
  edge-runtime compatible and predictable; users who know better can override
  via `FORCE_HYPERLINK`.
- **Conservative defaults.** When in doubt (unknown terminal, inside a
  multiplexer, version unknown but minimum required), we say "off." This
  prefers ugly fallback rendering over corrupt output.
- **Allowlist over heuristics.** We identify terminals by env-var fingerprints
  curated from [OSC8-Adoption][adoption]. Unknown terminals get "off" rather
  than guessing.

**When to reference this document:**

- When adding a new public export or changing the surface area
- When reasoning about which API tier a caller should use
- When integrating `std-osc8` into a larger logging/CLI tool
- When changing the snapshot model or the eager-vs-lazy boundary

[adoption]: https://github.com/Alhadis/OSC8-Adoption

---

## Current State

### Module Layout

```text
src/
├── index.ts          # public barrel — re-exports the surface
├── types.ts          # public types (Osc8Info, KnownTerminal, etc.)
│
├── env.ts            # envIsTruthy() — default + no-color semantics
├── semver.ts         # compareSemver, parseVteVersion, parseKonsoleVersion
├── wrappers.ts       # detectWrapper() for TMUX/STY
├── terminals.ts      # TerminalEntry shape + 21-entry allowlist
│
├── detect.ts         # detect(snapshot): Osc8Info — the heart
├── snapshot.ts       # readProcessSnapshot()
│
├── constants.ts      # eager constants + supportsHyperlinksFor()
└── link.ts           # link(), openHyperlink(), closeHyperlink()
```

Three logical layers, top-to-bottom:

1. **Primitives** — `env.ts`, `semver.ts`, `wrappers.ts`, `terminals.ts`.
   Pure helpers and data tables, no I/O.
2. **Pure detection** — `detect.ts` consumes a `ProcessSnapshot` and emits an
   `Osc8Info`. `snapshot.ts` is the only module that touches `process`
   directly.
3. **Surface** — `constants.ts` materializes the eager values; `link.ts`
   builds the formatter helpers on top of detection.

### Public API

The `index.ts` barrel re-exports exactly:

**Detection:**

- `osc8: Osc8Info` — eager diagnostic record
- `supportsHyperlinks: boolean` — eager stdout verdict
- `supportsHyperlinksStderr: boolean` — eager stderr verdict
- `supportsHyperlinksFor(target): boolean` — per-stream/fd function form

**Formatters:**

- `link(label, url, options?): string` — labeled hyperlink with fallback
- `openHyperlink(url, params?): string` — OSC8 open sequence
- `closeHyperlink(): string` — OSC8 close sequence

**Types:**

- `Osc8Info`, `Osc8Capabilities`, `Osc8Reason`, `Osc8Params`,
  `KnownTerminal`, `WrapperInfo`, `LinkOptions`

### Current Metrics/Status

- 21 terminal allowlist entries (`src/terminals.ts`)
- 8-value `Osc8Reason` discriminator
- Pure detection: zero side effects in `detect()`
- ESM-only (`"type": "module"`); `.js` extensions on relative imports
- Node 24+ runtime (per `devEngines.runtime`)

---

## Rationale

### Why a 3-tier API

The detection ladder produces a rich result, but most callers only want a
boolean. Forcing every caller through the full info object hurts ergonomics;
forcing every caller into a function call hurts hot paths. The three tiers
solve different problems:

#### Decision 1: Eager constants for the 95% case

- **Context:** Most callers ask once at startup: "are hyperlinks supported?"
- **Options considered:**
  1. **Eager constants (chosen).** `supportsHyperlinks` is `boolean`, evaluated
     at import. Tree-shakable; tiny.
  2. Lazy getters. Defers detection until first read. Adds complexity for no
     measurable gain — env vars are read at import time anyway.
  3. Function-only API. Requires every caller to call `supports()`. Awkward
     for guard clauses (`if (supportsHyperlinks)`).
- **Decision:** Eager constants computed once at import via
  `detect(readProcessSnapshot())`.

#### Decision 2: Function form for per-stream detection

- **Context:** Loggers may write to stdout, stderr, or arbitrary fds. Their
  TTY-ness can differ from each other and from the eager snapshot.
- **Solution:** `supportsHyperlinksFor(target)` accepts either a
  WriteStream-like (anything with `.isTTY`) or a numeric fd. Fd 1/2 reuse the
  cached `isStdoutTTY`/`isStderrTTY`; other fds go through `node:tty.isatty()`.
  The env snapshot is reused — only the TTY flag varies between calls.
- **Trade-off:** Reusing the import-time env snapshot means changing
  `process.env` after import won't re-trigger detection. This is intentional;
  callers who need that should call `detect()` themselves (it's not exported
  but trivial to reproduce). See "Future Enhancements" for re-export rationale.

#### Decision 3: Diagnostic record (`Osc8Info`) as the underlying shape

- **Context:** Power users (CLI debug commands, "why didn't my link render?"
  bug reports) need the full reasoning, not just a yes/no.
- **Decision:** Make `Osc8Info` the canonical detection result. The boolean
  exports are projections of `osc8.supported` / `osc8.supportedForStderr`.
  `osc8.reason` is a discriminated union (`Osc8Reason`) so consumers can
  branch on it without parsing strings.

### Why synchronous, no subprocess spawning

See [out-of-scope.md](./out-of-scope.md) for the full rationale. In short:
spawning `tmux -V` to verify passthrough config would (a) make detection
async, (b) break edge-runtime compatibility, and (c) add a ~10-50ms startup
hit. Users who know their tmux is configured can opt back in via
`FORCE_HYPERLINK=1`.

### Why allowlist instead of heuristics

See [terminal-allowlist.md](./terminal-allowlist.md). Heuristics like "if
`COLORTERM=truecolor` is set, probably modern" produce false positives in
nested SSH sessions and CI loggers. An explicit allowlist sourced from
[OSC8-Adoption][adoption] is auditable and conservative.

### Constraints and Trade-offs

- **No async path.** Locks us out of any signal that requires I/O. Acceptable
  because no env-var fingerprinting needs I/O, and if it ever does we can
  add an async sibling without breaking the sync path.
- **Snapshot is import-time-only by default.** Callers who change `process.env`
  after import won't see updated results from the eager constants. This is
  documented behavior; the function form `supportsHyperlinksFor()` re-reads
  TTY state but reuses env. A future amendment could expose `detect()` /
  `readProcessSnapshot()` for callers that need full re-evaluation.
- **`link()` capability gate carve-out.** Originally `link()` always gated
  `params` on `osc8.capabilities.params`. Post-implementation amendment: when
  `options.enabled === true`, we trust the caller fully and emit `params`
  unconditionally. This lets test rigs and forced-on environments exercise
  param emission. See `src/link.ts` line 66.

---

## System Architecture

### Layered Architecture

#### Layer 1: Primitives (no I/O)

**Components:** `env.ts`, `semver.ts`, `wrappers.ts`, `terminals.ts`

**Responsibilities:**

- `env.ts` — `envIsTruthy(value, spec)` with `"default"` (truthy unless
  empty/`0`/`false`/`off`/`no`) and `"no-color"` (truthy if non-empty, per
  [no-color.org][nocolor]) semantics.
- `semver.ts` — Permissive semver compare; encoded-int parsers for
  `VTE_VERSION` and `KONSOLE_VERSION` (both packed as
  `MAJOR*10000 + MINOR*100 + PATCH`).
- `wrappers.ts` — `detectWrapper(env)` returns a `WrapperInfo` for `TMUX`
  or `STY`, with `passesThrough: false` always (we cannot verify config
  without spawning).
- `terminals.ts` — `TerminalEntry[]` allowlist + `lookupTerminal(env)`.

**Communication:** All exports are pure functions. No layer above mutates
these; no layer below depends on them.

[nocolor]: https://no-color.org

#### Layer 2: Pure detection

**Components:** `detect.ts`, `snapshot.ts`

**Responsibilities:**

- `snapshot.ts` — `readProcessSnapshot()` is the one place `process` is read.
  Returns `{ env, isStdoutTTY, isStderrTTY }`.
- `detect.ts` — `detect(snap)` runs the [precedence ladder][ladder] over the
  snapshot and produces a fully-populated `Osc8Info`.

**Communication:** `detect()` consumes Layer 1 helpers and the snapshot;
emits a value object.

[ladder]: ./detection-precedence.md

#### Layer 3: Public surface

**Components:** `constants.ts`, `link.ts`, `index.ts`

**Responsibilities:**

- `constants.ts` — Calls `readProcessSnapshot()` and `detect()` once at
  module-load time. Exposes `osc8`, `supportsHyperlinks`,
  `supportsHyperlinksStderr`, and `supportsHyperlinksFor()`.
- `link.ts` — Builds OSC8 sequences. `link()` uses `supportsHyperlinksFor()`
  to decide whether to emit, with configurable fallback rendering.
- `index.ts` — Public barrel.

### Component Interactions

#### Interaction 1: Eager initialization

```text
import std-osc8       constants.ts          snapshot.ts        detect.ts
       │                  │                     │                  │
       ├─────────────────>│ (module load)       │                  │
       │                  ├────────────────────>│ readProcessSnapshot()
       │                  │<────────────────────┤ {env, isStdoutTTY, ...}
       │                  ├──────────────────────────────────────>│ detect(snap)
       │                  │<──────────────────────────────────────┤ Osc8Info
       │                  │ (constants frozen)  │                  │
       │<─────────────────┤                     │                  │
```

Module load is the only place this path runs. The resulting `Osc8Info` is
captured into `osc8` and projected to the boolean exports.

#### Interaction 2: Per-stream check

```text
caller                supportsHyperlinksFor()    detect.ts
  │                            │                     │
  ├──{ stream | fd }──────────>│                     │
  │                            │ resolve isTTY:      │
  │                            │  - fd === 1 → cached│
  │                            │  - fd === 2 → cached│
  │                            │  - other fd → isatty()
  │                            │  - stream.isTTY     │
  │                            ├────────────────────>│ detect({ env: cached, isStdoutTTY: isTTY, isStderrTTY: isTTY })
  │<───── boolean ─────────────┤<────────────────────┤
```

The env snapshot is reused (cheap, deterministic). Only `isTTY` varies.

#### Interaction 3: Formatter

`link(label, url, opts)` calls `supportsHyperlinksFor(opts?.target ?? process.stdout)`
when `opts.enabled` is not provided. If unsupported, it picks a fallback
rendering (`with-url` default, or `label-only` / `url-only` / custom function).
If supported, it serializes params (validating against `;`, `:`, control
chars) and emits the OSC8 open + label + close sequence.

### Error Handling Strategy

- **Detection never throws.** A malformed env var produces a falsy reading or
  a `null` parsed version, never an exception. Worst case is `terminal-unknown`.
- **`openHyperlink()` and `link()` throw `TypeError`** on invalid param values
  (containing `;`, `:`, or control chars 0x00-0x1F or 0x7F). Validation runs
  even when the terminal lacks support, so callers get consistent feedback
  regardless of detection state.

---

## Data Flow

### Data Model

**`ProcessSnapshot` (internal):**

```typescript
interface ProcessSnapshot {
  readonly env: NodeJS.ProcessEnv;
  readonly isStdoutTTY: boolean;
  readonly isStderrTTY: boolean;
}
```

**`Osc8Info` (public, full diagnostic record):**

```typescript
interface Osc8Info {
  readonly supported: boolean;            // stdout verdict
  readonly supportedForStderr: boolean;   // stderr verdict
  readonly reason: Osc8Reason;            // discriminator
  readonly explanation: string;           // human-readable
  readonly terminal: KnownTerminal | null;
  readonly terminalRaw: string | null;    // raw env value used to identify
  readonly terminalVersion: string | null;
  readonly wrapper: WrapperInfo | null;
  readonly isStdoutTTY: boolean;
  readonly isStderrTTY: boolean;
  readonly override: "force-hyperlink" | "no-hyperlink" | "no-color" | null;
  readonly capabilities: Osc8Capabilities;
}
```

`Osc8Capabilities` carries sub-feature flags (`params`, `fileUrls`,
`fileUrlsRemoteUnsafe`) — set from the matched terminal entry when supported,
all-false otherwise.

### Data Flow Diagram

```text
process.env, isTTY flags
         │
         ▼
   ┌─────────────────┐
   │  snapshot.ts    │   readProcessSnapshot()
   └────────┬────────┘
            │ ProcessSnapshot
            ▼
   ┌─────────────────┐    consumes:
   │   detect.ts     │ ◄── env.ts (envIsTruthy)
   │   detect()      │ ◄── wrappers.ts (detectWrapper)
   │                 │ ◄── terminals.ts (lookupTerminal)
   │                 │ ◄── semver.ts (compareSemver)
   └────────┬────────┘
            │ Osc8Info
            ▼
   ┌──────────────────────┐
   │   constants.ts       │  osc8, supportsHyperlinks,
   │                      │  supportsHyperlinksStderr,
   │                      │  supportsHyperlinksFor()
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │   link.ts            │  link(), openHyperlink(),
   │                      │  closeHyperlink()
   └──────────────────────┘
```

### State Management

- **No mutable state at runtime.** The eager `osc8` constant, the cached
  snapshot in `constants.ts`, and the allowlist array in `terminals.ts` are
  all frozen-by-convention values created once at import.
- **The eager snapshot persists for the process lifetime.** This is
  intentional — env vars rarely change mid-process, and re-reading on every
  call would defeat the eagerness optimization.

---

## Integration Points

### Internal Integrations

`std-osc8` has no internal cross-package dependencies. It is a leaf module.

### External Integrations

- **`unjs/std-env`** — `std-osc8` is positioned as a complement, not a
  replacement. Consumers typically use `std-env` for general TTY/runtime
  detection and `std-osc8` for the OSC8-specific question.
- **Node.js `node:tty`** — Used in `supportsHyperlinksFor()` to call
  `isatty(fd)` for arbitrary numeric fds (not 1 or 2).
- **`process` global** — Read once, in `readProcessSnapshot()`. No other
  module touches `process` directly.

### Override Env Vars (consumer-facing contract)

- `FORCE_HYPERLINK=1` — force "on" (highest precedence).
- `NO_HYPERLINK=1` — force "off."
- `NO_COLOR=` (any non-empty value) — force "off" per no-color.org spec.

These are documented in [detection-precedence.md][ladder].

---

## Testing Strategy

### Unit Tests

**Location:** `__test__/*.test.ts` (per project convention; never co-located
in `src/`).

**Files:**

- `__test__/env.test.ts` — `envIsTruthy()` truthy semantics
- `__test__/semver.test.ts` — `compareSemver`, `parseVteVersion`,
  `parseKonsoleVersion`
- `__test__/wrappers.test.ts` — `detectWrapper()` for `TMUX`/`STY`
- `__test__/terminals.test.ts` — allowlist `identify()` for each entry
- `__test__/detect.test.ts` — full precedence ladder (the heart of the suite)
- `__test__/snapshot.test.ts` — `readProcessSnapshot()`
- `__test__/constants.test.ts` — eager values + `supportsHyperlinksFor()`
- `__test__/link.test.ts` — `link()` fallback + capability-gate carve-out
- `__test__/open-close.test.ts` — `openHyperlink` / `closeHyperlink` sequences

**What to test:**

- Each precedence rule fires in isolation (env-by-env construction)
- Each terminal entry matches its identifier and parses its version
- Override interactions (`FORCE_HYPERLINK` beats not-a-tty, etc.)
- `link()` `params` emission with `enabled: true` bypassing the capability
  gate (post-implementation amendment)
- `link()` invalid-param TypeError thrown even when fallback path is taken

### Integration Tests

`__test__/integration/*.int.test.ts` exists per project convention but no
integration scenarios beyond the unit suite are required for a leaf utility.

### E2e Tests

`__test__/e2e/*.e2e.test.ts` reserved for future end-to-end checks (e.g.,
spawning a real terminal and asserting the rendered escape sequences).

---

## Future Enhancements

### Phase 1: Short-term

- **Re-export `detect()` and `readProcessSnapshot()`.** Currently internal.
  Exposing them lets callers re-evaluate against a custom snapshot (e.g.,
  to simulate a different terminal in tests).
- **Add a small `__test__/fixtures/` of canned env snapshots** for the major
  terminals so consumers can copy-paste them.

### Phase 2: Medium-term

- **Audit terminal allowlist against latest [OSC8-Adoption][adoption] data**
  on a recurring schedule. Add new entries, bump `minVersion` where upstream
  has clarified support windows.
- **Optional `tmuxPassthrough?: boolean` LinkOption** to let the caller
  declare "I know my tmux passes through" without resorting to
  `FORCE_HYPERLINK` (which is a process-wide override).

### Phase 3: Long-term

- **Companion `effect-std-osc8` package.** An `Effect`-based wrapper was
  prototyped and removed (see [out-of-scope.md](./out-of-scope.md)). If
  reintroduced, it lives in a separate package, not as a sub-export.
- **`type=ttf` / `type=ssh` schemes** — Investigate non-`http(s)://` schemes
  some terminals support and surface them via `Osc8Capabilities`.

### Potential Refactoring

- The stderr branch in `detect()` duplicates the support gate logic. If a
  third stream type ever appears, factor it into a single
  `evalForTTY(isTTY, env, wrapper, match)` helper.

---

## Related Documentation

**Internal Design Docs:**

- [Detection Precedence](./detection-precedence.md) — the 7-rule ladder
- [Terminal Allowlist](./terminal-allowlist.md) — entry shape, sourcing,
  identification strategy
- [Out of Scope](./out-of-scope.md) — explicit non-goals and removed features

**Source Files:**

- `src/index.ts` — public barrel
- `src/types.ts` — public types
- `src/detect.ts` — `detect(snapshot): Osc8Info`
- `src/constants.ts` — eager constants + `supportsHyperlinksFor()`
- `src/link.ts` — `link()`, `openHyperlink()`, `closeHyperlink()`

**External Resources:**

- [OSC8-Adoption tracker][adoption] — Source of truth for the allowlist
- [No-Color spec][nocolor] — `NO_COLOR` env-var semantics
- [VS Code OSC8 release notes][vscode-osc8] — `vscode` minimum-version basis
- [unjs/std-env][std-env] — Sister package for general env detection

[vscode-osc8]: https://code.visualstudio.com/updates/v1_71#_terminal-link-from-process-output
[std-env]: https://github.com/unjs/std-env

---

**Document Status:** current — captured immediately after implementation
landed on the `feat/implementation` branch. Source of truth going forward.
