# std-osc8

## 0.1.0

### Features

* [`82a39bf`](https://github.com/spencerbeggs/pnpm-module-template/commit/82a39bfe12dd066f3062441cee1fa214a16b6094) ### Detection

- Detect OSC8 hyperlink support across 21 known terminal emulators with version-gated entries for iTerm2, VTE-based terminals, Konsole, VS Code, Hyper, mintty, and Alacritty.
- Honor `FORCE_HYPERLINK`, `NO_HYPERLINK`, and `NO_COLOR` overrides with a documented precedence ladder.
- Conservative wrapper handling for `tmux` and `screen`; users can opt in via `FORCE_HYPERLINK=1`.

### Public API

* Eager constants: `supportsHyperlinks`, `supportsHyperlinksStderr`, `osc8`.
* Function form: `supportsHyperlinksFor(stream | fd)`.
* Formatter helpers: `link()`, `openHyperlink()`, `closeHyperlink()`.
