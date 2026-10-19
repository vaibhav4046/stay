"""Make the simulated speakers for the real-microphone rig.

Usage: uv run --with edge-tts --with numpy python scripts/voice-e2e/realmic/gen_audio.py <outDir>

Every line is spoken by a neural voice (edge-tts), resampled to 48 kHz mono float32 and written as .npy next to a
manifest with the exact speech-end offset of each clip, so the rig never has to guess where a speaker stopped talking.
"""
import asyncio, json, subprocess, sys, os
import numpy as np
import edge_tts

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

VOICES = {
    "ryan_uk": "en-GB-RyanNeural",
    "jenny_us": "en-US-JennyNeural",
    "william_au": "en-AU-WilliamNeural",
    "neerja_in": "en-IN-NeerjaNeural",
}
LINES = {
    "u1": "Um, I keep putting off replying to my landlord about the renewal.",
    "u2": "I do not even know what to write, it feels huge.",
    "u3": "Okay, maybe. What would the first sentence even be?",
    "pause_a": "I need to, um, send that email, and, uh,",
    "pause_b": "and I keep thinking about how to even start it.",
    "ask": "Can you give me a really detailed plan for my whole week please.",
    "interrupt": "Wait, stop, just one tiny step please.",
    "backchannel": "Mm-hm.",
}
SR = 48000


async def synth(text, voice, rate, path):
    await edge_tts.Communicate(text, voice, rate=rate).save(path)


def decode(mp3):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", mp3, "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def trim_and_end(x):
    """Leading silence stays out; return the clip and where speech really ends."""
    a = np.abs(x)
    idx = np.where(a > 0.02)[0]
    if len(idx) == 0:
        return x, len(x) / SR
    start, end = max(0, idx[0] - int(0.05 * SR)), idx[-1]
    return x[start:], (end - start) / SR


async def main():
    manifest = {}
    for vkey, voice in VOICES.items():
        for lkey, text in LINES.items():
            for variant, rate in (("n", "+0%"), ("fast", "+35%")) if vkey == "ryan_uk" and lkey in ("u1", "u2", "u3") else (("n", "+0%"),):
                name = f"{vkey}_{lkey}_{variant}"
                mp3 = os.path.join(OUT, name + ".mp3")
                await synth(text, voice, rate, mp3)
                x, end = trim_and_end(decode(mp3))
                x = x / max(0.001, float(np.max(np.abs(x)))) * 0.85
                np.save(os.path.join(OUT, name + ".npy"), x)
                manifest[name] = {"seconds": len(x) / SR, "speech_end": end, "text": text, "voice": voice, "rate": rate}
                os.remove(mp3)
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    print(len(manifest), "clips")


asyncio.run(main())
