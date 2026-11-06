# Contributing

This file tells how work moves through this repository. It is for people and for agents. A rule
that stays in one head must be learned again for each ticket. The rules are here so that nobody
has to ask.

## Write in Simplified Technical English

Write every text in the repository and in GitHub in Simplified Technical English (ASD-STE100). This
applies to Markdown, commit messages, pull requests, issues and names in code.

- Write short sentences: 20 words or fewer in an instruction, 25 or fewer in a description.
- Put one idea in one sentence. Use the active voice. Write an instruction as a command.
- Use one word for one thing. `CONTEXT.md` holds the words.
- Do not use slang, a metaphor or a joke.

These rules control the text in the repository. They do not control how you speak in a session.

## Do not write comments in code

A name, a type or a test tells the reader what the code does and why. A comment needs the approval
of the owner. Ask first, and give the reason that a name, a type or a test cannot carry. A
directive that a tool reads is not a comment.

## The unit of work is a ticket

A **spec** issue gives a problem and its solution. A **ticket** issue is one part of a spec, small
enough to finish and review in one sitting. The ticket holds the acceptance criteria, and the pull
request must satisfy them. Take a ticket only if no blocker is open.

```sh
gh issue list --label ready-for-agent   # the open work
gh issue view 12                        # what to build, and what "done" means
gh issue edit 12 --add-assignee @me     # claim it before the first commit
```

## Every ticket gets a worktree

Use one worktree, one branch and one pull request for each ticket.

```sh
git fetch origin main
git worktree add .claude/worktrees/agent-harness-12 -b feat/12-ledger origin/main
cd .claude/worktrees/agent-harness-12
pnpm install
pnpm env:init
```

**Always start the branch from `origin/main`.** The main checkout can be on any commit. A branch
from that commit carries the unmerged work of a different agent into your pull request.

Name the branch `<type>/<issue>-<slug>`. The type is `feat`, `fix`, `chore` or `docs`.
`harness.config.json` holds the list.

Two hooks in `.claude/settings.json` enforce this. Do not depend on them:

- `enforce-git-conventions.mjs` rewrites a `git worktree add` outside `.claude/worktrees/`. It
  rewrites a `git checkout -b`, a `git switch -c` or a `git switch <branch>` in the main checkout
  into a `git worktree add` and a `cd`. It adds `--draft` to a `gh pr create`.
- `block-main-checkout-edits.mjs` refuses an edit in the main checkout when the main checkout is not
  on the default branch.

After the pull request merges, remove the worktree:

```sh
pnpm infra:down --volumes
git worktree remove .claude/worktrees/agent-harness-12
git branch -d feat/12-ledger
```

### Worktrees do not share ports

`pnpm env:init` gives each worktree a **slot**: the issue number in the name of the branch. A branch
without an issue number gets a stable slot from the hash of its path. Each slot owns a block of ten
ports and its own Compose project.

|                 | main checkout   | slot 12            | slot _n_            |
| --------------- | --------------- | ------------------ | ------------------- |
| web             | 3000            | 20120              | 20000 + _n_ × 10    |
| api             | 3001            | 20121              | + 1                 |
| postgres        | 5432            | 20122              | + 2                 |
| redis           | 6379            | 20123              | + 3                 |
| Compose project | `agent-harness` | `agent-harness-12` | `agent-harness-<n>` |

- **Read a port from the environment. Never write a port into a file.**
- **Run Compose with `pnpm infra:up` and `pnpm infra:down`** from the root of the worktree.
- **Do not copy the `.env` of a different worktree.** Run `pnpm env:init` again to see the URLs.

## Pull requests

- Open the pull request as a draft when the implementation is done. Do not wait to be asked. The
  `Stop` hook pushes and opens the draft if a session ends before you do.
- Assign it to yourself. The reviewer comes from `harness.config.json`.
- The body states what changed and why, the acceptance criteria as a checklist, and how you tested
  it. When a `plan-waves` card exists, the body carries a `## Write set` section and keeps it true.
- Merge by squash. One commit on `main` is one ticket. `cochange.mjs` depends on this.

## Run the checks locally

CI runs only the cheap checks: lint and the tests of `tools/`. When the application exists, CI will
also run typecheck, build and Seam 2. Seam 1 and Seam 3 run on a runner only on request.

Therefore `pnpm verify` on your machine is the evidence that a change is sound. Run it before you
mark the pull request ready, and report what it said. Do not poll a CI run and do not wait for it.
