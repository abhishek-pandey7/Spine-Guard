"""
Piriformis Stretch — Exercise Contract
───────────────────────────────────────
Camera position : Front-facing or top-down (patient lying on back)
Starting position: Lying on back, one ankle crossed over opposite knee

Movement: Patient pulls the uncrossed leg toward chest to stretch
          the piriformis muscle of the crossed leg

What we check
─────────────
1. Figure-four position : ankle rests on opposite knee (crossed legs)
2. Pull motion          : uncrossed leg moves toward chest
3. Back contact         : lower back stays flat on floor
4. Stability            : no excessive rocking or twisting

States tracked
──────────────
REST   → legs flat
STRETCH → pulling leg toward chest
Rep counted each REST→STRETCH→REST cycle

Feedback cues
─────────────
PASS   : "Good. Hold the stretch and breathe."
CROSS  : "Cross your ankle over the opposite knee."
PULL   : "Pull your leg gently toward your chest."
BACK   : "Keep your lower back on the floor."
TWIST  : "Keep your shoulders flat — don't twist."
"""

import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ── Thresholds ────────────────────────────────────────────────────────────────
CROSS_DISTANCE   = 0.10  # normalised — ankle close to opposite knee
PULL_DISTANCE    = 0.08  # normalised — knee moves toward chest
BACK_FLAT_TOL    = 12    # degrees — shoulder-hip-knee flatness
TWIST_TOL        = 0.05  # normalised y — left vs right shoulder

STRETCH_THRESH   = 0.06  # knee movement toward chest


def _angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _pt(landmarks, lm_enum):
    lm = landmarks[lm_enum.value]
    return [lm.x, lm.y]


def _dist(p1, p2):
    return float(np.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2))


def evaluate(landmarks, baseline_shoulder_y=None, state=None):
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

    shoulder = [(l_shoulder[0]+r_shoulder[0])/2, (l_shoulder[1]+r_shoulder[1])/2]
    hip      = [(l_hip[0]+r_hip[0])/2,           (l_hip[1]+r_hip[1])/2]
    knee     = [(l_knee[0]+r_knee[0])/2,          (l_knee[1]+r_knee[1])/2]

    # Figure-four: distance between one ankle and opposite knee
    l_ankle_r_knee = _dist(l_ankle, r_knee)
    r_ankle_l_knee = _dist(r_ankle, l_knee)
    crossed = min(l_ankle_r_knee, r_ankle_l_knee) < CROSS_DISTANCE

    # Pull motion: knee moving toward chest (higher y in image = lower on body)
    pull_dist = abs(hip[1] - knee[1])
    pulling = pull_dist > PULL_DISTANCE

    # Back flatness
    back_angle = _angle(shoulder, hip, knee)
    back_ok = back_angle >= (180 - BACK_FLAT_TOL)

    # Twist
    twist = abs(l_shoulder[1] - r_shoulder[1])
    twist_ok = twist <= TWIST_TOL

    # ── Rep state machine ─────────────────────────────────────────────────
    is_stretch = pulling and crossed
    rep_complete = False

    if state["phase"] == "REST" and is_stretch:
        state["phase"] = "STRETCH"
    elif state["phase"] == "STRETCH" and not is_stretch:
        state["phase"] = "REST"
        state["rep_count"] += 1
        rep_complete = True

    GREEN  = (0, 220, 80)
    YELLOW = (0, 200, 255)
    RED    = (0, 60, 255)

    checks = {
        "crossed_legs": (crossed,  crossed,    "Cross your ankle over the opposite knee."),
        "pull_motion":  (pulling,  pull_dist,  "Pull your leg gently toward your chest."),
        "back_flat":    (back_ok,  back_angle, "Keep your lower back on the floor."),
        "no_twist":     (twist_ok, twist,      "Keep your shoulders flat — don't twist."),
    }

    all_passed = all(v[0] for v in checks.values())
    primary_cue = "Good. Hold the stretch and breathe." if all_passed else next(
        v[2] for v in checks.values() if not v[0]
    )

    joint_points = [
        (shoulder[0], shoulder[1], GREEN if twist_ok else RED, "Shoulder"),
        (hip[0],      hip[1],      GREEN if back_ok else RED, "Hip"),
        (l_knee[0],   l_knee[1],   GREEN if crossed else RED, "L-Knee"),
        (r_knee[0],   r_knee[1],   GREEN if crossed else RED, "R-Knee"),
        (l_ankle[0],  l_ankle[1],  YELLOW, "L-Ankle"),
        (r_ankle[0],  r_ankle[1],  YELLOW, "R-Ankle"),
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
    "name":        "Piriformis Stretch",
    "camera_hint": "Lie on your back, cross ankle over knee. Front-facing or top-down.",
    "phases":      ["Sciatica Ph1"],
    "rep_trigger": "pull_motion",
}
