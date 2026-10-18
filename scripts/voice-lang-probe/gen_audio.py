"""Generate one spoken test sentence per language (edge-tts) as raw 24 kHz mono PCM16 for the live Voice Agent probe.
Writes <out>/<code>.pcm and <out>/phrases.json. Test phrases only; no user data.
Usage: uv run --with edge-tts python scripts/voice-lang-probe/gen_audio.py <out_dir>
"""
import asyncio
import json
import subprocess
import sys
from pathlib import Path

import edge_tts

# code: (edge voice, sentence: "I have been avoiding my taxes for weeks and I don't know where to start.")
PHRASES = {
    "en": ("en-GB-SoniaNeural", "I have been avoiding my taxes for weeks and I do not know where to start."),
    "es": ("es-ES-ElviraNeural", "Llevo semanas evitando mis impuestos y no sé por dónde empezar."),
    "fr": ("fr-FR-DeniseNeural", "Cela fait des semaines que j'évite mes impôts et je ne sais pas par où commencer."),
    "de": ("de-DE-KatjaNeural", "Ich schiebe meine Steuern seit Wochen auf und weiß nicht, wo ich anfangen soll."),
    "it": ("it-IT-ElsaNeural", "Rimando le tasse da settimane e non so da dove cominciare."),
    "pt": ("pt-PT-RaquelNeural", "Estou há semanas a adiar os meus impostos e não sei por onde começar."),
    "hi": ("hi-IN-SwaraNeural", "मैं हफ्तों से अपने टैक्स का काम टाल रहा हूँ और मुझे समझ नहीं आ रहा कहाँ से शुरू करूँ।"),
    "ja": ("ja-JP-NanamiNeural", "何週間も税金の手続きを先延ばしにしていて、どこから始めればいいかわかりません。"),
    "zh": ("zh-CN-XiaoxiaoNeural", "我已经好几个星期没有处理我的税务了，不知道从哪里开始。"),
    "ko": ("ko-KR-SunHiNeural", "몇 주째 세금 처리를 미루고 있는데 어디서부터 시작해야 할지 모르겠어요."),
    "nl": ("nl-NL-ColetteNeural", "Ik schuif mijn belastingaangifte al weken voor me uit en weet niet waar ik moet beginnen."),
    "ru": ("ru-RU-SvetlanaNeural", "Я уже несколько недель откладываю налоги и не знаю, с чего начать."),
    "tr": ("tr-TR-EmelNeural", "Haftalardır vergilerimi erteliyorum ve nereden başlayacağımı bilmiyorum."),
    "pl": ("pl-PL-ZofiaNeural", "Od tygodni odkładam swoje podatki i nie wiem, od czego zacząć."),
    "ar": ("ar-SA-ZariyahNeural", "أؤجل ضرائبي منذ أسابيع ولا أعرف من أين أبدأ."),
    "sv": ("sv-SE-SofieNeural", "Jag har skjutit upp mina skatter i veckor och vet inte var jag ska börja."),
    "no": ("nb-NO-PernilleNeural", "Jeg har utsatt skattene mine i flere uker og vet ikke hvor jeg skal begynne."),
    "da": ("da-DK-JeppeNeural", "Jeg har udskudt min skat i ugevis og ved ikke, hvor jeg skal begynde."),
    "fi": ("fi-FI-NooraNeural", "Olen lykännyt verojani viikkoja enkä tiedä, mistä aloittaisin."),
    "el": ("el-GR-AthinaNeural", "Αναβάλλω τους φόρους μου εδώ και εβδομάδες και δεν ξέρω από πού να ξεκινήσω."),
    "cs": ("cs-CZ-AntoninNeural", "Už týdny odkládám své daně a nevím, kde začít."),
    "ro": ("ro-RO-AlinaNeural", "Amân de săptămâni impozitele și nu știu de unde să încep."),
    "hu": ("hu-HU-NoemiNeural", "Hetek óta halogatom az adóügyeimet, és nem tudom, hol kezdjem."),
    "uk": ("uk-UA-PolinaNeural", "Я вже кілька тижнів відкладаю податки і не знаю, з чого почати."),
    "vi": ("vi-VN-HoaiMyNeural", "Tôi đã trì hoãn việc làm thuế suốt nhiều tuần và không biết bắt đầu từ đâu."),
    "th": ("th-TH-NiwatNeural", "ฉันเลื่อนเรื่องภาษีมาหลายสัปดาห์แล้วและไม่รู้จะเริ่มตรงไหน"),
    "id": ("id-ID-GadisNeural", "Saya sudah berminggu-minggu menunda urusan pajak saya dan tidak tahu harus mulai dari mana."),
    "ms": ("ms-MY-YasminNeural", "Saya sudah berminggu-minggu menangguhkan cukai saya dan tidak tahu hendak mula dari mana."),
    "he": ("he-IL-HilaNeural", "אני דוחה את המסים שלי כבר שבועות ואני לא יודע מאיפה להתחיל."),
    "bn": ("bn-BD-NabanitaNeural", "আমি কয়েক সপ্তাহ ধরে আমার কর সংক্রান্ত কাজ পিছিয়ে দিচ্ছি এবং কোথা থেকে শুরু করব বুঝতে পারছি না।"),
    "ta": ("ta-IN-PallaviNeural", "நான் பல வாரங்களாக என் வரி வேலையைத் தள்ளிப்போடுகிறேன், எங்கிருந்து தொடங்குவது என்று தெரியவில்லை."),
    "te": ("te-IN-ShrutiNeural", "నేను వారాల తరబడి నా పన్ను పనిని వాయిదా వేస్తున్నాను, ఎక్కడ మొదలుపెట్టాలో తెలియడం లేదు."),
}


async def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    ok = {}
    for code, (voice, text) in PHRASES.items():
        mp3 = out / f"{code}.mp3"
        pcm = out / f"{code}.pcm"
        try:
            await edge_tts.Communicate(text, voice).save(str(mp3))
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-ar", "24000", "-ac", "1", "-f", "s16le", str(pcm)], check=True)
            ok[code] = text
            print(code, pcm.stat().st_size // 48000, "s")
        except Exception as e:  # voice missing or network hiccup: skip that language, report it
            print(code, "SKIPPED", type(e).__name__, str(e)[:80])
    (out / "phrases.json").write_text(json.dumps(ok, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main(Path(sys.argv[1])))
