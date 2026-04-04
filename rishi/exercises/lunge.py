"""
Lunge — Exercise Contract
──────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Standing upright, feet together

Movement: Patient steps forward with one leg, lowering hips until
          both knees are bent at approximately 90°, then pushes back

What we check
─────────────
1. Front knee angle    : ~90° at bottom of lunge
2. Back knee angle     : ~90° at bottom of lunge
3. Torso upright       : torso stays relatively vertical (± 20°)
4. Knee tracking       : front knee stays over ankle (not past toes)
5. Balance             : no excessive sway or stepping

States tracked
──────────────
STAND  → standing upright
LUNGE  → both knees bent ~90°
Rep counted each STAND→LUNGE→STAND cycle

Feedback cues
─────────────
PASS   : "Good. Push back to standing."
DEPTH  : "Lower until both knees are at 90 degrees."
LEAN   : "Keep your chest up — don't lean forward."
KNEE   : "Keep your front knee over your ankle."
BALANCE: "Stay balanced — control the movement."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds ────────────────────────────────────────────────────────────────
FRONT_KNEE_MIN   = 75
FRONT_KNEE_MAX   = 105
BACK_KNEE_MIN    = 75
BACK_KNEE_MAX    = 105
TORSO_LEAN_TOL   = 20    # degrees — max forward lean
KNEE_OVER_TOE_TOL= 0.06  # normalised x — knee shouldn't go far past ankle
BALANCE_TOL      = 0.08  # normalised — hip sway

LUNGE_THRESH     = 0.05  # hip drop to count as lunge


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

    # Knee angles
    l_knee_angle = _angle(l_hip, l_knee, l_ankle)
    r_knee_angle = _angle(r_hip, r_knee, r_ankle)

    # Front knee: the one with ankle further forward (higher x)
    if l_ankle[0] > r_ankle[0]:
        front_knee_angle = l_knee_angle
        back_knee_angle = r_knee_angle
        front_ankle = l_ankle
        front_knee = l_knee
    else:
        front_knee_angle = r_knee_angle
        back_knee_angle = l_knee_angle
        front_ankle = r_ankle
        front_knee = r_knee

    front_knee_ok = FRONT_KNEE_MIN <= front_knee_angle <= FRONT_KNEE_MAX
    back_knee_ok = BACK_KNEE_MIN <= back_knee_angle <= BACK_KNEE_MAX

    # Torso lean
    torso_angle = _horizontal_angle(shoulder, hip)
    torso_ok = torso_angle <= TORSO_LEAN_TOL

    # Knee over toe
    knee_toe = abs(front_knee[0] - front_ankle[0])
    knee_ok = knee_toe <= KNEE_OVER_TOE_TOL

    # Balance
    balance = abs(hip[0] - ankle[0])
    balance_ok = balance <= BALANCE_TOL

    # ── Rep state machine ─────────────────────────────────────────────────
    # Detect lunge by hip dropping (lower in image = higher y value)
    hip_drop = hip[1] - knee[1]
    is_lunge = hip_drop > LUNGE_THRESH
    rep_complete = False

    if state["phase"] == "STAND" and is_lunge:
        state["phase"] = "LUNGE"
    elif state["phase"] == "LUNGE" and not is_lunge:
        state["phase"] = "STAND"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "front_knee":  (front_knee_ok, front_knee_angle, "Lower until your front knee is at 90 degrees."),
        "back_knee":   (back_knee_ok,  back_knee_angle,  "Lower until your back knee is at 90 degrees."),
        "torso_upright":(torso_ok,     torso_angle,      "Keep your chest up — don't lean forward."),
        "knee_track":  (knee_ok,       knee_toe,         "Keep your front knee over your ankle."),
        "balance":     (balance_ok,    balance,          "Stay balanced — control the movement."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Push back to standing." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if torso_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN, "Hip"),
        (front_knee[0], front_knee[1], GREEN if front_knee_ok else RED, "Front Knee"),
        (front_ankle[0], front_ankle[1], GREEN if knee_ok else RED, "Front Ankle"),
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
    "name":        "Lunge",
    "camera_hint": "Standing, side-on to camera.",
    "phases":      ["Sciatica Ph3", "Chronic LBP Ph3", "Facet Joint Ph3", "Spinal Stenosis Ph3"],
    "rep_trigger": "hip_drop",
}
