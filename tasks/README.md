# Ensemble task suite

Small, self-contained coding tasks used to benchmark LLMs driving Claude Code.
Each task ships a starter `workspace/` and a **deterministic** acceptance test.
The agent edits the workspace; the runner then runs the acceptance command and
records pass/fail from its exit code.

## Layout

```
tasks/<language>/<name>/
  task.yaml          # metadata + prompt + acceptance command
  workspace/         # starter files the agent is given (copied to a temp dir per run)
    <source files>   # stub (feature) or buggy code (bugfix) or messy code (refactor)
    <test file>      # the acceptance test — the prompt tells the agent NOT to edit it
```

The runner copies `workspace/` to an isolated temp directory for every attempt,
so tasks never interfere and the originals are never mutated.

## `task.yaml` fields

| field        | meaning                                                                 |
|--------------|-------------------------------------------------------------------------|
| `id`         | globally unique task id, e.g. `py-anagram-groups`                       |
| `language`   | one of `python`, `typescript`, `go`, `rust`                             |
| `category`   | one of `feature`, `bugfix`, `refactor`, `test`                          |
| `prompt`     | the instruction handed to the agent (`claude -p "<prompt>"`)            |
| `acceptance` | shell command run **in the workspace copy**; exit `0` = pass            |
| `maxTurns`   | per-attempt agent turn cap (`claude --max-turns`)                       |

## Rules for a good task

1. **Deterministic acceptance.** The command must give the same verdict every
   run for the same code. No network, no clocks, no randomness.
2. **The test discriminates.** It must *fail* on the unmodified starter
   workspace and *pass* once the task is correctly solved. (For `refactor`,
   the starter already passes — the test pins behavior so a refactor can't
   change it; "solving" means improving the code while keeping it green.)
3. **Hands off the test.** The prompt explicitly tells the agent not to edit the
   acceptance test file, so a model can't "pass" by deleting assertions.
4. **Runs locally with stock tooling.** Current suite uses only
   `python3 -m pytest -q`, `node --test`, and `go test ./...` /
   `go test -coverprofile` — no third-party packages.

## Current tasks

| id                      | lang       | category | acceptance                          |
|-------------------------|------------|----------|-------------------------------------|
| py-anagram-groups       | python     | feature  | `python3 -m pytest -q`              |
| py-roman-numerals       | python     | bugfix   | `python3 -m pytest -q`              |
| ts-lru-cache            | typescript | feature  | `node --test`                       |
| ts-refactor-validator   | typescript | refactor | `node --test`                       |
| go-balanced-parens      | go         | bugfix   | `go test ./...`                     |
| go-stack-tests          | go         | test     | `go test -coverprofile` + ≥90% cov  |

## Adding a task

1. Create `tasks/<lang>/<name>/task.yaml` and `tasks/<lang>/<name>/workspace/`.
2. Put the test file in `workspace/` and reference "do not edit it" in the prompt.
3. Verify both directions by hand:
   ```sh
   cd tasks/<lang>/<name>/workspace
   <acceptance>        # should FAIL on the unsolved starter
   # ...solve it...
   <acceptance>        # should PASS
   ```
4. The runner auto-discovers any task with a `task.yaml`; no registry to update.

> `pytest` is required for the Python tasks (`pip install pytest`). Node ≥ 18
> and a Go toolchain are required for the TS and Go tasks respectively.
