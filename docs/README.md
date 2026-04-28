# std-osc8 documentation

`std-osc8` detects whether the active terminal supports OSC8 hyperlinks and gives you a small formatter to emit them (or graceful fallbacks). It is a focused, synchronous, ESM-only complement to [`unjs/std-env`](https://github.com/unjs/std-env), with zero runtime dependencies.

## Install

```bash
pnpm add std-osc8
# or
npm install std-osc8
```

## 30-second quick start

```ts
import { link } from "std-osc8";

console.log(link("the docs", "https://example.com"));
// In a supporting terminal: clickable hyperlink
// Elsewhere:                 the docs (https://example.com)
```

That is it for the common case. When you need more, the rest of the API is documented below.

## Pages

- [Getting Started](./getting-started.md) — install, import patterns, and four worked scenarios that cover the 95% of real-world usage.
- [API Reference](./api-reference.md) — every export, every option, every field on `Osc8Info`, with copy-paste examples.
- [Detection Algorithm](./detection.md) — the 7-rule precedence ladder, the override env vars, wrapper handling, and reason codes.
- [Terminal Allowlist](./terminals.md) — the 21 recognized terminals, how each is identified, and how to add a new one.
- [Comparison with Similar Packages](./comparison.md) — how `std-osc8` differs from `supports-hyperlinks`, `terminal-link`, `std-env`, `chalk`, and `ansi-escapes`, plus a "when to use which" decision tree.
- [Troubleshooting](./troubleshooting.md) — concrete symptoms, diagnoses, and fixes for the most common surprises.

## See also

- Project root: [`README.md`](../README.md) — short marketing-style overview
- License: [`LICENSE`](../LICENSE)
