# Detection Algorithm

`std-osc8` decides whether to emit OSC8 hyperlinks by walking a 7-rule
precedence ladder. Detection is deterministic and pure: the same snapshot of
`process.env` and `isTTY` flags always produces the same `Osc8Info`.

This page documents the ladder, the override env vars, wrapper handling, and
the reason codes you can use to debug a verdict.

For the rationale layer (why these rules in this order, why "off" by default,
why no subprocess spawning), see the design doc at
[`.claude/design/std-osc8/detection-precedence.md`](../.claude/design/std-osc8/detection-precedence.md).

## The precedence ladder

The first rule that matches wins; remaining rules are skipped. If no rule
produces a positive verdict, the default is **off**.

1. **`FORCE_HYPERLINK` is truthy → on.** Reason: `force-env`. The user is
   declaring they know the terminal supports OSC8 better than this library
   does. Honored even when stdout is not a TTY, even inside a multiplexer,
   even when the terminal is unknown.
2. **`NO_HYPERLINK` is truthy → off.** Reason: `no-hyperlink-env`. Symmetric
   counterpart to `FORCE_HYPERLINK`: an explicit per-process opt-out.
3. **`NO_COLOR` is non-empty → off.** Reason: `no-color-env`. We honor the
   `NO_COLOR` ecosystem signal because users who disable color usually expect
   other ANSI decorations to disappear too.
4. **stdout is not a TTY → off.** Reason: `not-a-tty`. The bytes are going
   to a file, pipe, or socket — not to a renderer that interprets escape
   sequences.
5. **`TMUX` or `STY` is set → off.** Reason: `wrapper-strips`. We are inside
   a multiplexer and cannot verify (without spawning a subprocess) whether
   it passes OSC8 through to the outer terminal.
6. **Terminal in the allowlist:**
   - **6a — supported and version OK → on.** Reason:
     `terminal-known-supported`.
   - **6b — supported but version below `minVersion` → off.** Reason:
     `terminal-known-too-old`. Also fires if the version could not be parsed.
   - **6c — marked as not supporting OSC8 → off.** Reason:
     `terminal-known-unsupported`. (Apple Terminal and Terminology fall here.)
7. **Nothing matched → off.** Reason: `terminal-unknown`. The conservative
   default — emitting a hyperlink that gets rendered as literal `]8;;<url>`
   text is worse than the plain-text fallback.

### Rule-by-rule rationale

- **Why `FORCE_HYPERLINK` overrides `NO_HYPERLINK`.** Force wins because it
  is the ultimate user override. If a user sets both, they probably set
  `NO_HYPERLINK` in some shared shell config and `FORCE_HYPERLINK` in the
  current invocation; the recent one should win, and the cleanest rule for
  that is "force always wins."
- **Why `NO_COLOR=0` is still treated as truthy.** Per
  [no-color.org](https://no-color.org), any non-empty value of `NO_COLOR`
  means the user wants color suppressed. The empty string and an unset
  variable are the only falsy cases. This catches users who set
  `NO_COLOR=0` thinking it disables the disable; it does not.
- **Why "not a TTY" beats the allowlist.** Even if the env screams "iTerm,"
  the immediate consumer of the bytes is whatever stdout is connected to.
  When that is `grep`, `tee`, or a file descriptor handed to a child process,
  emitting OSC8 produces visible garbage.
- **Why wrappers default to off.** Both `tmux` and `screen` have config
  knobs that determine whether OSC8 sequences pass through. Verifying those
  configs requires spawning subprocesses, which is intentionally
  [out of scope](../.claude/design/std-osc8/out-of-scope.md). The conservative
  default is "off"; users who know their multiplexer is configured correctly
  use `FORCE_HYPERLINK=1`.
- **Why the allowlist is last.** The allowlist is the most informative
  signal but also the most brittle. Putting it last lets the cheaper, faster
  checks (override + TTY + wrapper) short-circuit common cases.

## Override env vars

| Variable | Truthy semantics | Effect |
| --- | --- | --- |
| `FORCE_HYPERLINK` | Default spec — anything except `unset`, `""`, `"0"`, `"false"`, `"off"`, `"no"` is truthy (case-insensitive). | Force hyperlinks **on**. Highest precedence. |
| `NO_HYPERLINK` | Default spec — same as above. | Force hyperlinks **off**. Beaten only by `FORCE_HYPERLINK`. |
| `NO_COLOR` | No-color spec — any non-empty value is truthy, including `"0"`. | Force hyperlinks **off**. Beaten by `FORCE_HYPERLINK` and `NO_HYPERLINK`. |

Examples of truthy and falsy values:

| Value | `FORCE_HYPERLINK` / `NO_HYPERLINK` | `NO_COLOR` |
| --- | --- | --- |
| unset | falsy | falsy |
| `""` | falsy | falsy |
| `"0"` | falsy | **truthy** |
| `"false"` | falsy | **truthy** |
| `"1"` | truthy | truthy |
| `"yes"` | truthy | truthy |
| `"no"` | falsy | **truthy** |

Layered usage:

- `NO_COLOR=1 FORCE_HYPERLINK=1` — color off, hyperlinks on.
- `NO_HYPERLINK=1` — hyperlinks off, color decisions left to other libraries.

## Stream detection

`detect()` populates both `isStdoutTTY` and `isStderrTTY` from the snapshot
and runs the gate logic twice — once for stdout (`supported`), once for
stderr (`supportedForStderr`). The two share everything except the `not-a-tty`
branch.

For arbitrary fds (anything other than 1 or 2),
[`supportsHyperlinksFor`](./api-reference.md#supportshyperlinksfor) calls
`node:tty.isatty(fd)` to determine TTY-ness. The env snapshot is reused.

```ts
import { supportsHyperlinks, supportsHyperlinksStderr } from "std-osc8";

// Common pattern: stdout piped to a file, stderr still a TTY
console.log(supportsHyperlinks);       // false (not a TTY)
console.log(supportsHyperlinksStderr); // true  (TTY, terminal allowlisted)
```

## Wrapper handling

When `TMUX` or `STY` is set, `osc8.wrapper` is populated:

```ts
{ name: "tmux", passesThrough: false }
// or
{ name: "screen", passesThrough: false }
```

`passesThrough` is **always `false`** in the current implementation. This is
not a claim that the wrapper definitely strips OSC8 — it is a claim that we
cannot verify from env alone whether it passes through. Spawning `tmux -V`
and parsing `tmux show-options -g allow-passthrough` is intentionally out of
scope. See
[`out-of-scope.md`](../.claude/design/std-osc8/out-of-scope.md).

The escape hatch for tmux ≥ 3.4 users with `set -g allow-passthrough on`:

```bash
export FORCE_HYPERLINK=1
```

This is a process-wide override. For per-call control, use
`link("…", "…", { enabled: true })`.

## Reason codes

`osc8.reason` is a discriminated union (`Osc8Reason`) with nine values. The
`osc8.explanation` field provides a human-readable summary for each:

| Reason | Explanation produced |
| --- | --- |
| `force-env` | `FORCE_HYPERLINK env var is set` |
| `no-hyperlink-env` | `NO_HYPERLINK env var is set` |
| `no-color-env` | `NO_COLOR env var is set` |
| `not-a-tty` | `stdout is not a TTY` |
| `wrapper-strips` | `inside <tmux\|screen>; passthrough not verifiable without subprocess` |
| `terminal-known-supported` | `detected <Terminal>` or `detected <Terminal> <version>` |
| `terminal-known-unsupported` | `detected <Terminal>; terminal does not support OSC8` |
| `terminal-known-too-old` | `detected <Terminal> <version>; below minimum version` |
| `terminal-unknown` | `no identifying signal matched` |

Branch on `reason` (not `explanation`) for programmatic logic — explanation
strings are intended for logs and bug reports, not parsing.

```ts
import { osc8 } from "std-osc8";

switch (osc8.reason) {
  case "wrapper-strips":
    console.error("Inside tmux/screen; set FORCE_HYPERLINK=1 if your wrapper passes through.");
    break;
  case "terminal-known-too-old":
    console.error(`Terminal ${osc8.terminal} ${osc8.terminalVersion ?? "(unparseable version)"} is below the minimum.`);
    break;
  case "terminal-unknown":
    console.error("Terminal not in the allowlist; no identifying env var matched.");
    break;
}
```

## Caching semantics

The eager constants are computed once when `std-osc8` is first imported.
Specifically:

- A snapshot is taken of `process.env`, `process.stdout.isTTY`, and
  `process.stderr.isTTY`.
- That snapshot is run through the detection ladder.
- The result is frozen into `osc8`, `supportsHyperlinks`, and
  `supportsHyperlinksStderr`.

The function form `supportsHyperlinksFor(target)` reuses the import-time env
snapshot **but** re-reads the target's TTY state. So:

- If you mutate `process.env` after import, the eager constants will not
  change, and `supportsHyperlinksFor` will not see your mutation either.
- If a stream's `isTTY` changes after import, `supportsHyperlinksFor(stream)`
  will see the new value (it re-reads `stream.isTTY` on each call).

> Note on `process.env` references. The snapshot stores the actual
> `process.env` reference (not a clone), so mutations *to that object*
> are visible to subsequent reads. The reason mutations don't always seem
> to take effect is that `detect()` reads specific keys at call time;
> changing those keys *will* be observed by `supportsHyperlinksFor`. The
> eager constants, however, are frozen results — they don't re-evaluate.

If you need full re-evaluation against an updated env, the cleanest approach
today is to read the relevant env var directly in your call site:

```ts
import { supportsHyperlinksFor } from "std-osc8";

if (process.env.FORCE_HYPERLINK || supportsHyperlinksFor(process.stdout)) {
  // …
}
```

Re-exporting `detect()` and `readProcessSnapshot()` for full programmatic
re-evaluation is on the future-enhancements list.

## Related

- [API Reference](./api-reference.md) — full export signatures and types.
- [Terminal Allowlist](./terminals.md) — what rule 6 matches against.
- [Troubleshooting](./troubleshooting.md) — concrete fixes for unexpected
  verdicts.
- Design doc:
  [`.claude/design/std-osc8/detection-precedence.md`](../.claude/design/std-osc8/detection-precedence.md).
