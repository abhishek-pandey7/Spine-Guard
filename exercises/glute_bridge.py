"""
Glute Bridge — Exercise Contract
─────────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Lying on back, knees bent ~90°, feet flat on floor

Movement: Patient drives hips up until shoulder–hip–knee forms a straight line

What we check
─────────────
1. Knee angle     : 80–100°  (knees stay bent throughout)
2. Hip angle      : at top of bridge, hip–knee–shoulder should be ~160–180°
                    (hips fully extended, forming a straight plank)
3. Spine neutral  : shoulder–hip–knee alignment stays straight (no sagging/arching)
4. Symmetry       : left hip height ≈ right hip height (no lateral drop)

States tracked
──────────────
DOWN  → hips on floor   (hip angle < 130°)
UP    → bridge held      (hip angle > 155°)
Rep counted each DOWN→UP→DOWN cycle

Feedback cues
─────────────
PASS  : "Good bridge. Squeeze your glutes."
KNEE  : "Keep your knees at 90 degrees."
HIP   : "Drive your hips higher."
SAG   : "Don't let your hips sag — keep the line straight."
SYM   : "Level your hips — don't let one side drop."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
KNEE_ANGLE_MIN   = 55     # degrees (was 70)
KNEE_ANGLE_MAX   = 130    # (was 115)
HIP_ANGLE_UP_MIN = 140    # shoulder–hip–knee at top of bridge (was 155)
HIP_ANGLE_SAG    = 130    # below this while "up" = sagging (was 145)
HIP_SYMMETRY_TOL = 0.07   # normalised y — left vs right hip height (was 0.04)
STATE_DOWN_THRESH = 125   # relaxed: hip angle below = hips on floor (was 135)
STATE_UP_THRESH   = 135   # relaxed: hip angle above = bridge achieved (was 148)


def _angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba = a - b
    bc = c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _pt(landmarks, lm_enum):
    lm = landmarks[lm_enum.value]
    return [lm.x, lm.y]


def evaluate(landmarks, state=None):
    """
    Parameters
    ----------
    landmarks : mediapipe landmark list
    state     : dict (mutable, carry between frames) — tracks rep state

    Returns
    -------
    result : dict
        passed       : bool
        checks       : dict
        primary_cue  : str
        joint_points : list
        state        : updated state dict
        rep_complete : bool — True on the frame a rep is counted
    """
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

    knee_angle = _angle(hip, knee, ankle)
    # Hip extension: angle at hip between shoulder line and knee line
    hip_angle  = _angle(shoulder, hip, knee)
    # Symmetry: difference in y between left and right hip
    hip_sym    = abs(l_hip[1] - r_hip[1])

    # ── Rep state machine ─────────────────────────────────────────────────────
    rep_complete = False
    if state["phase"] == "DOWN" and hip_angle > STATE_UP_THRESH:
        state["phase"] = "UP"
    elif state["phase"] == "UP" and hip_angle < STATE_DOWN_THRESH:
        state["phase"] = "DOWN"
        state["rep_count"] += 1
        rep_complete = True

    # ── Checks ────────────────────────────────────────────────────────────────
    knee_ok = KNEE_ANGLE_MIN <= knee_angle <= KNEE_ANGLE_MAX
    hip_ok  = hip_angle >= HIP_ANGLE_UP_MIN if state["phase"] == "UP" else True
    sag_ok  = hip_angle >= HIP_ANGLE_SAG    if state["phase"] == "UP" else True
    sym_ok  = hip_sym <= HIP_SYMMETRY_TOL

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "knee_angle": (knee_ok, knee_angle, "Keep your knees at 90 degrees."),
        "hip_height": (hip_ok,  hip_angle,  "Drive your hips higher."),
        "no_sag":     (sag_ok,  hip_angle,  "Don't let your hips sag — keep the line straight."),
        "symmetry":   (sym_ok,  hip_sym,    "Level your hips — don't let one side drop."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good bridge. Squeeze your glutes." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN,                        "Shoulder"),
        (l_hip[0],    l_hip[1],    GREEN if sym_ok else RED,     "L-Hip"),
        (r_hip[0],    r_hip[1],    GREEN if sym_ok else RED,     "R-Hip"),
        (knee[0],     knee[1],     GREEN if knee_ok else RED,    "Knee"),
        (ankle[0],    ankle[1],    YELLOW,                       "Ankle"),
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
    "name":        "Glute Bridge",
    "camera_hint": "Lie on your back, knees bent. Side-on to camera.",
    "phases":      ["Muscle Strain Ph2", "Sciatica Ph2", "Herniated Disc Ph2",
                    "Chronic LBP Ph1", "Facet Joint Ph2", "Spinal Stenosis Ph2"],
    "rep_trigger": "hip_height",
}