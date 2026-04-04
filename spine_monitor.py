import cv2
import mediapipe as mp
import numpy as np
import time
import threading
import queue
import sys
import os

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# ── Posture thresholds ────────────────────────────────────────────────────────
DEVIATION_THRESHOLD     = 12
WARNING_THRESHOLD       = 20
NEUTRAL_SPINE_TOLERANCE = 5
SMOOTHING_FACTOR        = 0.3
ALERT_COOLDOWN          = 5

# ── Display ───────────────────────────────────────────────────────────────────
PANEL_W   = 640
PANEL_H   = 480
DIVIDER_W = 4


# ══════════════════════════════════════════════════════════════════════════════
#  TTS Speaker  (queue-based, single dedicated thread)
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
            engine.setProperty('rate',   180)
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
#  Model Video Player  (loops a reference .mp4 file)
# ══════════════════════════════════════════════════════════════════════════════
class ModelVideoPlayer:
    """
    Wraps a cv2.VideoCapture that loops continuously.
    Falls back to a styled placeholder frame if no video is provided.
    """

    def __init__(self, video_path=None):
        self.cap        = None
        self.video_path = video_path
        self._load(video_path)

    def _load(self, path):
        if path and os.path.isfile(path):
            self.cap = cv2.VideoCapture(path)
            if not self.cap.isOpened():
                print(f"[ModelPlayer] Could not open: {path}")
                self.cap = None
        else:
            if path:
                print(f"[ModelPlayer] File not found: {path}")
            self.cap = None

    def load(self, path):
        """Hot-swap the reference video at runtime."""
        if self.cap:
            self.cap.release()
        self._load(path)
        self.video_path = path

    def get_frame(self):
        """Return next looped frame resized to (PANEL_W, PANEL_H)."""
        if self.cap and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self.cap.read()
            if ret:
                return cv2.resize(frame, (PANEL_W, PANEL_H))

        # ── Placeholder ───────────────────────────────────────────────────────
        ph = np.full((PANEL_H, PANEL_W, 3), (30, 30, 30), dtype=np.uint8)

        font  = cv2.FONT_HERSHEY_SIMPLEX
        lines = [
            ("MODEL REFERENCE",     0.80, (180, 180, 180), 2, PANEL_H//2 - 60),
            ("No video loaded",     0.60, (120, 120, 120), 1, PANEL_H//2 - 10),
            ("Supply a .mp4 path",  0.48, (100, 100, 100), 1, PANEL_H//2 + 25),
            ("as a CLI argument",   0.48, (100, 100, 100), 1, PANEL_H//2 + 52),
            ("python spineguard.py  exercise.mp4",
                                    0.40, ( 80,  80,  80), 1, PANEL_H//2 + 85),
        ]
        for text, scale, color, thick, y in lines:
            tw = cv2.getTextSize(text, font, scale, thick)[0][0]
            cv2.putText(ph, text, ((PANEL_W - tw)//2, y), font, scale, color, thick)

        # Dashed border
        for x in range(0, PANEL_W, 20):
            cv2.line(ph, (x, 2),          (x+10, 2),          (60,60,60), 1)
            cv2.line(ph, (x, PANEL_H-3),  (x+10, PANEL_H-3),  (60,60,60), 1)
        for y in range(0, PANEL_H, 20):
            cv2.line(ph, (2, y),          (2, y+10),          (60,60,60), 1)
            cv2.line(ph, (PANEL_W-3, y),  (PANEL_W-3, y+10),  (60,60,60), 1)

        return ph

    def release(self):
        if self.cap:
            self.cap.release()


# ══════════════════════════════════════════════════════════════════════════════
#  SpineGuard Monitor
# ══════════════════════════════════════════════════════════════════════════════
class SpineGuardMonitor:
    def __init__(self):
        self.pose = mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            model_complexity=1
        )
        self.prev_angle      = None
        self.prev_status     = None
        self.last_alert_time = 0
        self.tts             = TTSSpeaker()

    def calculate_spine_deviation(self, landmarks):
        def pt(lm):
            return [landmarks[lm.value].x, landmarks[lm.value].y]

        ls, rs = pt(mp_pose.PoseLandmark.LEFT_SHOULDER),  pt(mp_pose.PoseLandmark.RIGHT_SHOULDER)
        lh, rh = pt(mp_pose.PoseLandmark.LEFT_HIP),       pt(mp_pose.PoseLandmark.RIGHT_HIP)

        sh_mid = [(ls[0]+rs[0])/2, (ls[1]+rs[1])/2]
        hp_mid = [(lh[0]+rh[0])/2, (lh[1]+rh[1])/2]

        spine_vec = [hp_mid[0]-sh_mid[0], hp_mid[1]-sh_mid[1]]
        vertical  = [0, -1]

        deviation = np.degrees(np.arccos(np.clip(
            np.dot(spine_vec, vertical) /
            (np.linalg.norm(spine_vec)*np.linalg.norm(vertical) + 1e-6),
            -1.0, 1.0)))

        lateral_tilt = np.degrees(np.arctan2(rs[1]-ls[1], rs[0]-ls[0]))
        deviation    = min(deviation,         180 - deviation)
        lateral_tilt = min(abs(lateral_tilt), 180 - abs(lateral_tilt))
        return deviation, lateral_tilt

    def smooth_angle(self, new_angle):
        if self.prev_angle is None:
            self.prev_angle = new_angle
        smoothed        = SMOOTHING_FACTOR * new_angle + (1 - SMOOTHING_FACTOR) * self.prev_angle
        self.prev_angle = smoothed
        return smoothed

    def get_alert_status(self, deviation):
        if   deviation <= NEUTRAL_SPINE_TOLERANCE: return "SAFE",    (0, 255,   0)
        elif deviation <= DEVIATION_THRESHOLD:     return "CAUTION", (0, 255, 255)
        elif deviation <= WARNING_THRESHOLD:       return "WARNING", (0, 165, 255)
        else:                                      return "DANGER",  (0,   0, 255)

    def check_alert_speech(self, status):
        now = time.time()
        if status in ("WARNING", "DANGER") and now - self.last_alert_time >= ALERT_COOLDOWN:
            self.last_alert_time = now
            msg = ("Warning. Correct your posture now."
                   if status == "WARNING"
                   else "Critical. Return to neutral position immediately.")
            self.tts.speak(msg)
        self.prev_status = status

    def draw_spine_overlay(self, frame, landmarks, deviation, lateral_tilt, status, color):
        h, w, _ = frame.shape
        font     = cv2.FONT_HERSHEY_SIMPLEX

        def lm(idx): return landmarks[idx.value]

        ls, rs = lm(mp_pose.PoseLandmark.LEFT_SHOULDER),  lm(mp_pose.PoseLandmark.RIGHT_SHOULDER)
        lh, rh = lm(mp_pose.PoseLandmark.LEFT_HIP),       lm(mp_pose.PoseLandmark.RIGHT_HIP)

        sh_mid = (int((ls.x+rs.x)/2*w), int((ls.y+rs.y)/2*h))
        hp_mid = (int((lh.x+rh.x)/2*w), int((lh.y+rh.y)/2*h))

        cv2.line(frame,   sh_mid, hp_mid, color, 4)
        cv2.circle(frame, sh_mid, 8, color, -1)
        cv2.circle(frame, hp_mid, 8, color, -1)

        if status in ("WARNING", "DANGER"):
            cv2.rectangle(frame, (0, 0), (w, h), color, 15)

        # HUD panel
        ov = frame.copy()
        cv2.rectangle(ov, (12, 12), (305, 190), (0, 0, 0), -1)
        cv2.addWeighted(ov, 0.65, frame, 0.35, 0, frame)

        cv2.putText(frame, "SpineGuard AI",                     (22,  40), font, 0.65, (255,255,255), 2)
        cv2.putText(frame, f"Status:  {status}",                (22,  68), font, 0.55, color,         2)
        cv2.putText(frame, f"Deviation:    {deviation:.1f} deg",(22,  94), font, 0.46, (220,220,220), 1)
        cv2.putText(frame, f"Lateral Tilt: {lateral_tilt:.1f} deg",(22,116),font, 0.46, (220,220,220), 1)

        msgs = {
            "SAFE":    ("Spine in neutral alignment",    (0, 255,   0)),
            "CAUTION": ("Minor deviation detected",      (0, 255, 255)),
            "WARNING": ("Correct your posture now!",     (0, 165, 255)),
            "DANGER":  ("CRITICAL - Return to neutral!", (0,   0, 255)),
        }
        cv2.putText(frame, msgs[status][0], (22, 148), font, 0.44, msgs[status][1], 1)

        # Corner label
        cv2.putText(frame, "YOU", (w - 65, h - 15), font, 0.6, (180, 220, 255), 2)
        return frame

    def process_frame(self, frame):
        frame = cv2.resize(frame, (PANEL_W, PANEL_H))
        rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res   = self.pose.process(rgb)

        if res.pose_landmarks:
            lm            = res.pose_landmarks.landmark
            raw_dev, lat  = self.calculate_spine_deviation(lm)
            deviation     = self.smooth_angle(raw_dev)
            status, color = self.get_alert_status(deviation)
            self.check_alert_speech(status)
            frame = self.draw_spine_overlay(frame, lm, deviation, lat, status, color)
            mp_drawing.draw_landmarks(
                frame, res.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style()
            )
        else:
            cv2.putText(frame, "No pose detected — face camera", (30, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 255), 2)
        return frame

    def release(self):
        self.pose.close()
        self.tts.stop()


# ══════════════════════════════════════════════════════════════════════════════
#  Split-screen compositor
# ══════════════════════════════════════════════════════════════════════════════
def build_split_screen(user_panel, model_panel):
    divider  = np.full((PANEL_H, DIVIDER_W, 3), (80, 80, 80), dtype=np.uint8)
    combined = np.hstack([user_panel, divider, model_panel])

    # Header bar
    header_h = 34
    header   = np.zeros((header_h, combined.shape[1], 3), dtype=np.uint8)
    header[:] = (20, 20, 20)

    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(header, "LIVE FEED  —  Patient",
                (18, 23), font, 0.54, (180, 220, 255), 1)
    cv2.putText(header, "MODEL REFERENCE  —  Physiotherapist",
                (PANEL_W + DIVIDER_W + 18, 23), font, 0.54, (180, 255, 180), 1)
    cv2.line(header, (0, header_h-1), (combined.shape[1], header_h-1), (55, 55, 55), 1)

    return np.vstack([header, combined])


# ══════════════════════════════════════════════════════════════════════════════
#  Main
# ══════════════════════════════════════════════════════════════════════════════
def main():
    # Optional CLI argument: path to reference exercise video
    # Usage:  python spineguard.py  my_exercise.mp4
    ref_video_path = sys.argv[1] if len(sys.argv) > 1 else None

    monitor = SpineGuardMonitor()
    player  = ModelVideoPlayer(ref_video_path)

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  PANEL_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, PANEL_H)

    print("=" * 62)
    print("  SpineGuard AI  —  Split-Screen Physiotherapy Monitor")
    print("=" * 62)
    print(f"  LEFT  : Live webcam  (pose analysis + voice alerts)")
    print(f"  RIGHT : {'Video: ' + ref_video_path if ref_video_path else 'No reference video — placeholder shown'}")
    print("  Press 'q' to quit")
    print("=" * 62)

    while cap.isOpened():
        ret, raw_frame = cap.read()
        if not ret:
            break

        raw_frame   = cv2.flip(raw_frame, 1)
        user_panel  = monitor.process_frame(raw_frame.copy())
        model_panel = player.get_frame()

        # Subtle REFERENCE label on model panel
        cv2.putText(model_panel, "REFERENCE",
                    (PANEL_W - 148, PANEL_H - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (140, 210, 140), 2)

        split = build_split_screen(user_panel, model_panel)
        cv2.imshow("SpineGuard AI  —  Physiotherapy Monitor", split)

        if cv2.waitKey(5) & 0xFF == ord('q'):
            break

    cap.release()
    player.release()
    cv2.destroyAllWindows()
    monitor.release()


if __name__ == "__main__":
    main()