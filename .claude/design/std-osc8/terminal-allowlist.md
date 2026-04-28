---
status: current
module: std-osc8
category: integration
created: 2026-04-28
updated: 2026-04-28
last-synced: 2026-04-28
completeness: 85
related:
  - architecture.md
  - detection-precedence.md
dependencies:
  - architecture.md
---

# std-osc8 - Terminal Allowlist

The hand-curated allowlist of terminal emulators that `std-osc8` recognizes,
its entry shape, sourcing strategy, and identification pattern.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [Implementation Details](#implementation-details)
5. [Testing Strategy](#testing-strategy)
6. [Future Enhancements](#future-enhancements)
7. [Related Documentation](#related-documentation)

---

## Overview

`std-osc8` recognizes terminals via a static allowlist defined in
`src/terminals.ts`. Each entry specifies how to identify the terminal from
`process.env`, whether it supports OSC8 at all, the minimum version that
supports OSC8 (if applicable), and the sub-feature capabilities to surface
on `Osc8Info.capabilities`.

When `lookupTerminal(env)` is called, it iterates the allowlist in array
order and returns the first entry whose `identify(env)` returns non-null.
The terminal-detection rule of the [precedence ladder][ladder] consumes
this match and produces one of three reasons: `terminal-known-supported`,
`terminal-known-unsupported`, or `terminal-known-too-old`.

[ladder]: ./detection-precedence.md

**Key Properties:**

- **Allowlist, not denylist.** Unknown terminals default to "off."
- **Source-attributed.** Each entry has a comment linking to its row in
  [Alhadis/OSC8-Adoption][adoption], the canonical community-maintained
  tracker.
- **Per-entry `identify()` function.** Each terminal can use whatever
  fingerprinting is most reliable for it (env-var presence, exact value
  match, packed-int parse, etc.).

[adoption]: https://github.com/Alhadis/OSC8-Adoption

**When to reference this document:**

- When adding a new terminal entry
- When updating `minVersion` after a release
- When a user reports "my terminal isn't detected"
- When auditing capabilities (`params`, `fileUrls`, `fileUrlsRemoteUnsafe`)

---

## Current State

### Entry Shape

```typescript
interface TerminalEntry {
  readonly name: KnownTerminal;            // canonical name (typed union)
  readonly identify: (env) => IdentifyResult | null;
  readonly supported: boolean;              // does it support OSC8 at all?
  readonly minVersion: string | null;       // null = any version, or n/a
  readonly capabilities: Osc8Capabilities;  // sub-feature flags
}

interface IdentifyResult {
  readonly version: string | null;          // detected version, if available
  readonly rawIdentifier: string;           // raw env value used (for debugging)
}
```

### The 21 Entries

Listed in match order (first match wins). Each row's "Identifier" column
shows the env vars consulted by its `identify()` function.

| # | Name | Identifier | Supported | minVersion | params | fileUrls | remote-unsafe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | iTerm.app | `TERM_PROGRAM=iTerm.app` | yes | 3.1.0 | yes | yes | no |
| 2 | Apple_Terminal | `TERM_PROGRAM=Apple_Terminal` | **no** | n/a | no | no | n/a |
| 3 | VTE | `VTE_VERSION` set (packed int) | yes | 0.50.0 | no | yes | no |
| 4 | Konsole | `KONSOLE_VERSION` set (packed int) | yes | 22.4.0 | yes | yes | no |
| 5 | WezTerm | `TERM_PROGRAM=WezTerm` | yes | any | yes | yes | no |
| 6 | kitty | `TERM=xterm-kitty` or `KITTY_WINDOW_ID` | yes | any | yes | yes | no |
| 7 | vscode | `TERM_PROGRAM=vscode` | yes | 1.71.0 | no | yes | **yes** |
| 8 | Hyper | `TERM_PROGRAM=Hyper` | yes | 3.0.0 | no | yes | no |
| 9 | mintty | `TERM_PROGRAM=mintty` | yes | 3.6.0 | yes | yes | no |
| 10 | WindowsTerminal | `WT_SESSION` set | yes | any | no | yes | no |
| 11 | Alacritty | `TERM=alacritty` | yes | any | no | yes | no |
| 12 | Ghostty | `TERM_PROGRAM=ghostty` | yes | any | yes | yes | no |
| 13 | JediTerm | `TERMINAL_EMULATOR=JetBrains-JediTerm` | yes | any | no | yes | no |
| 14 | Tabby | `TERM_PROGRAM=Tabby` | yes | any | yes | yes | no |
| 15 | Foot | `TERM=foot` or `TERM=foot-extra` | yes | any | yes | yes | no |
| 16 | Rio | `TERM_PROGRAM=rio` | yes | any | no | yes | no |
| 17 | Contour | `TERMINAL_NAME=contour` | yes | any | yes | yes | no |
| 18 | ConEmu | `ConEmuPID` set | yes | any | no | yes | no |
| 19 | WarpTerminal | `TERM_PROGRAM=WarpTerminal` | yes | any | no | yes | no |
| 20 | WaveTerminal | `TERM_PROGRAM=WaveTerminal` | yes | any | no | yes | no |
| 21 | Terminology | `TERMINOLOGY=1` | **no** | n/a | no | no | n/a |

### Identification Strategies

The 21 entries cluster into a few identification patterns:

- **`TERM_PROGRAM` exact match (12 entries):** iTerm, Apple Terminal, WezTerm,
  vscode, Hyper, mintty, Ghostty, Tabby, Rio, Warp, Wave. Versions read from
  `TERM_PROGRAM_VERSION`. Most consistent and modern pattern.
- **`TERM` exact match (3 entries):** kitty (`xterm-kitty`), Alacritty
  (`alacritty`), Foot (`foot` / `foot-extra`).
- **Dedicated env var presence (4 entries):** Windows Terminal (`WT_SESSION`),
  ConEmu (`ConEmuPID`), kitty (`KITTY_WINDOW_ID` as fallback), JediTerm
  (`TERMINAL_EMULATOR`).
- **Packed-int version env (2 entries):** VTE (`VTE_VERSION`),
  Konsole (`KONSOLE_VERSION`). Both encode `MAJOR*10000 + MINOR*100 + PATCH`
  and use the shared parser in `src/semver.ts`.
- **Boolean-style env (1 entry):** Terminology (`TERMINOLOGY=1`).

### Sub-Feature Capabilities

Three capability flags surface via `Osc8Info.capabilities`:

- **`params`** — Does the terminal honor OSC8 params (e.g., `id=`,
  `key=value`)? When false, `link()` drops `LinkOptions.params` rather than
  emitting them.
- **`fileUrls`** — Does the terminal render `file://` URLs? All allowlist
  `supported: true` entries set this to true currently.
- **`fileUrlsRemoteUnsafe`** — Does `file://` misbehave in remote/SSH
  sessions? Currently only `vscode` sets this (because the renderer-side path
  may not exist when VS Code's terminal is connected to a remote workspace).

For `supported: false` entries (Apple Terminal, Terminology) all three flags
are `false` (the shared `NO_CAPS` constant).

---

## Rationale

### Why allowlist instead of heuristics

A heuristic like "if `COLORTERM=truecolor` and `isStdoutTTY`, probably modern
OSC8-capable" sounds plausible but produces false positives in:

- SSH sessions where the local terminal forwards `COLORTERM` but the remote
  shell sees a dumber renderer
- CI loggers that present a TTY-shaped pipe
- Wrapper terminals (mosh, asciinema-rec) that pass through some env vars

The allowlist is **auditable**: every entry links to its source row in
[OSC8-Adoption][adoption], which itself cites the upstream commit/release
note where OSC8 support landed. Disagreements get resolved by linking to
upstream evidence.

### Why per-entry `identify()` functions

Different terminals expose themselves through different env vars, and even
within `TERM_PROGRAM` users there are oddities (`ghostty` is lowercase,
`Apple_Terminal` has an underscore, etc.). A table-driven approach with a
single matching strategy would either need every terminal to use the same
pattern (they don't) or grow special-case fields. A function per entry is
the simplest expression of "here is the unique fingerprint for this terminal."

### Why `minVersion` is permissive on parse failure

`compareSemver()` returns 0 on malformed input rather than throwing. If
`TERM_PROGRAM_VERSION` is set to something we can't parse, `match.identify.version`
becomes `null`, and the precedence ladder treats that as "version unknown"
→ `terminal-known-too-old` (off). This is conservative: we'd rather
fall back to plain text than emit hyperlinks to a terminal whose version
we couldn't verify.

### Why VTE and Konsole get packed-int parsers

`VTE_VERSION` is set by VTE-based terminals (GNOME Terminal, Tilix,
Terminator, Black Box, xfce4-terminal, etc.). VTE encodes versions as a
single integer: `MAJOR*10000 + MINOR*100 + PATCH`. So `5202` means version
`0.52.2`, and `7000` means `0.70.0`. Konsole uses the same scheme but with
calendar versioning — `220400` means version `22.4.0`.

`parseVteVersion()` and `parseKonsoleVersion()` (a re-export of the same
function) live in `src/semver.ts`. They translate the packed int to a
dot-separated string before `compareSemver()` consumes it.

### Why the order matters (and why iTerm is first)

The allowlist is iterated in array order. Earlier entries should be:

1. **More specific.** Apple Terminal sits at index 2 to ensure it matches
   before any catchall.
2. **More common.** Putting popular terminals (iTerm, VTE, Konsole) early
   reduces average lookup time, though the list is short enough that this
   is more aesthetic than performance-critical.

There are no ambiguous cases in the current list — every entry's identifier
is unique enough that order only matters as a tie-breaker, but the principle
is preserved for safety.

### Constraints and Trade-offs

- **No environment fingerprinting beyond what `process.env` exposes.** We
  cannot inspect `/proc/self/status`, parse `tput` capabilities, or query
  the terminal via DA1/DA2 sequences. All of those would require I/O or
  subprocess spawning, both [out of scope][oos].
- **Versions can lag reality.** When iTerm gains a new capability or VS Code
  changes its renderer behavior, the allowlist must be updated by hand.
  This is the cost of conservative allowlisting.

[oos]: ./out-of-scope.md

---

## Implementation Details

### Adding a New Terminal Entry

1. Verify support in [OSC8-Adoption][adoption]. Note the `minVersion`
   if provided.
2. Add the canonical name to the `KnownTerminal` union in `src/types.ts`.
3. Add the entry to the `TERMINALS` array in `src/terminals.ts`. Match the
   shape of similar entries:

   ```typescript
   {
     // {Terminal} — supported since {version}.
     // Source: https://github.com/Alhadis/OSC8-Adoption ({Terminal} row)
     name: "MyTerm",
     identify: (env) =>
       env.TERM_PROGRAM === "MyTerm"
         ? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
         : null,
     supported: true,
     minVersion: "1.0.0",
     capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
   },
   ```

4. Add a unit test in `__test__/terminals.test.ts` that constructs a minimal
   env snapshot and asserts `lookupTerminal()` returns the new entry.
5. Optionally add an integration test in `__test__/detect.test.ts` covering
   the end-to-end "this terminal env produces this `Osc8Reason`" case.

### Code Reference

- **Allowlist data:** `src/terminals.ts` lines 44-300
- **`lookupTerminal()`:** `src/terminals.ts` lines 305-311
- **Version parsers:** `src/semver.ts`
- **`KnownTerminal` union:** `src/types.ts` lines 6-27

### `KnownTerminal` Union

The 21 entries' `name` fields form a tight string-literal union exported
publicly as `KnownTerminal`:

```typescript
type KnownTerminal =
  | "iTerm.app" | "WezTerm" | "kitty" | "Apple_Terminal"
  | "vscode" | "Hyper" | "mintty" | "WindowsTerminal"
  | "Konsole" | "VTE" | "Alacritty" | "Ghostty"
  | "JediTerm" | "Tabby" | "Foot" | "Rio"
  | "Contour" | "ConEmu" | "WarpTerminal" | "WaveTerminal"
  | "Terminology";
```

This keeps `osc8.terminal === "iTerm.app"` autocomplete-friendly and
exhaustively-matchable in switch statements. **When adding a new entry,
update this union.**

### `NO_CAPS` Sharing

`NO_CAPS` is a frozen-style `Osc8Capabilities` with all flags `false`.
It's defined twice (once in `src/terminals.ts`, once in `src/detect.ts`)
because each module needs its own const for tree-shaking purposes. The
`terminals.ts` copy is exported for tests.

---

## Testing Strategy

### Unit Tests

**Location:** `__test__/terminals.test.ts`

**What to test (per entry):**

- Positive identification with the canonical env signature returns a non-null
  match.
- Negative identification with a near-miss env (wrong value, wrong case)
  returns null.
- Version parsing from `TERM_PROGRAM_VERSION` (or the relevant version env)
  produces the expected string.
- For VTE/Konsole: packed-int decoding produces the expected
  `MAJOR.MINOR.PATCH` string.

**What to test (overall):**

- `lookupTerminal()` returns the first matching entry when multiple env
  vars are set (should not happen in practice, but the order contract is
  worth pinning).
- Empty env returns null.

### Integration Tests via `detect.test.ts`

- iTerm at minVersion 3.1.0 → `terminal-known-supported`.
- iTerm at 3.0.0 → `terminal-known-too-old`.
- iTerm with garbage `TERM_PROGRAM_VERSION` → version is null →
  `terminal-known-too-old`.
- Apple Terminal → `terminal-known-unsupported`.
- VTE_VERSION="5000" (= 0.50.0) → `terminal-known-supported`.
- VTE_VERSION="4900" (= 0.49.0) → `terminal-known-too-old`.
- Unknown env → `terminal-unknown`.

---

## Future Enhancements

### Phase 1: Short-term

- **Audit allowlist against OSC8-Adoption.** Schedule a quarterly review
  to add new terminals (e.g., Tess, Bobcat, BlackBox) and bump
  `minVersion` where upstream has clarified support windows.
- **Add a "test-fixtures" helper** that constructs canonical snapshots for
  each allowlist entry, so consumers and downstream tests can exercise
  detection without copying env signatures.

### Phase 2: Medium-term

- **Capability discovery beyond `params` / `fileUrls`.** Some terminals
  (kitty, Ghostty) support extra OSC8 schemes (`ssh://`, custom). When
  consumers ask, surface them via new `Osc8Capabilities` flags.
- **`identify()` returning version source.** Currently we return the parsed
  version; we could also return which env var produced it (useful when a
  terminal sets multiple version vars).

### Phase 3: Long-term

- **Generated allowlist from OSC8-Adoption.** Treat
  `Alhadis/OSC8-Adoption` as a structured data source and generate
  `terminals.ts` mechanically. Makes drift between us and upstream visible
  in CI.

### Potential Refactoring

- **Extract `TERM_PROGRAM` builder.** A dozen entries follow the
  `TERM_PROGRAM === "X"` pattern verbatim. A `byTermProgram(name, opts)`
  helper would shrink that boilerplate, at the cost of slightly less
  per-entry transparency.

---

## Related Documentation

**Internal Design Docs:**

- [Architecture](./architecture.md) — how the allowlist plugs into the
  three-layer module structure
- [Detection Precedence](./detection-precedence.md) — where rule 6
  consults the allowlist

**Source Files:**

- `src/terminals.ts` — allowlist data + `lookupTerminal()`
- `src/semver.ts` — version comparison + packed-int parsers
- `src/types.ts` — `KnownTerminal`, `Osc8Capabilities` types

**External Resources:**

- [Alhadis/OSC8-Adoption][adoption] — Canonical community OSC8 support tracker
- [VTE versioning][vte] — Packed-int version encoding
- [Konsole release notes][konsole] — Calendar-versioning packed integers

[vte]: https://gitlab.gnome.org/GNOME/vte
[konsole]: https://invent.kde.org/utilities/konsole

---

**Document Status:** current — captures the 21 entries and identification
strategies as implemented in `src/terminals.ts`.
