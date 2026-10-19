"""Turn a recorder.npz and the page's event log into numbers.

Usage: python analyze.py <rec.npz> <log.json> <out.json> [label]
log.json: {"events":[{"name":"u1","start":<epoch ms>,"speechEnd":<epoch ms>}, ...]} written by the page-side driver.
"""
import sys, json
import numpy as np

rec = np.load(sys.argv[1]); log = json.load(open(sys.argv[2]))
rms, t0, fs = rec["rms"], float(rec["t0"]), float(rec["frame_s"])
floor = float(np.median(rms[: int(2.0 / fs)])) if len(rms) > 100 else 0.0005
thr = max(0.003, floor * 5)
act = rms > thr
def runs(mask, gap=12):
    idx = np.flatnonzero(mask); out = []
    if len(idx) == 0: return out
    s = pv = idx[0]
    for i in idx[1:]:
        if i - pv > gap: out.append((s * fs + t0, (pv + 1) * fs + t0)); s = i
        pv = i
    out.append((s * fs + t0, (pv + 1) * fs + t0))
    return out
segs = [(s, e) for s, e in runs(act) if e - s >= 0.25]
ev = {e["name"]: e for e in log["events"]}
def sec(ms): return ms / 1000.0
res = {"label": sys.argv[4] if len(sys.argv) > 4 else "", "threshold": round(thr, 4), "floor": round(floor, 5), "turns": []}
names = [e["name"] for e in log["events"]]
for e in log["events"]:
    n = e["name"]; row = {"turn": n}
    end = sec(e["speechEnd"]); start = sec(e["start"])
    if n in ("interrupt",):
        it = start
        i0 = int((it - t0) / fs); stop = None
        for i in range(i0, len(rms) - 8):
            if not act[i:i + 8].any(): stop = i * fs + t0; break
        row["agent_was_talking"] = bool(act[max(0, i0 - 15):i0].any())
        row["stop_after_interrupt_s"] = round(stop - it, 3) if stop else None
        resp = [s for s, _ in segs if stop and s > stop and s > it + 0.2]
        row["answers_interrupt_after_s"] = round(resp[0] - end, 3) if resp else None
    elif n == "pause_a":
        pb = ev.get("pause_b")
        if pb:
            row["talked_into_pause"] = any(end < s < sec(pb["start"]) for s, _ in segs)
            row["pause_s"] = round(sec(pb["start"]) - end, 2)
    else:
        if n == "pause_b" or True:
            nxt = [(s, e2) for s, e2 in segs if s > end - 0.0 + (0 if n != "ask" else 0)]
            nxt = [x for x in nxt if x[0] >= start + 0.2]
            r = nxt[0] if nxt else None
            row["reply_latency_s"] = round(r[0] - end, 3) if r else None
            row["reply_seconds"] = round(r[1] - r[0], 2) if r else None
            row["reply_started_before_speech_end"] = bool(r and r[0] < end) if r else False
    res["turns"].append(row)
res["agent_segments"] = [[round(s - t0, 2), round(e - t0, 2)] for s, e in segs]
json.dump(res, open(sys.argv[3], "w"), indent=1)
print(json.dumps({k: v for k, v in res.items() if k != "agent_segments"}, indent=1))
