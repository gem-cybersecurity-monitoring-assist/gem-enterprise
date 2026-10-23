#!/usr/bin/env bash
# Drains the GEM render queue through the existing trusted video worker.
#
# The worker (`pnpm run video:worker:once`) leases DISPATCHING render jobs and
# submits them to the ComfyUI-compatible service on 127.0.0.1:8188. Rendering
# happens asynchronously, so each cycle waits for the service to go idle, then
# runs the worker again to collect finished outputs, upload them to private
# storage, verify them, and finalize them into the approval queue.
# Stops when a cycle dispatches nothing new and the service is idle.
set -euo pipefail

SERVICE="${COMFYUI_BASE_URL:-http://127.0.0.1:8188}"
MAX_CYCLES="${RENDER_MAX_CYCLES:-30}"
IDLE_TIMEOUT_S="${RENDER_IDLE_TIMEOUT_S:-1800}"

stat() { curl -fsS "$SERVICE/system_stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['gem_render']['$1'])"; }

wait_idle() {
  local waited=0
  while [ "$(stat busy)" = "True" ]; do
    sleep 10; waited=$((waited + 10))
    if [ "$waited" -ge "$IDLE_TIMEOUT_S" ]; then echo "::warning::render service still busy after ${IDLE_TIMEOUT_S}s"; return 0; fi
  done
}

for cycle in $(seq 1 "$MAX_CYCLES"); do
  before=$(stat submitted)
  echo "::group::worker cycle $cycle"
  pnpm run --silent video:worker:once
  echo "::endgroup::"
  wait_idle
  after=$(stat submitted)
  echo "cycle $cycle: dispatched $((after - before)) · completed $(stat completed) · failed $(stat failed)"
  if [ "$after" -eq "$before" ]; then
    break
  fi
done

# Final pass collects and finalizes anything that finished in the last cycle.
pnpm run --silent video:worker:once
echo "rendered $(stat completed) · failed $(stat failed)"
