"""
Walking — Exercise Contract
────────────────────────────
Camera position : Front-facing or side-on (patient walking toward/across camera)
Mode            : Similarity-based — compares user pose to a reference video

How it works
─────────────
1. On first call, loads a reference video (walking_reference.mp4 next to this file)
2. Samples frames evenly across the video and extracts joint angles from each
3. Averages the angles across all valid frames → robust reference pose
4. Each live frame, computes same angles from user and compares
5. Similarity ≥ 50% → duration accumulates
6. Duration reaches target → rep complete

Key angles checked (walking gait)
──────────────────────────────────
- Shoulder ↔ Hip angle     (upright posture)
- L/R Knee Y difference    (stride symmetry)
- L/R Wrist Y difference   (arm swing)
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
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)
    l_knee     = _pt(landmarks, LM.LEFT_KNEE)
    r_knee     = _pt(landmarks, LM.RIGHT_KNEE)
    l_wrist    = _pt(landmarks, LM.LEFT_WRIST)
    r_wrist    = _pt(landmarks, LM.RIGHT_WRIST)

    shoulder = (l_shoulder + r_shoulder) / 2
    hip      = (l_hip + r_hip) / 2

    dx = hip[0] - shoulder[0]
    dy = hip[1] - shoulder[1]
    posture = float(abs(np.degrees(np.arctan2(dy, dx))))

    return {
        "posture":    posture,
        "stride_sym": abs(l_knee[1] - r_knee[1]),
        "arm_swing":  abs(l_wrist[1] - r_wrist[1]),
    }


def _load_reference():
    global _reference_angles
    if _reference_angles is not None:
        return _reference_angles

    here = os.path.dirname(os.path.abspath(__file__))
    for fname in ["walking_reference.mp4", "walking_ref.mp4",
                  "walking_reference.avi", "walking_ref.avi"]:
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
        all_angles = []

        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if not ret:
                continue
            frame  = cv2.flip(frame, 1)
            rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)
            if result.pose_landmarks:
                all_angles.append(_extract_angles(result.pose_landmarks.landmark))
        cap.release()

        if not all_angles:
            print(f"[Walking] No pose detected in any frame of {fname}")
            continue

        averaged = {}
        for key in all_angles[0]:
            averaged[key] = float(np.mean([a[key] for a in all_angles]))

        _reference_angles = averaged
        print(f"[Walking] Reference loaded from {fname} "
              f"({len(all_angles)}/{len(indices)} frames valid): {averaged}")
        return _reference_angles

    print("[Walking] WARNING: No reference video found. "
          "Place walking_reference.mp4 next to walking.py")
    return None


def _compute_similarity(user_angles, ref_angles):
    MAX_DIFF   = 40.0
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
            "phase":        "WALKING",
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

    # ── Visibility gate ───────────────────────────────────────────────────────
    l_vis = landmarks[LM.LEFT_SHOULDER.value].visibility
    r_vis = landmarks[LM.RIGHT_SHOULDER.value].visibility
    landmarks_confident = l_vis > 0.4 and r_vis > 0.4

    # ── State machine ─────────────────────────────────────────────────────────
    rep_complete = False

    if state["phase"] == "REST" and landmarks_confident:
        state["phase"]        = "WALKING"
        state["_exit_frames"] = 0

    elif state["phase"] == "WALKING":
        if not landmarks_confident:
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

    # ── Feedback cue ──────────────────────────────────────────────────────────
    pct = int(similarity * 100)
    if not ref_angles:
        primary_cue = "No reference video found — add walking_reference.mp4"
    elif not landmarks_confident:
        primary_cue = "Move closer so I can see your posture."
    elif passed:
        primary_cue = "Good. Keep a steady, comfortable pace."
    else:
        primary_cue = f"Adjust your gait — {pct}% match. Aim for 50%."

    # ── Joint overlay ─────────────────────────────────────────────────────────
    GREEN = (0, 220, 80)
    RED   = (0, 60, 255)
    color = GREEN if passed else RED

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip = _pt(landmarks, LM.LEFT_HIP)
    r_hip = _pt(landmarks, LM.RIGHT_HIP)
    l_knee = _pt(landmarks, LM.LEFT_KNEE)
    r_knee = _pt(landmarks, LM.RIGHT_KNEE)

    shoulder = (l_shoulder + r_shoulder) / 2
    hip = (l_hip + r_hip) / 2

    joint_points = [
        (shoulder[0], shoulder[1], color, "Shoulder"),
        (hip[0],      hip[1],      color, "Hip"),
        (l_knee[0],   l_knee[1],   color, "L-Knee"),
        (r_knee[0],   r_knee[1],   color, "R-Knee"),
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
    "name":        "Walking",
    "camera_hint": "Walk toward or across the camera. Front-facing or side-on.",
    "phases":      ["Herniated Disc Ph1", "Spinal Stenosis Ph1", "Spinal Stenosis Ph3"],
    "rep_trigger": "hold_duration",
}
