"""
Cat-Cow — Exercise Contract
────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Mode            : Similarity-based — compares user pose to a reference video

How it works
─────────────
1. On first call, loads a reference video (cat_cow_reference.mp4 next to this file)
2. Samples frames evenly across the video and extracts joint angles from each
3. Averages the angles across all valid frames → robust reference pose
4. Each live frame, computes same angles from user and compares
5. Similarity ≥ 50% → hold time accumulates
6. Hold time reaches target → rep complete

Key angles checked (side-on cat-cow)
─────────────────────────────────────
- Spine flexion/extension (shoulder–hip line curvature)
- Knee stability      (planted knees stay ~90°)
- Shoulder position   (shoulders stay over wrists)
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

# Cached reference angles
_reference_angles = None
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
    l_hip = _pt(landmarks, LM.LEFT_HIP)
    r_hip = _pt(landmarks, LM.RIGHT_HIP)
    l_knee = _pt(landmarks, LM.LEFT_KNEE)
    r_knee = _pt(landmarks, LM.RIGHT_KNEE)
    l_wrist = _pt(landmarks, LM.LEFT_WRIST)
    r_wrist = _pt(landmarks, LM.RIGHT_WRIST)

    shoulder_mid = (l_shoulder + r_shoulder) / 2
    hip_mid = (l_hip + r_hip) / 2
    wrist_mid = (l_wrist + r_wrist) / 2
    knee_mid = (l_knee + r_knee) / 2

    dx = shoulder_mid[0] - hip_mid[0]
    dy = shoulder_mid[1] - hip_mid[1]
    spine_angle = float(np.degrees(np.arctan2(dy, dx)))
    knee_angle = _angle(hip_mid, knee_mid, wrist_mid)
    shoulder_drift = abs(shoulder_mid[0] - wrist_mid[0])

    return {
        "spine_angle":  spine_angle,
        "knee_angle":   knee_angle,
        "shoulder_drift": shoulder_drift,
    }


def _load_reference():
    global _reference_angles

    if _reference_angles is not None:
        return _reference_angles

    here = os.path.dirname(os.path.abspath(__file__))
    for fname in ["cat_cow_reference.mp4", "cat_cow_ref.mp4",
                  "cat_cow_reference.avi", "cat_cow_ref.avi"]:
        path = os.path.join(here, fname)
        if not os.path.isfile(path):
            continue

        cap        = cv2.VideoCapture(path)
        total      = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total < 1:
            cap.release()
            continue

        indices    = np.linspace(0, total - 1, min(SAMPLE_FRAMES, total), dtype=int)
        pose       = _get_ref_pose()
        all_angles = []

        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if not ret:
                continue
            rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)
            if result.pose_landmarks:
                all_angles.append(_extract_angles(result.pose_landmarks.landmark))
        cap.release()

        if not all_angles:
            print(f"[Cat-Cow] No pose detected in any frame of {fname}")
            continue

        averaged = {}
        for key in all_angles[0]:
            averaged[key] = float(np.mean([a[key] for a in all_angles]))

        _reference_angles = averaged
        print(f"[Cat-Cow] Reference loaded from {fname} "
              f"({len(all_angles)}/{len(indices)} frames valid): {averaged}")
        return _reference_angles

    print("[Cat-Cow] WARNING: No reference video found. "
          "Place cat_cow_reference.mp4 next to cat_cow.py")
    return None


def _compute_similarity(user_angles, ref_angles):
    MAX_DIFF = 30.0
    scores   = []
    for key in ref_angles:
        if key not in user_angles:
            continue
        diff  = abs(user_angles[key] - ref_angles[key])
        score = max(0.0, 1.0 - diff / MAX_DIFF)
        scores.append(score)
    return float(np.mean(scores)) if scores else 0.0


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

    ref_angles  = _load_reference()
    user_angles = _extract_angles(landmarks)

    similarity  = _compute_similarity(user_angles, ref_angles) if ref_angles else 0.0
    passed      = similarity >= SIMILARITY_THRESHOLD

    shoulder_vis = landmarks[LM.LEFT_SHOULDER.value].visibility
    hip_vis = landmarks[LM.LEFT_HIP.value].visibility
    landmarks_confident = shoulder_vis > 0.4 and hip_vis > 0.4

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip = _pt(landmarks, LM.LEFT_HIP)
    r_hip = _pt(landmarks, LM.RIGHT_HIP)
    l_knee = _pt(landmarks, LM.LEFT_KNEE)
    r_knee = _pt(landmarks, LM.RIGHT_KNEE)
    l_wrist = _pt(landmarks, LM.LEFT_WRIST)
    r_wrist = _pt(landmarks, LM.RIGHT_WRIST)

    shoulder_mid = (l_shoulder + r_shoulder) / 2
    hip_mid = (l_hip + r_hip) / 2
    wrist_mid = (l_wrist + r_wrist) / 2
    knee_mid = (l_knee + r_knee) / 2

    is_moving = landmarks_confident

    rep_complete = False

    if state["phase"] == "REST" and is_moving:
        state["phase"]        = "HOLD"
        state["_exit_frames"] = 0

    elif state["phase"] == "HOLD":
        if not is_moving or not landmarks_confident:
            state["_exit_frames"] += 1
            if state["_exit_frames"] > 15:
                state["phase"]        = "REST"
                state["_exit_frames"] = 0
                rep_complete          = True
        else:
            state["_exit_frames"] = 0
            if passed:
                state["hold_time"] += dt

    if state["hold_time"] >= state["hold_target"]:
        rep_complete       = True
        state["hold_time"] = 0.0
        state["phase"]     = "REST"

    pct = int(similarity * 100)
    if not ref_angles:
        primary_cue = "No reference video found — add cat_cow_reference.mp4"
    elif not is_moving:
        primary_cue = "Round or arch your back slowly."
    elif passed:
        primary_cue = "Good. Move slowly and breathe."
    else:
        primary_cue = f"Adjust your position — {pct}% match. Aim for 50%."

    GREEN = (0, 220, 80)
    RED   = (0, 60, 255)
    color = GREEN if passed else RED

    joint_points = [
        (shoulder_mid[0], shoulder_mid[1], color, "Shoulder"),
        (hip_mid[0], hip_mid[1], color, "Hip"),
        (knee_mid[0], knee_mid[1], color, "Knee"),
        (wrist_mid[0], wrist_mid[1], color, "Wrist"),
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
    "name": "Cat-Cow",
    "camera_hint": "On hands and knees. Side-on to camera.",
    "phases": ["Muscle Strain Ph1", "Facet Joint Ph2"],
    "rep_trigger": "hold_duration",
}
