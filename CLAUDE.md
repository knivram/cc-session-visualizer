# CC Session Visualizer

Converts Claude Code session JSONL exports into HTML sequence diagrams showing agent spawns, messages, results, and shutdowns across phases.

## Quick Start

```bash
bun install
bun run src/index.ts <path-to-session.jsonl>   # any session
bun run test                                     # bundled test session
```

## Architecture

- `src/index.ts` — CLI entry point. Accepts a JSONL path or `--test` flag.
- `src/parser.ts` — Parses JSONL + subagent files into a `Session` (phases, agents, events).
- `src/renderer.ts` — Renders a `Session` into a self-contained HTML file with inline CSS/JS.
- `src/types.ts` — Shared type definitions (`Session`, `Phase`, `Agent`, `Event`).

## Test Fixtures

`test-session.jsonl` and `test-session/subagents/` are committed copies of a real session used for development and screenshot testing. They are un-ignored in `.gitignore`.

## Screenshots with Playwright

Playwright is a dev dependency for taking screenshots of generated HTML:

```bash
bunx playwright install --with-deps chromium     # one-time browser install
bun run test                                      # generate HTML
bunx playwright screenshot --full-page "file://$(pwd)/session-test-ses.html" screenshot.png
```

Useful flags: `--viewport-size 1920,1080`, `--full-page`, `--wait-for-timeout <ms>`.

## Conventions

- Runtime: Bun (not Node)
- Language: TypeScript (strict, no `any`)
- Output HTML files are gitignored (`session-*.html`)
- Session data files (`*.jsonl`, `*/subagents/`) are gitignored except test fixtures
