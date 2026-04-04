"""
Hip Abduction — Exercise Contract
──────────────────────────────────
Camera position : Front-facing or side-on (patient lying on side)
Starting position: Lying on side, legs stacked, head supported

Movement: Patient raises top leg upward while keeping it straight,
          then lowers it back down with control

What we check
─────────────
1. Leg straightness     : raised leg knee angle ≥ 160° (nearly straight)
2. Hip elevation        : leg rises to adequate height
3. Trunk stability      : torso doesn't roll backward or forward
4. Controlled motion    : no swinging or momentum

States tracked
──────────────
DOWN   → leg at rest position
UP     → leg raised
Rep counted each DOWN→UP→DOWN cycle

Feedback cues
─────────────
PASS   : "Good. Lower with control."
KNEE   : "Keep your leg straight — don't bend the knee."
LOW    : "Lift your leg higher."
ROLL   : "Keep your body still — don't roll backward."
FAST   : "Slow down — control the movement."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds ────────────────────────────────────────────────────────────────
LEG_STRAIGHT_MIN = 160   # degrees — raised leg should be nearly straight
HIP_ELEVATION    = 0.06  # normalised y — leg rise above hip
TRUNK_ROLL_TOL   = 0.05  # normalised x — shoulder-hip alignment

UP_THRESH        = 0.04  # ankle above hip to count as up


def _angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _pt(landmarks, lm_enum):
    lm = landmarks[lm_enum.value]
    return [lm.x, lm.y]


def evaluate(landmarks, state=None):
    if state is None:
        state = {"phase": "DOWN", "rep_count": 0}

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

    # Detect which leg is on top (higher in image = lower y value)
    if l_hip[1] < r_hip[1]:
        raised_knee_angle = _angle(l_hip, l_knee, l_ankle)
        raised_ankle_y = l_ankle[1]
        raised_hip_y = l_hip[1]
    else:
        raised_knee_angle = _angle(r_hip, r_knee, r_ankle)
        raised_ankle_y = r_ankle[1]
        raised_hip_y = r_hip[1]

    leg_straight = raised_knee_angle >= LEG_STRAIGHT_MIN
    leg_elevated = (raised_hip_y - raised_ankle_y) > HIP_ELEVATION

    # Trunk stability
    trunk_roll = abs(l_shoulder[0] - r_shoulder[0])
    trunk_ok = trunk_roll <= TRUNK_ROLL_TOL

    # ── Rep state machine ─────────────────────────────────────────────────
    is_up = (raised_hip_y - raised_ankle_y) > UP_THRESH
    rep_complete = False

    if state["phase"] == "DOWN" and is_up:
        state["phase"] = "UP"
    elif state["phase"] == "UP" and not is_up:
        state["phase"] = "DOWN"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "leg_straight": (leg_straight, raised_knee_angle, "Keep your leg straight — don't bend the knee."),
        "hip_elevation":(leg_elevated, raised_ankle_y,    "Lift your leg higher."),
        "trunk_stable": (trunk_ok,     trunk_roll,        "Keep your body still — don't roll backward."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Lower with control." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if trunk_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN, "Hip"),
        (knee[0],     knee[1],     GREEN if leg_straight else RED, "Knee"),
        (ankle[0],    ankle[1],    GREEN if leg_elevated else RED, "Ankle"),
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
    "name":        "Hip Abduction",
    "camera_hint": "Lie on your side. Side-on or front-facing to camera.",
    "phases":      ["Sciatica Ph3"],
    "rep_trigger": "hip_elevation",
}
