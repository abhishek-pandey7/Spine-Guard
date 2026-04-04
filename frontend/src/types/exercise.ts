import type { RecoveryPhase, ViolationType } from './session';

export type BackCondition =
  | 'Muscle Strain'
  | 'Sciatica'
  | 'Herniated Disc'
  | 'Postural'
  | 'Chronic'
  | 'Facet Joint'
  | 'Stenosis';

export interface ExerciseGuardConfig {
  monitoredAngles: string[];
  neutralThresholdDeg: number;
  twistThresholdZ: number;
  maxRangeOfMotion: number;
  warningMessage: string;
  stopMessage: string;
}

export interface Exercise {
  id: string;
  phase: RecoveryPhase;
  name: string;
  subtitle: string;
  description: string;
  coachCue: string;
  aiCue: string;
  clinicalPurpose: string;
  position: 'lying' | 'seated' | 'standing' | 'all-fours';
  sets: number;
  repsPerSet: number;
  holdSeconds: number;
  durationSeconds: number;
  restSeconds: number;
  guard: ExerciseGuardConfig;
  monitoredViolations: ViolationType[];
  icon: string;
  videoUrl?: string;
  cues: string[];
  aiGuardDescription: string;
  difficultyLevel: 1 | 2 | 3;
  weekRange: string;
}

export interface Phase {
  name: string;
  weeks: string;
  focus: string;
  exercises: Exercise[];
}

export const PHASES: Omit<Phase, 'exercises'>[] = [
  { name: 'Activation', weeks: 'Weeks 1–2', focus: 'Gentle mobilization and pain relief' },
  { name: 'Moderate', weeks: 'Weeks 3–6', focus: 'Controlled loading and core stability' },
  { name: 'High Intensity', weeks: 'Weeks 6–12', focus: 'Functional strength and return to activity' },
];

/**
 * FULL EXERCISE LIBRARY
 */
const EXERCISE_LIB: Record<string, Exercise> = {
  // --- MOBILITY & STRETCHING ---
  'cat-cow': {
    id: 'cat-cow', phase: 1, name: 'Cat–Cow', subtitle: 'Spinal Flow',
    description: 'On all fours, alternate between arching and rounding your back.',
    coachCue: 'Move with your breath. Inhale to arch, exhale to round.',
    aiCue: 'Tracking spinal curvature and shoulder-pelvis synchronization.',
    clinicalPurpose: 'Segmental spinal mobilization.', position: 'all-fours',
    sets: 3, repsPerSet: 10, holdSeconds: 2, durationSeconds: 60, restSeconds: 20,
    guard: { monitoredAngles: ['spine-curve'], neutralThresholdDeg: 160, twistThresholdZ: 0.05, maxRangeOfMotion: 40, warningMessage: 'Avoid sudden jerking.', stopMessage: 'Excessive twisting detected.' },
    monitoredViolations: ['TWISTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=1Y0YjXS9sKI',
    cues: ['Keep arms straight', 'Gentle movement'], aiGuardDescription: 'Spinal segment monitor', difficultyLevel: 1, weekRange: 'Phase 1'
  },
  'childs-pose': {
    id: 'childs-pose', phase: 1, name: 'Child’s Pose', subtitle: 'Lumbar Decompression',
    description: 'Sit on heels and fold forward, reaching arms out.',
    coachCue: 'Breathe into your lower back.',
    aiCue: 'Monitoring hip-to-heel proximity.',
    clinicalPurpose: 'Passive lumbar stretching.', position: 'lying',
    sets: 3, repsPerSet: 1, holdSeconds: 30, durationSeconds: 30, restSeconds: 15,
    guard: { monitoredAngles: ['hip-flexion'], neutralThresholdDeg: 45, twistThresholdZ: 0.03, maxRangeOfMotion: 10, warningMessage: 'Keep hips back.', stopMessage: 'Improper alignment.' },
    monitoredViolations: ['BENDING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=kH12QrSGedM',
    cues: ['Relax neck', 'Reach forward'], aiGuardDescription: 'Posture alignment', difficultyLevel: 1, weekRange: 'Phase 1'
  },
  'hamstring-stretch': {
    id: 'hamstring-stretch', phase: 2, name: 'Hamstring Stretch', subtitle: 'Posterior Chain',
    description: 'Lying on back, lift one leg using a strap or hands.',
    coachCue: 'Keep the opposite leg flat on the floor.',
    aiCue: 'Measuring leg-to-torso angle.',
    clinicalPurpose: 'Reduces neural tension and pelvic pull.', position: 'lying',
    sets: 3, repsPerSet: 5, holdSeconds: 15, durationSeconds: 60, restSeconds: 20,
    guard: { monitoredAngles: ['hip-angle'], neutralThresholdDeg: 90, twistThresholdZ: 0.04, maxRangeOfMotion: 100, warningMessage: 'Do not overstretch.', stopMessage: 'Aggressive stretch detected.' },
    monitoredViolations: ['LIFTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=Q4_TmIekeZ8',
    cues: ['Keep knee straight', 'Flex foot'], aiGuardDescription: 'Angle monitor', difficultyLevel: 2, weekRange: 'Phase 2'
  },
  'piriformis-stretch': {
    id: 'piriformis-stretch', phase: 1, name: 'Piriformis Stretch', subtitle: 'Deep Glute Release',
    description: 'Cross one ankle over the opposite knee and pull the thigh toward your chest.',
    coachCue: 'You should feel a stretch in your hip and glute.',
    aiCue: 'Monitoring leg crossover and pelvic stability.',
    clinicalPurpose: 'Sciatic nerve decompression.', position: 'lying',
    sets: 3, repsPerSet: 5, holdSeconds: 20, durationSeconds: 60, restSeconds: 20,
    guard: { monitoredAngles: ['hip-abduction'], neutralThresholdDeg: 45, twistThresholdZ: 0.05, maxRangeOfMotion: 60, warningMessage: 'Keep your back flat.', stopMessage: 'Excessive lumbar twisting.' },
    monitoredViolations: ['TWISTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=mT-3b4rgRzg',
    cues: ['Keep head down', 'Gentle pull'], aiGuardDescription: 'Crossover monitor', difficultyLevel: 1, weekRange: 'Phase 1'
  },

  // --- CORE ACTIVATION & STABILITY ---
  'pelvic-tilt': {
    id: 'pelvic-tilt', phase: 1, name: 'Pelvic Tilt', subtitle: 'Core Activation',
    description: 'Flatten back against floor by engaging abdominals.',
    coachCue: 'Imagine pulling your belly button to your spine.',
    aiCue: 'Monitoring lumbar-floor contact.',
    clinicalPurpose: 'Neuromuscular control of pelvis.', position: 'lying',
    sets: 3, repsPerSet: 15, holdSeconds: 5, durationSeconds: 60, restSeconds: 15,
    guard: { monitoredAngles: ['lumbar-spine'], neutralThresholdDeg: 175, twistThresholdZ: 0.02, maxRangeOfMotion: 5, warningMessage: 'Keep back flat.', stopMessage: 'Arching detected.' },
    monitoredViolations: ['BENDING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=RZi6di5IjW8',
    cues: ['Press lower back down', 'Exhale on tilt'], aiGuardDescription: 'Lumbar flat monitor', difficultyLevel: 1, weekRange: 'Phase 1'
  },
  'glute-bridge': {
    id: 'glute-bridge', phase: 2, name: 'Glute Bridge', subtitle: 'Posterior Strength',
    description: 'Lift hips off the floor until knees, hips, and shoulders form a straight line.',
    coachCue: 'Squeeze your glutes at the top.',
    aiCue: 'Monitoring hip extension angle.',
    clinicalPurpose: 'Gluteal strengthening and spinal stabilization.', position: 'lying',
    sets: 3, repsPerSet: 12, holdSeconds: 2, durationSeconds: 60, restSeconds: 30,
    guard: { monitoredAngles: ['hip-ext'], neutralThresholdDeg: 180, twistThresholdZ: 0.05, maxRangeOfMotion: 20, warningMessage: 'Do not overarch your back.', stopMessage: 'Lumbar hyperextension.' },
    monitoredViolations: ['OVER_EXTENSION'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=XLXGydU5DdU',
    cues: ['Drive through heels', 'Keep core tight'], aiGuardDescription: 'Hip extension tracker', difficultyLevel: 2, weekRange: 'Phase 2'
  },
  'bird-dog': {
    id: 'bird-dog', phase: 2, name: 'Bird Dog', subtitle: 'Anti-Rotation',
    description: 'Opposite arm and leg extension on all fours.',
    coachCue: 'Keep your back as flat as a tabletop.',
    aiCue: 'Tracking shoulder-pelvis horizontal plane.',
    clinicalPurpose: 'Core and multifidus stability.', position: 'all-fours',
    sets: 3, repsPerSet: 8, holdSeconds: 3, durationSeconds: 60, restSeconds: 30,
    guard: { monitoredAngles: ['shoulder-hip-line'], neutralThresholdDeg: 165, twistThresholdZ: 0.06, maxRangeOfMotion: 15, warningMessage: 'Do not twist hips.', stopMessage: 'Pelvic rotation detected.' },
    monitoredViolations: ['TWISTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=ZdAHe9_HeEw',
    cues: ['Reach long', 'Hips square to floor'], aiGuardDescription: 'Rotational stabilizer', difficultyLevel: 2, weekRange: 'Phase 2'
  },
  'dead-bug': {
    id: 'dead-bug', phase: 3, name: 'Dead Bug', subtitle: 'Lumbar Stability',
    description: 'Lying on back, slowly lower opposite arm and leg while maintaining back contact.',
    coachCue: 'The goal is to NOT let your back move at all.',
    aiCue: 'Monitoring lumbar-floor contact during limb movement.',
    clinicalPurpose: 'Dynamic core stability.', position: 'lying',
    sets: 3, repsPerSet: 10, holdSeconds: 0, durationSeconds: 60, restSeconds: 30,
    guard: { monitoredAngles: ['lumbar-arch'], neutralThresholdDeg: 180, twistThresholdZ: 0.03, maxRangeOfMotion: 5, warningMessage: 'Back is lifting.', stopMessage: 'Loss of core control.' },
    monitoredViolations: ['BENDING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=o4GKiEoYClI',
    cues: ['Slow and controlled', 'Breathe normally'], aiGuardDescription: 'Arch detector', difficultyLevel: 3, weekRange: 'Phase 3'
  },
  'plank': {
    id: 'plank', phase: 3, name: 'Plank', subtitle: 'Isometric Strength',
    description: 'Hold a push-up position on forearms.',
    coachCue: 'Stay in a straight line from head to heels.',
    aiCue: 'Measuring hip-torso alignment.',
    clinicalPurpose: 'Global core endurance.', position: 'lying',
    sets: 3, repsPerSet: 1, holdSeconds: 30, durationSeconds: 30, restSeconds: 30,
    guard: { monitoredAngles: ['hip-alignment'], neutralThresholdDeg: 170, twistThresholdZ: 0.05, maxRangeOfMotion: 10, warningMessage: 'Hips are sagging.', stopMessage: 'Lumbar strain risk.' },
    monitoredViolations: ['BENDING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=pvIjsG5Svck',
    cues: ['Squeeze glutes', 'Keep neck neutral'], aiGuardDescription: 'Sagging detector', difficultyLevel: 3, weekRange: 'Phase 3'
  },

  // --- REHAB MOVEMENTS ---
  'mckenzie-press': {
    id: 'mckenzie-press', phase: 1, name: 'McKenzie Press-up', subtitle: 'Centralization',
    description: 'Lying face down, push up your upper body while keeping hips down.',
    coachCue: 'Let your lower back sag into the stretch.',
    aiCue: 'Monitoring lumbar extension vs hip lift.',
    clinicalPurpose: 'Disc centralization.', position: 'lying',
    sets: 3, repsPerSet: 10, holdSeconds: 2, durationSeconds: 45, restSeconds: 20,
    guard: { monitoredAngles: ['spine-ext'], neutralThresholdDeg: 160, twistThresholdZ: 0.04, maxRangeOfMotion: 40, warningMessage: 'Keep hips on floor.', stopMessage: 'Hips lifted.' },
    monitoredViolations: ['LIFTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=D0p1kUfrYs4',
    cues: ['Keep hips heavy', 'Arms do the work'], aiGuardDescription: 'Extension stabilizer', difficultyLevel: 1, weekRange: 'Phase 1'
  },
  'nerve-glide': {
    id: 'nerve-glide', phase: 1, name: 'Nerve Glide', subtitle: 'Sciatic Flossing',
    description: 'Seated, straighten leg while looking up, flex foot while looking down.',
    coachCue: 'Move gently. Only a slight pull should be felt.',
    aiCue: 'Tracking head-to-toe coordination.',
    clinicalPurpose: 'Desensitizes the sciatic nerve.', position: 'seated',
    sets: 2, repsPerSet: 10, holdSeconds: 1, durationSeconds: 45, restSeconds: 20,
    guard: { monitoredAngles: ['knee-ankle-neck'], neutralThresholdDeg: 150, twistThresholdZ: 0.05, maxRangeOfMotion: 90, warningMessage: 'Slow down.', stopMessage: 'Aggressive flossing.' },
    monitoredViolations: ['OVER_EXTENSION'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=NLGduAw_hB8',
    cues: ['Point toes', 'Flex toes'], aiGuardDescription: 'Tension monitor', difficultyLevel: 1, weekRange: 'Phase 1'
  },
  'walking': {
    id: 'walking', phase: 1, name: 'Walking', subtitle: 'Low Impact Cardio',
    description: 'Walk at a steady, comfortable pace.',
    coachCue: 'Keep an upright posture and let arms swing naturally.',
    aiCue: 'Monitoring stride symmetry and upright torso.',
    clinicalPurpose: 'General mobility and circulation.', position: 'standing',
    sets: 1, repsPerSet: 1, holdSeconds: 600, durationSeconds: 600, restSeconds: 0,
    guard: { monitoredAngles: ['torso-lean'], neutralThresholdDeg: 180, twistThresholdZ: 0.05, maxRangeOfMotion: 10, warningMessage: 'Stand up straighter.', stopMessage: 'Excessive leaning.' },
    monitoredViolations: ['BENDING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=AdqrTg_hpEQ',
    cues: ['Small steps', 'Soft landing'], aiGuardDescription: 'Gait monitor', difficultyLevel: 1, weekRange: 'Phase 1'
  },
  'standing-ext': {
    id: 'standing-ext', phase: 2, name: 'Standing Extension', subtitle: 'Disc Pressure Relief',
    description: 'Hands on lower back, gently lean backwards.',
    coachCue: 'Move slowly; only go as far as comfortable.',
    aiCue: 'Monitoring degrees of spinal extension.',
    clinicalPurpose: 'Relieves anterior disc pressure.', position: 'standing',
    sets: 3, repsPerSet: 10, holdSeconds: 3, durationSeconds: 60, restSeconds: 15,
    guard: { monitoredAngles: ['lumbar-ext'], neutralThresholdDeg: 180, twistThresholdZ: 0.04, maxRangeOfMotion: 30, warningMessage: 'Stop if pain occurs.', stopMessage: 'Excessive extension.' },
    monitoredViolations: ['OVER_EXTENSION'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=TpIL3IvBk8k',
    cues: ['Support your back', 'Breathe'], aiGuardDescription: 'Extension tracker', difficultyLevel: 2, weekRange: 'Phase 2'
  },

  // --- POSTURE CORRECTION ---
  'chin-tuck': {
    id: 'chin-tuck', phase: 1, name: 'Chin Tuck', subtitle: 'Cervical Alignment',
    description: 'Retract head backwards without tilting chin up or down.',
    coachCue: 'Imagine making a double chin.',
    aiCue: 'Tracking ear-to-shoulder vertical alignment.',
    clinicalPurpose: 'Corrects forward head posture.', position: 'seated',
    sets: 3, repsPerSet: 12, holdSeconds: 3, durationSeconds: 30, restSeconds: 10,
    guard: { monitoredAngles: ['neck-alignment'], neutralThresholdDeg: 180, twistThresholdZ: 0.02, maxRangeOfMotion: 10, warningMessage: 'Do not tilt head.', stopMessage: 'Shear force risk.' },
    monitoredViolations: ['TWISTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=H0TWk06p5s4',
    cues: ['Pull head straight back', 'Eyes forward'], aiGuardDescription: 'Cervical guard', difficultyLevel: 1, weekRange: 'Phase 1'
  },
  'wall-angels': {
    id: 'wall-angels', phase: 2, name: 'Wall Angels', subtitle: 'Thoracic Opening',
    description: 'Back against wall, slide arms up and down in a W-shape.',
    coachCue: 'Keep your elbows and wrists touching the wall.',
    aiCue: 'Tracking shoulder-elbow-wrist plane.',
    clinicalPurpose: 'Thoracic mobility and scapular control.', position: 'standing',
    sets: 3, repsPerSet: 10, holdSeconds: 0, durationSeconds: 60, restSeconds: 30,
    guard: { monitoredAngles: ['arm-plane'], neutralThresholdDeg: 170, twistThresholdZ: 0.1, maxRangeOfMotion: 180, warningMessage: 'Keep arms back.', stopMessage: 'Compensation detected.' },
    monitoredViolations: ['LIFTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=cvx06snMQ3A',
    cues: ['Lower back against wall', 'Slow slide'], aiGuardDescription: 'Scapular plane monitor', difficultyLevel: 2, weekRange: 'Phase 2'
  },
  'scapular-retraction': {
    id: 'scapular-retraction', phase: 1, name: 'Scapular Retraction', subtitle: 'Shoulder Blade Squeeze',
    description: 'Squeeze shoulder blades together and down.',
    coachCue: 'Imagine holding a pencil between your shoulder blades.',
    aiCue: 'Monitoring lateral scapular movement.',
    clinicalPurpose: 'Strengthens rhomboids and mid-traps.', position: 'seated',
    sets: 3, repsPerSet: 15, holdSeconds: 5, durationSeconds: 60, restSeconds: 15,
    guard: { monitoredAngles: ['shoulder-pull'], neutralThresholdDeg: 180, twistThresholdZ: 0.05, maxRangeOfMotion: 15, warningMessage: 'Do not shrug shoulders.', stopMessage: 'Trapezius compensation.' },
    monitoredViolations: ['LIFTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=hJffqKmfnfA',
    cues: ['Shoulders down', 'Gentle squeeze'], aiGuardDescription: 'Scapular monitor', difficultyLevel: 1, weekRange: 'Phase 1'
  },
  'thoracic-ext': {
    id: 'thoracic-ext', phase: 1, name: 'Thoracic Extension', subtitle: 'Upper Back Opening',
    description: 'Seated or over a foam roller, lean back to open the upper chest.',
    coachCue: 'Focus the movement on your upper back, not your neck.',
    aiCue: 'Measuring upper thoracic curve changes.',
    clinicalPurpose: 'Reduces kyphosis and improves breathing.', position: 'seated',
    sets: 3, repsPerSet: 5, holdSeconds: 10, durationSeconds: 60, restSeconds: 20,
    guard: { monitoredAngles: ['thoracic-angle'], neutralThresholdDeg: 160, twistThresholdZ: 0.05, maxRangeOfMotion: 30, warningMessage: 'Support your neck.', stopMessage: 'Neck strain detected.' },
    monitoredViolations: ['OVER_EXTENSION'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=ojCkd6_VdNk',
    cues: ['Hands behind head', 'Open elbows'], aiGuardDescription: 'Upper back tracker', difficultyLevel: 1, weekRange: 'Phase 1'
  },
  'band-row': {
    id: 'band-row', phase: 2, name: 'Resistance Row', subtitle: 'Postural Strength',
    description: 'Pull resistance bands toward your hips while squeezing shoulder blades.',
    coachCue: 'Keep your elbows close to your body.',
    aiCue: 'Monitoring arm pull-back vs torso stability.',
    clinicalPurpose: 'Dynamic postural strengthening.', position: 'standing',
    sets: 3, repsPerSet: 12, holdSeconds: 1, durationSeconds: 60, restSeconds: 30,
    guard: { monitoredAngles: ['elbow-angle'], neutralThresholdDeg: 90, twistThresholdZ: 0.05, maxRangeOfMotion: 120, warningMessage: 'Do not lean back.', stopMessage: 'Torso swinging.' },
    monitoredViolations: ['TWISTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=whSXi-EXbqI',
    cues: ['Tall spine', 'Slow return'], aiGuardDescription: 'Torso stabilizer', difficultyLevel: 2, weekRange: 'Phase 2'
  },

  // --- FUNCTIONAL STRENGTH (Phase 3) ---
  'squat': {
    id: 'squat', phase: 3, name: 'Supported Squat', subtitle: 'Lower Body Strength',
    description: 'Lower hips as if sitting in a chair, keeping back straight.',
    coachCue: 'Keep your weight in your heels.',
    aiCue: 'Tracking hip-knee depth and spine angle.',
    clinicalPurpose: 'Functional lower body integration.', position: 'standing',
    sets: 3, repsPerSet: 12, holdSeconds: 0, durationSeconds: 60, restSeconds: 45,
    guard: { monitoredAngles: ['knee-angle', 'hip-angle'], neutralThresholdDeg: 180, twistThresholdZ: 0.08, maxRangeOfMotion: 90, warningMessage: 'Don\'t let knees cave in.', stopMessage: 'Knee shear risk.' },
    monitoredViolations: ['BENDING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=xqvCmoLULNY',
    cues: ['Chest up', 'Knees over toes'], aiGuardDescription: 'Squat depth monitor', difficultyLevel: 3, weekRange: 'Phase 3'
  },
  'lunge': {
    id: 'lunge', phase: 3, name: 'Reverse Lunge', subtitle: 'Balance & Stability',
    description: 'Step back with one leg and lower hips.',
    coachCue: 'Maintain a 90-degree angle with both knees.',
    aiCue: 'Monitoring balance and knee-hip verticality.',
    clinicalPurpose: 'Single-leg stability and gait prep.', position: 'standing',
    sets: 3, repsPerSet: 10, holdSeconds: 0, durationSeconds: 60, restSeconds: 45,
    guard: { monitoredAngles: ['knee-angle'], neutralThresholdDeg: 180, twistThresholdZ: 0.1, maxRangeOfMotion: 90, warningMessage: 'Steady your balance.', stopMessage: 'Loss of balance.' },
    monitoredViolations: ['TWISTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=tQNktxPkSeE',
    cues: ['Stay upright', 'Push back strongly'], aiGuardDescription: 'Lunge balance tracker', difficultyLevel: 3, weekRange: 'Phase 3'
  },
  'hip-abduction': {
    id: 'hip-abduction', phase: 3, name: 'Hip Abduction', subtitle: 'Lateral Stability',
    description: 'Stand tall and lift one leg out to the side.',
    coachCue: 'Keep your toes pointing forward, not up.',
    aiCue: 'Measuring lateral hip range.',
    clinicalPurpose: 'Gluteus medius strengthening.', position: 'standing',
    sets: 3, repsPerSet: 15, holdSeconds: 2, durationSeconds: 60, restSeconds: 20,
    guard: { monitoredAngles: ['hip-lat-angle'], neutralThresholdDeg: 180, twistThresholdZ: 0.05, maxRangeOfMotion: 45, warningMessage: 'Don\'t lean your torso.', stopMessage: 'Lateral compensation.' },
    monitoredViolations: ['TWISTING'], icon: '', videoUrl: 'https://www.youtube.com/watch?v=g9FtnmsIYgI',
    cues: ['Hold onto a wall', 'Core tight'], aiGuardDescription: 'Lateral hip monitor', difficultyLevel: 3, weekRange: 'Phase 3'
  }
};

/**
 * CONDITION PROGRAM MAPPING
 */
export const CONDITION_PROGRAMS: Record<BackCondition, { p1: string[], p2: string[], p3: string[] }> = {
  'Muscle Strain': {
    p1: ['pelvic-tilt', 'cat-cow', 'childs-pose'],
    p2: ['glute-bridge', 'bird-dog', 'hamstring-stretch'],
    p3: ['dead-bug', 'plank', 'squat']
  },
  'Sciatica': {
    p1: ['pelvic-tilt', 'piriformis-stretch', 'nerve-glide'],
    p2: ['glute-bridge', 'bird-dog', 'hamstring-stretch'],
    p3: ['plank', 'hip-abduction', 'lunge']
  },
  'Herniated Disc': {
    p1: ['mckenzie-press', 'walking', 'pelvic-tilt'],
    p2: ['bird-dog', 'glute-bridge', 'standing-ext'],
    p3: ['dead-bug', 'plank', 'squat']
  },
  'Postural': {
    p1: ['chin-tuck', 'scapular-retraction', 'thoracic-ext'],
    p2: ['wall-angels', 'band-row', 'childs-pose'],
    p3: ['plank', 'bird-dog', 'lunge']
  },
  'Chronic': {
    p1: ['pelvic-tilt', 'bird-dog', 'glute-bridge'],
    p2: ['dead-bug', 'hamstring-stretch', 'squat'],
    p3: ['plank', 'lunge', 'glute-bridge']
  },
  'Facet Joint': {
    p1: ['pelvic-tilt', 'childs-pose', 'hamstring-stretch'],
    p2: ['cat-cow', 'glute-bridge', 'bird-dog'],
    p3: ['plank', 'squat', 'lunge']
  },
  'Stenosis': {
    p1: ['childs-pose', 'pelvic-tilt', 'walking'],
    p2: ['glute-bridge', 'hamstring-stretch', 'squat'],
    p3: ['walking', 'lunge', 'plank']
  },
};

/**
 * Resolves the exercise IDs for a specific condition into full Phase objects.
 */
export const getPhasesByCondition = (condition: BackCondition): Phase[] => {
  const ids = CONDITION_PROGRAMS[condition];

  const resolve = (list: string[], pNum: RecoveryPhase) =>
    list.map(id => {
      const exercise = EXERCISE_LIB[id];
      if (!exercise) {
        console.warn(`Exercise ID "${id}" not found in library. Falling back to pelvic-tilt.`);
        return { ...EXERCISE_LIB['pelvic-tilt'], phase: pNum };
      }
      return { ...exercise, phase: pNum };
    });

  return [
    {
      name: 'Activation',
      weeks: 'Weeks 1–2',
      focus: 'Gentle mobilization and pain relief',
      exercises: resolve(ids.p1, 1)
    },
    {
      name: 'Moderate',
      weeks: 'Weeks 3–6',
      focus: 'Controlled loading and core stability',
      exercises: resolve(ids.p2, 2)
    },
    {
      name: 'High Intensity',
      weeks: 'Weeks 6–12',
      focus: 'Functional strength and return to activity',
      exercises: resolve(ids.p3, 3)
    },
  ];
};