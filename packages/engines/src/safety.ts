/**
 * Deterministic safety lexicon (plan/13 section 1, plan/14 section 3). Runs on every free-text input,
 * with or without AI consent, before anything else. English, Hinglish (Hindi in Latin letters) and
 * Hindi in Devanagari. Draft list pending professional review.
 *
 * Bias: a missed red flag is far worse than an unnecessary check, so a negated phrase ("no chest pain")
 * is not ignored; it returns 'needs_confirm' and the UI asks one yes/no question.
 *
 * The patterns describe shapes, not single sentences: a wish not to live or wake up, others being
 * better off without me, cutting or burning myself, symptoms such as jaw or one-sided numbness, and
 * days without food to get lighter. Gym slang ("killing it", "dying after leg day", "the death of me")
 * and festival fasting must stay out. A second, AI layer (coach/screen-prompt.ts) catches what this list misses
 * when the user has allowed AI; it can only send more messages to the fixed safe replies, never fewer.
 */

export type SafetyKind = 'none' | 'red_flag' | 'crisis' | 'ed_signal' | 'out_of_scope';

export interface SafetyResult {
  kind: SafetyKind;
  confidence: 'confirmed' | 'needs_confirm';
  matched: string[];
}

/**
 * Devanagari is written in more than one way: a nukta (क़ or क + ़) and chandrabindu or anusvara (ँ, ं).
 * Text and patterns both go through the same folding so "ख़ुदकुशी" and "खुदकुशी" match alike.
 */
function foldDevanagari(s: string): string {
  return s.normalize('NFKD').replace(/़/g, '').replace(/ँ/g, 'ं');
}
const compile = (list: RegExp[]): RegExp[] => list.map((r) => new RegExp(foldDevanagari(r.source), r.flags));

const RED_FLAG = compile([
  /chest (pain|tight\w*|pressure|discomfort)/,
  /(pain|tightness|pressure) in (my |the )?chest/,
  /tight chest/,
  /chest (feels|is|getting|got) (very |really |so )?(tight|heavy|painful)/,
  // "chest press felt heavy" is an exercise, not a symptom.
  /\bchest(?! (press|presses|fly|flies|day|workout|exercises?|muscles?|pump|dips?|supported|stretch|opener|band))( \w+){0,3} (heavy|crushing|squeez\w*|hurts?|hurting|aching)\b/,
  /\b(crushing|squeezing) (weight|pressure|feeling|pain)? ?(on|in|across) (my |the )?chest\b/,
  /\b(fainted|fainting|passed out|blacked out|collapsed)\b/,
  /\b(nearly|almost) (fainted|passed out|blacked out|collapsed)\b/,
  /(can'?t|can not|cannot|unable to|hard to) breathe/,
  /(severe|very|really) (short of breath|breathless)/,
  /heart (is )?(racing|pounding)/,
  /palpitations?/,
  /\bheart attack\b/,
  /\b(having|had|have) a (mini )?stroke\b/,
  /\b(seizure|convuls\w*)/,
  /\b(cough\w*|spit\w*|vomit\w*) (up )?blood\b/,
  /(numb|numbness|weak|weakness) (in|on|down) (one|my left|my right|the left|the right) (side|arm|leg)/,
  /(face|mouth) (is )?droop/,
  /\b(face|lips?|mouth|tongue)\b( \w+){0,3} (went|go|goes|going|gone|is|was|feels|felt|turned|became|got|getting) (numb|weak|droopy|drooping|tingly|dead|heavy|paralys\w*|crooked)\b/,
  /\b(one|left|right|half) side of (my |the )?(face|body|mouth)( \w+){0,4} (numb\w*|weak\w*|droop\w*|tingl\w*|dead|heavy|paralys\w*|not moving)\b/,
  /\b(left|right) (arm|leg|hand) (went|goes|is|was|feels|felt|gone|going) (numb|weak|dead)\b/,
  /slurred speech/,
  /\b(can'?t|cannot|could not|couldn'?t|unable to) (speak|talk) (properly|clearly|straight)\b/,
  /(sudden|worst) (severe )?headache/,
  // Pain in the jaw, or in the left arm or shoulder with sweating, nausea or breathlessness.
  /\bjaw\b( \w+){0,6} (pain\w*|ache|aches|aching|hurts?|hurting|tight\w*|pressure)\b/,
  /\b(pain|ache|aching|pressure|tightness) (in|on) (my |the )?jaw\b/,
  /\b(left arm|left shoulder|jaw)\b.{0,60}\b(sweat\w*|clammy|nause\w*|breathless|short of breath|dizz\w*)/,
  /\b(sweat\w*|clammy|nause\w*|breathless|short of breath|dizz\w*)\b.{0,60}\b(left arm|left shoulder|jaw)\b/,
  /\bcold sweats?\b/,
  /\b(pain|ache|aching|tightness|pressure)\b( \w+){0,4} (spread\w*|radiat\w*|going|moving|shoot\w*) (to|into|down|up) (my |the )?(left )?(arm|jaw|neck)\b/,
  /\b(vision|eyesight)\b( \w+){0,3} (went|go|goes|going|gone|turned|getting|got) (black|dark|blurry|blurred|double|white|grey|gray)\b/,
  /\b(blurred|blurry|double|lost|losing) (vision|eyesight)\b/,
  /\beverything (went|goes|going|turned) (black|dark)\b/,
  // Hinglish
  /(seene|chhati|chhaati|chaati|chhatee) (me|mein|mai|main) (dard|jalan|bhaari|bhari|dabav|dabaav|jakdan|jakad)/,
  /\bseena (bhaari|bhari|jakad|dard)/,
  /\b(behosh|behoshi)\b/,
  /saans (nahi|nhi|nai) (aa|le paa?)/,
  /saans (phool|ful) (rahi|raha|gayi|gaya)/,
  /\bchakkar\b/,
  /dil (bahut |bohot )?(tez|zor se) (dhadak|chal)/,
  /\bdil ka daura\b/,
  /\b(jabde|jabda|jabdon|jabado) (me|mein|mai|main)? ?(dard|dukh)/,
  /\b(chehra|chehre|chehre ka|muh|munh|mooh)( \w+){0,3} (sunn|tedha|tedi|tedhi|latak\w*)\b/,
  /\bek (taraf|side|hissa|hisse)( \w+){0,4} (sunn|kamzor\w*|kamjor\w*)\b/,
  /\b(aankhon|ankhon|aankho|ankho) (ke aage|ke saamne|ke samne|mein|me) (andhera|andhere)/,
  /\b(dhundhla|dhundla) (dikh|dikhai)/,
  /\bbol (nahi|nhi|nai) (paa|pa) (raha|rahi|rahe)/,
  /\b(zubaan|zuban|juban|jubaan) (ladkhada|atak)/,
  /\b(baayein|bayein|baaye|baye|left) (haath|hath|kandhe|kandha|baazu|bazu)\b.{0,60}\b(paseena|pasina|pasine)\b/,
  // Hindi
  /(सीने|छाती) (में|मे) (दर्द|जलन|भारी|दबाव|जकड़)/,
  /सीना (भारी|जकड़)/,
  /बेहोश/,
  /चक्कर/,
  /सांस (नहीं?|ना) (आ|ले)/,
  /सांस फूल/,
  /दिल (बहुत )?(तेज़?|ज़ोर से) (धड़क|चल)/,
  /दिल का दौरा/,
  /जबड़े (में|मे) दर्द/,
  /चेहर(ा|े)( \S+){0,3} (सुन्न|टेढ़)/,
  /एक (तरफ़?|ओर|साइड)( \S+){0,4} (सुन्न|कमज़ोर|कमज़ोरी)/,
  /आंखों (के आगे|के सामने|में) अंधेरा/,
  /बोल नहीं? पा/,
]);

/**
 * A few red-flag wordings are also everyday gym talk ("chest is heavy after pushups", "jaw ache from
 * clenching", "heart attack workout"). When every red-flag match is one of these and the message gives
 * a training or chewing cause, the coach asks one question ("are you having chest pain ... right now?")
 * instead of assuming. Nothing is dropped: it is still a red flag and never reaches any AI.
 */
const SORENESS_PRONE = /^(chest\b|jaw\b|heart attack|(pain|ache|aching|pressure|tightness) (in|on) (my |the )?jaw)/;
const SORENESS_CONTEXT = /\b(after|from|since|post|during|because of|due to) (\w+ ){0,2}(push ?ups?|bench|press(es)?|fly|flys|flies|dips|chest day|workouts?|training|gym|lifting|session|sets?|yesterday|clenching|chewing|gum)\b|\b(workout|finisher|session|leg day|chest day)\b/;

/** Any of these alongside chest or jaw pain keeps it a confirmed red flag, whatever the cause given. */
const OTHER_SYMPTOM = /sweat|clammy|nause|breath|dizz|faint|numb|tingl|arm|neck|spread|radiat|vomit|chakkar|paseen|pasin/;

const CRISIS = compile([
  /\b(kill|hurt|harm) (myself|me)\b/,
  // Other verb forms only with "myself": "my knee is hurting me" is an injury, not a crisis.
  /\b(killing|killed|hurting|hurts|harming|harmed) myself\b/,
  /\bsuicid\w*/,
  /\bself[- ]?harm\w*/,
  /end (my|it) (life|all)/,
  /\bend(ing|ed)? (it all|my own life)\b/,
  /\b(take|taking|took) my (own )?life\b/,
  /\bwant to die\b/,
  /\b(want|wanna|wanted|wish|wishing|planning|plan|deserve) to (die|be dead|not exist|stop living|not be alive|disappear forever)\b/,
  // A wish not to wake up or live. "I don't want to wake up early" stays out.
  /\b(don'?t|do not|never|didn'?t|did not) (want|wanna|wish) to wake up( (again|tomorrow|ever|any ?more|in the morning))?(?! (early|at|for|so|before|by|to|and|on time))/,
  /\b(don'?t|do not|never) (want|wanna|wish) to (live|be alive|exist)\b/,
  /\b(don'?t|do not) (want|wanna) to (be here|be around|go on|keep going|carry on) ?(any ?more|like this|$)/,
  /\bwish i (was|were|had been) (dead|never born|gone)\b/,
  /\bwish i (could )?(just )?(die|disappear|not wake up|didn'?t wake up|never woke up|wouldn'?t wake up)\b/,
  /\b(better off|happier|easier) (dead|without me)\b/,
  /\bbetter( off)? without me\b/,
  /\b(a|such a|just a) burden (to|on|for) (everyone|everybody|my family|them|people|others|all of them)\b/,
  /\b(no|nothing|not any) (reason|point) (to|in) (live|living|go on|going on|being alive|being here)\b/,
  /\bnothing (left )?to live for\b/,
  /\b(tired|sick) of (living(?! (on|off|in|with|out of))|being alive|life(?! admin)|existing)\b/,
  /\bcan'?t go on (any ?more|like this|living)\b(?! (reps?|sets?|with|on|in|at|for|form|squats?|runs?|cardio))/,
  /\bnot (be|being) (here|around|alive) (any ?more|much longer|for long)\b/,
  /\bthoughts? (of|about) (dying|death|ending it|killing|hurting|harming)\b/,
  // Self-harm in everyday words. "Cutting my arm day short" and "burn myself out" stay out.
  /\b(cut|cutting|cuts|burn|burning|burned|burnt|scratch|scratching) myself\b(?! out)/,
  /\b(cutting|cuts|slit|slitting|slash|slashing) (my|both|both my) (arms?|wrists?|legs?|thighs?|skin|stomach|body)\b(?! (day|days|workout|session|training|routine|exercises?|volume|short|fat))/,
  /\bcut (my|both|both my) (arms|wrists?|thighs|skin)\b(?! (day|days|workout|session|training|routine|exercises?|volume|short|fat))/,
  /\bhang(ing)? myself\b/,
  /\bunalive\w*/,
  /\boverdos(e|ed|ing)\b(?! (of|on) (protein|caffeine|coffee|pre ?workout|creatine|sugar|carbs|whey|cardio|training))/,
  /\b(take|took|taking|swallow\w*) (all|a lot of|a bunch of|too many|lots of|a whole (bottle|strip|pack) of) (my |the )?(pills|tablets|sleeping pills|medicines?|meds)\b/,
  /\bjump(ing)? (off|from) (a|the|my) (bridge|building|roof|terrace|balcony)\b/,
  // Hinglish
  /\b(khudkushi|khudkhushi|aatmhatya|atmhatya|aatmahatya|atmahatya)\b/,
  /marna (chahta|chahti|hai)/,
  /jeena nahi (chahta|chahti)/,
  /\bjeena? (nahi|nhi|nai|nahin) (chahta|chahti|chahte|hai)/,
  /\b(jeene|jine|jeena|jina) (ka|ki|ko|mein|me)( \w+){0,3} (nahi|nhi|nai|nahin|na)\b/,
  /\b(khud ko|khudko|khud hi ko|apne aap ko|apne ap ko|apneaap ko|apneap ko) (khatam|khatm|khtm|maar\w*|mar\w*|nuksan|nuksaan|nukasan|nuqsan|hurt|harm|chot|takleef|taklif|saza|kaat\w*|kat\b|jala\w*)/,
  /\bapni jaan (le|lena|lene|lu|loon|de|dena|dene|du|doon|ganwa)/,
  /\bmar (jaane|jane|jaana|jana|jaaun|jaun|jau|jaoon|jaon|jaaon)( \w+){0,3} (mann|man|dil|ichha|iccha|icchha|khayal|khyal|chahta|chahti|chahiye|behtar|accha|achha|theek)\b/,
  /\bmarne (ka|ki|ke) (mann|man|dil|ichha|iccha|khayal|khyal|vichar|soch|irada|tareeke|plan)/,
  /\bmere bina( \w+){0,4} (behtar|better|khush|accha|achha|aasaan|asaan)/,
  /\bzindagi (se )?(tang|thak|nafrat)/,
  /\bzindagi khatam/,
  /\b(nas|nass|nasein|kalai|kalaai) (kaat|kaatna|kaati|kaata|kaatti|kaatta|kaatungi|kaatunga|kaat li|kaat di)\b/,
  // Hindi
  /आत्महत्या/,
  /खुदकुशी/,
  /(खुद|अपने आप|स्वयं|ख़ुद) ?को (खत्म|ख़त्म|मार|नुकसान|नुक़सान|चोट|हानि|काट|जला)/,
  /अपनी जान (ले|दे)/,
  /जीने (का|की|को)( \S+){0,3} (नहीं?|ना)/,
  /जीना नहीं? (चाहता|चाहती)/,
  /मर (जाने|जाना|जाऊं|जाऊ|जाउं)( \S+){0,3} (मन|इच्छा|ख्याल|खयाल|चाहता|चाहती|चाहिए|बेहतर|अच्छा)/,
  /मरने (का|की|के) (मन|इच्छा|ख्याल|खयाल|विचार)/,
  /मरना (चाहता|चाहती)/,
  /मेरे बिना( \S+){0,4} (बेहतर|खुश|ख़ुश|अच्छा)/,
  /(कलाई|नस|नसें) काट/,
]);

/** Saying why: "to lose weight", "so I get lighter", "taaki weight na badhe". */
const WEIGHT_INTENT = new RegExp(
  foldDevanagari(
    /\b(lose|losing|lighter|thin|thinner|skinny|skinnier|weight(?! ?(training|lifting|lifter|room|s|belt|plates?|bench|vest))|fat|slim|slimmer|smaller|drop(?! ?sets?)|patla|patli|patle|vajan|wazan|wajan|mota|moti|motapa)\b|वज़?न|पतला|पतली|मोटा|मोटी/.source,
  ),
);

/** Not eating, starving or making oneself sick. Only an eating-disorder signal together with WEIGHT_INTENT. */
const RESTRICTING = new RegExp(
  foldDevanagari(
    /\b(not eat(ing)? (anything|at all|food|for)|stop(ped|ping)? eating|skip\w* (all |most |my |every )?(meals|food|eating)|starv\w*|haven'?t eaten|didn'?t eat (anything|for)|eat(ing)? nothing|no food|bhook\w*|bhukh\w*|(khana|khaana) (chhod|chod|band|skip)\w*|(kuch|kuchh) (nahi|nhi|nai) (kha\w*)|ulti|vomit\w*|throw\w* up|puk(e|ing))\b|भूख|खाना (छोड़|बंद)|उल्टी/.source,
  ),
);

/** Religious and festival fasting is common and not a warning sign on its own. */
const RELIGIOUS_FAST = new RegExp(
  foldDevanagari(
    /\b(navratri|navaratri|vrat|varat|upvas|upwas|roza|roze|rozas|ramzan|ramadan|ramazan|ekadashi|karva|karwa|chauth|shravan|sawan|saawan|lent|puja|pooja|festival|religious|paryushan|nirjala)\b|व्रत|उपवास|नवरात्र|रोज़ा/.source,
  ),
);

/** A weekly schedule ("2 days a week", "5:2") is intermittent fasting, not a multi-day fast. */
const WEEKLY_SCHEDULE = /\b(a|per|every|each) week\b|\b5 2\b|\bintermittent\b/;
const FASTING_DAYS = /\b(fast|fasting|fasted|water fast\w*)( \w+){0,3} (for )?(\d+|two|three|four|five|six|seven|several|a few|couple of|a couple of) (days|weeks)\b/;

const ED_SIGNAL = compile([
  /\bstarv(e|ing|ed) myself\b/,
  /\bpurg(e|ing)\b/,
  /\b(throw(ing|s)?|threw|thrown) up after (eating|i eat|every meal|each meal|meals?|food|dinner|lunch|breakfast|snacks?)\b/,
  /\b(vomit\w*|puk(e|es|ed|ing)) after (eating|i eat|every meal|each meal|meals?|food|dinner|lunch|breakfast|snacks?)\b/,
  /\b(make|makes|making|made) myself (throw up|vomit|puke|be sick|sick)\b/,
  /\blaxatives?\b/,
  /skip(ping)? (all )?meals to (lose|drop)/,
  /\b(hate|disgusted by) (my body|myself|how i look)\b/,
  /\b(anorexi\w*|bulimi\w*|pro ?ana|thinspo\w*|meanspo|binge and purge|diet pills?|appetite suppressants?|chew and spit)\b/,
  // Days without food, whatever the reason given.
  /\b(haven'?t|have not|hadn'?t|had not|didn'?t|did not|not|without|stopped|no)(?!.{0,24}\b(junk|sugar|sugary|fried|outside|processed|fast food|maida|sweets|meat|non ?veg|chicken|eggs?|after|before|past|late)\b)( \w+){0,3} (eaten|eating|eat|food)( \w+){0,3} (for|in) (\d+|two|three|four|five|six|seven|several|a few|many|couple of|a couple of) (days|weeks)\b/,
  /\b(eat|eating|ate) (nothing|almost nothing|next to nothing)\b(?! (but|else|after|before|fried|sugary|junk))/,
  /\bonly (drink|drinking|drank|have|having|had) (water|black coffee|green tea|lemon water)( \w+){0,3} (all day|for (\d+|two|three|a few|several) days|every day|daily)\b/,
  // Hinglish
  /\bulti (kar|karti|karta|karke|karna|kar ke|kar deti|kar deta|kar leti|kar leta|karwa|karwati|karwata|nikal|nikaal)/,
  /\b(ungli|ungali|finger) (daal|dal|daalke|dalke|daal ke|daal kar)/,
  /\b(din|dino|dinon|days?) se( \w+){0,3} (kuch|kuchh)? ?(nahi|nhi|nai) (khaya|khaaya|khai|khaai|khaya hai)/,
  // Hindi
  /उल्टी कर/,
  /(दिन|दिनों) से( \S+){0,3} (कुछ )?(नहीं?) खा/,
]);

const OUT_OF_SCOPE: RegExp[] = [
  /\b(dose|dosage|how much|how many mg)\b.*\b(creatine|steroid|testosterone|insulin|metformin|ozempic|semaglutide|tirzepatide|mounjaro|supplement)/,
  /\b(creatine|steroids?|testosterone|insulin|metformin|ozempic|semaglutide|tirzepatide|mounjaro|supplements?)\b.*\b(dose|dosage|dosing|how much|mg)\b/,
  /\b(diagnose|diagnosis|what disease|is it cancer|prescribe)\b/,
  /\b(steroids?|anabolic|sarms?|peptides?)\b/,
];

// "Hurting myself on deadlifts" is usually a training injury. Still treated as a crisis, but the coach
// asks one question (with the helpline) instead of assuming. Recall is kept: nothing is dropped.
const TRAINING_CONTEXT = /\b(hurt|hurting|hurts|harm|harming|harmed|cut|cutting|burned|burnt) myself (on|during|while|doing|lifting|in|at|with) (the |a |my |heavy |those |these )?(deadlifts?|squats?|bench|press(es)?|lifts?|lifting|gym|workouts?|training|runs?|running|exercises?|sets?|reps?|pull ?ups?|push ?ups?|lunges?|rows?|cardio|yoga|class|barbell|bar|knurling|plates?|kettlebell|dumbbells?|machine|cooking|kitchen|knife|chopping|stove|pan|iron|shaving|razor)\b|\b(cut|cutting|burned|burnt) myself (cooking|chopping|shaving)\b/;
const ONLY_HURT_HARM = /^(hurt|hurting|hurts|harm|harming|harmed|cut|cutting|burned|burnt) (myself|me)$/;

const NEGATION = /\b(no|not|never|without|nahi|nhi|koi nahi)\b|नहीं?/;

/**
 * Lower case, Devanagari folded and its digits made ASCII, curly apostrophes straightened, invisible
 * format characters (zero-width space and joiners) removed, digit-grouping commas dropped so "1,800"
 * stays one number, punctuation removed, and runs of four or more spaced single letters ("s u i c i d e",
 * "s.u.i.c.i.d.e") joined into one word.
 */
export function normaliseSafetyText(text: string): string {
  return foldDevanagari(text)
    .replace(/\p{Cf}/gu, '')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0966-\u096f]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc`\u00b4]/g, "'")
    .replace(/(\d),(?=\d{2,3}(?!\d))/g, '$1')
    .replace(/[^\p{L}\p{M}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?<=^| )[a-z](?: [a-z]){3,}(?= |$)/g, (m) => m.replace(/ /g, ''));
}

function matches(text: string, patterns: RegExp[]): string[] {
  const out: string[] = [];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) out.push(m[0]);
  }
  return out;
}

/** Extremely low calorie targets ("800 calories a day", "500 calorie pe") are treated as an eating-disorder signal. */
function lowCalorieRequest(text: string): string | null {
  const m = text.match(/\b(\d{3,4}) ?(kcals?|calories|calorie|cals?)\b|(\d{3,4}) ?कैलोरी/);
  if (!m) return null;
  const n = Number(m[1] ?? m[3]);
  return n >= 300 && n < 1200 ? m[0] : null;
}

/** Fasting or not eating for a weight reason, and multi-day fasts that are not religious. */
function restrictionSignal(text: string): string | null {
  const intent = WEIGHT_INTENT.test(text);
  const restrict = text.match(RESTRICTING);
  if (restrict && intent) return restrict[0];
  const fast = text.match(FASTING_DAYS);
  if (fast && !WEEKLY_SCHEDULE.test(text) && (intent || !RELIGIOUS_FAST.test(text))) return fast[0];
  return null;
}

export function classifyText(raw: string): SafetyResult {
  const text = normaliseSafetyText(raw);
  const crisis = matches(text, CRISIS);
  if (crisis.length) {
    const training = TRAINING_CONTEXT.test(text) && crisis.every((m) => ONLY_HURT_HARM.test(m));
    return { kind: 'crisis', confidence: training ? 'needs_confirm' : 'confirmed', matched: crisis };
  }

  const red = matches(text, RED_FLAG);
  if (red.length) {
    const negated = red.every((phrase) => {
      const idx = text.indexOf(phrase);
      const before = text.slice(Math.max(0, idx - 24), idx);
      return NEGATION.test(before);
    });
    const soreness = SORENESS_CONTEXT.test(text) && !OTHER_SYMPTOM.test(text) && red.every((m) => SORENESS_PRONE.test(m));
    return { kind: 'red_flag', confidence: negated || soreness ? 'needs_confirm' : 'confirmed', matched: red };
  }

  const ed = matches(text, ED_SIGNAL);
  const low = lowCalorieRequest(text);
  if (low) ed.push(low);
  const restricting = restrictionSignal(text);
  if (restricting) ed.push(restricting);
  if (ed.length) return { kind: 'ed_signal', confidence: 'confirmed', matched: ed };

  const oos = matches(text, OUT_OF_SCOPE);
  if (oos.length) return { kind: 'out_of_scope', confidence: 'confirmed', matched: oos };

  return { kind: 'none', confidence: 'confirmed', matched: [] };
}

/** Opening line of every confirmed-crisis message, in the coach and on the safety screen. Wording pending professional review (plan/14). */
export const CRISIS_OPENER = 'Thank you for telling me.';

/** Fixed emergency guidance (claim R-22). Works offline; shown by the safety stop screen. */
export const EMERGENCY = {
  number: '112',
  ambulance: '108',
  mentalHealth: { name: 'Tele-MANAS', numbers: ['14416', '1-800-891-4416'] },
} as const;
