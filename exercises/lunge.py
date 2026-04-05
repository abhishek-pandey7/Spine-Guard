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
    MAX_DIFF   = 30.0
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
            "phase":        "REST",
            "hold_time":    0.0,
            "hold_target":  HOLD_TARGET_DEFAULT,
            "rep_count":    0,
            "_last_ts":     None,
            "_exit_frames": 0,
        }

    import time
    now = time.time()
    dt  = min(now - state["_last_ts"], 0.1) if state["_last_ts"] else 0.0
    state["_last_ts"] = now

    ref_frames  = _load_reference()
    user_angles = _extract_angles(landmarks)

    similarity = _compute_similarity(user_angles, ref_frames) if ref_frames else 0.0
    passed     = similarity >= SIMILARITY_THRESHOLD

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

    landmarks_confident = (
        landmarks[LM.LEFT_SHOULDER.value].visibility > 0.4 and
        landmarks[LM.LEFT_HIP.value].visibility > 0.4 and
        landmarks[LM.LEFT_KNEE.value].visibility > 0.4
    )

    hip_drop = hip[1] - knee[1]
    is_lunge = hip_drop > 0.015 and landmarks_confident

    # Allow similarity alone to trigger HOLD — hip_drop threshold can miss
    # a good lunge if the camera angle or user height compresses the y-axis.
    entering_hold = is_lunge or (passed and landmarks_confident)

    rep_complete = False

    if state["phase"] == "REST":
        if landmarks_confident and entering_hold:
            state["phase"]        = "HOLD"
            state["_exit_frames"] = 0

    elif state["phase"] == "HOLD":
        if not landmarks_confident:
            state["_exit_frames"] += 1
            if state["_exit_frames"] > 15:
                state["phase"]        = "REST"
                state["_exit_frames"] = 0
                rep_complete          = True
        else:
            state["_exit_frames"] = 0
            # Exit HOLD only when geometric lunge drops AND similarity fails
            exiting = not is_lunge and not passed
            if exiting:
                state["phase"]      = "REST"
                state["rep_count"] += 1
                rep_complete        = True
            else:
                # Accumulate hold time whenever pose is good (similarity-gated)
                if passed:
                    state["hold_time"] += dt

    if state["hold_time"] >= state["hold_target"]:
        rep_complete       = True
        state["hold_time"] = 0.0
        state["phase"]     = "REST"

    pct = int(similarity * 100)
    if not ref_frames:
        primary_cue = "No reference video found — add lunge_reference.mp4"
    elif not landmarks_confident:
        primary_cue = "Move closer so I can see your pose."
    elif passed:
        primary_cue = "Good. Push back to standing."
    elif not is_lunge:
        primary_cue = "Step forward and lower your hips."
    else:
        primary_cue = f"Adjust your position — {pct}% match. Aim for 50%."

    GREEN = (0, 220, 80)
    RED   = (0, 60, 255)
    color = GREEN if passed else RED

    joint_points = [
        (shoulder[0], shoulder[1], color, "Shoulder"),
        (hip[0],      hip[1],      color, "Hip"),
        (knee[0],     knee[1],     color, "Knee"),
        (ankle[0],    ankle[1],    color, "Ankle"),
    ]

    checks = {
        "similarity": (passed, float(pct), f"Match: {pct}% — aim for 50%+"),
    }

    return {
        "passed":        passed,
        "checks":        checks,
        "primary_cue":   primary_cue,
        "joint_points":  joint_points,
        "state":         state,
        "rep_complete":  rep_complete,
        "hold_time":     state["hold_time"],
        "hold_target":   state["hold_target"],
        "is_time_based": True,
    }


META = {
    "name":        "Lunge",
    "camera_hint":  "Standing, side-on to camera.",
    "instruction":  "Good. Keep your front knee over your ankle. Hold and breathe.",
    "phases":      ["Sciatica Ph3", "Chronic LBP Ph3", "Facet Joint Ph3", "Spinal Stenosis Ph3"],
    "rep_trigger": "hold_duration",
}
