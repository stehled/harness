# No mocked unit tests of services and repositories

An agent writes a mock and the code under test in the same session. A test of the two asserts that
they agree with each other. It cannot find wrong SQL, a missing access check, a dropped column or a
transaction that commits a state change and rolls back its audit record. Those are the errors that
matter where money moves.

A function that takes data and returns data gets a direct test (Seam 2). Everything that touches the
database, the clock, the network or a session gets a test against the real application over HTTP,
with a real Postgres in a container (Seam 1). The rule is in `docs/testing.md`.

## Consequences

- Seam 1 is slower than a mocked test. A test in a rolled-back transaction keeps it fast enough.
- A real race needs concurrent mode, which truncates tables after each test.
- The clock and hosts outside the machine are the only things a test replaces.
