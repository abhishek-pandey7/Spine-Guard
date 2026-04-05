"""
Child's Pose — Exercise Contract
─────────────────────────────────
Camera position : Side-on (patient's left side faces camera, frame flipped before MediaPipe)
Mode            : Similarity-based — compares user pose to best matching frame in reference video

How it works
─────────────
1. On first call, loads a reference video (child_pose_reference.mp4 next to this file)
2. Samples 20 frames evenly and stores all angle sets (no averaging)
3. Each live frame, finds the BEST matching reference frame
4. Similarity ≥ 75% → hold time accumulates
5. Hold time reaches target → rep complete

Key angles checked (side-on child's pose)
──────────────────────────────────────────
- Hip ↔ Heel distance       (hips close to heels)
- Shoulder forward angle    (spine elongation)
- Wrist ahead of shoulder   (arm extension)
- Ear below shoulder        (head relaxed)
"""

import numpy as np
import mediapipe as mp
import os
import cv2

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

SIMILARITY_THRESHOLD = 0.75
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
    l_heel     = _pt(landmarks, LM.LEFT_HEEL)
    r_heel     = _pt(landmarks, LM.RIGHT_HEEL)
    l_wrist    = _pt(landmarks, LM.LEFT_WRIST)
    r_wrist    = _pt(landmarks, LM.RIGHT_WRIST)
    l_ear      = _pt(landmarks, LM.LEFT_EAR)
    r_ear      = _pt(landmarks, LM.RIGHT_EAR)

    shoulder = (l_shoulder + r_shoulder) / 2
    hip      = (l_hip + r_hip) / 2
    heel     = (l_heel + r_heel) / 2
    wrist    = (l_wrist + r_wrist) / 2
    ear      = (l_ear + r_ear) / 2

    dx = shoulder[0] - hip[0]
    dy = shoulder[1] - hip[1]
    spine_angle = float(abs(np.degrees(np.arctan2(dy, dx))))

    return {
        "hip_back":    abs(hip[1] - heel[1]),
        "spine_reach": spine_angle,
        "arm_ext":     wrist[0] - shoulder[0],
        "head_relax":  ear[1] - shoulder[1],
    }


def _load_reference():
    global _reference_frames
    if _reference_frames is not None:
        return _reference_frames

    here = os.path.dirname(os.path.abspath(__file__))
    for fname in ["child_pose_reference.mp4", "child_pose_ref.mp4",
                  "child_pose_reference.avi", "child_pose_ref.avi"]:
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
            print(f"[Child's Pose] No pose detected in any frame of {fname}")
            continue

        _reference_frames = all_frames
        print(f"[Child's Pose] Reference loaded from {fname} "
              f"({len(all_frames)}/{len(indices)} frames valid)")
        return _reference_frames

    print("[Child's Pose] WARNING: No reference video found. "
          "Place child_pose_reference.mp4 next to child_pose.py")
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

    similarity  = _compute_similarity(user_angles, ref_frames) if ref_frames else 0.0
    passed      = similarity >= SIMILARITY_THRESHOLD

    # ── Visibility gate ───────────────────────────────────────────────────────
    l_vis               = landmarks[LM.LEFT_SHOULDER.value].visibility
    r_vis               = landmarks[LM.RIGHT_SHOULDER.value].visibility
    landmarks_confident = l_vis > 0.4 and r_vis > 0.4

    # ── State machine ─────────────────────────────────────────────────────────
    rep_complete = False

    if state["phase"] == "REST" and landmarks_confident:
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
            if passed:
                state["hold_time"] += dt

    if state["hold_time"] >= state["hold_target"]:
        rep_complete       = True
        state["hold_time"] = 0.0
        state["phase"]     = "REST"

    # ── Feedback cue ──────────────────────────────────────────────────────────
    pct = int(similarity * 100)
    if not ref_frames:
        primary_cue = "No reference video found — add child_pose_reference.mp4"
    elif not landmarks_confident:
        primary_cue = "Move closer so I can see your pose."
    elif passed:
        primary_cue = "Good. Relax and breathe into your back."
    else:
        primary_cue = f"Adjust your position — {pct}% match. Aim for 75%."

    # ── Joint overlay ─────────────────────────────────────────────────────────
    GREEN = (0, 220, 80)
    RED   = (0, 60, 255)
    color = GREEN if passed else RED

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)
    l_wrist    = _pt(landmarks, LM.LEFT_WRIST)
    r_wrist    = _pt(landmarks, LM.RIGHT_WRIST)
    l_ear      = _pt(landmarks, LM.LEFT_EAR)
    r_ear      = _pt(landmarks, LM.RIGHT_EAR)

    shoulder = (l_shoulder + r_shoulder) / 2
    hip      = (l_hip + r_hip) / 2
    wrist    = (l_wrist + r_wrist) / 2
    ear      = (l_ear + r_ear) / 2

    joint_points = [
        (hip[0],      hip[1],      color, "Hip"),
        (shoulder[0], shoulder[1], color, "Shoulder"),
        (wrist[0],    wrist[1],    color, "Wrist"),
        (ear[0],      ear[1],      color, "Head"),
    ]

    checks = {
        "similarity": (passed, float(pct), f"Match: {pct}% — aim for 75%+"),
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
    "name":        "Child's Pose",
    "camera_hint":  "Kneeling, sit back on heels. Side-on to camera.",
    "instruction":  "Good. Reach your arms forward and breathe deeply into your back.",
    "phases":      ["Muscle Strain Ph1", "Facet Joint Ph1", "Spinal Stenosis Ph1"],
    "rep_trigger": "hold_duration",
}