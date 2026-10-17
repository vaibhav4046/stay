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
    # --- ACT 1: STAY LIVING ORB INTRO (0:00 - 0:30) ---
    {
        "id": "01_stay_intro_1",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-4%",
        "action": "act1_orb_intro",
        "caption": "Hi, I am Stay.",
        "text": "Hi, I am Stay. I am a voice-first point-of-performance companion built for the exact second ADHD executive freeze hits.",
        "pause_after": 0.9,
    },
    {
        "id": "02_stay_intro_2",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-4%",
        "action": "act1_orb_mission",
        "caption": "No complex task lists. No shame spirals. Just one calm voice.",
        "text": "While millions wait years for clinical care or struggle between appointments, traditional task managers only pile on more guilt. I sit right beside you as a warm, judgment-free body double—shrinking overwhelming mountains into one sixty-second physical move.",
        "pause_after": 1.2,
    },

    # --- ACT 2: LIVE CONVERSATION — SHOW, DON'T TELL (0:30 - 2:15) ---
    {
        "id": "03_user_hello",
        "speaker": "user",
        "voice": USER_VOICE,
        "rate": "+0%",
        "action": "act2_user_wake",
        "caption": "Hi Stay.",
        "text": "Hi Stay.",
        "pause_after": 0.6,
    },
    {
        "id": "04_stay_hello",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-2%",
        "action": "act2_stay_greet",
        "caption": "Hi! I'm right here with you. What's hanging over your head?",
        "text": "Hi! I'm right here with you. Take a slow breath—what's hanging over your head right now?",
        "pause_after": 0.8,
    },
    {
        "id": "05_user_freeze",
        "speaker": "user",
        "voice": USER_VOICE,
        "rate": "+2%",
        "action": "act2_type_letters_task",
        "caption": "I have to write letters to my landlord and finish my quarterly tax paperwork...",
        "text": "Honestly, I'm completely frozen. I have to write letters to my landlord and finish my quarterly tax paperwork, and it feels like it's going to take three hours.",
        "pause_after": 0.8,
    },
    {
        "id": "06_stay_reality",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-3%",
        "action": "act2_show_reality_and_angles",
        "caption": "Time Blindness Check: ~180m perceived dread → 45-second micro-entry (86% momentum).",
        "text": "Ugh, tax letters trigger instant dread—Notice how my orb just shifted into crystalline letterforms with you. Your ADHD brain predicts three hours of pain, but our Time Reality Calculator shows breaking inertia takes just forty-five seconds, with an eighty-six percent momentum rate. Want the three-bullet draft angle?",
        "pause_after": 0.9,
    },
    {
        "id": "07_user_therapeutic",
        "speaker": "user",
        "voice": USER_VOICE,
        "rate": "+0%",
        "action": "act2_select_angle_and_therapeutic",
        "caption": "Yes, let's pick that angle. Give me a therapeutic calm moment first, and maybe ice cream as a reward after.",
        "text": "Yes, let's pick that angle. Can we make this feel therapeutic and calm first? And remind me I can grab ice cream as a reward when I finish.",
        "pause_after": 0.8,
    },
    {
        "id": "08_stay_morph",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-4%",
        "action": "act2_ice_cream_and_memory_extract",
        "caption": "Orb morphs: 🪷 Therapeutic Lotus Calm → 🍦 Reward Swirl (Saved to Memory).",
        "text": "Watch my geometry soften into therapeutic lotus ripples, and swirl into an ice cream cone for your reward. I've saved that reward to your cognitive memory.",
        "pause_after": 0.9,
    },
    {
        "id": "09_user_commands",
        "speaker": "user",
        "voice": USER_VOICE,
        "rate": "+0%",
        "action": "act2_voice_cmd_memory_and_history",
        "caption": "Show me memory, and then show me chat history.",
        "text": "Show me memory, and then show me chat history.",
        "pause_after": 0.8,
    },
    {
        "id": "10_stay_memory_shown",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-2%",
        "action": "act2_close_modals_and_path",
        "caption": "Opening Cognitive Memory & Session History — 100% hands-free.",
        "text": "Here is your persistent cognitive memory and your full session history—all controlled hands-free by voice. I've also mapped your three-phase action path right below.",
        "pause_after": 0.9,
    },
    {
        "id": "11_user_multilingual",
        "speaker": "user",
        "voice": USER_VOICE,
        "rate": "+0%",
        "action": "act2_multilingual_and_timer",
        "caption": "Switch to Spanish, and start 20 minutes!",
        "text": "Amazing. Switch to Spanish, and start 20 minutes!",
        "pause_after": 0.7,
    },
    {
        "id": "12_stay_spanish_timer",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-2%",
        "action": "act2_timer_running",
        "caption": "¡Claro! Temporizador de veinte minutos iniciado Across 32 Languages.",
        "text": "Claro que sí. I've switched to Spanish across our thirty-two language engine and started your twenty-minute focus sprint. Just type three messy bullet points—I'm staying right here with you.",
        "pause_after": 1.2,
    },

    # --- ACT 3: ARCHITECTURE, EFFICIENCY & HACKATHON CLOSING (2:15 - 3:00) ---
    {
        "id": "13_stay_arch_1",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-3%",
        "action": "act3_architecture_reports",
        "caption": "How Stay Works: AssemblyAI Universal-3 Pro + Groq gpt-oss-120b.",
        "text": "What you just witnessed is Stay's full-duplex architecture in action. Under the hood, Stay streams raw twenty-four kilohertz PCM audio over a single WebSocket to AssemblyAI's Universal-Three Pro Voice Agent API—delivering sub-second turn-taking, live barge-in, keyterm boosting, and thirty-two language detection without stitching separate pipelines.",
        "pause_after": 1.0,
    },
    {
        "id": "14_stay_arch_2",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-3%",
        "action": "act3_orb_diagnostic_and_safety",
        "caption": "Deterministic Safety Gates · Clinician PDF Export · 60fps Three.js GLSL Orb.",
        "text": "For structured task decomposition and time-blindness math, Stay pairs AssemblyAI with Groq's ultra-fast GPT-OSS one-twenty-B model, backed by a deterministic offline CBT engine, hard clinical and crisis safety boundaries, and one-click clinician PDF exports.",
        "pause_after": 1.0,
    },
    {
        "id": "15_stay_outro",
        "speaker": "stay",
        "voice": STAY_VOICE,
        "rate": "-4%",
        "action": "act3_closing_card",
        "caption": "Stay — Voice-First ADHD Task Initiation · github.com/vaibhav4046/stay",
        "text": "Available today on Web, Desktop, and Mobile PWA, with full open-source code on GitHub. Stay—helping you move from frozen to started, one gentle conversation at a time.",
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
        "-Sample_fmt",
        "s16",
        str(wav_path),
    ]
    # Note: -sample_fmt is lowercase in ffmpeg
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

    # Chord progression crossfading slowly every 16 seconds:
    # Chord 1 (Cmaj9): 130.81 (C3), 196.00 (G3), 246.94 (B3), 293.66 (D4), 329.63 (E4)
    # Chord 2 (Fmaj9): 174.61 (F3), 220.00 (A3), 261.63 (C4), 329.63 (E4), 392.00 (G4)
    c1_freqs = [130.81, 196.00, 246.94, 293.66, 329.63]
    c2_freqs = [174.61, 220.00, 261.63, 329.63, 392.00]

    pad_l = np.zeros(n_samples, dtype=np.float32)
    pad_r = np.zeros(n_samples, dtype=np.float32)

    # Smooth crossfade wave between Chord 1 and Chord 2 (period = 24s)
    blend = 0.5 + 0.5 * np.sin(2 * np.pi * t / 24.0)

    for i, (f1, f2) in enumerate(zip(c1_freqs, c2_freqs)):
        # Slight detune for warm chorus stereo width
        lfo_l = 0.7 + 0.3 * np.sin(2 * np.pi * (0.07 + i * 0.015) * t + i)
        lfo_r = 0.7 + 0.3 * np.cos(2 * np.pi * (0.06 + i * 0.015) * t + i * 0.5)
        amp = 0.22 / (i + 1) ** 0.45

        c1_wave_l = np.sin(2 * np.pi * (f1 * 0.999) * t) * lfo_l
        c1_wave_r = np.sin(2 * np.pi * (f1 * 1.001) * t) * lfo_r

        c2_wave_l = np.sin(2 * np.pi * (f2 * 0.999) * t) * lfo_l
        c2_wave_r = np.sin(2 * np.pi * (f2 * 1.001) * t) * lfo_r

        pad_l += amp * (blend * c1_wave_l + (1.0 - blend) * c2_wave_l)
        pad_r += amp * (blend * c1_wave_r + (1.0 - blend) * c2_wave_r)

    # Deep sub-bass grounding drone (C2 = 65.41 Hz)
    sub = 0.14 * np.sin(2 * np.pi * 65.41 * t) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.05 * t))
    pad_l += sub
    pad_r += sub

    # Gentle Tibetan singing bowl harmonic chimes every 9 seconds
    bowl_notes = [523.25, 659.25, 587.33, 493.88, 783.99]  # C5, E5, D5, B4, G5
    for idx, start_t in enumerate(np.arange(1.5, duration_sec - 4.0, 8.5)):
        f_bowl = bowl_notes[idx % len(bowl_notes)]
        start_idx = int(start_t * sr)
        length = min(int(6.5 * sr), n_samples - start_idx)
        if length <= 0:
            continue
        tb = np.linspace(0, length / sr, length, endpoint=False, dtype=np.float32)
        env = np.sin(np.pi * np.minimum(tb / 0.08, 1.0)) * np.exp(-tb / 2.2)
        tone = 0.06 * (
            np.sin(2 * np.pi * f_bowl * tb)
            + 0.35 * np.sin(2 * np.pi * (f_bowl * 2.0) * tb)
        ) * env
        pan = 0.35 if idx % 2 == 0 else 0.65
        pad_l[start_idx : start_idx + length] += tone * pan
        pad_r[start_idx : start_idx + length] += tone * (1.0 - pan)

    # Fade in 2.0s and fade out 3.5s
    fade_in = int(2.0 * sr)
    fade_out = int(3.5 * sr)
    pad_l[:fade_in] *= np.linspace(0, 1, fade_in, dtype=np.float32)
    pad_r[:fade_in] *= np.linspace(0, 1, fade_in, dtype=np.float32)
    pad_l[-fade_out:] *= np.linspace(1, 0, fade_out, dtype=np.float32)
    pad_r[-fade_out:] *= np.linspace(1, 0, fade_out, dtype=np.float32)

    stereo = np.stack([pad_l, pad_r], axis=1)
    max_val = np.max(np.abs(stereo)) + 1e-6
    return (stereo / max_val) * 0.25


async def main():
    sr = 24000
    timeline = []
    voice_segments = []

    # 1.2s calm BGM lead-in before Stay speaks
    lead_in_sec = 1.2
    voice_segments.append(np.zeros((int(lead_in_sec * sr), 2), dtype=np.float32))
    current_time = lead_in_sec

    for turn in TURNS:
        mp3_file = OUT_DIR / f"{turn['id']}.mp3"
        wav_file = OUT_DIR / f"{turn['id']}.wav"

        communicate = edge_tts.Communicate(
            turn["text"],
            turn["voice"],
            rate=turn.get("rate", "+0%"),
        )
        await communicate.save(str(mp3_file))
        mp3_to_wav_24k_stereo(mp3_file, wav_file)

        samples = read_wav_float(wav_file)
        dur = len(samples) / sr
        pause = turn.get("pause_after", 0.8)

        timeline.append(
            {
                "id": turn["id"],
                "speaker": turn["speaker"],
                "action": turn["action"],
                "caption": turn["caption"],
                "text": turn["text"],
                "start_sec": round(current_time, 3),
                "duration_sec": round(dur, 3),
                "end_sec": round(current_time + dur, 3),
                "pause_after_sec": pause,
            }
        )

        voice_segments.append(samples)
        voice_segments.append(np.zeros((int(pause * sr), 2), dtype=np.float32))
        current_time += dur + pause

    # Pad or trim outro so total video is right around 178-180s (3 minutes)
    target_total = 178.0
    if current_time < target_total:
        extra = target_total - current_time
        voice_segments.append(np.zeros((int(extra * sr), 2), dtype=np.float32))
        current_time = target_total

    voice_track = np.concatenate(voice_segments, axis=0)
    total_duration = len(voice_track) / sr
    print(f"Total narration + pauses duration: {total_duration:.2f}s ({total_duration/60:.2f} min)")

    bgm_track = synthesize_therapeutic_bgm(total_duration, sr=sr)

    # Duck BGM gently whenever someone is speaking (sidechain envelope)
    speech_env = np.mean(np.abs(voice_track), axis=1)
    # Smooth envelope with 200ms window
    win = int(0.2 * sr)
    kernel = np.ones(win, dtype=np.float32) / win
    smooth_env = np.convolve(speech_env, kernel, mode="same")
    duck_gain = np.where(smooth_env > 0.008, 0.42, 0.85).astype(np.float32)
    duck_gain = np.convolve(duck_gain, kernel, mode="same")[:, None]

    mixed = voice_track * 0.92 + bgm_track * duck_gain
    mixed = np.clip(mixed, -0.98, 0.98)

    master_wav = OUT_DIR / "master_audio.wav"
    with wave.open(str(master_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        pcm16 = (mixed * 32767.0).astype(np.int16)
        wf.writeframes(pcm16.tobytes())

    manifest_path = OUT_DIR / "timeline.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "total_duration_sec": round(total_duration, 3),
                "master_wav": str(master_wav),
                "turns": timeline,
            },
            f,
            indent=2,
        )
    print(f"Saved master audio to {master_wav} and timeline to {manifest_path}")


if __name__ == "__main__":
    asyncio.run(main())
