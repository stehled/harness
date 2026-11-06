---

name: plan-waves
description: Plan a batch of GitHub tickets into parallel waves, with each ticket's predicted write set and the collision risk between tickets.
disable-model-invocation: true
argument-hint: "[issue numbers…] [--slots N] [--serial] [--no-wave0] [--dry-run]"
allowed-tools: Bash(gh:_), Bash(git log:_), Bash(git show:_), Bash(git ls-tree:_), Bash(node:_), Bash(wc:_), Read, Grep, Glob
---

# Plan waves

Turn a backlog into an execution plan that keeps as many agents busy as possible while the merges
stay clean. The plan is a **frontier** (what to start now) plus a **projection** (the waves that
follow if the predictions hold). It is recomputed after every merge; the waves are a report for the
human, not a lock.

The design and its rationale are in `docs/parallel-orchestration.md`. `SURFACE-MAP.md` beside this
file says which files a ticket's words imply; `scripts/cochange.mjs` says which files history
implies.

## 1. Fix the batch

The batch is the ticket numbers given, or, with none given, every open issue labelled
`ready-for-agent` and `ticket`. Add any open ticket whose blockers all lie inside the batch, so a
chain is planned whole. Read each one with `gh issue view <n> --comments` and keep title, body,
acceptance criteria, open blockers and any earlier plan card in the comments.

Also collect what is already in flight: `gh pr list --state open --json number,title,headRefName,isDraft`
and, for each, `gh pr diff <n> --name-only`. An in-flight branch's real write set is a fact, not a
prediction; it takes part in the risk matrix at confidence `certain`.

Done when: a numbered list of tickets and a list of in-flight PRs with their files.

## 2. Gather evidence

Run `node .claude/skills/plan-waves/scripts/cochange.mjs --for <prefix>` once per module the
batch names (`apps/api/src/ledger`, `apps/api/src/payouts`…). For any file that the surface map calls
large-shared, note its length with `git show origin/main:<path> | wc -l`.

Done when: the hotspot table and one co-change table per named module are in context.

## 3. Write a card per ticket

Using `SURFACE-MAP.md`, derive for each ticket:

```
#30 Record a payout request, with a balance check
type: feature            size: L (est. 12 files)
blockers (open): #29     soft after Wave 0: yes — seed a deposit row via app.db
writes:
  certain  new   apps/api/src/payouts/{payouts.controller,payouts.service}.ts
  certain  new   apps/api/src/payouts/payouts.integration.test.ts
  certain  new   packages/contracts/src/payout.ts
  certain  reg   packages/contracts/src/index.ts
  certain  sch   packages/db/src/schema/payouts.ts (payouts table, payout_status enum)
  certain  gen   packages/db/drizzle/* (one migration)
  certain  reg   apps/api/src/app.module.ts (register PayoutsModule)
  likely   new   apps/web/src/app/payouts/, apps/web/src/lib/payouts.ts
  likely   edit  apps/api/src/ledger/ledger.service.ts (balance read under a row lock)
reads: balance projection (#29), account access predicate
needs (missing abstractions): none
test file: payouts.integration.test.ts (new)
```

Confidence is `certain`, `likely` or `possible`. Kind is `new`, `edit`, `reg` (registry), `cat`
(catalogue), `sch` (schema), `gen` (generated), `cfg`, `lock`, `test` (appending to an existing test
file). `needs` lists abstractions the ticket relies on that do not exist on `main`; the word
"notified" in a ticket before a notification port exists is the canonical case.

Done when: every ticket has a card, every card names its test file and says whether it carries a
migration, and every `needs` entry is either owned by a ticket in the batch or flagged for Wave 0.

## 4. Score every pair

Collision risk `W(i, j)` in `[0, 1]`, from the two cards:

**Textual.** For each path in both write sets, contribution `c(kind) × p_i × p_j`, with
`p ∈ {certain 0.9, likely 0.6, possible 0.3}` and

| kind                                                                     | c   | after the Stage 1 fixes in `docs/parallel-orchestration.md` |
| ------------------------------------------------------------------------ | --- | ----------------------------------------------------------- |
| generated (migration files, journal)                                     | 1.0 | 0.1 (integrator regenerates)                                |
| registry (barrels, module lists, navigation, audit actions, enum parity) | 0.9 | 0.1 (union merge + uniqueness test)                         |
| catalogue                                                                | 0.8 | 0.2                                                         |
| test (appending to one existing test file)                               | 0.6 | 0.1 (one test file per ticket)                              |
| schema, single-file                                                      | 0.6 | 0.3 (split by domain)                                       |
| large-shared (500+ lines, 5+ historic touches)                           | 0.5 | 0.5                                                         |
| config, lockfile                                                         | 0.4 | 0.2 (`pnpm install` resolves the lockfile)                  |
| ordinary                                                                 | 0.3 | 0.3                                                         |
| new file, both tickets create the same path                              | 1.0 | 1.0                                                         |

`W_text = 1 − Π(1 − contribution)`.

**Semantic.** Add, as further factors in the same product:

- 0.7 when both tickets `need` the same missing abstraction.
- 0.6 when both add values to the same enum or columns to the same table.
- 0.5 when one ticket edits a shared abstraction (see the surface map) the other reads.
- 0.3 when both carry a migration, 0.1 once the regenerate script exists.
- 0.4 when both are refactor-type tickets, whatever their files.

Use the "after" column for a kind only when the fix for it is merged on `main`; check, do not
assume.

Done when: a matrix over the batch plus in-flight PRs, and one sentence for every `W > 0.25`
naming the shared paths or the semantic edge.

## 5. Decide Wave 0

Wave 0 is one serial ticket of declarations and no-op implementations, run before everything else.
It exists when any of these holds, and is skipped otherwise (or with `--no-wave0`):

- Two or more tickets add tables, columns or enum values: Wave 0 carries all of that schema, one
  migration, the matching contracts, enum-parity entries, audit action names and catalogue label
  keys. Behaviour stays in the tickets, which then seed rows through `app.db` in Seam 1 instead of
  waiting for one another's endpoints. This is what makes a blocker chain soft.
- A `needs` entry has no owner: Wave 0 adds the port with a recording no-op implementation.
- Two or more tickets add a dependency: Wave 0 adds them, so the lockfile changes once.

Write Wave 0 as a ticket body: exact tables, enums, contract types, port signature, key prefixes.
Open it with `gh issue create --label ready-for-agent --label ticket --label contract`.

Done when: Wave 0 is a created issue, or the plan states why there is none.

## 6. Schedule

Slots `K` come from `--slots`, default 6. `--serial` sets `K = 1`, which still orders the batch.

```
merged   = set()                       # tickets on main
inflight = open PRs from step 1
ready(t) = every open blocker of t is in merged, or made soft by Wave 0 and the card says how
priority(t) = depth(t) + 0.5 × dependents(t) + 0.5 × hub(t)
              # depth: longest blocker chain below t; hub: number of tickets with W(t, ·) > 0.25

frontier():
  chosen = []
  for t in ready tickets sorted by priority, descending:
    if len(inflight) + len(chosen) == K: break
    risk = max(W(t, u) for u in inflight + chosen)
    if risk <= 0.25:                         chosen.append(t)
    elif risk <= 0.5 and mitigation(t, u):   chosen.append(t) with the mitigation named
    elif same module as u and u not merged:  stack t on u  (same agent, branch from u's branch)
    else:                                    defer t, reason "W(t,u) = risk via <paths>"
  return chosen

projection(): repeat frontier(); merged += chosen; inflight = [] — until every ticket is placed.
```

Rules the loop obeys:

- Wave 0 and any refactor-type ticket runs in a wave of its own.
- A ticket that edits a shared abstraction goes first in its wave or after the wave; never beside a
  reader of that abstraction.
- Two tickets with `W > 0.5` never share a wave. If the overlap is one surface (a projection, a
  route, a file), split the ticket: the disjoint part now, the overlapping part after the other
  ticket merges, as `#41a` / `#41b` with the split written into both cards.
- Mitigations that lower a pair from the middle band to admissible, named on the card: new files
  instead of edits to a shared file; a new test file; a distinct catalogue key prefix; seeding via
  `app.db` instead of calling the other ticket's endpoint; the later ticket rebases when the earlier
  one merges.
- Hubs merge first at a checkpoint, so that one rebase in each dependent replaces many.
- The last wave is a cleanup ticket when three or more tickets in the batch introduce the same shape
  (a second copy of an orchestrator, a third accept path, ad hoc notification calls). Write it as an
  issue body naming the copies.

Done when: every ticket appears exactly once: in a wave, stacked on a named ticket, split into
named parts, or deferred with a reason.

## 7. Publish

Without `--dry-run`:

- One plan issue, labelled `plan` (`gh label create plan` if absent), body in the format below.
- One comment per ticket carrying its card, followed by the implementer's instructions from the
  block below. `gh issue view --comments` is how the implementing agent finds it.
- With a previous plan issue still open: close it with a comment linking the new one.

With `--dry-run`: print the plan and stop.

Done when: the plan issue URL is printed, and every ticket has its card comment.

## Plan format

```
# Plan 2026-11-10 — 9 tickets, 6 slots

Wave 0 (serial)   #40 Ledger and payout contracts
   why: #30 #31 #33 add tables and enums; #31 #34 both "notify" and nothing exists to call
Checkpoint: merge #40

Wave 1 (5)        #29  #30  #32  #35  #36a
   #29  hub: #30 #36b read its balance projection → merges first
   #30  W(#29)=0.31 via app.module.ts → own files under payouts/, seeds a deposit via app.db
   #32  new module, no edges
   #35  disjoint context; carries its own migration
   #36a pure limit calculator only; #36b waits for #29
   stacked: #31 on #30, same agent
Checkpoint: #32 #35 #36a as green; #29; then #30 → rebase notice to #31

Wave 2 (2)        #31 (retarget) #36b
Wave 3 (serial)   #41 Cleanup: one balance read path

Deferred: #33 (W(#31)=0.6 via payouts.service approve/reject; after Wave 2)

Risk matrix: (attached table)
```

## Implementer instructions (pasted under each card)

> **Write set.** Put the card's `writes` block in the PR body under a `## Write set` heading and keep
> it true: when you edit a path not in it, add the path with one line of reason. New behaviour goes
> in the files marked `new`; a file marked `reg`/`cat`/`sch` gets appended entries only.
> **Tests.** One new Seam 1 file, the one the card names; never append to another ticket's.
> **Seeding.** Where the card says "seed via app.db", write rows directly in the test rather than
> calling a sibling ticket's endpoint.
> **Drift.** If you must edit a file another in-flight PR declares, stop and comment on the plan
> issue with the path and why; the integrator decides whether you rebase now or they do.
> **Rebase.** When the integrator comments "rebase: #N merged touching <paths>", rebase onto
> `origin/main` before your next push. Migration and lockfile conflicts are mechanical: follow
> `docs/parallel-orchestration.md` § Reconciliation recipes.

## Escape hatches

- `--serial`: one slot; the output is an order, still with cards and Wave 0.
- `--no-wave0`: every ticket carries its own schema; expect more rebases.
- `pin #31 wave 2` in the arguments: placement fixed, the risk sentence still printed.
- A human comment `override: run #A with #B` on the plan issue outranks the matrix; note it.
- `--slots 1` on a refactor-only batch is the honest answer, and the plan should say so.

## Measure the cards

After the tickets of a plan merge, score the cards against the merged diffs:

```sh
node evals/plan-waves/run.mjs --issues 29,30,31,32
```

The report gives the precision of each confidence level and the recall up to it. It also lists each
changed file that no card line predicted. When one kind of file shows up in that list on more than
one ticket, add a rule to the "Always with" table of `SURFACE-MAP.md`. Record the numbers in
`evals/plan-waves/RESULTS.md`.

## Invariants

- Every ticket placed exactly once.
- No ticket precedes an open blocker unless the card says how Wave 0 made it soft.
- No pair in one wave with `W > 0.5`; every pair in `(0.25, 0.5]` has a named mitigation.
- Every registry, catalogue, schema or generated path in a write set is named with its handling.
- Every missing abstraction has exactly one owner that merges before its readers start.
- Refactor tickets and Wave 0 run alone.
- Wave 0 contains declarations and no-op implementations only.
