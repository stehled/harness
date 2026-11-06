# Surface map

What a ticket touches, by the words in it. Step 3 of `plan-waves` reads this file. Nothing here is a
step.

This map describes the layout that the first application tickets will create: a NestJS API, a React
web app, shared contracts and one database package. When the repository has 20 or more merged
tickets, derive the numbers again with `scripts/cochange.mjs` and replace the layout below with
what `main` really holds.

## A vertical slice

A ticket about a domain noun (Account, Ledger Entry, Payout…) lands on these surfaces. The module
name is the noun in kebab-case plural (`accounts`, `ledger-entries`).

| Surface         | Path                                                                               | Kind                                     |
| --------------- | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| API module      | `apps/api/src/<module>/` with `*.controller.ts`, `*.service.ts`, `*.module.ts`     | ordinary                                 |
| Seam 1 test     | `apps/api/src/<module>/<slice>.integration.test.ts`                                | ordinary when new, test when appended to |
| Contract        | `packages/contracts/src/<noun>.ts` (+ `.test.ts`)                                  | ordinary                                 |
| Contract barrel | `packages/contracts/src/index.ts`                                                  | registry                                 |
| Schema          | `packages/db/src/schema/<area>.ts`                                                 | schema                                   |
| Schema barrel   | `packages/db/src/schema/index.ts`                                                  | registry                                 |
| Migration       | `packages/db/drizzle/00NN_*.sql`, `meta/00NN_snapshot.json`, `meta/_journal.json`  | generated, serial                        |
| Web page        | `apps/web/src/app/<area>/`                                                         | ordinary                                 |
| Web client      | `apps/web/src/lib/<area>.ts`                                                       | ordinary                                 |
| Components      | `apps/web/src/components/<area>/`                                                  | ordinary                                 |
| Catalogue       | `apps/web/src/i18n/messages/*.ts`, one flat object of label keys for each language | catalogue                                |
| Navigation      | `apps/web/src/components/app-shell/navigation.ts`                                  | registry                                 |
| App module      | `apps/api/src/app.module.ts`                                                       | registry                                 |
| Environment     | `apps/api/src/config/env.ts`, `.env.example`, `docker-compose.yml`                 | config                                   |
| Dependencies    | `package.json` of each workspace, `pnpm-workspace.yaml`, `pnpm-lock.yaml`          | lockfile                                 |

## Always with

A card that names the left column also names the right column. These rules come from the eval of
the cards of an earlier repository (see `evals/plan-waves/RESULTS.md`). There, these files were
the largest group of changed files that no card predicted.

| When the card writes                             | It also writes                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| a new `*.service.ts`                             | the `*.module.ts` of that module, and `app.module.ts` if the module is new |
| a new endpoint                                   | its contract in `packages/contracts/src/`, and the contract barrel         |
| a change to a contract                           | the `.test.ts` beside the contract                                         |
| a new module                                     | one new Seam 1 file in that module                                         |
| a change to the behaviour of an existing service | the existing Seam 1 file of that module, as `test` kind                    |
| "notify", "email", "remind"                      | the notification port, or a `needs` entry for it                           |

## Words and their surfaces

| Words in the ticket                             | Surfaces                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| "a new table", "store", "record"                | schema, migration, contract                                          |
| "show", "page", "screen", "list"                | web page, web client, catalogue, possibly navigation                 |
| "only the owner", "may not see"                 | access predicate in the service, a Seam 1 test with a second account |
| "at the same time", "twice", "retry"            | Seam 1 concurrent mode, an idempotency key or a row lock             |
| "every", "one shared", "extract", "consolidate" | refactor type: runs in a wave of its own                             |

## Shared abstractions

Fill this list as the code grows. A shared abstraction is a function or a class that three or more
modules read. A ticket that edits one goes first in its wave or after it.

| Abstraction     | Path                                       | Readers                           |
| --------------- | ------------------------------------------ | --------------------------------- |
| Clock           | `apps/api/src/clock/clock.ts`              | every module that compares a time |
| Database handle | `apps/api/src/database/database.module.ts` | every module                      |
