# A hook rewrites a command before it refuses it

A hook that refuses a command tells the agent "no". The agent then guesses a different command, and
the guess can be wrong again. A hook that rewrites the command gives the agent the correct form in
the same step, and the session continues.

The `PreToolUse` hook on `Bash` rewrites a command when the correct form is certain: a worktree path,
a branch checkout in the main checkout, a missing `--draft`. It answers with `updatedInput` and keeps
every other field of the tool input. A hook refuses only when no correct form exists. The edit hook
refuses an edit in the main checkout on a ticket branch, because the correct file is in a worktree
that may not exist yet.

## Consequences

- The rewrite must be exact. Each rewrite rule has cases in `evals/hooks/cases.json`, and a defect
  in a rewrite is a failed eval case.
- The tokenizer is best effort. It knows quotes and the separators `&&`, `||`, `;` and `|`. It does
  not know nested substitutions. When it cannot be sure, it does not rewrite.
- The documentation still states each rule. The hook is a backstop, not the source of the rule.
