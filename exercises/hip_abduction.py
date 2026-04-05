"""
Hip Abduction — Exercise Contract
──────────────────────────────────
Camera position : Side-on (patient lying on side)
Mode            : Similarity-based — compares user pose to a reference video

How it works
─────────────
1. On first call, loads a reference video (hip_abduction_reference.mp4 next to this file)
2. Samples 20 frames evenly and stores all angle sets (no averaging)
3. Each live frame, finds the BEST matching reference frame
4. Similarity >= 50% -> hold time accumulates
5. Similarity ≥ 50% → hold time accumulates
6. Hold time reaches target → rep complete

Key angles checked (side-on hip abduction)
───────────────────────────────────────────
- Hip → Knee → Ankle       (raised leg straightness)
- Hip Y - Ankle Y           (leg elevation)
- L/R Shoulder X diff       (trunk stability)
"""

import numpy as np
import mediapipe as mp
import os
import cv2

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

SIMILARITY_THRESHOLD = 0.95
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
    l_hip   = _pt(landmarks, LM.LEFT_HIP)
    r_hip   = _pt(landmarks, LM.RIGHT_HIP)
    l_knee  = _pt(landmarks, LM.LEFT_KNEE)
    r_knee  = _pt(landmarks, LM.RIGHT_KNEE)
    l_ankle = _pt(landmarks, LM.LEFT_ANKLE)
    r_ankle = _pt(landmarks, LM.RIGHT_ANKLE)
    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)

    if l_hip[1] < r_hip[1]:
        knee_angle = _angle(l_hip, l_knee, l_ankle)
        elev = l_hip[1] - l_ankle[1]
    else:
        knee_angle = _angle(r_hip, r_knee, r_ankle)
        elev = r_hip[1] - r_ankle[1]

    trunk_roll = abs(l_shoulder[0] - r_shoulder[0])

    return {
        "knee_angle":  knee_angle,
        "hip_elev":    elev,
        "trunk_roll":  trunk_roll,
    }


def _load_reference():
    global _reference_frames
    if _reference_frames is not None:
        return _reference_frames

    here = os.path.dirname(os.path.abspath(__file__))
    for fname in ["hip_abduction_reference.mp4", "hip_abduction_ref.mp4",
                  "hip_abduction_reference.avi", "hip_abduction_ref.avi"]:
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
            frame  = cv2.flip(frame, 1)
            rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)
            if result.pose_landmarks:
                all_frames.append(_extract_angles(result.pose_landmarks.landmark))
        cap.release()

        if not all_frames:
            print(f"[Hip Abduction] No pose detected in any frame of {fname}")
            continue

        _reference_frames = all_frames
        print(f"[Hip Abduction] Reference loaded from {fname} "
              f"({len(all_frames)}/{len(indices)} frames valid)")
        return _reference_frames

    print("[Hip Abduction] WARNING: No reference video found. "
          "Place hip_abduction_reference.mp4 next to hip_abduction.py")
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
            "phase":        "DOWN",
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

    # ── Visibility gate ───────────────────────────────────────────────────────
    l_vis = landmarks[LM.LEFT_HIP.value].visibility
    r_vis = landmarks[LM.RIGHT_HIP.value].visibility
    landmarks_confident = l_vis > 0.4 or r_vis > 0.4

    # ── State machine ─────────────────────────────────────────────────────────
    rep_complete = False

    # Allow similarity alone to enter UP — geometric leg-detection can miss
    # elevation in true side-on views where y-delta is compressed.
    entering_up = landmarks_confident and (passed or True)  # enter UP as soon as visible

    if state["phase"] == "DOWN":
        if landmarks_confident:
            state["phase"]        = "UP"
            state["_exit_frames"] = 0

    elif state["phase"] == "UP":
        if not landmarks_confident:
            state["_exit_frames"] += 1
            if state["_exit_frames"] > 15:
                state["phase"]        = "DOWN"
                state["_exit_frames"] = 0
                rep_complete          = True
        else:
            state["_exit_frames"] = 0
            # Accumulate hold time whenever pose is good (similarity-gated)
            if passed:
                state["hold_time"] += dt

    if state["hold_time"] >= state["hold_target"]:
        rep_complete       = True
        state["hold_time"] = 0.0
        state["phase"]     = "DOWN"

    # ── Feedback cue ──────────────────────────────────────────────────────────
    pct = int(similarity * 100)
    if not ref_frames:
        primary_cue = "No reference video found — add hip_abduction_reference.mp4"
    elif not landmarks_confident:
        primary_cue = "Move closer so I can see your legs."
    elif passed:
        primary_cue = "Good. Lower with control."
    else:
        primary_cue = f"Adjust your position — {pct}% match. Aim for 50%."

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
    l_ankle = _pt(landmarks, LM.LEFT_ANKLE)
    r_ankle = _pt(landmarks, LM.RIGHT_ANKLE)

    shoulder = (l_shoulder + r_shoulder) / 2
    hip = (l_hip + r_hip) / 2
    knee = (l_knee + r_knee) / 2
    ankle = (l_ankle + r_ankle) / 2

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
    "name":        "Hip Abduction",
    "camera_hint":  "Lie on your side. Side-on to camera.",
    "instruction":  "Good. Hold your leg up, keep it straight, and breathe steadily.",
    "phases":      ["Sciatica Ph3"],
    "rep_trigger": "hold_duration",
}
