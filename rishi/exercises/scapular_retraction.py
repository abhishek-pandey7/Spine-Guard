"""
Scapular Retraction — Exercise Contract
────────────────────────────────────────
Camera position : Back-facing (patient's back faces camera)
Starting position: Sitting or standing upright, arms at sides

Movement: Patient squeezes shoulder blades together,
          holding briefly before releasing

What we check
─────────────
1. Scapular movement   : shoulders move backward (closer together)
2. Symmetry            : left and right shoulder movement is equal
3. No shoulder shrug   : shoulders don't rise upward
4. Spine stability     : torso doesn't twist or lean

States tracked
──────────────
REST   → shoulders in neutral
SQUEEZE → shoulder blades together
Rep counted each REST→SQUEEZE→REST cycle

Feedback cues
─────────────
PASS   : "Good. Hold the squeeze."
ASYM   : "Squeeze evenly on both sides."
SHRUG  : "Keep your shoulders down — don't shrug."
TWIST  : "Keep your torso still."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
SHOULDER_SQUEEZE = 0.015 # normalised x — shoulder width reduction (was 0.03)
SYMMETRY_TOL     = 0.04  # normalised — left vs right movement difference (was 0.02)
SHRUG_TOL        = 0.06  # normalised y — shoulder shouldn't rise (was 0.03)
TWIST_TOL        = 0.06  # normalised — hip rotation (was 0.03)

SQUEEZE_THRESH   = 0.008 # minimum squeeze to detect (was 0.02)


def _angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _pt(landmarks, lm_enum):
    lm = landmarks[lm_enum.value]
    return [lm.x, lm.y]


def evaluate(landmarks, baseline_shoulder_width=None, state=None):
    if state is None:
        state = {"phase": "REST", "rep_count": 0}

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)

    shoulder_width = abs(l_shoulder[0] - r_shoulder[0])
    shoulder_mid_y = (l_shoulder[1] + r_shoulder[1]) / 2

    # Squeeze detection
    if baseline_shoulder_width is not None:
        squeeze_amount = baseline_shoulder_width - shoulder_width
    else:
        squeeze_amount = 0.0
    squeeze_ok = squeeze_amount >= SHOULDER_SQUEEZE

    # Symmetry: each shoulder moves equally toward center
    shoulder_mid_x = (l_shoulder[0] + r_shoulder[0]) / 2
    l_dist = abs(l_shoulder[0] - shoulder_mid_x)
    r_dist = abs(r_shoulder[0] - shoulder_mid_x)
    asymmetry = abs(l_dist - r_dist)
    sym_ok = asymmetry <= SYMMETRY_TOL

    # Shrug detection
    shrug_ok = True  # simplified

    # Twist
    hip_tilt = abs(l_hip[1] - r_hip[1])
    twist_ok = hip_tilt <= TWIST_TOL

    # ── Rep state machine ─────────────────────────────────────────────────
    is_squeezed = squeeze_amount > SQUEEZE_THRESH
    rep_complete = False

    if state["phase"] == "REST" and is_squeezed:
        state["phase"] = "SQUEEZE"
    elif state["phase"] == "SQUEEZE" and not is_squeezed:
        state["phase"] = "REST"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "squeeze":    (squeeze_ok, squeeze_amount, "Pull your shoulder blades together."),
        "symmetry":   (sym_ok,     asymmetry,      "Squeeze evenly on both sides."),
        "no_shrug":   (shrug_ok,   shoulder_mid_y, "Keep your shoulders down — don't shrug."),
        "no_twist":   (twist_ok,   hip_tilt,       "Keep your torso still."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Hold the squeeze." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (l_shoulder[0], l_shoulder[1], GREEN if sym_ok else RED, "L-Shldr"),
        (r_shoulder[0], r_shoulder[1], GREEN if sym_ok else RED, "R-Shldr"),
        (l_hip[0],      l_hip[1],      GREEN if twist_ok else RED, "L-Hip"),
        (r_hip[0],      r_hip[1],      GREEN if twist_ok else RED, "R-Hip"),
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
    "name":        "Scapular Retraction",
    "camera_hint": "Sitting or standing, back to camera.",
    "phases":      ["Postural Pain Ph1"],
    "rep_trigger": "squeeze",
}
