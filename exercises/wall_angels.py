"""
Wall Angels — Exercise Contract
─────────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Standing with back against wall, arms in "goalpost" position

Movement: Patient slides arms up and down the wall while maintaining
          contact between back, head, and arms with the wall

What we check
─────────────
1. Wall contact          : back stays flat against wall
2. Arm path              : arms slide in straight vertical line
3. Elbow angle           : elbows stay bent ~90° throughout
4. No arching            : lower back doesn't lift off wall

States tracked
──────────────
DOWN   → arms at bottom position
UP     → arms at top position
Rep counted each DOWN→UP→DOWN cycle

Feedback cues
─────────────
PASS   : "Good. Keep your back flat against the wall."
ARCH   : "Press your lower back into the wall."
ELBOW  : "Keep your elbows at 90 degrees."
DRIFT  : "Keep your arms touching the wall."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
ELBOW_ANGLE_MIN  = 60    # (was 75)
ELBOW_ANGLE_MAX  = 120   # (was 105)
ARM_PATH_TOL     = 0.10  # normalised x — arm should stay in vertical line (was 0.05)
BACK_FLAT_TOL    = 18    # degrees — shoulder-hip alignment (was 10)

UP_THRESH        = 0.03  # wrist rise above shoulder to count as up (was 0.06)


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
        state = {"phase": "DOWN", "rep_count": 0}

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)
    l_elbow    = _pt(landmarks, LM.LEFT_ELBOW)
    r_elbow    = _pt(landmarks, LM.RIGHT_ELBOW)
    l_wrist    = _pt(landmarks, LM.LEFT_WRIST)
    r_wrist    = _pt(landmarks, LM.RIGHT_WRIST)

    shoulder = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]
    hip      = [(l_hip[0]+r_hip[0])/2,           (l_hip[1]+r_hip[1])/2]
    elbow    = [(l_elbow[0]+r_elbow[0])/2,         (l_elbow[1]+r_elbow[1])/2]
    wrist    = [(l_wrist[0]+r_wrist[0])/2,         (l_wrist[1]+r_wrist[1])/2]

    # Elbow angle
    elbow_angle = _angle(shoulder, elbow, wrist)
    elbow_ok = ELBOW_ANGLE_MIN <= elbow_angle <= ELBOW_ANGLE_MAX

    # Back flatness
    back_angle = _horizontal_angle(shoulder, hip)
    back_ok = back_angle <= BACK_FLAT_TOL

    # Arm path: wrist should stay near shoulder x-position
    arm_drift = abs(wrist[0] - shoulder[0])
    arm_ok = arm_drift <= ARM_PATH_TOL

    # ── Rep state machine ─────────────────────────────────────────────────
    is_up = (shoulder[1] - wrist[1]) > UP_THRESH
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
        "elbow_angle": (elbow_ok, elbow_angle, "Keep your elbows at 90 degrees."),
        "back_flat":   (back_ok,   back_angle,  "Press your lower back into the wall."),
        "arm_path":    (arm_ok,    arm_drift,   "Keep your arms touching the wall."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Keep your back flat against the wall." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN, "Shoulder"),
        (elbow[0],    elbow[1],    GREEN if elbow_ok else RED, "Elbow"),
        (wrist[0],    wrist[1],    GREEN if arm_ok else RED, "Wrist"),
        (hip[0],      hip[1],      GREEN if back_ok else RED, "Hip"),
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
    "name":        "Wall Angels",
    "camera_hint": "Stand with back against wall, side-on to camera.",
    "phases":      ["Postural Pain Ph2"],
    "rep_trigger": "arm_elevation",
}
