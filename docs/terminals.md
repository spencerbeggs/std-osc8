# Terminal Allowlist

`std-osc8` recognizes terminal emulators via a hand-curated allowlist defined
in [`src/terminals.ts`](../src/terminals.ts). This page documents every entry,
how identification works, and how to contribute a new one.

For the rationale (why allowlist instead of heuristics, why per-entry
`identify()` functions, why `minVersion` is permissive on parse failure), see
the design doc at
[`.claude/design/std-osc8/terminal-allowlist.md`](../.claude/design/std-osc8/terminal-allowlist.md).

## Allowlist overview

The allowlist is a `readonly TerminalEntry[]` iterated in array order. Each
entry has:

- A canonical `name` (one literal in the [`KnownTerminal`](./api-reference.md#knownterminal) union).
- An `identify(env)` function that returns either an `IdentifyResult`
  (matched, with raw identifier and parsed version) or `null` (no match).
- A `supported` boolean — does this terminal honor OSC8 at all?
- A `minVersion: string | null` — the minimum version that supports OSC8;
  `null` means "any version OK" or "n/a because unsupported."
- A `capabilities` object — `params`, `fileUrls`, and
  `fileUrlsRemoteUnsafe` flags surfaced on `Osc8Info.capabilities` when the
  terminal matches.

Each entry's source comment links to its row in
[Alhadis/OSC8-Adoption](https://github.com/Alhadis/OSC8-Adoption), the
canonical community-maintained tracker. New entries and version bumps cite
specific upstream rows or commit hashes so the data is auditable.

`lookupTerminal(env)` walks the array and returns the first entry whose
`identify()` returns non-null. Detection then folds the match into the
[precedence ladder](./detection.md) at rule 6.

## The 21 entries

Listed in match order. Columns:

- **Identifier** — the env var(s) consulted by `identify()`.
- **Min version** — `minVersion` from the entry; `any` means `null`.
- **`params`**, **`fileUrls`** — sub-feature capabilities surfaced on
  `Osc8Info.capabilities` when this entry matches and is supported.

| # | Terminal | Identifier | Min version | `params` | `fileUrls` | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | iTerm.app | `TERM_PROGRAM=iTerm.app` | 3.1.0 | yes | yes | Version from `TERM_PROGRAM_VERSION`. |
| 2 | Apple_Terminal | `TERM_PROGRAM=Apple_Terminal` | n/a | no | no | Marked unsupported as of macOS 15. Stays in allowlist for diagnostics. |
| 3 | VTE | `VTE_VERSION` set | 0.50.0 | no | yes | Covers GNOME Terminal, Tilix, Terminator, xfce4-terminal, Black Box, etc. Version is packed-int (see below). |
| 4 | Konsole | `KONSOLE_VERSION` set | 22.4.0 | yes | yes | KDE's terminal. Version is packed-int (see below). |
| 5 | WezTerm | `TERM_PROGRAM=WezTerm` | any | yes | yes | Version from `TERM_PROGRAM_VERSION`. |
| 6 | kitty | `TERM=xterm-kitty` or `KITTY_WINDOW_ID` | any | yes | yes | No version env exposed; allowlist treats any kitty as supporting. |
| 7 | vscode | `TERM_PROGRAM=vscode` | 1.71.0 | no | yes | `fileUrlsRemoteUnsafe: true` — `file://` may misbehave in remote workspaces. |
| 8 | Hyper | `TERM_PROGRAM=Hyper` | 3.0.0 | no | yes | Version from `TERM_PROGRAM_VERSION`. |
| 9 | mintty | `TERM_PROGRAM=mintty` | 3.6.0 | yes | yes | MSYS2/Cygwin/Git Bash. |
| 10 | WindowsTerminal | `WT_SESSION` set | any | no | yes | All current versions support OSC8. |
| 11 | Alacritty | `TERM=alacritty` | any | no | yes | TERM-based identification with no version env exposed; minVersion is intentionally `null` because gating with no version source would block every Alacritty user. Pre-0.11 Alacritty (Oct 2022) is vanishingly rare; affected users can opt out via `NO_HYPERLINK=1`. |
| 12 | Ghostty | `TERM_PROGRAM=ghostty` | any | yes | yes | Lowercase value. |
| 13 | JediTerm | `TERMINAL_EMULATOR=JetBrains-JediTerm` | any | no | yes | IntelliJ, PyCharm, WebStorm, Rider, etc. |
| 14 | Tabby | `TERM_PROGRAM=Tabby` | any | yes | yes | |
| 15 | Foot | `TERM=foot` or `TERM=foot-extra` | any | yes | yes | Wayland-native. |
| 16 | Rio | `TERM_PROGRAM=rio` | any | no | yes | Lowercase value. |
| 17 | Contour | `TERMINAL_NAME=contour` | any | yes | yes | |
| 18 | ConEmu | `ConEmuPID` set | any | no | yes | Also matches cmder. |
| 19 | WarpTerminal | `TERM_PROGRAM=WarpTerminal` | any | no | yes | |
| 20 | WaveTerminal | `TERM_PROGRAM=WaveTerminal` | any | no | yes | |
| 21 | Terminology | `TERMINOLOGY=1` | n/a | no | no | Marked unsupported. Stays in allowlist for diagnostics. |

Only `vscode` currently has `fileUrlsRemoteUnsafe: true`; every other
supported entry is `false`.

## Identification strategies

The 21 entries cluster into a few patterns. When you read or modify
`src/terminals.ts`, recognizing the cluster helps:

- **`TERM_PROGRAM` exact-match (12 entries).** iTerm, Apple Terminal, WezTerm,
  vscode, Hyper, mintty, Ghostty, Tabby, Rio, Warp, Wave. Versions read from
  `TERM_PROGRAM_VERSION`. The most modern and consistent pattern.
- **`TERM` exact-match (3 entries).** kitty (`xterm-kitty`), Alacritty
  (`alacritty`), Foot (`foot` / `foot-extra`).
- **Dedicated env-var presence (5 entries).** Konsole (`KONSOLE_VERSION`),
  VTE (`VTE_VERSION`), Windows Terminal (`WT_SESSION`), kitty
  (`KITTY_WINDOW_ID` as fallback when `TERM` is not set), ConEmu (`ConEmuPID`),
  JediTerm (`TERMINAL_EMULATOR`), Contour (`TERMINAL_NAME`), Terminology
  (`TERMINOLOGY=1`).

## Version-encoded entries

Two terminals encode versions as a single packed integer rather than a
dot-separated string:

- **VTE** (`VTE_VERSION`) — `MAJOR*10000 + MINOR*100 + PATCH`. Example:
  `5202` means `0.52.2`.
- **Konsole** (`KONSOLE_VERSION`) — same scheme but with calendar versioning.
  Example: `220400` means `22.4.0`.

Both are decoded by `parseVteVersion` (and `parseKonsoleVersion`, which is a
re-export of the same function) in [`src/semver.ts`](../src/semver.ts).
After parsing, the result is a normal `MAJOR.MINOR.PATCH` string that
`compareSemver()` consumes alongside every other version comparison.

If the env var is not parseable as an integer (or the integer is negative),
the parser returns `null`. The detection ladder then treats that as "version
unknown" and falls into `terminal-known-too-old` — conservative, because
emitting an OSC8 sequence to a too-old VTE produces visible garbage.

## Known unsupported entries

Two entries are intentionally in the allowlist with `supported: false`:

- **Apple_Terminal** (`TERM_PROGRAM=Apple_Terminal`) — Apple Terminal does
  not support OSC8 as of macOS 15. The entry stays in the allowlist so
  `osc8.terminal === "Apple_Terminal"` is informative even when the verdict
  is `terminal-known-unsupported`.
- **Terminology** (`TERMINOLOGY=1`) — same reasoning.

Keeping unsupported entries in the allowlist gives downstream diagnostic
tools a clean way to say "we know what terminal this is, and we know it
doesn't support OSC8" rather than the muddier "unknown terminal."

## Adding a new terminal

The contributor flow:

1. **Verify support upstream.** Find the terminal's row in
   [Alhadis/OSC8-Adoption](https://github.com/Alhadis/OSC8-Adoption). Note
   the version where OSC8 support landed (or the fact that it does not
   support OSC8). Capture the upstream commit hash or release note for the
   source comment.
2. **Add the canonical name** to the
   [`KnownTerminal`](./api-reference.md#knownterminal) union in
   [`src/types.ts`](../src/types.ts).
3. **Add the entry** to the `TERMINALS` array in
   [`src/terminals.ts`](../src/terminals.ts), matching the shape of similar
   entries. The leading comment should cite the OSC8-Adoption row:

   ```ts
   {
     // {Terminal} — supported since {version}.
     // Source: https://github.com/Alhadis/OSC8-Adoption ({Terminal} row)
     name: "MyTerm",
     identify: (env) =>
       env.TERM_PROGRAM === "MyTerm"
         ? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
         : null,
     supported: true,
     minVersion: "1.0.0",
     capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
   },
   ```

4. **Add a unit test** in `__test__/terminals.test.ts` constructing a minimal
   env and asserting `lookupTerminal()` returns the new entry. Cover both
   the positive case and a near-miss negative case.
5. **Optionally add an integration test** in `__test__/detect.test.ts` that
   exercises the end-to-end "this env produces this `Osc8Reason`" path,
   especially around `minVersion` boundaries.
6. **Open a PR.** The changeset should mention the OSC8-Adoption row that
   justifies the addition.

## Related

- [API Reference: `KnownTerminal`](./api-reference.md#knownterminal) — the
  string-literal union of allowlist entries.
- [Detection Algorithm](./detection.md) — where rule 6 consults the
  allowlist.
- Design doc:
  [`.claude/design/std-osc8/terminal-allowlist.md`](../.claude/design/std-osc8/terminal-allowlist.md).
- [Alhadis/OSC8-Adoption](https://github.com/Alhadis/OSC8-Adoption) — the
  community tracker.
