"""Record what this PC sends to its speakers (WASAPI loopback, works with the speakers muted) as 20 ms RMS frames on the
epoch clock, so a product's reply audio can be timed against events logged by the page that is feeding it a fake microphone.

Usage: uv run --with pyaudiowpatch --with numpy python recorder.py <seconds> <out.npz> [live.json]
"""
import sys, time, json
import numpy as np
import pyaudiowpatch as pa

SR, FRAME = 48000, 960
secs, out = float(sys.argv[1]), sys.argv[2]
live = sys.argv[3] if len(sys.argv) > 3 else None
p = pa.PyAudio()
lb = p.get_default_wasapi_loopback()
rms, state = [], {"t0": None, "carry": np.zeros((0, 2), np.float32)}
def cb(data, frames, ti, status):
    if state["t0"] is None:
        state["t0"] = time.time() - frames / SR
    x = np.concatenate([state["carry"], np.frombuffer(data, dtype=np.int16).reshape(-1, 2).astype(np.float32) / 32768.0])
    n = len(x) // FRAME
    if n:
        f = x[: n * FRAME].reshape(n, FRAME, 2)
        rms.extend(np.sqrt((f ** 2).mean(axis=1)).max(axis=1).tolist())
    state["carry"] = x[n * FRAME:]
    return (None, pa.paContinue)
# keep frames flowing in silence: inaudible dither on the output
rng = np.random.default_rng(1)
def ocb(data, frames, ti, status):
    return ((rng.integers(-2, 3, size=(frames, 2)).astype(np.float32) / 32768.0).tobytes(), pa.paContinue)
so = p.open(format=pa.paFloat32, channels=2, rate=SR, output=True, output_device_index=p.get_default_output_device_info()["index"], frames_per_buffer=FRAME, stream_callback=ocb)
si = p.open(format=pa.paInt16, channels=2, rate=SR, input=True, input_device_index=lb["index"], frames_per_buffer=FRAME, stream_callback=cb)
end = time.time() + secs
print("recording", secs, "s", flush=True)
while time.time() < end:
    time.sleep(0.5)
    if live and rms and state["t0"]:
        tail = np.array(rms[-50:])
        json.dump({"epoch": time.time(), "rms_1s": float(tail.max()), "frames": len(rms)}, open(live, "w"))
si.stop_stream(); so.stop_stream(); si.close(); so.close(); p.terminate()
np.savez(out, rms=np.array(rms, np.float32), t0=state["t0"], frame_s=FRAME / SR)
print("saved", out, len(rms), "frames")
