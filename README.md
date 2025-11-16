
# Instrumented Causal Language Model Server

This project implements an instrumented causal language model wrapper and server that produces token-by-token generation and captures per-token traces.

## Features

- **Instrumented Model:** A wrapper around a Hugging Face causal language model that captures logits, hidden states, and attention matrices.
- **Streaming API:** A WebSocket-based API for real-time streaming of generated tokens and traces.
- **Persistence:** Session traces are saved to compressed artifacts for later analysis.
- **Intervention API:** An API for modifying previous generations and re-running them.

## Getting Started

### 1. Installation

Clone the repository and install the required dependencies:

```bash
git clone https://github.com/your-username/instrumented-llm.git
cd instrumented-llm
pip install -r requirements.txt
```

### 2. Running the Server

Start the FastAPI server using Uvicorn:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Running the Tests

To run the test suite, use the following command:

```bash
python -m unittest discover tests
```

## Usage

### Generating Text (Non-Streaming)

```bash
curl -X 'POST' \
  'http://localhost:8000/api/generate' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "prompt": "Hello, world!",
  "max_new_tokens": 10
}'
```

### Generating Text (Streaming)

1.  Make a request to the `/api/generate` endpoint with `"stream": true` to get a WebSocket URL.
2.  Connect to the WebSocket URL to receive the streaming results.

### Retrieving Artifacts

-   `GET /api/session/{session_id}/metadata`: Get the metadata for a session.
-   `GET /api/session/{session_id}/artifact`: Get the path to the session artifact.