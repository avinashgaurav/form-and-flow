/**
 * A 2D character rig for exercise animations (plan/09: illustrations for the pilot, never AI
 * imagery). Pure maths, no React: poses in, joint positions out, so it can be tested in Node.
 *
 * Scene units are pixels in a 240 x 200 view; y grows downward; the character faces right (+x).
 * Angles are degrees measured from straight down, positive turning toward the front (+x), except
 * the torso, which is measured from straight up, positive leaning forward.
 */

export type Vec = [number, number];

export const GROUND = 186;
export const LEN = { torso: 50, neck: 7, head: 11.5, upperArm: 30, forearm: 27, thigh: 42, shin: 40, foot: 17, ankle: 5 } as const;

/** A limb either by angles (upper absolute, lower absolute) or by where its end must be (two-bone IK). */
export type Limb =
  | { a: number; b: number }
  | {
      /** Target for the hand or ankle. */
      to: Vec;
      /** What `to` is measured from: the world, or the limb's own root (shoulder or hip). */
      from?: 'world' | 'root';
      /** Which way the middle joint (elbow or knee) points: 1 or -1. */
      bend: 1 | -1;
    };

export interface Pose {
  /** Hip position in scene units. */
  hip: Vec;
  /** Torso lean from vertical (degrees, + forward). */
  torso: number;
  /** Head tilt relative to the torso (degrees, + toward chest). */
  head?: number;
  /** Spine curve: + rounds the back (cat), - arches it (cow). */
  curve?: number;
  armNear: Limb;
  armFar?: Limb;
  legNear: Limb;
  legFar?: Limb;
  /** Foot angle (degrees from flat, + toes up). */
  footNear?: number;
  footFar?: number;
}

export interface LimbJoints {
  root: Vec;
  mid: Vec;
  end: Vec;
}

export interface Skeleton {
  hip: Vec;
  shoulder: Vec;
  neck: Vec;
  head: Vec;
  /** Where the spine curve's control point sits (for drawing the torso). */
  spineControl: Vec;
  /** Top of the drawn torso, a little below the shoulder joint so the neck shows. */
  chest: Vec;
  torsoAngle: number;
  headAngle: number;
  armNear: LimbJoints;
  armFar: LimbJoints;
  legNear: LimbJoints & { toe: Vec; heel: Vec };
  legFar: LimbJoints & { toe: Vec; heel: Vec };
}

const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const len = (a: Vec) => Math.hypot(a[0], a[1]);
/** A direction from straight down, positive toward +x. */
const down = (deg: number): Vec => [Math.sin(rad(deg)), Math.cos(rad(deg))];
/** A direction from straight up, positive toward +x. */
const up = (deg: number): Vec => [Math.sin(rad(deg)), -Math.cos(rad(deg))];

/** Two-bone inverse kinematics: the middle joint for a chain from `root` that ends as near `target` as it can. */
export function solveTwoBone(root: Vec, target: Vec, l1: number, l2: number, bend: 1 | -1): { mid: Vec; end: Vec } {
  const chord = sub(target, root);
  const d = Math.min(Math.max(len(chord), Math.abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6);
  const dir = len(chord) > 1e-9 ? scale(chord, 1 / len(chord)) : ([0, 1] as Vec);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.min(1, Math.max(-1, cosA))) * bend;
  const r: Vec = [dir[0] * Math.cos(a) - dir[1] * Math.sin(a), dir[0] * Math.sin(a) + dir[1] * Math.cos(a)];
  const mid = add(root, scale(r, l1));
  const end = add(root, scale(dir, d));
  return { mid, end };
}

function limb(root: Vec, l: Limb, l1: number, l2: number): LimbJoints {
  if ('a' in l) {
    const mid = add(root, scale(down(l.a), l1));
    return { root, mid, end: add(mid, scale(down(l.b), l2)) };
  }
  const target = l.from === 'root' ? add(root, l.to) : l.to;
  const { mid, end } = solveTwoBone(root, target, l1, l2, l.bend);
  return { root, mid, end };
}

/** Joint positions for a pose. The far limbs sit 3 units behind and up, for a sense of depth. */
export function skeleton(p: Pose): Skeleton {
  const hip = p.hip;
  const shoulder = add(hip, scale(up(p.torso), LEN.torso));
  const mid = scale(add(hip, shoulder), 0.5);
  // A perpendicular to the spine; the curve pushes the middle of the back out (round) or in (arch).
  const perp: Vec = [-Math.cos(rad(p.torso)), -Math.sin(rad(p.torso))];
  const spineControl = add(mid, scale(perp, (p.curve ?? 0) * 0.6));
  const chest = add(hip, scale(up(p.torso), LEN.torso - 9));
  const headAngle = p.torso + (p.head ?? 0);
  const neck = add(shoulder, scale(up(headAngle), LEN.neck));
  const head = add(neck, scale(up(headAngle), LEN.head));
  const far: Vec = [-3, -2];
  const legNear = limb(hip, p.legNear, LEN.thigh, LEN.shin);
  const legFar = limb(add(hip, far), p.legFar ?? shift(p.legNear, far), LEN.thigh, LEN.shin);
  const foot = (j: LimbJoints, deg = 0) => {
    const ground = add(j.end, [0, LEN.ankle - 2]);
    const dir: Vec = [Math.cos(rad(-deg)), Math.sin(rad(-deg))];
    return { ...j, toe: add(ground, scale(dir, LEN.foot - 4)), heel: add(ground, scale(dir, -4)) };
  };
  return {
    hip,
    shoulder,
    neck,
    head,
    spineControl,
    chest,
    torsoAngle: p.torso,
    headAngle,
    armNear: limb(shoulder, p.armNear, LEN.upperArm, LEN.forearm),
    armFar: limb(add(shoulder, far), p.armFar ?? shift(p.armNear, far), LEN.upperArm, LEN.forearm),
    legNear: foot(legNear, p.footNear),
    legFar: foot(legFar, p.footFar ?? p.footNear),
  };
}

/** The far limb copies the near one; a world target moves with the far side's offset. */
function shift(l: Limb, by: Vec): Limb {
  if ('a' in l || l.from === 'root') return l;
  return { ...l, to: add(l.to, by) };
}

/* ---------- Animation ---------- */

export interface Keyframe {
  pose: Pose;
  /** Seconds to move from the previous keyframe to this one. */
  dur: number;
  /** Seconds to hold this pose afterwards. */
  hold?: number;
  /** Cue shown while moving into this pose. */
  cue?: string;
}

export interface Motion {
  /** The first pose, then each keyframe in order; the loop returns to the first pose. */
  start: Pose;
  frames: Keyframe[];
  /** Muscles to glow while working, by body part. */
  muscles: Muscle[];
  props: Prop[];
  /** Floor mat for exercises done lying or kneeling. */
  mat?: boolean;
}

export type Muscle = 'quads' | 'glutes' | 'hamstrings' | 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'calves';

export type Prop =
  | { kind: 'dumbbell'; hands: 'both' | 'near' | 'together' }
  | { kind: 'kettlebell' }
  | { kind: 'barbell'; at: 'hands' | 'back' }
  | { kind: 'band'; anchor: Vec | 'feet'; hands: 'both' | 'together'; to?: 'knee' }
  | { kind: 'bench'; x: number; y: number; w: number }
  | { kind: 'chair'; x: number; y: number }
  | { kind: 'box'; x: number; w: number; h: number }
  | { kind: 'wall'; x: number }
  | { kind: 'bar'; x: number; y: number }
  | { kind: 'doorframe'; x: number }
  | { kind: 'cable'; x: number; y: number }
  | { kind: 'legpress' }
  | { kind: 'pulldown' };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

function lerpLimb(a: Limb, b: Limb, t: number): Limb {
  if ('a' in a && 'a' in b) return { a: lerp(a.a, b.a, t), b: lerp(a.b, b.b, t) };
  if ('to' in a && 'to' in b && (a.from ?? 'world') === (b.from ?? 'world')) return { to: lerpV(a.to, b.to, t), from: a.from, bend: t < 0.5 ? a.bend : b.bend };
  return t < 0.5 ? a : b;
}

/** Blend two poses (0 = a, 1 = b). Optional parts fall back to their defaults. */
export function blend(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: lerpV(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t),
    curve: lerp(a.curve ?? 0, b.curve ?? 0, t),
    armNear: lerpLimb(a.armNear, b.armNear, t),
    armFar: a.armFar || b.armFar ? lerpLimb(a.armFar ?? a.armNear, b.armFar ?? b.armNear, t) : undefined,
    legNear: lerpLimb(a.legNear, b.legNear, t),
    legFar: a.legFar || b.legFar ? lerpLimb(a.legFar ?? a.legNear, b.legFar ?? b.legNear, t) : undefined,
    footNear: lerp(a.footNear ?? 0, b.footNear ?? 0, t),
    footFar: a.footFar !== undefined || b.footFar !== undefined ? lerp(a.footFar ?? a.footNear ?? 0, b.footFar ?? b.footNear ?? 0, t) : undefined,
  };
}

/** Smooth start and stop, like a controlled rep. */
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

export function loopSeconds(m: Motion): number {
  return m.frames.reduce((n, f) => n + f.dur + (f.hold ?? 0), 0);
}

/** The pose, cue and effort (0 to 1, for the muscle glow) at a time within the loop. */
export function sample(m: Motion, seconds: number): { pose: Pose; cue?: string; effort: number } {
  const total = loopSeconds(m);
  let t = ((seconds % total) + total) % total;
  let prev = m.start;
  for (let i = 0; i < m.frames.length; i++) {
    const f = m.frames[i]!;
    if (t < f.dur) {
      const k = ease(t / f.dur);
      // The working half of the rep glows brightest.
      return { pose: blend(prev, f.pose, k), cue: f.cue, effort: i % 2 === 0 ? 0.35 + 0.4 * k : 0.75 - 0.4 * k };
    }
    t -= f.dur;
    if (t < (f.hold ?? 0)) return { pose: f.pose, cue: f.cue, effort: i % 2 === 0 ? 0.75 : 0.35 };
    t -= f.hold ?? 0;
    prev = f.pose;
  }
  return { pose: m.start, cue: m.frames[0]?.cue, effort: 0.35 };
}

/* ---------- Framing ---------- */

/** Width over height of every animation frame. */
export const ASPECT = 1.2;

/**
 * The view box that fits the whole motion: every pose it passes through, its props and the floor,
 * with padding, at a fixed aspect. Nothing is ever cut off and the person fills the frame.
 */
export function motionView(m: Motion, samples = 48): [number, number, number, number] {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = GROUND + 6;
  const grow = (p: Vec, r: number) => {
    x0 = Math.min(x0, p[0] - r);
    x1 = Math.max(x1, p[0] + r);
    y0 = Math.min(y0, p[1] - r);
    y1 = Math.max(y1, p[1] + r);
  };
  const total = loopSeconds(m);
  for (let i = 0; i < samples; i++) {
    const s = skeleton(sample(m, (total * i) / samples).pose);
    grow(s.hip, 16);
    grow(s.shoulder, 14);
    grow(s.head, 15);
    for (const l of [s.armNear, s.armFar]) {
      grow(l.mid, 8);
      grow(l.end, m.props.some((p) => p.kind === 'kettlebell' || p.kind === 'barbell') ? 24 : 12);
    }
    for (const l of [s.legNear, s.legFar]) {
      grow(l.mid, 9);
      grow(l.toe, 8);
      grow(l.heel, 8);
    }
  }
  for (const p of m.props) {
    if (p.kind === 'bench') (grow([p.x, p.y - 8], 2), grow([p.x + p.w, p.y], 2));
    if (p.kind === 'chair') (grow([p.x - 3, p.y - 47], 2), grow([p.x + 36, p.y], 2));
    if (p.kind === 'box') (grow([p.x, GROUND - p.h], 2), grow([p.x + p.w, GROUND], 2));
    if (p.kind === 'wall') (x0 = Math.min(x0, p.x - 4), (x1 = Math.max(x1, p.x + 18)));
    if (p.kind === 'doorframe') (x0 = Math.min(x0, p.x - 4), (x1 = Math.max(x1, p.x + 13)));
    if (p.kind === 'bar') grow([p.x, p.y - 12], 6);
    if (p.kind === 'cable') (grow([p.x, p.y - 30], 8), grow([p.x, GROUND], 8));
    if (p.kind === 'band' && p.anchor !== 'feet') grow(p.anchor, 6);
  }
  if (m.props.some((p) => p.kind === 'pulldown')) {
    const s = skeleton(m.start);
    grow([s.hip[0] + 4, s.hip[1] - 124], 8);
  }
  const pad = 8;
  x0 -= pad;
  x1 += pad;
  y0 -= pad;
  let w = x1 - x0;
  let h = y1 - y0;
  if (h < 110) (y0 -= 110 - h, (h = 110));
  if (w / h < ASPECT) {
    const extra = h * ASPECT - w;
    x0 -= extra / 2;
    w = h * ASPECT;
  } else {
    const extra = w / ASPECT - h;
    y0 -= extra; // grow upward, keeping the floor at the bottom
    h = w / ASPECT;
  }
  return [x0, y0, w, h];
}
