"""
Hamstring Stretch — Exercise Contract
───────────────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Lying on back, one leg raised, other leg flat

Movement: Patient raises one leg straight up, keeping knee extended,
          feeling stretch in the back of the thigh

What we check
─────────────
1. Leg straightness     : raised leg knee angle ≥ 160° (nearly straight)
2. Leg elevation        : ankle rises above hip by sufficient margin
3. Other leg flat       : planted leg ankle stays near floor level
4. Shoulder stability   : shoulders stay flat on ground (not lifting)

States tracked
──────────────
REST   → leg down
STRETCH → leg raised and held
Rep counted each REST→STRETCH→REST cycle

Feedback cues
─────────────
PASS   : "Good. Hold the stretch and breathe."
KNEE   : "Keep your leg straight — don't bend the knee."
LOW    : "Lift your leg higher — reach toward the ceiling."
FLAT   : "Keep your other leg flat on the floor."
LIFT   : "Keep your shoulders relaxed on the floor."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
LEG_STRAIGHT_MIN = 140   # degrees — raised leg should be nearly straight (was 160)
LEG_ELEVATION    = 0.04  # normalised y — ankle above hip (was 0.08)
PLANTED_ANKLE_Y  = 0.18  # normalised y — planted ankle should stay low (was 0.12)
SHOULDER_DRIFT_Y = 0.08  # normalised — shoulder shouldn't rise (was 0.05)

STRETCH_THRESH   = 0.03  # ankle above hip to count as stretch (was 0.06)


def _angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _pt(landmarks, lm_enum):
    lm = landmarks[lm_enum.value]
    return [lm.x, lm.y]


def evaluate(landmarks, baseline_shoulder_y=None, state=None):
    if state is None:
        state = {"phase": "REST", "rep_count": 0}

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)
    l_knee     = _pt(landmarks, LM.LEFT_KNEE)
    r_knee     = _pt(landmarks, LM.RIGHT_KNEE)
    l_ankle    = _pt(landmarks, LM.LEFT_ANKLE)
    r_ankle    = _pt(landmarks, LM.RIGHT_ANKLE)

    shoulder = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]
    hip      = [(l_hip[0]+r_hip[0])/2,           (l_hip[1]+r_hip[1])/2]

    # Detect which leg is raised (lower y = higher in image)
    l_raised = (l_hip[1] - l_ankle[1]) > LEG_ELEVATION
    r_raised = (r_hip[1] - r_ankle[1]) > LEG_ELEVATION

    if l_raised:
        raised_knee_angle = _angle(l_hip, l_knee, l_ankle)
        planted_ankle_y = r_ankle[1]
        raised_ankle = l_ankle
        raised_hip = l_hip
        raised_knee = l_knee
    elif r_raised:
        raised_knee_angle = _angle(r_hip, r_knee, r_ankle)
        planted_ankle_y = l_ankle[1]
        raised_ankle = r_ankle
        raised_hip = r_hip
        raised_knee = r_knee
    else:
        raised_knee_angle = 180.0
        planted_ankle_y = min(l_ankle[1], r_ankle[1])
        raised_ankle = l_ankle
        raised_hip = l_hip
        raised_knee = l_knee

    leg_straight = raised_knee_angle >= LEG_STRAIGHT_MIN
    planted_flat = planted_ankle_y >= PLANTED_ANKLE_Y
    shoulder_ok = (baseline_shoulder_y is None) or \
                  (abs(shoulder[1] - baseline_shoulder_y) < SHOULDER_DRIFT_Y)

    # ── Rep state machine ─────────────────────────────────────────────────
    is_stretch = (raised_hip[1] - raised_ankle[1]) > STRETCH_THRESH
    rep_complete = False

    if state["phase"] == "REST" and is_stretch:
        state["phase"] = "STRETCH"
    elif state["phase"] == "STRETCH" and not is_stretch:
        state["phase"] = "REST"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "leg_straight": (leg_straight, raised_knee_angle, "Keep your leg straight — don't bend the knee."),
        "leg_elevated": (is_stretch,  raised_ankle[1],   "Lift your leg higher — reach toward the ceiling."),
        "planted_flat": (planted_flat, planted_ankle_y,   "Keep your other leg flat on the floor."),
        "shoulder_pos": (shoulder_ok,  shoulder[1],       "Keep your shoulders relaxed on the floor."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Hold the stretch and breathe." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if shoulder_ok else RED, "Shoulder"),
        (raised_hip[0], raised_hip[1], GREEN, "Hip"),
        (raised_knee[0], raised_knee[1], GREEN if leg_straight else RED, "Knee"),
        (raised_ankle[0], raised_ankle[1], GREEN if is_stretch else RED, "Ankle"),
    ]

    return {
        "passed":       all_passed,
        "checks":       checks,
        "primary_cue":  primary_cue,
        "joint_points": joint_points,
        "state":        state,
        "rep_complete": rep_complete,
    }


META = {
    "name":        "Hamstring Stretch",
    "camera_hint": "Lie on your back, raise one leg straight. Side-on to camera.",
    "phases":      ["Muscle Strain Ph2", "Sciatica Ph2", "Facet Joint Ph1",
                    "Chronic LBP Ph2", "Spinal Stenosis Ph2"],
    "rep_trigger": "leg_elevated",
}
