# CI runs only the cheap checks, and the local run is the evidence

In the production repository that this harness comes from, CI ran the integration suite and the browser suite on each push of each pull request.
With many agents, that used all the CI minutes in a few weeks.

CI runs lint, the boundary check, typecheck, build and Seam 2 on each push. It needs no Docker and no
browser. Seam 1 and Seam 3 run on a runner only on request:
`gh workflow run tests.yml --ref <branch> -f suite=all`.

## Consequences

- `pnpm verify` on the machine of the agent is the evidence that a change is sound. The agent runs
  it before it marks the pull request ready, and reports what it said.
- An agent does not poll a CI run and does not wait for one.
- A defect that only Seam 1 finds can reach a pull request that CI shows as green. The reviewer
  asks for the local run.
