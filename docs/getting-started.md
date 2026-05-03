# Getting started

This guide walks through installing `std-osc8`, the import patterns that match the 3-tier API, and four worked scenarios that cover most real-world uses.

## Install

```bash
npm install std-osc8
# or
pnpm add std-osc8
```

`std-osc8` is ESM-only and ships its own TypeScript types. It targets Node 24+ per `devEngines`, but the runtime itself only relies on `process.env` and `node:tty`, both of which are available everywhere Node is.

## Import patterns

There is no default export. Pull in only what you need:

```ts
// Detection
import {
  supportsHyperlinks,
  supportsHyperlinksStderr,
  supportsHyperlinksFor,
  osc8,
} from "std-osc8";

// Formatting
import { link, openHyperlink, closeHyperlink } from "std-osc8";

// Types
import type {
  Osc8Info,
  Osc8Reason,
  Osc8Capabilities,
  Osc8Params,
  KnownTerminal,
  WrapperInfo,
  LinkOptions,
} from "std-osc8";
```

## The 3-tier mental model

Pick the tier that matches your need:

- **Tier 1 — eager constants.** `supportsHyperlinks`, `supportsHyperlinksStderr`, and `osc8` are computed once at module import. Use these for the 95% case where you check support at startup and never look back.
- **Tier 2 — function form.** `supportsHyperlinksFor(streamOrFd)` re-runs the detection gate against a specific stream or fd. Use this when you need a per-stream answer (e.g., stdout is piped but stderr is a TTY) or for arbitrary fds.
- **Tier 3 — diagnostic record.** `osc8: Osc8Info` exposes the full reasoning — terminal name, version, wrapper, capabilities and a discriminated `reason`. Use this for logging, debug commands, or "why didn't my link render?" reports.

## Scenario A: emit clickable links from a CLI

The most common use. Just call `link()` — it auto-detects on `process.stdout` and falls back to readable plain text when OSC8 is unsupported.

```ts
import { link } from "std-osc8";

console.log(`See ${link("the docs", "https://example.com")} for details.`);
// Supporting terminal:    See the docs for details.    (clickable)
// Non-supporting terminal: See the docs (https://example.com) for details.
```

## Scenario B: gate richer output behind hyperlink support

You may want to skip emitting decoration when the terminal won't render it.

```ts
import { supportsHyperlinks, link } from "std-osc8";

function renderError(message: string, helpUrl: string): string {
  if (supportsHyperlinks) {
    return `${message} — ${link("see help", helpUrl)}`;
  }
  return `${message}\nSee help: ${helpUrl}`;
}
```

## Scenario C: emit only to stderr when stdout is piped

Common when a CLI's stdout is being piped to a file or another process, but stderr is still a TTY (e.g., progress messages or warnings).

```ts
import { supportsHyperlinksStderr, supportsHyperlinksFor, link } from "std-osc8";

const target = supportsHyperlinksStderr ? process.stderr : process.stdout;

target.write(
  link("warning details", "https://example.com/warnings", {
    target,
  }),
);
target.write("\n");

// Or, equivalently, with the function form:
if (supportsHyperlinksFor(process.stderr)) {
  process.stderr.write(link("ok", "https://x", { target: process.stderr }));
}
```

## Scenario D: streaming output (progress bars, wrapped labels)

When the label is built up incrementally, use the open/close pair instead of `link()`. This is what you want for progress bars, word-wrapped text or any case where the label spans multiple writes.

```ts
import {
  supportsHyperlinksFor,
  openHyperlink,
  closeHyperlink,
} from "std-osc8";

function emitProgress(stream: NodeJS.WriteStream, url: string): void {
  const enabled = supportsHyperlinksFor(stream);

  if (enabled) stream.write(openHyperlink(url, { id: "progress-1" }));
  stream.write("Downloading");
  for (let i = 0; i < 3; i++) {
    stream.write(".");
  }
  stream.write(" done");
  if (enabled) stream.write(closeHyperlink());
  stream.write("\n");
}
```

`openHyperlink(url)` emits `\x1b]8;;<url>\x1b\\` (with optional params before the URL). `closeHyperlink()` emits `\x1b]8;;\x1b\\`. Both are described in detail in [API reference](./api-reference.md).

## What about overrides?

Three env vars influence detection. The full ladder lives in [Detection algorithm](./detection.md), but the short version is:

- `FORCE_HYPERLINK=1` — force hyperlinks on, even if the terminal isn't detected as supporting them.
- `NO_HYPERLINK=1` — force hyperlinks off.
- `NO_COLOR=<anything non-empty>` — also forces hyperlinks off (per [no-color.org](https://no-color.org)).

`FORCE_HYPERLINK` wins over `NO_HYPERLINK` which wins over `NO_COLOR`. If you want "no color but yes hyperlinks", set both `NO_COLOR=1` and `FORCE_HYPERLINK=1`.

## Next steps

- [API reference](./api-reference.md) — full signature for every export.
- [Detection algorithm](./detection.md) — every rule, every reason code.
- [Troubleshooting](./troubleshooting.md) — when something does not work the way you expect.
