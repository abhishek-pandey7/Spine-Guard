"""
McKenzie Press-up — Exercise Contract
──────────────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Lying face down (prone), hands under shoulders

Movement: Patient presses upper body up using arms while keeping
          hips and pelvis flat on the floor, extending the spine

What we check
─────────────
1. Hip contact          : hips stay on floor (not lifting)
2. Spine extension      : chest rises, creating spinal extension
3. Arm position         : elbows extend, hands under shoulders
4. Pelvic stability     : pelvis doesn't rotate or lift

States tracked
──────────────
DOWN   → chest on floor
UP     → chest elevated, spine extended
Rep counted each DOWN→UP→DOWN cycle

Feedback cues
─────────────
PASS   : "Good. Hold at the top and breathe."
HIP    : "Keep your hips on the floor — don't lift them."
ARM    : "Push through your hands — straighten your arms."
PAIN   : "Only go as far as comfortable — don't push into pain."
PELVIS : "Keep your pelvis stable on the floor."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
HIP_CONTACT_TOL  = 0.08  # normalised y — hips should stay low (was 0.04)
CHEST_ELEVATION  = 0.03  # normalised y — chest must rise (was 0.06)
ARM_EXTEND_MIN   = 130   # degrees — elbow angle when pressing up (was 150)
PELVIS_TILT_TOL  = 18    # degrees — pelvic rotation (was 10)

UP_THRESH        = 0.02  # shoulder above hip to count as up (was 0.04)


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

    # Hip contact: hips should stay low (higher y = lower in image)
    hip_contact = hip[1] >= 0.80  # hips near bottom of frame
    hip_ok = hip_contact

    # Chest elevation: shoulders above hips
    chest_elev = hip[1] - shoulder[1]
    chest_ok = chest_elev > CHEST_ELEVATION

    # Arm extension
    arm_angle = _angle(shoulder, elbow, wrist)
    arm_ok = arm_angle >= ARM_EXTEND_MIN

    # Pelvic tilt: hip-shoulder line angle
    pelvis_tilt = _horizontal_angle(shoulder, hip)
    pelvis_ok = pelvis_tilt <= PELVIS_TILT_TOL

    # ── Rep state machine ─────────────────────────────────────────────────
    is_up = (hip[1] - shoulder[1]) > UP_THRESH
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
        "hip_contact":  (hip_ok,  hip[1],    "Keep your hips on the floor — don't lift them."),
        "chest_elev":   (chest_ok, chest_elev, "Push your chest up — extend through your spine."),
        "arm_extend":   (arm_ok,  arm_angle,  "Push through your hands — straighten your arms."),
        "pelvis_stable":(pelvis_ok, pelvis_tilt, "Keep your pelvis stable on the floor."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Hold at the top and breathe." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if chest_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN if hip_ok else RED, "Hip"),
        (elbow[0],    elbow[1],    GREEN if arm_ok else RED, "Elbow"),
        (wrist[0],    wrist[1],    YELLOW, "Wrist"),
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
    "name":        "McKenzie Press-up",
    "camera_hint": "Lie face down, hands under shoulders. Side-on to camera.",
    "phases":      ["Herniated Disc Ph1"],
    "rep_trigger": "chest_elev",
}
