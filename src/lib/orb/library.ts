/**
 * Built-in shape library, authored in the same drawing language the LLM uses (see sdf.ts), so common words
 * morph instantly with no network call. Each entry also carries a colour pair and the words that summon it.
 */
import type { Part, ShapeProgram } from './sdf';

type P2 = [number, number];
const C = (x: number, y: number, r: number, sub?: boolean): Part => ({ k: 'circle', c: [x, y], r, sub });
const E = (x: number, y: number, rx: number, ry: number, rot = 0, sub?: boolean): Part => ({ k: 'ellipse', c: [x, y], rx, ry, rot, sub });
const R = (x: number, y: number, w: number, h: number, round = 0, rot = 0, sub?: boolean): Part => ({ k: 'rect', c: [x, y], w, h, round, rot, sub });
const P = (pts: P2[], sub?: boolean): Part => ({ k: 'poly', pts, sub });
const L = (pts: P2[], w: number, sub?: boolean): Part => ({ k: 'line', pts, w, sub });
const O = (x: number, y: number, r: number, w: number, sub?: boolean): Part => ({ k: 'ring', c: [x, y], r, w, sub });

const rotPts = (pts: P2[], deg: number): P2[] => {
  const a = (deg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return pts.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca] as P2);
};
const mirror = (pts: P2[]): P2[] => pts.map(([x, y]) => [-x, y] as P2);
const ellipsePts = (cx: number, cy: number, rx: number, ry: number, n = 24): P2[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry] as P2;
  });
const starPts = (R1: number, R2: number, n: number): P2[] =>
  Array.from({ length: n * 2 }, (_, i) => {
    const t = Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? R1 : R2;
    return [Math.cos(t) * r, Math.sin(t) * r] as P2;
  });
const sinePts = (y0: number, amp: number, phase: number): P2[] =>
  Array.from({ length: 20 }, (_, i) => {
    const x = -0.95 + (i / 19) * 1.9;
    return [x, y0 + amp * Math.sin(x * 3.6 + phase)] as P2;
  });

export interface LibraryEntry {
  id: string;
  /** English words/phrases (matched on word boundaries) and other-script words (substring). */
  words: string[];
  palette: [string, string];
  parts: Part[];
}

const petal = (deg: number): Part => {
  const a = (deg * Math.PI) / 180;
  return E(Math.sin(a) * 0.5, -0.5 + Math.cos(a) * 0.5, 0.21, 0.56, -deg);
};

export const LIBRARY: LibraryEntry[] = [
  {
    id: 'icecream',
    words: ['ice cream', 'icecream', 'gelato', 'dessert', 'sweet', 'sweets', 'sugar', 'treat', 'cake', 'sundae', 'candy', 'chocolate', 'cookie', 'donut', 'helado', 'glace', 'eis', 'आइसक्रीम', '아이스크림', 'アイスクリーム', '冰淇淋'],
    palette: ['#FF7AB6', '#FFA94D'],
    parts: [P([[-0.42, 0], [0.42, 0], [0, -1]]), C(0, 0.3, 0.47), C(-0.4, 0.04, 0.14), C(0.38, 0.02, 0.13), C(0.06, 0.92, 0.11), L([[0.06, 1], [0.22, 1.2]], 0.04), L([[-0.25, -0.1], [0.12, -0.62]], 0.035, true), L([[0.25, -0.1], [-0.12, -0.62]], 0.035, true)],
  },
  { id: 'heart', words: ['love', 'heart', 'romantic', 'dating', 'wife', 'husband', 'girlfriend', 'boyfriend', 'valentine', 'hug', 'kindness', 'corazón', 'amor', 'coeur', 'herz', 'प्यार', '사랑', '愛', '爱'], palette: ['#FF6B95', '#E11D48'], parts: [C(-0.31, 0.3, 0.43), C(0.31, 0.3, 0.43), P([[-0.72, 0.2], [0.72, 0.2], [0, -0.92]])] },
  { id: 'star', words: ['star', 'stars', 'achievement', 'proud', 'success', 'shine', 'celebrate', 'winner', 'award', 'estrella', 'étoile', 'stern', 'तारा', '별', '星'], palette: ['#FFD23F', '#FF8A00'], parts: [P(starPts(1, 0.42, 5))] },
  { id: 'lotus', words: ['calm', 'breathe', 'breathing', 'relax', 'meditate', 'meditation', 'peace', 'mindful', 'zen', 'anxious', 'anxiety', 'panic', 'overwhelmed', 'overwhelm', 'stressed', 'stress', 'grounding', 'respirar', 'calma', 'calme', 'ruhe', 'शांत', '평온'], palette: ['#F9A8D4', '#14B8A6'], parts: [petal(-66), petal(-33), petal(0), petal(33), petal(66), E(0, -0.62, 0.55, 0.1)] },
  { id: 'moon', words: ['sleep', 'tired', 'exhausted', 'night', 'insomnia', 'bedtime', 'nap', 'dream', 'dormir', 'sueño', 'sommeil', 'schlaf', 'नींद', '잠', '睡'], palette: ['#C7D2FE', '#6366F1'], parts: [C(0, 0, 0.92), C(0.44, 0.2, 0.74, true)] },
  { id: 'sun', words: ['morning', 'sunshine', 'sunny', 'wake up', 'happy', 'bright', 'summer', 'holiday', 'vacation', 'mañana', 'soleil', 'sonne', 'सुबह', '太阳'], palette: ['#FFD23F', '#FF7A00'], parts: [C(0, 0, 0.4), ...Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return L([[Math.cos(a) * 0.62, Math.sin(a) * 0.62], [Math.cos(a) * 0.98, Math.sin(a) * 0.98]], 0.1); })] },
  { id: 'cloud', words: ['cloud', 'clouds', 'foggy', 'fog', 'brain fog', 'weather', 'confused', 'spaced out', 'daydream', 'vague', 'nube', 'nuage', 'wolke'], palette: ['#93C5FD', '#6366F1'], parts: [C(-0.5, -0.1, 0.33), C(-0.1, 0.14, 0.46), C(0.4, -0.02, 0.37), R(0, -0.28, 1.6, 0.42, 1)] },
  { id: 'tree', words: ['tree', 'trees', 'forest', 'park', 'outside', 'woods', 'nature', 'árbol', 'arbre', 'baum'], palette: ['#34D399', '#15803D'], parts: [C(0, 0.4, 0.5), C(-0.42, 0.1, 0.34), C(0.42, 0.1, 0.34), R(0, -0.55, 0.22, 0.85)] },
  { id: 'house', words: ['home', 'house', 'apartment', 'flat', 'mortgage', 'chores', 'cleaning', 'laundry', 'tidy', 'dishes', 'casa', 'maison', 'haus', 'घर', '집', '家'], palette: ['#FBBF24', '#B45309'], parts: [R(0, -0.3, 1.1, 0.8), P([[-0.82, 0.1], [0.82, 0.1], [0, 0.8]]), R(0.5, 0.62, 0.16, 0.34), R(0, -0.52, 0.28, 0.5, 0, 0, true), R(-0.34, -0.2, 0.2, 0.2, 0, 0, true)] },
  { id: 'rocket', words: ['rocket', 'launch', 'startup', 'start up', 'space', 'mission', 'ship it', 'big project', 'career', 'cohete', 'fusée', 'rakete'], palette: ['#60A5FA', '#F43F5E'], parts: [E(0, 0.1, 0.3, 0.8), P([[-0.27, -0.25], [-0.72, -0.8], [-0.27, -0.62]]), P([[0.27, -0.25], [0.72, -0.8], [0.27, -0.62]]), P([[-0.13, -0.7], [0.13, -0.7], [0, -1.02]]), C(0, 0.3, 0.13, true)] },
  { id: 'wave', words: ['wave', 'waves', 'ocean', 'sea', 'flow', 'surf', 'beach', 'swim', 'tide', 'river', 'mar', 'océan', 'meer'], palette: ['#22D3EE', '#2563EB'], parts: [L(sinePts(0.42, 0.25, 0), 0.17), L(sinePts(0, 0.25, 1.2), 0.17), L(sinePts(-0.42, 0.25, 2.4), 0.17)] },
  { id: 'mountain', words: ['mountain', 'climb', 'summit', 'challenge', 'huge task', 'peak', 'montaña', 'montagne', 'berg'], palette: ['#818CF8', '#0F766E'], parts: [P([[-1, -0.6], [-0.15, -0.6], [-0.58, 0.35]]), P([[-0.45, -0.6], [1, -0.6], [0.35, 0.72]]), C(0.7, 0.78, 0.13)] },
  { id: 'book', words: ['book', 'books', 'read', 'reading', 'study', 'studying', 'learn', 'homework', 'exam', 'exams', 'revision', 'class', 'course', 'lecture', 'school', 'university', 'dissertation', 'thesis', 'libro', 'livre', 'buch', '勉強', '学习'], palette: ['#FBBF24', '#B45309'], parts: [P([[-0.05, -0.5], [-0.5, -0.64], [-0.96, -0.5], [-0.96, 0.62], [-0.5, 0.76], [-0.05, 0.6]]), P([[0.05, -0.5], [0.5, -0.64], [0.96, -0.5], [0.96, 0.62], [0.5, 0.76], [0.05, 0.6]]), L([[-0.75, 0.3], [-0.28, 0.4]], 0.05, true), L([[-0.75, 0.05], [-0.28, 0.15]], 0.05, true), L([[0.28, 0.4], [0.75, 0.3]], 0.05, true), L([[0.28, 0.15], [0.75, 0.05]], 0.05, true)] },
  { id: 'cup', words: ['coffee', 'tea', 'caffeine', 'mug', 'latte', 'breakfast', 'café', 'thé', 'kaffee', 'चाय', '커피', 'コーヒー'], palette: ['#E0B084', '#7C4A21'], parts: [R(-0.1, -0.05, 0.9, 1, 0.25), O(0.52, -0.02, 0.28, 0.1), R(-0.1, -0.72, 1.4, 0.12, 1), L([[-0.32, 0.62], [-0.22, 0.8], [-0.32, 0.98]], 0.07), L([[0.04, 0.62], [0.14, 0.8], [0.04, 0.98]], 0.07)] },
  { id: 'bolt', words: ['urgent', 'fast', 'quick', 'lightning', 'power', 'electricity', 'hurry', 'rush', 'asap', 'rayo', 'éclair', 'blitz'], palette: ['#FACC15', '#F97316'], parts: [P([[0.2, 1], [-0.5, -0.05], [-0.05, -0.05], [-0.25, -1], [0.5, 0.1], [0.05, 0.1], [0.45, 1]])] },
  { id: 'envelope', words: ['email', 'emails', 'mail', 'inbox', 'message', 'letter', 'reply', 'respond', 'outlook', 'gmail', 'correo', 'courriel', 'brief', 'ईमेल', '이메일', 'メール', '邮件'], palette: ['#60A5FA', '#4F46E5'], parts: [R(0, 0, 1.9, 1.3, 0.08), L([[-0.95, 0.65], [0, -0.05], [0.95, 0.65]], 0.13, true)] },
  { id: 'clock', words: ['time', 'timer', 'deadline', 'late', 'schedule', 'appointment', 'minutes', 'hours', 'clock', 'procrastinating', 'procrastinate', 'countdown', 'wait', 'tiempo', 'temps', 'zeit', 'समय', '시간', '時間'], palette: ['#2DD4BF', '#0F766E'], parts: [O(0, 0, 0.86, 0.13), L([[0, 0], [0, 0.52]], 0.1), L([[0, 0], [0.38, -0.13]], 0.1), C(0, 0, 0.08)] },
  { id: 'check', words: ['done', 'finished', 'complete', 'completed', 'finish', 'checklist', 'accomplished', 'started', 'hecho', 'terminé', 'fertig', 'पूरा'], palette: ['#34D399', '#059669'], parts: [O(0, 0, 0.95, 0.1), L([[-0.5, 0], [-0.15, -0.38], [0.52, 0.4]], 0.2)] },
  { id: 'pencil', words: ['write', 'writing', 'essay', 'draft', 'notes', 'edit', 'report', 'document', 'paperwork', 'form', 'forms', 'application', 'resume', 'cover letter', 'article', 'blog', 'escribir', 'écrire', 'schreiben', 'लिखना', '글'], palette: ['#FBBF24', '#EA580C'], parts: [P(rotPts([[-0.15, -0.4], [0.15, -0.4], [0.15, 0.66], [-0.15, 0.66]], 45)), P(rotPts([[-0.15, -0.4], [0.15, -0.4], [0, -0.88]], 45)), P(rotPts([[-0.15, 0.72], [0.15, 0.72], [0.15, 0.88], [-0.15, 0.88]], 45))] },
  { id: 'leaf', words: ['leaf', 'leaves', 'green', 'eco', 'vegan', 'salad', 'healthy', 'recycle', 'hoja', 'feuille', 'blatt'], palette: ['#86EFAC', '#15803D'], parts: [E(0.05, 0.05, 0.42, 0.88, -45), L([[-0.55, -0.55], [-0.95, -0.95]], 0.09), L([[-0.62, -0.62], [0.58, 0.58]], 0.04, true)] },
  { id: 'drop', words: ['water', 'drink', 'hydrate', 'rain', 'tears', 'cry', 'crying', 'sad', 'shower', 'bath', 'agua', 'eau', 'wasser', 'पानी', '물'], palette: ['#7DD3FC', '#0284C7'], parts: [C(0, -0.3, 0.56), P([[-0.52, -0.16], [0.52, -0.16], [0, 0.98]])] },
  { id: 'note', words: ['music', 'song', 'sing', 'guitar', 'piano', 'playlist', 'concert', 'band', 'podcast', 'música', 'musique', 'musik', 'संगीत', '음악', '音楽'], palette: ['#C084FC', '#7C3AED'], parts: [E(-0.36, -0.66, 0.34, 0.25, 20), R(-0.05, 0.05, 0.11, 1.4), P([[-0.0, 0.7], [0.62, 0.4], [0.62, 0.08], [0, 0.4]])] },
  { id: 'phone', words: ['phone', 'call', 'calls', 'text', 'texting', 'whatsapp', 'scroll', 'scrolling', 'doomscroll', 'social media', 'instagram', 'tiktok', 'notification', 'teléfono', 'téléphone', 'telefon', 'फोन', '전화'], palette: ['#94A3B8', '#334155'], parts: [R(0, 0, 0.86, 1.6, 0.3), R(0, 0.06, 0.64, 1.2, 0.08, 0, true), C(0, -0.68, 0.07, true)] },
  { id: 'laptop', words: ['laptop', 'computer', 'coding', 'code', 'programming', 'work', 'job', 'software', 'website', 'developer', 'spreadsheet', 'presentation', 'slides', 'ordenador', 'ordinateur', 'rechner', 'काम', '일'], palette: ['#94A3B8', '#2563EB'], parts: [R(0, 0.25, 1.3, 0.9, 0.08), R(0, 0.28, 1.1, 0.7, 0, 0, true), P([[-1, -0.28], [1, -0.28], [0.82, -0.5], [-0.82, -0.5]])] },
  { id: 'dumbbell', words: ['gym', 'workout', 'exercise', 'running', 'run', 'fitness', 'lift', 'training', 'sport', 'gimnasio', 'salle de sport', 'fitnessstudio'], palette: ['#FB7185', '#9F1239'], parts: [R(0, 0, 1.4, 0.13, 1), R(-0.58, 0, 0.2, 0.92, 0.3), R(0.58, 0, 0.2, 0.92, 0.3), R(-0.82, 0, 0.16, 0.6, 0.4), R(0.82, 0, 0.16, 0.6, 0.4)] },
  { id: 'coin', words: ['money', 'tax', 'taxes', 'vat', 'bill', 'bills', 'budget', 'pay', 'payment', 'salary', 'debt', 'bank', 'invoice', 'expenses', 'finance', 'hmrc', 'irs', 'receipt', 'receipts', 'dinero', 'argent', 'geld', 'पैसे', '돈', 'お金'], palette: ['#FDE047', '#CA8A04'], parts: [O(0, 0, 0.88, 0.16), L([[0.26, 0.3], [0, 0.4], [-0.26, 0.28], [-0.1, 0.05], [0.14, -0.1], [0.28, -0.3], [0, -0.42], [-0.28, -0.3]], 0.11), L([[0, 0.58], [0, -0.58]], 0.06)] },
  { id: 'game', words: ['game', 'games', 'play', 'gaming', 'playing', 'xbox', 'playstation', 'console', 'fun', 'juego', 'jeu', 'spiel', 'गेम', '게임', 'ゲーム'], palette: ['#A78BFA', '#EC4899'], parts: [R(0, 0, 1.9, 1.0, 0.85), R(-0.55, 0, 0.6, 0.18, 0, 0, true), R(-0.55, 0, 0.18, 0.6, 0, 0, true), C(0.5, 0.18, 0.13, true), C(0.78, -0.06, 0.13, true), C(0.24, -0.06, 0.13, true)] },
  { id: 'sprout', words: ['grow', 'growth', 'begin', 'beginning', 'new habit', 'seed', 'progress', 'improve', 'better', 'crecer', 'grandir', 'wachsen'], palette: ['#A3E635', '#16A34A'], parts: [L([[0, -0.9], [0, -0.05]], 0.1), E(-0.32, 0.18, 0.2, 0.47, 55), E(0.32, 0.3, 0.2, 0.47, -55), E(0, -0.94, 0.5, 0.1)] },
  { id: 'key', words: ['keys', 'key', 'lost', 'password', 'unlock', 'locked', 'access', 'lock', 'llave', 'clé', 'schlüssel'], palette: ['#FCD34D', '#B45309'], parts: [O(-0.45, 0.4, 0.4, 0.2), L([[-0.18, 0.12], [0.78, -0.85]], 0.15), L([[0.45, -0.55], [0.72, -0.3]], 0.11), L([[0.6, -0.7], [0.87, -0.45]], 0.11)] },
  { id: 'bulb', words: ['idea', 'ideas', 'brainstorm', 'creative', 'think', 'thought', 'inspiration', 'plan', 'planning', 'solution', 'idea', 'idée', 'einfall'], palette: ['#FDE047', '#F59E0B'], parts: [C(0, 0.3, 0.56), R(0, -0.42, 0.5, 0.3, 0.3), R(0, -0.64, 0.34, 0.14, 1), L([[-0.15, 0.1], [0, -0.12], [0.15, 0.1]], 0.05, true)] },
  { id: 'globe', words: ['world', 'travel', 'global', 'news', 'research', 'internet', 'web', 'country', 'language', 'translate', 'abroad', 'google', 'mundo', 'monde', 'welt', '世界'], palette: ['#38BDF8', '#1D4ED8'], parts: [O(0, 0, 0.9, 0.09), L(ellipsePts(0, 0, 0.42, 0.9), 0.07), L([[0, -0.9], [0, 0.9]], 0.06), L([[-0.9, 0], [0.9, 0]], 0.06), L([[-0.78, 0.45], [0.78, 0.45]], 0.06), L([[-0.78, -0.45], [0.78, -0.45]], 0.06)] },
  { id: 'shield', words: ['safe', 'safety', 'protect', 'security', 'privacy', 'insurance', 'secure', 'boundary', 'boundaries', 'seguro', 'sécurité', 'sicherheit'], palette: ['#34D399', '#0F766E'], parts: [P([[-0.8, 0.7], [0, 0.92], [0.8, 0.7], [0.76, -0.1], [0, -0.96], [-0.76, -0.1]]), L([[-0.34, 0.02], [-0.05, -0.3], [0.38, 0.3]], 0.19, true)] },
  { id: 'cat', words: ['cat', 'cats', 'kitten', 'gato', 'chat', 'katze', '猫'], palette: ['#FDBA74', '#C2410C'], parts: [C(0, -0.22, 0.62), P([[-0.62, 0.1], [-0.66, 1.0], [-0.1, 0.5]]), P([[0.62, 0.1], [0.66, 1.0], [0.1, 0.5]]), C(-0.24, -0.12, 0.1, true), C(0.24, -0.12, 0.1, true), P([[-0.1, -0.32], [0.1, -0.32], [0, -0.46]], true), L([[-0.9, -0.3], [-0.5, -0.38]], 0.04, true), L([[0.9, -0.3], [0.5, -0.38]], 0.04, true)] },
  { id: 'paw', words: ['dog', 'puppy', 'pet', 'pets', 'vet', 'perro', 'chien', 'hund', '犬'], palette: ['#FDBA74', '#9A3412'], parts: [E(0, -0.32, 0.5, 0.42), C(-0.6, 0.1, 0.19), C(-0.22, 0.52, 0.19), C(0.22, 0.52, 0.19), C(0.6, 0.1, 0.19)] },
  { id: 'butterfly', words: ['change', 'transform', 'transformation', 'freedom', 'free', 'new chapter', 'butterfly', 'butterflies', 'nervous', 'mariposa', 'papillon', 'schmetterling'], palette: ['#F0ABFC', '#6366F1'], parts: [E(-0.52, 0.38, 0.52, 0.36, 28), E(0.52, 0.38, 0.52, 0.36, -28), E(-0.4, -0.4, 0.36, 0.28, -28), E(0.4, -0.4, 0.36, 0.28, 28), R(0, 0, 0.1, 0.95, 1), L([[0, 0.45], [-0.25, 0.9]], 0.04), L([[0, 0.45], [0.25, 0.9]], 0.04)] },
  { id: 'person', words: ['friend', 'family', 'mum', 'mom', 'dad', 'mother', 'father', 'boss', 'manager', 'colleague', 'people', 'therapist', 'doctor', 'teacher', 'kid', 'child', 'baby', 'someone', 'amigo', 'ami', 'freund', 'दोस्त', '친구', '友達'], palette: ['#7DD3FC', '#6366F1'], parts: [C(0, 0.4, 0.32), E(0, -0.5, 0.66, 0.46)] },
  { id: 'pizza', words: ['food', 'pizza', 'eat', 'dinner', 'lunch', 'cook', 'cooking', 'hungry', 'meal', 'groceries', 'shopping', 'restaurant', 'takeaway', 'comida', 'nourriture', 'essen', 'खाना', '음식'], palette: ['#FCA5A5', '#EA580C'], parts: [P([[-0.74, 0.72], [0.74, 0.72], [0, -0.98]]), C(-0.22, 0.36, 0.12, true), C(0.24, 0.42, 0.1, true), C(0, -0.1, 0.1, true), L([[-0.74, 0.72], [0.74, 0.72]], 0.17)] },
];

export const DEFAULT_PALETTE: [string, string] = ['#0E9F9A', '#2F5BD8'];

export function libraryProgram(id: string): ShapeProgram | null {
  const e = LIBRARY.find((x) => x.id === id);
  return e ? { parts: e.parts, colors: e.palette } : null;
}
