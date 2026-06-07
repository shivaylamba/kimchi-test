#!/usr/bin/env bash
set -euo pipefail

# collect-failure.sh
# Runs the demo-app test suite and captures the full output to failure.log.
# Always exits with code 0 so the CI workflow can continue to the
# self-healing phase even when tests fail.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_APP_DIR="${PROJECT_ROOT}/demo-app"
FAILURE_LOG="${PROJECT_ROOT}/failure.log"

echo "[collect-failure] Running tests in ${DEMO_APP_DIR}..."

# Clear any prior log
: > "${FAILURE_LOG}"

# Run tests and capture both stdout and stderr.
# We explicitly allow the test command to fail so the log contains
# the failure output.
if cd "${DEMO_APP_DIR}"; then
  npm test 2>&1 | tee "${FAILURE_LOG}" || true
else
  echo "[collect-failure] ERROR: Could not enter ${DEMO_APP_DIR}" | tee "${FAILURE_LOG}"
fi

echo "[collect-failure] Test output written to ${FAILURE_LOG}"
echo "[collect-failure] Done."

# Always exit 0 so the workflow continues.
exit 0
