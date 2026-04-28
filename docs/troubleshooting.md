# Troubleshooting

Concrete problems with concrete fixes. Each entry is symptom → diagnosis → fix.

## Hyperlinks aren't appearing in tmux

**Symptom.** You ran a CLI that uses `std-osc8` from inside `tmux`, and the terminal showed plain-text fallbacks instead of clickable links. Inspecting the result:

```ts
import { osc8 } from "std-osc8";
console.log(osc8.reason);    // "wrapper-strips"
console.log(osc8.wrapper);   // { name: "tmux", passesThrough: false }
```

**Diagnosis.** `std-osc8` cannot verify (without spawning a subprocess) whether your tmux is configured to pass OSC8 through to the outer terminal. The conservative default is "off."

**Fix.** If you are running tmux 3.4 or later and have configured passthrough, opt back in for that session:

```bash
# In ~/.tmux.conf
set -g allow-passthrough on
```

Then export the override:

```bash
export FORCE_HYPERLINK=1
```

For older tmux, or if you don't control `~/.tmux.conf`, your only option is to render the fallback. The `std-osc8` design intentionally trades automation for predictability here — see [`out-of-scope.md`](../.claude/design/std-osc8/out-of-scope.md).

## `NO_COLOR=0` is disabling hyperlinks

**Symptom.** You set `NO_COLOR=0` thinking it would disable the disable, and hyperlinks turned off anyway.

**Diagnosis.** Per [no-color.org](https://no-color.org), **any non-empty value** of `NO_COLOR` (including the string `"0"`) means the user wants color disabled. `std-osc8` treats `NO_COLOR=0` as truthy and turns hyperlinks off. The only falsy values for `NO_COLOR` are unset and the empty string.

```ts
import { osc8 } from "std-osc8";
console.log(osc8.reason);    // "no-color-env"
console.log(osc8.override);  // "no-color"
```

**Fix.** Unset the variable instead of setting it to `0`:

```bash
unset NO_COLOR
```

Or, if you cannot unset it (it is being set by something upstream), override with `FORCE_HYPERLINK`:

```bash
FORCE_HYPERLINK=1 NO_COLOR=0 my-cli
```

## CI is reporting `not-a-tty`

**Symptom.** Your CI build shows `osc8.reason === "not-a-tty"` even though you are running in a CI runner whose log viewer renders OSC8.

**Diagnosis.** Most CI runners do not allocate a real TTY for the build process — they capture stdout as a pipe and stream it to their log viewer. `process.stdout.isTTY` is therefore `false`, and `std-osc8` says "off."

**Fix.** If you know your CI viewer renders OSC8 (some do, including parts of GitHub Actions log views), set `FORCE_HYPERLINK` in the CI env:

```yaml
# .github/workflows/ci.yml
env:
  FORCE_HYPERLINK: "1"
```

If you are unsure whether your CI renders OSC8, leave it off — the fallback rendering (`"label (url)"`) is always correct.

## Terminal works with iTerm-emitted hyperlinks but `std-osc8` reports `terminal-unknown`

**Symptom.** You are using a terminal that you've seen render OSC8 (urxvt, plain xterm, a less-common emulator), but `osc8.reason === "terminal-unknown"`.

**Diagnosis.** `std-osc8` uses an [allowlist](./terminals.md), not heuristics. If your terminal does not set one of the identifying env vars (no `TERM_PROGRAM`, no specific `TERM` value, no dedicated env), it falls into the `terminal-unknown` bucket regardless of whether it can render OSC8.

**Fix.** Two options, in order of preference:

1. **`FORCE_HYPERLINK=1`** — trust your terminal:

   ```bash
   export FORCE_HYPERLINK=1
   ```

2. **Submit an allowlist entry.** If your terminal has a stable identifying env var, file an issue or PR. See [Terminal Allowlist → Adding a new terminal](./terminals.md#adding-a-new-terminal). Cite the [Alhadis/OSC8-Adoption](https://github.com/Alhadis/OSC8-Adoption) row.

## `supportsHyperlinksFor(3)` returns false even though fd 3 is a TTY

**Symptom.** You are writing to a file descriptor other than 1 or 2 (e.g., fd 3 from a process you spawned with custom `stdio`), the fd is a TTY, and `supportsHyperlinksFor(3)` still returns `false`.

**Diagnosis.** `supportsHyperlinksFor` queries `node:tty.isatty(fd)` for fds outside `{1, 2}`. If `isatty(3)` returns `true` and the env still says off, the issue is something else in the detection ladder — possibly the `terminal-unknown` bucket if the spawned process doesn't inherit the identifying env vars.

**Fix.** Check the diagnostic record:

```ts
import { osc8, supportsHyperlinksFor } from "std-osc8";
import { isatty } from "node:tty";

console.error("isatty(3):", isatty(3));
console.error("supportsHyperlinksFor(3):", supportsHyperlinksFor(3));
console.error("osc8.reason:", osc8.reason);
console.error("osc8.terminal:", osc8.terminal);
```

If `isatty(3)` is `false`, the fd is not actually a TTY in this child process. If `isatty(3)` is `true` but support is still false, look at `osc8.reason` — most often it is `terminal-unknown` (the spawn dropped `TERM_PROGRAM`) or `wrapper-strips` (you are inside tmux). Pass through the relevant env vars when spawning, or set `FORCE_HYPERLINK=1` on the child process.

## `link("x", "https://y", { params: { id: "a;b" } })` throws TypeError

**Symptom.** Calling `link()` (or `openHyperlink()`) with a `params` value containing certain characters throws:

```text
TypeError: OSC8 param 'id' contains invalid character (no ; : or control chars allowed)
```

**Diagnosis.** OSC8 param values cannot contain `;`, `:`, or control characters (0x00–0x1F or 0x7F). These would break the OSC8 sequence's internal structure. `std-osc8` validates **always**, even when the terminal does not support OSC8 and the fallback path is taken — this gives consistent errors regardless of the runtime terminal.

**Fix.** Sanitize the param value. Stick to ASCII alphanumerics plus `-` / `_` to be safe:

```ts
const safeId = rawId.replace(/[^A-Za-z0-9_-]/g, "_");
link("x", "https://y", { params: { id: safeId } });
```

If you need to embed structured data, percent-encode it before passing:

```ts
const encodedId = encodeURIComponent(rawId);
// Note: encodeURIComponent does not escape `;` or `:`, so further work
// is needed if your input may contain those.
```

## Eager constant doesn't reflect a runtime env change

**Symptom.** You set or modified `process.env.FORCE_HYPERLINK` after importing `std-osc8`, but `supportsHyperlinks` did not change.

**Diagnosis.** The eager constants `supportsHyperlinks`, `supportsHyperlinksStderr`, and `osc8` are computed **once at module import**. They are frozen results, not live re-evaluations. Mutating `process.env` after import does not change them. See [Detection Algorithm → Caching semantics](./detection.md#caching-semantics).

**Fix.** Use [`supportsHyperlinksFor`](./api-reference.md#supportshyperlinksfor), which re-evaluates against the current process state on each call. For override env vars specifically, you can also read `process.env` directly:

```ts
import { supportsHyperlinksFor } from "std-osc8";

function shouldEmitNow(stream: NodeJS.WriteStream): boolean {
  if (process.env.FORCE_HYPERLINK) return true;
  if (process.env.NO_HYPERLINK) return false;
  return supportsHyperlinksFor(stream);
}
```

This is a known limitation; re-exporting `detect()` and `readProcessSnapshot()` for full programmatic re-evaluation is on the future-enhancements list.

## Why does the build emit `dist/npm/index.js` but my IDE shows `src/index.ts`?

**Symptom.** You are working in the `std-osc8` repository (or a fork) and your editor shows `src/index.ts` as the entry point, but published builds contain `dist/npm/index.js` and the source `package.json` says `"private": true`.

**Diagnosis.** This is intentional. The repository uses [`@savvy-web/rslib-builder`](https://github.com/savvy-web/rslib-builder), which transforms `package.json` during the build:

- Sets `"private": false` based on `publishConfig.access`.
- Rewrites `exports` to point at compiled output.
- Strips `devDependencies`, `scripts`, `publishConfig`, and `devEngines`.

The source `package.json` keeps `"private": true` so that an accidental `npm publish` against the source tree fails loudly. The published artifact is the `dist/npm/package.json` produced by the builder.

**Fix.** Nothing to fix — this is the expected build pipeline. Do not manually set `"private": false` in the source, and do not rewrite `exports` by hand. See `CLAUDE.md` and the rslib-builder docs for full details.

## Related

- [Detection Algorithm](./detection.md) — the full ladder and override semantics.
- [Terminal Allowlist](./terminals.md) — what gets recognized and how to add new entries.
- [API Reference](./api-reference.md) — full export signatures.
