# app/schemas.py
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uuid

# 3.1 POST /api/generate
class GenerateRequest(BaseModel):
    prompt: str
    model_name: Optional[str] = None
    max_new_tokens: int = 128
    temperature: Optional[float] = 0.8
    top_k: Optional[int] = None
    top_p: Optional[float] = None
    cot: bool = False
    stream: bool = False
    capture_config: Optional[Dict[str, Any]] = None
    deterministic_seed: Optional[int] = None

class GenerateResponse(BaseModel):
    session_id: uuid.UUID
    status_url: str
    ws_url: Optional[str] = None
    estimated_capacity: Optional[Dict[str, Any]] = None

# 3.3 GET /api/session/{session_id}/traces
class TracesResponse(BaseModel):
    session_id: uuid.UUID
    status: str
    metadata: Dict[str, Any]
    artifact_url: Optional[str] = None
    inline_traces: Optional[List[Dict[str, Any]]] = None
    precomputed: List[Dict[str, str]] = []

# 3.4 POST /api/intervene
class InterventionModification(BaseModel):
    type: str
    token_idx: int
    replacement_token: Optional[str] = None

class InterveneRequest(BaseModel):
    session_id: Optional[str] = None
    prompt: Optional[str] = None
    modifications: List[InterventionModification]
    max_new_tokens: Optional[int] = None
    temperature: Optional[float] = None
    capture_config: Optional[Dict[str, Any]] = None
    deterministic_seed: Optional[int] = None

class InterveneResponse(BaseModel):
    new_session_id: uuid.UUID
    status_url: str
    artifact_url: Optional[str] = None
    ws_url: Optional[str] = None