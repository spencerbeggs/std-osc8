---
"std-osc8": minor
---

## Features

### Detection

- Detect OSC8 hyperlink support across 21 known terminal emulators with version-gated entries for iTerm2, VTE-based terminals, Konsole, VS Code, Hyper, mintty, and Alacritty.
- Honor `FORCE_HYPERLINK`, `NO_HYPERLINK`, and `NO_COLOR` overrides with a documented precedence ladder.
- Conservative wrapper handling for `tmux` and `screen`; users can opt in via `FORCE_HYPERLINK=1`.

### Public API

- Eager constants: `supportsHyperlinks`, `supportsHyperlinksStderr`, `osc8`.
- Function form: `supportsHyperlinksFor(stream | fd)`.
- Formatter helpers: `link()`, `openHyperlink()`, `closeHyperlink()`.
