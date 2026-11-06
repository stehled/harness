# agent-harness

The harness I use to direct coding agents on a production TypeScript monorepo: the rules, the
hooks, the skills and the evals. Agents write the code. People write the specs, review the pull
requests and own what ships.

This repository holds the harness only. The application that it drives comes next, ticket by
ticket, built with this harness.

## Where it comes from

I built the harness on a private SaaS (NestJS, Next.js, Postgres, Redis) that I direct
with Claude Code. Its code stays private. The numbers below are from that repository:

|                 |                                                                            |
| --------------- | -------------------------------------------------------------------------- |
| Parallel agents | up to 6 at a time, each in its own worktree and slot                       |
| Decisions       | 34 ADRs, and a glossary of 1,700 lines that agents read before they work   |
| Tests           | about 140 Seam 1 files against a real Postgres, and about 360 Seam 2 files |

Each rule here exists because something went wrong there. [`docs/harness-log.md`](docs/harness-log.md)
names the failure behind each rule.

## The loop

```
spec issue ──▶ ticket issues ──▶ plan-waves ──▶ cards + Wave 0 + frontier
                                                        │
          ┌─────────────────────────────────────────────┘
          ▼
  one worktree per ticket ──▶ agent implements, Seam 1 test first ──▶ pnpm verify
  (own branch, own ports)                                                 │
          ▲                                                               ▼
          │                                             draft pull request, write set in the body
  rebase notice to the branches      ◀── integrator merges one at a time, hub first
  whose write set meets the diff                         │
                                                         ▼
                                   card eval: predicted write sets against merged diffs
```

## What is in it

| Part               | Path                                                                                         | What it does                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Agent instructions | [`AGENTS.md`](AGENTS.md), [`CONTRIBUTING.md`](CONTRIBUTING.md)                               | The working agreement, for people and agents                                                                              |
| Glossary           | [`CONTEXT.md`](CONTEXT.md)                                                                   | One word for one thing, with the synonyms to avoid                                                                        |
| Git hook           | [`.claude/hooks/enforce-git-conventions.mjs`](.claude/hooks/enforce-git-conventions.mjs)     | Rewrites a wrong command instead of refusing it: worktree path, branch checkout in the shared checkout, missing `--draft` |
| Edit hook          | [`.claude/hooks/block-main-checkout-edits.mjs`](.claude/hooks/block-main-checkout-edits.mjs) | Refuses an edit in the shared checkout when it is on a ticket branch                                                      |
| Stop hook          | [`.claude/hooks/push-and-open-pr.mjs`](.claude/hooks/push-and-open-pr.mjs)                   | Pushes finished work and opens the draft pull request                                                                     |
| Hook logic         | [`tools/hooks/`](tools/hooks/)                                                               | Pure functions with tests. The hooks only read, call and write                                                            |
| Slots              | [`tools/worktree/`](tools/worktree/)                                                         | `pnpm env:init`: each worktree gets its own ports and Compose project                                                     |
| Planner            | [`.claude/skills/plan-waves/`](.claude/skills/plan-waves/)                                   | Predicts the files of each ticket, scores the collision risk of each pair, plans waves                                    |
| Testing rules      | [`docs/testing.md`](docs/testing.md)                                                         | Which seam a test belongs to, and the tests that catch what an agent gets wrong where money moves                         |
| Orchestration      | [`docs/parallel-orchestration.md`](docs/parallel-orchestration.md)                           | Why worktrees do not prevent conflicts, and what does                                                                     |
| Decisions          | [`docs/adr/`](docs/adr/)                                                                     | The four decisions the harness rests on                                                                                   |
| Evals              | [`evals/`](evals/)                                                                           | A score for the hooks and for the planner                                                                                 |

## Evals

**Hooks.** [`evals/hooks/cases.json`](evals/hooks/cases.json) holds 26 commands and the rewrite
each must get. The tests run the corpus, and `pnpm eval` prints a score for each category. When I
moved the hook here, the corpus found four defects in the version that had run for two months.

```
$ pnpm eval
  worktree-path      7 / 7
  branch-checkout    9 / 9
  draft-pr           7 / 7
  combined           1 / 1
  no-op              2 / 2
  all               26 / 26
```

**Planner.** [`evals/plan-waves/run.mjs`](evals/plan-waves/run.mjs) compares the predicted write set
of each card with the diff of the pull request that closed the ticket. On 14 tickets of that SaaS:

| Confidence | Precision | Recall up to this level |
| ---------- | --------- | ----------------------- |
| certain    | 87%       | 47%                     |
| likely     | 27%       | 55%                     |

A `certain` line is usually right, but the cards saw only half of each write set. The missed files
were mostly module files, contracts and tests. They follow from files that the card did name, so
[`SURFACE-MAP.md`](.claude/skills/plan-waves/SURFACE-MAP.md) now has an "Always with" table.
[`evals/plan-waves/RESULTS.md`](evals/plan-waves/RESULTS.md) has the details.

## Built on

The engineering skills of [Matt Pocock](https://github.com/mattpocock/skills) are the base layer:
spec to tickets, the glossary and ADRs, TDD, diagnosis. This repository adds what those skills
do not cover:

- **Enforcement.** Hooks that rewrite a wrong command, with tests and an eval corpus.
- **Parallel agents in one repository.** Worktrees with their own ports and stacks, and a shared
  checkout that no agent can break.
- **Planning for collisions.** Predicted write sets, a collision risk for each pair, Wave 0, and an
  eval of the predictions.
- **Verification without mocks.** Seam 1 against a real database, concurrent mode for races, and a
  list of the tests that catch what an agent gets wrong where money moves.
- **Thin CI.** Cheap checks on each push, the expensive suites on request, and the local
  `pnpm verify` as the evidence.

## Try it

```sh
pnpm install
pnpm verify        # lint, the tests of the tools, and the hook eval
pnpm env:init      # writes .env with the ports of this checkout's slot
```

To use the harness in a different repository, copy `.claude/`, `tools/`, `evals/`,
`harness.config.json` and the documents, then set the project name and the reviewer in
`harness.config.json`.
