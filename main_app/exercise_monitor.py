"""
exercise_monitor.py
════════════════════════════════════════════════════════════════════
SpineGuard AI  —  Exercise Monitor  (standalone, separate from spineguard.py)

Usage
─────
    python exercise_monitor.py [exercise] [reference_video.mp4]

    exercise options : pelvic_tilt | glute_bridge | bird_dog
                       (default: glute_bridge)

    e.g.
        python exercise_monitor.py glute_bridge
        python exercise_monitor.py bird_dog  ref_bird_dog.mp4

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
    "pelvic_tilt":  "exercises.pelvic_tilt",
    "glute_bridge": "exercises.glute_bridge",
    "bird_dog":     "exercises.bird_dog",
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
    def __init__(self):
        self._queue  = queue.Queue()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def _worker(self):
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty('rate',   165)
            engine.setProperty('volume', 1.0)
        except Exception as e:
            print(f"[TTS] Engine init failed: {e}")
            return
        while True:
            text = self._queue.get()
            if text is None:
                break
            try:
                engine.say(text)
                engine.runAndWait()
            except Exception as e:
                print(f"[TTS] Speech error: {e}")
            finally:
                self._queue.task_done()

    def speak(self, text):
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
                self._queue.task_done()
            except queue.Empty:
                break
        self._queue.put(text)

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
    cv2.putText(frame, f"{exercise_name}   Reps: {rep_count}",
                (18, y0 + 20), font, 0.50, (220, 220, 220), 1)

    for i, (check_name, (passed, value, _cue)) in enumerate(checks.items()):
        y     = y0 + 20 + (i + 1) * 22
        color = (0, 220, 80) if passed else (0, 80, 255)
        icon  = "✓" if passed else "✗"
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

        # ── Draw MediaPipe skeleton ───────────────────────────────────────────
        mp_drawing.draw_landmarks(
            frame, res.pose_landmarks, mp_pose.POSE_CONNECTIONS,
            landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style()
        )

        # ── Per-joint coloured dots ───────────────────────────────────────────
        frame = draw_joint_overlay(frame, joints)

        # ── Check panel (bottom-left HUD) ─────────────────────────────────────
        frame = draw_check_panel(frame, checks, self.rep_count, ex_name)

        # ── Cue banner (very bottom strip) ────────────────────────────────────
        frame = draw_cue_banner(frame, cue, passed)

        # ── Corner label ─────────────────────────────────────────────────────
        cv2.putText(frame, "YOU", (PANEL_W - 65, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 220, 255), 2)

        # ── Voice alert (throttled) ───────────────────────────────────────────
        now = time.time()
        if cue != self.last_cue or (now - self.last_cue_time) >= FEEDBACK_COOLDOWN:
            if not passed:
                self.tts.speak(cue)
            self.last_cue      = cue
            self.last_cue_time = now

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