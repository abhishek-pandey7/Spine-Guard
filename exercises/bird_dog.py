"""
Bird Dog — Exercise Contract
──────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: On hands and knees (quadruped), spine neutral

Movement: Patient extends opposite arm + leg simultaneously while
          keeping spine perfectly neutral (no rotation, no sagging)

What we check
─────────────
1. Spine neutral      : shoulder–hip line stays horizontal ± 8°
2. Hip level          : extending leg hip stays level with the planted hip
3. Arm extension      : raised arm roughly horizontal (shoulder–wrist angle)
4. Knee stay planted  : planted knee angle stays ~90° (not shifting weight back)
5. No trunk rotation  : left vs right shoulder y-positions stay close

States tracked
──────────────
REST   → both sides down
EXTEND → one side extended (arm up + leg up)
Rep counted each REST→EXTEND→REST cycle

Feedback cues
─────────────
PASS   : "Good. Hold and breathe."
SPINE  : "Keep your back flat — don't let it sag."
HIP    : "Keep your hips level — don't rotate."
ARM    : "Reach your arm forward, parallel to the floor."
ROTATE : "Don't twist your shoulders — keep them level."
PLANT  : "Stay stable on your planted knee."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds ────────────────────────────────────────────────────────────────
SPINE_LEVEL_TOL   = 12    # degrees — shoulder–hip line from horizontal (was 8)
HIP_LEVEL_TOL     = 0.07  # normalised y — left vs right hip (was 0.05)
ARM_ANGLE_MIN     = 130   # shoulder–elbow–wrist OR shoulder to wrist horizontal angle (was 140)
TRUNK_ROTATION_TOL= 0.06  # normalised y — left vs right shoulder (was 0.04)
PLANTED_KNEE_MIN  = 70    # planted knee angle (was 75)
PLANTED_KNEE_MAX  = 110   # (was 105)

EXTEND_ARM_Y_THRESH  = 0.05  # wrist rises above shoulder by this much (norm) = arm extended (was 0.08)
EXTEND_LEG_Y_THRESH  = 0.04  # ankle rises above hip by this much (norm) = leg extended (was 0.06)


def _angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _pt(landmarks, lm_enum):
    lm = landmarks[lm_enum.value]
    return [lm.x, lm.y]


def _horizontal_angle(p1, p2):
    """Angle of line p1→p2 from horizontal (degrees)."""
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    return float(abs(np.degrees(np.arctan2(dy, dx))))


def evaluate(landmarks, state=None):
    """
    Parameters
    ----------
    landmarks : mediapipe landmark list
    state     : dict (mutable carry-forward)

    Returns
    -------
    result dict — same structure as other exercises
    """
    if state is None:
        state = {"phase": "REST", "rep_count": 0}

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
    l_elbow    = _pt(landmarks, LM.LEFT_ELBOW)
    r_elbow    = _pt(landmarks, LM.RIGHT_ELBOW)

    shoulder_mid = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]
    hip_mid      = [(l_hip[0]+r_hip[0])/2,           (l_hip[1]+r_hip[1])/2]

    # ── Spine neutral: shoulder–hip horizontal angle ───────────────────────
    spine_angle = _horizontal_angle(shoulder_mid, hip_mid)
    spine_ok    = spine_angle <= SPINE_LEVEL_TOL

    # ── Hip level: left vs right hip y ───────────────────────────────────
    hip_sym  = abs(l_hip[1] - r_hip[1])
    hip_ok   = hip_sym <= HIP_LEVEL_TOL

    # ── Trunk rotation: shoulder y symmetry ──────────────────────────────
    trunk_rot    = abs(l_shoulder[1] - r_shoulder[1])
    rotation_ok  = trunk_rot <= TRUNK_ROTATION_TOL

    # ── Arm extension: detect which arm is raised (lower y = higher up) ──
    # We look for whichever wrist is higher than its shoulder
    l_arm_extended = (l_shoulder[1] - l_wrist[1]) > EXTEND_ARM_Y_THRESH
    r_arm_extended = (r_shoulder[1] - r_wrist[1]) > EXTEND_ARM_Y_THRESH
    arm_extended   = l_arm_extended or r_arm_extended

    if l_arm_extended:
        arm_angle = _angle(l_shoulder, l_elbow, l_wrist)
        arm_pt    = l_wrist
    elif r_arm_extended:
        arm_angle = _angle(r_shoulder, r_elbow, r_wrist)
        arm_pt    = r_wrist
    else:
        arm_angle = 0.0
        arm_pt    = l_wrist

    arm_ok = (arm_angle >= ARM_ANGLE_MIN) if arm_extended else True

    # ── Leg extension: detect which ankle is raised ───────────────────────
    l_leg_extended = (l_hip[1] - l_ankle[1]) > EXTEND_LEG_Y_THRESH
    r_leg_extended = (r_hip[1] - r_ankle[1]) > EXTEND_LEG_Y_THRESH

    # Planted knee: use the side NOT extending
    if l_leg_extended:
        planted_knee_angle = _angle(r_hip, r_knee, r_ankle)
    else:
        planted_knee_angle = _angle(l_hip, l_knee, l_ankle)

    planted_ok = PLANTED_KNEE_MIN <= planted_knee_angle <= PLANTED_KNEE_MAX

    # ── Rep state machine ─────────────────────────────────────────────────
    rep_complete   = False
    is_extended    = arm_extended and (l_leg_extended or r_leg_extended)

    if state["phase"] == "REST" and is_extended:
        state["phase"] = "EXTEND"
    elif state["phase"] == "EXTEND" and not is_extended:
        state["phase"] = "REST"
        state["rep_count"] += 1
        rep_complete = True

    # ── Checks ────────────────────────────────────────────────────────────
    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "spine_level":   (spine_ok,    spine_angle,        "Keep your back flat — don't let it sag."),
        "hip_level":     (hip_ok,      hip_sym,            "Keep your hips level — don't rotate."),
        "arm_extension": (arm_ok,      arm_angle,          "Reach your arm forward, parallel to the floor."),
        "no_rotation":   (rotation_ok, trunk_rot,          "Don't twist your shoulders — keep them level."),
        "planted_knee":  (planted_ok,  planted_knee_angle, "Stay stable on your planted knee."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Hold and breathe." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (l_shoulder[0], l_shoulder[1], GREEN if rotation_ok else RED, "L-Shldr"),
        (r_shoulder[0], r_shoulder[1], GREEN if rotation_ok else RED, "R-Shldr"),
        (l_hip[0],      l_hip[1],      GREEN if hip_ok      else RED, "L-Hip"),
        (r_hip[0],      r_hip[1],      GREEN if hip_ok      else RED, "R-Hip"),
        (arm_pt[0],     arm_pt[1],     GREEN if arm_ok      else RED, "Wrist"),
        (l_knee[0],     l_knee[1],     GREEN if planted_ok  else RED, "Knee"),
        (shoulder_mid[0], shoulder_mid[1], GREEN if spine_ok else RED, "Spine"),
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
    "name":        "Bird Dog",
    "camera_hint": "Start on hands and knees. Side-on to camera.",
    "phases":      ["Muscle Strain Ph2", "Sciatica Ph2", "Herniated Disc Ph2",
                    "Postural Pain Ph3", "Chronic LBP Ph1", "Facet Joint Ph2"],
    "rep_trigger": "arm_extension",
}