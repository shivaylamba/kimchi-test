# Architecture

This document describes the architecture of the Kimchi Self-Healing GitHub Actions integration.

## High-Level Pipeline

The self-healing workflow follows a simple, linear pipeline:

```
GitHub Actions workflow trigger
        │
        ▼
   Run tests
   (continue on error)
        │
        ▼
   Capture failure logs
        │
        ▼
   Kimchi Ferment gets invoked
   (headless / one-shot)
        │
        ▼
   Code fix is generated
        │
        ▼
   Validation (tests re-run)
        │
        ▼
   Pull Request is created
```

## Component Breakdown

### 1. GitHub Actions Orchestrator

**File:** `.github/workflows/self-heal.yml`

The workflow is triggered on every push to `main` or `master`. It has three key responsibilities:

1. **Checkout and setup** — checks out the full repository and installs Node.js dependencies.
2. **Test with fault tolerance** — runs `npm test` with `continue-on-error: true` so a failure does not kill the job.
3. **Conditional repair** — only if tests fail, it runs the collection, repair, and PR scripts in sequence.

Safety features built into the workflow:

- **Branch-name guard:** Skips execution on branches created by the workflow itself (`kimchi-auto-fix-*`) to prevent infinite loops.
- **Concurrency control:** Cancels in-progress runs on the same branch.
- **Timeouts:** 15-minute job timeout and 10-minute Kimchi step timeout.
- **Scoped permissions:** `contents:write` and `pull-requests:write` only.

### 2. Log Collector

**File:** `scripts/collect-failure.sh`

A minimal script that:

- Enters `demo-app/`
- Runs `npm test`
- Captures **stdout and stderr** into `failure.log`
- Always exits with code `0` so the workflow continues

The log file is the primary artifact consumed by Kimchi. It contains the full test output, stack traces, and assertion diffs.

### 3. Repair Agent

**File:** `scripts/run-kimchi.sh`

The most complex component. It prepares the environment for Kimchi and launches it in non-interactive mode.

#### Pre-flight checks

- Validates that `KIMCHI_API_KEY` is set.
- Validates that the `kimchi` CLI is installed.
- Verifies `failure.log` exists.

#### Safety guards

Before Kimchi runs, the script removes write permissions from:

- `.github/workflows/`
- `.git/`

These are restored via an `EXIT` trap after Kimchi finishes. This prevents the agent from mutating CI configuration or repository history.

#### Task prompt

The script builds a rich prompt that includes:

- The full contents of `failure.log`
- Step-by-step instructions (investigate → fix → validate)
- Mandatory safety rules (no test removal, no workflow edits, minimal changes)
- Repository layout so Kimchi knows which files are editable

#### Headless mode

The script first attempts the **Ferment headless** route:

1. Checks whether the Kimchi CLI supports `--headless`.
2. Generates a UUID for a new ferment.
3. Uses `python3` to build a valid JSON ferment descriptor.
4. Sets `KIMCHI_ACTIVE_FERMENT=<uuid>`.
5. Runs `kimchi --headless`.

If `--headless` is unavailable, or if it exits with an error, the script falls back to `kimchi --print` with the same prompt.

#### Post-run validation

After Kimchi exits, the script checks `git diff` to see whether any source files were modified. It prints a summary and exits cleanly.

### 4. PR Generator

**File:** `scripts/create-pr.sh`

A small but careful script that:

1. Checks for uncommitted changes (both staged and unstaged).
2. Captures the **current branch name** before creating a new branch.
3. Creates a uniquely-named branch (`kimchi-auto-fix-<timestamp>`).
4. Commits all changes with a standardized message.
5. Pushes the branch to `origin`.
6. Opens a Pull Request via `gh pr create` with the exact title and body template required by the project specification.

### 5. Demo Application

**Directory:** `demo-app/`

A minimal TypeScript + Jest project that provides a reproducible failure:

- `src/calculator.ts` — contains an intentional off-by-one bug in `add()`.
- `tests/calculator.test.ts` — contains a failing assertion for `add()` and passing assertions for the other methods.

The bug is deliberately simple so that Kimchi can reliably identify and fix it within the 10-minute step timeout.

## Data Flow

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  demo-app   │────▶│  test output    │────▶│  failure.log    │
│  npm test   │     │  (stdout/err)   │     │  (flat text)    │
└─────────────┘     └─────────────────┘     └─────────────────┘
                                                    │
                                                    ▼
                                            ┌─────────────────┐
                                            │  run-kimchi.sh  │
                                            │  (embeds log    │
                                            │   into prompt)  │
                                            └─────────────────┘
                                                    │
                                                    ▼
                                            ┌─────────────────┐
                                            │  Kimchi CLI     │
                                            │  (headless)     │
                                            └─────────────────┘
                                                    │
                                                    ▼
                                            ┌─────────────────┐
                                            │  demo-app/src/  │
                                            │  (modified)     │
                                            └─────────────────┘
                                                    │
                                                    ▼
                                            ┌─────────────────┐
                                            │  create-pr.sh   │
                                            │  (opens PR)     │
                                            └─────────────────┘
```

## Security Considerations

| Threat | Mitigation |
|--------|------------|
| Kimchi modifies workflow files | `.github/workflows` is chmod `a-w` during execution |
| Kimchi force-pushes or rewrites history | `.git` is chmod `a-w` during execution |
| Kimchi deletes tests or assertions | Explicit prompt rules forbid this; script exits 0 regardless |
| Infinite PR loop | Workflow skips branches matching `kimchi-auto-fix-*` |
| Leaked API key | Key is read from `secrets.KIMCHI_API_KEY`; never hard-coded |
| Runaway agent | 10-minute step timeout and 15-minute job timeout |

## Extending the Architecture

To adapt this pipeline for another project:

1. **Replace `demo-app/`** with your actual application.
2. **Update the test command** in `collect-failure.sh` (e.g., `pytest`, `mvn test`, `cargo test`).
3. **Adjust the safety rules** in `run-kimchi.sh` to match your repository layout.
4. **Tune timeouts** in `.github/workflows/self-heal.yml` based on test duration and Kimchi fix complexity.
