// Renders one exercise on one 3D character (plus its equipment), frame by
// frame, into the local server's ffmpeg pipe. Open /?move=bw_squat to preview;
// call window.renderMove() to write media-src/renders/<move>.mp4.
//
// Two sources of movement:
// - mixamo: a Mixamo motion-capture clip (media-src/mixamo/<move>.fbx).
// - keys: the keyframed move in motion/motions.ts. Those poses are drawn in a
//   2D side view, so each frame is mapped onto the 3D skeleton: the hips go
//   where the drawing's hips are, the spine follows the torso angle, and arms
//   and legs reach the drawing's hand and foot positions with two-bone IK.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MOTIONS, sample, skeleton, loopSeconds, GROUND, LEN } from '/motions.js';

// Tell a batch page when this move fails to load, so the batch moves on.
const fail = (e) => window.parent?.postMessage({ moveError: new URLSearchParams(location.search).get('move'), message: String(e?.message ?? e) }, location.origin);
window.addEventListener('error', (e) => fail(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => fail(e.reason));

const V = THREE.Vector3;
const Q = THREE.Quaternion;
const params = new URLSearchParams(location.search);
const MOVE = params.get('move') ?? 'bw_squat';
const CHARACTER = params.get('character') ?? 'character-remy';
// Moves whose Mixamo clip matches our cues; every other move is keyed.
const MIXAMO = new Set(['bw_squat', 'back_squat']);
const SOURCE = params.get('source') ?? (MIXAMO.has(MOVE) ? 'mixamo' : 'keys');
const MOTION = MOTIONS[MOVE];
if (SOURCE === 'keys' && !MOTION && !CUSTOM_MOVES().includes(MOVE)) throw new Error(`No motion for ${MOVE}`);

// Camera: degrees round from the front, and height. Floor work is seen from higher up.
const VIEWS = {
  wall_pushup: [105, 0.12], doorframe_row: [118, 0.12], side_plank: [8, 0.22], arm_circles: [28, 0.08],
  pallof_press: [30, 0.1], lat_pulldown: [42, 0.12], cable_row: [58, 0.16], leg_press: [70, 0.2],
  bench_press: [62, 0.3], db_bench_press: [62, 0.3], hip_thrust: [62, 0.24], db_row: [58, 0.18],
};
const FLOOR = MOTION?.mat || MOVE === 'side_plank';
const [AZ, EL] = VIEWS[MOVE] ?? (FLOOR ? [56, 0.3] : [48, 0.1]);
const AZIMUTH = THREE.MathUtils.degToRad(Number(params.get('azimuth') ?? AZ));
const ELEVATION = Number(params.get('elevation') ?? EL);
const SIZE = 720;
const FPS = 30;
const FOV = 28;
const MARGIN = 1.06;

const status = document.getElementById('status');
const say = (text) => { status.textContent = text; };

/* ---------- Scene ---------- */

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;

scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d9d9, 0.45));
const key = new THREE.DirectionalLight(0xfff6ec, 1.9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.6;
Object.assign(key.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 10, far: 2400 });
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xeef3ff, 0.9);
rim.position.set(-220, 240, -220);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 8000);

/* ---------- Character ---------- */

const bones = {};
const restLocal = new Map();
const info = {};
let metre = 1;
let k = 1; // drawing units to world units
let ankleH = 0;
let X0 = 0;
let footPitch = 0;
const restLat = { leg: 0, shoulder: 0, torso: 0 }; // half hip width, half shoulder width, hips to shoulders

const world = (bone) => (typeof bone === 'string' ? bones[bone] : bone).getWorldPosition(new V());
const SIDES = ['Left', 'Right'];
const sign = (side) => (side === 'Left' ? 1 : -1); // Left is +X: the character faces +Z

// Mixamo FBX materials are Phong; standard materials read as skin and cloth.
function toStandard(m) {
  if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
  const cutout = m.transparent || Boolean(m.alphaMap);
  return new THREE.MeshStandardMaterial({
    name: m.name, map: m.map ?? null, normalMap: m.normalMap ?? null, alphaMap: m.alphaMap ?? null,
    color: m.map ? 0xffffff : m.color, roughness: 0.72, metalness: 0, transparent: false,
    alphaTest: cutout ? 0.5 : 0, side: cutout ? THREE.DoubleSide : THREE.FrontSide,
  });
}

const TRUNK = { Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head', Head: 'HeadTop_End' };

function prepare(character) {
  character.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    o.material = Array.isArray(o.material) ? o.material.map(toStandard) : toStandard(o.material);
  });
  scene.add(character);
  character.updateMatrixWorld(true);
  // FBXLoader nests a same-named copy under some bones; the outer one is animated.
  character.traverse((o) => {
    if (!o.isBone) return;
    bones[o.name.replace(/^mixamorig\d*:?/, '')] ??= o;
    restLocal.set(o, { q: o.quaternion.clone(), p: o.position.clone() });
  });
  const toe = Math.min(world('LeftToe_End').y, world('RightToe_End').y);
  metre = (world('HeadTop_End').y - toe) / 1.78;

  // Rest directions (bone to child) and a second axis, used to aim bones.
  const child = { ...TRUNK };
  for (const s of SIDES) {
    Object.assign(child, {
      [`${s}Arm`]: `${s}ForeArm`, [`${s}ForeArm`]: `${s}Hand`, [`${s}Hand`]: `${s}HandMiddle1`,
      [`${s}UpLeg`]: `${s}Leg`, [`${s}Leg`]: `${s}Foot`, [`${s}Foot`]: `${s}ToeBase`,
    });
  }
  for (const [name, c] of Object.entries(child)) {
    const d = world(c).sub(world(name));
    // Spine and head turn from an upright frame, so the character keeps its own posture.
    const upright = name in TRUNK;
    info[name] = { dir: upright ? new V(0, 1, 0) : d.clone().normalize(), len: d.length(), side: name.endsWith('Foot') ? new V(0, 1, 0) : new V(0, 0, 1), world: bones[name].getWorldQuaternion(new Q()) };
  }
  const hipsX = world('Hips').x;
  restLat.leg = Math.abs(world('LeftUpLeg').x - hipsX);
  restLat.shoulder = Math.abs(world('LeftArm').x - hipsX);
  restLat.torso = world('LeftArm').add(world('RightArm')).multiplyScalar(0.5).distanceTo(world('LeftUpLeg').add(world('RightUpLeg')).multiplyScalar(0.5));
  const foot = info.LeftFoot.dir;
  footPitch = Math.atan2(-foot.y, foot.z);
  k = (info.LeftUpLeg.len + info.LeftLeg.len) / (LEN.thigh + LEN.shin);
  ankleH = world('LeftFoot').y;
}

function resetPose() {
  for (const [bone, r] of restLocal) {
    bone.quaternion.copy(r.q);
    bone.position.copy(r.p);
  }
  bones.Hips.parent.updateMatrixWorld(true);
}

// An orthonormal basis from a direction and a rough second axis.
function basis(dir, side) {
  const x = dir.clone().normalize();
  let y = side.clone().addScaledVector(x, -side.dot(x));
  if (y.lengthSq() < 1e-8) y = new V(0, 0, 1).addScaledVector(x, -x.z);
  if (y.lengthSq() < 1e-8) y = new V(0, 1, 0).addScaledVector(x, -x.y);
  y.normalize();
  return new THREE.Matrix4().makeBasis(x, y, new V().crossVectors(x, y));
}

// Turn a bone so its rest direction and second axis become `dir` and `side` (world space).
function orient(name, dir, side) {
  const bone = bones[name];
  const r = info[name];
  const turn = basis(dir, side).multiply(basis(r.dir, r.side).transpose());
  const q = new Q().setFromRotationMatrix(turn).multiply(r.world);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new Q()).invert().multiply(q));
  bone.updateMatrixWorld(true);
}

const chest = (d) => new V(0, -d.z, d.y); // front of the torso, for a spine direction
const front = (d) => new V(0, d.z, -d.y); // front of a straight arm or leg (kneecap side)
const perp = (a, b) => a.clone().addScaledVector(b, -a.dot(b)); // part of a that is square to unit b

// Two-bone IK in 3D: the middle joint bends toward `pole`.
function solve(rootName, target, pole) {
  const a = world(rootName);
  const l1 = info[rootName].len;
  const l2 = info[rootName.replace('UpLeg', 'Leg').replace('Arm', 'ForeArm')].len;
  const to = target.clone().sub(a);
  const d = THREE.MathUtils.clamp(to.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const dir = to.normalize();
  let p = perp(pole, dir);
  if (p.lengthSq() < 1e-8) p = perp(new V(0, 0, 1), dir);
  p.normalize();
  const angle = Math.acos(THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const mid = a.clone().addScaledVector(dir, Math.cos(angle) * l1).addScaledVector(p, Math.sin(angle) * l1);
  const end = a.clone().addScaledVector(dir, d);
  return { upper: mid.clone().sub(a).normalize(), lower: end.clone().sub(mid).normalize() };
}

function setArm(s, arm) {
  const { upper, lower } = solve(`${s}Arm`, arm.target, arm.pole);
  const bend = perp(lower, upper);
  const straight = bend.lengthSq() < 0.02;
  const upperSide = straight ? front(upper) : bend;
  const lowerSide = straight ? upperSide : perp(upper.clone().negate(), lower);
  orient(`${s}Arm`, upper, upperSide);
  orient(`${s}ForeArm`, lower, lowerSide);
  if (arm.palm) {
    // Fingers along `palm.dir` with the palm facing `palm.normal`.
    const n = arm.palm.normal;
    const side = s === 'Left' ? new V().crossVectors(n, arm.palm.dir) : new V().crossVectors(arm.palm.dir, n);
    orient(`${s}Hand`, arm.palm.dir, side);
  } else {
    orient(`${s}Hand`, lower, lowerSide);
  }
}

function setLeg(s, leg) {
  const { upper, lower } = solve(`${s}UpLeg`, leg.target, leg.pole);
  const bend = perp(lower, upper);
  const straight = bend.lengthSq() < 0.02;
  const upperSide = straight ? front(upper) : bend.negate();
  const lowerSide = straight ? upperSide : perp(upper, lower);
  orient(`${s}UpLeg`, upper, upperSide);
  orient(`${s}Leg`, lower, lowerSide);
  // The foot bone points down toward the toes at rest; tilt the heel-to-toe line to match.
  const ht = leg.foot.clone().normalize();
  const down = new V(0, -ht.z, ht.y);
  const up = down.clone().negate();
  const c = Math.cos(footPitch);
  const sn = Math.sin(footPitch);
  orient(`${s}Foot`, ht.clone().multiplyScalar(c).addScaledVector(down, sn), up.multiplyScalar(c).addScaledVector(ht, sn));
}

// Close the fingers around a handle (finger bones bend about their local X).
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
const CURL = Number(params.get('curl') ?? 1.0);
function curl(s, amount) {
  for (const f of FINGERS) {
    for (let j = 1; j <= 3; j += 1) {
      const bone = bones[`${s}Hand${f}${j}`];
      if (!bone) continue;
      bone.quaternion.copy(restLocal.get(bone).q).multiply(new Q().setFromAxisAngle(new V(1, 0, 0), amount));
      bone.updateMatrixWorld(true);
    }
  }
}

/**
 * Put the character in a 3D pose:
 * { hips, spine: [{dir, side} x3], neck, head, arms: {Left, Right}, legs: {Left, Right}, grip: [sides] }
 * arms: { target, pole, palm? }, legs: { target, pole, foot }.
 */
function apply(p) {
  resetPose();
  const pelvis = p.pelvis ?? p.spine[0];
  orient('Hips', pelvis.dir, pelvis.side);
  const mid = world('LeftUpLeg').add(world('RightUpLeg')).multiplyScalar(0.5);
  const hips = bones.Hips;
  hips.position.copy(hips.parent.worldToLocal(world(hips).add(p.hips.clone().sub(mid))));
  hips.updateMatrixWorld(true);
  ['Spine', 'Spine1', 'Spine2'].forEach((n, i) => orient(n, p.spine[i].dir, p.spine[i].side));
  orient('Neck', p.neck.dir, p.neck.side);
  orient('Head', p.head.dir, p.head.side);
  for (const s of SIDES) setLeg(s, p.legs[s]);
  for (const s of SIDES) setArm(s, p.arms[s]);
  for (const s of p.grip ?? []) curl(s, CURL);
}

/* ---------- From the 2D drawing to 3D ---------- */

const FY2 = GROUND - LEN.ankle;
// Hanging moves are raised so the feet clear the floor (metres).
const LIFT = { pullup: 0.3, band_assisted_pullup: 0.3 }[MOVE] ?? 0;
// Drawing point (x forward, y down) to world: forward is +Z, up is +Y, `lateral` is X.
const P = (v, lateral = 0) => new V(lateral, (FY2 - v[1]) * k + ankleH + LIFT * metre, (v[0] - X0) * k);
const unshift = (v) => [v[0] + 3, v[1] + 2]; // the drawing sets far limbs 3 back and 2 up for depth
const torsoDir = (deg) => new V(0, Math.cos(THREE.MathUtils.degToRad(deg)), Math.sin(THREE.MathUtils.degToRad(deg)));
const isPinned = (limb) => limb && 'to' in limb && limb.from !== 'root';

// How far from the midline the hands sit, in metres, for what they hold.
// Pressing moves: how far the elbows angle out from the body (0 tucked, 1 straight out). About
// 45 degrees, as the cues say.
const ELBOWS_OUT = { pushup: 0.9, knee_pushup: 0.9, wall_pushup: 0.9, db_bench_press: 0.9, bench_press: 0.9, pike_pushup: 0.6 }[MOVE] ?? 0;
// Romanian deadlift: the weights stay in front of the thighs (metres from the midline, and forward).
const HANDS_FRONT = { db_rdl: { spread: 0.12, forward: 0.11 } }[MOVE] ?? null;

// Band presses use both hands apart, with a strand to each hand.
const WIDE_BAND = new Set(['band_chest_press', 'band_overhead_press']);

function handSpread(m) {
  if (WIDE_BAND.has(MOVE)) return null;
  if (HANDS_FRONT) return HANDS_FRONT.spread;
  const kinds = new Set(m.props.map((p) => (p.kind === 'dumbbell' || p.kind === 'band' ? `${p.kind}:${p.hands}` : p.kind)));
  if (kinds.has('kettlebell') || kinds.has('dumbbell:together') || kinds.has('band:together') || kinds.has('cable')) return 0.07;
  if (kinds.has('bar') || kinds.has('pulldown')) return 0.38;
  if (kinds.has('doorframe')) return 0.4;
  if (kinds.has('barbell')) return 0.25;
  return null; // shoulder width
}

function from2D(m, t) {
  const pose = sample(m, t).pose;
  const s = skeleton(pose);
  const spread = handSpread(m);
  const curve = (pose.curve ?? 0) * 0.8;
  const spine = [-curve, 0, curve].map((c) => {
    const d = torsoDir(pose.torso + c);
    return { dir: d, side: chest(d) };
  });
  const hd = torsoDir(s.headAngle);
  const hipsAt = P(s.hip);
  // The drawing gives a lying body some thickness above the floor; settle the back onto the mat.
  if (pose.torso < -50) hipsAt.y -= 0.06 * metre * THREE.MathUtils.clamp((s.hip[1] - 145) / 20, 0, 1);
  // The pelvis follows the torso; only the spine above it bends, so rounding the back lifts the
  // middle of the back, not the shoulders.
  const td = torsoDir(pose.torso);
  const out = { hips: hipsAt, pelvis: { dir: td, side: chest(td) }, spine, neck: { dir: hd, side: chest(hd) }, head: { dir: hd, side: chest(hd) }, arms: {}, legs: {}, grip: [] };
  const holds = m.props.some((p) => ['dumbbell', 'kettlebell', 'barbell', 'bar', 'band', 'cable', 'pulldown', 'doorframe'].includes(p.kind));
  // Lay out the hips and spine first so the arms reach from the real shoulders.
  apply({ ...out, arms: { Left: restArm('Left'), Right: restArm('Right') }, legs: { Left: restLeg('Left'), Right: restLeg('Right') } });
  for (const side of SIDES) {
    const near = side === 'Left';
    const j = near ? s.armNear : s.armFar;
    const def = near ? pose.armNear : pose.armFar ?? pose.armNear;
    const fix = near ? (v) => v : unshift;
    const shoulder = world(`${side}Arm`);
    const lat = sign(side) * (spread !== null ? spread * metre : restLat.shoulder);
    let target;
    if (isPinned(def)) target = P(fix(j.end), lat);
    else {
      target = shoulder.clone().add(P(fix(j.end)).sub(P(fix(j.root))));
      target.x = lat;
      if (spread === null && target.y < hipsAt.y + 0.1 * metre) target.x += sign(side) * 0.04 * metre; // clear the thighs
    }
    if (HANDS_FRONT && target.y < hipsAt.y + 0.1 * metre) target.z += HANDS_FRONT.forward * metre;
    const arm = { target, pole: P(fix(j.mid)).sub(P(fix(j.root))) };
    if (ELBOWS_OUT) arm.pole.add(new V(sign(side) * ELBOWS_OUT * arm.pole.length(), 0, 0));
    if (MOVE === 'wall_pushup') arm.palm = { dir: new V(0, 1, 0), normal: new V(0, 0, 1) }; // palms flat on the wall
    if (MOVE === 'leg_press') {
      // Hands hold the handles beside the seat.
      arm.target = hipsAt.clone().add(new V(sign(side) * 0.3 * metre, 0.02 * metre, 0.1 * metre));
      arm.pole = new V(sign(side) * 0.3, 0.2, -1);
      out.grip.push(side);
    }
    if (isPinned(def) && def.to[1] >= GROUND - 8) arm.palm = { dir: new V(0, 0, 1), normal: new V(0, -1, 0) };
    out.arms[side] = arm;
    if (holds && (side === 'Left' || !m.props.some((p) => p.kind === 'dumbbell' && p.hands === 'near'))) out.grip.push(side);
  }
  for (const side of SIDES) {
    const near = side === 'Left';
    const j = near ? s.legNear : s.legFar;
    const def = near ? pose.legNear : pose.legFar ?? pose.legNear;
    const fix = near ? (v) => v : unshift;
    const lat = sign(side) * restLat.leg;
    const target = isPinned(def) ? P(fix(j.end), lat) : world(`${side}UpLeg`).add(P(fix(j.end)).sub(P(fix(j.root))));
    out.legs[side] = { target, pole: P(fix(j.mid)).sub(P(fix(j.root))), foot: P(fix(j.toe)).sub(P(fix(j.heel))) };
  }
  return out;
}

const restArm = (s) => ({ target: world(`${s}Arm`).add(new V(sign(s) * 0.05 * metre, -0.6 * metre, 0)), pole: new V(0, 0, -1) });
const restLeg = (s) => ({ target: world(`${s}UpLeg`).add(new V(0, -0.85 * metre, 0)), pole: new V(0, 0, 1), foot: new V(0, 0, 1) });

/* ---------- Moves with no 2D drawing (they happen side to side) ---------- */

function CUSTOM_MOVES() { return ['side_plank', 'arm_circles', 'plank']; }

const CUSTOM = {
  // Side plank on the left forearm, facing the camera: hips lift to a straight line. The body
  // lies along X with the head at +X, so the left side faces the floor.
  side_plank: {
    seconds: 4.6,
    pose(t) {
      const m = metre;
      const lift = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / this.seconds); // 0 low, 1 high
      const upperArm = info.LeftArm.len;
      const shoulders = new V(0, upperArm + 0.03 * m + restLat.shoulder, 0);
      const hipY = THREE.MathUtils.lerp(0.12, 0.25, lift) * m + restLat.leg;
      const hips = new V(-Math.sqrt(Math.max(restLat.torso ** 2 - (shoulders.y - hipY) ** 2, 0.01)), hipY, 0);
      const legLen = info.LeftUpLeg.len + info.LeftLeg.len;
      const footY = 0.06 * m;
      const feetX = hips.x - Math.sqrt(Math.max(legLen ** 2 - (hipY - restLat.leg - footY) ** 2, 0.01));
      const spineDir = shoulders.clone().sub(hips).normalize();
      const facing = new V(0, 0, 1);
      const seg = { dir: spineDir, side: facing };
      const base = {
        hips, spine: [seg, seg, seg], neck: seg, head: seg,
        legs: {
          Left: { target: new V(feetX, footY, 0.02 * m), pole: facing, foot: facing },
          Right: { target: new V(feetX - 0.02 * m, footY + 0.11 * m, -0.02 * m), pole: facing, foot: facing },
        },
        arms: { Left: restArm('Left'), Right: restArm('Right') },
      };
      apply(base);
      const shoulder = world('LeftArm');
      const elbow = shoulder.clone().add(new V(0, -upperArm, 0));
      base.arms = {
        Left: { target: elbow.add(new V(0, 0, info.LeftForeArm.len)), pole: new V(0, -1, -0.3), palm: { dir: facing, normal: new V(0, -1, 0) } },
        Right: { target: world('RightUpLeg').add(new V(0.04 * m, 0.06 * m, 0.06 * m)), pole: new V(0.4, 1, -0.3) },
      };
      return base;
    },
  },
  // Forearm plank: elbows under the shoulders, one straight line from shoulders to heels,
  // with a slow breath. Head toward +Z, facing the floor.
  plank: {
    seconds: 4.0,
    pose(t) {
      const m = metre;
      const breath = Math.sin((2 * Math.PI * t) / this.seconds) * 0.006 * m;
      const shoulderY = info.LeftArm.len + 0.05 * m;
      const legLen = info.LeftUpLeg.len + info.LeftLeg.len;
      const length = restLat.torso + legLen;
      const ankleY = 0.1 * m;
      const rise = Math.asin((shoulderY - ankleY) / length);
      const shoulders = new V(0, shoulderY + breath, 0);
      const ankles = new V(0, ankleY, -length * Math.cos(rise));
      const hips = ankles.clone().lerp(shoulders, legLen / length);
      const spineDir = shoulders.clone().sub(hips).normalize();
      const seg = { dir: spineDir, side: chest(spineDir) };
      const toes = new V(0, -0.85, 0.5).normalize();
      const base = {
        hips, spine: [seg, seg, seg], neck: seg, head: seg,
        legs: {
          Left: { target: ankles.clone().setX(restLat.leg), pole: new V(0, -1, 0), foot: toes },
          Right: { target: ankles.clone().setX(-restLat.leg), pole: new V(0, -1, 0), foot: toes },
        },
        arms: { Left: restArm('Left'), Right: restArm('Right') },
      };
      apply(base);
      for (const s of SIDES) {
        const sh = world(`${s}Arm`);
        const hand = new V(sh.x * 0.6, 0.05 * m, sh.z + info[`${s}ForeArm`].len * 0.95);
        base.arms[s] = { target: hand, pole: new V(0, -1, -0.4), palm: { dir: new V(-sign(s) * 0.3, 0, 1).normalize(), normal: new V(0, -1, 0) } };
      }
      return base;
    },
  },
  // Arms straight out to the sides, small circles growing larger.
  arm_circles: {
    seconds: 6.0,
    pose(t) {
      const m = metre;
      const turns = 3;
      const phase = t / this.seconds;
      // Forward for the first half, then the same circles in reverse.
      const a = phase < 0.5 ? 2 * Math.PI * turns * (phase * 2) : -2 * Math.PI * turns * ((phase - 0.5) * 2);
      const r = (0.04 + 0.08 * Math.sin(Math.PI * ((phase * 2) % 1))) * m;
      const base = standing();
      apply(base);
      for (const s of SIDES) {
        const sh = world(`${s}Arm`);
        base.arms[s] = {
          target: sh.clone().add(new V(sign(s) * 0.62 * m, r * Math.cos(a), r * Math.sin(a))),
          pole: new V(0, 0, -1),
        };
      }
      return base;
    },
  },
};

function standing() {
  const up = new V(0, 1, 0);
  const seg = { dir: up, side: new V(0, 0, 1) };
  const out = { hips: new V(0, info.LeftUpLeg.len + info.LeftLeg.len + ankleH - 0.01 * metre, 0), spine: [seg, seg, seg], neck: seg, head: seg, arms: {}, legs: {} };
  for (const s of SIDES) out.legs[s] = { target: new V(sign(s) * restLat.leg, ankleH, 0.02 * metre), pole: new V(0, 0, 1), foot: new V(0, 0, 1) };
  apply({ ...out, arms: { Left: restArm('Left'), Right: restArm('Right') } });
  for (const s of SIDES) out.arms[s] = restArm(s);
  return out;
}

/* ---------- Equipment ---------- */

const mats = {
  steel: new THREE.MeshStandardMaterial({ color: 0xa7a7a7, metalness: 0.85, roughness: 0.35 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.85 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.35, roughness: 0.55 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x262a33, roughness: 0.7 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x3b3f47, metalness: 0.5, roughness: 0.45 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xc9b79c, roughness: 0.8 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xeceff3, roughness: 0.95 }),
  band: new THREE.MeshStandardMaterial({ color: 0xd2483f, roughness: 0.6 }),
  cable: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 }),
  mat: new THREE.MeshStandardMaterial({ color: 0x5468a8, roughness: 0.9 }),
};

function solid(geometry, material, cast = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}
const box = (w, h, d, mat) => solid(new THREE.BoxGeometry(w * metre, h * metre, d * metre), mat);
const rod = (r, mat) => solid(new THREE.CylinderGeometry(r * metre, r * metre, 1, 12), mat);

// Stretch a unit-height cylinder between two world points.
function span(mesh, a, b) {
  const d = b.clone().sub(a);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.set(1, Math.max(d.length(), 1e-3), 1);
  mesh.quaternion.setFromUnitVectors(new V(0, 1, 0), d.normalize());
}

const grip = (s) => world(`${s}Hand`).lerp(world(`${s}HandMiddle1`), 0.6);
const across = (s) => new V(1, 0, 0).applyQuaternion(bones[`${s}Hand`].getWorldQuaternion(new Q()));

function barbellMesh(length = 2.2, plates = true) {
  const g = new THREE.Group();
  const bar = solid(new THREE.CylinderGeometry(0.014, 0.014, length, 16), mats.steel);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
  if (plates) {
    for (const x of [-1, 1]) {
      const plate = solid(new THREE.CylinderGeometry(0.225, 0.225, 0.05, 40), mats.rubber);
      plate.rotation.z = Math.PI / 2;
      plate.position.x = x * 0.78;
      g.add(plate);
    }
  }
  g.scale.setScalar(metre);
  return g;
}

function dumbbellMesh() {
  const g = new THREE.Group();
  const handle = solid(new THREE.CylinderGeometry(0.016, 0.016, 0.15, 12), mats.steel);
  g.add(handle);
  for (const y of [-1, 1]) {
    const head = solid(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 6), mats.iron);
    head.position.y = y * 0.11;
    g.add(head);
  }
  g.scale.setScalar(metre);
  return g;
}

function kettlebellMesh() {
  const g = new THREE.Group();
  const handle = solid(new THREE.TorusGeometry(0.065, 0.013, 12, 32), mats.iron);
  handle.position.y = -0.05;
  const bell = solid(new THREE.SphereGeometry(0.105, 32, 24), mats.iron);
  bell.position.y = -0.17;
  bell.scale.y = 0.92;
  g.add(handle, bell);
  g.scale.setScalar(metre);
  return g;
}

// Aim a group's local X along `x` and local Y along `y` at `at`.
function place(g, at, x, y) {
  const xx = x.clone().normalize();
  const yy = perp(y, xx).normalize();
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xx, yy, new V().crossVectors(xx, yy)));
  g.position.copy(at);
}

/** Build the move's equipment. Each item may move with the body (update) and adds framing points. */
function buildProps(m) {
  const items = [];
  const add = (obj, update, points) => { scene.add(obj); items.push({ obj, update, points }); };
  for (const p of m.props) {
    if (p.kind === 'dumbbell') {
      const sides = p.hands === 'near' ? ['Left'] : p.hands === 'together' ? ['mid'] : SIDES;
      for (const s of sides) {
        const d = dumbbellMesh();
        add(d, () => {
          if (s === 'mid') {
            const at = grip('Left').add(grip('Right')).multiplyScalar(0.5);
            place(d, at, grip('Right').sub(grip('Left')), new V(0, 1, 0));
          } else {
            const ax = across(s);
            place(d, grip(s), perp(new V(0, 1, 0), ax).lengthSq() > 0.01 ? perp(new V(0, 1, 0), ax) : new V(0, 0, 1), ax);
          }
        }, () => [d.position.clone()]);
      }
    }
    if (p.kind === 'kettlebell') {
      const kb = kettlebellMesh();
      add(kb, () => {
        const l = grip('Left');
        const r = grip('Right');
        const mid = l.clone().add(r).multiplyScalar(0.5);
        const sh = world('LeftArm').add(world('RightArm')).multiplyScalar(0.5);
        place(kb, mid, r.sub(l), sh.sub(mid));
      }, () => [kb.localToWorld(new V(0, -0.28, 0))]);
    }
    if (p.kind === 'barbell') {
      const bb = barbellMesh(p.at === 'hands' && m === MOTIONS.bench_press ? 2.0 : 2.2);
      add(bb, () => {
        const l = grip('Left');
        const r = grip('Right');
        place(bb, l.clone().add(r).multiplyScalar(0.5), r.sub(l), new V(0, 1, 0));
      }, () => [-1.1, 1.1].map((x) => bb.localToWorld(new V(x, 0, 0)))
        .concat([0.78, -0.78].flatMap((x) => [[0.225, 0], [-0.225, 0], [0, 0.225], [0, -0.225], [0.16, 0.16], [0.16, -0.16], [-0.16, 0.16], [-0.16, -0.16]].map(([y, z]) => bb.localToWorld(new V(x, y, z))))));
    }
    if (p.kind === 'bench') {
      const a = P([p.x, p.y]);
      const b = P([p.x + p.w, p.y]);
      const len = (b.z - a.z) / metre;
      const top = a.y;
      const g = new THREE.Group();
      g.position.x = (p.side ?? 0) * metre;
      const pad = box(0.3, 0.06, len, mats.pad);
      pad.position.set(0, top - 0.03 * metre, (a.z + b.z) / 2);
      const leg1 = box(0.06, top / metre - 0.06, 0.06, mats.frame);
      const leg2 = leg1.clone();
      leg1.position.set(0, (top - 0.06 * metre) / 2, a.z + 0.12 * metre);
      leg2.position.set(0, (top - 0.06 * metre) / 2, b.z - 0.12 * metre);
      const foot1 = box(0.36, 0.03, 0.06, mats.frame);
      const foot2 = foot1.clone();
      foot1.position.set(0, 0.015 * metre, a.z + 0.12 * metre);
      foot2.position.set(0, 0.015 * metre, b.z - 0.12 * metre);
      g.add(pad, leg1, leg2, foot1, foot2);
      const cx = (p.side ?? 0) * metre;
      add(g, null, () => [a.z + 0.12 * metre, b.z - 0.12 * metre].flatMap((z) => [-0.18, 0.18].flatMap((x) => [new V(cx + x * metre, top, z), new V(cx + x * metre, 0, z)]))
        .concat([new V(cx + 0.15 * metre, top, a.z), new V(cx - 0.15 * metre, top, b.z)]));
    }
    if (p.kind === 'chair') {
      const front = P([p.x + 36, p.y]);
      const back = P([p.x, p.y]);
      const seatY = back.y;
      const depth = (front.z - back.z) / metre;
      const g = new THREE.Group();
      const seat = box(0.46, 0.04, depth, mats.wood);
      seat.position.set(0, seatY - 0.02 * metre, (front.z + back.z) / 2);
      const rest = box(0.46, 0.42, 0.04, mats.wood);
      rest.position.set(0, seatY + 0.23 * metre, back.z - 0.02 * metre);
      g.add(seat, rest);
      for (const x of [-0.2, 0.2]) {
        for (const z of [back.z + 0.03 * metre, front.z - 0.03 * metre]) {
          const leg = box(0.035, seatY / metre - 0.04, 0.035, mats.wood);
          leg.position.set(x * metre, (seatY - 0.04 * metre) / 2, z);
          g.add(leg);
        }
      }
      add(g, null, () => [new V(0.23 * metre, seatY + 0.44 * metre, back.z), new V(-0.23 * metre, 0, front.z)]);
    }
    if (p.kind === 'box') {
      const a = P([p.x, GROUND - p.h]);
      const b = P([p.x + p.w, GROUND - p.h]);
      const h = Math.max(a.y, 0.05 * metre);
      const b3 = box(0.5, h / metre, (b.z - a.z) / metre, mats.pad);
      b3.position.set(0, h / 2, (a.z + b.z) / 2);
      add(b3, null, () => [new V(0.25 * metre, h, a.z), new V(-0.25 * metre, 0, b.z)]);
    }
    if (p.kind === 'wall') {
      const z = P([p.x, 0]).z;
      const w = solid(new THREE.BoxGeometry(1.6 * metre, 2.4 * metre, 0.1 * metre), mats.wall, false);
      w.position.set(0, 1.2 * metre, z + 0.05 * metre);
      add(w, null, () => []);
    }
    if (p.kind === 'bar') {
      const at = P([p.x, p.y]);
      const g = new THREE.Group();
      const bar = rod(0.016, mats.steel);
      span(bar, new V(-0.65 * metre, at.y, at.z), new V(0.65 * metre, at.y, at.z));
      g.add(bar);
      for (const x of [-0.65, 0.65]) {
        const post = rod(0.025, mats.frame);
        span(post, new V(x * metre, 0, at.z), new V(x * metre, at.y + 0.05 * metre, at.z));
        g.add(post);
      }
      add(g, null, () => [new V(0.4 * metre, at.y + 0.04 * metre, at.z), new V(-0.4 * metre, at.y, at.z)]);
    }
    if (p.kind === 'doorframe') {
      const z = P([p.x, 0]).z;
      const g = new THREE.Group();
      for (const x of [-0.44, 0.44]) {
        const post = box(0.08, 2.1, 0.12, mats.wood);
        post.position.set(x * metre, 1.05 * metre, z);
        g.add(post);
      }
      const head = box(0.96, 0.08, 0.12, mats.wood);
      head.position.set(0, 2.1 * metre, z);
      g.add(head);
      add(g, null, () => [new V(0.48 * metre, 0.2 * metre, z), new V(-0.48 * metre, 0.2 * metre, z)]);
    }
    if (p.kind === 'cable') {
      const at = P([p.x, p.y]);
      const g = new THREE.Group();
      const column = box(0.14, 2.0, 0.14, mats.frame);
      column.position.set(0, 1.0 * metre, at.z + 0.1 * metre);
      const line = rod(0.009, mats.cable);
      const handle = rod(0.016, mats.steel);
      g.add(column, line, handle);
      add(g, () => {
        const l = grip('Left');
        const r = grip('Right');
        const mid = l.clone().add(r).multiplyScalar(0.5);
        span(line, mid, at);
        span(handle, l.clone().addScaledVector(r.clone().sub(l), -0.4), r.clone().addScaledVector(l.clone().sub(r), -0.4));
      }, () => [new V(0, at.y, at.z + 0.17 * metre)]);
    }
    if (p.kind === 'band') {
      const NECK = MOVE === 'band_good_morning';
      const sides = p.hands === 'both' || WIDE_BAND.has(MOVE) || NECK ? SIDES : ['mid'];
      const g = new THREE.Group();
      const strands = sides.map(() => rod(0.014, mats.band));
      const necks = NECK ? SIDES.map(() => rod(0.014, mats.band)) : [];
      g.add(...necks);
      g.add(...strands);
      let anchorPoint = null;
      if (p.anchor !== 'feet') {
        anchorPoint = P(p.anchor);
        if (MOVE === 'pallof_press') anchorPoint = new V(-1.1 * metre, 0, 0); // the band pulls from the side
        const knob = solid(new THREE.SphereGeometry(0.025 * metre, 12, 8), mats.frame);
        knob.position.copy(anchorPoint);
        g.add(knob);
        g.userData.knob = knob;
      }
      add(g, () => {
        const l = grip('Left');
        const r = grip('Right');
        const ends = { Left: l, Right: r, mid: l.clone().add(r).multiplyScalar(0.5) };
        if (MOVE === 'pallof_press') {
          anchorPoint.y = ends.mid.y;
          g.userData.knob.position.copy(anchorPoint);
        }
        strands.forEach((strand, i) => {
          const s = sides[i];
          const from = p.anchor === 'feet' ? world(s === 'Right' ? 'RightFoot' : 'LeftFoot').setY(0.01 * metre) : anchorPoint;
          const to = p.to === 'knee' ? world('LeftLeg') : ends[s];
          span(strand, from, to);
        });
        if (NECK) {
          // Behind the neck: a point at the base of the neck, pushed back from the chest.
          const neck = world('Neck');
          const up = neck.clone().sub(world('Spine2')).normalize();
          const back = chest(up).negate();
          necks.forEach((strand, i) => {
            const s = SIDES[i];
            const behind = neck.clone().addScaledVector(back, 0.07 * metre).add(new V(sign(s) * 0.08 * metre, 0, 0));
            span(strand, ends[s], behind);
          });
        }
      }, () => (anchorPoint ? [anchorPoint.clone()] : []));
    }
    if (p.kind === 'legpress') {
      const g = new THREE.Group();
      const plate = box(0.62, 0.5, 0.04, mats.frame);
      const back = box(0.5, 0.75, 0.08, mats.pad);
      const seat = box(0.5, 0.08, 0.42, mats.pad);
      const base = box(0.4, 1, 0.5, mats.frame);
      const rails = [rod(0.025, mats.steel), rod(0.025, mats.steel)];
      const handles = [rod(0.016, mats.steel), rod(0.016, mats.steel)];
      g.add(plate, back, seat, base, ...rails, ...handles);
      add(g, () => {
        const feet = world('LeftFoot').add(world('RightFoot')).multiplyScalar(0.5);
        const toes = world('LeftToeBase').add(world('RightToeBase')).multiplyScalar(0.5);
        const footUp = toes.clone().sub(feet).normalize();
        const normal = perp(feet.clone().sub(world('LeftLeg')), footUp).normalize();
        place(plate, feet.clone().addScaledVector(normal, 0.08 * metre), new V(1, 0, 0), footUp);
        const spineDir = world('Spine2').sub(world('Hips')).normalize();
        const behind = chest(spineDir).negate();
        place(back, world('Hips').addScaledVector(spineDir, 0.32 * metre).addScaledVector(behind, 0.14 * metre), new V(1, 0, 0), spineDir);
        place(seat, world('Hips').addScaledVector(behind, 0.12 * metre).add(new V(0, -0.1 * metre, 0.1 * metre)), new V(1, 0, 0), behind.clone().negate());
        const seatBottom = Math.max(seat.position.y - 0.06 * metre, 0.02 * metre);
        base.scale.y = seatBottom / metre;
        base.position.set(0, seatBottom / 2, seat.position.z);
        // The sled runs on two rails from the plate down to the base.
        rails.forEach((rail, i) => {
          const x = (i ? 1 : -1) * 0.22 * metre;
          const from = plate.position.clone().setX(x).addScaledVector(normal, 0.04 * metre);
          const dir = from.clone().sub(new V(x, 0.05 * metre, seat.position.z)).normalize();
          span(rail, from.clone().addScaledVector(dir, 0.25 * metre), new V(x, 0.05 * metre, seat.position.z + 0.2 * metre));
        });
        handles.forEach((h, i) => {
          const s = i ? 'Right' : 'Left';
          const at = grip(s);
          span(h, at.clone().add(new V(sign(s) * -0.05 * metre, 0, 0)), at.clone().add(new V(sign(s) * 0.07 * metre, 0, 0)));
        });
      }, () => [plate.position.clone(), back.localToWorld(new V(0, 0.4, 0)), new V(0, 0, 0)]);
    }
    if (p.kind === 'pulldown') {
      const g = new THREE.Group();
      const seat = box(0.44, 0.08, 0.4, mats.pad);
      const knee = box(0.5, 0.1, 0.12, mats.pad);
      const column = box(0.14, 2.4, 0.14, mats.frame);
      const bar = barbellMesh(1.2, false);
      const line = rod(0.009, mats.cable);
      g.add(seat, knee, column, bar, line);
      let top = null;
      add(g, () => {
        const hips = world('Hips');
        seat.position.copy(hips).add(new V(0, -0.13 * metre, -0.02 * metre));
        seat.position.y = Math.max(seat.position.y, 0.04 * metre);
        const k2 = world('LeftLeg').add(world('RightLeg')).multiplyScalar(0.5);
        knee.position.set(0, k2.y + 0.1 * metre, k2.z - 0.02 * metre);
        column.position.set(0, 1.2 * metre, hips.z - 0.32 * metre);
        const l = grip('Left');
        const r = grip('Right');
        const mid = l.clone().add(r).multiplyScalar(0.5);
        place(bar, mid, r.sub(l), new V(0, 1, 0));
        top ??= new V(0, 2.35 * metre, mid.z);
        span(line, mid, top);
      }, () => [new V(0, 2.2 * metre, world('Hips').z), seat.position.clone()]);
    }
  }
  if (m.mat || MOVE === 'side_plank') {
    const mat = solid(new THREE.BoxGeometry(1, 0.008 * metre, 1), mats.mat, false);
    scene.add(mat);
    items.push({ obj: mat, mat: true, points: () => [] });
  }
  return items;
}

/* ---------- Load and pose ---------- */

let pose; // (t) => sets every bone and prop for time t
let duration;
let props = [];

async function load() {
  const loader = new FBXLoader();
  const character = await loader.loadAsync(`/media/${CHARACTER}.fbx`);
  prepare(character);

  if (SOURCE === 'mixamo') {
    const motion = await loader.loadAsync(`/media/${MOVE}.fbx`);
    const clip = motion.animations[0];
    if (!clip) throw new Error(`${MOVE}.fbx has no animation`);
    const mixer = new THREE.AnimationMixer(character);
    mixer.clipAction(clip).play();
    duration = clip.duration;
    const backBar = MOVE === 'back_squat' ? barbellMesh() : null;
    if (backBar) scene.add(backBar);
    props = backBar ? [{ obj: backBar, points: () => [-1.1, 1.1].map((x) => backBar.localToWorld(new V(x, 0, 0))) }] : [];
    pose = (t) => {
      mixer.setTime(t);
      character.updateMatrixWorld(true);
      if (backBar) {
        // The clip holds the hands by the ears: rest the bar on the upper back and move the hands to it.
        const x = world('RightArm').sub(world('LeftArm')).normalize();
        const neck = world('Neck');
        const y = neck.clone().sub(world('Spine2')).normalize();
        const fwd = new V().crossVectors(y, x).normalize();
        const at = neck.addScaledVector(fwd, -0.075 * metre).addScaledVector(y, -0.035 * metre);
        for (const s of SIDES) {
          const palm = at.clone().addScaledVector(x, sign(s) * -0.3 * metre);
          const target = palm.add(world(`${s}Hand`).sub(grip(s)));
          const { upper, lower } = solve(`${s}Arm`, target, world(`${s}ForeArm`).sub(world(`${s}Arm`)));
          const bend = perp(lower, upper);
          orient(`${s}Arm`, upper, bend.lengthSq() < 0.02 ? front(upper) : bend);
          orient(`${s}ForeArm`, lower, perp(upper.clone().negate(), lower));
          curl(s, CURL);
        }
        place(backBar, at, x, y);
      }
    };
    return;
  }

  const custom = CUSTOM[MOVE];
  if (custom) {
    duration = custom.seconds;
    props = buildProps({ props: [], mat: MOVE === 'side_plank' || MOVE === 'plank' });
    pose = (t) => apply(custom.pose(t));
  } else {
    duration = loopSeconds(MOTION);
    X0 = skeleton(MOTION.start).hip[0];
    props = buildProps(MOTION);
    pose = (t) => apply(from2D(MOTION, t));
  }
  const draw = pose;
  pose = (t) => {
    draw(t);
    for (const item of props) item.update?.();
  };
}

// The mat sits under the body: size it to every pose in the loop.
function fitMat(samples) {
  const item = props.find((p) => p.mat);
  if (!item) return;
  const b = new THREE.Box3().setFromPoints(samples.filter((p) => p.y < 0.5 * metre));
  const len = Math.max(b.max.z - b.min.z, b.max.x - b.min.x) + 0.3 * metre;
  const wide = MOVE === 'side_plank' ? 'x' : 'z';
  item.obj.scale.set(wide === 'x' ? len : 0.65 * metre, 1, wide === 'z' ? len : 0.65 * metre);
  item.obj.position.set((b.min.x + b.max.x) / 2, 0.004 * metre, (b.min.z + b.max.z) / 2);
}

// How far the body's surface reaches beyond each bone (metres): trunk, head, limbs.
const flesh = (boneName) => (/Hips|Spine/.test(boneName) ? 0.17 : /Head|Neck/.test(boneName) ? 0.17 : /Foot|Toe/.test(boneName) ? 0.09 : 0.07);
// Six axes plus eight diagonals, so a padded joint reaches out whichever way the camera looks.
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])))].map(([x, y, z]) => new V(x, y, z).normalize());

// Frame the whole move: project the body (each bone padded out to the skin) and every prop
// across the loop, then centre and zoom so nothing is cut off and the figure fills the frame.
function frameMove() {
  const points = [];
  for (let i = 0; i <= 24; i += 1) {
    pose((duration * i) / 24);
    bones.Hips.traverse((o) => {
      if (!o.isBone) return;
      const p = world(o);
      const r = flesh(o.name) * metre;
      for (const a of AXES) points.push(p.clone().addScaledVector(a, r));
    });
    for (const item of props) points.push(...item.points());
  }
  fitMat(points);
  const bounds = new THREE.Box3().setFromPoints(points);
  const target = bounds.getCenter(new V());
  const dir = new V(Math.sin(AZIMUTH), ELEVATION, Math.cos(AZIMUTH)).normalize();
  const half = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  let distance = bounds.getSize(new V()).length() / half;
  const right = new V();
  const up = new V();
  for (let pass = 0; pass < 4; pass += 1) {
    camera.position.copy(target).addScaledVector(dir, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    const ndc = new THREE.Box2();
    for (const p of points) {
      const v = p.clone().project(camera);
      ndc.expandByPoint(new THREE.Vector2(v.x, v.y));
    }
    const mid = ndc.getCenter(new THREE.Vector2());
    const extent = Math.max(ndc.max.x - ndc.min.x, ndc.max.y - ndc.min.y) / 2;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, mid.x * distance * half).addScaledVector(up, mid.y * distance * half);
    distance *= extent * MARGIN;
  }
  camera.position.copy(target).addScaledVector(dir, distance);
  camera.lookAt(target);
  key.target.position.copy(target);
  key.position.copy(target).add(new V(160, 320, 220).multiplyScalar(metre / 100));
}

// Embedded textures decode after the model loads; record nothing until every one is on the GPU.
async function texturesReady() {
  const textures = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) for (const t of [m.map, m.normalMap, m.alphaMap]) if (t) textures.push(t);
  });
  const ready = (t) => t.image && (!(t.image instanceof HTMLImageElement) || (t.image.complete && t.image.naturalWidth > 0));
  for (let i = 0; i < 200 && !textures.every(ready); i += 1) await fetch('/tick?ms=100');
  renderer.compile(scene, camera);
  for (let i = 0; i < 3; i += 1) renderer.render(scene, camera);
}

await load();
frameMove();
await texturesReady();
const frames = Math.max(1, Math.round(duration * FPS));
say(`${MOVE} (${SOURCE}): ${frames} frames, ${duration.toFixed(2)} s`);

let rendering = false;
const started = performance.now();
renderer.setAnimationLoop(() => {
  if (rendering) return;
  pose(((performance.now() - started) / 1000) % duration);
  renderer.render(scene, camera);
});

const post = (path, body, extra = '') => fetch(`${path}?name=${encodeURIComponent(MOVE)}&fps=${FPS}&size=${SIZE}${extra}`, { method: 'POST', body, headers: { 'X-Render': '1' } })
  .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r; });

// Read raw pixels (fast and synchronous) and send them in batches.
const gl = renderer.getContext();
const BATCH = 10;
window.renderMove = async () => {
  rendering = true;
  try {
    await post('/start');
    for (let i = 0; i < frames; i += BATCH) {
      const n = Math.min(BATCH, frames - i);
      const buf = new Uint8Array(SIZE * SIZE * 4 * n);
      for (let j = 0; j < n; j += 1) {
        pose((duration * (i + j)) / frames);
        renderer.render(scene, camera);
        gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, buf.subarray(j * SIZE * SIZE * 4, (j + 1) * SIZE * SIZE * 4));
      }
      await post('/frame', buf, `&count=${n}`);
      say(`${MOVE}: frame ${i + n} of ${frames}`);
    }
    const result = await (await post('/end')).json();
    say(`${MOVE}: done, ${result.frames} frames, ${(result.bytes / 1024).toFixed(0)} KB`);
    return result;
  } finally {
    rendering = false;
  }
};
// Quality check: across the loop, the largest gap (cm) between a hand and the floor point it
// should rest on. Anything over a few centimetres means the pose cannot reach.
window.contactReport = () => {
  if (SOURCE !== 'keys' || !MOTION || CUSTOM[MOVE]) return { move: MOVE, worst: 0 };
  let worst = 0;
  for (let i = 0; i < 60; i += 1) {
    const p = from2D(MOTION, (duration * i) / 60);
    apply(p);
    for (const s of SIDES) {
      if (!p.arms[s].palm || MOVE === 'wall_pushup') continue;
      worst = Math.max(worst, world(`${s}Hand`).distanceTo(p.arms[s].target) / metre * 100);
    }
  }
  return { move: MOVE, worst: Math.round(worst) };
};

// A batch renders many moves one after another; free this page's GPU context before the next.
window.disposeMove = () => {
  renderer.setAnimationLoop(null);
  renderer.dispose();
  renderer.forceContextLoss();
};
window.moveReady = true;
window.parent?.postMessage({ moveReady: MOVE }, location.origin);

