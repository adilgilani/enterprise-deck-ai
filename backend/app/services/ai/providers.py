"""LLM provider abstraction.

    LLMProvider
      ├── OpenAICompatibleProvider   any /chat/completions endpoint (vLLM, Ollama, OpenRouter, DashScope, …)
      │     └── QwenProvider         Qwen 3.5 via Alibaba Cloud Model Studio (DashScope) compatible mode
      └── MockProvider               deterministic, context-aware output for development and tests

Nothing outside this module knows which vendor is configured.
"""

import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


class LLMError(Exception):
    """Provider/transport failure (network, auth, rate limit)."""


@dataclass
class LLMRequest:
    task: str
    system: str
    user: str
    temperature: float = 0.4
    max_tokens: int = 8000
    json_mode: bool = True
    model: str | None = None
    # Structured inputs. Real providers only see the rendered prompt; the mock provider uses these directly.
    context: dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMResponse:
    text: str
    model: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    latency_ms: int = 0


class LLMProvider(ABC):
    name: str = "base"

    @property
    @abstractmethod
    def model(self) -> str: ...

    @abstractmethod
    async def complete(self, req: LLMRequest) -> LLMResponse: ...

    async def aclose(self) -> None:  # pragma: no cover - default no-op
        return None


class OpenAICompatibleProvider(LLMProvider):
    name = "openai_compatible"

    def __init__(self, base_url: str, api_key: str | None, model: str, timeout: float = 120.0) -> None:
        if not base_url or not model:
            raise LLMError("OpenAI-compatible provider requires a base URL and model name")
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=10.0),
            headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
        )

    @property
    def model(self) -> str:
        return self._model

    def extra_body(self, req: LLMRequest) -> dict[str, Any]:
        return {}

    async def complete(self, req: LLMRequest) -> LLMResponse:
        body: dict[str, Any] = {
            "model": req.model or self._model,
            "messages": [{"role": "system", "content": req.system}, {"role": "user", "content": req.user}],
            "temperature": req.temperature,
            "max_tokens": req.max_tokens,
            **self.extra_body(req),
        }
        if req.json_mode:
            body["response_format"] = {"type": "json_object"}
        started = time.perf_counter()
        try:
            resp = await self._client.post(f"{self._base_url}/chat/completions", json=body)
        except httpx.HTTPError as e:
            raise LLMError(f"{self.name}: transport error: {type(e).__name__}") from e
        latency = int((time.perf_counter() - started) * 1000)
        if resp.status_code >= 400:
            # Never echo request headers (they contain the key); the body is the provider's error message.
            detail = resp.text[:500]
            raise LLMError(f"{self.name}: HTTP {resp.status_code}: {detail}")
        data = resp.json()
        try:
            text = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as e:
            raise LLMError(f"{self.name}: unexpected response shape") from e
        usage = data.get("usage") or {}
        return LLMResponse(
            text=text,
            model=data.get("model", body["model"]),
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
            latency_ms=latency,
        )

    async def aclose(self) -> None:
        await self._client.aclose()


class QwenProvider(OpenAICompatibleProvider):
    """Qwen 3.5 through DashScope's OpenAI-compatible endpoint.

    Qwen3-family models support a hybrid "thinking" mode. Structured JSON generation is faster and
    more reliable with thinking disabled, so it is off by default (QWEN_ENABLE_THINKING).
    """

    name = "qwen"

    def __init__(self, settings: Settings) -> None:
        if settings.qwen_api_key is None:
            raise LLMError("LLM_PROVIDER=qwen but QWEN_API_KEY is not set")
        super().__init__(
            settings.qwen_base_url,
            settings.qwen_api_key.get_secret_value(),
            settings.qwen_model,
            settings.llm_timeout_seconds,
        )
        self._thinking = settings.qwen_enable_thinking

    def extra_body(self, req: LLMRequest) -> dict[str, Any]:
        return {"enable_thinking": self._thinking}


class MockProvider(LLMProvider):
    name = "mock"

    @property
    def model(self) -> str:
        return "mock-structured-v1"

    async def complete(self, req: LLMRequest) -> LLMResponse:
        from app.services.ai import mock

        started = time.perf_counter()
        payload = mock.generate(req.task, req.context)
        text = json.dumps(payload, ensure_ascii=False)
        return LLMResponse(
            text=text,
            model=self.model,
            prompt_tokens=len(req.system + req.user) // 4,
            completion_tokens=len(text) // 4,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


_provider: LLMProvider | None = None


def build_provider(settings: Settings | None = None) -> LLMProvider:
    s = settings or get_settings()
    if s.llm_provider == "qwen":
        return QwenProvider(s)
    if s.llm_provider == "openai_compatible":
        key = s.openai_compatible_api_key.get_secret_value() if s.openai_compatible_api_key else None
        return OpenAICompatibleProvider(
            s.openai_compatible_base_url, key, s.openai_compatible_model, s.llm_timeout_seconds
        )
    return MockProvider()


def get_provider() -> LLMProvider:
    global _provider
    if _provider is None:
        _provider = build_provider()
        log.info("LLM provider ready", extra={"data": {"provider": _provider.name, "model": _provider.model}})
    return _provider


def set_provider(provider: LLMProvider | None) -> None:
    """Test hook."""
    global _provider
    _provider = provider
