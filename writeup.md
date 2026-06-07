# Writeup — Kimchi Self-Healing GitHub Actions

## What We Built

We built a fully-runnable integration between **Kimchi** (an AI-powered coding harness) and **GitHub Actions** that autonomously diagnoses and repairs failing CI pipelines.

The project consists of:

1. **A demo application** — a tiny TypeScript + Jest calculator with an intentional off-by-one bug.
2. **Three shell scripts** — `collect-failure.sh`, `run-kimchi.sh`, and `create-pr.sh`.
3. **A GitHub Actions workflow** — `.github/workflows/self-heal.yml` that orchestrates the entire pipeline.
4. **Comprehensive documentation** — `README.md`, `docs/architecture.md`, `docs/demo.md`, and this `writeup.md`.

When a test fails in the demo app, the workflow:

- Captures the full test output to `failure.log`.
- Launches Kimchi in non-interactive mode with a detailed repair prompt.
- Lets Kimchi read the failure, investigate the source code, apply a minimal fix, and re-run the tests.
- Commits the fix to a uniquely-named branch and opens a Pull Request.

The result is a **self-healing CI pipeline** that turns a red build into a ready-to-review PR without human intervention.

---

## What Worked

### 1. The pipeline architecture is clean and linear

Mapping the problem to a simple chain — *Test → Capture → Repair → Validate → PR* — made the workflow easy to reason about, debug, and extend.

### 2. Safety was designed in from the start

Rather than trusting the agent blindly, we layered multiple safety mechanisms:

- **Filesystem-level** (`chmod a-w` on `.github/workflows` and `.git`)
- **Prompt-level** (explicit rules in the task prompt)
- **Workflow-level** (branch-name guards, timeouts, scoped permissions)
- **Script-level** (continue-on-error, clean exit traps)

### 3. Headless fallback makes the system resilient

`run-kimchi.sh` attempts the ideal path (`kimchi --headless` with a dynamically generated Ferment JSON and `KIMCHI_ACTIVE_FERMENT`), but if that fails it seamlessly falls back to `kimchi --print`. This means the project works even if the Kimchi CLI version does not support headless ferment mode.

### 4. The PR template is deterministic

`create-pr.sh` generates a consistent PR title and body every time, making it easy for human reviewers to recognize auto-generated fixes at a glance.

### 5. Documentation is comprehensive

Each document serves a distinct audience:

- `README.md` → first-time users
- `docs/architecture.md` → engineers who want to understand or extend the system
- `docs/demo.md` → practitioners running the demo
- `writeup.md` → maintainers and evaluators

---

## What Broke

### 1. No local `npm` in the build environment

During development we discovered that the host machine did not have `npm` installed, so we could not run the full Jest test suite locally. We compensated with plain-JS smoke tests that validated the bug logic directly (`add(2,3)` returns `6` instead of `5`), but this is not as strong as running the actual test suite.

### 2. `kimchi --headless` is not visible in the CLI help

The Kimchi documentation references `kimchi --headless` for CI usage, but the `--help` output from the installed CLI (`v0.0.80`) did not include the flag. We built the headless attempt anyway and wrapped it in a robust fallback, but this means the ideal Ferment headless path may not be available on all versions.

### 3. Ferment JSON schema is undocumented

To support `KIMCHI_ACTIVE_FERMENT` we had to reverse-engineer a minimal ferment JSON structure by inspecting an existing ferment state file. The schema may change between releases, which could break the headless path. The `--print` fallback mitigates this risk.

### 4. Kimchi CLI installation is not automated

The workflow assumes Kimchi is pre-installed on the runner. We added a placeholder installation step with a clear error message, but there is no universal install command that works across all runners today. This is the biggest friction point for a new user.

---

## Lessons Learned

### Autonomous agents need guardrails, not just trust

Writing "please don't delete tests" in a prompt is not enough. Combining prompt instructions with filesystem permissions (`chmod`), workflow-level branch guards, and explicit step timeouts created a defense-in-depth approach that feels much safer.

### Fallbacks are essential for CI integrations

CLI tools evolve. A CI integration that depends on a single flag or a specific JSON schema is brittle. Building a primary path and a reliable fallback (`--headless` → `--print`) made the system significantly more robust.

### Shell scripts are surprisingly expressive for glue logic

We considered writing the scripts in Python or Node.js, but plain Bash turned out to be the right choice:

- Every CI runner has Bash.
- No extra dependencies.
- `set -euo pipefail` catches most common errors.
- `trap` handles cleanup.

### Documentation is part of the deliverable

A technically correct system is useless if the next developer cannot run it. Investing time in README setup steps, architecture diagrams, and troubleshooting guides paid off in clarity.

### Simple bugs make the best demos

The off-by-one bug in `calculator.add()` is trivial for a human but perfect for an autonomous agent demo:

- The test failure message is explicit (`Expected: 5, Received: 6`).
- The root cause is a single line.
- The fix is one character (`+ 1` → remove it).
- Re-running tests provides immediate validation.

Complex failures introduce ambiguity that makes the agent slower and more error-prone. Start simple.

---

## Future Work

### 1. Multi-language support

Extend `collect-failure.sh` and `run-kimchi.sh` to auto-detect the project language (Python, Java, Go, Rust) and run the appropriate test command and fix strategy.

### 2. Auto-install Kimchi CLI

Add a self-contained install step to `.github/workflows/self-heal.yml`. Once Kimchi publishes a stable install script (e.g., `curl -fsSL https://install.kimchi.dev | bash`), the workflow can become fully zero-config.

### 3. Sentry / Slack integration

Instead of only triggering on push failures, listen to external signals:

- **Sentry** webhooks for production errors → map stack traces back to source code.
- **Slack** slash commands (`/kimchi-fix`) to trigger a repair on demand.

### 4. Rollback support

Add a post-merge validation job. If the auto-fix PR is merged and tests still fail, automatically revert the merge or open a follow-up PR.

### 5. Multiple repair attempts

If the first fix fails, retry with an expanded prompt, a different repair strategy, or a more permissive file scope. Track attempts in the PR body.

### 6. Root-cause reports

Generate a detailed Markdown report (saved as a workflow artifact) explaining:

- Which test failed
- Where the agent looked
- What it changed
- Why it thinks the fix is correct

### 7. Manual approval gate

Add an optional environment protection rule so that Kimchi only runs after a human clicks "Approve" in the GitHub Actions UI. This is crucial for production repositories where fully autonomous edits are too risky.

### 8. Policy-as-code

Replace the hard-coded safety rules in `run-kimchi.sh` with a `.kimchi-safety.yml` file that defines:

- Allow-list of editable directories
- Block-list of protected files
- Maximum number of files that can be changed
- Required test coverage threshold before a fix is considered valid

---

## Final Thoughts

This project demonstrates that autonomous coding agents can be integrated into CI/CD pipelines safely and practically. The key is not maximizing autonomy — it is **bounding autonomy** with clear guardrails, explicit fallbacks, and transparent human review. A self-healing pipeline that opens a PR is far more useful than one that silently commits to `main`.
