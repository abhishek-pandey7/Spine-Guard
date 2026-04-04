import os
from typing import Annotated, List, TypedDict, Optional
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from spine_prompt import SPINE_RECOVERY_PROMPT

load_dotenv()

# --- State ---
class SpineState(TypedDict):
    messages: List[BaseMessage]
    patient_context: dict
    uploaded_file: Optional[dict]
    red_flag_detected: bool
    retrieved_context: Optional[str]

# --- LLM ---
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", max_output_tokens=1024)

# --- Nodes ---

def red_flag_check_node(state: SpineState):
    """Checks for emergency symptoms in the last message."""
    last_message = state["messages"][-1].content.lower()
    red_flags = ["fever", "numbness", "incontinence", "weakness", "severe pain", "cannot walk", "leakage"]
    
    detected = any(flag in last_message for flag in red_flags)
    return {"red_flag_detected": detected}

def process_file_node(state: SpineState):
    """Processes uploaded file (PDF/Image) and adds it to the conversation."""
    file = state.get("uploaded_file")
    if not file:
        return {}
    
    last_user_msg = state["messages"][-1]
    last_user_text = last_user_msg.content if isinstance(last_user_msg, HumanMessage) else ""

    if file["type"] == "image":
        multimodal_message = HumanMessage(content=[
            {"type": "image_url", "image_url": {"url": f"data:{file['mime']};base64,{file['data']}"}},
            {"type": "text", "text": last_user_text or "Please analyze this image related to my spine recovery."}
        ])
        messages = state["messages"][:-1] + [multimodal_message]
        return {"messages": messages}
    
    elif file["type"] == "pdf":
        # For PDF, we've already ingested it into Pinecone in the main.py before calling graph.
        # So we just retrieve context here or in a separate retrieval node.
        return {}

    return {}

def retrieve_context_node(state: SpineState):
    """RAG disabled for now — returns empty context."""
    return {"retrieved_context": ""}

def llm_node(state: SpineState):
    """Main LLM response node."""
    context = state.get("patient_context", {})
    retrieved = state.get("retrieved_context", "")
    
    # Enrich prompt with patient context and RAG context
    system_msg = SystemMessage(content=SPINE_RECOVERY_PROMPT.format(
        surgery_type=context.get("surgery_type", "Unknown"),
        days_post_op=context.get("days_post_op", "Unknown"),
        recovery_phase=context.get("recovery_phase", "General"),
        pain_score=context.get("pain_score", "not provided"),
        language=context.get("language", "English"),
        exercises=", ".join(context.get("exercises", [])) if context.get("exercises") else "None specified"
    ))
    
    # Add retrieved PDF context if available
    if retrieved:
        rag_instruction = f"\n\nCONTEXT FROM YOUR DOCUMENTS:\n{retrieved}\n\nUse this context where relevant to the user's question."
        system_msg.content += rag_instruction

    if state["red_flag_detected"]:
        system_msg.content += "\n\nCRITICAL: The user has reported potential red-flag symptoms. You MUST immediately advise them to contact their surgeon or visit the ER. Do not provide medical advice beyond this escalation."

    response = llm.invoke([system_msg] + state["messages"])
    return {"messages": [response]}

# --- Graph ---
workflow = StateGraph(SpineState)

workflow.add_node("red_flag_check", red_flag_check_node)
workflow.add_node("process_file", process_file_node)
workflow.add_node("retrieve_context", retrieve_context_node)
workflow.add_node("llm", llm_node)

workflow.set_entry_point("red_flag_check")
workflow.add_edge("red_flag_check", "process_file")
workflow.add_edge("process_file", "retrieve_context")
workflow.add_edge("retrieve_context", "llm")
workflow.add_edge("llm", END)

spine_graph = workflow.compile()