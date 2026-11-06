# Parallel agents without the merge tax

How to run many coding agents against one repository and merge their work with little manual
conflict resolution. `.claude/skills/plan-waves/SKILL.md` is the operational half of this document.

The objective is net throughput:

```
benefit of parallel work
  − minutes of conflict resolution
  − rework from stale branches
  − coordination overhead
  − semantic failures after a clean merge
```

Three levers move it. In order of return: remove the files that make any two tickets collide. Put
the shared declarations first, so that behaviour tickets are independent. Then schedule what is
left. A scheduler alone, on a bad file layout, gains little.

## 1. Why worktrees do not solve this

A worktree isolates a working tree. Two agents no longer overwrite each other's files on disk. But a
conflict does not live on disk. It lives in the change sets that the branches carry back to `main`.
Worktrees also make it cheap to keep many branches alive, so each branch drifts further from `main`.

In the earlier repository that this harness comes from, these files caused most conflicts:

| File                          | Share of feature-sized pull requests that touch it | Why it conflicts                         |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------- |
| the database schema, one file | 61%                                                | one 900-line file for every table        |
| the migration journal         | 61%                                                | generated, with a serial index           |
| the contracts barrel          | 57%                                                | each ticket appends a line               |
| the message catalogues        | 43%                                                | one sorted flat object for each language |
| the root API module           | 39%                                                | each module appends to one list          |
| the lockfile                  | 29%                                                | lockfile                                 |

These are the worst kind of shared file: **sets written as lists**. Git merges them as sequences,
so two appends at the same end conflict every time.

## 2. Kinds of conflict

| Kind                   | Example                                    | Does Git see it? | Fix                                                    |
| ---------------------- | ------------------------------------------ | ---------------- | ------------------------------------------------------ |
| A. Adjacent lines      | two edits in one large service             | yes              | a new file for each ticket, scheduling                 |
| B. Registry            | barrel, module list, navigation, catalogue | yes, always      | merge as a set: union driver and a uniqueness test     |
| C. Generated sequence  | migration files and journal                | yes, always      | regenerate at integration, never resolve by hand       |
| D. Lockfile            | `pnpm-lock.yaml`                           | yes              | `pnpm install` resolves it, dependencies go to Wave 0  |
| E. Schema and contract | two changes to one table or one zod shape  | sometimes        | Wave 0 of contracts, schema split by area              |
| F. Semantic            | a clean merge, a wrong program             | no               | test the merged tree before the merge, invariant tests |
| G. Test                | appends to one shared test file            | yes              | one new Seam 1 file for each ticket                    |
| H. Configuration       | `.env.example`, CI                         | yes              | union, or serial in Wave 0                             |
| I. Architecture        | two agents extract the same abstraction    | both             | a refactor runs alone, at a wave boundary              |

Kind F costs the most for each incident, because it reaches `main`. Kinds B and C cost the most in
total, because they hit almost every pair.

## 3. Mitigations

1. **Registries merge as sets.** `merge=union` in `.gitattributes` on append-only files, with a test
   that asserts uniqueness and completeness.
2. **Generated files are regenerated.** A script drops the migration of the branch and generates it
   again on the rebased schema. `pnpm install` does the same for the lockfile.
3. **Schema by area.** One schema file for each area, and a barrel.
4. **Wave 0 of contracts.** One serial ticket lands every shared table, enum, contract and port with
   a no-op implementation. Behaviour tickets then seed rows through `app.db` instead of calling
   each other's endpoints. Most blockers become soft.
5. **Predicted write sets.** Each ticket gets a card with its predicted files. Each pair gets a
   collision risk. Only pairs with a low risk run together.
6. **An integrator loop.** Green pull requests merge one at a time, hub first. Only the branches
   whose write set meets the merged diff rebase.
7. **Stacked branches for a chain.** One agent takes a chain of tickets, each branch on the last.
8. **Refactor quarantine.** A ticket that says extract, consolidate or "one shared" runs alone.
9. **Split a ticket on the overlap.** The disjoint part runs now, the overlapping part later.

## 4. Architecture

**A frontier scheduler with an integrator loop, shown to people as waves.**

A static wave finishes when its slowest ticket finishes, so slots stay empty. A frontier that the
planner computes again after each merge keeps every slot busy. Waves are still the right thing to
show: a person reads "Wave 1: these six" and sees the shape of the batch.

| Component       | Where                                            | What it holds                                          |
| --------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Surface map     | `.claude/skills/plan-waves/SURFACE-MAP.md`       | which files the words of a ticket imply                |
| Co-change index | `.claude/skills/plan-waves/scripts/cochange.mjs` | hotspots and `P(file \| module)` from `git log`        |
| Cards           | a comment on each ticket                         | predicted writes with confidence and kind              |
| Plan issue      | an issue with the label `plan`                   | Wave 0, frontier, projection, risk matrix              |
| Write set       | the body of each pull request                    | the declared files, kept true by the implementer       |
| Card eval       | `evals/plan-waves/run.mjs`                       | precision and recall of the cards against merged diffs |

## 5. Metrics

Measure these for each batch, and compare them with the batch before:

- Conflicts that a person resolved, for each merged pull request.
- Rebases for each merged pull request.
- Time from "ready" to "merged".
- Precision and recall of the cards (`evals/plan-waves/run.mjs`).
- Semantic failures found on `main` after a merge.
