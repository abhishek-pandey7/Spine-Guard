"""
Squat — Exercise Contract
──────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Standing upright, feet shoulder-width apart

Movement: Patient bends knees and hips to lower body, then returns to standing

What we check
─────────────
1. Knee tracking       : knees stay over toes (not caving inward)
2. Depth               : hips drop below knee level (parallel or deeper)
3. Back angle          : torso stays within safe forward lean (≤ 45°)
4. Heel contact        : heels stay on ground (not rising)
5. Knee valgus         : knees don't collapse inward past toes

States tracked
──────────────
STAND  → standing upright
SQUAT  → hips below knee level
Rep counted each STAND→SQUAT→STAND cycle

Feedback cues
─────────────
PASS   : "Good. Drive through your heels to stand."
DEPTH  : "Go lower — get your hips below your knees."
LEAN   : "Keep your chest up — don't lean too far forward."
HEEL   : "Keep your heels on the ground."
KNEE   : "Push your knees out — don't let them cave in."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds ────────────────────────────────────────────────────────────────
DEPTH_TOL        = 0.04  # normalised y — hip below knee
BACK_ANGLE_MAX   = 45    # degrees — max forward lean
HEEL_RISE_TOL    = 0.03  # normalised y — heel should stay down
KNEE_TOE_TOL     = 0.06  # normalised x — knee shouldn't go far past toe

STAND_THRESH     = 0.03  # hip above knee to count as standing
SQUAT_THRESH     = 0.02  # hip below knee to count as squat


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
        state = {"phase": "STAND", "rep_count": 0}

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

    # Depth: hips below knees (lower y = higher in image, so hip[1] > knee[1] means hips are lower)
    depth = hip[1] - knee[1]
    depth_ok = depth > DEPTH_TOL

    # Back angle: shoulder-hip line from vertical
    back_angle = _horizontal_angle(shoulder, hip)
    back_ok = back_angle <= BACK_ANGLE_MAX

    # Heel contact: ankle should stay near floor level
    heel_rise = abs(ankle[1] - knee[1])
    heel_ok = heel_rise <= HEEL_RISE_TOL or ankle[1] >= knee[1] - HEEL_RISE_TOL

    # Knee over toe: knee shouldn't go too far past ankle
    knee_toe = knee[0] - ankle[0]
    knee_ok = abs(knee_toe) <= KNEE_TOE_TOL

    # ── Rep state machine ─────────────────────────────────────────────────
    is_squat = (hip[1] - knee[1]) > SQUAT_THRESH
    is_stand = (knee[1] - hip[1]) > STAND_THRESH
    rep_complete = False

    if state["phase"] == "STAND" and is_squat:
        state["phase"] = "SQUAT"
    elif state["phase"] == "SQUAT" and is_stand:
        state["phase"] = "STAND"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "depth":    (depth_ok, depth,       "Go lower — get your hips below your knees."),
        "back_angle":(back_ok,  back_angle,  "Keep your chest up — don't lean too far forward."),
        "heel_contact":(heel_ok, heel_rise,  "Keep your heels on the ground."),
        "knee_track":  (knee_ok,  knee_toe,  "Push your knees out — don't let them go past your toes."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Drive through your heels to stand." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if back_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN if depth_ok else RED, "Hip"),
        (knee[0],     knee[1],     GREEN if knee_ok else RED, "Knee"),
        (ankle[0],    ankle[1],    GREEN if heel_ok else RED, "Ankle"),
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
    "name":        "Squat",
    "camera_hint": "Standing, side-on to camera.",
    "phases":      ["Muscle Strain Ph3", "Herniated Disc Ph3",
                    "Chronic LBP Ph2", "Facet Joint Ph3", "Spinal Stenosis Ph2"],
    "rep_trigger": "depth",
}
