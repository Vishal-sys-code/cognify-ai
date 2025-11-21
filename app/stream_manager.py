# app/stream_manager.py
import asyncio
from typing import Dict, List, Any
import uuid

class StreamManager:
    def __init__(self):
        self.sessions: Dict[uuid.UUID, Dict[str, Any]] = {}

    async def create_session(self, session_id: uuid.UUID):
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "queues": [],
                "history": []
            }

    async def add_client(self, session_id: uuid.UUID, queue: asyncio.Queue):
        if session_id not in self.sessions:
            await self.create_session(session_id)
        
        self.sessions[session_id]["queues"].append(queue)
        
        # Replay history for the new client
        for message in self.sessions[session_id]["history"]:
            await queue.put(message)

    async def remove_client(self, session_id: uuid.UUID, queue: asyncio.Queue):
        if session_id in self.sessions:
            if queue in self.sessions[session_id]["queues"]:
                self.sessions[session_id]["queues"].remove(queue)
            
            # Optional: Clean up session if no clients and generation is done? 
            # For now, we leave it to avoid deleting history if a client reconnects.
            # A proper cleanup strategy would be needed for production (e.g. TTL).

    async def broadcast(self, session_id: uuid.UUID, message: dict):
        if session_id not in self.sessions:
            await self.create_session(session_id)
            
        # Add to history
        self.sessions[session_id]["history"].append(message)
        
        # Send to all connected clients
        for queue in self.sessions[session_id]["queues"]:
            await queue.put(message)

stream_manager = StreamManager()