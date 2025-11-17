
import json
import numpy as np
import zstandard as zstd
import torch
import os
from datetime import datetime, timezone
import uuid
from sqlalchemy import create_engine, Column, String, Integer, DateTime, JSON
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import asyncio

Base = declarative_base()

class Session(Base):
    __tablename__ = 'sessions'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    model_name = Column(String)
    prompt_hash = Column(String)
    artifact_path = Column(String)
    length_generated_tokens = Column(Integer)
    capture_config = Column(JSON)

    def __repr__(self):
        return f"<Session(id='{self.id}', model_name='{self.model_name}')>"

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

class Persistence:
    def __init__(self, artifact_dir="artifacts", db_path="sessions.db"):
        self.artifact_dir = artifact_dir
        self.db_path = db_path
        
        # Database setup
        self.engine = create_engine(f'sqlite:///{self.db_path}')
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    async def save_session_traces(self, session_id: str, model_name: str, prompt: str, prompt_hash: str, 
                              capture_config: dict, generated_tokens: int, traces: dict):
        return await asyncio.to_thread(
            self._save_session_traces_sync, session_id, model_name, prompt, prompt_hash,
            capture_config, generated_tokens, traces
        )

    def _save_session_traces_sync(self, session_id: str, model_name: str, prompt: str, prompt_hash: str, 
                              capture_config: dict, generated_tokens: int, traces: dict):
        # Prepare metadata
        metadata = {
            "session_id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "model_name": model_name,
            "model_config": {},
            "capture_config": capture_config,
            "prompt": prompt,
            "prompt_hash": prompt_hash,
            "length_prompt_tokens": 0,
            "length_generated_tokens": generated_tokens,
            "random_seed": capture_config.get("deterministic_seed"),
            "hardware_snapshot": {}
        }

        # Save traces to a compressed NPZ file atomically
        final_artifact_path = os.path.join(self.artifact_dir, f"{session_id}.npz")
        temp_artifact_path = f"{final_artifact_path}.tmp"
        
        processed_traces = self._process_traces(traces)
        
        os.makedirs(self.artifact_dir, exist_ok=True)
        np.savez_compressed(final_artifact_path, **processed_traces)

        # Save metadata
        with open(os.path.join(self.artifact_dir, f"{session_id}_metadata.json"), "w") as f:
            json.dump(metadata, f, indent=4)

        # Add entry to the database
        db_session = self.Session()
        new_session = Session(
            id=session_id,
            model_name=model_name,
            prompt_hash=prompt_hash,
            artifact_path=final_artifact_path,
            length_generated_tokens=generated_tokens,
            capture_config=capture_config
        )
        db_session.add(new_session)
        db_session.commit()
        db_session.close()
        
        return final_artifact_path

    def _process_traces(self, traces: dict) -> dict:
        processed_traces = {}
        for key, value in traces.items():
            if key in ["hidden_states", "attentions"]:
                if value is None: continue
                for i, item in enumerate(value):
                    if isinstance(item, (tuple, list)):
                        for j, tensor in enumerate(item):
                            if isinstance(tensor, torch.Tensor):
                                processed_traces[f"{key}_{i}_{j}"] = tensor.cpu().numpy()
                    elif isinstance(item, torch.Tensor):
                        processed_traces[f"{key}_{i}"] = item.cpu().numpy()
                    else:
                        processed_traces[f"{key}_{i}"] = item
            elif isinstance(value, torch.Tensor):
                processed_traces[key] = value.cpu().numpy()
            else:
                processed_traces[key] = value
        return processed_traces

    async def get_session_metadata(self, session_id: str):
        return await asyncio.to_thread(self._get_session_metadata_sync, session_id)

    def _get_session_metadata_sync(self, session_id: str):
        db_session = self.Session()
        session = db_session.query(Session).filter_by(id=session_id).first()
        db_session.close()
        return session

    async def get_session_artifact_path(self, session_id: str) -> str:
        return await asyncio.to_thread(self._get_session_artifact_path_sync, session_id)

    def _get_session_artifact_path_sync(self, session_id: str) -> str:
        db_session = self.Session()
        session = db_session.query(Session).filter_by(id=session_id).first()
        db_session.close()
        return session.artifact_path if session else None

    def close(self):
        if self.engine:
            self.engine.dispose()