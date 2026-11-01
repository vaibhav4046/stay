"""
Stay Telephone Companion — LiveKit Agents + AssemblyAI Universal-3.6 Pro & TTS-1.
Inbound telephony agent for ADHD task initiation.

Architecture:
Microphone/SIP -> LiveKit Room -> AssemblyAI Universal-3.6 Pro STT -> LLM (3-beat ADHD coach) -> AssemblyAI TTS-1 -> SIP/Audio
"""

import asyncio
import json
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.plugins import assemblyai, openai, silero

load_dotenv()
logger = logging.getLogger("stay-agent")
logger.setLevel(logging.INFO)

# Load shared prompt
CONFIG_PATH = Path(__file__).parent.parent / "shared" / "coach-prompt.json"
if not CONFIG_PATH.exists():
    CONFIG_PATH = Path(__file__).parent / "coach-prompt.json"

try:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        COACH_CONFIG = json.load(f)
except Exception:
    COACH_CONFIG = {
        "system_prompt": (
            "You are Stay, a calm, practical companion who helps an adult with ADHD start tasks.\n"
            "Reply in at most 3 short beats: (1) brief warm acknowledgement (<= 6 words), "
            "(2) ONE tiny concrete physical step (<= 15 words), (3) optional short question (<= 8 words).\n"
            "Never read bulleted lists aloud. For simple greetings, give a short warm hello with no tools or chores.\n"
            "Not a clinician or therapist; never diagnose, never advise on medication or doses."
        ),
        "greeting": "Hi, it's Stay. What feels hard to start right now?",
        "crisis_message": "If you are in danger or crisis, please hang up and call your local emergency service or crisis helpline immediately.",
        "max_duration_seconds": 600,
        "default_voice_id": "49c443a4-8a1d-5f7e-b70b-98bdbd9823c3",
        "stt_model": "universal-3-6-pro",
        "tts_model": "assemblyai-tts-1",
    }

CRISIS_KEYWORDS = [
    "suicide", "kill myself", "end my life", "want to die",
    "self harm", "overdose", "hurt myself", "hopeless"
]

def check_crisis(text: str) -> bool:
    low = text.lower()
    return any(kw in low for kw in CRISIS_KEYWORDS)

async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to room {ctx.room.name}...")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Participant join
    participant = await ctx.wait_for_participant()
    logger.info(f"Starting Stay voice companion for participant: {participant.identity}")

    # Voice pipeline with AssemblyAI Universal-3.6 Pro & TTS-1
    stt_plugin = assemblyai.STT(
        model=COACH_CONFIG.get("stt_model", "universal-3-6-pro")
    )

    tts_plugin = assemblyai.TTS(
        model=COACH_CONFIG.get("tts_model", "assemblyai-tts-1"),
        voice=os.getenv("ASSEMBLYAI_VOICE_ID", COACH_CONFIG.get("default_voice_id", "49c443a4-8a1d-5f7e-b70b-98bdbd9823c3")),
        sample_rate=24000,
    )

    vad_plugin = silero.VAD.load()

    llm_plugin = openai.LLM(
        model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        temperature=0.4,
    )

    initial_ctx = llm.ChatContext().append(
        role="system",
        text=COACH_CONFIG["system_prompt"],
    )

    agent = VoicePipelineAgent(
        vad=vad_plugin,
        stt=stt_plugin,
        llm=llm_plugin,
        tts=tts_plugin,
        chat_ctx=initial_ctx,
        interrupt_speech_duration=0.3,
        min_endpointing_delay=0.4,
    )

    # 10-minute telephony cap guard (§8.7.1)
    max_duration = int(COACH_CONFIG.get("max_duration_seconds", 600))

    async def enforce_duration_limit():
        await asyncio.sleep(max_duration - 30)
        await agent.say("We have about thirty seconds left for this call. What is your one tiny step to take now?")
        await asyncio.sleep(30)
        await agent.say("Time is up for this session. You have got this. Goodbye!")
        await ctx.room.disconnect()

    limit_task = asyncio.create_task(enforce_duration_limit())

    agent.start(ctx.room, participant)

    # Warm initial greeting
    greeting = COACH_CONFIG.get("greeting", "Hi, it's Stay. What feels hard to start right now?")
    await agent.say(greeting)

    # Keep session active until disconnect
    try:
        while ctx.room.connection_state == "connected":
            await asyncio.sleep(1)
    finally:
        limit_task.cancel()

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
