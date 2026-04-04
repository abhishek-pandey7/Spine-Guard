import os
import io
import json
import base64
from typing import Optional, List
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.messages import HumanMessage, AIMessage

from chatbot_graph import spine_graph

load_dotenv()

# --- Config ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

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
    
    # 3. Store User message in Supabase
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
    
    return {"response": ai_response, "red_flag": red_flag}

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
    
    # PDF Ingestion into Pinecone
    if file.content_type == "application/pdf":
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        
        # Chunk and Upsert
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = text_splitter.split_text(text)
        
        # Metadata includes chat_id and user_id to scope retrieval later if needed
        # (Current retrieval in graph is global across user's spineiq index, 
        # but could be filtered by namespace or metadata)
        pass  # RAG ingestion disabled
    
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
            "mime": file.content_type
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
    
    return {"response": ai_response, "red_flag": red_flag}