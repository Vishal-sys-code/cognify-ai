
import unittest
import os
import shutil
import json
import asyncio
import websockets
from app.instrumented_model import InstrumentedModel
from app.persistence import Persistence

class TestInstrumentedModel(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.artifact_dir = "test_artifacts"
        self.db_path = "test_sessions.db"
        if os.path.exists(self.artifact_dir):
            shutil.rmtree(self.artifact_dir)
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
            
        self.model = InstrumentedModel(
            model_identifier="gpt2",
            device="cpu",
            capture_config={
                "session_persistence_config": {
                    "artifact_dir": self.artifact_dir
                }
            }
        )
        self.model.persistence = Persistence(artifact_dir=self.artifact_dir, db_path=self.db_path)

    def tearDown(self):
        self.model.persistence.close()  # Dispose of the engine's connection pool
        if os.path.exists(self.artifact_dir):
            shutil.rmtree(self.artifact_dir)
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_generate_with_traces_non_streaming(self):
        prompt = "Hello, world!"
        max_new_tokens = 10
        session_id = "test-non-streaming-session"
        self.model.generate_with_traces(session_id, prompt, max_new_tokens)

        artifact_path = self.model.persistence.get_session_artifact_path(session_id)
        self.assertTrue(os.path.exists(artifact_path))

        metadata_path = os.path.join(self.artifact_dir, f"{session_id}_metadata.json")
        self.assertTrue(os.path.exists(metadata_path))

    async def test_generate_with_traces_streaming(self):
        prompt = "Hello, world!"
        max_new_tokens = 5
        session_id = "test-streaming-session"
        
        # This is a simplified test that checks if the callback is called
        # A more thorough test would use a real WebSocket client
        received_tokens = []
        def stream_callback(data):
            received_tokens.append(data)

        self.model.capture_config["stream_mode"] = True
        self.model.generate_with_traces(
            session_id, prompt, max_new_tokens, stream_callback=stream_callback
        )
        
        self.assertGreater(len(received_tokens), 0)
        self.assertEqual(received_tokens[-1]["message_type"], "generation_end")


    def test_intervene_and_regenerate(self):
        prompt = "The capital of France is"
        max_new_tokens = 1
        session_id = "test-intervention-session"
        self.model.generate_with_traces(session_id, prompt, max_new_tokens)

        modifications = {"prompt": "The capital of Germany is"}
        new_session_id = self.model.intervene_and_regenerate(session_id, modifications)

        self.assertIsNotNone(new_session_id)
        
        new_artifact_path = self.model.persistence.get_session_artifact_path(new_session_id)
        self.assertTrue(os.path.exists(new_artifact_path))

if __name__ == '__main__':
    unittest.main()