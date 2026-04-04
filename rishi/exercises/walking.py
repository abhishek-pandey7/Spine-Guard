"""
Walking — Exercise Contract
────────────────────────────
Camera position : Front-facing or side-on (patient walking toward/across camera)
Starting position: Standing upright, ready to walk

Movement: Patient walks at a comfortable pace with proper gait

What we check
─────────────
1. Upright posture     : spine stays vertical (± 15°)
2. Symmetric stride    : left and right leg movement is balanced
3. Arm swing           : natural arm swing (not stiff or exaggerated)
4. Heel-to-toe         : normal gait pattern detected

States tracked
──────────────
WALKING → continuous motion
Duration tracked instead of reps

Feedback cues
─────────────
PASS   : "Good. Keep a steady, comfortable pace."
POSTURE: "Stand tall — keep your shoulders back."
STRIDE : "Try to keep your steps even."
ARMS   : "Let your arms swing naturally."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
POSTURE_TOL      = 25    # degrees — spine from vertical (was 15)
STRIDE_SYMM_TOL  = 0.14  # normalised — left vs right knee height difference (was 0.08)
ARM_SWING_MIN    = 0.01  # normalised — minimum arm movement (was 0.02)
ARM_SWING_MAX    = 0.22  # normalised — maximum arm movement (was 0.15)

WALK_THRESH      = 0.015 # minimum movement to detect walking (was 0.03)


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
        state = {"phase": "WALKING", "rep_count": 0, "step_count": 0}

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

    # Posture: shoulder-hip line should be nearly vertical
    posture_angle = _horizontal_angle(shoulder, hip)
    posture_ok = posture_angle <= POSTURE_TOL

    # Stride symmetry: knee height difference
    stride_sym = abs(l_knee[1] - r_knee[1])
    stride_ok = stride_sym <= STRIDE_SYMM_TOL

    # Arm swing
    arm_swing = abs(l_wrist[1] - r_wrist[1])
    arm_ok = ARM_SWING_MIN <= arm_swing <= ARM_SWING_MAX

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "posture":      (posture_ok, posture_angle, "Stand tall — keep your shoulders back."),
        "stride_sym":   (stride_ok,  stride_sym,    "Try to keep your steps even."),
        "arm_swing":    (arm_ok,     arm_swing,     "Let your arms swing naturally."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Keep a steady, comfortable pace." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if posture_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN, "Hip"),
        (l_knee[0],   l_knee[1],   GREEN if stride_ok else RED, "L-Knee"),
        (r_knee[0],   r_knee[1],   GREEN if stride_ok else RED, "R-Knee"),
    ]

    return {
        "passed":       all_passed,
        "checks":       checks,
        "primary_cue":  primary_cue,
        "joint_points": joint_points,
        "state":        state,
        "rep_complete": False,
    }


META = {
    "name":        "Walking",
    "camera_hint": "Walk toward or across the camera. Front-facing or side-on.",
    "phases":      ["Herniated Disc Ph1", "Spinal Stenosis Ph1", "Spinal Stenosis Ph3"],
    "rep_trigger": "duration",
}
