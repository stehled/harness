# Testing

Read this file before you write a test. Every later ticket copies what is here. A habit that forms
once repeats forty times.

A good test asserts observable behaviour at a seam. It never asserts that a class was constructed,
that a method was called or that a mock returned its programmed value. This repository does not use
mocked unit tests of services and repositories. Such a test asserts that the mocks agree with
themselves. It cannot find wrong SQL, a missing access check, a dropped column or a transaction that
commits a state change and rolls back its audit record.

## Which seam does this test belong to?

This rule is not a judgement call:

> If a function takes only data and returns only data, test it directly. That is Seam 2.
> If it touches the database, the clock, the network or a session, it belongs in Seam 1.

| Seam | What it is                                                               | Where it lives                        | Command                 |
| ---- | ------------------------------------------------------------------------ | ------------------------------------- | ----------------------- |
| 1    | The real application over HTTP, against a real Postgres and a real Redis | `apps/api/**/*.integration.test.ts`   | `pnpm test:integration` |
| 2    | Pure functions, called directly                                          | `**/*.test.ts`, `tools/**/*.test.mjs` | `pnpm test`             |
| 3    | Playwright, shallow: does each screen come up                            | `e2e/tests/`                          | `pnpm test:e2e`         |

Most tests are Seam 1. The guarantees of a system that moves money hold or fail there.

The tools of this repository are Seam 2 today. Each hook keeps its decision in a pure function in
`tools/hooks/`, and a test calls that function. The script in `.claude/hooks/` only reads the input,
calls the function and writes the output.

## Seam 1: the integration harness

The first application ticket builds `seamOne()`. It boots the real Nest application, with the
production dependency graph, for each test in a `describe`. Testcontainers start Postgres and Redis
once for each run, so Seam 1 does not depend on the Compose stack or on its ports.

```ts
describe('POST /accounts/:id/payouts', () => {
  const app = seamOne();

  it('refuses a payout larger than the balance', async () => {
    const account = await openAccount(app, { balanceMinor: 10_000 });

    await app.http
      .post(`/accounts/${account.id}/payouts`)
      .send({ amountMinor: 10_001 })
      .expect(409);

    expect(await balanceOf(app, account.id)).toBe(10_000);
  });
});
```

The harness gives the test these handles:

| Handle      | What it is                                                                      |
| ----------- | ------------------------------------------------------------------------------- |
| `app.http`  | Drives the application over HTTP, as its callers do. It listens on `127.0.0.1`. |
| `app.db`    | The transaction that the application uses. Seed with it and assert with it.     |
| `app.redis` | A second connection to the Redis of the application, empty for each test.       |
| `app.clock` | The clock of the application. Use `setTo` and `advanceBy`. Never stub a timer.  |

### What is real, and what is not

Real: the Nest graph, the SQL, the constraints, the triggers, the transactions, the serialization.
Not real: the clock, which the test sets, and every host outside the machine. The harness refuses a
request to a host outside the machine unless the test stubs it.

### Concurrent mode

By default a test runs in one transaction that rolls back at the end. That transaction cannot test
a row lock, because two requests in one transaction never wait for each other.

`seamOne({ concurrent: true })` gives the application a real pool and truncates the tables after each
test. Use it for a real race between two writers: two payouts from one balance, one webhook
delivered twice at the same time. Do not use it for other tests, because a truncation costs more
than a rollback.

## Tests that catch what the agent got wrong

An agent writes plausible code. These are the errors that plausible code makes where money moves.
Each one needs a test of its own.

| Error                            | Test                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Money as a floating-point number | Seam 2: amounts are integers in minor units. A sum of many entries is exact.                                               |
| A ledger entry changed in place  | Seam 1: an `UPDATE` or a `DELETE` on the ledger table fails. A correction is a new entry.                                  |
| A webhook applied twice          | Seam 1: the same event twice gives one entry. Concurrent mode: the same event at the same time gives one entry.            |
| Two payouts from one balance     | Seam 1, concurrent mode: two requests at the same time. One passes, one gets 409, and the balance never goes below zero.   |
| A day boundary in UTC            | Seam 1 with `app.clock`: a limit per trading day in `America/New_York`, around midnight and on the days the clock changes. |
| A missing access check           | Seam 1: a second account asks for the first account's data and gets 404.                                                   |
| A rounding at the wrong step     | Seam 2: round once, at the step that the ADR names, and test the cent at the boundary.                                     |

## Checks that read the repository itself

Some rules are not behaviour of the application. A test reads the repository instead:

- `evals/hooks/cases.json` drives the tests of `enforce-git-conventions`.
- When the application exists: no port literal in code, every route in a route inventory, and no
  import across a boundary that `dependency-cruiser` forbids.

## Running the tests

```sh
pnpm test          # Seam 2, and the tools
pnpm eval          # the hook eval, with a score for each category
pnpm verify        # lint, tests and evals: run it before you mark a pull request ready
```
