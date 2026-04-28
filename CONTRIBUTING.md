# Contributing

Thanks for your interest in `std-osc8`. This guide covers what you need to
know to set up a working environment, run the test suite, and submit a
change that has a good chance of being merged.

## Prerequisites

- **Node.js** ≥ 24.11.0 (declared in `devEngines.runtime`)
- **pnpm** 10.33.2 (declared in `packageManager`; matched via Corepack)
- A terminal that emits OSC8 hyperlinks if you want to manually verify
  rendering — see the
  [allowlist](./docs/terminals.md) for the recognized set.

## Setup

```bash
git clone https://github.com/spencerbeggs/std-osc8.git
cd std-osc8
pnpm install
pnpm run test
pnpm run build
```

Husky installs git hooks via the `prepare` script on `pnpm install`.

## Project structure

```text
src/                 # public API (10 files, single responsibility per file)
__test__/            # vitest suites (filename convention determines kind)
__test__/utils/      # shared fixtures (excluded from test discovery)
.claude/design/      # canonical architecture documentation
docs/                # repository-level user docs
.changeset/          # pending release notes
.github/             # CI workflows, issue templates, PR template
lib/configs/         # commitlint, lint-staged, markdownlint configs
```

Architecture lives in `.claude/design/std-osc8/`. Read the relevant doc
before modifying behavior — do not infer architecture from source alone.

## Development workflow

| Command | Purpose |
| --- | --- |
| `pnpm run test` | Run vitest once |
| `pnpm run test:watch` | Watch mode |
| `pnpm run test:coverage` | v8 coverage report |
| `pnpm run typecheck` | tsgo type-check (via Turbo) |
| `pnpm run lint` | Biome check |
| `pnpm run lint:fix` | Biome fix (safe transforms) |
| `pnpm run lint:fix:unsafe` | Biome fix (including unsafe transforms) |
| `pnpm run lint:md` | markdownlint |
| `pnpm run lint:md:fix` | markdownlint with --fix |
| `pnpm run build` | Build dev + prod outputs via Turbo |
| `pnpm run build:inspect` | Inspect the production rslib config |

The `pre-commit` hook runs lint-staged; the `commit-msg` hook validates
the message; the `pre-push` hook runs tests for affected packages. Do
not bypass hooks unless you understand why; if a hook fails, fix the
underlying issue rather than skipping.

## Commit conventions

All commits must satisfy two rules, both enforced by the `commit-msg`
hook:

1. **Conventional Commits** — `type(scope?): subject`. Allowed types are
   `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
   `ci`, `chore`, `revert`, and `release`. The body must not contain
   markdown formatting (no `**bold**`, no `__italic__`, no headers).
2. **DCO sign-off** — every commit body ends with
   `Signed-off-by: Your Name <you@example.com>`. Use `git commit -s` to
   add this automatically. The DCO is reproduced in `DCO` at the repo
   root; signing off certifies you wrote the change or have the right
   to submit it.

Example:

```text
feat(detect): recognize Foot ≥ 1.13 via TERM_PROGRAM

Foot started setting TERM_PROGRAM in 1.13. The existing TERM=foot rule
remains as a fallback for older versions.

Signed-off-by: Jane Doe <jane@example.com>
```

The pre-commit linter will rewrite `__test__` to `\\_\\_test\\_\\_` if
it appears in your commit body — `__text__` is parsed as bold by the
markdown rule. Avoid using underscores around words in commit messages.

## Pull request workflow

1. Fork the repo and create a branch off `main`. Branch names are
   informational; `feat/...`, `fix/...`, `docs/...` are conventional.
2. Make your change with focused commits.
3. Run `pnpm run test`, `pnpm run typecheck`, `pnpm run lint`, and
   `pnpm run lint:md` locally — all must pass.
4. Open a PR against `main`. The PR template will guide you through
   what to fill in.
5. CI runs the same checks plus a build + DCO verification. The PR
   stays in draft until CI is green.

A maintainer reviews. If they request changes, push more commits to
the same branch — do not force-push during review unless asked.

## Adding a new terminal to the allowlist

This is the most common third-party contribution. The full process is
in [`docs/terminals.md`](./docs/terminals.md#adding-a-terminal); the
short version:

1. Identify a stable env-var signal for the terminal (a `TERM_PROGRAM`
   value, a dedicated env var, etc.).
2. Add a `TerminalEntry` to `src/terminals.ts`. Cite the
   [OSC8-Adoption](https://github.com/Alhadis/OSC8-Adoption) row with
   the upstream commit hash in a comment.
3. Add the canonical name to the `KnownTerminal` union in `src/types.ts`.
4. Add a fixture in `__test__/utils/fixtures.ts` and tests in
   `__test__/terminals.test.ts` covering identification, version
   threshold, and capability flags.
5. Update [`docs/terminals.md`](./docs/terminals.md) with the new row.

## Design-first workflow for non-trivial changes

For new features or architectural changes:

1. Update or add a design doc in `.claude/design/std-osc8/` describing
   the change. The four current docs are
   [`architecture`](./.claude/design/std-osc8/architecture.md),
   [`detection-precedence`](./.claude/design/std-osc8/detection-precedence.md),
   [`terminal-allowlist`](./.claude/design/std-osc8/terminal-allowlist.md),
   and [`out-of-scope`](./.claude/design/std-osc8/out-of-scope.md).
2. Open a "design-only" PR or include the design update in the
   implementation PR. Either is fine; flag which in the PR description.
3. Implement against the design. If the architecture changes during
   implementation, update the design doc in the same PR.

Bug fixes, dependency bumps, and pure refactors don't need a design
update.

## Out of scope

The following are **deliberately not in scope** and PRs adding them
will be redirected. See
[`out-of-scope`](./.claude/design/std-osc8/out-of-scope.md) for the
rationale:

- Subprocess spawning (`tmux -V`, `screen -v`, etc.). Detection stays
  pure env-var + isTTY.
- Async detection. The package is sync-only.
- Color, unicode, or general TTY feature detection. Use
  [`std-env`](https://github.com/unjs/std-env) and friends.
- Tmux config file parsing.
- An Effect sub-export. Effect users can wrap the sync core in their
  own service/layer per project, or a separate `effect-std-osc8`
  package can be authored externally.

## Testing

- All tests live under `__test__/` — never co-located in `src/`.
- Filename suffix determines kind:
  `*.test.ts` (unit), `*.int.test.ts` (integration),
  `*.e2e.test.ts` (e2e). The package is currently unit-only.
- Helpers go in `__test__/utils/`; static fixtures go in
  `__test__/fixtures/`. See `__test__/CLAUDE.md`.
- New behavior needs new tests. Bug fixes need a regression test.
- Detection logic should be tested through `detect()` against synthetic
  `ProcessSnapshot` inputs — not by mocking `process.env` globally.

## Changesets

User-facing changes need a changeset. Pure refactors, internal docs,
and CI-only changes don't.

```bash
pnpm changeset
```

Pick `patch` for bug fixes, `minor` for new features or non-breaking
additions, `major` for breaking changes. Write the description for
someone reading the changelog at upgrade time, not for the reviewer.
The changeset format is the section-aware
[`@savvy-web/changesets`](https://github.com/savvy-web/changesets)
format — see `.changeset/initial-release.md` for an example.

## CI workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `release.yml` | push / PR on `main` | Test, type-check, lint, build; release on merge to `main` |
| `dco.yml` | PR | Verify every commit has a valid DCO sign-off |
| `claude.yml` | issue / PR comment | Run Claude Code in response to `@claude` mentions |
| `pnpm-update.yml` | schedule | Bump pnpm version when a new release lands |

The `claude.yml` workflow lets reviewers ask Claude to investigate or
respond on issues and PRs. Tag `@claude` in a comment to invoke it.

## Reporting bugs and proposing features

Issue templates live in `.github/ISSUE_TEMPLATE/`:

- [Bug report](./.github/ISSUE_TEMPLATE/bug-report.en-US.yml) for
  observed-vs-expected behavior with reproduction.
- [Feature request](./.github/ISSUE_TEMPLATE/feature-request.en-US.yml)
  for proposing additions; please check
  [`out-of-scope`](./.claude/design/std-osc8/out-of-scope.md) first.

For terminal-allowlist additions, opening an issue is optional — a PR
is more efficient.

## License

`std-osc8` is [MIT-licensed](./LICENSE). By contributing, you agree
your contributions are licensed under the same terms.
