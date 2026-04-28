---
status: current
module: std-osc8
category: architecture
created: 2026-04-28
updated: 2026-04-28
last-synced: 2026-04-28
completeness: 90
related:
  - architecture.md
  - terminal-allowlist.md
dependencies:
  - architecture.md
---

# std-osc8 - Detection Precedence Ladder

The seven-rule ladder that `detect()` walks to produce a verdict, in priority
order.

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

The detection algorithm in `src/detect.ts` is a strictly-ordered chain of
seven rules. The **first matching rule wins** and the remaining rules are
skipped. The ordering encodes a deliberate priority:

1. Explicit user overrides come first (`FORCE_HYPERLINK`, `NO_HYPERLINK`,
   `NO_COLOR`).
2. Hard environmental disqualifications next (not a TTY, multiplexer wrapper).
3. Terminal-specific allowlist matching last.
4. Default to "off" if no rule produced a positive verdict.

This document describes each rule, why it sits where it does, and the
discriminator value (`Osc8Reason`) it produces.

**Key Properties:**

- **Deterministic.** Same `ProcessSnapshot` always yields the same `Osc8Info`.
- **Conservative on uncertainty.** Unknown terminal, unknown version,
  multiplexer with unverifiable passthrough — all "off."
- **Override-friendly.** Anyone who knows better can lift any disqualification
  with `FORCE_HYPERLINK=1`.

**When to reference this document:**

- When changing the order of rules or adding a new one
- When debugging a "why did detection say X?" report
- When writing a new test case for `detect.test.ts`

---

## Current State

### The Seven Rules (in order)

| # | Rule | Reason value | Verdict |
| --- | --- | --- | --- |
| 1 | `FORCE_HYPERLINK` truthy | `force-env` | **on** (override) |
| 2 | `NO_HYPERLINK` truthy | `no-hyperlink-env` | off (override) |
| 3 | `NO_COLOR` non-empty | `no-color-env` | off (override) |
| 4 | stream is not a TTY | `not-a-tty` | off |
| 5 | wrapper detected (`TMUX`/`STY`) | `wrapper-strips` | off |
| 6a | terminal in allowlist, supported, version OK | `terminal-known-supported` | **on** |
| 6b | terminal in allowlist, marked unsupported | `terminal-known-unsupported` | off |
| 6c | terminal in allowlist, version below `minVersion` | `terminal-known-too-old` | off |
| 7 | nothing matched | `terminal-unknown` | off |

### Truthy Semantics

The `envIsTruthy(value, spec)` helper applies different rules per env var:

- **Default spec** (used by `FORCE_HYPERLINK`, `NO_HYPERLINK`):
  - `undefined`, empty string, `"0"`, `"false"`, `"off"`, `"no"` → false
  - Anything else (including `"1"`, `"true"`, `"yes"`, `"on"`, `"x"`) → true
  - Case-insensitive
- **No-color spec** (used by `NO_COLOR`):
  - `undefined`, empty string → false
  - Any non-empty value (including `"0"`) → true
  - Per [no-color.org][nocolor]

[nocolor]: https://no-color.org

### Stderr Variant

`detect()` returns both `supported` (stdout) and `supportedForStderr`. The
stderr verdict re-runs the same gate logic with `isStdoutTTY` swapped for
`isStderrTTY`. All other inputs (env, wrapper, allowlist match) are shared.
Overrides therefore apply to both streams uniformly.

---

## Rationale

### Why overrides come first

Overrides are explicit user intent. If a developer sets `FORCE_HYPERLINK=1`,
they are saying "I know my terminal better than this library does." Even if
`isStdoutTTY` is false (e.g., stdout is piped to a file), we honor the force.
The same logic applies in reverse for `NO_HYPERLINK` — if the user has opted
out, no terminal allowlist match should override that.

#### Decision: Three override env vars, in this order

- **Context:** `NO_COLOR` is widely deployed and disables ANSI in many
  libraries; reusing it gives `std-osc8` instant compatibility with the
  no-color ecosystem. But some users may want hyperlinks while disabling
  color, so `NO_HYPERLINK` is also supported. And `FORCE_HYPERLINK` is the
  ultimate escape hatch.
- **Options considered:**
  1. **Three vars, force > disable > no-color (chosen).** Lets users layer:
     `NO_COLOR=1 FORCE_HYPERLINK=1` means "color off, hyperlinks on."
  2. Single `OSC8` var. Simpler but doesn't compose with `NO_COLOR`.
  3. No `NO_COLOR` honoring. Surprises users who expect their no-color env
     to suppress hyperlinks too.
- **Decision:** All three, with `FORCE` first so it can override `NO_COLOR`.

### Why "not a TTY" beats the allowlist

If stdout isn't a TTY, the bytes go somewhere that probably can't render
escape sequences (a file, a pipe, a network socket). Even if the env says
we're inside iTerm, the immediate consumer of our output isn't iTerm — it's
`grep` or `tee` or wherever the pipe goes. We say "off" unless `FORCE` is
set (which is rule 1).

### Why wrappers default to "off"

A `TMUX` or `STY` env var means we're inside `tmux` or `screen`. Both
multiplexers have configuration knobs that determine whether OSC8 sequences
pass through to the outer terminal:

- **tmux** ≥ 3.4 supports `set -g allow-passthrough on`.
- **screen** has limited and historically buggy passthrough.

We **cannot verify** the configuration without spawning `tmux -V` /
parsing config files, which is [out of scope][oos]. Without verification,
the only safe default is "off" — emitting a hyperlink that gets stripped
or mangled is worse than emitting plain text. Users who know their multiplexer
is configured correctly use `FORCE_HYPERLINK=1`.

[oos]: ./out-of-scope.md

### Why the allowlist is last

The allowlist is the most informative signal but also the most brittle —
it depends on the env-var fingerprint matching exactly. Putting it last
means the simpler, faster checks (override + TTY + wrapper) short-circuit
common cases. The allowlist is only consulted when none of those short-circuit.

### Why "unknown terminal" defaults to "off"

The alternative — "if `isStdoutTTY` is true and no override or wrapper, say
on" — would produce false positives in CI loggers, embedded terminals, and
ancient terminals that ignore OSC8 silently. An incorrect "on" verdict
produces visible corruption (`]8;;<url>` literal text in the output); an
incorrect "off" verdict produces a slightly-uglier-but-correct fallback.
Asymmetric cost favors "off" by default.

### Constraints and Trade-offs

- **`FORCE_HYPERLINK` is process-wide.** A library author wanting per-call
  override uses `LinkOptions.enabled` on `link()`. The env var is for end
  users.
- **The same wrapper rule applies to both stdout and stderr.** No per-stream
  wrapper detection — wrappers wrap the whole process.

---

## Implementation Details

### Code Reference

The ladder is implemented in `src/detect.ts`, lines 57-114. The structure is
an explicit `if`/`else if` chain rather than a table-driven loop for two
reasons:

1. **Reason variable assignment.** Each branch assigns `supported`, `reason`,
   `override`, and (sometimes) `capabilities`. A loop would obscure the
   per-branch capability handling.
2. **Stderr re-run.** The `stderrSupported` IIFE (lines 119-133) duplicates
   the gate logic with `isStderrTTY`. Keeping the original chain explicit
   makes the symmetry visible.

### Key Code Excerpt

```typescript
// src/detect.ts (essence)
if (force) {
  supported = true; reason = "force-env"; override = "force-hyperlink";
  if (match?.entry.supported) capabilities = match.entry.capabilities;
} else if (noHyperlink) {
  supported = false; reason = "no-hyperlink-env"; override = "no-hyperlink";
} else if (noColor) {
  supported = false; reason = "no-color-env"; override = "no-color";
} else if (!isStdoutTTY) {
  supported = false; reason = "not-a-tty";
} else if (wrapper) {
  supported = false; reason = "wrapper-strips";
} else if (match) {
  if (!match.entry.supported) {
    supported = false; reason = "terminal-known-unsupported";
  } else if (
    match.entry.minVersion &&
    (match.identify.version === null
      || compareSemver(match.identify.version, match.entry.minVersion) < 0)
  ) {
    supported = false; reason = "terminal-known-too-old";
  } else {
    supported = true; reason = "terminal-known-supported";
    capabilities = match.entry.capabilities;
  }
} else {
  supported = false; reason = "terminal-unknown";
}
```

### Capability surfacing under FORCE

When `FORCE_HYPERLINK` wins, `capabilities` is filled from the matched
terminal entry **only if** the terminal was found and is marked `supported`
in the allowlist. Otherwise capabilities stay `NO_CAPS` (all-false). This
means:

- iTerm + `FORCE` → capabilities reflect iTerm's true capabilities
  (`params: true`, etc.).
- Apple Terminal (allowlist `supported: false`) + `FORCE` → capabilities are
  `NO_CAPS` because we don't actually know what Apple Terminal would do.
- Unknown terminal + `FORCE` → capabilities are `NO_CAPS`.

This carve-out is useful for `link()`: when `osc8.capabilities.params` is
true, it serializes `id=` etc.; when false, it drops them. Forcing on an
unknown terminal won't accidentally emit `params` the terminal can't parse.

### Override Field

`Osc8Info.override` is `"force-hyperlink"`, `"no-hyperlink"`, `"no-color"`,
or `null`. It is non-null exactly when one of rules 1-3 fired. Useful for
diagnostic UIs: "OSC8 is on because FORCE_HYPERLINK is set."

---

## Testing Strategy

### Unit Tests

**Location:** `__test__/detect.test.ts`

**Coverage:** Every rule has at least one positive test. Common combinations
(force overrides not-a-tty, no-color disables wrapper-allowed terminal, etc.)
have additional cases.

**Construction pattern:** Each test builds a minimal `ProcessSnapshot`
inline:

```typescript
const snap = {
  env: { FORCE_HYPERLINK: "1" },
  isStdoutTTY: false,
  isStderrTTY: false,
};
const info = detect(snap);
expect(info.reason).toBe("force-env");
expect(info.supported).toBe(true);
```

This bypasses `readProcessSnapshot()` entirely, keeping tests hermetic.

**Cases worth pinning:**

- Each `Osc8Reason` value reachable via at least one snapshot
- `FORCE` + `isStdoutTTY=false` → on (proves rule 1 beats rule 4)
- `FORCE` + wrapper → on (proves rule 1 beats rule 5)
- `FORCE` + unknown terminal → on, capabilities `NO_CAPS`
- `FORCE` + iTerm match → on, capabilities reflect iTerm
- `NO_COLOR=0` → off (no-color spec: `0` is non-empty therefore truthy)
- `NO_HYPERLINK=0` → on if otherwise allowed (default spec: `"0"` is falsy)
- iTerm + version below 3.1.0 → `terminal-known-too-old`
- Apple Terminal → `terminal-known-unsupported`
- VTE without `VTE_VERSION` parseable → `terminal-known-too-old`

### Integration Tests

Not currently needed — the ladder is fully covered by snapshot-driven unit
tests.

---

## Future Enhancements

### Phase 1: Short-term

- **Multi-tier wrapper handling.** If we ever expose async detection, we
  could spawn `tmux -V` to check version and `tmux show-options -g
  allow-passthrough` to verify config. That would let rule 5 produce
  `wrapper-passes-through` (a new `Osc8Reason` value) instead of always "off."

### Phase 2: Medium-term

- **`reason: "ci-detected"`.** If `process.env.CI` is set, default to off
  even if a terminal allowlist would say on. Some CI systems (GitHub Actions)
  render OSC8 in their log viewers, so this would need a curated CI
  allowlist similar to the terminal allowlist.

### Potential Refactoring

- **Factor stderr re-run into a helper.** The IIFE in lines 119-133
  duplicates the support logic. If a third stream is ever added, extract
  `evaluate(isTTY, env, wrapper, match)` and call it twice.

---

## Related Documentation

**Internal Design Docs:**

- [Architecture](./architecture.md) — overall layering and data flow
- [Terminal Allowlist](./terminal-allowlist.md) — what rule 6 is matching against
- [Out of Scope](./out-of-scope.md) — why no subprocess spawning (rule 5)

**Source Files:**

- `src/detect.ts` — the ladder
- `src/env.ts` — `envIsTruthy()` for rules 1-3
- `src/wrappers.ts` — `detectWrapper()` for rule 5
- `src/terminals.ts` — `lookupTerminal()` for rule 6

**External Resources:**

- [No-Color spec][nocolor] — `NO_COLOR` semantics
- [tmux allow-passthrough docs][tmux] — Why we can't trust wrappers without verification

[tmux]: https://man.openbsd.org/tmux.1#allow-passthrough

---

**Document Status:** current — codifies the algorithm exactly as implemented
in `src/detect.ts`.
