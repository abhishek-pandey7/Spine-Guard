"""
Squat — Exercise Contract
─────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Mode            : Similarity-based — compares user pose to a reference video

How it works
─────────────
1. On first call, loads a reference video (squat_reference.mp4 next to this file)
2. Samples 20 frames evenly and stores all angle sets (no averaging)
3. Each live frame, finds the BEST matching reference frame
4. Similarity >= 50% -> hold time accumulates
5. Similarity ≥ 50% → hold time accumulates
6. Hold time reaches target → rep complete

Key angles checked (side-on squat)
───────────────────────────────────
- Knee tracking       (knees stay over toes)
- Depth               (hips drop below knee level)
- Back angle          (torso stays within safe forward lean)
- Heel contact        (heels stay on ground)
"""

import numpy as np
import mediapipe as mp
import os
import cv2

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

SIMILARITY_THRESHOLD = 0.55
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

    depth = hip[1] - knee[1]
    dx = shoulder[0] - hip[0]
    dy = shoulder[1] - hip[1]
    back_angle = float(abs(np.degrees(np.arctan2(dy, dx))))

    return {
        "depth":      depth,
        "back_angle": back_angle,
        "heel_pos":   abs(ankle[1] - knee[1]),
        "knee_track": abs(knee[0] - ankle[0]),
    }


def _load_reference():
    global _reference_frames
    if _reference_frames is not None:
        return _reference_frames

    here = os.path.dirname(os.path.abspath(__file__))
    for fname in ["squat_reference.mp4", "squat_ref.mp4",
                  "squat_reference.avi", "squat_ref.avi"]:
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
            print(f"[Squat] No pose detected in any frame of {fname}")
            continue

        _reference_frames = all_frames
        print(f"[Squat] Reference loaded from {fname} "
              f"({len(all_frames)}/{len(indices)} frames valid)")
        return _reference_frames

    print("[Squat] WARNING: No reference video found. "
          "Place squat_reference.mp4 next to squat.py")
    return None


def _compute_similarity(user_angles, ref_frames):
    """Find the best matching reference frame and return its score."""
    MAX_DIFF   = 35.0
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

    # ── Key landmarks ─────────────────────────────────────────────────────────
    l_hip   = _pt(landmarks, LM.LEFT_HIP)
    r_hip   = _pt(landmarks, LM.RIGHT_HIP)
    l_knee  = _pt(landmarks, LM.LEFT_KNEE)
    r_knee  = _pt(landmarks, LM.RIGHT_KNEE)
    l_ankle = _pt(landmarks, LM.LEFT_ANKLE)
    r_ankle = _pt(landmarks, LM.RIGHT_ANKLE)

    hip   = (l_hip + r_hip) / 2
    knee  = (l_knee + r_knee) / 2
    ankle = (l_ankle + r_ankle) / 2

    landmarks_confident = (
        landmarks[LM.LEFT_HIP.value].visibility > 0.4 and
        landmarks[LM.LEFT_KNEE.value].visibility > 0.4 and
        landmarks[LM.LEFT_ANKLE.value].visibility > 0.4
    )

    # Hip below knee = squat down position
    # In image coords, larger y = lower on screen
    hip_y   = hip[1]
    knee_y  = knee[1]
    ankle_y = ankle[1]

    # Knee angle: angle at knee joint
    l_knee_angle = _angle(l_hip, l_knee, l_ankle)
    r_knee_angle = _angle(r_hip, r_knee, r_ankle)
    avg_knee_angle = (l_knee_angle + r_knee_angle) / 2

    # Squat down = knee angle < 120° (bent)
    # Standing = knee angle > 155° (straight)
    is_down     = avg_knee_angle < 120 and landmarks_confident
    is_standing = avg_knee_angle > 155 and landmarks_confident

    rep_complete = False

    if state["phase"] == "STAND":
        if is_down:
            state["phase"] = "DOWN"
            state["_exit_frames"] = 0

    elif state["phase"] == "DOWN":
        if is_standing:
            # Completed one squat rep
            state["rep_count"] += 1
            rep_complete        = True
            state["phase"]      = "STAND"
        elif not landmarks_confident:
            state["_exit_frames"] += 1
            if state["_exit_frames"] > 20:
                state["phase"] = "STAND"

    pct = int(similarity * 100)
    if not ref_frames:
        primary_cue = "No reference video found — add squat_reference.mp4"
    elif not landmarks_confident:
        primary_cue = "Move closer so I can see your full body."
    elif state["phase"] == "DOWN":
        if passed:
            primary_cue = f"Good squat! Stand back up. ({pct}% match)"
        else:
            primary_cue = f"Squat deeper — {pct}% match. Chest up, knees out."
    else:
        primary_cue = "Bend your knees and lower your hips into a squat."

    GREEN = (0, 220, 80)
    RED   = (0, 60, 255)
    color = GREEN if (is_down and passed) else RED

    joint_points = [
        (hip[0],   hip[1],   color, "Hip"),
        (knee[0],  knee[1],  color, "Knee"),
        (ankle[0], ankle[1], color, "Ankle"),
    ]

    checks = {
        "similarity": (passed, float(pct), f"Match: {pct}% — aim for 55%+"),
        "knee_angle": (is_down, float(avg_knee_angle), f"Knee angle: {int(avg_knee_angle)}°"),
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
    "name":        "Squat",
    "camera_hint":  "Standing, side-on to camera.",
    "instruction":  "Good. Keep your chest up, knees behind your toes, and hold.",
    "phases":      ["Muscle Strain Ph3", "Herniated Disc Ph3",
                    "Chronic LBP Ph2", "Facet Joint Ph3", "Spinal Stenosis Ph2"],
    "rep_trigger": "hold_duration",
}
