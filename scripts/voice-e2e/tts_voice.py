"""Synthesize a sentence read from a UTF-8 file with a chosen voice: python tts_voice.py out.mp3 sentence.txt voice [rate] [pitch] (edge-tts)."""
import asyncio
import sys

import edge_tts

out, src, voice = sys.argv[1], sys.argv[2], sys.argv[3]
rate = sys.argv[4] if len(sys.argv) > 4 else "+0%"
pitch = sys.argv[5] if len(sys.argv) > 5 else "+0Hz"
asyncio.run(edge_tts.Communicate(open(src, encoding="utf-8").read(), voice, rate=rate, pitch=pitch).save(out))
