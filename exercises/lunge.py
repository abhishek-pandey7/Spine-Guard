"""
Lunge — Exercise Contract
─────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Mode            : Similarity-based — compares user pose to a reference video

How it works
─────────────
1. On first call, loads a reference video (lunge_reference.mp4 next to this file)
2. Samples 20 frames evenly and stores all angle sets (no averaging)
3. Each live frame, finds the BEST matching reference frame
4. Similarity >= 50% -> hold time accumulates
5. Similarity ≥ 50% → hold time accumulates
6. Hold time reaches target → rep complete

Key angles checked (side-on lunge)
───────────────────────────────────
- Front knee angle    (~90° at bottom of lunge)
- Back knee angle     (~90° at bottom of lunge)
- Torso upright       (torso stays relatively vertical)
- Knee tracking       (front knee stays over ankle)
- Balance             (no excessive sway)
"""

import numpy as np
import mediapipe as mp
import os
import cv2

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

SIMILARITY_THRESHOLD = 0.50
HOLD_TARGET_DEFAULT  = 30.0
SAMPLE_FRAMES        = 20

# Stores all sampled reference frames (not averaged)
_reference_frames = None
_ref_pose         = None


def _get_ref_pose():
    global _ref_pose
    if _ref_pose is None:
        _ref_pose = mp_pose.Pose(
            static_image_mode=True,
            model_complexity=1,
            min_detection_confidence=0.5,
        )
    return _ref_pose


def _pt(landmarks, lm_enum):
    lm = landmarks[lm_enum.value]
    return np.array([lm.x, lm.y])


def _angle(a, b, c):
    ba  = a - b
    bc  = c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _extract_angles(landmarks):
    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)
    l_knee     = _pt(landmarks, LM.LEFT_KNEE)
    r_knee     = _pt(landmarks, LM.RIGHT_KNEE)
    l_ankle    = _pt(landmarks, LM.LEFT_ANKLE)
    r_ankle    = _pt(landmarks, LM.RIGHT_ANKLE)

    shoulder = (l_shoulder + r_shoulder) / 2
    hip      = (l_hip + r_hip) / 2
    knee     = (l_knee + r_knee) / 2
    ankle    = (l_ankle + r_ankle) / 2

    l_knee_angle = _angle(l_hip, l_knee, l_ankle)
    r_knee_angle = _angle(r_hip, r_knee, r_ankle)

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

    dx = shoulder[0] - hip[0]
    dy = shoulder[1] - hip[1]
    torso_angle = float(abs(np.degrees(np.arctan2(dy, dx))))

    return {
        "front_knee":  front_knee_angle,
        "back_knee":   back_knee_angle,
        "torso":       torso_angle,
        "knee_track":  abs(front_knee[0] - front_ankle[0]),
        "balance":     abs(hip[0] - ankle[0]),
    }


def _load_reference():
    global _reference_frames
    if _reference_frames is not None:
        return _reference_frames

    here = os.path.dirname(os.path.abspath(__file__))
    for fname in ["lunge_reference.mp4", "lunge_ref.mp4",
                  "lunge_reference.avi", "lunge_ref.avi"]:
        path = os.path.join(here, fname)
        if not os.path.isfile(path):
            continue

        cap   = cv2.VideoCapture(path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total < 1:
            cap.release()
            continue

        indices    = np.linspace(0, total - 1, min(SAMPLE_FRAMES, total), dtype=int)
        pose       = _get_ref_pose()
        all_frames = []

        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if not ret:
                continue
            rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)
            if result.pose_landmarks:
                all_frames.append(_extract_angles(result.pose_landmarks.landmark))
        cap.release()

        if not all_frames:
            print(f"[Lunge] No pose detected in any frame of {fname}")
            continue

        _reference_frames = all_frames
        print(f"[Lunge] Reference loaded from {fname} "
              f"({len(all_frames)}/{len(indices)} frames valid)")
        return _reference_frames

    print("[Lunge] WARNING: No reference video found. "
          "Place lunge_reference.mp4 next to lunge.py")
    return None


def _compute_similarity(user_angles, ref_frames):
    """Find the best matching reference frame and return its score."""
    MAX_DIFF   = 40.0
    best_score = 0.0

    for ref_angles in ref_frames:
        scores = []
        for key in ref_angles:
            if key not in user_angles:
                continue
            diff  = abs(user_angles[key] - ref_angles[key])
            score = max(0.0, 1.0 - diff / MAX_DIFF)
            scores.append(score)
        frame_score = float(np.mean(scores)) if scores else 0.0
        best_score  = max(best_score, frame_score)

    return best_score


def evaluate(landmarks, state=None):
    if state is None:
        state = {
            "phase":        "STAND",   # STAND → DOWN → STAND = 1 rep
            "rep_count":    0,
            "_last_ts":     None,
            "_exit_frames": 0,
        }

    import time
    now = time.time()
    state["_last_ts"] = now

    ref_frames  = _load_reference()
    user_angles = _extract_angles(landmarks)

    similarity = _compute_similarity(user_angles, ref_frames) if ref_frames else 0.0
    passed     = similarity >= SIMILARITY_THRESHOLD

    l_hip   = _pt(landmarks, LM.LEFT_HIP)
    r_hip   = _pt(landmarks, LM.RIGHT_HIP)
    l_knee  = _pt(landmarks, LM.LEFT_KNEE)
    r_knee  = _pt(landmarks, LM.RIGHT_KNEE)
    l_ankle = _pt(landmarks, LM.LEFT_ANKLE)
    r_ankle = _pt(landmarks, LM.RIGHT_ANKLE)

    landmarks_confident = (
        landmarks[LM.LEFT_HIP.value].visibility > 0.3 and
        landmarks[LM.LEFT_KNEE.value].visibility > 0.3 and
        landmarks[LM.LEFT_ANKLE.value].visibility > 0.3
    )

    # Use the front knee angle to detect lunge depth
    l_knee_angle = _angle(l_hip, l_knee, l_ankle)
    r_knee_angle = _angle(r_hip, r_knee, r_ankle)
    # Front knee is the more bent one
    min_knee_angle = min(l_knee_angle, r_knee_angle)

    # Lunge down = front knee < 110° (bent)
    # Standing = both knees > 150° (straight)
    is_down     = min_knee_angle < 110 and landmarks_confident
    is_standing = min_knee_angle > 150 and landmarks_confident

    rep_complete = False

    if state["phase"] == "STAND":
        if is_down:
            state["phase"]        = "DOWN"
            state["_exit_frames"] = 0

    elif state["phase"] == "DOWN":
        if is_standing:
            state["rep_count"] += 1
            rep_complete        = True
            state["phase"]      = "STAND"
        elif not landmarks_confident:
            state["_exit_frames"] += 1
            if state["_exit_frames"] > 20:
                state["phase"] = "STAND"

    pct = int(similarity * 100)
    if not ref_frames:
        primary_cue = "No reference video found — add lunge_reference.mp4"
    elif not landmarks_confident:
        primary_cue = "Move closer so I can see your full body."
    elif state["phase"] == "DOWN":
        if passed:
            primary_cue = f"Good lunge! Push back up. ({pct}% match)"
        else:
            primary_cue = f"Step further — {pct}% match. Front knee over ankle."
    else:
        primary_cue = "Step forward and lower your back knee toward the floor."

    GREEN = (0, 220, 80)
    RED   = (0, 60, 255)
    color = GREEN if (is_down and passed) else RED

    hip   = (l_hip + r_hip) / 2
    knee  = (l_knee + r_knee) / 2
    ankle = (l_ankle + r_ankle) / 2

    joint_points = [
        (hip[0],   hip[1],   color, "Hip"),
        (knee[0],  knee[1],  color, "Knee"),
        (ankle[0], ankle[1], color, "Ankle"),
    ]

    checks = {
        "similarity": (passed, float(pct), f"Match: {pct}% — aim for 50%+"),
        "knee_angle": (is_down, float(min_knee_angle), f"Knee: {int(min_knee_angle)}°"),
    }

    return {
        "passed":        is_down and passed,
        "checks":        checks,
        "primary_cue":   primary_cue,
        "joint_points":  joint_points,
        "state":         state,
        "rep_complete":  rep_complete,
        "rep_count":     state["rep_count"],
        "is_time_based": False,
    }


META = {
    "name":        "Lunge",
    "camera_hint":  "Standing, side-on to camera.",
    "instruction":  "Good. Keep your front knee over your ankle. Hold and breathe.",
    "phases":      ["Sciatica Ph3", "Chronic LBP Ph3", "Facet Joint Ph3", "Spinal Stenosis Ph3"],
    "rep_trigger": "hold_duration",
}
