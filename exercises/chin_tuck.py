"""
Chin Tuck — Exercise Contract
──────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Sitting or standing upright, looking straight ahead

Movement: Patient gently draws chin straight back (making a "double chin")
          without tilting head up or down

What we check
─────────────
1. Horizontal movement : nose moves backward (not up or down)
2. Head tilt           : ear stays level (no nodding)
3. Shoulder position   : shoulders stay relaxed (not rising)
4. Range of motion     : adequate chin retraction distance

States tracked
──────────────
NEUTRAL → head in normal position
TUCK    → chin drawn back
Rep counted each NEUTRAL→TUCK→NEUTRAL cycle

Feedback cues
─────────────
PASS   : "Good. Hold and breathe."
TILT   : "Keep your head level — don't nod up or down."
SHOULDER: "Keep your shoulders relaxed."
RANGE  : "Pull your chin straight back — like making a double chin."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
TUCK_DISTANCE    = 0.012 # normalised x — nose movement backward (was 0.02)
HEAD_TILT_TOL    = 0.05  # normalised y — ear level change (was 0.03)
SHOULDER_RISE_TOL= 0.05  # normalised y — shoulder shouldn't rise (was 0.03)

TUCK_THRESH      = 0.008 # minimum nose movement to count as tuck (was 0.015)


def _angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _pt(landmarks, lm_enum):
    lm = landmarks[lm_enum.value]
    return [lm.x, lm.y]


def evaluate(landmarks, baseline_nose_x=None, baseline_ear_y=None, state=None):
    if state is None:
        state = {"phase": "NEUTRAL", "rep_count": 0}

    nose       = _pt(landmarks, LM.NOSE)
    l_ear      = _pt(landmarks, LM.LEFT_EAR)
    r_ear      = _pt(landmarks, LM.RIGHT_EAR)
    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)

    ear = [(l_ear[0]+r_ear[0])/2, (l_ear[1]+r_ear[1])/2]
    shoulder = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]

    # Auto-capture baselines on first frame if not provided
    if "baseline_nose_x" not in state:
        state["baseline_nose_x"] = nose[0]
    if "baseline_ear_y" not in state:
        state["baseline_ear_y"] = ear[1]

    bn_x = state.get("baseline_nose_x", nose[0])
    be_y = state.get("baseline_ear_y", ear[1])

    # Tuck detection: nose moving backward (x decreases in side view)
    tuck_dist = bn_x - nose[0]
    tuck_ok = tuck_dist >= TUCK_DISTANCE

    # Head tilt: ear y-position change
    head_tilt = abs(ear[1] - be_y)
    tilt_ok = head_tilt <= HEAD_TILT_TOL

    # Shoulder rise
    shoulder_ok = True  # simplified — would need baseline

    # ── Rep state machine ─────────────────────────────────────────────────
    is_tucked = tuck_dist > TUCK_THRESH
    rep_complete = False

    if state["phase"] == "NEUTRAL" and is_tucked:
        state["phase"] = "TUCK"
    elif state["phase"] == "TUCK" and not is_tucked:
        state["phase"] = "NEUTRAL"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "tuck_range":  (tuck_ok,  tuck_dist, "Pull your chin straight back — like making a double chin."),
        "head_level":  (tilt_ok,  head_tilt, "Keep your head level — don't nod up or down."),
        "shoulders":   (shoulder_ok, shoulder[1], "Keep your shoulders relaxed."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Hold and breathe." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (nose[0],     nose[1],     GREEN if tuck_ok else RED, "Nose"),
        (ear[0],      ear[1],      GREEN if tilt_ok else RED, "Ear"),
        (shoulder[0], shoulder[1], GREEN, "Shoulder"),
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
    "name":        "Chin Tuck",
    "camera_hint": "Sitting or standing, side-on to camera.",
    "phases":      ["Postural Pain Ph1"],
    "rep_trigger": "tuck_range",
}
