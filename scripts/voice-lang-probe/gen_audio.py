"""Generate spoken test utterances (edge-tts) as raw 24 kHz mono PCM16 for the live Voice Agent probe.
Usage: python scripts/voice-lang-probe/gen_audio.py <out_dir>
Uses Microsoft's neural TTS over the network for test phrases only (no user data).
"""
import asyncio
import subprocess
import sys
from pathlib import Path

import edge_tts

PHRASES = {
    "en": ("en-GB-SoniaNeural", "I keep avoiding my taxes and I do not know where to start."),
    "es": ("es-ES-ElviraNeural", "Llevo semanas evitando responder el correo del casero y no sé por dónde empezar."),
    "fr": ("fr-FR-DeniseNeural", "J'évite de remplir mes papiers depuis des semaines et je ne sais pas par où commencer."),
    "de": ("de-DE-KatjaNeural", "Ich schiebe meine Steuererklärung seit Wochen auf und weiß nicht, wo ich anfangen soll."),
    "it": ("it-IT-ElsaNeural", "Rimando da settimane la risposta al padrone di casa e non so da dove cominciare."),
    "pt": ("pt-PT-RaquelNeural", "Estou a adiar o relatório há semanas e não sei por onde começar."),
    "hi": ("hi-IN-SwaraNeural", "मैं हफ्तों से अपना टैक्स का काम टाल रहा हूँ और मुझे समझ नहीं आ रहा कहाँ से शुरू करूँ।"),
    "ko": ("ko-KR-SunHiNeural", "몇 주째 세금 서류를 미루고 있는데 어디서부터 시작해야 할지 모르겠어요."),
    "ja": ("ja-JP-NanamiNeural", "何週間も税金の書類を先延ばしにしていて、どこから始めればいいかわかりません。"),
}


async def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for code, (voice, text) in PHRASES.items():
        mp3 = out / f"{code}.mp3"
        pcm = out / f"{code}.pcm"
        await edge_tts.Communicate(text, voice).save(str(mp3))
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-ar", "24000", "-ac", "1", "-f", "s16le", str(pcm)],
            check=True,
        )
        print(code, pcm.stat().st_size // 48000, "s")


if __name__ == "__main__":
    asyncio.run(main(Path(sys.argv[1])))
