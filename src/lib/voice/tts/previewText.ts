// No imports: the preview-clip script (scripts/voices/make-previews.mjs) loads this file directly with Node.

/** About 20 seconds of speech at a natural pace (55 to 65 words), in the voice's own language. `{name}` is the persona's name. */
export const PREVIEW_TEXT: Record<string, string> = {
  en: "Hi, I'm {name}. This is how I sound when we start something together. Pick one tiny step, just two minutes of it. No pressure, and no perfect plan. If your mind wanders, that's fine, we'll come back to the step. Ready? Let's begin with the very first small thing, and I'll stay right here with you.",
  es: 'Hola, soy {name}. Así sueno cuando empezamos algo juntos. Elige un paso muy pequeño, solo dos minutos. Sin presión y sin un plan perfecto. Si tu mente se va por otro lado, no pasa nada, volvemos al paso. ¿Listo? Empecemos con lo primero más pequeño, y yo me quedo aquí contigo.',
  fr: "Bonjour, je suis {name}. Voilà comment je parle quand on commence quelque chose ensemble. Choisis une toute petite étape, seulement deux minutes. Pas de pression, pas de plan parfait. Si ton esprit s'égare, ce n'est pas grave, on revient à l'étape. Prêt ? Commençons par la toute première petite chose, et je reste là avec toi.",
  de: 'Hallo, ich bin {name}. So klinge ich, wenn wir zusammen etwas anfangen. Such dir einen winzigen Schritt aus, nur zwei Minuten. Kein Druck und kein perfekter Plan. Wenn deine Gedanken abschweifen, ist das in Ordnung, wir kehren zum Schritt zurück. Bereit? Fangen wir mit der allerersten kleinen Sache an, und ich bleibe hier bei dir.',
  it: 'Ciao, sono {name}. Così suono quando iniziamo qualcosa insieme. Scegli un passo piccolissimo, solo due minuti. Nessuna pressione e nessun piano perfetto. Se la mente vaga, va bene, torniamo al passo. Pronto? Cominciamo dalla primissima piccola cosa, e io resto qui con te.',
  pt: 'Olá, eu sou {name}. É assim que eu soo quando começamos algo juntos. Escolha um passo bem pequeno, só dois minutos. Sem pressão e sem plano perfeito. Se a sua mente se distrair, tudo bem, voltamos ao passo. Pronto? Vamos começar pela primeira coisa pequena, e eu fico aqui com você.',
};

export function previewText(lang: string, name: string): string {
  return (PREVIEW_TEXT[lang] ?? PREVIEW_TEXT.en).replace('{name}', name);
}

/** Where the pre-rendered AssemblyAI preview clip of a persona lives (made by scripts/voices/make-previews.mjs). */
export const previewClipUrl = (personaId: string) => `/voices/previews/${personaId}.mp3`;
