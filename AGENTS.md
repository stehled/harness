# Agent instructions

This repository is a harness for coding agents. It holds the rules, the hooks, the skills and the
evals. The application that the harness drives comes later, ticket by ticket.

Read these files before your first change:

- `CONTRIBUTING.md`: how work moves. One ticket, one worktree, one branch, one pull request.
- `CONTEXT.md`: the words this repository uses. Use them, and do not use their synonyms.
- `docs/testing.md`: before you write a test. It decides the seam of each test.
- `docs/adr/`: the decisions. If your change contradicts one, say so in the pull request.

## Workflow

- Claim the ticket with `gh issue edit <n> --add-assignee @me` before the first commit.
- Make the worktree under `.claude/worktrees/`. A `PreToolUse` hook corrects a wrong path, but give
  the correct path yourself. The main checkout is shared by every agent at the same time.
- Run `pnpm install`, then `pnpm env:init`. Never copy the `.env` of a different worktree.
- Never write a port number into code, a test or a config file. Read it from the environment.
- Push the branch and open the pull request as a draft when you consider the ticket done. Do not
  wait to be asked. A `Stop` hook does the same as a backstop, but the decision is yours.
- Run `pnpm verify` before you mark the pull request ready. Report what you ran and what it said.

## Comments

Do not write comments in code, in production code or in tests. A name, a type or a test carries
the reason. A comment needs the approval of the owner: ask first, and give the reason that a name,
a type or a test cannot carry. A directive that a tool reads (`biome-ignore`, a JSDoc type) is not
a comment.

## Parallel work

Before several agents start on a batch of tickets, run the `plan-waves` skill. It predicts the files
of each ticket and keeps two tickets that collide out of the same wave. When your pull request must
edit a file that a different open pull request declares, stop and comment on the plan issue.

## Skills

The engineering skills of Matt Pocock (`to-spec`, `to-tickets`, `domain-modeling`, `tdd`,
`diagnosing-bugs`, `code-review`) are the base layer. `docs/agents/issue-tracker.md` tells them
where the issues live. `plan-waves` in `.claude/skills/` belongs to this repository.
