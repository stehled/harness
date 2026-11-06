# Agent harness

The words of this repository. A word here has one meaning. Use the word, and do not use the
synonyms under _Avoid_.

## Work

**Spec**:
A GitHub issue that states a problem and its solution. A spec is too large for one pull request.
_Avoid_: epic, PRD, story

**Ticket**:
A GitHub issue that is one part of a spec. It holds the acceptance criteria. One agent finishes it
and one reviewer reviews it in one sitting. It has the label `ticket`, and `ready-for-agent` when no
blocker is open.
_Avoid_: task, story, card

**Blocker**:
A ticket that must merge before a different ticket can start. GitHub records it as an issue
dependency.
_Avoid_: dependency, prerequisite

**Main checkout**:
The first checkout of the repository. Every agent shares it, so no agent does ticket work in it.
It stays on the default branch.
_Avoid_: root checkout, primary repo

**Worktree**:
A second checkout of the repository under `.claude/worktrees/`, for one ticket. It has its own
branch, its own `node_modules` and its own slot.
_Avoid_: clone, sibling checkout

**Slot**:
The number that gives a worktree its own ports and its own Compose project. It is the issue number
in the name of the branch. The main checkout has slot 0.
_Avoid_: port offset, instance

## Parallel work

**Write Set**:
The files that a ticket changes. Before the work, it is a prediction on the card. After the work,
it is the diff of the pull request.
_Avoid_: footprint, touched files

**Card**:
A comment on a ticket that `plan-waves` writes. It holds the predicted write set, the reads, the
missing abstractions and the test file.
_Avoid_: plan, task card

**Collision Risk**:
A number from 0 to 1 for a pair of tickets. It tells how probably their pull requests conflict.
`plan-waves` writes it as `W(i, j)`.
_Avoid_: overlap score, conflict probability

**Wave**:
A set of tickets that can run at the same time. Wave 0 holds the shared declarations and runs
alone, before the others.
_Avoid_: batch, sprint, phase

**Frontier**:
The tickets that can start now. The planner computes it again after each merge.
_Avoid_: queue, backlog

**Integrator**:
The person or the agent that merges green pull requests one at a time and tells the affected
branches to rebase.
_Avoid_: merger, release manager

## Verification

**Seam**:
A place where a test drives the code from outside. This repository has three. Seam 1 is the real
application over HTTP with a real database. Seam 2 is a pure function. Seam 3 is the browser.
_Avoid_: layer, level, test type

**Hook**:
A script that Claude Code runs before or after a tool call, or when a session stops. A hook here
rewrites a command, refuses an edit or pushes a branch. `.claude/settings.json` lists them.
_Avoid_: guard, trigger

**Eval**:
A fixed set of inputs with expected outputs that measures a hook or a skill. Each eval lives in
`evals/` and prints a score.
_Avoid_: benchmark, test suite
