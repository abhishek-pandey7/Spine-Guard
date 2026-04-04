"""
Child's Pose — Exercise Contract
─────────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: Kneeling, sitting back on heels, arms extended forward

What we check
─────────────
1. Hip–heel contact  : hips stay close to heels (not lifted)
2. Spine elongation  : shoulder extends forward from hip ≥ 15°
3. Head relaxation   : head drops toward floor (nose y below shoulder y)
4. Arm extension     : arms reach forward (wrist ahead of shoulder)

Feedback cues
─────────────
PASS  : "Good. Relax and breathe into your back."
HIP   : "Sit back toward your heels."
SPINE : "Reach your arms forward, lengthen your spine."
HEAD  : "Let your head rest gently toward the floor."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds (relaxed for real-world Mediapipe noise) ───────────────────────
HIP_HEEL_TOL    = 0.18   # normalised y — hip close to heel (was 0.10)
SPINE_REACH_MIN = 8      # degrees — shoulder forward from hip (was 15)
ARM_REACH_MIN   = 0.02   # normalised x — wrist ahead of shoulder (was 0.05)


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
        state = {"phase": "HOLD", "rep_count": 0}

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip = _pt(landmarks, LM.LEFT_HIP)
    r_hip = _pt(landmarks, LM.RIGHT_HIP)
    l_heel = _pt(landmarks, LM.LEFT_HEEL)
    r_heel = _pt(landmarks, LM.RIGHT_HEEL)
    l_wrist = _pt(landmarks, LM.LEFT_WRIST)
    r_wrist = _pt(landmarks, LM.RIGHT_WRIST)
    l_ear = _pt(landmarks, LM.LEFT_EAR)
    r_ear = _pt(landmarks, LM.RIGHT_EAR)

    shoulder_mid = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]
    hip_mid = [(l_hip[0]+r_hip[0])/2, (l_hip[1]+r_hip[1])/2]
    heel_mid = [(l_heel[0]+r_heel[0])/2, (l_heel[1]+r_heel[1])/2]
    wrist_mid = [(l_wrist[0]+r_wrist[0])/2, (l_wrist[1]+r_wrist[1])/2]
    ear_mid = [(l_ear[0]+r_ear[0])/2, (l_ear[1]+r_ear[1])/2]

    hip_heel_dist = abs(hip_mid[1] - heel_mid[1])
    spine_angle = _horizontal_angle(hip_mid, shoulder_mid)
    arm_reach = wrist_mid[0] - shoulder_mid[0]
    head_drop = ear_mid[1] - shoulder_mid[1]

    GREEN = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED = (0, 60, 255)

    hip_ok = hip_heel_dist <= HIP_HEEL_TOL
    spine_ok = spine_angle >= SPINE_REACH_MIN
    arm_ok = arm_reach >= ARM_REACH_MIN
    head_ok = head_drop > -0.03

    checks = {
        "hip_back": (hip_ok, hip_heel_dist, "Sit back toward your heels."),
        "spine_reach": (spine_ok, spine_angle, "Reach your arms forward, lengthen your spine."),
        "arm_extension": (arm_ok, arm_reach, "Extend your arms out in front."),
        "head_relax": (head_ok, head_drop, "Let your head rest gently toward the floor."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Relax and breathe into your back." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (hip_mid[0], hip_mid[1], GREEN if hip_ok else RED, "Hip"),
        (shoulder_mid[0], shoulder_mid[1], GREEN if spine_ok else RED, "Shoulder"),
        (wrist_mid[0], wrist_mid[1], GREEN if arm_ok else RED, "Wrist"),
        (ear_mid[0], ear_mid[1], GREEN if head_ok else YELLOW, "Head"),
    ]

    return {
        "passed": all_passed,
        "checks": checks,
        "primary_cue": primary_cue,
        "joint_points": joint_points,
        "state": state,
        "rep_complete": False,
    }


META = {
    "name": "Child's Pose",
    "camera_hint": "Kneeling, sit back on heels. Side-on to camera.",
    "phases": ["Muscle Strain Ph1", "Facet Joint Ph1", "Spinal Stenosis Ph1"],
    "rep_trigger": "hold",
}
