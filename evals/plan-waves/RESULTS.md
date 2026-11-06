# Card eval results

`node evals/plan-waves/run.mjs --issues <list>` compares the write set on each card with the files
of the pull request that closed the ticket.

- **Precision** of a confidence level: the share of card lines at that level that match a changed
  file.
- **Recall up to** a level: the share of changed files that a card line at that level or above
  matches.

## First batch (14 tickets of the private SaaS, September 2026)

The cards came from the first version of `plan-waves`. The tickets and the diffs are private. Only
the totals are here.

| Confidence | Precision | Recall up to this level |
| ---------- | --------- | ----------------------- |
| certain    | 87%       | 47%                     |
| likely     | 27%       | 55%                     |
| possible   | –         | 55%                     |

153 files changed. 69 of them were on no card:

| Kind of missed file       | Files |
| ------------------------- | ----- |
| contracts and their tests | 17    |
| Nest module files         | 15    |
| Seam 1 test files         | 11    |
| services                  | 7     |
| Seam 2 test files         | 4     |
| test helpers              | 1     |
| other                     | 14    |

What it means: a `certain` line is usually right, so the collision risk that it causes is real. But
the cards see only half of each write set, so the planner underestimates the risk. Most of the
missing files follow from a file that the card does name. A new service brings its module file. A
new endpoint brings its contract. The "Always with" table in `SURFACE-MAP.md` adds those rules.

Next measurement: the first batch of application tickets in this repository, with the new table.
