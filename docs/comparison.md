# Comparison with Similar Packages

`std-osc8` is one of several packages in the OSC8 / TTY-feature space. This
page positions it against the closest neighbors so you can pick the right
tool — including "stay where you are" if you are already using something else.

## At a glance

| Package | Detection | Formatter | Terminator | Allowlist with version gating | Per-stream | Diagnostic info |
| --- | --- | --- | --- | --- | --- | --- |
| `std-osc8` | yes | yes (`link` + open/close pair) | `ST` (`\x1b\\`) | yes (21 entries, version-encoded VTE/Konsole parsers) | yes (`supportsHyperlinksFor`) | yes (`Osc8Info`) |
| `supports-hyperlinks` | yes | no | n/a | yes (smaller set, version checks for iTerm/vscode/VTE/WezTerm) | yes (`stdout` / `stderr` exports + `createSupportsHyperlinks`) | no |
| `terminal-link` | via `supports-hyperlinks` | yes (single fused call) | `BEL` (`\x07`) | inherits from `supports-hyperlinks` | yes (`terminalLink.stderr`) | no |
| `unjs/std-env` | not for OSC8 | no | n/a | n/a | n/a | TTY/runtime info |
| `chalk` / `picocolors` | colors only | colors only | n/a | n/a | n/a | n/a |
| `ansi-escapes` | no | yes (raw sequences for many concerns) | `BEL` (`\x07`) | n/a | n/a | n/a |

The matrix is a sketch — read the per-package paragraphs below for the
behaviors that matter when choosing.

## `supports-hyperlinks`

[`supports-hyperlinks`](https://github.com/chalk/supports-hyperlinks) is the
canonical OSC8 detector in the JavaScript ecosystem (originally authored by
James Talmage; maintained under the [chalk org](https://github.com/chalk)).
If you need a single-purpose "is this terminal OSC8-capable?" boolean, it
is the obvious option.

Differences vs `std-osc8`:

- **Output shape.** `supports-hyperlinks` exports `{ stdout, stderr }` as
  its default export plus a `createSupportsHyperlinks(stream)` named export
  for arbitrary streams. `std-osc8` exposes the same two stdout/stderr
  booleans **plus** the full diagnostic
  [`osc8: Osc8Info`](./api-reference.md#osc8info) record — terminal name,
  version, wrapper, capabilities, override, and a discriminated
  [`reason`](./api-reference.md#osc8reason).
- **Allowlist depth.** `std-osc8` ships a hand-curated 21-entry
  [allowlist](./terminals.md) with explicit `minVersion` thresholds for
  every entry that has one (e.g., iTerm 3.1+, VTE 0.50.0+, vscode 1.71+,
  Konsole 22.4+, mintty 3.6+, Alacritty 0.13+) and parsers for the
  packed-integer version env vars used by VTE and Konsole.
  `supports-hyperlinks` covers a smaller set (iTerm, WezTerm, vscode,
  ghostty, zed, plus Alacritty / kitty by `TERM` and VTE-based by
  `VTE_VERSION`) with version checks for iTerm and vscode, and a special
  carve-out for the segfault in VTE 0.50.0.
- **Wrapper handling.** `std-osc8` explicitly checks for `TMUX` and `STY`
  and reports `wrapper-strips` (off by default) when either is set, with
  `FORCE_HYPERLINK=1` as the documented escape hatch. `supports-hyperlinks`
  does not check `TMUX` / `STY` directly — the practical effect is that it
  is more permissive inside multiplexers, which works for users on tmux
  3.4+ with passthrough configured but emits literal escape bytes for
  users on older tmux without passthrough.
- **CI / Windows posture.** `supports-hyperlinks` returns `false` whenever
  `CI` is set (with a `NETLIFY` carve-out) and on Windows except when
  `WT_SESSION` is set. `std-osc8` does not special-case CI or platform —
  detection is driven entirely by terminal identification + the override
  ladder. CI users who want hyperlinks set `FORCE_HYPERLINK=1`.
- **Formatter included.** `std-osc8` bundles
  [`link`](./api-reference.md#link), [`openHyperlink`](./api-reference.md#openhyperlink),
  and [`closeHyperlink`](./api-reference.md#closehyperlink) in the same
  package. `supports-hyperlinks` is detection-only; you pair it with
  `terminal-link` (or hand-roll the escape sequences).
- **Override surface.** Both honor `FORCE_HYPERLINK`. `supports-hyperlinks`
  additionally reads CLI flags via `has-flag` (`--no-hyperlink[s]`,
  `--hyperlink=true|false|always|never`) and inherits a `NO_COLOR` check
  from its `supports-color` dependency. `std-osc8` is env-var-only — it
  honors `FORCE_HYPERLINK`, adds a symmetric `NO_HYPERLINK` env var, and
  reads `NO_COLOR` directly per the
  [no-color.org](https://no-color.org) spec.

## `terminal-link`

[`terminal-link`](https://github.com/sindresorhus/terminal-link) is the
canonical OSC8 formatter, layered on `supports-hyperlinks` for detection.
It is the most commonly-used "make this label clickable" helper in Node
CLIs.

Differences vs `std-osc8`:

- **One package vs two.** `std-osc8` is detection + formatter in one. With
  the `terminal-link` stack, you typically have both `terminal-link` and
  `supports-hyperlinks` in your dependency tree.
- **Streaming / open-close pair.** `std-osc8` exposes
  [`openHyperlink`](./api-reference.md#openhyperlink) and
  [`closeHyperlink`](./api-reference.md#closehyperlink) as separate calls
  for streaming output (progress bars, word-wrapped labels, anything where
  the label is built up across multiple writes). `terminal-link`'s API is
  one fused call — if you need streaming, you either compose `terminal-link`
  carefully or drop down to raw escape sequences.
- **OSC8 params.** `std-osc8` exposes a
  [`params`](./api-reference.md#osc8params) option for emitting `id=` (or
  arbitrary terminal-specific keys), gated on the detected terminal's
  `capabilities.params` flag. `terminal-link` does not surface a params
  option.
- **Fallback flexibility.** `std-osc8`'s
  [`LinkOptions.fallback`](./api-reference.md#linkoptions) accepts
  `"with-url"` (default — renders `"label (url)"` with parens),
  `"label-only"`, `"url-only"`, or a custom function `(label, url) => string`.
  `terminal-link` accepts a custom function or the literal `false`
  (returns the label as-is); its default fallback is `"label url"` with a
  space separator (no parens, intended for URL-detection by terminals
  that auto-linkify whitespace-bounded URLs).
- **Terminator.** `std-osc8` emits the OSC8 terminator as `ST` (`\x1b\\`),
  which all modern OSC8 implementations accept. `terminal-link` (via
  `ansi-escapes.link`) emits `BEL` (`\x07`), which most but not all modern
  terminals accept. The practical impact is small but non-zero — see
  [Detection Algorithm](./detection.md) for the rationale.
- **Diagnostic info.** `terminal-link` is a yes/no formatter; if you need
  to log "we did not emit a link because we are inside tmux," you have to
  reach for the underlying detector.

## `unjs/std-env`

[`unjs/std-env`](https://github.com/unjs/std-env) is the adjacent companion.
It is the canonical "what kind of environment am I in?" library for Node /
Bun / Deno / Edge, exposing things like `isCI`, `isWindows`,
`isColorSupported`, `isTTY`, and runtime detection. It is **not** an OSC8
detector — that is what `std-osc8` is for.

`std-osc8` is positioned as the OSC8-shaped sibling: same shape (eager
constants, sync, ESM, zero deps), different question. Use both:

```ts
import { isCI } from "std-env";
import { supportsHyperlinks, link } from "std-osc8";

if (!isCI && supportsHyperlinks) {
  console.log(link("docs", "https://example.com"));
}
```

## `chalk` and `picocolors`

`chalk` and `picocolors` are color libraries — terminal styling for ANSI
foreground/background colors, bold, underline, etc. They are commonly
conflated with hyperlink libraries, but they solve a different problem:
**color is rendering**, **hyperlinks are interaction**.

You almost certainly want both. They compose cleanly:

```ts
import pc from "picocolors";
import { link } from "std-osc8";

console.log(pc.bold(pc.cyan(link("the docs", "https://example.com"))));
```

## `ansi-escapes`

[`ansi-escapes`](https://github.com/sindresorhus/ansi-escapes) is a broad
escape-sequence library (cursor movement, screen clearing, image protocols,
and yes, an OSC8 `link`). It does **not** do detection.

When to choose `ansi-escapes`:

- You need a grab-bag of escape-sequence helpers, not just hyperlinks.
- You are bringing your own detector or always emitting unconditionally.
- You want raw-byte primitives without a capability gate.

When to choose `std-osc8`:

- You want detection and the formatter together.
- You want a capability-aware `link()` that picks a fallback for you.
- You want a diagnostic record for logging or "why didn't this render?"
  reports.

## When to use which

A short decision tree:

- **"I just want a clickable link in my CLI's output."** Either
  `std-osc8` or `terminal-link` works. Pick `std-osc8` if you also want
  the diagnostic info, the open/close pair, or richer fallback options.
- **"I need to know *why* hyperlinks aren't being emitted (logging /
  debugging)."** `std-osc8`. The
  [`Osc8Info`](./api-reference.md#osc8info) record is built for this.
- **"I need different decisions for stdout vs stderr."** `std-osc8`.
  `supportsHyperlinks` and `supportsHyperlinksStderr` are populated
  separately, and
  [`supportsHyperlinksFor`](./api-reference.md#supportshyperlinksfor)
  handles arbitrary streams or fds.
- **"I am streaming output (progress bar, word-wrapping, multi-write
  labels)."** `std-osc8`. Use
  [`openHyperlink`](./api-reference.md#openhyperlink) /
  [`closeHyperlink`](./api-reference.md#closehyperlink) directly.
- **"I am already using `terminal-link` and have no diagnostic needs."**
  Stay where you are. The cost of switching is not justified by the
  upgrade.
- **"I want to detect CI / Windows / color support, not OSC8."** Use
  [`unjs/std-env`](https://github.com/unjs/std-env). `std-osc8` is its
  OSC8-shaped sibling, not a replacement.

## Related

- [API Reference](./api-reference.md) — full surface of `std-osc8`.
- [Detection Algorithm](./detection.md) — how `std-osc8` decides.
