# Demo Guide

This guide shows you how to reproduce the self-healing CI pipeline in action.

## Table of Contents

1. [Quick Start — Use the Built-In Bug](#quick-start--use-the-built-in-bug)
2. [Advanced Demo — Introduce a Fresh Bug](#advanced-demo--introduce-a-fresh-bug)
3. [What to Expect](#what-to-expect)
4. [Troubleshooting](#troubleshooting)

---

## Quick Start — Use the Built-In Bug

The repository already ships with an intentional off-by-one bug in `demo-app/src/calculator.ts`. This is the fastest way to see the pipeline in action.

### Prerequisites

- The repository is pushed to GitHub.
- You have added `KIMCHI_API_KEY` as a repository secret.
- Kimchi CLI is available in the GitHub Actions runner (see README.md Setup).

### Step 1: Trigger the workflow

Push any commit to `main` (or `master`) to trigger the workflow:

```bash
git commit --allow-empty -m "Trigger self-healing demo"
git push origin main
```

### Step 2: Watch the Actions tab

1. Open your repository on GitHub.
2. Go to the **Actions** tab.
3. Select the **Self-Healing CI** workflow run.
4. Expand the steps and watch the pipeline:
   - `Run tests` → fails (red) ✅ *expected*
   - `Capture failure logs` → produces `failure.log`
   - `Launch Kimchi repair agent` → Kimchi analyzes the log and edits `calculator.ts`
   - `Create Pull Request` → a new PR appears

### Step 3: Review the PR

- **Title:** `[Kimchi Auto-Fix] Resolve failing CI pipeline`
- **Body:** Summary, Changes Made, Validation, Notes
- **Diff:** The `+1` is removed from the `add()` method.

### Step 4: Merge and verify

1. Merge the PR.
2. Wait for the Actions tab to show a green checkmark on `main`.
3. The test suite now passes.

---

## Advanced Demo — Introduce a Fresh Bug

To prove the system works on *new* failures, you can deliberately break a different test.

### Step 1: Pick a passing test

Open `demo-app/tests/calculator.test.ts`. Every test except the first one currently passes.

### Step 2: Break the production code

Open `demo-app/src/calculator.ts` and introduce a bug in a different method.

**Example:** Change `multiply` to return the wrong result:

```typescript
multiply(a: number, b: number): number {
  return a * b * 2;  // intentional bug
}
```

**Example:** Change `divide` to throw the wrong message:

```typescript
divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Cannot divide by zero');  // wrong message
  }
  return a / b;
}
```

### Step 3: Verify the test fails locally

```bash
cd demo-app
npm test
```

Confirm that the targeted test now fails.

### Step 4: Push to main and observe

```bash
git add demo-app/src/calculator.ts
git commit -m "Intentionally break multiply for demo"
git push origin main
```

### Step 5: Reproduce the self-healing cycle

1. The workflow triggers automatically.
2. Tests fail on the new bug.
3. Kimchi receives the failure log.
4. Kimchi edits `calculator.ts` to fix the bug you introduced.
5. A new PR is opened with the fix.

You can repeat this cycle as many times as you like to demonstrate different types of simple regressions.

---

## What to Expect

### Typical timeline

| Stage | Approximate Duration |
|-------|----------------------|
| Tests run | 5–15 seconds |
| Log capture | <1 second |
| Kimchi analysis & fix | 1–3 minutes |
| Test re-run after fix | 5–10 seconds |
| PR creation | 5–10 seconds |
| **Total** | **2–5 minutes** |

> Duration depends heavily on Kimchi's API response time and how complex the failure is.

### Kimchi behavior

Kimchi will:

1. Read `failure.log` to identify the failing test name and assertion.
2. Open the corresponding source file(s) in `demo-app/src/`.
3. Locate the root cause.
4. Apply the minimal code change.
5. Run `npm test` again.
6. If tests pass, stop and let `create-pr.sh` take over.

Kimchi will **not**:

- Modify `.github/workflows/`
- Delete or skip tests
- Remove assertions
- Force-push or rewrite history
- Modify files outside `demo-app/src/`

---

## Troubleshooting

### The workflow never triggers

- Ensure you pushed to `main` or `master`.
- Check that the branch is not named `kimchi-auto-fix-*`.
- Check **Actions → General → Workflow permissions** in your repository settings.

### Tests pass but I expected them to fail

- Verify the bug is still present in `demo-app/src/calculator.ts`.
- Run `npm test` locally to confirm.

### Kimchi step fails with "CLI not installed"

- The workflow currently expects Kimchi to be pre-installed on the runner.
- Update the **Install Kimchi CLI** step in `.github/workflows/self-heal.yml` with the correct install command for your environment.

### No PR is created

- Check the **Create Pull Request** step logs.
- Ensure `GITHUB_TOKEN` has `contents:write` and `pull-requests:write` permissions.
- Ensure the Kimchi step actually modified files (`git diff` should not be empty).

### Infinite PR loop

- The workflow skips branches named `kimchi-auto-fix-*`.
- If you see duplicate PRs, verify the branch-name guard in `self-heal.yml` is present.
