from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
import ollama

load_dotenv()

DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "glm-5.2:cloud"
REQUEST_TIMEOUT_SECONDS = 45


class LocalLLMError(RuntimeError):
    """Raised when the Ollama model cannot return usable text."""


def get_llm_settings() -> dict[str, str | None]:
    return {
        # Cloud-hosted Ollama models use the `:cloud` suffix (e.g. glm-5.2:cloud).
        # The `ollama` SDK authenticates to Ollama Cloud using OLLAMA_API_KEY.
        "model": os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
        # Optional: only needed when targeting a non-default host. For Ollama
        # Cloud with a `:cloud` model, the SDK picks the cloud endpoint
        # automatically when OLLAMA_API_KEY is set, so this can stay blank.
        "host": os.getenv("OLLAMA_BASE_URL") or None,
        "api_key": os.getenv("OLLAMA_API_KEY") or None,
    }


def _build_client() -> ollama.Client:
    """Build an ollama Client honouring the configured host.

    Authentication is handled by the SDK itself: it reads OLLAMA_API_KEY from
    the environment (populated from .env by load_dotenv at import) and injects
    it as a `Bearer` Authorization header. We therefore only pass `host`.
    """
    settings = get_llm_settings()
    client_kwargs: dict[str, Any] = {}
    if settings.get("host"):
        client_kwargs["host"] = settings["host"]
    return ollama.Client(**client_kwargs)


def generate_text(prompt: str, system_prompt: str | None = None) -> str:
    settings = get_llm_settings()
    client = _build_client()

    model = settings["model"]
    if not model:
        raise LocalLLMError("OLLAMA_MODEL is not configured.")

    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    try:
        response = client.chat(
            model=model,
            messages=messages,
        )
    except Exception as exc:  # ollama raises a generic Exception on failure
        raise LocalLLMError(f"Ollama chat request failed: {exc}") from exc

    try:
        text = response["message"]["content"]
    except (KeyError, TypeError) as exc:
        raise LocalLLMError("Ollama response did not include generated text.") from exc

    if not isinstance(text, str):
        raise LocalLLMError("Ollama response did not include generated text.")

    return text.strip()