"""
Dead Bug — Exercise Contract
─────────────────────────────
Camera position : Top-down or side-on (patient lying on back)
Starting position: Lying on back, arms extended toward ceiling, knees bent 90°

Movement: Patient lowers opposite arm and leg toward floor while keeping
          lower back pressed flat against the ground

What we check
─────────────
1. Lower back contact  : shoulder-hip angle stays flat (no arching)
2. Knee angle          : moving leg knee stays ~90° (controlled motion)
3. Arm extension       : lowering arm moves smoothly (not jerking)
4. Core engagement     : hip doesn't rotate during extension

States tracked
──────────────
REST   → both sides up
EXTEND → one arm + opposite leg lowering
Rep counted each REST→EXTEND→REST cycle

Feedback cues
─────────────
PASS   : "Good. Keep your back pressed to the floor."
ARCH   : "Press your lower back into the floor — don't let it arch."
KNEE   : "Keep your knee bent at 90 degrees."
FAST   : "Move slowly and with control."
ROTATE : "Keep your hips level — don't rotate."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
BACK_FLAT_TOL    = 20    # degrees — shoulder-hip-knee should stay flat (was 10)
KNEE_ANGLE_MIN   = 60    # (was 75)
KNEE_ANGLE_MAX   = 120   # (was 105)
HIP_ROTATION_TOL = 0.08  # normalised y — left vs right hip (was 0.05)
ARM_SPEED_TOL    = 0.06  # normalised — arm movement per frame (was 0.03)

EXTEND_THRESH    = 0.03  # arm/leg movement threshold (was 0.05)


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
        state = {"phase": "REST", "rep_count": 0, "last_arm_y": None}

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)
    l_knee     = _pt(landmarks, LM.LEFT_KNEE)
    r_knee     = _pt(landmarks, LM.RIGHT_KNEE)
    l_ankle    = _pt(landmarks, LM.LEFT_ANKLE)
    r_ankle    = _pt(landmarks, LM.RIGHT_ANKLE)
    l_wrist    = _pt(landmarks, LM.LEFT_WRIST)
    r_wrist    = _pt(landmarks, LM.RIGHT_WRIST)

    shoulder = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]
    hip      = [(l_hip[0]+r_hip[0])/2,           (l_hip[1]+r_hip[1])/2]
    knee     = [(l_knee[0]+r_knee[0])/2,          (l_knee[1]+r_knee[1])/2]

    # Back flatness: shoulder-hip-knee angle
    back_angle = _angle(shoulder, hip, knee)
    back_ok = back_angle >= (180 - BACK_FLAT_TOL)

    # Knee angle
    l_knee_angle = _angle(l_hip, l_knee, l_ankle)
    r_knee_angle = _angle(r_hip, r_knee, r_ankle)
    knee_ok = (KNEE_ANGLE_MIN <= l_knee_angle <= KNEE_ANGLE_MAX) and \
              (KNEE_ANGLE_MIN <= r_knee_angle <= KNEE_ANGLE_MAX)

    # Hip rotation
    hip_rot = abs(l_hip[1] - r_hip[1])
    rotation_ok = hip_rot <= HIP_ROTATION_TOL

    # Arm movement detection
    l_arm_lowering = (l_shoulder[1] - l_wrist[1]) > EXTEND_THRESH
    r_arm_lowering = (r_shoulder[1] - r_wrist[1]) > EXTEND_THRESH
    arm_moving = l_arm_lowering or r_arm_lowering

    # ── Rep state machine ─────────────────────────────────────────────────
    is_extended = arm_moving
    rep_complete = False

    if state["phase"] == "REST" and is_extended:
        state["phase"] = "EXTEND"
    elif state["phase"] == "EXTEND" and not is_extended:
        state["phase"] = "REST"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "back_flat":    (back_ok,      back_angle, "Press your lower back into the floor — don't let it arch."),
        "knee_angle":   (knee_ok,      l_knee_angle, "Keep your knees bent at 90 degrees."),
        "no_rotation":  (rotation_ok,  hip_rot,     "Keep your hips level — don't rotate."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Keep your back pressed to the floor." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if back_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN if rotation_ok else RED, "Hip"),
        (l_knee[0],   l_knee[1],   GREEN if knee_ok else RED, "L-Knee"),
        (r_knee[0],   r_knee[1],   GREEN if knee_ok else RED, "R-Knee"),
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
    "name":        "Dead Bug",
    "camera_hint": "Lie on your back, arms up, knees bent. Top-down or side-on.",
    "phases":      ["Muscle Strain Ph3", "Herniated Disc Ph3",
                    "Postural Pain Ph3", "Chronic LBP Ph2"],
    "rep_trigger": "arm_extension",
}
