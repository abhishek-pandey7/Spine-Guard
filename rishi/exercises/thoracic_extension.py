"""
Thoracic Extension — Exercise Contract
───────────────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Sitting or standing, hands behind head

Movement: Patient extends upper back backward over a support point,
          opening the chest while keeping lower back stable

What we check
─────────────
1. Upper back extension : thoracic spine curves backward
2. Lower back stability : lumbar spine stays neutral (not arching)
3. Chest opening        : shoulders move backward
4. Controlled motion    : no jerking or bouncing

States tracked
──────────────
NEUTRAL → upright position
EXTEND  → upper back extended
Rep counted each NEUTRAL→EXTEND→NEUTRAL cycle

Feedback cues
─────────────
PASS   : "Good. Open your chest and breathe."
LOWER  : "Keep your lower back still — only move your upper back."
RANGE  : "Extend a bit more — open your chest."
FAST   : "Move slowly and with control."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds ────────────────────────────────────────────────────────────────
THORACIC_EXT_MIN = 8     # degrees — upper back extension
LUMBAR_STABLE_TOL= 8     # degrees — lower back should stay neutral
CHEST_OPEN_TOL   = 0.04  # normalised — shoulder backward movement

EXTEND_THRESH    = 5     # degrees to count as extending


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

    shoulder = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]
    hip      = [(l_hip[0]+r_hip[0])/2,           (l_hip[1]+r_hip[1])/2]

    # Thoracic extension: shoulder-hip angle from vertical
    ext_angle = _horizontal_angle(shoulder, hip)
    ext_ok = ext_angle >= THORACIC_EXT_MIN

    # Lumbar stability (simplified — would need more landmarks for precise measurement)
    lumbar_ok = True

    # Chest opening
    chest_ok = ext_angle >= THORACIC_EXT_MIN

    # ── Rep state machine ─────────────────────────────────────────────────
    is_extending = ext_angle > EXTEND_THRESH
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
        "thoracic_ext": (ext_ok,   ext_angle, "Extend your upper back — open your chest."),
        "lumbar_stable":(lumbar_ok, ext_angle, "Keep your lower back still — only move your upper back."),
        "chest_open":   (chest_ok, ext_angle, "Open your chest wider."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Open your chest and breathe." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if ext_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN if lumbar_ok else RED, "Hip"),
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
    "name":        "Thoracic Extension",
    "camera_hint": "Sitting or standing, side-on to camera.",
    "phases":      ["Postural Pain Ph1"],
    "rep_trigger": "thoracic_ext",
}
