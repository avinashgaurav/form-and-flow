import { GROUND, LEN, type Keyframe, type Limb, type Motion, type Pose, type Vec } from './rig';

/**
 * One motion per catalogue exercise. Poses pin hands and feet where they touch the floor, a bench
 * or a bar (two-bone IK), so contacts never slide. Tempo follows a controlled rep: about 1.5 s
 * down, 1 s up. These are illustrations for the pilot (plan/09); filmed, coach-reviewed loops
 * replace them for beta.
 */

const FY = GROUND - LEN.ankle; // ankle height when standing on the floor
const foot = (x: number, y = FY, bend: 1 | -1 = -1): Limb => ({ to: [x, y], bend });
const hand = (x: number, y: number, bend: 1 | -1 = 1): Limb => ({ to: [x, y], bend });
const rel = (dx: number, dy: number, bend: 1 | -1 = 1): Limb => ({ to: [dx, dy], from: 'root', bend });
const ang = (a: number, b = a): Limb => ({ a, b });
const SIDES = ang(-3, 2);

const stand = (x = 108, extra: Partial<Pose> = {}): Pose => ({ hip: [x, 100], torso: 2, armNear: SIDES, legNear: foot(x + 3), ...extra });

/** A rep: move to `to` (the hard part), then back to `from`. */
const rep = (from: Pose, to: Pose, cues: [string, string], tempo: [number, number] = [1.5, 1.1], holds: [number, number] = [0.25, 0.45]): { start: Pose; frames: Keyframe[] } => ({
  start: from,
  frames: [
    { pose: to, dur: tempo[0], hold: holds[0], cue: cues[0] },
    { pose: from, dur: tempo[1], hold: holds[1], cue: cues[1] },
  ],
});

const squatBottom = (hip: Vec, torso: number, arms: Limb, x = 108): Pose => ({ hip, torso, armNear: arms, legNear: foot(x + 3) });

/* ---------- Lying and kneeling bases ---------- */

const LIE_SHOULDER: Vec = [62, 171];
/** Lying on the back, head to the left, hips at `hipY`. */
function lying(torso: number, head: number, feet: Limb, arms: Limb, armsFar?: Limb): Pose {
  const t = (torso * Math.PI) / 180;
  const hip: Vec = [LIE_SHOULDER[0] - LEN.torso * Math.sin(t), LIE_SHOULDER[1] + LEN.torso * Math.cos(t)];
  return { hip, torso, head, armNear: arms, armFar: armsFar, legNear: feet };
}

const TABLETOP: Pose = { hip: [90, 132], torso: 81, armNear: hand(140, 181, -1), legNear: foot(50, 178, -1) };

/* ---------- Push-up geometry ---------- */

/** A straight body from the ankle, `deg` from vertical, as hip position. */
function body(ankle: Vec, deg: number, legLen = 81): Vec {
  const t = (deg * Math.PI) / 180;
  return [ankle[0] + legLen * Math.sin(t), ankle[1] - legLen * Math.cos(t)];
}

const PUSH_ANKLE: Vec = [40, 172];
const pushup = (deg: number): Pose => ({ hip: body(PUSH_ANKLE, deg), torso: deg, armNear: hand(164, 181, 1), legNear: foot(PUSH_ANKLE[0], PUSH_ANKLE[1]), footNear: -55 });

const KNEE: Vec = [88, 176];
const kneePush = (deg: number): Pose => ({ hip: body(KNEE, deg, 42), torso: deg, armNear: hand(166, 181, 1), legNear: foot(48, 178, -1), footNear: 0 });

const BENCH_HIP: Vec = [125, 129];
const benchPress = (handsY: number, handsX: number, barbell: boolean): Motion => ({
  ...rep(
    { hip: BENCH_HIP, torso: -90, armNear: hand(handsX, 72, 1), legNear: foot(170, FY, -1) },
    { hip: BENCH_HIP, torso: -90, armNear: hand(handsX + 4, handsY, 1), legNear: foot(170, FY, -1) },
    ['Lower with control to your chest', 'Press up and slightly back'],
  ),
  muscles: ['chest', 'arms'],
  props: [{ kind: 'bench', x: 34, y: 150, w: 118 }, barbell ? { kind: 'barbell', at: 'hands' } : { kind: 'dumbbell', hands: 'both' }],
});

/* ---------- Lunge geometry ---------- */

const lunge = (hip: Vec, front: number, back: Vec, torso = 4): Pose => ({ hip, torso, armNear: SIDES, legNear: foot(front), legFar: foot(back[0], back[1], -1), footFar: -40 });

/* ---------- The library ---------- */

const M: Record<string, Motion> = {
  chair_squat: {
    ...rep(stand(), squatBottom([80, 136], 32, ang(80, 82)), ['Sit back until you touch the seat', 'Stand tall, push the floor away']),
    muscles: ['quads', 'glutes'],
    props: [{ kind: 'chair', x: 62, y: 152 }],
  },
  bw_squat: {
    ...rep(stand(), squatBottom([78, 140], 38, ang(85, 88)), ['Hips back and down, chest up', 'Drive up through your whole foot']),
    muscles: ['quads', 'glutes'],
    props: [],
  },
  goblet_squat: {
    ...rep(stand(108, { armNear: rel(15, 14, 1) }), squatBottom([82, 140], 30, rel(15, 14, 1)), ['Sit between your heels, chest tall', 'Drive up through mid-foot']),
    muscles: ['quads', 'glutes'],
    props: [{ kind: 'dumbbell', hands: 'together' }],
  },
  leg_press: {
    ...rep(
      { hip: [92, 140], torso: -50, armNear: ang(20, 40), legNear: foot(150, 92, -1), footNear: 50 },
      { hip: [92, 140], torso: -50, armNear: ang(20, 40), legNear: foot(122, 114, -1), footNear: 50 },
      ['Lower until your hips start to lift', 'Press through your whole foot'],
    ),
    muscles: ['quads', 'glutes'],
    props: [{ kind: 'legpress' }],
  },
  back_squat: {
    ...rep(stand(108, { armNear: rel(-5, -3, -1) }), squatBottom([82, 140], 40, rel(-5, -3, -1)), ['Brace, then sit down between your heels', 'Stand with the bar over mid-foot']),
    muscles: ['quads', 'glutes'],
    props: [{ kind: 'barbell', at: 'back' }],
  },

  glute_bridge: {
    ...rep(lying(-92, 0, foot(150, FY, -1), hand(116, 180, 1)), lying(-121, 29, foot(150, FY, -1), hand(116, 180, 1)), ['Squeeze your glutes, lift to a straight line', 'Lower slowly']),
    muscles: ['glutes', 'hamstrings'],
    props: [],
    mat: true,
  },
  band_good_morning: {
    ...rep(stand(108, { armNear: rel(6, -4, 1) }), { hip: [90, 104], torso: 72, armNear: rel(6, -4, 1), legNear: foot(111) }, ['Soft knees, push your hips back, flat back', 'Drive your hips forward to stand']),
    muscles: ['hamstrings', 'glutes'],
    props: [{ kind: 'band', anchor: 'feet', hands: 'together' }],
  },
  db_rdl: {
    ...rep(stand(108, { armNear: ang(0, 0) }), { hip: [88, 104], torso: 70, armNear: ang(0, 0), legNear: foot(111) }, ['Slide the weights down your legs, hips back', 'Stand tall, squeeze your glutes']),
    muscles: ['hamstrings', 'glutes'],
    props: [{ kind: 'dumbbell', hands: 'both' }],
  },
  hip_thrust: {
    ...rep(
      { hip: [112, 168], torso: -53, head: 20, armNear: hand(116, 156, 1), legNear: foot(150, FY, -1) },
      { hip: [122, 138], torso: -90, head: 35, armNear: hand(126, 126, 1), legNear: foot(150, FY, -1) },
      ['Drive your hips up until your body is level', 'Lower with control'],
    ),
    muscles: ['glutes', 'hamstrings'],
    props: [{ kind: 'bench', x: 26, y: 150, w: 54 }, { kind: 'dumbbell', hands: 'near' }],
  },
  kb_swing: {
    ...rep(
      { hip: [90, 104], torso: 65, armNear: ang(-15, -15), legNear: foot(111) },
      { hip: [108, 100], torso: 0, armNear: ang(90, 90), legNear: foot(111) },
      ['Snap your hips forward', 'Hike the bell back between your legs'],
      [0.6, 0.6],
      [0.15, 0.1],
    ),
    muscles: ['glutes', 'hamstrings'],
    props: [{ kind: 'kettlebell' }],
  },
  deadlift: {
    ...rep(
      { hip: [92, 128], torso: 50, armNear: hand(124, 169, 1), legNear: foot(116) },
      { hip: [108, 100], torso: 2, armNear: hand(114, 106, 1), legNear: foot(116) },
      ['Brace, push the floor away', 'Lower with a flat back'],
    ),
    muscles: ['hamstrings', 'glutes', 'back'],
    props: [{ kind: 'barbell', at: 'hands' }],
  },

  split_squat: {
    ...rep(lunge([106, 106], 138, [72, 168]), lunge([104, 132], 138, [72, 168]), ['Lower the back knee toward the floor', 'Push through the front foot']),
    muscles: ['quads', 'glutes'],
    props: [],
  },
  reverse_lunge: {
    ...rep(stand(108), lunge([98, 132], 111, [48, 168]), ['Step back and lower', 'Push through the front foot to return']),
    muscles: ['quads', 'glutes'],
    props: [],
  },
  step_up: {
    ...rep(
      { hip: [106, 104], torso: 12, armNear: SIDES, legNear: foot(140, 147), legFar: foot(102, FY) },
      { hip: [138, 66], torso: 2, armNear: SIDES, legNear: foot(140, 147), legFar: foot(134, 145) },
      ['Drive through the top foot to stand up', 'Step down with control'],
    ),
    muscles: ['quads', 'glutes'],
    props: [{ kind: 'box', x: 118, w: 56, h: 34 }],
  },
  db_reverse_lunge: {
    ...rep(stand(108, { armNear: ang(0, 0) }), { ...lunge([98, 132], 111, [48, 168]), armNear: ang(0, 0) }, ['Step back and lower', 'Push through the front foot to return']),
    muscles: ['quads', 'glutes'],
    props: [{ kind: 'dumbbell', hands: 'both' }],
  },
  bulgarian_split_squat: {
    ...rep(
      { hip: [98, 108], torso: 10, armNear: SIDES, legNear: foot(128), legFar: foot(51, 148, -1), footFar: -20 },
      { hip: [96, 134], torso: 12, armNear: SIDES, legNear: foot(128), legFar: foot(51, 148, -1), footFar: -20 },
      ['Lower straight down', 'Drive up through the front heel'],
    ),
    muscles: ['quads', 'glutes'],
    props: [{ kind: 'bench', x: 14, y: 160, w: 46 }],
  },

  wall_pushup: {
    ...rep(
      { hip: body([88, FY], 25), torso: 25, armNear: hand(198, 66, 1), legNear: foot(88) },
      { hip: body([88, FY], 38), torso: 38, armNear: hand(198, 66, 1), legNear: foot(88) },
      ['Lower your chest toward the wall', 'Push the wall away'],
    ),
    muscles: ['chest', 'arms'],
    props: [{ kind: 'wall', x: 200 }],
  },
  knee_pushup: {
    ...rep(kneePush(55), kneePush(70), ['Lower your chest, body in one line', 'Push the floor away']),
    muscles: ['chest', 'arms'],
    props: [],
    mat: true,
  },
  pushup: {
    ...rep(pushup(66.6), pushup(78), ['Lower your chest, body in one line', 'Push the floor away']),
    muscles: ['chest', 'arms', 'core'],
    props: [],
    mat: true,
  },
  band_chest_press: {
    ...rep(
      stand(108, { torso: 8, armNear: rel(12, 18, 1), legFar: foot(96) }),
      stand(108, { torso: 8, armNear: rel(55, 8, 1), legFar: foot(96) }),
      ['Press your hands straight forward', 'Return slowly, elbows close'],
    ),
    muscles: ['chest', 'arms'],
    props: [{ kind: 'band', anchor: [28, 62], hands: 'together' }],
  },
  db_bench_press: benchPress(110, 80, false),
  bench_press: benchPress(110, 80, true),
  band_overhead_press: {
    ...rep(stand(108, { armNear: rel(10, -6, 1) }), stand(108, { armNear: rel(4, -56, 1) }), ['Press straight up, ribs down', 'Lower to your shoulders']),
    muscles: ['shoulders', 'arms'],
    props: [{ kind: 'band', anchor: 'feet', hands: 'together' }],
  },
  db_shoulder_press: {
    ...rep(stand(108, { armNear: rel(10, -6, 1) }), stand(108, { armNear: rel(4, -56, 1) }), ['Press straight up, ribs down', 'Lower to your shoulders']),
    muscles: ['shoulders', 'arms'],
    props: [{ kind: 'dumbbell', hands: 'both' }],
  },
  pike_pushup: {
    ...rep(
      { hip: [104, 100], torso: 118, armNear: hand(165, 178, 1), legNear: foot(70, 172), footNear: -40 },
      { hip: [106, 108], torso: 140, armNear: hand(165, 178, 1), legNear: foot(70, 172), footNear: -40 },
      ['Bend your elbows, head toward the floor', 'Push back up, hips high'],
    ),
    muscles: ['shoulders', 'arms'],
    props: [],
    mat: true,
  },

  doorframe_row: {
    ...rep(
      { hip: body([136, FY], -28), torso: -28, armNear: hand(131, 60, -1), legNear: foot(136) },
      { hip: body([136, FY], -12), torso: -12, armNear: hand(131, 60, -1), legNear: foot(136) },
      ['Pull your chest to the frame', 'Lower back slowly, arms long'],
    ),
    muscles: ['back', 'arms'],
    props: [{ kind: 'doorframe', x: 133 }],
  },
  band_row: {
    ...rep(stand(108, { torso: 6, armNear: rel(56, 10, -1) }), stand(108, { torso: 6, armNear: rel(14, 34, -1) }), ['Pull your elbows back, squeeze your shoulder blades', 'Arms long again, slowly']),
    muscles: ['back', 'arms'],
    props: [{ kind: 'band', anchor: [204, 92], hands: 'together' }],
  },
  db_row: {
    ...rep(
      { hip: [106, 108], torso: 80, armNear: rel(2, 56, -1), armFar: hand(172, 143, 1), legNear: foot(118), legFar: foot(94) },
      { hip: [106, 108], torso: 80, armNear: rel(-24, 26, -1), armFar: hand(172, 143, 1), legNear: foot(118), legFar: foot(94) },
      ['Pull the weight to your hip', 'Lower with a long arm'],
    ),
    muscles: ['back', 'arms'],
    props: [{ kind: 'bench', x: 150, y: 150, w: 60 }, { kind: 'dumbbell', hands: 'near' }],
  },
  cable_row: {
    ...rep(
      { hip: [80, 150], torso: 12, armNear: rel(56, 8, -1), legNear: foot(150, 172, -1), footNear: 60 },
      { hip: [80, 150], torso: -6, armNear: rel(16, 30, -1), legNear: foot(150, 172, -1), footNear: 60 },
      ['Pull the handle to your belly, chest tall', 'Reach forward slowly'],
    ),
    muscles: ['back', 'arms'],
    props: [{ kind: 'box', x: 50, w: 50, h: 22 }, { kind: 'cable', x: 214, y: 140 }],
  },
  barbell_row: {
    ...rep(
      { hip: [92, 106], torso: 65, armNear: rel(0, 56, -1), legNear: foot(114) },
      { hip: [92, 106], torso: 65, armNear: rel(-6, 28, -1), legNear: foot(114) },
      ['Pull the bar to your lower chest', 'Lower with control, back flat'],
    ),
    muscles: ['back', 'arms'],
    props: [{ kind: 'barbell', at: 'hands' }],
  },
  band_pulldown: {
    ...rep(stand(108, { torso: 4, armNear: rel(30, -48, 1) }), stand(108, { torso: 4, armNear: rel(10, 8, -1) }), ['Pull your elbows down to your sides', 'Let your arms rise slowly']),
    muscles: ['back', 'arms'],
    props: [{ kind: 'band', anchor: [184, -8], hands: 'together' }],
  },
  lat_pulldown: {
    ...rep(
      { hip: [100, 128], torso: -12, armNear: rel(6, -56, 1), legNear: foot(146, FY, -1) },
      { hip: [100, 128], torso: -12, armNear: rel(12, 4, -1), legNear: foot(146, FY, -1) },
      ['Pull the bar to your upper chest', 'Let it rise slowly, arms long'],
    ),
    muscles: ['back', 'arms'],
    props: [{ kind: 'pulldown' }],
  },
  band_assisted_pullup: {
    ...rep(
      { hip: [112, 100], torso: -4, armNear: hand(120, -6, -1), legNear: ang(20, -40) },
      { hip: [114, 66], torso: -4, armNear: hand(120, -6, -1), legNear: ang(20, -40) },
      ['Pull your chest toward the bar', 'Lower all the way, slowly'],
    ),
    muscles: ['back', 'arms'],
    props: [{ kind: 'bar', x: 120, y: -6 }, { kind: 'band', anchor: [120, -6], hands: 'together', to: 'knee' }],
  },
  pullup: {
    ...rep(
      { hip: [112, 100], torso: -4, armNear: hand(120, -6, -1), legNear: ang(10, -50) },
      { hip: [114, 66], torso: -4, armNear: hand(120, -6, -1), legNear: ang(10, -50) },
      ['Pull your chest toward the bar', 'Lower all the way, slowly'],
    ),
    muscles: ['back', 'arms'],
    props: [{ kind: 'bar', x: 120, y: -6 }],
  },

  dead_bug: {
    start: lying(-92, 0, ang(180, 90), ang(180, 180)),
    frames: [
      { pose: { ...lying(-92, 0, ang(95, 95), ang(180, 180), ang(-100, -100)), legFar: ang(180, 90) }, dur: 1.4, hold: 0.3, cue: 'Reach the opposite arm and leg away, back flat' },
      { pose: lying(-92, 0, ang(180, 90), ang(180, 180)), dur: 1.1, hold: 0.3, cue: 'Return to the start' },
      { pose: { ...lying(-92, 0, ang(180, 90), ang(-100, -100), ang(180, 180)), legFar: ang(95, 95) }, dur: 1.4, hold: 0.3, cue: 'Now the other side' },
      { pose: lying(-92, 0, ang(180, 90), ang(180, 180)), dur: 1.1, hold: 0.3, cue: 'Return to the start' },
    ],
    muscles: ['core'],
    props: [],
    mat: true,
  },
  bird_dog: {
    start: TABLETOP,
    frames: [
      { pose: { ...TABLETOP, armNear: hand(196, 121, -1), legFar: foot(8, 126, -1) }, dur: 1.4, hold: 0.6, cue: 'Reach one arm forward and the other leg back' },
      { pose: TABLETOP, dur: 1.1, hold: 0.2, cue: 'Return without twisting' },
      { pose: { ...TABLETOP, armFar: hand(193, 119, -1), legNear: foot(8, 128, -1) }, dur: 1.4, hold: 0.6, cue: 'Now the other side' },
      { pose: TABLETOP, dur: 1.1, hold: 0.2, cue: 'Return without twisting' },
    ],
    muscles: ['core', 'glutes'],
    props: [],
    mat: true,
  },
  plank: {
    ...rep(
      { hip: [120.7, 157.2], torso: 79.6, armNear: hand(195, 181, 1), legNear: foot(40, 172), footNear: -55 },
      { hip: [120.7, 155.6], torso: 79.6, armNear: hand(195, 181, 1), legNear: foot(40, 172), footNear: -55 },
      ['Brace: ribs down, squeeze your glutes', 'Breathe steadily, hold the line'],
      [1.6, 1.6],
      [0.4, 0.4],
    ),
    muscles: ['core'],
    props: [],
    mat: true,
  },
  side_plank: {
    ...rep(
      { hip: [126, 163], torso: 58, armNear: hand(196, 181, 1), armFar: hand(126, 150, 1), legNear: foot(44, 176), footNear: -10 },
      { hip: [121.9, 150.7], torso: 72, armNear: hand(196, 181, 1), armFar: hand(122, 140, 1), legNear: foot(44, 176), footNear: -10 },
      ['Lift your hips to a straight line', 'Lower with control'],
      [1.3, 1.1],
      [1.5, 0.3],
    ),
    muscles: ['core'],
    props: [],
    mat: true,
  },
  pallof_press: {
    ...rep(stand(108, { armNear: rel(14, 18, 1), legFar: foot(98) }), stand(108, { armNear: rel(55, 14, 1), legFar: foot(98) }), ['Press out and resist the pull', 'Bring your hands back to your chest'], [1.2, 1.0], [1.5, 0.3]),
    muscles: ['core'],
    props: [{ kind: 'band', anchor: [24, 92], hands: 'together' }],
  },
  farmer_carry: {
    start: { hip: [110, 102], torso: 2, armNear: ang(0, 0), legNear: foot(128), legFar: foot(92, 174), footFar: -20 },
    frames: [
      { pose: { hip: [110, 102], torso: 2, armNear: ang(0, 0), legNear: foot(92, 174), legFar: foot(128), footNear: -20 }, dur: 0.55, cue: 'Walk tall, shoulders down' },
      { pose: { hip: [110, 102], torso: 2, armNear: ang(0, 0), legNear: foot(128), legFar: foot(92, 174), footFar: -20 }, dur: 0.55, cue: 'Short, steady steps' },
    ],
    muscles: ['core', 'shoulders'],
    props: [{ kind: 'dumbbell', hands: 'both' }],
  },
  suitcase_march: {
    start: stand(108, { armNear: ang(0, 0), legNear: foot(118, 150), legFar: foot(108) }),
    frames: [
      { pose: stand(108, { armNear: ang(0, 0), legNear: foot(111), legFar: foot(115, 148) }), dur: 0.8, cue: 'Stay level: do not lean toward the weight' },
      { pose: stand(108, { armNear: ang(0, 0), legNear: foot(118, 150), legFar: foot(108) }), dur: 0.8, cue: 'Lift each knee with control' },
    ],
    muscles: ['core'],
    props: [{ kind: 'dumbbell', hands: 'near' }],
  },
  march_in_place: {
    start: stand(108, { armNear: ang(-25, -10), armFar: ang(30, 70), legNear: foot(118, 150), legFar: foot(108) }),
    frames: [
      { pose: stand(108, { armNear: ang(30, 70), armFar: ang(-25, -10), legNear: foot(111), legFar: foot(115, 148) }), dur: 0.55, cue: 'Lift your knees, swing your arms' },
      { pose: stand(108, { armNear: ang(-25, -10), armFar: ang(30, 70), legNear: foot(118, 150), legFar: foot(108) }), dur: 0.55, cue: 'Keep a steady rhythm' },
    ],
    muscles: ['quads'],
    props: [],
  },

  cat_cow: {
    start: TABLETOP,
    frames: [
      { pose: { ...TABLETOP, curve: 30, head: 40 }, dur: 1.8, hold: 0.4, cue: 'Round your back up, tuck your chin' },
      { pose: { ...TABLETOP, curve: -22, head: -28 }, dur: 2.0, hold: 0.4, cue: 'Let your belly drop, look forward' },
    ],
    muscles: ['back'],
    props: [],
    mat: true,
  },
  hip_flexor_stretch: {
    ...rep(
      { hip: [100, 140], torso: 4, armNear: ang(15, 60), legNear: foot(138), legFar: foot(40, 176, -1) },
      { hip: [110, 142], torso: -4, armNear: ang(15, 60), legNear: foot(138), legFar: foot(40, 176, -1) },
      ['Squeeze your back glute, shift your hips forward', 'Ease back'],
      [1.6, 1.2],
      [2.0, 0.4],
    ),
    muscles: ['quads'],
    props: [],
    mat: true,
  },
  arm_circles: {
    start: stand(108, { armNear: ang(0, 0) }),
    frames: [90, 180, 270, 360].map((a) => ({ pose: stand(108, { armNear: ang(a, a) }), dur: 0.45, cue: 'Smooth, controlled circles' })),
    muscles: ['shoulders'],
    props: [],
  },
  worlds_greatest_stretch: {
    ...rep(
      { hip: [98, 146], torso: 68, armNear: hand(152, 181, 1), armFar: hand(150, 181, 1), legNear: foot(140), legFar: foot(21, 176, -1), footFar: -30 },
      { hip: [98, 146], torso: 68, armNear: hand(150, 70, 1), armFar: hand(150, 181, 1), legNear: foot(140), legFar: foot(21, 176, -1), footFar: -30 },
      ['Rotate and reach to the ceiling', 'Bring the hand back down'],
      [1.6, 1.2],
      [0.8, 0.3],
    ),
    muscles: ['hamstrings', 'back'],
    props: [],
    mat: true,
  },
};

export const MOTIONS: Readonly<Record<string, Motion>> = M;

export function motionFor(exerciseId: string): Motion | undefined {
  return M[exerciseId];
}
