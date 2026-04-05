"""
exercise_monitor.py
════════════════════════════════════════════════════════════════════
SpineGuard AI  —  Exercise Monitor  (standalone, separate from spineguard.py)

Usage
─────
    python exercise_monitor.py [exercise] [reference_video.mp4]

    exercise options : pelvic_tilt | glute_bridge | bird_dog | chin_tuck
                       cat_cow | child_pose | dead_bug | hamstring_stretch
                       hip_abduction | lunge | mckenzie_pressup | nerve_glide
                       piriformis_stretch | plank | resistance_band_row
                       scapular_retraction | squat | standing_back_extension
                       thoracic_extension | wall_angels | walking
                       (default: glute_bridge)

    e.g.
        python exercise_monitor.py chin_tuck
        python exercise_monitor.py glute_bridge ref_glute_bridge.mp4

Keys during session
───────────────────
    1  →  Pelvic Tilt
    2  →  Glute Bridge
    3  →  Bird Dog
    r  →  Reset rep counter
    q  →  Quit
════════════════════════════════════════════════════════════════════
"""

import cv2
import mediapipe as mp
import numpy as np
import time
import threading
import queue
import sys
import os
import importlib

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# ── Display ───────────────────────────────────────────────────────────────────
PANEL_W   = 640
PANEL_H   = 480
DIVIDER_W = 4
HEADER_H  = 34

# ── Feedback cooldown (seconds) ───────────────────────────────────────────────
FEEDBACK_COOLDOWN = 4

# ── Exercise registry ─────────────────────────────────────────────────────────
EXERCISE_MAP = {
    "pelvic_tilt":         "exercises.pelvic_tilt",
    "glute_bridge":        "exercises.glute_bridge",
    "bird_dog":            "exercises.bird_dog",
    "chin_tuck":           "exercises.chin_tuck",
    "cat_cow":             "exercises.cat_cow",
    "child_pose":          "exercises.child_pose",
    "dead_bug":            "exercises.dead_bug",
    "hamstring_stretch":   "exercises.hamstring_stretch",
    "hip_abduction":       "exercises.hip_abduction",
    "lunge":               "exercises.lunge",
    "mckenzie_pressup":    "exercises.mckenzie_pressup",
    "nerve_glide":         "exercises.nerve_glide",
    "piriformis_stretch":  "exercises.piriformis_stretch",
    "plank":               "exercises.plank",
    "resistance_band_row": "exercises.resistance_band_row",
    "scapular_retraction": "exercises.scapular_retraction",
    "squat":               "exercises.squat",
    "standing_back_extension": "exercises.standing_back_extension",
    "thoracic_extension":  "exercises.thoracic_extension",
    "wall_angels":         "exercises.wall_angels",
    "walking":             "exercises.walking",
}
KEY_MAP = {
    ord('1'): "pelvic_tilt",
    ord('2'): "glute_bridge",
    ord('3'): "bird_dog",
}


# ══════════════════════════════════════════════════════════════════════════════
#  TTS Speaker  (queue-based — same pattern as spineguard.py)
# ══════════════════════════════════════════════════════════════════════════════
class TTSSpeaker:
    """
    Queue-based TTS worker.
    Two channels:
      • speak()          — normal coaching cue  (drops stale cues if a new one arrives)
      • speak_priority() — high-priority cue    (pre-empts the normal queue, e.g. countdown)

    Enhanced with per-check cooldown tracking so individual joint corrections
    (e.g. "keep your back flat", "level your hips") can be cycled independently.
    """
    def __init__(self):
        self._queue          = queue.Queue()
        self._priority       = queue.Queue()   # countdown beats coaching
        self._check_cooldown = {}              # check_name -> last_spoken_time
        self._check_interval = 6.0            # seconds between repeating same check cue
        self._cycle_interval = 3.0            # seconds before moving to next failing check
        self._last_cycle_at  = 0.0            # when we last spoke any check cue
        self._thread         = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def _worker(self):
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty('rate',   180)   # slightly faster for countdown
            engine.setProperty('volume', 1.0)
        except Exception as e:
            print(f"[TTS] Engine init failed: {e}")
            return
        while True:
            # Priority queue always wins
            try:
                text = self._priority.get_nowait()
            except queue.Empty:
                text = self._queue.get()   # blocks until normal cue arrives
            if text is None:
                break
            try:
                engine.say(text)
                engine.runAndWait()
            except Exception as e:
                print(f"[TTS] Speech error: {e}")
            finally:
                try:
                    self._queue.task_done()
                except Exception:
                    pass

    def speak(self, text):
        """Speak a coaching cue, discarding any stale queued cue first."""
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
                self._queue.task_done()
            except queue.Empty:
                break
        self._queue.put(text)

    def speak_priority(self, text):
        """Speak immediately, pre-empting normal coaching queue."""
        self._priority.put(text)

    def speak_checks(self, checks: dict):
        """
        Rotate through all failing checks and speak the next due cue.

        Strategy:
        - Only one cue fires per call (don't flood the user).
        - Each check_name has its own cooldown (_check_interval) so the same
          instruction isn't repeated for that joint too quickly.
        - Between checks we enforce a shorter gap (_cycle_interval) to keep
          coaching spaced out even when many checks fail simultaneously.
        - We cycle through failing checks in order so the user hears each
          distinct correction within a few seconds.
        """
        import time
        now = time.time()

        # Enforce minimum gap between any two check cues
        if now - self._last_cycle_at < self._cycle_interval:
            return

        # Collect all failing checks that have a usable cue
        failing = [
            (name, cue)
            for name, (passed, _value, cue) in checks.items()
            if not passed and cue
        ]
        if not failing:
            return

        # Find the check whose cue is most overdue (longest since spoken)
        best_name, best_cue = max(
            failing,
            key=lambda nc: now - self._check_cooldown.get(nc[0], 0.0)
        )

        # Only speak if its per-check cooldown has expired
        last_spoken = self._check_cooldown.get(best_name, 0.0)
        if now - last_spoken < self._check_interval:
            return

        self.speak(best_cue)
        self._check_cooldown[best_name] = now
        self._last_cycle_at = now

    def stop(self):
        self._queue.put(None)


# ══════════════════════════════════════════════════════════════════════════════
#  Model Video Player  (loops reference .mp4 — same as spineguard.py)
# ══════════════════════════════════════════════════════════════════════════════
class ModelVideoPlayer:
    def __init__(self, video_path=None):
        self.cap = None
        self._load(video_path)

    def _load(self, path):
        if path and os.path.isfile(path):
            self.cap = cv2.VideoCapture(path)
            if not self.cap.isOpened():
                self.cap = None
        else:
            self.cap = None

    def load(self, path):
        if self.cap:
            self.cap.release()
        self._load(path)

    def get_frame(self, exercise_name="", camera_hint=""):
        if self.cap and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self.cap.read()
            if ret:
                frame = cv2.resize(frame, (PANEL_W, PANEL_H))
                cv2.putText(frame, "REFERENCE", (PANEL_W - 148, PANEL_H - 15),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (140, 210, 140), 2)
                return frame

        # Placeholder
        ph = np.full((PANEL_H, PANEL_W, 3), (28, 28, 28), dtype=np.uint8)
        font = cv2.FONT_HERSHEY_SIMPLEX
        lines = [
            (exercise_name or "MODEL REFERENCE", 0.75, (180, 180, 180), 2, PANEL_H//2 - 70),
            ("No reference video loaded",          0.52, (120, 120, 120), 1, PANEL_H//2 - 20),
        ]
        if camera_hint:
            lines.append((camera_hint, 0.44, (100, 160, 100), 1, PANEL_H//2 + 18))
        lines += [
            ("Pass a .mp4 as CLI argument",         0.40, ( 90,  90,  90), 1, PANEL_H//2 + 52),
            ("python exercise_monitor.py <ex> <vid>",0.36, ( 75,  75,  75), 1, PANEL_H//2 + 80),
        ]
        for text, scale, color, thick, y in lines:
            tw = cv2.getTextSize(text, font, scale, thick)[0][0]
            cv2.putText(ph, text, ((PANEL_W - tw)//2, y), font, scale, color, thick)

        for x in range(0, PANEL_W, 20):
            cv2.line(ph, (x, 2),         (x+10, 2),         (55,55,55), 1)
            cv2.line(ph, (x, PANEL_H-3), (x+10, PANEL_H-3), (55,55,55), 1)
        for y in range(0, PANEL_H, 20):
            cv2.line(ph, (2, y),         (2, y+10),         (55,55,55), 1)
            cv2.line(ph, (PANEL_W-3, y), (PANEL_W-3, y+10), (55,55,55), 1)
        return ph

    def release(self):
        if self.cap:
            self.cap.release()


# ══════════════════════════════════════════════════════════════════════════════
#  Per-Joint Feedback Overlay
# ══════════════════════════════════════════════════════════════════════════════
def draw_joint_overlay(frame, joint_points):
    """Draw coloured dots + labels on key joints."""
    h, w, _ = frame.shape
    font = cv2.FONT_HERSHEY_SIMPLEX
    for xn, yn, color, label in joint_points:
        px, py = int(xn * w), int(yn * h)
        cv2.circle(frame, (px, py), 10, color, -1)
        cv2.circle(frame, (px, py), 10, (255,255,255), 1)  # white ring
        cv2.putText(frame, label, (px + 12, py + 5), font, 0.38, color, 1)
    return frame


# ══════════════════════════════════════════════════════════════════════════════
#  Check Panel (bottom strip showing per-joint pass/fail)
# ══════════════════════════════════════════════════════════════════════════════
def draw_check_panel(frame, checks, rep_count, exercise_name):
    """
    Draws a semi-transparent HUD at the bottom of the user panel
    showing each check's name, value, and pass/fail status.
    """
    h, w, _ = frame.shape
    font     = cv2.FONT_HERSHEY_SIMPLEX

    panel_h = 28 + len(checks) * 22 + 10
    y0      = h - panel_h - 5

    ov = frame.copy()
    cv2.rectangle(ov, (10, y0), (320, h - 5), (0, 0, 0), -1)
    cv2.addWeighted(ov, 0.65, frame, 0.35, 0, frame)

    # Exercise name + rep count header
    header_text = f"{exercise_name}   Reps: {rep_count}"
    cv2.putText(frame, header_text,
                (18, y0 + 20), font, 0.50, (220, 220, 220), 1)

    for i, (check_name, (passed, value, _cue)) in enumerate(checks.items()):
        y     = y0 + 20 + (i + 1) * 22
        color = (0, 220, 80) if passed else (0, 80, 255)
        icon  = "[OK]" if passed else "[X]"
        label = check_name.replace("_", " ").title()

        if isinstance(value, float):
            val_str = f"{value:.1f}"
        else:
            val_str = str(value)

        cv2.putText(frame, f"{icon}  {label}: {val_str}", (18, y), font, 0.40, color, 1)

    return frame


# ══════════════════════════════════════════════════════════════════════════════
#  Cue Banner (top of frame — large readable feedback message)
# ══════════════════════════════════════════════════════════════════════════════
def draw_cue_banner(frame, cue, passed):
    h, w, _ = frame.shape
    font    = cv2.FONT_HERSHEY_SIMPLEX
    color   = (0, 200, 80) if passed else (0, 120, 255)

    ov = frame.copy()
    cv2.rectangle(ov, (0, h - 55), (w, h), (0, 0, 0), -1)
    cv2.addWeighted(ov, 0.6, frame, 0.4, 0, frame)

    # Wrap long text
    words     = cue.split()
    line, lines_out = "", []
    for word in words:
        test = (line + " " + word).strip()
        if cv2.getTextSize(test, font, 0.52, 1)[0][0] > w - 30:
            lines_out.append(line)
            line = word
        else:
            line = test
    lines_out.append(line)

    for i, ln in enumerate(lines_out[:2]):
        cv2.putText(frame, ln, (15, h - 40 + i * 22), font, 0.52, color, 1)

    return frame


# ══════════════════════════════════════════════════════════════════════════════
#  Split-Screen Compositor
# ══════════════════════════════════════════════════════════════════════════════
def build_split_screen(user_panel, model_panel, exercise_name):
    divider  = np.full((PANEL_H, DIVIDER_W, 3), (70, 70, 70), dtype=np.uint8)
    combined = np.hstack([user_panel, divider, model_panel])

    header        = np.zeros((HEADER_H, combined.shape[1], 3), dtype=np.uint8)
    header[:]     = (18, 18, 18)
    font          = cv2.FONT_HERSHEY_SIMPLEX

    cv2.putText(header, f"LIVE FEED  —  {exercise_name}",
                (18, 23), font, 0.54, (180, 220, 255), 1)
    cv2.putText(header, "MODEL REFERENCE  —  Physiotherapist",
                (PANEL_W + DIVIDER_W + 18, 23), font, 0.54, (180, 255, 180), 1)

    # Key hints on far right
    cv2.putText(header, "1:PelvicTilt  2:GluteBridge  3:BirdDog  r:Reset  q:Quit",
                (PANEL_W + DIVIDER_W + 18, 23),
                font, 0.34, (120, 120, 120), 1)

    cv2.line(header, (0, HEADER_H-1), (combined.shape[1], HEADER_H-1), (50,50,50), 1)
    return np.vstack([header, combined])


# ══════════════════════════════════════════════════════════════════════════════
#  Hold Timer Overlay (for time-based exercises like planks)
# ══════════════════════════════════════════════════════════════════════════════
def draw_hold_timer(frame, hold_time, hold_target):
    """Draw a hold timer with progress bar at the top-right of the user panel."""
    h, w, _ = frame.shape
    font = cv2.FONT_HERSHEY_SIMPLEX

    elapsed = min(hold_time, hold_target)
    remaining = max(hold_target - hold_time, 0)
    progress = hold_time / hold_target if hold_target > 0 else 0

    # Timer box dimensions
    box_w = 200
    box_h = 60
    box_x = w - box_w - 12
    box_y = 10

    # Background
    ov = frame.copy()
    cv2.rectangle(ov, (box_x, box_y), (box_x + box_w, box_y + box_h), (0, 0, 0), -1)
    cv2.addWeighted(ov, 0.7, frame, 0.3, 0, frame)
    cv2.rectangle(frame, (box_x, box_y), (box_x + box_w, box_y + box_h), (100, 100, 100), 1)

    # Progress bar
    bar_x = box_x + 8
    bar_y = box_y + 8
    bar_w = box_w - 16
    bar_h = 8
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (60, 60, 60), -1)
    fill_w = int(bar_w * min(progress, 1.0))
    bar_color = (0, 220, 80) if progress >= 1.0 else (0, 180, 255)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), bar_color, -1)

    # Timer text
    if progress >= 1.0:
        timer_text = "COMPLETE!"
        timer_color = (0, 220, 80)
    else:
        timer_text = f"Hold: {elapsed:.0f}s / {hold_target:.0f}s"
        timer_color = (220, 220, 220)

    cv2.putText(frame, timer_text, (box_x + 10, box_y + 36), font, 0.55, timer_color, 1)

    # Remaining time
    if progress < 1.0:
        remain_text = f"{remaining:.0f}s remaining"
        cv2.putText(frame, remain_text, (box_x + 10, box_y + 52), font, 0.40, (150, 150, 150), 1)
    else:
        done_text = "Timer complete — well done!"
        tw = cv2.getTextSize(done_text, font, 0.36, 1)[0][0]
        cv2.putText(frame, done_text, (box_x + (box_w - tw) // 2, box_y + 52), font, 0.36, (0, 220, 80), 1)

    return frame


# ══════════════════════════════════════════════════════════════════════════════
#  Exercise Monitor  (main class)
# ══════════════════════════════════════════════════════════════════════════════
class ExerciseMonitor:
    def __init__(self, exercise_key="glute_bridge"):
        self.pose = mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            model_complexity=1
        )
        self.tts              = TTSSpeaker()
        self.last_cue_time    = 0
        self.last_cue         = ""
        self.exercise_state   = None   # carries rep state between frames
        self.rep_count        = 0
        self.exercise_module  = None
        self.exercise_meta    = {}

        # Voice countdown state
        self._countdown_last  = -1     # last integer second spoken during countdown
        self._last_phase      = None   # detect phase transitions
        self._intro_spoken    = False  # speak coaching intro once per HOLD entry

        self.load_exercise(exercise_key)

    # ── Exercise hot-swap ─────────────────────────────────────────────────────
    def load_exercise(self, key):
        module_path = EXERCISE_MAP.get(key)
        if not module_path:
            print(f"[Monitor] Unknown exercise key: {key}")
            return

        # Add the directory of this file to sys.path so 'exercises.*' resolves
        here = os.path.dirname(os.path.abspath(__file__))
        if here not in sys.path:
            sys.path.insert(0, here)

        try:
            mod = importlib.import_module(module_path)
            importlib.reload(mod)            # allow hot-swap
            self.exercise_module = mod
            self.exercise_meta   = mod.META
            self.exercise_state  = None      # reset state on swap
            self.rep_count       = 0
            name = mod.META.get("name", key)
            print(f"[Monitor] Loaded exercise: {name}")
            self.tts.speak(f"Exercise loaded: {name}.")
        except Exception as e:
            print(f"[Monitor] Failed to load exercise '{key}': {e}")

    def reset_reps(self):
        self.exercise_state = None
        self.rep_count      = 0
        print("[Monitor] Rep counter reset.")

    # ── Per-frame processing ──────────────────────────────────────────────────
    def process_frame(self, frame):
        frame = cv2.resize(frame, (PANEL_W, PANEL_H))
        rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res   = self.pose.process(rgb)

        if not res.pose_landmarks or not self.exercise_module:
            cv2.putText(frame,
                        "No pose detected — position yourself in frame",
                        (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 80, 255), 1)
            return frame

        lm = res.pose_landmarks.landmark

        # Run the exercise evaluator
        result = self.exercise_module.evaluate(lm, state=self.exercise_state)

        # Carry state forward (rep counter lives here)
        self.exercise_state = result.get("state", self.exercise_state)
        if result.get("rep_complete"):
            self.rep_count += 1

        passed     = result["passed"]
        cue        = result["primary_cue"]
        checks     = result["checks"]
        joints     = result["joint_points"]
        ex_name    = self.exercise_meta.get("name", "Exercise")
        is_time_based = result.get("is_time_based", False)
        hold_time  = result.get("hold_time", 0.0)
        hold_target = result.get("hold_target", 30.0)

        # ── Draw MediaPipe skeleton ───────────────────────────────────────────
        # ── Draw left-side skeleton only, hide all right-side landmarks ───────
        LEFT_CONNECTIONS = [
            (mp_pose.PoseLandmark.LEFT_SHOULDER, mp_pose.PoseLandmark.LEFT_ELBOW),
            (mp_pose.PoseLandmark.LEFT_ELBOW,    mp_pose.PoseLandmark.LEFT_WRIST),
            (mp_pose.PoseLandmark.LEFT_SHOULDER, mp_pose.PoseLandmark.LEFT_HIP),
            (mp_pose.PoseLandmark.LEFT_HIP,      mp_pose.PoseLandmark.LEFT_KNEE),
            (mp_pose.PoseLandmark.LEFT_KNEE,     mp_pose.PoseLandmark.LEFT_ANKLE),
            (mp_pose.PoseLandmark.LEFT_ANKLE,    mp_pose.PoseLandmark.LEFT_FOOT_INDEX),
        ]
        HIDDEN = {
            mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
            mp_pose.PoseLandmark.RIGHT_ELBOW.value,
            mp_pose.PoseLandmark.RIGHT_WRIST.value,
            mp_pose.PoseLandmark.RIGHT_HIP.value,
            mp_pose.PoseLandmark.RIGHT_KNEE.value,
            mp_pose.PoseLandmark.RIGHT_ANKLE.value,
            mp_pose.PoseLandmark.RIGHT_FOOT_INDEX.value,
            mp_pose.PoseLandmark.RIGHT_PINKY.value,
            mp_pose.PoseLandmark.RIGHT_INDEX.value,
            mp_pose.PoseLandmark.RIGHT_THUMB.value,
            mp_pose.PoseLandmark.RIGHT_EAR.value,
            mp_pose.PoseLandmark.RIGHT_EYE.value,
            mp_pose.PoseLandmark.RIGHT_EYE_INNER.value,
            mp_pose.PoseLandmark.RIGHT_EYE_OUTER.value,
        }
        landmark_spec = {
            idx: (
                mp_drawing.DrawingSpec(color=(0,0,0), thickness=0, circle_radius=0)
                if idx in HIDDEN else
                mp_drawing.DrawingSpec(color=(200,200,200), thickness=1, circle_radius=2)
            )
            for idx in range(33)
        }
        line_spec = mp_drawing.DrawingSpec(color=(180, 180, 180), thickness=1)
        mp_drawing.draw_landmarks(
            frame, res.pose_landmarks,
            connections=[(a.value, b.value) for a, b in LEFT_CONNECTIONS],
            landmark_drawing_spec=landmark_spec,
            connection_drawing_spec=line_spec,
        )

        # ── Per-joint coloured dots ───────────────────────────────────────────
        frame = draw_joint_overlay(frame, joints)

        # ── Check panel (bottom-left HUD) ─────────────────────────────────────
        frame = draw_check_panel(frame, checks, self.rep_count, ex_name)

        # ── Hold timer overlay (for time-based exercises) ─────────────────────
        if is_time_based:
            frame = draw_hold_timer(frame, hold_time, hold_target)

        # ── Cue banner (very bottom strip) ────────────────────────────────────
        frame = draw_cue_banner(frame, cue, passed)

        # ── Corner label ─────────────────────────────────────────────────────
        cv2.putText(frame, "YOU", (PANEL_W - 65, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 220, 255), 2)

        # ── Voice logic ───────────────────────────────────────────────────────
        current_phase = (self.exercise_state or {}).get("phase", "REST")
        now           = time.time()

        # 1. Phase-entry announcements
        entered_hold   = current_phase in ("HOLD", "EXTEND") and self._last_phase not in ("HOLD", "EXTEND")
        exited_hold    = current_phase == "REST" and self._last_phase in ("HOLD", "EXTEND")

        if entered_hold:
            # Speak the exercise-specific coaching instruction once on entry
            instruction = self.exercise_meta.get("instruction",
                          self.exercise_meta.get("cue", cue))
            self.tts.speak(instruction)
            self._intro_spoken   = True
            self._countdown_last = -1      # reset countdown for this rep

        # 2. Rep-completion announcement (on exit from hold → REST)
        if exited_hold:
            rep_num = self.rep_count
            if rep_num > 0:
                self.tts.speak_priority(f"Rep {rep_num} complete. Well done.")

        # 3. Corrective per-check coaching (the main upgrade)
        #    When form is wrong, cycle through ALL failing check cues so the
        #    user hears specific joint corrections (e.g. "keep your back flat",
        #    "level your hips") rather than just one generic primary cue.
        if not passed:
            if len(checks) > 1:
                # Multi-check exercises: rotate through each failing check cue
                self.tts.speak_checks(checks)
            else:
                # Single-check (similarity-only) exercises: use primary_cue with cooldown
                if cue != self.last_cue or (now - self.last_cue_time) >= FEEDBACK_COOLDOWN:
                    self.tts.speak(cue)
                    self.last_cue      = cue
                    self.last_cue_time = now

        # 4. Positive reinforcement when form is consistently good during hold
        if passed and current_phase in ("HOLD", "EXTEND"):
            if cue != self.last_cue or (now - self.last_cue_time) >= FEEDBACK_COOLDOWN * 2:
                self.tts.speak(cue)   # e.g. "Good bridge. Squeeze your glutes."
                self.last_cue      = cue
                self.last_cue_time = now

        # 5. Last-5-second countdown (priority channel, fires once per second)
        if is_time_based and current_phase in ("HOLD", "EXTEND") and hold_target > 0:
            remaining = hold_target - hold_time
            if 0 < remaining <= 5.0:
                tick = int(remaining)          # floor to whole seconds: 5,4,3,2,1
                if tick != self._countdown_last and tick >= 1:
                    self.tts.speak_priority(str(tick))
                    self._countdown_last = tick
            elif remaining <= 0 and self._countdown_last != 0:
                self.tts.speak_priority("Great job! Come back to start.")
                self._countdown_last = 0

        self._last_phase = current_phase

        return frame

    def release(self):
        self.pose.close()
        self.tts.stop()


# ══════════════════════════════════════════════════════════════════════════════
#  Main
# ══════════════════════════════════════════════════════════════════════════════
def main():
    # CLI: python exercise_monitor.py [exercise_key] [ref_video.mp4]
    args          = sys.argv[1:]
    exercise_key  = args[0] if args and args[0] in EXERCISE_MAP else "glute_bridge"
    ref_video     = args[1] if len(args) > 1 else (args[0] if args and args[0].endswith(".mp4") else None)

    monitor = ExerciseMonitor(exercise_key)
    player  = ModelVideoPlayer(ref_video)

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  PANEL_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, PANEL_H)

    print("=" * 65)
    print("  SpineGuard AI  —  Exercise Monitor")
    print("=" * 65)
    print("  Keys:  1=Pelvic Tilt  2=Glute Bridge  3=Bird Dog")
    print("         r=Reset reps   q=Quit")
    print("=" * 65)

    while cap.isOpened():
        ret, raw = cap.read()
        if not ret:
            break

        raw = cv2.flip(raw, 1)

        user_panel  = monitor.process_frame(raw.copy())
        #user_panel = cv2.flip(user_panel, 1)

        meta        = monitor.exercise_meta
        model_panel = player.get_frame(
            exercise_name=meta.get("name", ""),
            camera_hint=meta.get("camera_hint", "")
        )

        split = build_split_screen(user_panel, model_panel,
                                   meta.get("name", "Exercise"))
        cv2.imshow("SpineGuard AI  —  Exercise Monitor", split)

        key = cv2.waitKey(5) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('r'):
            monitor.reset_reps()
        elif key in KEY_MAP:
            monitor.load_exercise(KEY_MAP[key])

    cap.release()
    player.release()
    cv2.destroyAllWindows()
    monitor.release()


if __name__ == "__main__":
    main()