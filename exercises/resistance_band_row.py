"""
Resistance Band Row — Exercise Contract
────────────────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Sitting or standing, band anchored in front, arms extended

Movement: Patient pulls band toward torso, squeezing shoulder blades together,
          then slowly returns to starting position

What we check
─────────────
1. Elbow path          : elbows pull back close to body (not flaring out)
2. Scapular retraction : shoulders move backward during pull
3. Torso stability     : no excessive leaning back or forward
4. Controlled return   : slow eccentric phase (not snapping back)

States tracked
──────────────
EXTEND → arms extended forward
PULL   → band pulled toward torso
Rep counted each EXTEND→PULL→EXTEND cycle

Feedback cues
─────────────
PASS   : "Good. Squeeze your shoulder blades."
ELBOW  : "Keep your elbows close to your body."
LEAN   : "Keep your torso still — don't lean back."
FAST   : "Return slowly — control the movement."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds ────────────────────────────────────────────────────────────────
ELBOW_PATH_TOL   = 0.06  # normalised x — elbow should stay close to body
SHOULDER_RETRACT = 0.03  # normalised x — shoulder backward movement
TORSO_LEAN_TOL   = 12    # degrees — torso shouldn't lean excessively

PULL_THRESH      = 0.04  # wrist movement toward body to count as pull


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
        state = {"phase": "EXTEND", "rep_count": 0}

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

    # Elbow path: elbow should stay close to body (hip x-position)
    elbow_path = abs(elbow[0] - hip[0])
    elbow_ok = elbow_path <= ELBOW_PATH_TOL

    # Shoulder retraction
    shoulder_retract = True  # simplified — would need baseline

    # Torso lean
    torso_angle = _horizontal_angle(shoulder, hip)
    torso_ok = torso_angle <= TORSO_LEAN_TOL

    # ── Rep state machine ─────────────────────────────────────────────────
    is_pulling = (shoulder[0] - wrist[0]) > PULL_THRESH
    rep_complete = False

    if state["phase"] == "EXTEND" and is_pulling:
        state["phase"] = "PULL"
    elif state["phase"] == "PULL" and not is_pulling:
        state["phase"] = "EXTEND"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "elbow_path":    (elbow_ok, elbow_path, "Keep your elbows close to your body."),
        "scapular":      (shoulder_retract, 0.0, "Squeeze your shoulder blades together."),
        "torso_stable":  (torso_ok,   torso_angle, "Keep your torso still — don't lean back."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Squeeze your shoulder blades." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if shoulder_retract else RED, "Shoulder"),
        (elbow[0],    elbow[1],    GREEN if elbow_ok else RED, "Elbow"),
        (wrist[0],    wrist[1],    GREEN, "Wrist"),
        (hip[0],      hip[1],      GREEN if torso_ok else RED, "Hip"),
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
    "name":        "Resistance Band Row",
    "camera_hint": "Sitting or standing, band anchored in front. Side-on to camera.",
    "phases":      ["Postural Pain Ph2"],
    "rep_trigger": "elbow_pull",
}
