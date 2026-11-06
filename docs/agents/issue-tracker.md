# Issue tracker: GitHub

Issues live in GitHub Issues. Use the `gh` CLI. `gh` reads the repository from `git remote -v`.

| Operation          | Command                                                           |
| ------------------ | ----------------------------------------------------------------- |
| Read a ticket      | `gh issue view <n> --comments`                                    |
| List the open work | `gh issue list --label ready-for-agent --label ticket`            |
| Claim a ticket     | `gh issue edit <n> --add-assignee @me`                            |
| Create an issue    | `gh issue create --title "..." --body-file <file> --label ticket` |
| Comment            | `gh issue comment <n> --body-file <file>`                         |
| Close              | `gh issue close <n> --comment "..."`                              |

## Labels

| Label             | Meaning                                              |
| ----------------- | ---------------------------------------------------- |
| `spec`            | A problem and its solution. Split it into tickets.   |
| `ticket`          | One part of a spec. One pull request closes it.      |
| `ready-for-agent` | A ticket with no open blocker. An agent may take it. |
| `contract`        | A Wave 0 ticket of shared declarations.              |
| `plan`            | A plan issue that `plan-waves` writes.               |

## Blockers

Record a blocker as a GitHub issue dependency:

```sh
gh api --method POST repos/<owner>/<repo>/issues/<n>/dependencies/blocked_by \
  -F issue_id="$(gh api repos/<owner>/<repo>/issues/<blocker> --jq .id)"
```

When a skill says "publish to the issue tracker", create a GitHub issue. When a skill says "fetch
the ticket", run `gh issue view <n> --comments`.
