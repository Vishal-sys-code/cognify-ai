
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
import uuid
from datetime import datetime
import os
import hashlib
from .persistence import Persistence
from typing import Optional, Callable
import json

class InstrumentedModel:
    def __init__(self, model_identifier: str, device: str = "cuda", capture_config: dict = None):
        self.model_identifier = model_identifier
        self.device = device
        self.tokenizer = AutoTokenizer.from_pretrained(model_identifier)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.model = AutoModelForCausalLM.from_pretrained(model_identifier).to(device)

        self.capture_config = {
            "capture_logits": True,
            "capture_hidden_states": True,
            "capture_attentions": True,
            "capture_layers": 6,
            "dtype_store": "float16",
            "stream_mode": False,
            "max_seq_len_to_keep": 1024,
            "session_persistence_config": {
                "artifact_dir": "artifacts",
                "compress": True,
            },
            "deterministic_seed": None,
        }
        if capture_config:
            self.capture_config.update(capture_config)

        self.persistence = Persistence(
            artifact_dir=self.capture_config["session_persistence_config"]["artifact_dir"]
        )
        os.makedirs(self.capture_config["session_persistence_config"]["artifact_dir"], exist_ok=True)

    async def generate_with_traces(self, session_id: str, prompt: str, max_new_tokens: int, temperature: float = 0.0,
                             stream_callback: Optional[Callable] = None, stream: bool = False, **kwargs):
        if self.capture_config.get("deterministic_seed") is not None:
            torch.manual_seed(self.capture_config["deterministic_seed"])

        if stream:
            return await self._generate_streaming(session_id, prompt, max_new_tokens, temperature, stream_callback)
        else:
            return await self._generate_batched(session_id, prompt, max_new_tokens, temperature)

    async def _generate_batched(self, session_id: str, prompt: str, max_new_tokens: int, temperature: float):
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        
        outputs = self.model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature if temperature > 0 else 1.0,
            do_sample=temperature > 0,
            output_hidden_states=self.capture_config["capture_hidden_states"],
            output_attentions=self.capture_config["capture_attentions"],
            return_dict_in_generate=True
        )
        
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        generated_tokens_count = outputs.sequences.shape[1] - inputs.input_ids.shape[1]
        
        traces = {
            "sequences": outputs.sequences,
            "hidden_states": outputs.get("hidden_states"),
            "attentions": outputs.get("attentions"),
        }

        return await self._persist_traces(session_id, prompt, prompt_hash, generated_tokens_count, traces)

    async def _generate_streaming(self, session_id: str, prompt: str, max_new_tokens: int, temperature: float, 
                            stream_callback: Optional[Callable]):
        
        input_ids = self.tokenizer(prompt, return_tensors="pt").input_ids.to(self.device)
        past_key_values = None
        all_generated_ids = input_ids.clone()

        # Buffers for traces
        all_hidden_states = []
        all_attentions = []

        for token_index in range(max_new_tokens):
            model_inputs = {"input_ids": input_ids}
            if past_key_values:
                model_inputs["past_key_values"] = past_key_values
            
            with torch.no_grad():
                outputs = self.model(
                    **model_inputs,
                    output_hidden_states=self.capture_config["capture_hidden_states"],
                    output_attentions=self.capture_config["capture_attentions"],
                    use_cache=True
                )

            logits = outputs.logits[:, -1, :]
            
            if temperature > 0:
                probs = torch.nn.functional.softmax(logits / temperature, dim=-1)
                next_token_id = torch.multinomial(probs, num_samples=1)
            else:
                next_token_id = torch.argmax(logits, dim=-1).unsqueeze(0)

            all_generated_ids = torch.cat([all_generated_ids, next_token_id], dim=1)
            input_ids = next_token_id

            past_key_values = outputs.past_key_values
            
            # Store traces
            if self.capture_config["capture_hidden_states"]:
                all_hidden_states.append(outputs.hidden_states)
            if self.capture_config["capture_attentions"]:
                all_attentions.append(outputs.attentions)

            if stream_callback:
                token_str = self.tokenizer.decode(next_token_id[0])
                stream_callback({
                    "message_type": "token_partial",
                    "session_id": session_id,
                    "token_index": token_index,
                    "token_string": token_str,
                    "token_id": next_token_id.item()
                })

            if next_token_id.item() == self.tokenizer.eos_token_id:
                break
        
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        generated_tokens_count = all_generated_ids.shape[1] - len(self.tokenizer(prompt, return_tensors="pt").input_ids[0])

        traces = {
            "sequences": all_generated_ids,
            "hidden_states": all_hidden_states if self.capture_config["capture_hidden_states"] else None,
            "attentions": all_attentions if self.capture_config["capture_attentions"] else None,
        }
        
        if stream_callback:
            stream_callback({"message_type": "generation_end", "session_id": session_id})
            
        return await self._persist_traces(session_id, prompt, prompt_hash, generated_tokens_count, traces)

    async def _persist_traces(self, session_id, prompt, prompt_hash, generated_tokens_count, traces):
        return await self.persistence.save_session_traces(
            session_id=session_id,
            model_name=self.model_identifier,
            prompt=prompt,
            prompt_hash=prompt_hash,
            capture_config=self.capture_config,
            generated_tokens=generated_tokens_count,
            traces=traces
        )

    async def intervene_and_regenerate(self, session_id: str, modifications: dict):
        # For Phase 2, we support modifications based on the spec
        original_session = await self.persistence.get_session_metadata(session_id)
        if not original_session:
            return None
        
        # Retrieve the original prompt from metadata
        metadata_path = os.path.join(self.persistence.artifact_dir, f"{session_id}_metadata.json")
        # This is still a synchronous file read, for a production system, this should be async
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        original_prompt = metadata["prompt"]
        
        # This is a simplified application of modifications. A real implementation
        # would tokenize the prompt and apply token-level modifications.
        modified_prompt = original_prompt
        if "prompt" in modifications: # Simplified for now
            modified_prompt = modifications["prompt"]
            
        new_session_id = str(uuid.uuid4())
        
        # Re-run generation with the modified prompt.
        # This should use the same async task pattern as the main generate endpoint.
        from .schemas import GenerateRequest
        new_request = GenerateRequest(
            prompt=modified_prompt,
            max_new_tokens=original_session.length_generated_tokens,
            temperature=0.0, # Interventions are typically deterministic
            deterministic_seed=original_session.capture_config.get("deterministic_seed")
        )

        from .main import run_generation_task
        await run_generation_task(uuid.UUID(new_session_id), new_request)
        
        return new_session_id