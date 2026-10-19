"""Real-microphone, real-speaker rig for timing any voice product the same way.

How it works: simulated speakers (gen_audio.py) are played on the LEFT channel of this PC's speakers. The product under test
(a browser tab, a phone app next to the mic, anything) hears them through the real microphone like a person in the room, and
answers through the same speakers on BOTH channels. Windows loopback capture records what goes to the speakers, so the RIGHT
channel carries only the product's voice and the LEFT channel only ours. Timing is therefore measured outside the product,
with one clock, from the true end of our speech to the first sound of its reply.

Usage:
  uv run --with pyaudiowpatch --with numpy python rig.py <assetsDir> <outJson> [--voice ryan_uk] [--scenario basic|pause|barge|all]
                                   [--noise-snr 10] [--gain 1.0] [--label chatgpt] [--lead 6]
Start the product's voice session first; --lead seconds after launch the rig begins.
"""
import argparse, json, queue, threading, time, sys
import numpy as np
import pyaudiowpatch as pa

SR = 48000
FRAME = SR // 50  # 20 ms
ap = argparse.ArgumentParser()
ap.add_argument("assets")
ap.add_argument("out")
ap.add_argument("--voice", default="ryan_uk")
ap.add_argument("--scenario", default="all")
ap.add_argument("--noise-snr", type=float, default=0.0)
ap.add_argument("--gain", type=float, default=1.0)
ap.add_argument("--label", default="run")
ap.add_argument("--lead", type=float, default=6.0)
ap.add_argument("--max-reply", type=float, default=22.0)
ap.add_argument("--variant", default="n")
a = ap.parse_args()

manifest = json.load(open(f"{a.assets}/manifest.json"))
def clip(key):
    name = f"{a.voice}_{key}_{a.variant if a.voice == 'ryan_uk' and key in ('u1','u2','u3') else 'n'}"
    x = np.load(f"{a.assets}/{name}.npy") * a.gain
    return x, manifest[name]["speech_end"]

p = pa.PyAudio()
lb = p.get_default_wasapi_loopback()
spk = p.get_default_output_device_info()
mic = p.get_default_input_device_info()

# ---- recording (loopback + mic) ---------------------------------------------------------------------------------------
chunks_lb, chunks_mic = [], []
state = {"t0": None, "n": 0}
def lb_cb(data, frames, ti, status):
    if state["t0"] is None:
        state["t0"] = time.perf_counter() - frames / SR
    chunks_lb.append(np.frombuffer(data, dtype=np.int16).reshape(-1, 2).copy())
    state["n"] += frames
    return (None, pa.paContinue)
def mic_cb(data, frames, ti, status):
    chunks_mic.append(np.frombuffer(data, dtype=np.int16).reshape(-1, 2).copy())
    return (None, pa.paContinue)

# ---- playback: one callback stream, dither always on so loopback keeps delivering frames --------------------------------
play_q = queue.Queue()
cur = {"buf": None, "pos": 0, "started": None}
rng = np.random.default_rng(1)
def out_cb(data, frames, ti, status):
    out = (rng.integers(-2, 3, size=(frames, 2)).astype(np.float32) / 32768.0)
    pos = 0
    while pos < frames:
        if cur["buf"] is None:
            try:
                cur["buf"], cur["pos"], cur["tag"] = play_q.get_nowait()
                cur["started"] = time.perf_counter() + pos / SR
                started_log.append((cur["tag"], cur["started"]))
            except queue.Empty:
                break
        n = min(frames - pos, len(cur["buf"]) - cur["pos"])
        out[pos:pos + n, 0] += cur["buf"][cur["pos"]:cur["pos"] + n]
        cur["pos"] += n; pos += n
        if cur["pos"] >= len(cur["buf"]):
            cur["buf"] = None
    return (out.astype(np.float32).tobytes(), pa.paContinue)
started_log = []

s_lb = p.open(format=pa.paInt16, channels=2, rate=SR, input=True, input_device_index=lb["index"], frames_per_buffer=FRAME, stream_callback=lb_cb)
s_mic = p.open(format=pa.paInt16, channels=2, rate=SR, input=True, input_device_index=mic["index"], frames_per_buffer=FRAME, stream_callback=mic_cb)
s_out = p.open(format=pa.paFloat32, channels=2, rate=SR, output=True, output_device_index=spk["index"], frames_per_buffer=FRAME, stream_callback=out_cb)

def now_rec():
    return state["n"] / SR  # recording clock, seconds

def rms_tail(ch, seconds=0.12):
    if not chunks_lb:
        return 0.0
    n = int(seconds * SR)
    last = np.concatenate(chunks_lb[-12:])[-n:, ch].astype(np.float32) / 32768.0
    return float(np.sqrt(np.mean(last ** 2))) if len(last) else 0.0

def play(key_or_arr, tag):
    if isinstance(key_or_arr, str):
        x, end = clip(key_or_arr)
    else:
        x, end = key_or_arr
    if a.noise_snr > 0:
        level = np.sqrt(np.mean(x[x != 0] ** 2)) / (10 ** (a.noise_snr / 20))
        x = x + rng.normal(0, level, size=len(x)).astype(np.float32)
    n0 = len(started_log)
    play_q.put((np.clip(x, -1, 1).astype(np.float32), 0, tag))
    while len(started_log) == n0:
        time.sleep(0.002)
    t_play = started_log[-1][1]
    return {"tag": tag, "perf": t_play, "speech_end_in_clip": end, "dur": len(x) / SR}

def silence(sec):
    time.sleep(sec)

# ---- scenario ----------------------------------------------------------------------------------------------------------
events = []
floor = {"r": 0.002}
def agent_active():
    return rms_tail(1) > thr()
def thr():
    return max(0.004, floor["r"] * 5)

def wait_reply(max_wait, quiet_after=2.2, first_wait=9.0):
    """Wait until the product has started AND finished a reply (or never started)."""
    t_start = time.perf_counter()
    started = False
    last_active = None
    while time.perf_counter() - t_start < max_wait:
        act = agent_active()
        now = time.perf_counter()
        if act:
            started = True
            last_active = now
        if not started and now - t_start > first_wait:
            return False
        if started and last_active and now - last_active > quiet_after:
            return True
        time.sleep(0.02)
    return started

print(f"[rig] label={a.label} voice={a.voice} scenario={a.scenario} noise={a.noise_snr} gain={a.gain}; starting in {a.lead}s", flush=True)
time.sleep(max(a.lead, 3.0))
# noise floor of the right channel (the product's side) while nothing plays
fr = np.concatenate(chunks_lb)[int(1.0 * SR):int(2.5 * SR), 1].astype(np.float32) / 32768.0 if sum(len(c) for c in chunks_lb) > 2.5 * SR else np.zeros(10)
floor["r"] = float(np.sqrt(np.mean(fr ** 2))) if len(fr) else 0.002
# calibration click on the left channel: maps the play clock to the recording clock
click = np.zeros(int(0.3 * SR), dtype=np.float32); click[100:2500] = 0.6 * np.sin(2 * np.pi * 1000 * np.arange(2400) / SR)
cal = play((click, 0.1), "cal")
time.sleep(1.0)

turns = []
def run_turn(tag, keys, gaps=None, then_wait=True):
    t_first = None; segs = []
    for i, k in enumerate(keys):
        ev = play(k, f"{tag}:{k}")
        if t_first is None: t_first = ev
        segs.append(ev)
        time.sleep(ev["dur"] + (gaps[i] if gaps and i < len(gaps) else 0))
    got = wait_reply(a.max_reply) if then_wait else None
    turns.append({"tag": tag, "segs": segs, "got_reply": got})
    return segs

sc = a.scenario
if sc in ("basic", "all"):
    for i, k in enumerate(("u1", "u2", "u3")):
        run_turn(f"t{i+1}", [k]); time.sleep(1.0)
if sc in ("pause", "all"):
    run_turn("pause", ["pause_a", "pause_b"], gaps=[2.3, 0]); time.sleep(1.0)
if sc in ("barge", "all"):
    segs = run_turn("ask", ["ask"], then_wait=False)
    # wait for the product to start talking, let it talk 3 s, then interrupt
    t0 = time.perf_counter(); began = None
    while time.perf_counter() - t0 < 14:
        if agent_active():
            began = time.perf_counter(); break
        time.sleep(0.02)
    if began:
        time.sleep(3.0)
        ev = play("interrupt", "barge:interrupt")
        turns.append({"tag": "barge", "segs": [ev], "got_reply": None, "agent_began": began})
        time.sleep(ev["dur"] + 1.0)
        wait_reply(10.0)
    else:
        turns.append({"tag": "barge", "segs": [], "got_reply": False})
time.sleep(1.5)

s_out.stop_stream(); s_lb.stop_stream(); s_mic.stop_stream()
s_out.close(); s_lb.close(); s_mic.close(); p.terminate()

# ---- analysis ----------------------------------------------------------------------------------------------------------
LB = np.concatenate(chunks_lb).astype(np.float32) / 32768.0
MIC = np.concatenate(chunks_mic).astype(np.float32) / 32768.0
t0 = state["t0"]
nfr = len(LB) // FRAME
def frames(x):
    return np.sqrt((x[:nfr * FRAME].reshape(nfr, FRAME) ** 2).mean(axis=1))
L, R = frames(LB[:, 0]), frames(LB[:, 1])
# click -> offset between the play clock and the recording clock
click_idx = int(np.argmax(L > 0.05)); click_rec = click_idx * FRAME / SR
offset = click_rec - (cal["perf"] - t0)
thr_r = max(0.004, floor["r"] * 5)
act = R > thr_r
def segments(mask, gap_frames=12):
    """Runs of active frames; silences shorter than gap_frames (240 ms) do not split a run."""
    idx = np.flatnonzero(mask)
    out = []
    if len(idx) == 0:
        return out
    start = prev = idx[0]
    for i in idx[1:]:
        if i - prev > gap_frames:
            out.append((start * FRAME / SR, (prev + 1) * FRAME / SR)); start = i
        prev = i
    out.append((start * FRAME / SR, (prev + 1) * FRAME / SR))
    return out
agent_segs = [(s, e) for s, e in segments(act) if e - s >= 0.25]

def rec_t(ev):  # play clock -> recording clock
    return ev["perf"] - t0 + offset

res = {"label": a.label, "voice": a.voice, "scenario": a.scenario, "noise_snr_db": a.noise_snr, "gain": a.gain, "right_threshold": thr_r, "right_floor": floor["r"], "turns": []}
mic_during = []
for t in turns:
    row = {"tag": t["tag"], "got_reply": t["got_reply"]}
    if not t["segs"]:
        res["turns"].append(row); continue
    last = t["segs"][-1]
    end = rec_t(last) + last["speech_end_in_clip"]
    start0 = rec_t(t["segs"][0])
    row["speech_end_rec"] = round(end, 3)
    nxt = [s for s, e in agent_segs if s > start0]
    if t["tag"] == "pause":
        a_end = rec_t(t["segs"][0]) + t["segs"][0]["speech_end_in_clip"]
        b_start = rec_t(t["segs"][1])
        row["talked_into_pause"] = any(a_end < s < b_start for s, e in agent_segs)
        row["pause_s"] = round(b_start - a_end, 2)
    if t["tag"] == "barge":
        it = rec_t(last)
        pre = [(s, e) for s, e in agent_segs if s < it and e > it - 0.2]
        row["agent_was_talking"] = bool(pre) or bool(act[int(max(0, it - 0.3) * SR / FRAME):int(it * SR / FRAME)].any())
        # first quiet stretch (>=150 ms) of the product's channel after our interruption started
        i0 = int(it * SR / FRAME); stop = None
        for i in range(i0, len(R) - 8):
            if not act[i:i + 8].any():
                stop = i * FRAME / SR; break
        row["stop_after_interrupt_s"] = round(stop - it, 3) if stop is not None else None
        # agent's first sound after our interruption ended (does it answer it?)
        e_int = it + last["speech_end_in_clip"]
        resp = [s for s, e in agent_segs if s > (stop or it) and s > it + 0.2]
        row["answers_interrupt_after_s"] = round(resp[0] - e_int, 3) if resp else None
    elif t["tag"] != "ask":
        cand = [s for s in nxt if s >= (rec_t(t["segs"][0]) + 0.2)]
        if t["tag"] == "pause":
            cand = [s for s in nxt if s >= rec_t(t["segs"][1])]
        r0 = cand[0] if cand else None
        row["reply_latency_s"] = round(r0 - end, 3) if r0 is not None else None
        if r0 is not None:
            seg = [e for s, e in agent_segs if abs(s - r0) < 0.05]
            row["reply_seconds"] = round(seg[0] - r0, 2) if seg else None
    else:
        r0 = next((s for s in nxt if s >= start0 + 0.2), None)
        row["reply_latency_s"] = round(r0 - end, 3) if r0 is not None else None
    # was the speech audible to the real microphone?
    m0, m1 = int(rec_t(t["segs"][0]) * SR), int(end * SR)
    if 0 <= m0 < m1 <= len(MIC):
        mic_during.append(float(np.sqrt(np.mean(MIC[m0:m1] ** 2))))
    res["turns"].append(row)
res["mic_rms_during_speech"] = round(float(np.mean(mic_during)), 5) if mic_during else None
res["mic_rms_idle"] = round(float(np.sqrt(np.mean(MIC[int(1.0 * SR):int(2.5 * SR)] ** 2))), 5) if len(MIC) > 3 * SR else None
res["agent_segments"] = [[round(s, 2), round(e, 2)] for s, e in agent_segs]
res["duration_s"] = round(len(LB) / SR, 1)
ds = int(0.1 * SR / FRAME * 5) or 1
json.dump(res, open(a.out, "w"), indent=1)
print(json.dumps({k: v for k, v in res.items() if k != "agent_segments"}, indent=1))
