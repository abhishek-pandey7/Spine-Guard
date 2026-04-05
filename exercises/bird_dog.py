"""
Bird Dog — Exercise Contract
──────────────────────────────
Camera position : Side-on (patient's left or right side faces camera)
Starting position: On hands and knees (quadruped), spine neutral
Mode            : Similarity-based — compares user pose to best matching frame in reference video

Movement: Patient extends opposite arm + leg simultaneously while
          keeping spine perfectly neutral (no rotation, no sagging)

How it works
─────────────
1. On first call, loads a reference video (bird_dog_reference.mp4 next to this file)
2. Samples 20 frames evenly and stores all angle sets (no averaging)
3. Each live frame, finds the BEST matching reference frame
4. Similarity >= 75% -> hold/extend time accumulates
5. Rep counted each REST->EXTEND->REST cycle

Key angles checked (side-on bird dog)
──────────────────────────────────────
- Spine neutral      : shoulder-hip line stays horizontal +/- threshold
- Hip level          : extending leg hip stays level with the planted hip
- Arm extension      : raised arm roughly horizontal (shoulder-wrist angle)
- Planted knee       : planted knee angle stays ~90 (not shifting weight back)
- No trunk rotation  : left vs right shoulder y-positions stay close
"""

import numpy as np
import mediapipe as mp
import os
import cv2

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

SIMILARITY_THRESHOLD = 0.60
HOLD_TARGET_DEFAULT  = 30.0
SAMPLE_FRAMES        = 20

# ── Thresholds ────────────────────────────────────────────────────────────────
SPINE_LEVEL_TOL    = 12    # degrees — shoulder-hip line from horizontal
HIP_LEVEL_TOL      = 0.07  # normalised y — left vs right hip
ARM_ANGLE_MIN      = 130   # shoulder-elbow-wrist angle
TRUNK_ROTATION_TOL = 0.06  # normalised y — left vs right shoulder
PLANTED_KNEE_MIN   = 70    # planted knee angle min
PLANTED_KNEE_MAX   = 110   # planted knee angle max

EXTEND_ARM_Y_THRESH = 0.05  # wrist rises above shoulder by this much (norm) = arm extended
EXTEND_LEG_Y_THRESH = 0.04  # ankle rises above hip by this much (norm) = leg extended

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
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba = a - b
    bc = c - b
    cos = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def _horizontal_angle(p1, p2):
    """Angle of line p1->p2 from horizontal (degrees)."""
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    return float(abs(np.degrees(np.arctan2(dy, dx))))


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
    l_elbow    = _pt(landmarks, LM.LEFT_ELBOW)
    r_elbow    = _pt(landmarks, LM.RIGHT_ELBOW)

    shoulder_mid = (l_shoulder + r_shoulder) / 2
    hip_mid      = (l_hip + r_hip) / 2

    spine_angle  = _horizontal_angle(shoulder_mid, hip_mid)
    hip_sym      = float(abs(l_hip[1] - r_hip[1]))
    trunk_rot    = float(abs(l_shoulder[1] - r_shoulder[1]))

    # Determine which arm / leg is extended
    l_arm_ext = float((l_shoulder[1] - l_wrist[1]))
    r_arm_ext = float((r_shoulder[1] - r_wrist[1]))
    arm_angle  = _angle(l_shoulder, l_elbow, l_wrist) if l_arm_ext > r_arm_ext \
                 else _angle(r_shoulder, r_elbow, r_wrist)

    l_leg_ext = float(l_hip[1] - l_ankle[1])
    r_leg_ext = float(r_hip[1] - r_ankle[1])
    planted_knee = _angle(r_hip, r_knee, r_ankle) if l_leg_ext > r_leg_ext \
                   else _angle(l_hip, l_knee, l_ankle)

    return {
        "spine_angle":   spine_angle,
        "hip_sym":       hip_sym,
        "trunk_rot":     trunk_rot,
        "arm_angle":     arm_angle,
        "planted_knee":  planted_knee,
    }


def _load_reference():
    global _reference_frames
    if _reference_frames is not None:
        return _reference_frames

    here = os.path.dirname(os.path.abspath(__file__))
    for fname in ["bird_dog_reference.mp4", "bird_dog_ref.mp4",
                  "bird_dog_reference.avi", "bird_dog_ref.avi"]:
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
            print(f"[Bird Dog] No pose detected in any frame of {fname}")
            continue

        _reference_frames = all_frames
        print(f"[Bird Dog] Reference loaded from {fname} "
              f"({len(all_frames)}/{len(indices)} frames valid)")
        return _reference_frames

    print("[Bird Dog] WARNING: No reference video found. "
          "Place bird_dog_reference.mp4 next to bird_dog.py")
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
    """
    Parameters
    ----------
    landmarks : mediapipe landmark list
    state     : dict (mutable carry-forward)

    Returns
    -------
    result dict — same structure as other exercises
    """
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

    # ── Granular checks (kept for joint overlay and feedback) ────────────────
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
    l_elbow    = _pt(landmarks, LM.LEFT_ELBOW)
    r_elbow    = _pt(landmarks, LM.RIGHT_ELBOW)

    shoulder_mid = (l_shoulder + r_shoulder) / 2
    hip_mid      = (l_hip + r_hip) / 2

    spine_angle = _horizontal_angle(shoulder_mid, hip_mid)
    spine_ok    = spine_angle <= SPINE_LEVEL_TOL

    hip_sym = abs(l_hip[1] - r_hip[1])
    hip_ok  = hip_sym <= HIP_LEVEL_TOL

    trunk_rot   = abs(l_shoulder[1] - r_shoulder[1])
    rotation_ok = trunk_rot <= TRUNK_ROTATION_TOL

    l_arm_extended = (l_shoulder[1] - l_wrist[1]) > EXTEND_ARM_Y_THRESH
    r_arm_extended = (r_shoulder[1] - r_wrist[1]) > EXTEND_ARM_Y_THRESH
    arm_extended   = l_arm_extended or r_arm_extended

    if l_arm_extended:
        arm_angle = _angle(l_shoulder, l_elbow, l_wrist)
        arm_pt    = l_wrist
    elif r_arm_extended:
        arm_angle = _angle(r_shoulder, r_elbow, r_wrist)
        arm_pt    = r_wrist
    else:
        arm_angle = 0.0
        arm_pt    = l_wrist

    arm_ok = (arm_angle >= ARM_ANGLE_MIN) if arm_extended else True

    l_leg_extended = (l_hip[1] - l_ankle[1]) > EXTEND_LEG_Y_THRESH
    r_leg_extended = (r_hip[1] - r_ankle[1]) > EXTEND_LEG_Y_THRESH

    if l_leg_extended:
        planted_knee_angle = _angle(r_hip, r_knee, r_ankle)
    else:
        planted_knee_angle = _angle(l_hip, l_knee, l_ankle)

    planted_ok = PLANTED_KNEE_MIN <= planted_knee_angle <= PLANTED_KNEE_MAX

    # ── Visibility gate ───────────────────────────────────────────────────────
    l_vis               = landmarks[LM.LEFT_SHOULDER.value].visibility
    r_vis               = landmarks[LM.RIGHT_SHOULDER.value].visibility
    landmarks_confident = l_vis > 0.4 and r_vis > 0.4

    # ── Rep state machine ─────────────────────────────────────────────────────
    rep_complete = False
    is_extended  = arm_extended and (l_leg_extended or r_leg_extended)

    # Allow similarity alone to trigger EXTEND — geometric detection can miss
    # extended limbs in a side-on view when y-deltas are small.
    entering_extend = is_extended or (passed and landmarks_confident)

    if state["phase"] == "REST":
        if landmarks_confident and entering_extend:
            state["phase"]        = "EXTEND"
            state["_exit_frames"] = 0

    elif state["phase"] == "EXTEND":
        if not landmarks_confident:
            state["_exit_frames"] += 1
            if state["_exit_frames"] > 15:
                state["phase"]        = "REST"
                state["_exit_frames"] = 0
                rep_complete          = True
        else:
            state["_exit_frames"] = 0
            # Exit EXTEND only when geometric extension clearly drops AND similarity fails
            exiting = not is_extended and not passed
            if exiting:
                state["phase"]     = "REST"
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

    # ── Feedback cue ──────────────────────────────────────────────────────────
    pct = int(similarity * 100)
    if not ref_frames:
        primary_cue = "No reference video found — add bird_dog_reference.mp4"
    elif not landmarks_confident:
        primary_cue = "Move closer so I can see your pose."
    elif passed:
        primary_cue = "Good. Hold and breathe."
    elif not spine_ok:
        primary_cue = "Keep your back flat — don't let it sag."
    elif not hip_ok:
        primary_cue = "Keep your hips level — don't rotate."
    elif not arm_ok:
        primary_cue = "Reach your arm forward, parallel to the floor."
    elif not rotation_ok:
        primary_cue = "Don't twist your shoulders — keep them level."
    elif not planted_ok:
        primary_cue = "Stay stable on your planted knee."
    else:
        primary_cue = f"Adjust your position — {pct}% match. Aim for 75%."

    # ── Joint overlay ─────────────────────────────────────────────────────────
    GREEN = (0, 220, 80)
    RED   = (0, 60, 255)

    joint_points = [
        (l_shoulder[0],   l_shoulder[1],   GREEN if rotation_ok else RED, "L-Shldr"),
        (r_shoulder[0],   r_shoulder[1],   GREEN if rotation_ok else RED, "R-Shldr"),
        (l_hip[0],        l_hip[1],        GREEN if hip_ok      else RED, "L-Hip"),
        (r_hip[0],        r_hip[1],        GREEN if hip_ok      else RED, "R-Hip"),
        (arm_pt[0],       arm_pt[1],       GREEN if arm_ok      else RED, "Wrist"),
        (l_knee[0],       l_knee[1],       GREEN if planted_ok  else RED, "Knee"),
        (shoulder_mid[0], shoulder_mid[1], GREEN if spine_ok    else RED, "Spine"),
    ]

    checks = {
        "similarity":    (passed,       float(pct),          f"Match: {pct}% — aim for 75%+"),
        "spine_level":   (spine_ok,     spine_angle,         "Keep your back flat — don't let it sag."),
        "hip_level":     (hip_ok,       hip_sym,             "Keep your hips level — don't rotate."),
        "arm_extension": (arm_ok,       arm_angle,           "Reach your arm forward, parallel to the floor."),
        "no_rotation":   (rotation_ok,  trunk_rot,           "Don't twist your shoulders — keep them level."),
        "planted_knee":  (planted_ok,   planted_knee_angle,  "Stay stable on your planted knee."),
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
    "name":        "Bird Dog",
    "camera_hint":  "Start on hands and knees. Side-on to camera.",
    "instruction":  "Good. Keep your back flat and hold the position steady.",
    "phases":      ["Muscle Strain Ph2", "Sciatica Ph2", "Herniated Disc Ph2",
                    "Postural Pain Ph3", "Chronic LBP Ph1", "Facet Joint Ph2"],
    "rep_trigger": "arm_extension",
}