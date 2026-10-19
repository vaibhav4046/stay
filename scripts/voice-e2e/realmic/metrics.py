"""Per-turn numbers from an in-page report (inject.js: __rig.report()).

Usage: python metrics.py <report.json> [label]

Times are ms on the page clock. "Segments" are runs of the product's reply audio (silences under 240 ms do not split them).
A *reply onset* is a segment that starts at least 300 ms after our turn began and at least 1.0 s after the previous segment
ended, so the tail of an earlier reply is not mistaken for an answer to this turn.
  reply latency     onset minus our speech end (negative = it started talking while we were still speaking)
  talked into pause an onset between pause_a's speech end and pause_b's start
  barge stop        time from our interruption beginning until the first >= 600 ms silence in its audio (only if it was talking)
"""
import json, sys

r = json.load(open(sys.argv[1]))
ev = {n: (s, e) for n, s, e in r["events"]}
segs = sorted(r["segs"])
GAP = 1000

def onset(after_start):
    prev_end = None
    for s, e in segs:
        ok_gap = prev_end is None or s - prev_end >= GAP
        if s >= after_start + 300 and ok_gap:
            return s
        prev_end = e
    return None

def utterance_len(s0):
    tot_end = s0
    for s, e in segs:
        if s >= s0 and s - tot_end < 1500:
            tot_end = max(tot_end, e)
        elif s > tot_end:
            break
    return round((tot_end - s0) / 1000, 1)

out = {"label": sys.argv[2] if len(sys.argv) > 2 else "", "threshold": round(r["thr"], 4), "turns": {}}
for name in ("u1", "u2", "u3", "pause_b", "ask"):
    if name not in ev:
        continue
    st, en = ev[name]
    o = onset(st)
    row = {"reply_latency_ms": (o - en) if o is not None else None}
    if o is not None:
        row["spoke_over_us"] = o < en
        row["reply_seconds"] = utterance_len(o)
    out["turns"][name] = row
if "pause_a" in ev and "pause_b" in ev:
    a_end = ev["pause_a"][1]
    b_start = ev["pause_b"][0]
    o = onset(ev["pause_a"][0])
    out["pause_ms"] = b_start - a_end
    out["talked_into_pause"] = bool(o is not None and a_end < o < b_start)
    out["started_after_silence_ms"] = (o - a_end) if (o is not None and a_end < o < b_start) else None
if "interrupt" in ev:
    it, ie = ev["interrupt"]
    containing = [(s, e) for s, e in segs if s <= it <= e + 150]
    stop = None
    if containing:
        s0, e0 = containing[-1]
        k = e0
        for s, e in segs:
            if s > e0 and s - k < 600:
                k = e
                e0 = e
        stop = e0 - it
    out["agent_was_talking_at_interrupt"] = bool(containing)
    out["stopped_after_ms"] = stop
    later = [s for s, e in segs if s > it + (stop or 0) + 300]
    out["answered_interrupt_after_ms"] = (later[0] - ie) if later else None
print(json.dumps(out, indent=1))
