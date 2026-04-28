# std-osc8

Detect terminal hyperlink (OSC8) support and emit hyperlinks (or graceful
fallbacks). A focused, sync, ESM-only complement to
[`unjs/std-env`](https://github.com/unjs/std-env). Zero runtime
dependencies.

## Install

```bash
pnpm add std-osc8
# or
npm install std-osc8
```

## Quick start

The 95% case is the eager constant:

```ts
import { supportsHyperlinks, link } from "std-osc8";

console.log(link("the docs", "https://example.com"));
// In a supporting terminal: clickable hyperlink
// Elsewhere: "the docs (https://example.com)"

if (supportsHyperlinks) {
 // emit fancy output
}
```

## API at a glance

### Eager constants

```ts
import { supportsHyperlinks, supportsHyperlinksStderr, osc8 } from "std-osc8";
```

- `supportsHyperlinks: boolean` — for stdout
- `supportsHyperlinksStderr: boolean` — for stderr
- `osc8: Osc8Info` — diagnostic record (terminal name, version, wrapper, capabilities, reason)

### Function form

```ts
import { supportsHyperlinksFor } from "std-osc8";

supportsHyperlinksFor(process.stderr); // boolean
supportsHyperlinksFor(2);              // boolean (numeric fd)
```

### Formatter helpers

```ts
import { link, openHyperlink, closeHyperlink } from "std-osc8";

link("docs", "https://example.com");
link("docs", "https://example.com", { fallback: "label-only" });
link("docs", "https://example.com", { fallback: (l, u) => `${l}: ${u}` });

// Streaming open/close pair
process.stdout.write(openHyperlink("https://example.com", { id: "n1" }));
process.stdout.write("docs");
process.stdout.write(closeHyperlink());
```

## Override env vars

| Variable | Effect |
| --- | --- |
| `FORCE_HYPERLINK=1` | Force on. Overrides not-a-tty and wrapper checks. |
| `NO_HYPERLINK=1` | Force off. |
| `NO_COLOR=1` | Treated as a hyperlink off-switch (per `no-color.org` spec, any non-empty value is truthy). |

Precedence: `FORCE_HYPERLINK > NO_HYPERLINK > NO_COLOR > not-a-TTY > wrapper > terminal allowlist`.

## How it decides

Detection runs once at module import:

1. `FORCE_HYPERLINK` set ⇒ on (regardless of anything else)
2. `NO_HYPERLINK` set ⇒ off
3. `NO_COLOR` set ⇒ off
4. stdout is not a TTY ⇒ off
5. Inside `tmux` or `screen` (`TMUX` / `STY` set) ⇒ off conservatively (we cannot verify the multiplexer's version or passthrough config without spawning a subprocess; users can opt back in via `FORCE_HYPERLINK=1`)
6. Terminal in the allowlist with version threshold satisfied ⇒ on
7. Otherwise ⇒ off

Read `osc8.reason` and `osc8.explanation` for diagnostics.

## License

[MIT](LICENSE)
