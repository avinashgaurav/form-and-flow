import type { Exercise } from './types';

/**
 * Pilot exercise catalogue. Every entry is a DRAFT written for the pilot: cues and
 * contraindication tags must be reviewed by a qualified S&C professional before anyone else uses
 * the app (plan/18, gate G-09). The UI shows an "unreviewed" badge while reviewStatus is 'draft'.
 */

const D = 'draft' as const;

export const EXERCISES: Exercise[] = [
  // Squat
  { id: 'chair_squat', name: 'Chair squat', aliases: ['box squat', 'sit to stand'], pattern: 'squat', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Stand in front of a sturdy chair, feet shoulder-width apart', 'Sit back until you lightly touch the seat', 'Push through the whole foot to stand tall'],
    mistakes: ['Dropping onto the chair', 'Knees caving inward'] },
  { id: 'bw_squat', name: 'Bodyweight squat', aliases: ['air squat'], pattern: 'squat', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Feet shoulder-width, toes slightly out', 'Hips back and down, chest up', 'Knees track over toes', 'Stand by pushing the floor away'],
    mistakes: ['Heels lifting', 'Rounding the lower back at the bottom'] },
  { id: 'goblet_squat', name: 'Goblet squat', aliases: ['db squat'], pattern: 'squat', anyOf: ['dumbbells', 'kettlebell'], allOf: [], level: 1, tags: ['deep_knee_flexion_loaded'], loaded: true, reviewStatus: D,
    cues: ['Hold the weight at your chest, elbows down', 'Sit between your heels, chest tall', 'Drive up through mid-foot'],
    mistakes: ['Letting the weight pull you forward', 'Cutting depth to lift heavier'] },
  { id: 'leg_press', name: 'Leg press', aliases: [], pattern: 'squat', anyOf: ['machines'], allOf: [], level: 1, tags: ['deep_knee_flexion_loaded'], loaded: true, reviewStatus: D,
    cues: ['Feet flat, hip-width on the platform', 'Lower until hips start to lift, then press', 'Keep lower back against the pad'],
    mistakes: ['Locking knees hard at the top', 'Bouncing at the bottom'] },
  { id: 'back_squat', name: 'Barbell back squat', aliases: ['squat'], pattern: 'squat', anyOf: [], allOf: ['barbell', 'rack'], level: 2, tags: ['deep_knee_flexion_loaded', 'heavy', 'breath_hold'], loaded: true, reviewStatus: D,
    cues: ['Bar on upper back, grip just outside shoulders', 'Brace, then sit down between your heels', 'Keep the bar over mid-foot as you stand'],
    mistakes: ['Chest collapsing forward', 'Racking without safety pins set'] },

  // Hinge
  { id: 'glute_bridge', name: 'Glute bridge', aliases: ['hip bridge'], pattern: 'hinge', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Lie on your back, knees bent, feet flat', 'Squeeze glutes and lift hips to a straight line', 'Pause, then lower slowly'],
    mistakes: ['Arching the lower back at the top', 'Pushing through the toes'] },
  { id: 'band_good_morning', name: 'Band good morning', aliases: [], pattern: 'hinge', anyOf: ['bands'], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Band under feet and behind neck', 'Soft knees, push hips back with a flat back', 'Stand by driving hips forward'],
    mistakes: ['Rounding the back', 'Bending the knees into a squat'] },
  { id: 'db_rdl', name: 'Dumbbell Romanian deadlift', aliases: ['rdl'], pattern: 'hinge', anyOf: ['dumbbells', 'kettlebell'], allOf: [], level: 1, tags: ['heavy_hinge'], loaded: true, reviewStatus: D,
    cues: ['Weights in front of thighs, soft knees', 'Slide weights down your legs as hips go back', 'Stop when your back would round; stand tall'],
    mistakes: ['Squatting the weight down', 'Letting the weights drift away from the legs'] },
  { id: 'hip_thrust', name: 'Hip thrust', aliases: [], pattern: 'hinge', anyOf: ['dumbbells', 'barbell'], allOf: ['bench'], level: 2, tags: [], loaded: true, reviewStatus: D,
    cues: ['Upper back on the bench, weight on hips', 'Drive hips up until thighs and torso line up', 'Chin tucked, ribs down'],
    mistakes: ['Over-arching at the top', 'Feet too far away'] },
  { id: 'kb_swing', name: 'Kettlebell swing', aliases: [], pattern: 'hinge', anyOf: ['kettlebell'], allOf: [], level: 2, tags: ['heavy_hinge', 'impact'], loaded: true, reviewStatus: D,
    cues: ['Hike the bell back between the legs', 'Snap hips forward to float it to chest height', 'Arms guide, hips drive'],
    mistakes: ['Lifting with the arms', 'Squatting instead of hinging'] },
  { id: 'deadlift', name: 'Barbell deadlift', aliases: ['conventional deadlift'], pattern: 'hinge', anyOf: [], allOf: ['barbell'], level: 2, tags: ['heavy_hinge', 'heavy', 'breath_hold'], loaded: true, reviewStatus: D,
    cues: ['Bar over mid-foot, shins close', 'Brace, pull slack out of the bar', 'Push the floor away, bar stays close'],
    mistakes: ['Jerking the bar off the floor', 'Rounding the lower back'] },

  // Lunge
  { id: 'split_squat', name: 'Split squat', aliases: ['static lunge'], pattern: 'lunge', anyOf: [], allOf: [], level: 1, tags: ['knee_load'], loaded: false, reviewStatus: D,
    cues: ['Long stance, back heel up', 'Lower straight down until back knee nears the floor', 'Push through the front foot'],
    mistakes: ['Front knee collapsing inward', 'Leaning far forward'] },
  { id: 'reverse_lunge', name: 'Reverse lunge', aliases: [], pattern: 'lunge', anyOf: [], allOf: [], level: 1, tags: ['knee_load'], loaded: false, reviewStatus: D,
    cues: ['Step back and lower with control', 'Most weight on the front foot', 'Drive back to standing'],
    mistakes: ['Short steps that load the knee', 'Losing balance sideways'] },
  { id: 'step_up', name: 'Step-up', aliases: [], pattern: 'lunge', anyOf: ['bench'], allOf: [], level: 1, tags: ['knee_load'], loaded: false, reviewStatus: D,
    cues: ['Whole foot on a sturdy step', 'Stand up using the top leg', 'Lower slowly'],
    mistakes: ['Pushing off the bottom foot', 'Using an unstable surface'] },
  { id: 'db_reverse_lunge', name: 'Dumbbell reverse lunge', aliases: [], pattern: 'lunge', anyOf: ['dumbbells', 'kettlebell'], allOf: [], level: 2, tags: ['knee_load'], loaded: true, reviewStatus: D,
    cues: ['Weights at your sides', 'Step back and lower with control', 'Drive through the front heel'],
    mistakes: ['Rushing the descent', 'Letting the torso twist'] },
  { id: 'bulgarian_split_squat', name: 'Bulgarian split squat', aliases: ['rear foot elevated split squat'], pattern: 'lunge', anyOf: ['bench'], allOf: [], level: 2, tags: ['knee_load', 'deep_knee_flexion_loaded'], loaded: false, reviewStatus: D,
    cues: ['Rear foot on the bench', 'Lower straight down', 'Front foot far enough that the heel stays down'],
    mistakes: ['Stance too short', 'Bouncing off the bottom'] },

  // Horizontal push
  { id: 'wall_pushup', name: 'Wall push-up', aliases: [], pattern: 'push_h', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Hands on the wall at shoulder height', 'Body in one straight line', 'Lower chest toward the wall, press back'],
    mistakes: ['Hips sagging', 'Elbows flared straight out'] },
  { id: 'knee_pushup', name: 'Knee push-up', aliases: [], pattern: 'push_h', anyOf: [], allOf: [], level: 1, tags: ['wrist_load'], loaded: false, reviewStatus: D,
    cues: ['Knees down, hips in line with shoulders', 'Lower chest between hands', 'Press the floor away'],
    mistakes: ['Hips piking up', 'Half reps'] },
  { id: 'pushup', name: 'Push-up', aliases: [], pattern: 'push_h', anyOf: [], allOf: [], level: 2, tags: ['wrist_load'], loaded: false, reviewStatus: D,
    cues: ['Hands under shoulders, body straight', 'Elbows about 45 degrees from the body', 'Chest to just above the floor'],
    mistakes: ['Sagging hips', 'Head dropping'] },
  { id: 'band_chest_press', name: 'Band chest press', aliases: [], pattern: 'push_h', anyOf: ['bands'], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Band anchored behind you at chest height', 'Press forward until arms are straight', 'Return slowly'],
    mistakes: ['Shrugging shoulders', 'Arching the back'] },
  { id: 'db_bench_press', name: 'Dumbbell bench press', aliases: ['db press'], pattern: 'push_h', anyOf: ['dumbbells'], allOf: ['bench'], level: 1, tags: [], loaded: true, reviewStatus: D,
    cues: ['Feet planted, shoulder blades back', 'Lower dumbbells to chest level', 'Press up and slightly in'],
    mistakes: ['Bouncing weights', 'Elbows flared wide'] },
  { id: 'bench_press', name: 'Barbell bench press', aliases: ['bench'], pattern: 'push_h', anyOf: [], allOf: ['barbell', 'bench', 'rack'], level: 2, tags: ['heavy', 'breath_hold'], loaded: true, reviewStatus: D,
    cues: ['Eyes under the bar, shoulder blades pinched', 'Lower to lower chest', 'Press back over the shoulders'],
    mistakes: ['Lifting without safeties or a spotter', 'Hips lifting off the bench'] },

  // Vertical push
  { id: 'band_overhead_press', name: 'Band overhead press', aliases: [], pattern: 'push_v', anyOf: ['bands'], allOf: [], level: 1, tags: ['overhead'], loaded: false, reviewStatus: D,
    cues: ['Band under feet, handles at shoulders', 'Press straight up, ribs down', 'Lower with control'],
    mistakes: ['Leaning back', 'Shrugging'] },
  { id: 'db_shoulder_press', name: 'Dumbbell shoulder press', aliases: ['db ohp'], pattern: 'push_v', anyOf: ['dumbbells', 'kettlebell'], allOf: [], level: 1, tags: ['overhead'], loaded: true, reviewStatus: D,
    cues: ['Weights at shoulder height, palms forward or in', 'Press up, ribs down, glutes tight', 'Lower to the shoulders'],
    mistakes: ['Arching the lower back', 'Pressing forward instead of up'] },
  { id: 'pike_pushup', name: 'Pike push-up', aliases: [], pattern: 'push_v', anyOf: [], allOf: [], level: 2, tags: ['overhead', 'wrist_load'], loaded: false, reviewStatus: D,
    cues: ['Hips high, body in an upside-down V', 'Lower the top of the head toward the floor', 'Press back up'],
    mistakes: ['Hips dropping', 'Elbows flaring wide'] },

  // Horizontal pull
  { id: 'doorframe_row', name: 'Door-frame row', aliases: ['doorway row'], pattern: 'pull_h', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Only use a solid door frame or pillar you trust', 'Hold both sides, feet close, lean back with straight arms', 'Pull your chest toward the frame, squeeze shoulder blades'],
    mistakes: ['Leaning back further than you can control', 'Using a door that can swing'] },
  { id: 'band_row', name: 'Band row', aliases: ['seated band row'], pattern: 'pull_h', anyOf: ['bands'], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Band anchored in front at chest height', 'Pull elbows back, squeeze shoulder blades', 'Return slowly'],
    mistakes: ['Leaning back to finish', 'Shrugging'] },
  { id: 'db_row', name: 'One-arm dumbbell row', aliases: ['db row'], pattern: 'pull_h', anyOf: ['dumbbells', 'kettlebell'], allOf: [], level: 1, tags: [], loaded: true, reviewStatus: D,
    cues: ['Hand and knee on a bench or chair, back flat', 'Pull the weight to your hip', 'Lower until the arm is straight'],
    mistakes: ['Twisting the torso', 'Jerking the weight'] },
  { id: 'cable_row', name: 'Seated cable row', aliases: [], pattern: 'pull_h', anyOf: ['cable', 'machines'], allOf: [], level: 1, tags: [], loaded: true, reviewStatus: D,
    cues: ['Sit tall, slight knee bend', 'Pull handle to the lower ribs', 'Let shoulders reach forward on the return'],
    mistakes: ['Rocking the torso', 'Rounding the back'] },
  { id: 'barbell_row', name: 'Barbell row', aliases: ['bent over row'], pattern: 'pull_h', anyOf: [], allOf: ['barbell'], level: 2, tags: ['heavy_hinge'], loaded: true, reviewStatus: D,
    cues: ['Hinge to about 45 degrees, flat back', 'Pull the bar to the belly button', 'Lower under control'],
    mistakes: ['Standing up as you pull', 'Rounding the lower back'] },

  // Vertical pull
  { id: 'band_pulldown', name: 'Band pulldown', aliases: [], pattern: 'pull_v', anyOf: ['bands'], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Band anchored high', 'Pull elbows down to your sides', 'Control the return'],
    mistakes: ['Leaning far back', 'Shrugging toward the ears'] },
  { id: 'lat_pulldown', name: 'Lat pulldown', aliases: [], pattern: 'pull_v', anyOf: ['cable', 'machines'], allOf: [], level: 1, tags: [], loaded: true, reviewStatus: D,
    cues: ['Thighs under the pad, slightly wider than shoulder grip', 'Pull the bar to upper chest', 'Return until arms are straight'],
    mistakes: ['Pulling behind the neck', 'Swinging the body'] },
  { id: 'band_assisted_pullup', name: 'Band-assisted pull-up', aliases: [], pattern: 'pull_v', anyOf: [], allOf: ['pullup_bar', 'bands'], level: 2, tags: ['shoulder_end_range'], loaded: false, reviewStatus: D,
    cues: ['Band looped on the bar, under a knee or foot', 'Pull chest toward the bar', 'Lower all the way'],
    mistakes: ['Kipping', 'Half reps at the top only'] },
  { id: 'pullup', name: 'Pull-up', aliases: ['chin-up'], pattern: 'pull_v', anyOf: [], allOf: ['pullup_bar'], level: 3, tags: ['shoulder_end_range'], loaded: false, reviewStatus: D,
    cues: ['Hang with straight arms', 'Pull elbows down until the chin clears the bar', 'Lower with control'],
    mistakes: ['Swinging', 'Dropping fast'] },

  // Core
  { id: 'dead_bug', name: 'Dead bug', aliases: [], pattern: 'core', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['On your back, arms up, knees over hips', 'Lower opposite arm and leg slowly', 'Keep the lower back touching the floor'],
    mistakes: ['Lower back arching off the floor', 'Moving too fast'] },
  { id: 'bird_dog', name: 'Bird dog', aliases: [], pattern: 'core', anyOf: [], allOf: [], level: 1, tags: ['wrist_load'], loaded: false, reviewStatus: D,
    cues: ['Hands under shoulders, knees under hips', 'Reach opposite arm and leg long', 'Keep hips level'],
    mistakes: ['Rotating the hips', 'Arching the back'] },
  { id: 'plank', name: 'Front plank', aliases: [], pattern: 'core', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Forearms under shoulders', 'Squeeze glutes, ribs down', 'Breathe steadily'],
    mistakes: ['Hips sagging', 'Holding the breath'] },
  { id: 'side_plank', name: 'Side plank', aliases: [], pattern: 'core', anyOf: [], allOf: [], level: 2, tags: [], loaded: false, reviewStatus: D,
    cues: ['Elbow under shoulder', 'Hips lifted in a straight line', 'Knees down to make it easier'],
    mistakes: ['Hips drooping', 'Rolling forward'] },
  { id: 'pallof_press', name: 'Pallof press', aliases: ['anti-rotation press'], pattern: 'core', anyOf: ['bands', 'cable'], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Band anchored to the side at chest height', 'Press straight out and resist the twist', 'Return slowly'],
    mistakes: ['Letting the torso rotate', 'Shrugging'] },

  // Carry
  { id: 'farmer_carry', name: "Farmer's carry", aliases: ['farmer walk'], pattern: 'carry', anyOf: ['dumbbells', 'kettlebell'], allOf: [], level: 1, tags: [], loaded: true, reviewStatus: D,
    cues: ['Heavy weights at your sides', 'Walk tall with short steps', 'Shoulders down, grip hard'],
    mistakes: ['Leaning to one side', 'Shrugging'] },
  { id: 'suitcase_march', name: 'Suitcase march', aliases: [], pattern: 'carry', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Hold a dumbbell or a full bag in one hand', 'March in place, knees up', 'Stay upright; switch hands'],
    mistakes: ['Leaning toward the weight', 'Rushing'] },

  // Mobility and warm-up
  { id: 'march_in_place', name: 'March in place', aliases: [], pattern: 'mobility', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Lift knees to a comfortable height', 'Swing the arms', 'Breathe easily'], mistakes: ['Holding the breath'] },
  { id: 'cat_cow', name: 'Cat-cow', aliases: [], pattern: 'mobility', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['On hands and knees', 'Round the back, then let the belly drop', 'Move slowly with the breath'], mistakes: ['Forcing the end range'] },
  { id: 'hip_flexor_stretch', name: 'Half-kneeling hip flexor stretch', aliases: [], pattern: 'mobility', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['One knee down, other foot in front', 'Tuck the pelvis and shift forward gently', 'Hold and breathe'], mistakes: ['Arching the lower back'] },
  { id: 'arm_circles', name: 'Arm circles', aliases: [], pattern: 'mobility', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Arms out to the sides', 'Small circles growing larger', 'Reverse direction'], mistakes: ['Shrugging'] },
  { id: 'worlds_greatest_stretch', name: "World's greatest stretch", aliases: [], pattern: 'mobility', anyOf: [], allOf: [], level: 1, tags: [], loaded: false, reviewStatus: D,
    cues: ['Step into a long lunge', 'Same-side elbow toward the instep', 'Rotate and reach the arm up'], mistakes: ['Rushing through it'] },
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export const WARMUP_IDS = {
  lower: ['march_in_place', 'hip_flexor_stretch', 'worlds_greatest_stretch'],
  upper: ['march_in_place', 'arm_circles', 'cat_cow'],
  full: ['march_in_place', 'cat_cow', 'worlds_greatest_stretch'],
} as const;
