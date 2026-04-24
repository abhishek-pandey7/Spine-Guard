# SpineIQ: The AI-Powered Spinal Rehabilitation Ecosystem

**SpineIQ** is a state-of-the-art medical technology platform designed to bridge the gap between clinical physiotherapy and at-home recovery. By leveraging **Computer Vision**, **3D Medical Imaging**, and **Generative AI**, SpineIQ provides patients with a professional-grade rehabilitation experience, ensuring safety and precision in every movement.

---

## 🌟 The Vision: Precision Recovery
Recovering from spinal surgery or chronic back pain is a delicate journey. Traditional at-home exercises often suffer from a lack of feedback, leading to poor form, re-injury, or slow progress. **SpineIQ** transforms a laptop or smartphone into a "Digital Physical Therapist" that watches, evaluates, and coaches the patient in real-time.

---

## 🚀 Key Features & Benefits

### 1. Real-Time Biomechanical Form Tracking
Using the **MediaPipe Pose** engine, SpineIQ identifies 33 key skeletal landmarks to analyze movement with sub-degree precision.

*   **The Feature**: The system evaluates form across a library of 20+ specialized exercises (e.g., Bird-Dog, Cat-Cow, Pelvic Tilts). It measures joint angles, spinal curvature, and pelvic stability.
*   **The Benefit**: Patients receive **instant corrective feedback**. If a hip drops during a plank or a back arches too much during a stretch, the AI detects it immediately, preventing harmful movements and maximizing therapeutic benefit.

### 2. SpineViz: Interactive 3D MRI Visualization
Traditional MRI reports are dense and difficult for patients to interpret. SpineViz brings medical data to life.

*   **The Feature**: A built-in 3D renderer that overlays MRI findings onto an interactive spinal model. Patients can rotate, zoom, and explore their own anatomy.
*   **The Benefit**: **Clinical Transparency**. When patients can *see* their herniated disc or vertebral alignment in 3D, their treatment adherence and psychological confidence in the recovery plan increase significantly.

### 3. Intelligent AI Recovery Assistant
Post-operative patients often have questions at 2 AM that don't warrant an ER visit but cause anxiety.

*   **The Feature**: An LLM-powered chatbot trained on clinical protocols that understands the patient's specific surgery type, day of recovery, and pain history.
*   **The Benefit**: **24/7 Clinical Support**. The AI can distinguish between "normal recovery soreness" and "Red Flag symptoms," advising the patient to rest or contact their surgeon immediately based on established medical safety thresholds.

### 4. High-Fidelity Audio Coaching (TTS Engine)
Visual feedback isn't always possible when you're face-down in a "Child's Pose."

*   **The Feature**: A priority-queued Text-to-Speech system that provides rhythmic, spoken cues. It intelligently spaces out feedback to avoid "audio fatigue."
*   **The Benefit**: **Eyes-Free Guidance**. Patients can focus entirely on their breath and body position while the AI whispers corrections like *"Lower your right hip"* or *"3 seconds remaining."*

### 5. Advanced Progress Analytics
SpineIQ stores every rep, every angle, and every pain report in a secure clinical database.

*   **The Feature**: Detailed dashboards for both patients and doctors showing "Accuracy Scores," pain trends, and mobility improvements over weeks.
*   **The Benefit**: **Data-Driven Consultations**. Instead of telling their doctor "I feel okay," patients can show a graph of their hip mobility increasing from 45° to 70° over ten sessions.

---

## 🏗️ Technical Architecture

SpineIQ utilizes a distributed micro-service architecture to handle high-frequency computer vision data:

*   **Main Hub (`main_app`)**: A React 18 frontend with a FastAPI backend on Port 8001. Handles auth, LLM orchestration, and Supabase integration.
*   **Physio Engine (`physio_backend`)**: A specialized Python service on Port 8000. It processes raw video frames, runs MediaPipe inference, and streams biomechanical metrics via WebSockets.
*   **Data Layer**: Powered by **Supabase (PostgreSQL)** for secure, HIPAA-compliant storage of recovery sessions and patient profiles.

---

## 📂 Repository Structure

```text
SpineIQ/
├── main_app/              # Core React Dashboard & Chatbot API
├── physio_backend/        # Real-time CV & WebSocket Engine
├── patient_portal/        # Specialized recovery tracking interface
├── experimental_viz/      # Sandbox for 3D Posture visualizations
├── exercises/             # Biomechanical dictionary (Python modules)
│   ├── bird_dog.py        # Logic for lumbar & limb stability
│   ├── glute_bridge.py    # Logic for pelvic alignment
│   └── cat_cow.py         # Logic for spinal articulation
├── exercise_monitor.py    # Main runner for active sessions
└── spine_monitor.py       # Posture monitoring background service
```

---

## 🛠️ Getting Started

For detailed installation and setup instructions, please refer to [**START.md**](file:///d:/projects/Spine-Guard/START.md).

1.  **Clone the Repo**
2.  **Initialize Supabase**: Run the SQL schema provided in `START.md`.
3.  **Start the Services**: Launch the Main App (8001) and the Physio Engine (8000).
4.  **Recover Safely**: Access the dashboard at `localhost:5173`.

---

## 🛡️ Privacy & Security
SpineIQ is built with a **Privacy-First** philosophy. All video processing for exercise form evaluation happens **locally** on the user's device (or their dedicated private server). No raw video data is ever uploaded to the cloud—only anonymized biomechanical metrics are stored for progress tracking.

---

*Developed with ❤️ for spinal health. Standardized to **SpineIQ** v2.0.*
