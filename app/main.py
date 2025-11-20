
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from .instrumented_model import InstrumentedModel
from .persistence import Persistence
import os
import asyncio
import uuid
import json
from .schemas import GenerateRequest, GenerateResponse, TracesResponse, InterveneRequest, InterveneResponse
from typing import Dict
from .stream_manager import stream_manager
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi.responses import RedirectResponse

app = FastAPI(
    title="Instrumented Causal Language Model Server",
    description="A production-quality, asynchronous FastAPI server for instrumented causal language models. It supports real-time streaming, intervention, and detailed trace persistence.",
    version="0.1.0",
)

@app.get("/", tags=["General"])
async def root():
    """Redirects to the API documentation."""
    return RedirectResponse(url="/docs")

# Add Prometheus instrumentator
instrumentator = Instrumentator().instrument(app)

@app.on_event("startup")
async def startup():
    instrumentator.expose(app)
    
@app.on_event("shutdown")
def shutdown():
    process_pool.shutdown(wait=True)

instrumented_model = InstrumentedModel(model_identifier=os.environ.get("MODEL_IDENTIFIER", "gpt2"), device="cpu")
persistence = Persistence()

# In-memory session storage. In a production environment, you'd use a more
# robust solution like Redis or a database.
sessions: Dict[uuid.UUID, Dict] = {}

from .precompute import precompute_visual_artifacts_sync
import concurrent.futures

process_pool = concurrent.futures.ProcessPoolExecutor()

async def run_generation_task(session_id: uuid.UUID, request: GenerateRequest):
    """The actual generation logic, designed to be run as a background task."""
    sessions[session_id] = {'status': 'in_progress'}
    try:
        # The result of generate_with_traces is the artifact path
        artifact_path = await instrumented_model.generate_with_traces(
            session_id=str(session_id),
            prompt=request.prompt,
            max_new_tokens=request.max_new_tokens,
            temperature=request.temperature,
            stream_callback=lambda data: asyncio.create_task(stream_manager.broadcast(session_id, data)),
            stream=request.stream
        )
        sessions[session_id]['status'] = 'completed'
        sessions[session_id]['artifact_path'] = artifact_path
        
        # Spawn a background task for precomputation, unless disabled
        if not os.environ.get("NO_PRECOMPUTE"):
            loop = asyncio.get_running_loop()
            loop.run_in_executor(process_pool, precompute_visual_artifacts_sync, artifact_path)

    except Exception as e:
        import traceback
        traceback.print_exc()
        sessions[session_id]['status'] = 'failed'
        sessions[session_id]['error'] = str(e)
    finally:
        # Signal the end of the stream to any connected clients
        await stream_manager.broadcast(session_id, {"message_type": "generation_end"})


@app.post("/api/generate", response_model=GenerateResponse, tags=["API"])
async def generate_request(request: GenerateRequest):
    """Starts a new generation session."""
    session_id = uuid.uuid4()
    
    if not request.stream:
        # Run generation in a background thread and wait for it to complete.
        await run_generation_task(session_id, request)
        return GenerateResponse(
            session_id=session_id,
            status_url=f"/api/session/{session_id}/traces",
        )

    # For streaming requests, start the generation as a background task.
    await run_generation_task(session_id, request)
    
    return GenerateResponse(
        session_id=session_id,
        status_url=f"/api/session/{session_id}/traces",
        ws_url=f"/ws/session/{session_id}",
    )

@app.get("/api/session/{session_id}/traces", response_model=TracesResponse, tags=["API"])
async def get_traces(session_id: uuid.UUID):
    """Gets the status and traces of a generation session."""
    session = sessions.get(session_id)
    if not session:
        # Check if it was a non-streamed session that completed directly
        metadata = persistence.get_session_metadata(str(session_id))
        if metadata:
            return TracesResponse(
                session_id=session_id,
                status="completed",
                metadata=metadata,
                artifact_url=f"/artifacts/{session_id}.npz",
            )
        raise HTTPException(status_code=404, detail="Session not found")

    status = session['status']
    if status == 'in_progress':
        return TracesResponse(session_id=session_id, status=status, metadata={})

    if status == 'failed':
        raise HTTPException(status_code=500, detail=session.get('error', 'Generation failed'))

    # Status is 'completed'
    metadata = await persistence.get_session_metadata(str(session_id))
    artifact_path = session.get('artifact_path')
    precomputed_artifacts = []

    if artifact_path:
        base_artifact_path = os.path.splitext(artifact_path)[0]
        if os.path.exists(f"{base_artifact_path}.attn_rollout.npz"):
            precomputed_artifacts.append({"name": "attention_rollout", "url": f"/artifacts/{session_id}.attn_rollout.npz"})
        if os.path.exists(f"{base_artifact_path}.pca.npz"):
            precomputed_artifacts.append({"name": "pca", "url": f"/artifacts/{session_id}.pca.npz"})

    return TracesResponse(
        session_id=session_id,
        status="completed",
        metadata=metadata.to_dict() if metadata else {},
        artifact_url=f"/artifacts/{session_id}.npz" if artifact_path else None,
        precomputed=precomputed_artifacts,
    )

from fastapi.responses import JSONResponse
import numpy as np

from fastapi import Query

@app.get("/api/session/{session_id}/artifact/{artifact_name}", tags=["API"])
async def get_artifact_as_json(
    session_id: uuid.UUID,
    artifact_name: str,
    layer: int = Query(None),
    head: int = Query(None),
    average: bool = Query(False),
):
    """Gets a precomputed artifact and returns it as JSON."""
    session = sessions.get(session_id)
    if not session or 'artifact_path' not in session:
        raise HTTPException(status_code=404, detail="Session artifact not found")
    
    base_artifact_path = os.path.splitext(session['artifact_path'])[0]
    artifact_filename = f"{base_artifact_path}.{artifact_name}.npz"
    
    if not os.path.exists(artifact_filename):
        raise HTTPException(status_code=404, detail="Artifact not found")
        
    try:
        data = np.load(artifact_filename)
        # Assuming the main data is in a key named 'arr_0' or the first key
        key = data.files[0]
        array_data = data[key]

        if artifact_name == "attention_rollout":
            # This is where you would add your logic to select the correct layer and head
            # For now, we'll just return the first layer and head
            if layer is not None and head is not None and not average:
                # Placeholder for selecting a specific head from a specific layer
                pass
            elif average:
                # Placeholder for averaging heads
                pass
        
        return JSONResponse(content={"data": array_data.tolist()})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing artifact: {e}")


@app.websocket("/ws/session/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: uuid.UUID):
    """WebSocket endpoint for streaming generation results."""
    await websocket.accept()
    queue = asyncio.Queue()
    await stream_manager.add_client(session_id, queue)
    
    try:
        # Handle the client-server handshake
        initial_message = await websocket.receive_json()
        client_id = initial_message.get("client_id", "anonymous")
        subscribe = initial_message.get("subscribe", [])
        
        # You could use the subscribe list to filter messages, but for now, we'll send everything.
        
        await websocket.send_json({"status": "ok", "server_timestamp": asyncio.get_event_loop().time()})
        
        while True:
            message = await queue.get()
            if message.get("message_type") == "generation_end":
                await websocket.send_json(message)
                break
            await websocket.send_json(message)
            
    except WebSocketDisconnect:
        print(f"Client {client_id} disconnected from session {session_id}")
    finally:
        await stream_manager.remove_client(session_id, queue)
        await websocket.close()


@app.post("/api/intervene", response_model=InterveneResponse, tags=["API"])
async def intervene(request: InterveneRequest):
    """Intervenes on a previous generation and re-runs it."""
    if not request.session_id:
        raise HTTPException(status_code=400, detail="session_id is required for intervention")

    new_session_id_str = await instrumented_model.intervene_and_regenerate(
        session_id=request.session_id,
        modifications=request.model_dump()['modifications'] # Pass the raw dict
    )
    
    if not new_session_id_str:
        raise HTTPException(status_code=404, detail="Session to intervene on not found")
    
    new_session_uuid = uuid.UUID(new_session_id_str)
    
    return InterveneResponse(
        new_session_id=new_session_uuid,
        status_url=f"/api/session/{new_session_uuid}/traces"
    )