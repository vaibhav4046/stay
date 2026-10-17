import asyncio
import json
import math
import os
import subprocess
import wave
from pathlib import Path
import numpy as np
import edge_tts
import imageio_ffmpeg

FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
OUT_DIR = Path(__file__).resolve().parent / "video_build"
OUT_DIR.mkdir(parents=True, exist_ok=True)

STAY_VOICE = "en-GB-SoniaNeural"   # Warm, calm British female voice ("Anna" persona)
USER_VOICE = "en-US-AndrewNeural"  # Natural, relatable user voice ("Vaibhav")

# 3-Act Script (~175s - 180s total with natural pauses)
TURNS = [
    # --- ACT 1: STAY LIVING ORB INTRO & LIVE SHAPE MORPH DEMO (0:00 - 0:32) ---
    {
        "id": "01_stay_intro_1",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-3%",
        "action": "act1_orb_intro",
        "caption": "Hi, I am Stay — Voice-First ADHD Task Initiation & Living Visual Companion.",
        "text": "Hi, I am Stay. I am a voice-first point-of-performance companion built for the exact second ADHD executive freeze hits.",
        "pause_after": 0.8,
    },
    {
        "id": "02_stay_intro_2",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-3%",
        "action": "act1_orb_morph_showcase",
        "caption": "Living Shape Morphing: 🌊 Fluid Wave → 🪷 8-Petal Lotus → ✒️ Letterform Gem → 🍦 Ice Cream Swirl → 🎨 Creative Star.",
        "text": "Instead of overwhelming task lists that trigger guilt, I listen to messy, unfiltered thoughts and physically transform my geometry in real time—shifting into calming lotus petals, crystalline letterforms, or an ice cream cone reward to anchor your attention.",
        "pause_after": 1.0,
    },

    # --- ACT 2: REALISTIC CHAOTIC ADHD USER — DE-JARGONING, HOOK & HANDS-FREE COMMANDS (0:32 - 2:14) ---
    {
        "id": "03_user_hello",
        "speaker": "user",
        "voice": USER_VOICE,
        "rate": "+2%",
        "action": "act2_user_wake",
        "caption": "Hi Stay... ugh, are you there?",
        "text": "Hi Stay... ugh, are you there?",
        "pause_after": 0.5,
    },
    {
        "id": "04_stay_hello",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-2%",
        "action": "act2_stay_greet",
        "caption": "Hi! I'm right here with you. Dump whatever is in your head—no need to organize it.",
        "text": "Hi! I'm right here with you. Take a slow breath and dump whatever is bouncing around in your head—you don't have to organize it for me.",
        "pause_after": 0.7,
    },
    {
        "id": "05_user_chaotic_dump",
        "speaker": "user",
        "voice": USER_VOICE,
        "rate": "+5%",
        "action": "act2_chaotic_brain_dump",
        "caption": "Uhh my brain is completely fried, I have like 10 tabs open, landlord emails, VAT taxes... idk where to start.",
        "text": "Honestly, uhh, my brain is completely fried right now. I have like ten tabs open, my landlord is asking for a lease letter, my quarterly VAT taxes are overdue, and I'm just doomscrolling because I don't even know where to start.",
        "pause_after": 0.7,
    },
    {
        "id": "06_stay_hook_and_lotus",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-3%",
        "action": "act2_lotus_to_letterform_reality",
        "caption": "Auto-Morph: 🪷 8-Petal Lotus Calm → ✒️ Crystalline Letterform Gem · 180m Dread shrunk to 45s Micro-Entry.",
        "text": "Pause right there—you don't need to fix all ten tabs today. Watch my orb open into an eight-petal lotus first to slow your breathing down, and now crystallize into a letterform gem. I stripped out the noise and isolated one target: your landlord and tax letter. Your brain predicts three hours of misery, but breaking inertia takes just forty-five seconds.",
        "pause_after": 0.8,
    },
    {
        "id": "07_user_ice_cream_hook",
        "speaker": "user",
        "voice": USER_VOICE,
        "rate": "+2%",
        "action": "act2_select_angle_and_ice_cream",
        "caption": "Wait, 45 seconds for 3 messy bullets? I can do that! Remind me I get ice cream after.",
        "text": "Wait, forty-five seconds just to type three terrible, messy bullets? Okay, I can actually do that. Let's pick that angle—and hey, remind me I can grab ice cream right after I finish!",
        "pause_after": 0.7,
    },
    {
        "id": "08_stay_ice_cream_morph",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-3%",
        "action": "act2_ice_cream_and_memory_extract",
        "caption": "Orb Morphs into 🍦 Ice Cream Cone & Swirl · Dopamine Reward Saved to Cognitive Memory.",
        "text": "Look at my shape—I just morphed into a strawberry ice cream cone with a waffle base so your brain can see the reward waiting for you! And I automatically saved that reward to your cognitive memory.",
        "pause_after": 0.8,
    },
    {
        "id": "09_user_commands",
        "speaker": "user",
        "voice": USER_VOICE,
        "rate": "+0%",
        "action": "act2_voice_cmd_memory_and_history",
        "caption": "No way—show me memory, and then show me chat history!",
        "text": "No way—show me memory, and then show me chat history!",
        "pause_after": 0.7,
    },
    {
        "id": "10_stay_memory_shown",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-2%",
        "action": "act2_close_modals_and_path",
        "caption": "100% Hands-Free Voice Control: Cognitive Memory → Session History → 3-Phase Action Path.",
        "text": "Here is your persistent cognitive memory and your past session history, opened completely hands-free by voice. Now check out your three-phase action path right below.",
        "pause_after": 0.8,
    },
    {
        "id": "11_user_multilingual",
        "speaker": "user",
        "voice": USER_VOICE,
        "rate": "+0%",
        "action": "act2_multilingual_and_timer",
        "caption": "Switch to Spanish, and start 20 minutes!",
        "text": "That is so clean. Switch to Spanish, and start 20 minutes!",
        "pause_after": 0.7,
    },
    {
        "id": "12_stay_spanish_timer",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-2%",
        "action": "act2_timer_running",
        "caption": "¡Claro que sí! 32-Language Live Switch + 20-Minute Focus Sprint Started.",
        "text": "Claro que sí. I've switched to Spanish across our thirty-two language engine and started your twenty-minute focus sprint. Just write three messy bullets—I'm staying right here with you.",
        "pause_after": 1.1,
    },

    # --- ACT 3: FULL SVG ARCHITECTURE DIAGRAMS, UNIVERSAL-3 PRO & CLOSING (2:14 - 3:00) ---
    {
        "id": "13_stay_arch_1",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-3%",
        "action": "act3_architecture_reports",
        "caption": "System Architecture SVG: AssemblyAI Universal-3 Pro (24kHz Single-WebSocket) + Groq 120B.",
        "text": "Here is the engineering behind what you just saw. Stay streams raw twenty-four kilohertz PCM audio over a single full-duplex WebSocket to AssemblyAI's Universal-Three Pro Voice Agent API—delivering sub-second turn-taking, live barge-in, ADHD keyterm boosting, and thirty-two language detection without stitching separate pipelines.",
        "pause_after": 0.9,
    },
    {
        "id": "14_stay_arch_2",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-3%",
        "action": "act3_orb_diagnostic_and_safety",
        "caption": "Groq openai/gpt-oss-120b · Deterministic Safety Gates · 60fps GLSL & SVG Shape-Morphing Engine.",
        "text": "For chaotic brain-dump extraction and time-blindness math, Stay pairs AssemblyAI with Groq's ultra-fast GPT-OSS one-twenty-B model, protected by deterministic pre-LLM crisis and medication safety gates, and one-click clinician PDF exports.",
        "pause_after": 0.9,
    },
    {
        "id": "15_stay_outro",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-4%",
        "action": "act3_closing_card",
        "caption": "STAY — Voice-First ADHD Task Initiation · stay-two-swart.vercel.app · github.com/vaibhav4046/stay",
        "text": "Available today on Web, Desktop, and Mobile PWA, with full open-source code on GitHub. Stay—helping any mind move from chaos to started, in sixty seconds.",
        "pause_after": 2.0,
    },
]


def mp3_to_wav_24k_stereo(mp3_path: Path, wav_path: Path):
    cmd = [
        FFMPEG_EXE,
        "-y",
        "-i",
        str(mp3_path),
        "-ar",
        "24000",
        "-ac",
        "2",
        "-sample_fmt",
        "s16",
        str(wav_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def read_wav_float(wav_path: Path) -> np.ndarray:
    with wave.open(str(wav_path), "rb") as wf:
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        return data.reshape(-1, 2)


def synthesize_therapeutic_bgm(duration_sec: float, sr: int = 24000) -> np.ndarray:
    """
    Synthesizes a warm, meditative, composed, therapeutic ambient soundscape:
    - Cmaj9 / Fmaj7 warm harmonic pad (C3, G3, B3, D4, E4 + slow breathing LFO)
    - 432Hz / 528Hz gentle singing-bowl overtones with soft exponential decay chimes
    - Stereo spatial breath modulation
    """
    n_samples = int(duration_sec * sr)
    t = np.linspace(0, duration_sec, n_samples, endpoint=False, dtype=np.float32)

    c1_freqs = [130.81, 196.00, 246.94, 293.66, 329.63]
    c2_freqs = [174.61, 220.00, 261.63, 329.63, 392.00]

    pad_l = np.zeros(n_samples, dtype=np.float32)
    pad_r = np.zeros(n_samples, dtype=np.float32)

    blend = 0.5 + 0.5 * np.sin(2 * np.pi * t / 24.0)

    for i, (f1, f2) in enumerate(zip(c1_freqs, c2_freqs)):
        lfo_l = 0.7 + 0.3 * np.sin(2 * np.pi * (0.07 + i * 0.015) * t + i)
        lfo_r = 0.7 + 0.3 * np.cos(2 * np.pi * (0.06 + i * 0.015) * t + i * 0.5)
        amp = 0.22 / (i + 1) ** 0.45

        c1_wave_l = np.sin(2 * np.pi * (f1 * 0.999) * t) * lfo_l
        c1_wave_r = np.sin(2 * np.pi * (f1 * 1.001) * t) * lfo_r

        c2_wave_l = np.sin(2 * np.pi * (f2 * 0.999) * t) * lfo_l
        c2_wave_r = np.sin(2 * np.pi * (f2 * 1.001) * t) * lfo_r

        pad_l += amp * ((1.0 - blend) * c1_wave_l + blend * c2_wave_l)
        pad_r += amp * ((1.0 - blend) * c1_wave_r + blend * c2_wave_r)

    sub = 0.16 * np.sin(2 * np.pi * 65.41 * t) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.08 * t))
    pad_l += sub
    pad_r += sub

    chime_notes = [523.25, 659.25, 783.99, 587.33, 659.25, 880.00]
    chime_interval = 7.5
    n_chimes = int(duration_sec / chime_interval)
    for c_idx in range(n_chimes):
        start_time = c_idx * chime_interval + 1.2
        start_sample = int(start_time * sr)
        chime_len = int(5.5 * sr)
        end_sample = min(n_samples, start_sample + chime_len)
        if end_sample <= start_sample:
            continue
        local_t = np.arange(end_sample - start_sample, dtype=np.float32) / sr
        freq = chime_notes[c_idx % len(chime_notes)]
        env = np.minimum(1.0, local_t / 0.08) * np.exp(-local_t / 1.8)
        tone = 0.12 * np.sin(2 * np.pi * freq * local_t) * env
        pan = 0.35 if c_idx % 2 == 0 else 0.65
        pad_l[start_sample:end_sample] += tone * pan
        pad_r[start_sample:end_sample] += tone * (1.0 - pan)

    bgm = np.stack([pad_l, pad_r], axis=-1)
    peak = np.max(np.abs(bgm)) + 1e-6
    bgm = bgm / peak * 0.14  # Gentle therapeutic level under voice

    fade_in = min(int(2.0 * sr), n_samples)
    fade_out = min(int(3.0 * sr), n_samples)
    bgm[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)[:, None]
    bgm[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)[:, None]

    return bgm


async def build_all():
    sr = 24000
    timeline = []
    voice_segments = []

    current_sec = 1.2  # 1.2s calm BGM intro before Stay speaks

    for turn in TURNS:
        mp3_file = OUT_DIR / f"{turn['id']}.mp3"
        wav_file = OUT_DIR / f"{turn['id']}.wav"

        print(f"Synthesizing [{turn['id']}] ({turn['speaker']})...")
        comm = edge_tts.Communicate(turn["text"], turn["voice"], rate=turn["rate"])
        await comm.save(str(mp3_file))
        mp3_to_wav_24k_stereo(mp3_file, wav_file)

        audio_data = read_wav_float(wav_file)
        dur_sec = len(audio_data) / sr

        start_sec = round(current_sec, 3)
        end_sec = round(start_sec + dur_sec, 3)

        timeline.append(
            {
                "id": turn["id"],
                "speaker": turn["speaker"],
                "action": turn["action"],
                "caption": turn["caption"],
                "text": turn["text"],
                "start_sec": start_sec,
                "duration_sec": round(dur_sec, 3),
                "end_sec": end_sec,
                "pause_after_sec": turn["pause_after"],
            }
        )

        voice_segments.append((int(start_sec * sr), audio_data))
        current_sec = end_sec + turn["pause_after"]

    total_duration_sec = round(current_sec + 2.0, 2)
    print(f"Total video timeline duration: {total_duration_sec:.2f}s ({total_duration_sec/60:.2f} min)")

    total_samples = int(total_duration_sec * sr)
    master = synthesize_therapeutic_bgm(total_duration_sec, sr)

    voice_track = np.zeros_like(master)
    duck_envelope = np.ones((total_samples, 1), dtype=np.float32)

    for start_idx, seg in voice_segments:
        end_idx = min(total_samples, start_idx + len(seg))
        seg_slice = seg[: end_idx - start_idx]
        peak = np.max(np.abs(seg_slice)) + 1e-6
        seg_norm = seg_slice / peak * 0.86
        voice_track[start_idx:end_idx] += seg_norm
        duck_envelope[start_idx:end_idx] = 0.52

    mix = master * duck_envelope + voice_track
    mix = np.clip(mix, -0.98, 0.98)

    master_wav = OUT_DIR / "master_demo_audio.wav"
    with wave.open(str(master_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        pcm16 = (mix * 32767.0).astype(np.int16)
        wf.writeframes(pcm16.tobytes())

    timeline_json = OUT_DIR / "timeline.json"
    with open(timeline_json, "w", encoding="utf-8") as f:
        json.dump(
            {
                "total_duration_sec": total_duration_sec,
                "master_wav": str(master_wav),
                "turns": timeline,
            },
            f,
            indent=2,
        )

    print(f"Saved master audio to {master_wav} and timeline to {timeline_json}")


if __name__ == "__main__":
    asyncio.run(build_all())
