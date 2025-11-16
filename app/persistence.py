
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

class Persistence:
    def __init__(self, artifact_dir="artifacts", db_path="sessions.db"):
        self.artifact_dir = artifact_dir
        self.db_path = db_path
        os.makedirs(self.artifact_dir, exist_ok=True)
        
        # Database setup
        self.engine = create_engine(f'sqlite:///{self.db_path}')
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def save_session_traces(self, session_id: str, model_name: str, prompt: str, prompt_hash: str, 
                              capture_config: dict, generated_tokens: int, traces: dict):
        """
        Saves the traces and metadata for a generation session.

        Args:
            session_id (str): The unique ID for the session.
            model_name (str): The name of the model used.
            prompt (str): The input prompt.
            prompt_hash (str): The SHA256 hash of the prompt.
            capture_config (dict): The capture configuration used.
            generated_tokens (int): The number of tokens generated.
            traces (dict): A dictionary containing the captured traces (logits, hidden_states, etc.).
        """
        # Prepare metadata
        metadata = {
            "session_id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "model_name": model_name,
            "model_config": {}, # Placeholder for model config
            "capture_config": capture_config,
            "prompt": prompt,
            "prompt_hash": prompt_hash,
            "length_prompt_tokens": 0, # Placeholder
            "length_generated_tokens": generated_tokens,
            "random_seed": capture_config.get("deterministic_seed"),
            "hardware_snapshot": {} # Placeholder for hardware info
        }

        # Save traces to a compressed NPZ file
        artifact_path = os.path.join(self.artifact_dir, f"{session_id}.npz")
        
        # Convert tensors to numpy arrays and flatten nested structures
        processed_traces = {}
        for key, value in traces.items():
            if key in ["hidden_states", "attentions"]:
                if value is None: continue
                for i, item in enumerate(value):
                    if isinstance(item, tuple) or isinstance(item, list):
                        for j, tensor in enumerate(item):
                            if isinstance(tensor, torch.Tensor):
                                processed_traces[f"{key}_{i}_{j}"] = tensor.cpu().numpy()
                    elif isinstance(item, torch.Tensor):
                        processed_traces[f"{key}_{i}"] = item.cpu().numpy()
            elif isinstance(value, torch.Tensor):
                processed_traces[key] = value.cpu().numpy()
            else:
                processed_traces[key] = value
        
        if capture_config.get("compress", True):
            # Compress with zstandard
            with open(f"{artifact_path}.zst", "wb") as f:
                cctx = zstd.ZstdCompressor()
                with cctx.stream_writer(f) as compressor:
                    np.savez(compressor, **processed_traces)
            artifact_path += ".zst"
        else:
            np.savez(artifact_path, **processed_traces)

        # Save metadata
        with open(os.path.join(self.artifact_dir, f"{session_id}_metadata.json"), "w") as f:
            json.dump(metadata, f, indent=4)

        # Add entry to the database
        db_session = self.Session()
        new_session = Session(
            id=session_id,
            model_name=model_name,
            prompt_hash=prompt_hash,
            artifact_path=artifact_path,
            length_generated_tokens=generated_tokens,
            capture_config=capture_config
        )
        db_session.add(new_session)
        db_session.commit()
        db_session.close()

    def get_session_metadata(self, session_id: str):
        db_session = self.Session()
        session = db_session.query(Session).filter_by(id=session_id).first()
        db_session.close()
        return session

    def get_session_artifact_path(self, session_id: str) -> str:
        db_session = self.Session()
        session = db_session.query(Session).filter_by(id=session_id).first()
        db_session.close()
        return session.artifact_path if session else None

    def close(self):
        """Disposes of the connection pool."""
        if self.engine:
            self.engine.dispose()