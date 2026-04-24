import os
import io
import json
import base64
from typing import Optional, List
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.messages import HumanMessage, AIMessage

from chatbot_graph import spine_graph


# --- Config ---
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase environment variables")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vector store disabled — RAG to be re-enabled post hackathon

# --- Helpers ---
from langchain_google_genai import ChatGoogleGenerativeAI as _TitleLLM
from langchain_core.messages import HumanMessage as _HM

_title_llm = _TitleLLM(model="gemini-2.0-flash", max_output_tokens=20)

def generate_chat_title(message: str) -> str:
    """Use the LLM to produce a concise 3-5 word topic title from the first user message."""
    try:
        prompt = (
            "Generate a concise, generalised topic title (3 to 5 words, no punctuation, no quotes) "
            "that summarises what this spine-recovery patient message is about. "
            "Only return the title, nothing else.\n\n"
            f"Patient message: {message[:300]}"
        )
        resp = _title_llm.invoke([_HM(content=prompt)])
        title = resp.content.strip().strip('"\'')
        return (title[:40] + "…") if len(title) > 42 else (title or "Recovery Chat")
    except Exception:
        # Fallback to keyword extraction
        words = message.strip().split()[:5]
        return " ".join(words) or "Recovery Chat"

# --- Models ---
class ChatRequest(BaseModel):
    chat_id: str
    user_id: str
    message: str
    patient_context: dict

class NewChatRequest(BaseModel):
    user_id: str
    title: str = "New Recovery Chat"

# --- Endpoints ---

@app.get("/chats")
async def get_chats(user_id: str):
    """Fetch all chats for a specific user from Supabase."""
    res = supabase.table("chats").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data

@app.post("/chats")
async def create_chat(request: NewChatRequest):
    """Initialize a new chat session in Supabase."""
    res = supabase.table("chats").insert({
        "user_id": request.user_id,
        "title": request.title
    }).execute()
    return res.data[0] if res.data else None

@app.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str):
    """Delete a chat and all its messages (removes context entirely)."""
    supabase.table("messages").delete().eq("chat_id", chat_id).execute()
    supabase.table("chats").delete().eq("id", chat_id).execute()
    return {"success": True}

@app.get("/chats/{chat_id}/history")
async def get_chat_history(chat_id: str):
    """Retrieve full message history for a specific chat."""
    res = supabase.table("messages").select("*").eq("chat_id", chat_id).order("created_at").execute()
    return [{"type": "human" if m["role"] == "user" else "ai", "content": m["content"]} for m in res.data]

async def get_chat_history_as_messages(chat_id: str):
    """Internal helper returning LangChain message objects for graph state."""
    res = supabase.table("messages").select("*").eq("chat_id", chat_id).order("created_at").execute()
    history = []
    for m in res.data:
        if m["role"] == "user":
            history.append(HumanMessage(content=m["content"]))
        else:
            history.append(AIMessage(content=m["content"]))
    return history

@app.post("/chat")
async def chat(request: ChatRequest):
    """Standard chat endpoint with message persistence."""
   # 1. Fetch history from DB as LangChain messages
    history_res = await get_chat_history_as_messages(request.chat_id)

    # 2. Add current message to state
    current_msg = HumanMessage(content=request.message)
    full_messages = history_res + [current_msg]
    
    # 3. Check if first message (for auto-title), then store user message
    existing = supabase.table("messages").select("id").eq("chat_id", request.chat_id).limit(1).execute()
    is_first_message = len(existing.data) == 0

    supabase.table("messages").insert({
        "chat_id": request.chat_id,
        "role": "user",
        "content": request.message
    }).execute()
    
    state = {
        "messages": full_messages,
        "patient_context": request.patient_context,
        "uploaded_file": None,
        "red_flag_detected": False
    }
    
    # 4. Invoke LLM Graph
    result = spine_graph.invoke(state)
    ai_response = result["messages"][-1].content
    red_flag = result.get("red_flag_detected", False)
    
    # 5. Store AI response in Supabase
    supabase.table("messages").insert({
        "chat_id": request.chat_id,
        "role": "ai",
        "content": ai_response,
        "is_red_flag": red_flag
    }).execute()
    
    # Auto-rename chat from first message keywords
    new_title = None
    if is_first_message:
        new_title = generate_chat_title(request.message)
        supabase.table("chats").update({"title": new_title}).eq("id", request.chat_id).execute()

    return {"response": ai_response, "red_flag": red_flag, "new_title": new_title}

@app.post("/chat/upload")
async def chat_with_file(
    chat_id: str = Form(...),
    user_id: str = Form(...),
    message: str = Form(""),
    patient_context: str = Form(...),
    file: UploadFile = File(...)
):
    """Processes uploads (Images/PDFs) and persists in DB/Vector Store."""
    file_bytes = await file.read()
    file_b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    
    context = json.loads(patient_context)
    
    # Extract PDF text to pass directly to the LLM
    pdf_text = ""
    if file.content_type == "application/pdf":
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        for page in reader.pages:
            pdf_text += page.extract_text() or ""
    
    # Standard DB Message Logging
    display_msg = message or f"Uploaded file: {file.filename}"
    supabase.table("messages").insert({
        "chat_id": chat_id,
        "role": "user",
        "content": display_msg,
        "file_name": file.filename
    }).execute()
    
    # Fetch History
    history_res = await get_chat_history_as_messages(chat_id)
    current_human = HumanMessage(content=display_msg)
    
    state = {
        "messages": history_res + [current_human],
        "patient_context": context,
        "uploaded_file": {
            "type": "image" if file.content_type.startswith("image/") else "pdf",
            "data": file_b64,
            "mime": file.content_type,
            "text": pdf_text  # Extracted PDF text passed to the graph
        },
        "red_flag_detected": False
    }
    
    result = spine_graph.invoke(state)
    ai_response = result["messages"][-1].content
    red_flag = result.get("red_flag_detected", False)
    
    supabase.table("messages").insert({
        "chat_id": chat_id,
        "role": "ai",
        "content": ai_response,
        "is_red_flag": red_flag
    }).execute()

    # Auto-rename chat on first message (file upload)
    existing = supabase.table("messages").select("id").eq("chat_id", chat_id).limit(2).execute()
    new_title = None
    if len(existing.data) <= 2:  # only the two we just inserted
        title_source = message or f"Uploaded {file.filename}"
        new_title = generate_chat_title(title_source)
        supabase.table("chats").update({"title": new_title}).eq("id", chat_id).execute()

    return {"response": ai_response, "red_flag": red_flag, "new_title": new_title}


# --- Physio Session Endpoint ---
class ExerciseEntry(BaseModel):
    name: str
    reps_done: int = 0
    duration_seconds: int = 0

class SessionRequest(BaseModel):
    user_id: str
    condition: str
    phase: int
    pain_before: int
    pain_after: int
    difficulty: str = "moderate"
    notes: str = ""
    red_flags: dict = {}
    exercises: List[ExerciseEntry] = []
    total_reps: int = 0
    total_time_seconds: int = 0
    compliance_score: int = 0
    grade: str = ""
    session_date: str = ""

@app.post("/session")
async def save_session(req: SessionRequest):
    """Save a completed physio session to Supabase for doctor progress tracking."""
    data = {
        "user_id": req.user_id,
        "condition": req.condition,
        "phase": req.phase,
        "pain_before": req.pain_before,
        "pain_after": req.pain_after,
        "difficulty": req.difficulty,
        "notes": req.notes,
        "red_flags": req.red_flags,
        "exercises": [e.dict() for e in req.exercises],
        "total_reps": req.total_reps,
        "total_time_seconds": req.total_time_seconds,
        "compliance_score": req.compliance_score,
        "grade": req.grade,
        "session_date": req.session_date or None,
    }
    res = supabase.table("physio_sessions").insert(data).execute()
    return {"success": True, "id": res.data[0]["id"] if res.data else None}

@app.get("/sessions/{user_id}")
async def get_sessions(user_id: str):
    """Fetch all physio sessions for a patient (used by doctor dashboard)."""
    res = supabase.table("physio_sessions").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data


# --- Recent Activity Endpoint ---
@app.get("/activities/{user_id}")
async def get_activities(user_id: str):
    """Derive a unified recent-activity feed from chats, messages, and physio sessions."""
    activities = []

    # 1. Physio sessions → "done" activities
    sessions_res = supabase.table("physio_sessions").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(10).execute()
    for s in sessions_res.data:
        created = s.get("created_at", "")
        exercises = s.get("exercises", [])
        ex_names = ", ".join(e.get("name", "") for e in exercises) if exercises else "Exercises"
        activities.append({
            "type": "done",
            "text": f"Completed physio session — {ex_names}",
            "time": created,
            "source": "session",
        })

    # 2. Chat sessions with messages → "chat" activities
    chats_res = supabase.table("chats").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(10).execute()
    for c in chats_res.data:
        msg_count = supabase.table("messages").select("id", count="exact").eq("chat_id", c["id"]).execute()
        if msg_count.count and msg_count.count > 0:
            activities.append({
                "type": "chat",
                "text": f"AI Recovery Chat — {c.get('title', 'Chat session')}",
                "time": c.get("created_at", ""),
                "source": "chat",
            })

    # 3. Messages with file uploads → "info" activities
    files_res = supabase.table("messages").select("*").eq("role", "user").not_.is_("file_name", "null").eq("chat_id", "dummy").order("created_at", desc=True).limit(10).execute()
    # Fallback: scan all user messages for file uploads
    all_msgs = supabase.table("messages").select("*").order("created_at", desc=True).limit(50).execute()
    for m in all_msgs.data:
        if m.get("file_name"):
            activities.append({
                "type": "info",
                "text": f"File uploaded — {m['file_name']}",
                "time": m.get("created_at", ""),
                "source": "upload",
            })

    # 4. Red-flag messages → "milestone" (important events)
    flags_res = supabase.table("messages").select("*").eq("is_red_flag", True).order("created_at", desc=True).limit(5).execute()
    for f in flags_res.data:
        activities.append({
            "type": "milestone",
            "text": "Health alert noted — follow-up recommended",
            "time": f.get("created_at", ""),
            "source": "flag",
        })

    # Sort all activities by time descending
    def parse_time(item):
        t = item.get("time", "")
        if not t:
            return "1970-01-01T00:00:00"
        return t

    activities.sort(key=parse_time, reverse=True)

    # Return top 10
    return activities[:10]
