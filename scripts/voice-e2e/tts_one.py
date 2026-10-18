"""Synthesize one sentence read from a UTF-8 file: python tts_one.py out.mp3 sentence.txt (edge-tts, en-GB)."""
import asyncio
import sys

import edge_tts

asyncio.run(edge_tts.Communicate(open(sys.argv[2], encoding="utf-8").read(), "en-GB-SoniaNeural").save(sys.argv[1]))
