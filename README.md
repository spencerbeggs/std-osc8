# std-osc8

Detect terminal hyperlink (OSC8) support and emit hyperlinks (or graceful
fallbacks). A focused, sync, ESM-only complement to
[`unjs/std-env`](https://github.com/unjs/std-env). Zero runtime
dependencies.

```ts
import { link } from "std-osc8";

console.log(link("the docs", "https://example.com"));
// In an OSC8-supporting terminal (iTerm, WezTerm, kitty, Konsole, …):
//   the docs       ← a clickable hyperlink
// In a non-supporting terminal, inside tmux without passthrough,
// in CI, or when stdout is piped to a file:
//   the docs (https://example.com)
```

`std-osc8` does the detection for you. You write `link(label, url)` once,
and it picks the right rendering across iTerm2, WezTerm, kitty, VS Code,
Windows Terminal, GNOME Terminal, Konsole, mintty, and 13 other
identifiable terminals — falling back to plain text inside `tmux` /
`screen`, in CI, when stdout is piped, or when `NO_COLOR` is set.

## Install

```bash
pnpm add std-osc8
# or
npm install std-osc8
```

## At a glance

```ts
import {
  link,
  openHyperlink,
  closeHyperlink,
  supportsHyperlinks,
  supportsHyperlinksStderr,
  supportsHyperlinksFor,
  osc8,
} from "std-osc8";

// Most common: render a hyperlink with automatic fallback
link("docs", "https://example.com");

// Boolean check — eager, computed once at module import (for stdout)
if (supportsHyperlinks) {
  // emit fancy output
}

// Per-stream check — function form, accepts WriteStream-like or numeric fd
supportsHyperlinksFor(process.stderr); // boolean
supportsHyperlinksFor(2);              // boolean

// Diagnostic info — what was detected and why
osc8.terminal;        // "iTerm.app" | "WezTerm" | "kitty" | … | null
osc8.terminalVersion; // "3.5.0" | … | null
osc8.reason;          // "terminal-known-supported" | "wrapper-strips" | "not-a-tty" | …
osc8.capabilities;    // { params, fileUrls, fileUrlsRemoteUnsafe }
osc8.wrapper;         // { name: "tmux" | "screen", passesThrough } | null

// Streaming open/close pair — for progress bars, word-wrapped labels,
// anything where the linked text is built up across multiple writes
process.stdout.write(openHyperlink("https://example.com", { id: "n1" }));
process.stdout.write("docs");
process.stdout.write(closeHyperlink());
```

Full surface in the [API reference](./docs/api-reference.md).

## Customizing the fallback

```ts
link("docs", "https://example.com");
//   "docs (https://example.com)"   ← default ("with-url")

link("docs", "https://example.com", { fallback: "label-only" });
//   "docs"

link("docs", "https://example.com", { fallback: "url-only" });
//   "https://example.com"

link("docs", "https://example.com", {
  fallback: (label, url) => `[${label}](${url})`, // markdown-ish
});
//   "[docs](https://example.com)"
```

You can also force the rendering decision with `enabled`:

```ts
link("docs", "https://example.com", { enabled: true });  // always emit OSC8
link("docs", "https://example.com", { enabled: false }); // always use fallback
```

## Override env vars

| Variable | Effect |
| --- | --- |
| `FORCE_HYPERLINK=1` | Force on. Overrides not-a-tty and wrapper checks. |
| `NO_HYPERLINK=1` | Force off. |
| `NO_COLOR=1` | Force off (per [no-color.org](https://no-color.org) spec, any non-empty value is truthy — including `"0"`). |

Precedence: `FORCE_HYPERLINK > NO_HYPERLINK > NO_COLOR > not-a-TTY > wrapper > terminal allowlist`.

See [Detection Algorithm](./docs/detection.md) for the full 7-rule ladder
and the rationale per rule.

## Documentation

- [Getting Started](./docs/getting-started.md) — install, mental model, four worked scenarios
- [API Reference](./docs/api-reference.md) — every export and type with examples
- [Detection Algorithm](./docs/detection.md) — precedence ladder, override semantics, reason codes
- [Terminal Allowlist](./docs/terminals.md) — the 21 entries, sourcing, contributing
- [Comparison with Similar Packages](./docs/comparison.md) — vs `supports-hyperlinks`, `terminal-link`, `ansi-escapes`, `std-env`
- [Troubleshooting](./docs/troubleshooting.md) — common stumbling blocks with concrete fixes

## License

[MIT](LICENSE)
