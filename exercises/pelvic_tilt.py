"""
Pelvic Tilt — Exercise Contract
────────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Lying on back, knees bent ~90°, feet flat

What we check
─────────────
1. Knee angle          : 80–100°   (knees must stay bent)
2. Hip–knee alignment  : hip, knee, ankle roughly horizontal (flat back)
3. Lumbar tilt change  : hip tilts posteriorly → lower back flattens
   Measured as the angle between the torso line (shoulder→hip) and
   the thigh line (hip→knee). Should increase by ~10–20° from rest.
4. Shoulder stays flat : shoulder y-position stable (not lifting)

Feedback cues (voice + overlay)
────────────────────────────────
PASS  : "Good. Hold the tilt."
KNEE  : "Keep your knees bent at 90 degrees."
BACK  : "Press your lower back into the floor."
LIFT  : "Keep your shoulders relaxed on the floor."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark


# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
KNEE_ANGLE_MIN   = 60    # degrees — allow more slack (was 70)
KNEE_ANGLE_MAX   = 120   # (was 110)
TILT_ANGLE_MIN   = 130   # hip-knee-ankle angle; more lenient (was 150)
SHOULDER_DRIFT_Y = 0.08  # normalised units — shoulder shouldn't rise (was 0.05)


def _angle(a, b, c):
    """Angle at point b, given three 2D points."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba = a - b
    bc = c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _pt(landmarks, lm_enum):
    lm = landmarks[lm_enum.value]
    return [lm.x, lm.y]


def evaluate(landmarks, baseline_shoulder_y=None, state=None):
    """
    Returns
    -------
    result : dict
        passed       : bool   — True if all checks pass
        checks       : dict   — per-joint check name → (passed:bool, value:float, cue:str)
        primary_cue  : str    — the most important voice cue this frame
        joint_points : list   — [(x_norm, y_norm, color_bgr, label)] for overlay dots
    """
    if state is None:
        state = {}
    
    # Auto-capture baseline on first frame
    if "baseline_shoulder_y" not in state:
        # Use the average of left and right for robustness
        l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
        r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
        state["baseline_shoulder_y"] = (l_shoulder[1] + r_shoulder[1]) / 2
    # Use the average of left and right for robustness
    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)
    l_knee     = _pt(landmarks, LM.LEFT_KNEE)
    r_knee     = _pt(landmarks, LM.RIGHT_KNEE)
    l_ankle    = _pt(landmarks, LM.LEFT_ANKLE)
    r_ankle    = _pt(landmarks, LM.RIGHT_ANKLE)

    # Average left & right
    shoulder = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]
    hip      = [(l_hip[0]+r_hip[0])/2,           (l_hip[1]+r_hip[1])/2]
    knee     = [(l_knee[0]+r_knee[0])/2,          (l_knee[1]+r_knee[1])/2]
    ankle    = [(l_ankle[0]+r_ankle[0])/2,         (l_ankle[1]+r_ankle[1])/2]

    knee_angle  = _angle(hip, knee, ankle)
    tilt_angle  = _angle(shoulder, hip, knee)   # torso–thigh angle at hip
    shoulder_y  = shoulder[1]
    bs_y = state.get("baseline_shoulder_y", shoulder_y)

    # ── Per-check results ─────────────────────────────────────────────────────
    knee_ok     = KNEE_ANGLE_MIN <= knee_angle <= KNEE_ANGLE_MAX
    tilt_ok     = tilt_angle >= TILT_ANGLE_MIN
    shoulder_ok = abs(shoulder_y - bs_y) < SHOULDER_DRIFT_Y

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "knee_angle":  (knee_ok,     knee_angle,  "Keep your knees bent at 90 degrees."),
        "tilt_angle":  (tilt_ok,     tilt_angle,  "Press your lower back into the floor."),
        "shoulder_pos":(shoulder_ok, shoulder_y,  "Keep your shoulders relaxed on the floor."),
    }

    all_passed = all(v[0] for v in checks.values())

    # First failing cue wins
    primary_cue = "Good. Hold the tilt." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if shoulder_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN if tilt_ok     else RED, "Hip"),
        (knee[0],     knee[1],     GREEN if knee_ok     else RED, "Knee"),
        (ankle[0],    ankle[1],    YELLOW,                        "Ankle"),
    ]

    return {
        "passed":       all_passed,
        "checks":       checks,
        "primary_cue":  primary_cue,
        "joint_points": joint_points,
    }


# ── Metadata used by the monitor ─────────────────────────────────────────────
META = {
    "name":        "Pelvic Tilt",
    "camera_hint": "Lie on your back, knees bent. Side-on to camera.",
    "phases":      ["Muscle Strain Ph1", "Sciatica Ph1", "Herniated Disc Ph1",
                    "Postural Pain Ph2", "Chronic LBP Ph1", "Facet Joint Ph1",
                    "Spinal Stenosis Ph1"],
    "rep_trigger": "tilt_angle",   # which check signals a completed rep
}