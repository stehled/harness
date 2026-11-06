# One ticket, one worktree, and the main checkout stays on the default branch

Several agents work in this repository at the same time. They share one main checkout. When one
agent switches a branch or resets in the main checkout, it changes the files of every other agent
that works there. In the production repository that this harness comes from, a hard reset in the main checkout erased the uncommitted work of a
different agent.

Each ticket gets its own worktree under `.claude/worktrees/`, its own branch from `origin/main` and
its own slot of ports. The main checkout stays on the default branch. A hook rewrites a branch
command in the main checkout into a worktree, and a second hook refuses edits there as a backstop.

## Consequences

- Each worktree runs `pnpm install`, so disk use grows with each open ticket.
- Each worktree runs its own Compose stack. `pnpm infra:down --volumes` removes it.
- A person who wants to try a branch also makes a worktree. `git switch` in the main checkout
  becomes a worktree too.
