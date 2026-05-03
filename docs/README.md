# std-osc8 documentation

[![npm](https://img.shields.io/npm/v/std-osc8?label=npm&color=cb3837)](https://www.npmjs.com/package/std-osc8)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24](https://img.shields.io/badge/Node.js-%3E%3D24-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)

`std-osc8` detects whether the active terminal supports OSC8 hyperlinks and gives you a small formatter to emit them (or graceful fallbacks). It is a focused, synchronous, ESM-only complement to [`unjs/std-env`](https://github.com/unjs/std-env), with zero runtime dependencies.

## Installation

```bash
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

- [Getting started](./getting-started.md) — install, import patterns, and four worked scenarios that cover the 95% of real-world usage.
- [API reference](./api-reference.md) — every export, every option, every field on `Osc8Info`, with copy-paste examples.
- [Detection algorithm](./detection.md) — the 7-rule precedence ladder, the override env vars, wrapper handling, and reason codes.
- [Terminal allowlist](./terminals.md) — the 21 recognized terminals, how each is identified, and how to add a new one.
- [Comparison with similar packages](./comparison.md) — how `std-osc8` differs from `supports-hyperlinks`, `terminal-link`, `std-env`, `chalk` and `ansi-escapes`, plus a "when to use which" decision tree.
- [Troubleshooting](./troubleshooting.md) — concrete symptoms, diagnoses and fixes for the most common surprises.

## See also

- Project root: [`README.md`](../README.md) — short marketing-style overview
- License: [`LICENSE`](../LICENSE)
