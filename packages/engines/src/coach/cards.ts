/**
 * Curated evidence cards (plan/13 section 7). The coach may only cite these by ID; the app renders
 * title, source and date from here, never from model output. All DRAFT until a reviewer signs off.
 * Citations match the claim register in plan/02.
 */

export type EvidenceStrength = 'consensus' | 'moderate' | 'emerging' | 'disputed';

export interface EvidenceCard {
  id: string;
  title: string;
  summary: string;
  appliesTo: string;
  limits: string;
  citation: string;
  url: string;
  sourceDate: string;
  strength: EvidenceStrength;
  claimId: string;
  status: 'draft' | 'reviewed';
  keywords: string[];
}

export const CARDS: EvidenceCard[] = [
  {
    id: 'ev-activity-who', title: 'How much activity adults need',
    summary: 'Aim to build toward 150 to 300 minutes of moderate activity a week, plus muscle-strengthening on at least two days. More than 150 minutes gives extra benefit.',
    appliesTo: 'Adults 18 to 64', limits: 'A population target, not a starting point. Build up gradually.',
    citation: 'Bull FC et al. WHO 2020 guidelines on physical activity. Br J Sports Med 2020;54:1451', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/',
    sourceDate: '2020', strength: 'consensus', claimId: 'E-01', status: 'draft', keywords: ['how much', 'minutes', 'cardio', 'walk', 'activity', 'week'],
  },
  {
    id: 'ev-strength-acsm', title: 'Strength training basics',
    summary: 'Two or more sessions a week work. Heavier loads build strength; around ten or more weekly sets per muscle build size. No one way of organising the programme is clearly best.',
    appliesTo: 'Healthy adults', limits: 'Starting doses for beginners are set more gently and need a coach to review them.',
    citation: 'Currier BS et al. ACSM position stand on resistance training. Med Sci Sports Exerc 2026;58(4):851', url: 'https://pubmed.ncbi.nlm.nih.gov/41843416/',
    sourceDate: '2026', strength: 'consensus', claimId: 'E-11', status: 'draft', keywords: ['sets', 'reps', 'strength', 'muscle', 'program', 'routine', 'split'],
  },
  {
    id: 'ev-protein-range', title: 'Protein for people who train',
    summary: 'Many people who train do well on about 1.4 to 2.0 g of protein per kg a day. India’s 2024 guidelines see no extra muscle gain above about 1.6 g/kg.',
    appliesTo: 'Healthy adults who exercise', limits: 'Not for people with kidney disease. Food first; supplements are not required.',
    citation: 'Jäger R et al. ISSN position stand: protein and exercise. JISSN 2017;14:20; ICMR-NIN Dietary Guidelines for Indians 2024', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/',
    sourceDate: '2017, 2024', strength: 'disputed', claimId: 'E-02, E-06', status: 'draft', keywords: ['protein', 'paneer', 'whey', 'eggs', 'dal'],
  },
  {
    id: 'ev-weight-loss-rate', title: 'A safe pace for fat loss',
    summary: 'Public-health guidance puts a safe pace at about 0.5 to 1 kg a week. Faster is not better and is harder to keep.',
    appliesTo: 'Adults losing weight', limits: 'Weight moves day to day for many reasons; the trend over weeks matters, not one weigh-in.',
    citation: 'NHLBI Clinical Guidelines on Overweight and Obesity, 1998; NHS, Overweight and obesity in adults', url: 'https://www.nhs.uk/conditions/overweight-and-obesity/',
    sourceDate: '1998, 2026', strength: 'consensus', claimId: 'E-04', status: 'draft', keywords: ['lose', 'weight loss', 'fast', 'kg a week', 'fat loss', 'scale'],
  },
  {
    id: 'ev-progression', title: 'How your weights go up',
    summary: 'When every set reaches the top of the rep range with a couple of reps to spare, the next session adds the smallest weight step. Two tough sessions in a row bring it down a little.',
    appliesTo: 'Everyone using the plan', limits: 'A design rule of this app, chosen because no progression model is clearly superior.',
    citation: 'Form & Flow rule TR-03; ACSM 2026 position stand', url: 'https://pubmed.ncbi.nlm.nih.gov/41843416/',
    sourceDate: '2026', strength: 'moderate', claimId: 'E-11', status: 'draft', keywords: ['increase', 'heavier', 'weight go up', 'progress', 'stuck', 'plateau'],
  },
  {
    id: 'ev-rest', title: 'Rest and lighter weeks',
    summary: 'Rest days and an easier week every month or so help you recover and keep progressing. Rest is part of the plan, not a failure.',
    appliesTo: 'Everyone using the plan', limits: 'Timing of lighter weeks is a draft rule pending coach review.',
    citation: 'Form & Flow rules TR-04, TR-10', url: 'https://pubmed.ncbi.nlm.nih.gov/41843416/',
    sourceDate: '2026', strength: 'emerging', claimId: 'E-11', status: 'draft', keywords: ['rest', 'tired', 'sore', 'recover', 'deload', 'day off'],
  },
  {
    id: 'ev-photo-estimates', title: 'Why food estimates are ranges',
    summary: 'Even good AI photo tools miss energy by about a third on average and underestimate bigger portions. Hidden oil makes Indian dishes harder still, so we show ranges.',
    appliesTo: 'Food logging', limits: 'No study has tested Indian mixed dishes specifically.',
    citation: "O'Hara C et al. Nutrients 2025;17:607; Fridolfsson J et al. Curr Dev Nutr 2025;9:107556", url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11858203/',
    sourceDate: '2025', strength: 'moderate', claimId: 'E-13', status: 'draft', keywords: ['calories', 'accurate', 'estimate', 'range', 'photo', 'exact'],
  },
  {
    id: 'ev-supplements', title: 'Supplements',
    summary: 'You can reach your targets with food. Talk to a doctor or registered dietitian before starting a supplement. In India, supplements cannot legally claim to treat or cure disease.',
    appliesTo: 'Everyone', limits: 'This app does not recommend or dose supplements.',
    citation: 'FSSAI Nutraceutical Regulations 2022', url: 'https://fssai.gov.in/upload/uploadfiles/files/Direction_New_compressed.pdf',
    sourceDate: '2022', strength: 'consensus', claimId: 'E-15', status: 'draft', keywords: ['supplement', 'creatine', 'whey', 'pre workout', 'vitamin'],
  },
  {
    id: 'ev-screening', title: 'Why we asked safety questions',
    summary: 'Screening looks at how active you are now, known heart, metabolic or kidney conditions and their symptoms, and how hard you plan to train.',
    appliesTo: 'Everyone starting an exercise programme', limits: 'Our questions are draft wording pending professional review; they are not a diagnosis.',
    citation: 'Riebe D et al. Updating ACSM pre-participation screening. Med Sci Sports Exerc 2015;47:2473', url: 'https://pubmed.ncbi.nlm.nih.gov/26473759/',
    sourceDate: '2015', strength: 'consensus', claimId: 'E-10', status: 'draft', keywords: ['why', 'questions', 'doctor', 'clearance', 'safe', 'limited'],
  },
];

const BY_ID = new Map(CARDS.map((c) => [c.id, c]));
export const getCard = (id: string) => BY_ID.get(id);

/** Keyword retrieval over the curated corpus (plan/13: no open web). */
export function findCards(text: string, limit = 2): EvidenceCard[] {
  const t = text.toLowerCase();
  return CARDS.map((c) => ({ c, score: c.keywords.filter((k) => t.includes(k)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id))
    .slice(0, limit)
    .map((x) => x.c);
}
