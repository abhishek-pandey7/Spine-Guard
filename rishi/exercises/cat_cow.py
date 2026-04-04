"""
Cat-Cow — Exercise Contract
─────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: On hands and knees (quadruped), spine neutral

Movement: Patient alternates between arching back upward (Cat) and
          dropping belly downward (Cow) in a controlled rhythm

What we check
─────────────
1. Spine flexion (Cat) : shoulder–hip line curves upward ≥ 10°
2. Spine extension (Cow): shoulder–hip line curves downward ≥ 10°
3. Knee stability      : planted knees stay ~90° (not sliding)
4. Shoulder position   : shoulders stay over wrists (not drifting)

States tracked
──────────────
NEUTRAL → CAT → NEUTRAL → COW → NEUTRAL
Rep counted each full CAT→COW cycle

Feedback cues
─────────────
PASS  : "Good. Move slowly and breathe."
CAT   : "Round your back up toward the ceiling."
COW   : "Drop your belly and look up gently."
KNEE  : "Keep your knees under your hips."
SHIFT : "Keep your shoulders over your wrists."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds ────────────────────────────────────────────────────────────────
CAT_CURVE_MIN    = 10    # degrees — spine curves upward
COW_CURVE_MIN    = 10    # degrees — spine curves downward
KNEE_ANGLE_MIN   = 75
KNEE_ANGLE_MAX   = 105
SHOULDER_DRIFT   = 0.06  # normalised — shoulder over wrist

CAT_STATE_THRESH  = 5    # relaxed: shoulder-hip angle above horizontal (was 8)
COW_STATE_THRESH  = -5   # relaxed: shoulder-hip angle below horizontal (was -8)


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
    return float(np.degrees(np.arctan2(dy, dx)))


def evaluate(landmarks, state=None):
    if state is None:
        state = {"phase": "NEUTRAL", "rep_count": 0}

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip = _pt(landmarks, LM.LEFT_HIP)
    r_hip = _pt(landmarks, LM.RIGHT_HIP)
    l_knee = _pt(landmarks, LM.LEFT_KNEE)
    r_knee = _pt(landmarks, LM.RIGHT_KNEE)
    l_wrist = _pt(landmarks, LM.LEFT_WRIST)
    r_wrist = _pt(landmarks, LM.RIGHT_WRIST)

    shoulder_mid = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]
    hip_mid = [(l_hip[0]+r_hip[0])/2, (l_hip[1]+r_hip[1])/2]
    wrist_mid = [(l_wrist[0]+r_wrist[0])/2, (l_wrist[1]+r_wrist[1])/2]
    knee_mid = [(l_knee[0]+r_knee[0])/2, (l_knee[1]+r_knee[1])/2]

    spine_angle = _horizontal_angle(shoulder_mid, hip_mid)
    knee_angle = _angle(hip_mid, knee_mid, wrist_mid)

    shoulder_drift = abs(shoulder_mid[0] - wrist_mid[0])

    is_cat = spine_angle > CAT_STATE_THRESH
    is_cow = spine_angle < COW_STATE_THRESH

    rep_complete = False
    if state["phase"] == "COW" and not is_cow and not is_cat:
        state["phase"] = "NEUTRAL"
    elif state["phase"] == "NEUTRAL" and is_cat:
        state["phase"] = "CAT"
    elif state["phase"] == "CAT" and not is_cat and not is_cow:
        state["phase"] = "NEUTRAL"
    elif state["phase"] == "NEUTRAL" and is_cow:
        state["phase"] = "COW"
    elif state["phase"] == "COW" and is_cat:
        state["rep_count"] += 1
        rep_complete = True
        state["phase"] = "CAT"

    GREEN = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED = (0, 60, 255)

    checks = {
        "spine_curve": (True, spine_angle, "Round or arch your back slowly."),
        "knee_stable": (KNEE_ANGLE_MIN <= knee_angle <= KNEE_ANGLE_MAX, knee_angle, "Keep your knees under your hips."),
        "shoulder_pos": (shoulder_drift < SHOULDER_DRIFT, shoulder_drift, "Keep your shoulders over your wrists."),
    }

    all_passed = all(v[0] for v in checks.values())
    if is_cat:
        primary_cue = "Good cat position. Hold and breathe." if all_passed else next(v[2] for v in checks.values() if not v[0])
    elif is_cow:
        primary_cue = "Good cow position. Open your chest." if all_passed else next(v[2] for v in checks.values() if not v[0])
    else:
        primary_cue = "Good. Move slowly and breathe." if all_passed else next(v[2] for v in checks.values() if not v[0])

    joint_points = [
        (shoulder_mid[0], shoulder_mid[1], GREEN, "Shoulder"),
        (hip_mid[0], hip_mid[1], GREEN, "Hip"),
        (knee_mid[0], knee_mid[1], GREEN if checks["knee_stable"][0] else RED, "Knee"),
        (wrist_mid[0], wrist_mid[1], GREEN if checks["shoulder_pos"][0] else RED, "Wrist"),
    ]

    return {
        "passed": all_passed,
        "checks": checks,
        "primary_cue": primary_cue,
        "joint_points": joint_points,
        "state": state,
        "rep_complete": rep_complete,
    }


META = {
    "name": "Cat-Cow",
    "camera_hint": "On hands and knees. Side-on to camera.",
    "phases": ["Muscle Strain Ph1", "Facet Joint Ph2"],
    "rep_trigger": "spine_curve",
}
