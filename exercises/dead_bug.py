"""
Dead Bug — Exercise Contract
─────────────────────────────
Camera position : Top-down or side-on (patient lying on back)
Mode            : Similarity-based — compares user pose to best matching frame in reference video

How it works
─────────────
1. On first call, loads a reference video (dead_bug_reference.mp4 next to this file)
2. Samples 20 frames evenly and stores all angle sets (no averaging)
3. Each live frame, finds the BEST matching reference frame
4. Similarity >= 50% -> hold time accumulates
5. Hold time reaches target -> rep complete

Key angles checked (dead bug)
──────────────────────────────
- Shoulder -> Hip -> Knee    (back flatness)
- Hip -> Knee -> Ankle       (knee angle)
- L/R Hip Y difference       (hip rotation)
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
    l_wrist    = _pt(landmarks, LM.LEFT_WRIST)
    r_wrist    = _pt(landmarks, LM.RIGHT_WRIST)

    shoulder = (l_shoulder + r_shoulder) / 2
    hip      = (l_hip + r_hip) / 2
    knee     = (l_knee + r_knee) / 2

    back_angle   = _angle(shoulder, hip, knee)
    l_knee_angle = _angle(l_hip, l_knee, l_ankle)
    r_knee_angle = _angle(r_hip, r_knee, r_ankle)
    hip_rot      = abs(l_hip[1] - r_hip[1])
    l_arm_lowering = (l_shoulder[1] - l_wrist[1]) > 0.03
    r_arm_lowering = (r_shoulder[1] - r_wrist[1]) > 0.03

    return {
        "back_angle":   back_angle,
        "l_knee_angle": l_knee_angle,
        "r_knee_angle": r_knee_angle,
        "hip_rot":      hip_rot,
        "arm_moving":   float(l_arm_lowering or r_arm_lowering),
    }


def _load_reference():
    global _reference_frames
    if _reference_frames is not None:
        return _reference_frames

    here = os.path.dirname(os.path.abspath(__file__))
    for fname in ["dead_bug_reference.mp4", "dead_bug_ref.mp4",
                  "dead_bug_reference.avi", "dead_bug_ref.avi"]:
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
            print(f"[Dead Bug] No pose detected in any frame of {fname}")
            continue

        _reference_frames = all_frames
        print(f"[Dead Bug] Reference loaded from {fname} "
              f"({len(all_frames)}/{len(indices)} frames valid)")
        return _reference_frames

    print("[Dead Bug] WARNING: No reference video found. "
          "Place dead_bug_reference.mp4 next to dead_bug.py")
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

    # ── Visibility gate ───────────────────────────────────────────────────────
    l_vis               = landmarks[LM.LEFT_HIP.value].visibility
    r_vis               = landmarks[LM.RIGHT_HIP.value].visibility
    landmarks_confident = l_vis > 0.4 and r_vis > 0.4

    # ── Geometric extension detection (best-effort; may miss top-down views) --
    is_extended = landmarks_confident and user_angles.get("arm_moving", 0) > 0.5

    # Allow similarity alone to trigger HOLD — geometric detection can miss
    # arm movements in top-down views where y-deltas are small.
    entering_hold = is_extended or (passed and landmarks_confident)

    # ── State machine ─────────────────────────────────────────────────────────
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
            # Exit HOLD only when geometric extension drops AND similarity fails
            exiting = not is_extended and not passed
            if exiting:
                state["phase"]        = "REST"
                state["rep_count"]   += 1
                rep_complete          = True
            else:
                # Accumulate hold time whenever pose is good (similarity-gated)
                if passed:
                    state["hold_time"] += dt

    if state["hold_time"] >= state["hold_target"]:
        rep_complete       = True
        state["hold_time"] = 0.0
        state["phase"]     = "REST"

    # ── Feedback cue ──────────────────────────────────────────────────────────
    pct = int(similarity * 100)
    if not ref_frames:
        primary_cue = "No reference video found — add dead_bug_reference.mp4"
    elif not landmarks_confident:
        primary_cue = "Move closer so I can see your pose."
    elif passed:
        primary_cue = "Good. Keep your back pressed to the floor."
    else:
        primary_cue = f"Adjust your position — {pct}% match. Aim for 50%."

    # ── Joint overlay ─────────────────────────────────────────────────────────
    GREEN = (0, 220, 80)
    RED   = (0, 60, 255)
    color = GREEN if passed else RED

    l_shoulder = _pt(landmarks, LM.LEFT_SHOULDER)
    r_shoulder = _pt(landmarks, LM.RIGHT_SHOULDER)
    l_hip      = _pt(landmarks, LM.LEFT_HIP)
    r_hip      = _pt(landmarks, LM.RIGHT_HIP)
    l_knee     = _pt(landmarks, LM.LEFT_KNEE)
    r_knee     = _pt(landmarks, LM.RIGHT_KNEE)

    shoulder = (l_shoulder + r_shoulder) / 2
    hip      = (l_hip + r_hip) / 2

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
    "name":        "Dead Bug",
    "camera_hint":  "Lie on your back, arms up, knees bent. Top-down or side-on.",
    "instruction":  "Good. Keep your lower back pressed to the floor and breathe.",
    "phases":      ["Muscle Strain Ph3", "Herniated Disc Ph3",
                    "Postural Pain Ph3", "Chronic LBP Ph2"],
    "rep_trigger": "hold_duration",
}
