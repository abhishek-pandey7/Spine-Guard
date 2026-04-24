# 🦴 SpineIQ — AI-Powered Spine Recovery Platform

> A full-stack healthcare platform combining an intelligent AI chatbot, real-time computer vision exercise monitoring, and a doctor-patient management portal — purpose-built for spine surgery recovery.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Frontend Setup](#frontend-setup)
  - [Backend Setup](#backend-setup)
  - [Computer Vision Tools](#computer-vision-tools)
- [Supabase Setup](#supabase-setup)
- [Modules](#modules)
  - [AI Chatbot (SpineIQ)](#ai-chatbot-spineiq)
  - [Doctor Dashboard](#doctor-dashboard)
  - [Spine Visualizer](#spine-visualizer)
  - [Exercise Monitor](#exercise-monitor)
  - [Posture Monitor](#posture-monitor)
- [Supported Exercises](#supported-exercises)
- [API Endpoints](#api-endpoints)
- [User Flows](#user-flows)
- [Environment Variables Reference](#environment-variables-reference)

---

## Overview

**SpineIQ** is a personalised spine recovery assistant that connects patients with their doctors through an account-based healthcare platform. Patients receive AI-guided recovery support tailored to their specific surgery type, recovery phase, and medical history. Doctors get a full analytics dashboard to monitor and review their assigned patients.

Alongside the web app, **SpineGuard AI** provides two standalone Python-based computer-vision tools: a real-time **posture deviation monitor** and a guided **exercise monitor** — both powered by MediaPipe and OpenCV.

---

## Features

### 👤 Patient Side
- **Google OAuth** sign-in via Supabase Auth
- **5-step medical intake** form (demographics → complaint → vitals → red flags → history)
- **Auto BMI calculation** from height and weight
- **Red flag symptom screening** with mandatory acknowledgement
- **Doctor selection** from registered practitioners
- **AI Recovery Chatbot** — persistent, multi-session chat with full history
- **Medical document analysis** — upload MRI scans, X-rays, PDFs for AI interpretation
- **Spine Visualizer** — interactive 3D anatomy viewer
- **Editable profile** — update clinical details at any time via settings modal

### 🏥 Doctor Side
- **Dedicated Doctor Dashboard** (no chatbot access)
- **Patient list** — view all assigned patients at a glance
- **Individual patient profiles** — vitals, chief complaint, HOPI, red flags, scan uploads, medical history
- **Analytics Overview** with:
  - Gender breakdown (donut chart)
  - Age distribution (histogram)
  - BMI category breakdown (horizontal bar chart)
  - Red flag prevalence chart
  - Custom issues reporting rate
- **Mobile-responsive** — full hamburger sidebar on small screens

### 🤖 AI Engine
- **LangGraph state machine** orchestrating multi-node conversation flow
- **Red flag detection** — keywords trigger immediate escalation messaging
- **File processing node** — multimodal image analysis + PDF text extraction
- **RAG-ready architecture** — Pinecone vector store integration scaffolded (disabled post-hackathon, re-enable ready)
- **Gemini 2.5 Flash** as the primary LLM
- **Auto chat titling** — first message generates a contextual 3–5 word title using Gemini

### 🎯 Computer Vision (Standalone)
- **Spine posture monitor** — real-time deviation & lateral tilt detection with voice alerts
- **Exercise monitor** — split-screen guided sessions with rep counting, per-joint feedback HUD, and TTS coaching
- **20 exercise modules** — Glute Bridge, Bird Dog, Pelvic Tilt, Plank, McKenzie Press-Up, and many more

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, Vanilla CSS |
| **Auth & Database** | Supabase (PostgreSQL + Auth + Storage) |
| **Backend API** | FastAPI, Uvicorn |
| **AI / LLM** | Google Gemini 2.5 Flash via `langchain-google-genai` |
| **AI Orchestration** | LangGraph (StateGraph) |
| **Vector Store** | Pinecone (scaffolded, RAG-ready) |
| **PDF Parsing** | pypdf |
| **Computer Vision** | OpenCV, MediaPipe |
| **TTS** | pyttsx3 |
| **Deployment Target** | Any Node.js + Python host |

---

## Project Structure

```
Spine-Guard/
├── src/                        # React frontend
│   ├── App.jsx                 # Root component — auth, routing, all forms
│   ├── App.css                 # Global styles, setup screens, forms
│   ├── DoctorDashboard.jsx     # Doctor-only dashboard (patients + analytics)
│   ├── SpineChatbot.jsx        # Patient AI chat interface
│   ├── SpineChatbot.css        # Chat UI styles
│   ├── supabaseClient.js       # Supabase JS client initialisation
│   ├── index.css               # Base CSS reset
│   ├── main.jsx                # React entry point
│   └── spine.html              # Static 3D Spine Visualizer (iframe'd)
│
├── exercises/                  # Computer vision exercise modules
│   ├── __init__.py             # Module registry
│   ├── glute_bridge.py
│   ├── bird_dog.py
│   ├── pelvic_tilt.py
│   ├── plank.py
│   ├── squat.py
│   ├── lunge.py
│   ├── mckenzie_pressup.py
│   ├── cat_cow.py
│   ├── child_pose.py
│   ├── chin_tuck.py
│   ├── dead_bug.py
│   ├── hamstring_stretch.py
│   ├── hip_abduction.py
│   ├── nerve_glide.py
│   ├── piriformis_stretch.py
│   ├── resistance_band_row.py
│   ├── scapular_retraction.py
│   ├── standing_back_extension.py
│   ├── thoracic_extension.py
│   ├── walking.py
│   └── wall_angels.py
│
├── main.py                     # FastAPI backend (chat API + Supabase integration)
├── chatbot_graph.py            # LangGraph state machine (AI pipeline)
├── spine_prompt.py             # System prompt for SpineIQ LLM
├── spine_monitor.py            # Standalone posture deviation monitor (CV)
├── exercise_monitor.py         # Standalone guided exercise monitor (CV)
│
├── requirements.txt            # Python dependencies
├── package.json                # Node dependencies
├── vite.config.js              # Vite build config
├── index.html                  # HTML entry point
└── .env                        # Environment variables (not committed)
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│               React Frontend (Vite)          │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │  Auth /  │  │ Chatbot   │  │  Doctor  │  │
│  │ Onboard  │  │ (Patient) │  │Dashboard │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  │
└───────┼──────────────┼─────────────┼─────────┘
        │              │             │
        ▼              ▼             ▼
┌───────────────┐  ┌──────────────────────────┐
│   Supabase    │  │    FastAPI Backend        │
│  - Auth       │  │  POST /chat               │
│  - profiles   │  │  POST /chat/upload        │
│  - chats      │  │  GET  /chats              │
│  - messages   │  │  GET  /chats/{id}/history │
│  - Storage    │  │  DELETE /chats/{id}        │
└───────────────┘  └──────────┬───────────────┘
                               │
                               ▼
                   ┌─────────────────────┐
                   │   LangGraph Pipeline │
                   │  red_flag_check      │
                   │       ↓             │
                   │  process_file       │
                   │       ↓             │
                   │  retrieve_context   │
                   │       ↓             │
                   │  llm (Gemini 2.5)   │
                   └─────────────────────┘
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **A Supabase project** (free tier works)
- **Google AI API key** (Gemini)
- A webcam (for CV tools only)

---

### Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-supabase-anon-key

# Google Gemini
GOOGLE_API_KEY=your-google-ai-api-key

# Pinecone (optional — for RAG when re-enabled)
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX=your-index-name
```

> The frontend reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` via Vite's `import.meta.env`.  
> The Python backend reads all keys from the same `.env` file via `python-dotenv`.

---

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

### Backend Setup

```bash
# Create and activate a virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs at `http://localhost:8000/docs`.

---

### Computer Vision Tools

These run independently of the web app and require a webcam.

**Additional dependencies:**

```bash
pip install opencv-python mediapipe pyttsx3 numpy
```

**Posture Monitor:**

```bash
# Monitor spinal deviation in real time
python spine_monitor.py

# With a reference physiotherapy video (optional)
python spine_monitor.py my_reference.mp4
```

**Exercise Monitor:**

```bash
# Default: Glute Bridge
python exercise_monitor.py

# Specific exercise
python exercise_monitor.py pelvic_tilt
python exercise_monitor.py bird_dog

# With a reference video
python exercise_monitor.py glute_bridge reference.mp4
```

**Exercise monitor keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `1` | Switch to Pelvic Tilt |
| `2` | Switch to Glute Bridge |
| `3` | Switch to Bird Dog |
| `r` | Reset rep counter |
| `q` | Quit |

---

## Supabase Setup

Create the following tables in your Supabase project:

### `profiles`

```sql
create table profiles (
  id              uuid references auth.users primary key,
  role            text,              -- 'user' or 'doctor'
  full_name       text,
  phone           text,
  -- Doctor fields
  degree          text,
  hospital        text,
  -- Patient fields
  age             int,
  gender          text,
  height          float,
  weight          float,
  bmi             float,
  chief_complaint text,
  hopi            text,
  red_flags       text[],
  custom_issues   text,
  scans_done      text,
  treatments_history text,
  scan_url        text,
  assigned_doctor_id uuid references profiles(id)
);
```

### `chats`

```sql
create table chats (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users,
  title      text default 'New Recovery Chat',
  created_at timestamptz default now()
);
```

### `messages`

```sql
create table messages (
  id          uuid default gen_random_uuid() primary key,
  chat_id     uuid references chats(id) on delete cascade,
  role        text,        -- 'user' or 'ai'
  content     text,
  file_name   text,
  is_red_flag boolean default false,
  created_at  timestamptz default now()
);
```

### Storage

Create a **Storage bucket** named `patient-scans` (public read is fine for scan image display).

### Auth

Enable **Google OAuth** provider in Supabase → Authentication → Providers → Google.  
Set the redirect URL to your app's origin (e.g. `http://localhost:5173`).

---

## Modules

### AI Chatbot (SpineIQ)

**`chatbot_graph.py`** — LangGraph pipeline with 4 nodes:

| Node | Purpose |
|------|---------|
| `red_flag_check` | Scans the latest message for emergency keywords (fever, numbness, incontinence, weakness, etc.) |
| `process_file` | Handles multimodal inputs — converts images to base64 for Gemini vision, extracts text from PDFs |
| `retrieve_context` | RAG retrieval placeholder (returns empty string; Pinecone integration ready to re-enable) |
| `llm` | Invokes Gemini 2.5 Flash with the full patient context + system prompt + history |

**`spine_prompt.py`** — The master system prompt injected at every turn. Configures SpineIQ to:
- Only answer spine/recovery related questions
- Escalate red-flag symptoms immediately
- Interpret medical images educationally
- Analyse uploaded PDFs structurally
- Respond in the patient's preferred language

**`main.py`** — FastAPI server managing:
- Chat session CRUD via Supabase
- Message persistence (user + AI turns)
- File upload handling (image + PDF)
- Auto-title generation on first message

---

### Doctor Dashboard

**`src/DoctorDashboard.jsx`** — A self-contained, zero-dependency dashboard featuring:

- Patient sidebar with active selection
- Analytics overview with 5 pure-SVG chart types (no chart library required)
- Full patient detail view with vitals, clinical history, scan image preview
- Fully **mobile responsive** with slide-in sidebar and hamburger menu

---

### Spine Visualizer

An interactive 3D spine anatomy viewer served as a static HTML file (`src/spine.html`) and embedded in the patient experience via an `<iframe>`. Patients can explore vertebral levels, surgical procedures, and anatomical structures.

---

### Exercise Monitor

**`exercise_monitor.py`** — A split-screen guided exercise session tool:

- **Left panel**: Live webcam feed with MediaPipe pose overlay, per-joint coloured indicators, check panel HUD, and cue banner
- **Right panel**: Reference physiotherapy video (or styled placeholder)
- **TTS coaching**: Voice cues via pyttsx3 (throttled to avoid spam)
- **Rep counting**: Automatic via state machine in each exercise module
- **Hot-swappable exercises**: Switch exercises mid-session with keyboard shortcuts

---

### Posture Monitor

**`spine_monitor.py`** — Continuous spinal posture deviation analysis:

- Tracks shoulder midpoint → hip midpoint angle against vertical
- Measures lateral tilt from shoulder line
- 4-level alert system: `SAFE` → `CAUTION` → `WARNING` → `DANGER`
- Exponential smoothing to eliminate jitter
- Voice alerts at WARNING and DANGER levels (5-second cooldown)
- Split-screen with live patient feed and reference video

---

## Supported Exercises

| Exercise | File |
|----------|------|
| Glute Bridge | `exercises/glute_bridge.py` |
| Bird Dog | `exercises/bird_dog.py` |
| Pelvic Tilt | `exercises/pelvic_tilt.py` |
| Plank | `exercises/plank.py` |
| Squat | `exercises/squat.py` |
| Lunge | `exercises/lunge.py` |
| McKenzie Press-Up | `exercises/mckenzie_pressup.py` |
| Cat-Cow | `exercises/cat_cow.py` |
| Child's Pose | `exercises/child_pose.py` |
| Chin Tuck | `exercises/chin_tuck.py` |
| Dead Bug | `exercises/dead_bug.py` |
| Hamstring Stretch | `exercises/hamstring_stretch.py` |
| Hip Abduction | `exercises/hip_abduction.py` |
| Nerve Glide | `exercises/nerve_glide.py` |
| Piriformis Stretch | `exercises/piriformis_stretch.py` |
| Resistance Band Row | `exercises/resistance_band_row.py` |
| Scapular Retraction | `exercises/scapular_retraction.py` |
| Standing Back Extension | `exercises/standing_back_extension.py` |
| Thoracic Extension | `exercises/thoracic_extension.py` |
| Walking | `exercises/walking.py` |
| Wall Angels | `exercises/wall_angels.py` |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/chats?user_id={id}` | List all chat sessions for a user |
| `POST` | `/chats` | Create a new chat session |
| `DELETE` | `/chats/{chat_id}` | Delete a chat and all its messages |
| `GET` | `/chats/{chat_id}/history` | Get full message history for a chat |
| `POST` | `/chat` | Send a text message and get AI response |
| `POST` | `/chat/upload` | Send a message with an attached file (image or PDF) |

---

## User Flows

### New Patient

```
Sign in with Google
  → Basic onboarding (name, phone, role = patient)
  → 5-step intake form
      Step 1: Age & Gender
      Step 2: Chief Complaint & HOPI
      Step 3: Height, Weight (auto BMI)
      Step 4: Red Flag Screening
      Step 5: Medical History & Scan Upload
  → Doctor Selection
  → Mode Selection (AI Chat | Spine Visualizer)
  → Recovery Session Setup (surgery type, days post-op, pain score, language)
  → SpineIQ Chatbot
```

### New Doctor

```
Sign in with Google
  → Basic onboarding (name, phone, role = doctor)
  → Doctor profile (degree, hospital, age, gender)
  → Doctor Dashboard
```

---

## Environment Variables Reference

| Variable | Used By | Description |
|----------|---------|-------------|
| `VITE_SUPABASE_URL` | Frontend + Backend | Your Supabase project URL |
| `VITE_SUPABASE_KEY` | Frontend + Backend | Supabase anon/public key |
| `GOOGLE_API_KEY` | Backend | Google Gemini API key |
| `PINECONE_API_KEY` | Backend (optional) | Pinecone API key for RAG |
| `PINECONE_INDEX` | Backend (optional) | Pinecone index name |

---

## License

This project was built as part of a hackathon. All rights reserved by the team.
