# Kimchi Self-Healing GitHub Actions

A fully-runnable demo that shows how [Kimchi](https://docs.kimchi.dev) can autonomously diagnose and repair failing CI pipelines inside GitHub Actions.

---

## Overview

### What is Kimchi?

[Kimchi](https://docs.kimchi.dev) is an AI-powered coding harness that can read code, run commands, edit files, and reason about software in a conversational loop. It combines an LLM with a tool-use environment (file system, shell, LSP) to perform complex coding tasks.

### What is Ferment?

**Ferment** is Kimchi's autonomous execution mode. A ferment is a scoped, multi-phase task that Kimchi can run end-to-end — planning, coding, testing, and reviewing — without human intervention. Ferments can be run interactively or in **headless mode** for CI/CD pipelines.

### Why Self-Healing CI?

CI pipelines fail all the time. Usually a human has to:

1. Read the failure logs
2. Reproduce the failure locally
3. Find the root cause
4. Edit the code
5. Re-run tests
6. Open a PR

This demo shows how Kimchi Ferment can automate steps 1-6 entirely inside GitHub Actions, producing a ready-to-review Pull Request with a validated fix.

---

## Architecture Diagram

```
┌─────────────────┐
│  Git push to    │
│  main / master  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GitHub Actions │
│  self-heal.yml  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Run tests      │────▶│  Capture stdout │
│  (continue even │     │  + stderr to    │
│   on failure)   │     │  failure.log    │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Kimchi Ferment │
                        │  (headless)     │
                        │                 │
                        │  • Read log     │
                        │  • Investigate  │
                        │  • Fix code     │
                        │  • Re-run tests │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Validation     │
                        │  (tests pass?)  │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Create branch  │
                        │  Commit + Push  │
                        │  Open PR        │
                        └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Human review   │
                        │  Merge if OK    │
                        └─────────────────┘
```

---

## Setup

### Prerequisites

- A GitHub account
- A repository with this code pushed to it
- A Kimchi account with an API key ([docs.kimchi.dev](https://docs.kimchi.dev))
- `node` ≥ 18 and `npm` installed locally (for the demo app)

### 1. Clone the repository

```bash
git clone https://github.com/<your-org>/kimchi-self-healing-github-actions.git
cd kimchi-self-healing-github-actions
```

### 2. Configure the Kimchi API key

The Kimchi CLI requires an API key to authenticate. You have two options:

#### Option A — Set locally (for local testing)

```bash
export KIMCHI_API_KEY="<your-kimchi-api-key>"
```

> **Tip:** For persistent local use, add the line above to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.).

#### Option B — Set as a GitHub repository secret (required for CI)

This is the **critical step** that enables the GitHub Action to invoke Kimchi.

1. Open your repository on GitHub.
2. Click **Settings** → **Secrets and variables** → **Actions**.
3. Click **New repository secret**.
4. Enter the following:
   - **Name:** `KIMCHI_API_KEY`
   - **Secret:** `<your-kimchi-api-key>`
5. Click **Add secret**.

The workflow file (`.github/workflows/self-heal.yml`) automatically reads this secret via:

```yaml
env:
  KIMCHI_API_KEY: ${{ secrets.KIMCHI_API_KEY }}
```

> **Security note:** Never commit your API key to the repository. Always use GitHub Secrets.

### 3. Install Kimchi CLI locally

```bash
# Follow the official installation guide:
# https://docs.kimchi.dev
#
# Example (check docs for the latest command):
# curl -fsSL https://install.kimchi.dev | bash
```

Verify the installation:

```bash
kimchi --version
```

### 4. Install demo-app dependencies

```bash
cd demo-app
npm install
```

---

## Running The Demo

### Step 1 — Confirm the intentional bug exists

The demo application already contains an intentional off-by-one bug. Confirm it fails:

```bash
cd demo-app
npm test
```

You should see a failure like:

```
FAIL  tests/calculator.test.ts
  Calculator
    ✕ adds two numbers correctly
      Expected: 5
      Received: 6
```

### Step 2 — Push a commit that triggers the workflow

The `main` branch already contains the bug. Push any change (or an empty commit) to trigger the workflow:

```bash
git commit --allow-empty -m "Trigger self-healing workflow"
git push origin main
```

### Step 3 — Watch GitHub Actions

1. Go to the **Actions** tab in your GitHub repository.
2. Open the **Self-Healing CI** workflow run.
3. Observe the pipeline:
   - Tests run and fail (expected).
   - `collect-failure.sh` captures the failure log.
   - `run-kimchi.sh` launches Kimchi in headless mode.
   - Kimchi reads `failure.log`, investigates the source code, and modifies `demo-app/src/calculator.ts`.
   - Kimchi re-runs `npm test` to confirm the fix.
   - `create-pr.sh` commits the fix to a new branch and opens a PR.

### Step 4 — Review the auto-fix PR

A Pull Request titled **[Kimchi Auto-Fix] Resolve failing CI pipeline** will appear. Its body contains:

- **Summary** of the root cause
- **Changes Made** (list of modified files)
- **Validation** (test results)
- **Notes** (auto-generated disclaimer)

### Step 5 — Merge and verify

1. Review the diff in the PR.
2. Merge the PR.
3. The test suite on `main` should now pass.

---

## Limitations

- **Kimchi CLI availability:** The workflow assumes Kimchi CLI is installed on the runner. You may need to add an installation step (e.g., via `curl` or a custom runner image) before the workflow can execute in a real environment.
- **API costs:** Every time the self-healing workflow triggers, Kimchi API calls incur usage costs. Consider rate-limiting or adding a manual approval gate before the repair step.
- **`--headless` support:** The `run-kimchi.sh` script attempts `kimchi --headless` with a dynamically generated Ferment JSON. If your installed Kimchi version does not support `--headless`, the script falls back to `kimchi --print`. The fallback is safe but does not use the full Ferment state machine.
- **Scope of fixes:** Kimchi is instructed to modify only `demo-app/src/`. Complex cross-module bugs may require broader prompts.
- **No rollback mechanism:** Once a PR is created, reverting requires manual intervention unless you add an auto-rollback workflow.
- **Runner timeouts:** The job has a 15-minute timeout and the Kimchi repair step has a 10-minute timeout. Very complex failures may exceed this.

---

## Future Improvements

- **Multi-language support:** Extend the scripts to support Python, Java, Go, and Rust projects.
- **Sentry/Slack integration:** Trigger self-healing not only on push failures but also on Sentry alerts or Slack slash commands.
- **Rollback support:** Automatically revert the auto-fix branch if tests fail after the PR is merged.
- **Multiple repair attempts:** If the first fix fails, retry with an expanded prompt or a different strategy.
- **Root-cause reports:** Generate detailed Markdown reports explaining the failure analysis, saved as artifacts.
- **Manual approval gate:** Add a required reviewer or environment protection rule before Kimchi is allowed to modify code.
- **Configurable safety policies:** Replace hard-coded safety rules with a `.kimchi-safety.yml` policy file.

---

## License

MIT — see [LICENSE](./LICENSE).
