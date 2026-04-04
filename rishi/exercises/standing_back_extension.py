"""
Standing Back Extension — Exercise Contract
────────────────────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Standing upright, hands on lower back for support

Movement: Patient gently leans backward, extending the spine,
          then returns to neutral standing position

What we check
─────────────
1. Extension angle     : controlled backward lean (5–25°)
2. Knee stability      : knees stay straight (not bending)
3. Balance             : no excessive sway or stepping
4. Controlled return   : smooth return to neutral

States tracked
──────────────
NEUTRAL → standing straight
EXTEND  → leaning backward
Rep counted each NEUTRAL→EXTEND→NEUTRAL cycle

Feedback cues
─────────────
PASS   : "Good. Return to neutral slowly."
ANGLE  : "Lean back gently — don't overextend."
KNEE   : "Keep your legs straight."
BALANCE: "Stay balanced — don't step backward."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds ────────────────────────────────────────────────────────────────
EXTENSION_MIN    = 5     # degrees — minimum backward lean
EXTENSION_MAX    = 25    # degrees — maximum safe backward lean
KNEE_BEND_TOL    = 20    # degrees — knees should stay nearly straight
BALANCE_TOL      = 0.06  # normalised — hip sway

EXTEND_THRESH    = 3     # degrees to count as extending


def _angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _pt(landmarks, lm_enum):
    lm = landmarks[lm_enum.value]
    return [lm.x, lm.y]


def _horizontal_angle(p1, p2):
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    return float(abs(np.degrees(np.arctan2(dy, dx))))


def evaluate(landmarks, state=None):
    if state is None:
        state = {"phase": "NEUTRAL", "rep_count": 0}

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
    knee     = [(l_knee[0]+r_knee[0])/2,          (l_knee[1]+r_knee[1])/2]
    ankle    = [(l_ankle[0]+r_ankle[0])/2,         (l_ankle[1]+r_ankle[1])/2]

    # Extension: shoulder-hip line from vertical
    extension_angle = _horizontal_angle(shoulder, hip)

    # Knee straightness
    knee_angle = _angle(hip, knee, ankle)
    knee_ok = knee_angle >= (180 - KNEE_BEND_TOL)

    # Balance: hip position stability
    balance = abs(hip[0] - ankle[0])
    balance_ok = balance <= BALANCE_TOL

    # Extension range
    ext_ok = EXTENSION_MIN <= extension_angle <= EXTENSION_MAX

    # ── Rep state machine ─────────────────────────────────────────────────
    is_extending = extension_angle > EXTEND_THRESH
    rep_complete = False

    if state["phase"] == "NEUTRAL" and is_extending:
        state["phase"] = "EXTEND"
    elif state["phase"] == "EXTEND" and not is_extending:
        state["phase"] = "NEUTRAL"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "extension":  (ext_ok,    extension_angle, "Lean back gently — don't overextend."),
        "knee_straight": (knee_ok, knee_angle,     "Keep your legs straight."),
        "balance":    (balance_ok, balance,        "Stay balanced — don't step backward."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Return to neutral slowly." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if ext_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN, "Hip"),
        (knee[0],     knee[1],     GREEN if knee_ok else RED, "Knee"),
        (ankle[0],    ankle[1],    GREEN if balance_ok else RED, "Ankle"),
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
    "name":        "Standing Back Extension",
    "camera_hint": "Standing, side-on to camera. Hands on lower back.",
    "phases":      ["Herniated Disc Ph2"],
    "rep_trigger": "extension",
}
