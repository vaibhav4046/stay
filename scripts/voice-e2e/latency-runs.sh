#!/usr/bin/env bash
# usage: latency-runs.sh <label> <baseURL> [runs=3] [turns=3]  -> docs/bench-results/latency/<label>-<n>.txt
label=$1; base=$2; runs=${3:-3}; turns=${4:-3}
mkdir -p docs/bench-results/latency
for n in $(seq 1 "$runs"); do
  timeout 280 node scripts/voice-e2e/sim-human.mjs fast "$base" --turns "$turns" --no-llm --turns-only > "docs/bench-results/latency/$label-$n.txt" 2>&1
  tail -1 "docs/bench-results/latency/$label-$n.txt"
done
