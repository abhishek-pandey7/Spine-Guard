"""
SpineGuard AI  —  FastAPI Backend  (WebSocket bridge to Python exercise evaluators)

Usage
─────
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

WebSocket endpoint
──────────────────
    ws://localhost:8000/ws/exercise/{exercise_key}

    Client sends (JSON):
        { "landmarks": [ {x, y, z, visibility}, ... 33 items ], "frame_id": 123 }

    Server replies (JSON):
        {
            "frame_id": 123,
            "passed": true,
            "checks": { "knee_angle": [true, 95.2, "cue..."], ... },
            "primary_cue": "Good form.",
            "joint_points": [[0.5, 0.3, [0,220,80], "Shoulder"], ...],
            "rep_complete": false,
            "rep_count": 3
        }

REST endpoints
──────────────
    GET /api/exercises          → list all exercises with metadata
    GET /api/exercises/{key}    → single exercise metadata
    GET /api/health             → health check
"""

import sys
import os
import json
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Add parent dir to path so `exercises` package resolves ─────────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
if PARENT not in sys.path:
    sys.path.insert(0, PARENT)

from exercises import EXERCISES  # noqa: E402

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="SpineGuard AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Per-connection exercise state ─────────────────────────────────────────────
class ExerciseSession:
    def __init__(self, key: str):
        self.key = key
        self.module = EXERCISES.get(key)
        self.state = None
        self.rep_count = 0

    def evaluate(self, landmarks: list) -> dict:
        if not self.module:
            return {"error": f"Unknown exercise: {self.key}"}

        # Convert flat landmark dicts to MediaPipe-style objects
        lm_objects = _build_landmarks(landmarks)

        result = self.module.evaluate(lm_objects, state=self.state)

        # Carry state forward
        self.state = result.get("state", self.state)
        if result.get("rep_complete"):
            self.rep_count += 1

        # Serialize joint_points (tuples → lists for JSON)
        joints = result.get("joint_points", [])
        serializable_joints = [
            [j[0], j[1], list(j[2]) if isinstance(j[2], tuple) else j[2], j[3]]
            for j in joints
        ]

        # Serialize checks (tuples → lists)
        checks_out = {}
        for name, (passed, value, cue) in result.get("checks", {}).items():
            checks_out[name] = [passed, value, cue]

        return {
            "passed": result["passed"],
            "checks": checks_out,
            "primary_cue": result["primary_cue"],
            "joint_points": serializable_joints,
            "rep_complete": result.get("rep_complete", False),
            "rep_count": self.rep_count,
        }


def _build_landmarks(raw: list):
    """Convert list of {x, y, z, visibility} dicts to MediaPipe-like objects."""
    try:
        import mediapipe as mp
        mp_pose = mp.solutions.pose
    except Exception:
        # Fallback: return raw dicts — evaluate() uses indexing
        return raw

    class _Landmark:
        __slots__ = ("x", "y", "z", "visibility")
        def __init__(self, d):
            self.x = d.get("x", 0)
            self.y = d.get("y", 0)
            self.z = d.get("z", 0)
            self.visibility = d.get("visibility", 1)

    return [_Landmark(d) for d in raw]


# ── Active sessions (websocket → ExerciseSession) ─────────────────────────────
sessions: dict[WebSocket, ExerciseSession] = {}


# ── WebSocket: /ws/exercise/{exercise_key} ────────────────────────────────────
@app.websocket("/ws/exercise/{exercise_key}")
async def ws_exercise(websocket: WebSocket, exercise_key: str):
    await websocket.accept()
    session = ExerciseSession(exercise_key)
    sessions[websocket] = session

    if not session.module:
        await websocket.send_json({"error": f"Unknown exercise: {exercise_key}"})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            landmarks = msg.get("landmarks", [])
            frame_id = msg.get("frame_id", 0)

            if not landmarks:
                continue

            result = session.evaluate(landmarks)
            result["frame_id"] = frame_id
            await websocket.send_json(result)

    except WebSocketDisconnect:
        sessions.pop(websocket, None)
    except Exception as e:
        sessions.pop(websocket, None)
        try:
            await websocket.send_json({"error": str(e)})
            await websocket.close()
        except Exception:
            pass


# ── REST: Exercise listing ────────────────────────────────────────────────────
class ExerciseMeta(BaseModel):
    key: str
    name: str
    camera_hint: str
    phases: list[str]
    rep_trigger: Optional[str] = None


@app.get("/api/exercises")
async def list_exercises() -> list[ExerciseMeta]:
    result = []
    for key, mod in EXERCISES.items():
        meta = getattr(mod, "META", {})
        result.append(ExerciseMeta(
            key=key,
            name=meta.get("name", key),
            camera_hint=meta.get("camera_hint", ""),
            phases=meta.get("phases", []),
            rep_trigger=meta.get("rep_trigger"),
        ))
    return result


@app.get("/api/exercises/{exercise_key}")
async def get_exercise(exercise_key: str) -> dict:
    mod = EXERCISES.get(exercise_key)
    if not mod:
        return {"error": "Not found"}
    meta = getattr(mod, "META", {})
    return {"key": exercise_key, **meta}


@app.get("/api/health")
async def health():
    return {"status": "ok", "exercises": len(EXERCISES)}
