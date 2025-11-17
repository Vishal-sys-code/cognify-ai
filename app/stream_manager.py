# app/stream_manager.py
import asyncio
from typing import Dict, List
import uuid

class StreamManager:
    def __init__(self):
        self.sessions: Dict[uuid.UUID, List[asyncio.Queue]] = {}

    async def create_session(self, session_id: uuid.UUID):
        self.sessions[session_id] = []

    async def add_client(self, session_id: uuid.UUID, queue: asyncio.Queue):
        if session_id not in self.sessions:
            await self.create_session(session_id)
        self.sessions[session_id].append(queue)

    async def remove_client(self, session_id: uuid.UUID, queue: asyncio.Queue):
        if session_id in self.sessions:
            self.sessions[session_id].remove(queue)
            if not self.sessions[session_id]:
                del self.sessions[session_id]

    async def broadcast(self, session_id: uuid.UUID, message: dict):
        if session_id in self.sessions:
            for queue in self.sessions[session_id]:
                await queue.put(message)

stream_manager = StreamManager()