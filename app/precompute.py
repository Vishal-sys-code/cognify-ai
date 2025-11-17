# app/precompute.py
import numpy as np
from sklearn.decomposition import PCA
import os
import time
import zstandard as zstd
import io

def precompute_visual_artifacts_sync(artifact_path: str, max_retries=10, retry_delay=1):
    """
    Loads an artifact, computes visual artifacts, and saves them.
    This function is designed to be run in a background process pool.
    """
    for attempt in range(max_retries):
        try:
            if artifact_path.endswith(".zst"):
                with open(artifact_path, 'rb') as f:
                    compressed_data = f.read()
                decompressed_data = zstd.decompress(compressed_data)
                buffer = io.BytesIO(decompressed_data)
                data = np.load(buffer, allow_pickle=True)
            else:
                data = np.load(artifact_path, allow_pickle=True)
            
            # Simplified placeholder logic for generating visual artifacts
            num_tokens = data.get('sequences', np.array([[0]*10])).shape[1]
            hidden_size = data.get('hidden_states_0_0', np.random.rand(num_tokens, 8)).shape[-1]
            
            attention_rollout = np.random.rand(num_tokens, num_tokens)
            hidden_states = np.random.rand(num_tokens, hidden_size)

            pca = PCA(n_components=2)
            if hidden_states.shape[0] >= 2:
                pca_coords = pca.fit_transform(hidden_states)
            else:
                pca_coords = np.zeros((hidden_states.shape[0], 2))

            base_path = os.path.splitext(artifact_path)[0]
            np.savez(f"{base_path}.attn_rollout.npz", rollout=attention_rollout)
            np.savez(f"{base_path}.pca.npz", coords=pca_coords)
            
            print(f"Successfully precomputed artifacts for {artifact_path}")
            return # Success, exit the function

        except (zstd.ZstdError, FileNotFoundError) as e:
            if attempt < max_retries - 1:
                print(f"Attempt {attempt + 1} failed for {artifact_path}: {e}. Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                print(f"Error during precomputation for {artifact_path} after {max_retries} attempts: {e}")
        except Exception as e:
            print(f"An unexpected error occurred during precomputation for {artifact_path}: {e}")
            break # Exit on other errors