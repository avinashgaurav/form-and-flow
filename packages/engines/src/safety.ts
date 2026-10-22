/**
 * Deterministic safety lexicon (plan/13 section 1, plan/14 section 3). Runs on every free-text input,
 * with or without AI consent. English plus common Hinglish phrasings. Draft list pending review.
 *
 * Bias: a missed red flag is far worse than an unnecessary check, so a negated phrase ("no chest pain")
 * is not ignored; it returns 'needs_confirm' and the UI asks one yes/no question.
 */

export type SafetyKind = 'none' | 'red_flag' | 'crisis' | 'ed_signal' | 'out_of_scope';

export interface SafetyResult {
  kind: SafetyKind;
  confidence: 'confirmed' | 'needs_confirm';
  matched: string[];
}

const RED_FLAG: RegExp[] = [
  /chest (pain|tight\w*|pressure|discomfort)/,
  /(pain|tightness|pressure) in (my |the )?chest/,
  /tight chest/,
  /chest (feels|is|getting|got) (very |really |so )?(tight|heavy|painful)/,
  /\b(fainted|fainting|passed out|blacked out|collapsed)\b/,
  /(can'?t|can not|cannot|unable to|hard to) breathe/,
  /(severe|very|really) (short of breath|breathless)/,
  /heart (is )?(racing|pounding)/,
  /palpitations?/,
  /(numb|numbness|weak|weakness) (in|on|down) (one|my left|my right|the left|the right) (side|arm|leg)/,
  /(face|mouth) (is )?droop/,
  /slurred speech/,
  /(sudden|worst) (severe )?headache/,
  // Hinglish
  /(seene|chhati|chhaati|chaati) (me|mein|mai|main) (dard|jalan|bhaari|bhari|dabav|dabaav)/,
  /\b(behosh|behoshi)\b/,
  /saans (nahi|nhi|nai) (aa|le paa?)/,
  /saans (phool|ful) (rahi|raha|gayi|gaya)/,
  /\bchakkar\b/,
  /dil (bahut |bohot )?(tez|zor se) (dhadak|chal)/,
];

const CRISIS: RegExp[] = [
  /\b(kill|hurt|harm) (myself|me)\b/,
  // Other verb forms only with "myself": "my knee is hurting me" is an injury, not a crisis.
  /\b(killing|killed|hurting|hurts|harming|harmed) myself\b/,
  /\bsuicid\w*/,
  /end (my|it) (life|all)/,
  /\bwant to die\b/,
  /\bself[- ]?harm\b/,
  /\bkhudkushi\b/,
  /marna (chahta|chahti|hai)/,
  /jeena nahi (chahta|chahti)/,
];

const ED_SIGNAL: RegExp[] = [
  /\b(starve|starving) (myself)?/,
  /\bpurg(e|ing)\b/,
  /\b(throw(ing|s)?|threw|thrown) up after (eating|i eat|every meal|each meal|meals?|food|dinner|lunch|breakfast|snacks?)\b/,
  /\b(make|makes|making|made) myself (throw up|vomit|puke|be sick)\b/,
  /\blaxatives?\b/,
  /skip(ping)? (all )?meals to (lose|drop)/,
  /\b(hate|disgusted by) (my body|myself|how i look)\b/,
];

const OUT_OF_SCOPE: RegExp[] = [
  /\b(dose|dosage|how much|how many mg)\b.*\b(creatine|steroid|testosterone|insulin|metformin|ozempic|semaglutide|tirzepatide|mounjaro|supplement)/,
  /\b(creatine|steroids?|testosterone|insulin|metformin|ozempic|semaglutide|tirzepatide|mounjaro|supplements?)\b.*\b(dose|dosage|dosing|how much|mg)\b/,
  /\b(diagnose|diagnosis|what disease|is it cancer|prescribe)\b/,
  /\b(steroids?|anabolic|sarms?|peptides?)\b/,
];

const NEGATION = /\b(no|not|never|without|nahi|nhi|koi nahi)\b/;

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function matches(text: string, patterns: RegExp[]): string[] {
  const out: string[] = [];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) out.push(m[0]);
  }
  return out;
}

/** Extremely low calorie targets ("800 calories a day") are treated as an eating-disorder signal. */
function lowCalorieRequest(text: string): string | null {
  const m = text.match(/\b(\d{3,4})\s?(kcal|calories|cal)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 300 && n < 1200 ? m[0] : null;
}

export function classifyText(raw: string): SafetyResult {
  const text = normalise(raw);
  const crisis = matches(text, CRISIS);
  if (crisis.length) return { kind: 'crisis', confidence: 'confirmed', matched: crisis };

  const red = matches(text, RED_FLAG);
  if (red.length) {
    const negated = red.every((phrase) => {
      const idx = text.indexOf(phrase);
      const before = text.slice(Math.max(0, idx - 24), idx);
      return NEGATION.test(before);
    });
    return { kind: 'red_flag', confidence: negated ? 'needs_confirm' : 'confirmed', matched: red };
  }

  const ed = matches(text, ED_SIGNAL);
  const low = lowCalorieRequest(text);
  if (low) ed.push(low);
  if (ed.length) return { kind: 'ed_signal', confidence: 'confirmed', matched: ed };

  const oos = matches(text, OUT_OF_SCOPE);
  if (oos.length) return { kind: 'out_of_scope', confidence: 'confirmed', matched: oos };

  return { kind: 'none', confidence: 'confirmed', matched: [] };
}

/** Fixed emergency guidance (claim R-22). Works offline; shown by the safety stop screen. */
export const EMERGENCY = {
  number: '112',
  ambulance: '108',
  mentalHealth: { name: 'Tele-MANAS', numbers: ['14416', '1-800-891-4416'] },
} as const;
