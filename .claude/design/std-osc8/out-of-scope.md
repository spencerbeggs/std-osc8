---
status: current
module: std-osc8
category: other
created: 2026-04-28
updated: 2026-04-28
last-synced: 2026-04-28
completeness: 80
related:
  - architecture.md
  - detection-precedence.md
dependencies: []
---

# std-osc8 - Out of Scope

Explicit non-goals and removed-during-development features, with the
rationale for each exclusion.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [Future Reconsideration](#future-reconsideration)
5. [Related Documentation](#related-documentation)

---

## Overview

`std-osc8` deliberately does **not** do several things that adjacent
libraries do. This document captures those decisions so future contributors
don't have to re-derive them.

The four major exclusions:

1. **No subprocess spawning** — detection is purely env-var-driven.
2. **No async detection path** — everything is synchronous.
3. **No general TTY feature detection** — color, unicode, dimensions, etc.
   are out of scope (use `unjs/std-env`).
4. **No `Effect` sub-export** — implemented and removed during the same
   branch; a reintroduction would live in a separate `effect-std-osc8`
   package.

**When to reference this document:**

- Before adding a new feature that requires I/O
- When a user requests "smarter" tmux detection
- When considering bundling Effect-style helpers

---

## Current State

### What's Out

| Excluded feature | Reason | Source of truth |
| --- | --- | --- |
| Spawning `tmux -V` / parsing tmux config | Forces async; ~10-50ms hit; breaks edge runtimes | This doc, "Why no subprocess spawning" |
| Spawning to query terminal capabilities (DA1/DA2) | Same as above; also fragile in nested SSH | This doc |
| `detect()` async variant | No env signal needs I/O; sync is sufficient | This doc, "Why no async path" |
| Color / 256-color / truecolor detection | Use `unjs/std-env` | Architecture overview |
| Unicode width / emoji / box-drawing detection | Out of OSC8 scope | Architecture overview |
| Terminal dimensions / cursor position queries | Out of OSC8 scope; covered elsewhere | Architecture overview |
| `effect-std-osc8` sub-export | Removed in commit `7fc0efa`; if re-added, separate package | This doc, "Effect sub-export removal" |

### What's In (for contrast)

- Reading `process.env`
- Reading `process.stdout.isTTY` / `process.stderr.isTTY`
- Calling `node:tty.isatty(fd)` for arbitrary numeric fds
- Static allowlist matching
- Permissive semver compare
- OSC8 sequence formatting (open/close/labeled link)

---

## Rationale

### Why no subprocess spawning

Spawning subprocesses to gather signals (e.g., `tmux -V`,
`tmux show-options -g allow-passthrough`, `infocmp`) was considered and
rejected for four reasons:

1. **Latency.** Even a fast spawn-and-exec is ~10-50ms cold. `std-osc8` is
   imported by CLI tools that pride themselves on sub-100ms startup. A
   per-import 10ms tax is unacceptable for what should be a near-zero-cost
   utility.
2. **Async contagion.** `child_process.execSync` blocks the event loop,
   which is unacceptable in any user-facing tool. The async alternative
   (`exec`) makes detection async, which means the eager `supportsHyperlinks`
   constant becomes a Promise, which means every consumer needs to await,
   which means the API tier collapses.
3. **Edge-runtime incompatibility.** Cloudflare Workers, Vercel Edge
   Runtime, Bun's edge mode, and various WebContainer setups don't expose
   `child_process` at all. Spawning would either crash or require runtime
   feature detection on top of what we're already doing.
4. **Diminishing returns.** The information we'd gain — "is tmux ≥ 3.4 with
   `allow-passthrough on`?" — is genuinely useful but only for the small
   subset of users running inside tmux who can't be bothered to set
   `FORCE_HYPERLINK=1`. The cost (latency + complexity + edge breakage)
   doesn't justify the benefit.

The escape hatch is `FORCE_HYPERLINK=1`. Users who know their wrapper passes
through can opt back in process-wide. This is less ergonomic than automatic
detection but is the right cost/benefit balance for a leaf utility.

### Why no async path

Once subprocess spawning is out, no remaining detection signal requires
I/O. Reading `process.env` is sync. Reading `isTTY` flags is sync. Calling
`isatty(fd)` is sync. The whole detection pipeline is naturally sync.

Adding an async sibling (e.g., `detectAsync()`) would only be useful if it
called something async — which would be a subprocess, which is excluded.
Therefore async is unnecessary and would add API surface for no real benefit.

If a future signal requires I/O (e.g., reading a config file), the right
answer is to add a sibling export with a clearly-async name, not to retrofit
async into the sync paths. The 3-tier API (eager constants + function form +
diagnostic record) is sync-first by design.

### Why we don't detect color / unicode / general TTY features

`std-osc8` is a **focused complement** to `unjs/std-env`, not a replacement.
`std-env` already detects:

- Color support (`isColorSupported`, `colorDepth`)
- TTY-ness (`isTTY`)
- Runtime/platform (Node, Bun, Deno, Edge)
- CI environment

Re-implementing those would mean either (a) duplicating `std-env`'s logic
(and getting it wrong) or (b) depending on `std-env` (which makes us a
wrapper, not a peer). The right model is: callers use both libraries and
combine their answers. Specifically:

```typescript
import { isColorSupported } from "std-env";
import { supportsHyperlinks } from "std-osc8";

// caller's choice: render with color AND hyperlinks, or one, or neither
```

### Effect sub-export removal

An `Effect`-based wrapper was implemented during the design phase under a
sub-export path (e.g., `std-osc8/effect`). It was removed in commit `7fc0efa`
on the same `feat/implementation` branch. Reasons:

- **Sub-exports complicate bundling.** Some bundlers and TypeScript module
  resolution modes mishandle them. A user importing the base package
  shouldn't pay the cost of an Effect dependency they don't use.
- **`Effect` is a heavyweight peer dep.** A util library shouldn't pull
  in a runtime-system dependency unless it's the library's primary purpose.
- **Distinct audience.** The Effect-flavored API is interesting to a
  specific subset of users who think in Effect. They are better served by
  a dedicated `effect-std-osc8` package that depends on `std-osc8` and
  exposes Effect-shaped helpers.

If the Effect wrapper is reintroduced, it lives in its own package, owns
its own publishing cadence, and is free to take a peer dep on `effect`.

---

## Future Reconsideration

The exclusions above are not permanent doctrine. Conditions under which
we'd revisit:

### Subprocess spawning

Reconsider if **all** of the following become true:

- Edge runtimes gain `child_process` (or a portable alternative)
- A new always-available detection signal requires I/O (no current candidate)
- Users widely report that `FORCE_HYPERLINK` is too coarse

### Async detection

Reconsider if subprocess spawning is reconsidered. As long as detection
inputs are env+TTY, sync is sufficient.

### Color / unicode / general TTY detection

Reconsider only if `std-env` is deprecated or fundamentally changes shape.
The current division of labor is healthy.

### Effect sub-export

Reconsider if we want to publish a single bundle. Realistically, the right
path is the separate `effect-std-osc8` package, which doesn't require us
to revisit this exclusion at all.

---

## Related Documentation

**Internal Design Docs:**

- [Architecture](./architecture.md) — what *is* in scope
- [Detection Precedence](./detection-precedence.md) — why rule 5 says
  "off" for wrappers (consequence of "no subprocess spawning")
- [Terminal Allowlist](./terminal-allowlist.md) — why allowlist instead
  of runtime feature queries (also a consequence)

**Source-of-truth references:**

- Commit `7fc0efa` on `feat/implementation` — Effect sub-export removal
- `src/wrappers.ts` — `passesThrough: false` always; the conservative
  consequence of "no subprocess spawning"

**Sister packages:**

- [unjs/std-env][std-env] — Where to look for color, TTY-ness, runtime detection

[std-env]: https://github.com/unjs/std-env

---

**Document Status:** current — pins the four major non-goals as of the
initial implementation. Future expansions of scope should update or
amend this document, not silently bypass it.
