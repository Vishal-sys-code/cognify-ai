# tests/test_persistence.py
import unittest
import os
import shutil
import uuid
import numpy as np
from app.persistence import Persistence

class TestPersistence(unittest.TestCase):
    def setUp(self):
        self.artifact_dir = "test_artifacts"
        self.db_path = "test_sessions.db"
        self.persistence = Persistence(artifact_dir=self.artifact_dir, db_path=self.db_path)

    def tearDown(self):
        self.persistence.close()
        if os.path.exists(self.artifact_dir):
            shutil.rmtree(self.artifact_dir)
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_save_and_load_artifact(self):
        """Test saving and loading an artifact."""
        session_id = str(uuid.uuid4())
        traces = {
            "sequences": np.array([[1, 2, 3]]),
            "hidden_states": [np.array([[[1.0, 2.0], [3.0, 4.0]]])],
        }
        
        artifact_path = self.persistence._save_session_traces_sync(
            session_id=session_id,
            model_name="test_model",
            prompt="test_prompt",
            prompt_hash="test_hash",
            capture_config={},
            generated_tokens=1,
            traces=traces,
        )
        
        self.assertTrue(os.path.exists(artifact_path))
        
        loaded_traces = np.load(artifact_path)
        self.assertTrue("sequences" in loaded_traces)
        self.assertTrue("hidden_states_0" in loaded_traces)