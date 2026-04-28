# API Reference

Every export from `std-osc8`, with full signatures, options, and examples.

## Table of contents

- [Eager constants](#eager-constants)
  - [`supportsHyperlinks`](#supportshyperlinks)
  - [`supportsHyperlinksStderr`](#supportshyperlinksstderr)
  - [`osc8`](#osc8)
- [Function form](#function-form)
  - [`supportsHyperlinksFor`](#supportshyperlinksfor)
- [Formatter helpers](#formatter-helpers)
  - [`link`](#link)
  - [`openHyperlink`](#openhyperlink)
  - [`closeHyperlink`](#closehyperlink)
  - [Param validation](#param-validation)
- [Types](#types)
  - [`Osc8Info`](#osc8info)
  - [`Osc8Reason`](#osc8reason)
  - [`KnownTerminal`](#knownterminal)
  - [`Osc8Capabilities`](#osc8capabilities)
  - [`WrapperInfo`](#wrapperinfo)
  - [`Osc8Params`](#osc8params)
  - [`LinkOptions`](#linkoptions)

## Eager constants

The eager constants are computed **once at module import** by running the
detection algorithm against a snapshot of `process.env` and the
`isTTY` flags of `process.stdout` and `process.stderr`. They are zero-overhead
to read and tree-shakable.

> Eager-at-import means: if your code mutates `process.env` after `std-osc8`
> has been loaded, the constants will not change. The function form
> [`supportsHyperlinksFor`](#supportshyperlinksfor) reuses that env snapshot
> as well; if you need to fully re-evaluate against a new env, you currently
> need to drive detection yourself. See [Detection Algorithm](./detection.md)
> for the caching semantics.

### `supportsHyperlinks`

```ts
const supportsHyperlinks: boolean;
```

The boolean verdict for `process.stdout`. Equivalent to `osc8.supported`.

```ts
import { supportsHyperlinks } from "std-osc8";

if (supportsHyperlinks) {
  console.log("\x1b]8;;https://example.com\x1b\\hello\x1b]8;;\x1b\\");
}
```

### `supportsHyperlinksStderr`

```ts
const supportsHyperlinksStderr: boolean;
```

The boolean verdict for `process.stderr`. Equivalent to
`osc8.supportedForStderr`. The two diverge when one stream is a TTY and the
other is not (e.g., piped stdout, TTY stderr).

```ts
import { supportsHyperlinksStderr } from "std-osc8";

const target = supportsHyperlinksStderr ? process.stderr : process.stdout;
```

### `osc8`

```ts
const osc8: Osc8Info;
```

The full diagnostic record. See [`Osc8Info`](#osc8info) for every field.

```ts
import { osc8 } from "std-osc8";

console.error(`OSC8: ${osc8.supported} (${osc8.reason}) - ${osc8.explanation}`);
// e.g. OSC8: true (terminal-known-supported) - detected iTerm.app 3.5.0
```

## Function form

### `supportsHyperlinksFor`

```ts
function supportsHyperlinksFor(target: NodeJS.WriteStream | number): boolean;
```

Re-runs the detection gate for a specific stream or numeric fd. The
import-time env snapshot is reused; only the TTY flag varies.

How `target` is resolved:

- **WriteStream-like** (anything with an `.isTTY` property): the function
  reads `target.isTTY` directly.
- **fd `1` (stdout)**: uses the cached `isStdoutTTY` flag from the import-time
  snapshot.
- **fd `2` (stderr)**: uses the cached `isStderrTTY` flag.
- **Any other fd**: queries `node:tty.isatty(fd)`.

```ts
import { supportsHyperlinksFor } from "std-osc8";

supportsHyperlinksFor(process.stdout); // boolean
supportsHyperlinksFor(process.stderr); // boolean
supportsHyperlinksFor(2);              // numeric fd shortcut
supportsHyperlinksFor(3);              // arbitrary fd via node:tty.isatty
```

## Formatter helpers

### `link`

```ts
function link(label: string, url: string, options?: LinkOptions): string;
```

Render `label` as an OSC8 hyperlink to `url` when supported, or a configurable
fallback rendering otherwise. Validates `params` regardless of detection
outcome — see [Param validation](#param-validation).

When OSC8 is supported, the emitted bytes are exactly:

```text
\x1b]8;<params>;<url>\x1b\<label>\x1b]8;;\x1b\
```

Where `<params>` is the colon-separated `key=value` pairs from
`options.params` (or empty), and the trailing sequence is
[`closeHyperlink`](#closehyperlink).

When OSC8 is not supported, the fallback is chosen by `options.fallback`:

| Value | Result |
| --- | --- |
| `undefined` (default) | `${label} (${url})` |
| `"with-url"` | `${label} (${url})` |
| `"label-only"` | `${label}` |
| `"url-only"` | `${url}` |
| `(label, url) => string` | the function's return value |

The capability gate works as follows:

- **By default**, `link()` calls `supportsHyperlinksFor(options.target ?? process.stdout)`.
- **If `options.enabled` is set**, that boolean is used directly — no
  detection is run for the gate.
- **Params emission is gated** on `osc8.capabilities.params` (the detected
  terminal's intrinsic capability — not affected by stream TTY state),
  **except** when `options.enabled === true`. In that explicit-on case,
  params are emitted unconditionally — useful for test rigs and forced-on
  environments where you want full control.

Examples:

```ts
import { link } from "std-osc8";

// Default: auto-detect, fallback "with-url"
link("docs", "https://example.com");
// → "\x1b]8;;https://example.com\x1b\\docs\x1b]8;;\x1b\\" (when supported)
// → "docs (https://example.com)"                        (when not)

// Custom fallback rendering
link("docs", "https://example.com", { fallback: "label-only" });
// → "docs"  (when not supported)

link("docs", "https://example.com", {
  fallback: (label, url) => `${label}: ${url}`,
});
// → "docs: https://example.com"  (when not supported)

// Explicit on, with params (params emitted unconditionally)
link("docs", "https://example.com", {
  enabled: true,
  params: { id: "n1" },
});
// → "\x1b]8;id=n1;https://example.com\x1b\\docs\x1b]8;;\x1b\\"

// Per-stream target
link("docs", "https://example.com", { target: process.stderr });
```

### `openHyperlink`

```ts
function openHyperlink(url: string, params?: Osc8Params): string;
```

Emit only the OSC8 **open** sequence introducing a hyperlink to `url`. Use
this with [`closeHyperlink`](#closehyperlink) when the label is built
incrementally.

The emitted bytes are exactly:

```text
\x1b]8;<params>;<url>\x1b\
```

`<params>` is empty if no params are passed, otherwise it is the
colon-separated `key=value` serialization of `params`.

```ts
import { openHyperlink } from "std-osc8";

openHyperlink("https://example.com");
// → "\x1b]8;;https://example.com\x1b\\"

openHyperlink("https://example.com", { id: "abc" });
// → "\x1b]8;id=abc;https://example.com\x1b\\"

openHyperlink("https://example.com", { id: "abc", foo: "bar" });
// → "\x1b]8;id=abc:foo=bar;https://example.com\x1b\\"
```

> Unlike `link()`, `openHyperlink()` always emits — it does not consult
> detection. The caller decides whether to call it based on the function
> form or eager constants.

### `closeHyperlink`

```ts
function closeHyperlink(): string;
```

Emit the OSC8 **close** sequence, ending an in-progress hyperlink. The
emitted bytes are always exactly:

```text
\x1b]8;;\x1b\
```

```ts
import { closeHyperlink } from "std-osc8";

closeHyperlink(); // → "\x1b]8;;\x1b\\"
```

### Param validation

Both `link()` and `openHyperlink()` validate every value in `params`.
Param values **must not** contain:

- `;` (terminator collision in the OSC8 sequence)
- `:` (key/value separator collision)
- Control characters (0x00–0x1F or 0x7F)

If any value contains a forbidden character, a `TypeError` is thrown.
Validation runs **even when the terminal does not support OSC8** — this
gives callers consistent feedback regardless of detection state and prevents
malformed sequences from sneaking through forced-on paths.

```ts
import { link, openHyperlink } from "std-osc8";

// All of these throw TypeError:
link("docs", "https://x", { enabled: true, params: { id: "a;b" } });
link("docs", "https://x", { enabled: false, params: { id: "a;b" } });
openHyperlink("https://x", { id: "a:b" });
openHyperlink("https://x", { id: "a\x07b" });
```

## Types

### `Osc8Info`

```ts
interface Osc8Info {
  readonly supported: boolean;
  readonly supportedForStderr: boolean;
  readonly reason: Osc8Reason;
  readonly explanation: string;
  readonly terminal: KnownTerminal | null;
  readonly terminalRaw: string | null;
  readonly terminalVersion: string | null;
  readonly wrapper: WrapperInfo | null;
  readonly isStdoutTTY: boolean;
  readonly isStderrTTY: boolean;
  readonly override: "force-hyperlink" | "no-hyperlink" | "no-color" | null;
  readonly capabilities: Osc8Capabilities;
}
```

| Field | Meaning |
| --- | --- |
| `supported` | Final boolean verdict for stdout. |
| `supportedForStderr` | Final boolean verdict for stderr. |
| `reason` | Discriminator explaining the stdout verdict. See [`Osc8Reason`](#osc8reason). |
| `explanation` | Human-readable summary, useful for logging. |
| `terminal` | Detected terminal program if matched against the allowlist; otherwise `null`. |
| `terminalRaw` | Raw env value used to identify the terminal (e.g., the value of `TERM_PROGRAM`). |
| `terminalVersion` | Detected terminal version, if available. `null` when the terminal does not expose a version or it could not be parsed. |
| `wrapper` | Multiplexer info if inside `tmux`/`screen`. See [`WrapperInfo`](#wrapperinfo). |
| `isStdoutTTY` | Whether stdout was a TTY at detection time. |
| `isStderrTTY` | Whether stderr was a TTY at detection time. |
| `override` | Which override env var produced the verdict, if any. `null` when no override fired. |
| `capabilities` | Sub-feature capabilities of the matched terminal. **Decoupled from `supported`**: capabilities reflect what the detected terminal can intrinsically do, regardless of TTY state, wrapper, or override. A piped stdout that produces `supported: false` still surfaces the terminal's true `params`/`fileUrls` flags here. See [`Osc8Capabilities`](#osc8capabilities). |

```ts
import { osc8 } from "std-osc8";

console.log({
  supported: osc8.supported,
  reason: osc8.reason,                 // e.g. "terminal-known-supported"
  explanation: osc8.explanation,       // e.g. "detected iTerm.app 3.5.0"
  terminal: osc8.terminal,             // e.g. "iTerm.app"
  terminalVersion: osc8.terminalVersion, // e.g. "3.5.0"
  capabilities: osc8.capabilities,     // { params: true, fileUrls: true, ... }
});
```

### `Osc8Reason`

```ts
type Osc8Reason =
  | "force-env"
  | "no-hyperlink-env"
  | "no-color-env"
  | "not-a-tty"
  | "wrapper-strips"
  | "terminal-known-supported"
  | "terminal-known-unsupported"
  | "terminal-known-too-old"
  | "terminal-unknown";
```

The discriminator on `Osc8Info`. Each value corresponds to one rule of the
detection ladder:

| Reason | When it fires |
| --- | --- |
| `force-env` | `FORCE_HYPERLINK` is set to a truthy value. |
| `no-hyperlink-env` | `NO_HYPERLINK` is set to a truthy value (and `FORCE_HYPERLINK` is not). |
| `no-color-env` | `NO_COLOR` is set to a non-empty value (and neither force nor no-hyperlink fired). |
| `not-a-tty` | No override, and stdout is not a TTY. |
| `wrapper-strips` | No override, stdout is a TTY, but `TMUX` or `STY` is set. |
| `terminal-known-supported` | The terminal matched the allowlist and is at or above its `minVersion`. |
| `terminal-known-unsupported` | The terminal matched the allowlist but is marked as not supporting OSC8 (e.g., Apple Terminal, Terminology). |
| `terminal-known-too-old` | The terminal matched the allowlist but its version is below `minVersion`, or its version could not be parsed. |
| `terminal-unknown` | No allowlist entry matched. |

See [Detection Algorithm](./detection.md) for the full rule-by-rule walkthrough.

### `KnownTerminal`

```ts
type KnownTerminal =
  | "iTerm.app"
  | "WezTerm"
  | "kitty"
  | "Apple_Terminal"
  | "vscode"
  | "Hyper"
  | "mintty"
  | "WindowsTerminal"
  | "Konsole"
  | "VTE"
  | "Alacritty"
  | "Ghostty"
  | "JediTerm"
  | "Tabby"
  | "Foot"
  | "Rio"
  | "Contour"
  | "ConEmu"
  | "WarpTerminal"
  | "WaveTerminal"
  | "Terminology";
```

A tight string-literal union of every terminal in the allowlist. Use it for
exhaustive switch statements or autocomplete-friendly comparisons. See
[Terminal Allowlist](./terminals.md) for what each entry means.

```ts
import { osc8, type KnownTerminal } from "std-osc8";

function describe(t: KnownTerminal | null): string {
  switch (t) {
    case "iTerm.app":
      return "iTerm2 on macOS";
    case "vscode":
      return "VS Code integrated terminal";
    case null:
      return "unknown or unidentified terminal";
    default:
      return t;
  }
}

console.log(describe(osc8.terminal));
```

### `Osc8Capabilities`

```ts
interface Osc8Capabilities {
  readonly params: boolean;
  readonly fileUrls: boolean;
  readonly fileUrlsRemoteUnsafe: boolean;
}
```

| Field | Meaning |
| --- | --- |
| `params` | Terminal honors OSC8 params (`id=`, custom keys). When `false`, `link()` drops `LinkOptions.params` rather than emitting them. |
| `fileUrls` | Terminal renders `file://` URLs as expected. |
| `fileUrlsRemoteUnsafe` | When `true`, `file://` URLs may misbehave over SSH or remote sessions because the renderer-side filesystem differs. Currently only `vscode` sets this. |

For unsupported terminals or unknown terminals, all three fields are `false`.

### `WrapperInfo`

```ts
interface WrapperInfo {
  readonly name: "tmux" | "screen";
  readonly passesThrough: boolean;
}
```

Set when `osc8.wrapper` is non-null. `passesThrough` is **always `false`**
because we cannot verify the multiplexer's version or passthrough config
without spawning a subprocess. Users who know their tmux is configured
correctly should set `FORCE_HYPERLINK=1`.

### `Osc8Params`

```ts
interface Osc8Params {
  readonly id?: string;
  readonly [key: string]: string | undefined;
}
```

OSC8 link parameters. `id` is the standard parameter and is the field most
consumers ever set, but arbitrary string-valued keys are allowed for
terminal-specific extensions. `undefined` values are skipped during
serialization.

See [Param validation](#param-validation) for the constraints on values.

### `LinkOptions`

```ts
interface LinkOptions {
  readonly enabled?: boolean;
  readonly params?: Osc8Params;
  readonly fallback?:
    | "with-url"
    | "label-only"
    | "url-only"
    | ((label: string, url: string) => string);
  readonly target?: NodeJS.WriteStream | number;
}
```

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled` | unset (auto-detect) | Override detection. When `true`, hyperlinks are always emitted and params bypass the capability gate. When `false`, the fallback is always rendered. |
| `params` | `undefined` | OSC8 params to emit. Silently dropped if the detected terminal lacks `params` capability (unless `enabled: true`). Always validated. |
| `fallback` | `"with-url"` | Rendering when OSC8 is not emitted. |
| `target` | `process.stdout` | Stream or fd to detect against. Ignored if `enabled` is set. |
