# Spine-Guard: AI-Driven Spinal Health & Rehabilitation Ecosystem

**Spine-Guard** is a comprehensive medical-tech platform designed to democratize access to high-quality spinal rehabilitation. By combining **Computer Vision**, **3D Medical Visualization**, and **Real-Time Biomechanical Analysis**, Spine-Guard provides patients with the tools to recover from spinal injuries with clinical-grade accuracy from their own homes.

---

## System Architecture

Spine-Guard is built on a decoupled, three-tier architecture ensuring low-latency performance and high scalability:

1.  **Core Frontend (React/Vite)**: A premium dashboard for patient profiles, doctor-patient communication, and the "SpineViz" 3D MRI interface.
2.  **AI Orchestration API (FastAPI)**: Manages authentication, clinical data persistence via **Supabase**, and handles LLM-powered consultations.
3.  **Biomechanical Engine (FastAPI/WebSockets)**: A specialized high-performance Python service that processes video streams to calculate joint angles and spinal alignment in real-time.

---

## Key Features in Detail

### 1. Real-Time Biomechanical Monitoring
The system identifies 33 key body landmarks using **MediaPipe Pose** to evaluate form across 20+ specialized exercises:
*   **Static Exercises**: Plank, Child's Pose, Hamstring Stretch.
*   **Dynamic Exercises**: Bird-Dog, Glute Bridges, Cat-Cow, Pelvic Tilts.
*   **Metrics Tracked**: Joint angles (e.g., knee flexion, hip extension), spine deviation from neutral vertical, and lateral pelvic tilt.

### 2. SpineViz: 3D MRI Visualization
*   **Interactive Anatomy**: A built-in 3D renderer that allows patients to view their spinal structure.
*   **Clinical Mapping**: Capability to overlay MRI findings onto interactive models to help patients understand exactly where their discs or vertebrae require attention.

### 3. Intelligent TTS Feedback Engine
Unlike generic apps, Spine-Guard features a **Priority-Queue TTS Speaker**:
*   **Per-Joint Correction**: Calculates which part of the form is "most wrong" and cycles through specific cues (e.g., *"Level your hips"* vs. *"Tuck your chin"*).
*   **Cooldown Management**: Prevents "feedback fatigue" by spacing out repeating cues.
*   **Priority Beats**: High-priority countdowns (last 5 seconds of a hold) automatically pre-empt normal coaching cues.

### 4. Progress Analytics & Recovery Tracking
*   **Pain-Scale Logging**: Users log pain levels before and after each session.
*   **Accuracy Over Time**: The system calculates an "Accuracy Score" for every rep, stored in Supabase for doctor review.
*   **Phase-Based Progress**: Physiotherapy plans are divided into phases (Rest, Restore, Strengthen).

---

## Technical Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide |
| **Backend** | FastAPI (Python 3.10+), Uvicorn, WebSockets |
| **AI / ML** | MediaPipe (Pose Resnet), OpenCV, NumPy |
| **Infrastructure** | Supabase (PostgreSQL), Edge Functions |
| **Coaching** | pyttsx3 (SAPI5/nsss), Python-com-initialize |

---

## Repository Deep Dive

```text
Spine-Guard/
├── rishi/                 # MAIN DASHBOARD & CLINICAL API
│   ├── src/               # React UI, Auth, Dashboard, SpineViz
│   └── main.py            # API Port 8001 (Users, Chats, Sessions)
├── backend/               # PT ENGINE (HIGH PERFORMANCE)
│   └── main.py            # WebSocket Port 8000 (MediaPipe Runner)
├── exercises/             # BIOMECHANICAL DICTIONARY
│   ├── bird_dog.py        # Logic for lumbar stability & limb extension
│   ├── glute_bridge.py    # Logic for pelvic alignment
│   └── squat.py           # Logic for knee/hip synchronization
├── exercise_monitor.py    # Core runner for exercise sessions
└── spine_monitor.py       # Core runner for general posture alerts
