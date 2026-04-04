"""
Plank — Exercise Contract
──────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Forearms and toes on ground, body in straight line

What we check
─────────────
1. Spine alignment     : shoulder–hip–ankle form a straight line (± 10°)
2. Hip height          : hips not sagging below or piking above shoulder level
3. Elbow position      : elbows under shoulders (not drifting forward/back)
4. Head neutral        : head in line with spine (not drooping or craning)

States tracked
──────────────
REST   → not in plank position
HOLD   → holding plank
Duration tracked instead of reps

Feedback cues
─────────────
PASS   : "Good. Hold steady and breathe."
SAG    : "Don't let your hips drop — engage your core."
PIKE   : "Lower your hips — keep a straight line."
ELBOW  : "Keep your elbows under your shoulders."
HEAD   : "Keep your head in line with your spine."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds ────────────────────────────────────────────────────────────────
ALIGNMENT_TOL    = 12    # degrees — shoulder-hip-ankle deviation from straight
HIP_SAG_TOL      = 0.06  # normalised y — hip below shoulder line
HIP_PIKE_TOL     = 0.06  # normalised y — hip above shoulder line
ELBOW_DRIFT      = 0.08  # normalised x — elbow under shoulder
HEAD_NEUTRAL_TOL = 0.05  # normalised y — head in line with spine

HOLD_THRESH      = 0.04  # minimum elevation to detect plank position


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
        state = {"phase": "REST", "hold_time": 0.0, "rep_count": 0}

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)
    l_ankle    = _pt(landmarks, LM.LEFT_ANKLE)
    r_ankle    = _pt(landmarks, LM.RIGHT_ANKLE)
    l_elbow    = _pt(landmarks, LM.LEFT_ELBOW)
    r_elbow    = _pt(landmarks, LM.RIGHT_ELBOW)
    nose       = _pt(landmarks, LM.NOSE)

    shoulder = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]
    hip      = [(l_hip[0]+r_hip[0])/2,           (l_hip[1]+r_hip[1])/2]
    ankle    = [(l_ankle[0]+r_ankle[0])/2,         (l_ankle[1]+r_ankle[1])/2]
    elbow    = [(l_elbow[0]+r_elbow[0])/2,         (l_elbow[1]+r_elbow[1])/2]

    # Alignment: shoulder-hip-ankle angle (should be ~180° for straight line)
    alignment_angle = _angle(shoulder, hip, ankle)
    alignment_ok = alignment_angle >= (180 - ALIGNMENT_TOL)

    # Hip sag: hip should not drop below shoulder line
    hip_sag = shoulder[1] - hip[1]
    sag_ok = hip_sag <= HIP_SAG_TOL

    # Hip pike: hip should not rise above shoulder line
    hip_pike = hip[1] - shoulder[1]
    pike_ok = hip_pike <= HIP_PIKE_TOL

    # Elbow under shoulder
    elbow_drift = abs(elbow[0] - shoulder[0])
    elbow_ok = elbow_drift <= ELBOW_DRIFT

    # Head neutral
    head_drift = abs(nose[1] - shoulder[1])
    head_ok = head_drift <= HEAD_NEUTRAL_TOL

    # ── State machine ─────────────────────────────────────────────────────
    is_plank = (shoulder[1] - ankle[1]) > HOLD_THRESH
    rep_complete = False

    if state["phase"] == "REST" and is_plank:
        state["phase"] = "HOLD"
    elif state["phase"] == "HOLD" and not is_plank:
        state["phase"] = "REST"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "alignment":  (alignment_ok, alignment_angle, "Keep a straight line from shoulders to ankles."),
        "no_sag":     (sag_ok,       hip_sag,         "Don't let your hips drop — engage your core."),
        "no_pike":    (pike_ok,      hip_pike,        "Lower your hips — keep a straight line."),
        "elbow_pos":  (elbow_ok,     elbow_drift,     "Keep your elbows under your shoulders."),
        "head_neutral":(head_ok,     head_drift,      "Keep your head in line with your spine."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Hold steady and breathe." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN, "Shoulder"),
        (hip[0],      hip[1],      GREEN if (sag_ok and pike_ok) else RED, "Hip"),
        (ankle[0],    ankle[1],    GREEN if alignment_ok else RED, "Ankle"),
        (elbow[0],    elbow[1],    GREEN if elbow_ok else RED, "Elbow"),
        (nose[0],     nose[1],     GREEN if head_ok else RED, "Head"),
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
    "name":        "Plank",
    "camera_hint": "Side-on to camera. Forearms on ground.",
    "phases":      ["Muscle Strain Ph3", "Sciatica Ph3", "Herniated Disc Ph3",
                    "Postural Pain Ph3", "Chronic LBP Ph3", "Facet Joint Ph3",
                    "Spinal Stenosis Ph3"],
    "rep_trigger": "hold_duration",
}
