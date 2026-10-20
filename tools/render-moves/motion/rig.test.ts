/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXERCISES } from '@ff/engines';
import { MOTIONS } from './motions';
import { GROUND, LEN, loopSeconds, motionView, sample, skeleton, solveTwoBone, type Vec } from './rig';

const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const frames = (id: string, n = 40) => {
  const m = MOTIONS[id]!;
  const total = loopSeconds(m);
  return Array.from({ length: n }, (_, i) => skeleton(sample(m, (total * i) / n).pose));
};

test('every exercise in the catalogue has an animation, and nothing else does', () => {
  assert.deepEqual(Object.keys(MOTIONS).sort(), EXERCISES.map((e) => e.id).sort());
});

test('two-bone IK reaches a reachable target exactly and points at an unreachable one', () => {
  const r = solveTwoBone([0, 0], [30, 40], 30, 27, -1);
  assert.ok(Math.abs(dist(r.end, [30, 40])) < 1e-6);
  assert.ok(Math.abs(dist([0, 0], r.mid) - 30) < 1e-6);
  assert.ok(Math.abs(dist(r.mid, r.end) - 27) < 1e-6);
  const far = solveTwoBone([0, 0], [300, 0], 30, 27, 1);
  assert.ok(Math.abs(far.end[0] - 57) < 1e-3 && Math.abs(far.end[1]) < 1e-3);
});

test('bones keep their lengths in every frame of every exercise', () => {
  for (const id of Object.keys(MOTIONS)) {
    for (const s of frames(id)) {
      for (const [a, b, l] of [
        [s.legNear.root, s.legNear.mid, LEN.thigh],
        [s.legNear.mid, s.legNear.end, LEN.shin],
        [s.armNear.root, s.armNear.mid, LEN.upperArm],
        [s.armNear.mid, s.armNear.end, LEN.forearm],
        [s.hip, s.shoulder, LEN.torso],
      ] as [Vec, Vec, number][]) {
        assert.ok(Math.abs(dist(a, b) - l) < 0.6, `${id}: a bone is ${dist(a, b).toFixed(1)} instead of ${l}`);
      }
    }
  }
});

test('feet, knees and hips never go through the floor', () => {
  for (const id of Object.keys(MOTIONS)) {
    for (const s of frames(id)) {
      for (const leg of [s.legNear, s.legFar]) {
        assert.ok(leg.toe[1] <= GROUND + 3 && leg.heel[1] <= GROUND + 3, `${id}: a foot is below the floor (${Math.max(leg.toe[1], leg.heel[1]).toFixed(1)})`);
        assert.ok(leg.mid[1] <= GROUND, `${id}: a knee is below the floor`);
      }
      assert.ok(s.hip[1] <= GROUND - 8, `${id}: the hips are in the floor`);
      assert.ok(s.head[1] <= GROUND - 8, `${id}: the head is in the floor`);
    }
  }
});

test('nothing ever leaves the frame', () => {
  for (const id of Object.keys(MOTIONS)) {
    const [x, y, w, h] = motionView(MOTIONS[id]!);
    assert.ok(Math.abs(w / h - 1.2) < 1e-6);
    for (const s of frames(id)) {
      for (const p of [s.head, s.hip, s.shoulder, s.armNear.end, s.armFar.end, s.legNear.toe, s.legFar.toe, s.legNear.heel, s.legFar.heel]) {
        assert.ok(p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h, `${id}: a point at ${p.map((v) => v.toFixed(0))} is outside the frame`);
      }
    }
  }
});

test('every animation has a cue on each move, a working muscle and a sensible loop', () => {
  for (const [id, m] of Object.entries(MOTIONS)) {
    assert.ok(m.muscles.length > 0, `${id} has no muscles`);
    assert.ok(m.frames.every((f) => f.cue && f.cue.length > 5), `${id} has a move without a cue`);
    const t = loopSeconds(m);
    assert.ok(t >= 1 && t <= 12, `${id} loops in ${t.toFixed(1)} s`);
  }
});
