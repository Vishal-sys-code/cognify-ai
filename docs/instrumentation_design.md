
# Instrumentation Design Document

This document outlines the design of the instrumented causal language model wrapper and server.

## 1. High-Level Architecture

The system consists of three main components:

- **`InstrumentedModel`:** A Python class that wraps a Hugging Face causal language model to capture detailed traces during generation.
- **FastAPI Server:** A web server that exposes an API for triggering generation, streaming results, and retrieving artifacts.
- **Persistence Layer:** A component responsible for storing and retrieving session artifacts and metadata.

## 2. Artifact Schema

Each generation session produces a compressed artifact (`.npz.zst`) and a metadata file (`_metadata.json`).

### 2.1. Metadata (`_metadata.json`)

- **`session_id`** (string): A unique UUID for the session.
- **`created_at`** (string): An ISO 8601 timestamp of when the session was created.
- **`model_name`** (string): The Hugging Face identifier of the model used.
- **`model_config`** (dict): A snapshot of the model's configuration (e.g., number of layers, heads).
- **`capture_config`** (dict): The configuration used for capturing traces.
- **`prompt`** (string): The input prompt (optional, for privacy).
- **`prompt_hash`** (string): A SHA256 hash of the prompt.
- **`length_prompt_tokens`** (int): The number of tokens in the prompt.
- **`length_generated_tokens`** (int): The number of tokens generated.
- **`random_seed`** (int, optional): The random seed used for generation.
- **`hardware_snapshot`** (dict): Information about the hardware used (e.g., GPU type).

### 2.2. Traces (`.npz.zst`)

The compressed artifact contains the following arrays:

- **`sequences`**: The generated token IDs.
- **`hidden_states_{token_index}_{layer_index}`**: The hidden state for each token and layer.
- **`attentions_{token_index}_{layer_index}`**: The attention matrix for each token and layer.

## 3. API Contract

### 3.1. `POST /api/generate`

- **Request Body:**
  - `prompt` (string): The input prompt.
  - `max_new_tokens` (int): The maximum number of new tokens to generate.
  - `temperature` (float, optional): The sampling temperature.
  - `capture_config` (dict, optional): Overrides for the capture configuration.
  - `stream` (bool, optional): Whether to stream the results.
- **Response:**
  - `session_id` (string): The ID of the generation session.
  - `ws_url` (string, optional): The WebSocket URL for streaming.

### 3.2. `GET /api/session/{session_id}/metadata`

- **Response:** The metadata JSON for the specified session.

### 3.3. `GET /api/session/{session_id}/artifact`

- **Response:** The path to the session artifact.

### 3.4. `POST /api/intervene`

- **Request Body:**
  - `session_id` (string): The ID of the session to intervene on.
  - `modifications` (dict): The modifications to apply.
- **Response:**
  - `new_session_id` (string): The ID of the new session created by the intervention.

## 4. Operational Guidance

- **Dependencies:** The required Python packages are listed in `requirements.txt`.
- **Running the Server:** Use `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- **Running Tests:** Use `python -m unittest discover tests`.