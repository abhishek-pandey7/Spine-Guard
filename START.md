# SpineIQ — How to Run

## 1. Frontend (main app — auth, chatbot, spine viz, physio)
```bash
cd rishi
npm install
npm run dev
# → http://localhost:5173
```

## 2. Backend (chatbot + session API)
```bash
cd rishi
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

## 3. Physio WebSocket backend (exercise form evaluation)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Ports summary
| Service | Port |
|---|---|
| Main React app (rishi) | 5173 |
| Chatbot + session API (rishi/main.py) | 8001 |
| Physio WebSocket API (backend/main.py) | 8000 |

## SpineViz (already built & embedded)
The SpineViz 3D MRI app is pre-built and served as a static file at `/spineviz/index.html` inside the rishi public folder. No separate server needed.

## Supabase tables needed
- `profiles` — user/doctor profiles
- `chats` — chatbot sessions
- `messages` — chat messages
- `physio_sessions` — exercise session results (create if missing)

### physio_sessions table SQL
```sql
create table physio_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  condition text,
  phase int,
  pain_before int,
  pain_after int,
  exercises jsonb,
  notes text,
  created_at timestamptz default now()
);
```
