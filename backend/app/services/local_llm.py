from __future__ import annotations

import os
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "mistral"
REQUEST_TIMEOUT_SECONDS = 45


class LocalLLMError(RuntimeError):
    """Raised when the local Ollama model cannot return usable text."""


def get_llm_settings() -> dict[str, str]:
    return {
        "base_url": os.getenv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).rstrip("/"),
        "model": os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
    }


def generate_text(prompt: str, system_prompt: str | None = None) -> str:
    settings = get_llm_settings()
    url = f"{settings['base_url']}/api/generate"
    payload: dict[str, Any] = {
        "model": settings["model"],
        "prompt": prompt,
        "stream": False,
    }
    if system_prompt:
        payload["system"] = system_prompt

    try:
        response = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.Timeout as exc:
        raise LocalLLMError("Ollama request timed out.") from exc
    except requests.exceptions.ConnectionError as exc:
        raise LocalLLMError("Ollama is not reachable. Is `ollama serve` running?") from exc
    except requests.exceptions.RequestException as exc:
        raise LocalLLMError(f"Ollama request failed: {exc}") from exc
    except ValueError as exc:
        raise LocalLLMError("Ollama returned invalid JSON.") from exc

    text = data.get("response")
    if not isinstance(text, str):
        raise LocalLLMError("Ollama response did not include generated text.")

    return text.strip()
