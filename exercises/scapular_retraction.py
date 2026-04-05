"""
Scapular Retraction — Exercise Contract
────────────────────────────────────────
Camera position : Back-facing (patient's back faces camera)
Mode            : Similarity-based — compares user pose to a reference video

How it works
─────────────
1. On first call, loads a reference video (scapular_retraction_reference.mp4 next to this file)
2. Samples 20 frames evenly and stores all angle sets (no averaging)
3. Each live frame, finds the BEST matching reference frame
4. Similarity >= 50% -> hold time accumulates
5. Similarity ≥ 50% → hold time accumulates
6. Hold time reaches target → rep complete

Key angles checked (back-facing scapular retraction)
─────────────────────────────────────────────────────
- Shoulder width reduction  (squeeze amount)
- L/R shoulder symmetry     (asymmetry)
- Hip tilt                  (twist)
"""

import numpy as np
import mediapipe as mp
import os
import cv2

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

SIMILARITY_THRESHOLD = 0.80
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

    shoulder_width = abs(l_shoulder[0] - r_shoulder[0])
    shoulder_mid_y = (l_shoulder[1] + r_shoulder[1]) / 2
    shoulder_mid_x = (l_shoulder[0] + r_shoulder[0]) / 2
    l_dist = abs(l_shoulder[0] - shoulder_mid_x)
    r_dist = abs(r_shoulder[0] - shoulder_mid_x)
    asymmetry = abs(l_dist - r_dist)
    hip_tilt = abs(l_hip[1] - r_hip[1])

    return {
        "squeeze":    shoulder_width,
        "symmetry":   asymmetry,
        "shrug":      shoulder_mid_y,
        "twist":      hip_tilt,
    }


def _load_reference():
    global _reference_frames
    if _reference_frames is not None:
        return _reference_frames

    here = os.path.dirname(os.path.abspath(__file__))
    for fname in ["scapular_retraction_reference.mp4", "scapular_retraction_ref.mp4",
                  "scapular_retraction_reference.avi", "scapular_retraction_ref.avi"]:
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
            print(f"[Scapular Retraction] No pose detected in any frame of {fname}")
            continue

        _reference_frames = all_frames
        print(f"[Scapular Retraction] Reference loaded from {fname} "
              f"({len(all_frames)}/{len(indices)} frames valid)")
        return _reference_frames

    print("[Scapular Retraction] WARNING: No reference video found. "
          "Place scapular_retraction_reference.mp4 next to scapular_retraction.py")
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

    l_vis = landmarks[LM.LEFT_SHOULDER.value].visibility
    r_vis = landmarks[LM.RIGHT_SHOULDER.value].visibility
    landmarks_confident = l_vis > 0.4 and r_vis > 0.4

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)

    shoulder_width = abs(l_shoulder[0] - r_shoulder[0])
    baseline    = state.get("baseline_width", shoulder_width)
    is_squeezed = shoulder_width < baseline - 0.008 and landmarks_confident
    entering_hold = is_squeezed or (passed and landmarks_confident)

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
            if not is_squeezed and not passed:
                state["phase"]      = "REST"
                state["rep_count"] += 1
                rep_complete        = True
            elif passed:
                state["hold_time"] += dt

    if state["hold_time"] >= state["hold_target"]:
        rep_complete       = True
        state["hold_time"] = 0.0
        state["phase"]     = "REST"

    pct = int(similarity * 100)
    if not ref_frames:
        primary_cue = "No reference video found — add scapular_retraction_reference.mp4"
    elif not landmarks_confident:
        primary_cue = "Move closer so I can see your shoulders."
    elif passed:
        primary_cue = "Good. Hold the squeeze."
    elif not is_squeezed:
        primary_cue = "Pull your shoulder blades together."
    else:
        primary_cue = f"Adjust your position — {pct}% match. Aim for 50%."

    GREEN = (0, 220, 80)
    RED   = (0, 60, 255)
    color = GREEN if passed else RED

    joint_points = [
        (l_shoulder[0], l_shoulder[1], color, "L-Shldr"),
        (r_shoulder[0], r_shoulder[1], color, "R-Shldr"),
        (l_hip[0],      l_hip[1],      color, "L-Hip"),
        (r_hip[0],      r_hip[1],      color, "R-Hip"),
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
    "name":        "Scapular Retraction",
    "camera_hint":  "Sitting or standing, back to camera.",
    "instruction":  "Good. Squeeze your shoulder blades together and hold.",
    "phases":      ["Postural Pain Ph1"],
    "rep_trigger": "hold_duration",
}
