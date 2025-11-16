
from fastapi import FastAPI, HTTPException, WebSocket
from pydantic import BaseModel
from .instrumented_model import InstrumentedModel
from .persistence import Persistence
import os
import asyncio
import uuid
import json

app = FastAPI()

instrumented_model = InstrumentedModel(model_identifier="gpt2", device="cpu")
persistence = Persistence()

class GenerateRequest(BaseModel):
    prompt: str
    max_new_tokens: int
    temperature: float = 0.0
    capture_config: dict = None
    stream: bool = False

@app.post("/api/generate")
async def generate_request(request: GenerateRequest):
    session_id = str(uuid.uuid4())
    ws_url = f"/ws/{session_id}"
    
    # Store the request parameters to be retrieved by the WebSocket endpoint
    # In a real application, you would use a more robust storage mechanism like Redis
    with open(f"/tmp/{session_id}.json", "w") as f:
        json.dump(request.dict(), f)
        
    return {"session_id": session_id, "ws_url": ws_url}

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    # Retrieve the request parameters
    try:
        with open(f"/tmp/{session_id}.json", "r") as f:
            request_data = json.load(f)
        os.remove(f"/tmp/{session_id}.json")
    except FileNotFoundError:
        await websocket.close(code=1011, reason="Session not found")
        return

    async def stream_callback(data):
        await websocket.send_json(data)

    capture_config = request_data.get("capture_config", {})
    capture_config["stream_mode"] = True
    instrumented_model.capture_config.update(capture_config)

    instrumented_model.generate_with_traces(
        session_id=session_id,
        prompt=request_data["prompt"],
        max_new_tokens=request_data["max_new_tokens"],
        temperature=request_data["temperature"],
        stream_callback=stream_callback
    )
    
    await websocket.close()

@app.get("/api/session/{session_id}/metadata")
async def get_metadata(session_id: str):
    metadata = persistence.get_session_metadata(session_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Session not found")
    return metadata

@app.get("/api/session/{session_id}/artifact")
async def get_artifact(session_id: str):
    artifact_path = persistence.get_session_artifact_path(session_id)
    if not artifact_path or not os.path.exists(artifact_path):
        raise HTTPException(status_code=404, detail="Artifact not found")
    return {"artifact_path": artifact_path}

class InterveneRequest(BaseModel):
    session_id: str
    modifications: dict

@app.post("/api/intervene")
async def intervene(request: InterveneRequest):
    new_session_id = instrumented_model.intervene_and_regenerate(
        session_id=request.session_id,
        modifications=request.modifications
    )
    if not new_session_id:
        raise HTTPException(status_code=404, detail="Session to intervene on not found")
    return {"new_session_id": new_session_id}