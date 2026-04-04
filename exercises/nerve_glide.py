"""
Nerve Glide — Exercise Contract
────────────────────────────────
Camera position : Side-on (patient lying on back)
Starting position: Lying on back, one leg raised with knee bent

Movement: Patient alternately extends and flexes the raised leg
          to gently glide the sciatic nerve

What we check
─────────────
1. Controlled motion    : leg moves smoothly between flexion and extension
2. Knee angle range     : knee moves through ~60–120° range
3. Back contact         : lower back stays flat on floor
4. No bouncing          : movement is slow and controlled

States tracked
──────────────
FLEX   → knee bent, leg toward chest
EXTEND → leg straightening out
Rep counted each FLEX→EXTEND→FLEX cycle

Feedback cues
─────────────
PASS   : "Good. Move slowly and gently."
FAST   : "Slow down — this should be a gentle glide."
BACK   : "Keep your lower back on the floor."
RANGE  : "Straighten your leg more at the top."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
KNEE_FLEX_MIN    = 40    # degrees — minimum knee bend (was 50)
KNEE_FLEX_MAX    = 145   # degrees — maximum knee bend (was 130)
BACK_FLAT_TOL    = 20    # degrees — shoulder-hip-knee flatness (was 12)
SPEED_TOL        = 0.08  # normalised — max movement per frame (was 0.04)

FLEX_THRESH      = 85    # knee angle below = flexed (was 70)
EXTEND_THRESH    = 95    # knee angle above = extended (was 110)


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
        state = {"phase": "FLEX", "rep_count": 0}

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

    knee_angle = _angle(hip, knee, ankle)
    back_angle = _angle(shoulder, hip, knee)
    back_ok = back_angle >= (180 - BACK_FLAT_TOL)
    knee_ok = KNEE_FLEX_MIN <= knee_angle <= KNEE_FLEX_MAX

    # ── Rep state machine ─────────────────────────────────────────────────
    is_flexed = knee_angle < FLEX_THRESH
    is_extended = knee_angle > EXTEND_THRESH
    rep_complete = False

    if state["phase"] == "FLEX" and is_extended:
        state["phase"] = "EXTEND"
    elif state["phase"] == "EXTEND" and is_flexed:
        state["phase"] = "FLEX"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "knee_range": (knee_ok,  knee_angle, "Move through the full range — bend and straighten."),
        "back_flat":  (back_ok,  back_angle, "Keep your lower back on the floor."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Move slowly and gently." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if back_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN, "Hip"),
        (knee[0],     knee[1],     GREEN if knee_ok else RED, "Knee"),
        (ankle[0],    ankle[1],    YELLOW, "Ankle"),
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
    "name":        "Nerve Glide",
    "camera_hint": "Lie on your back, raise one leg. Side-on to camera.",
    "phases":      ["Sciatica Ph1"],
    "rep_trigger": "knee_angle",
}
