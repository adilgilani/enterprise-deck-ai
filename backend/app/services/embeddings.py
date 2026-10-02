"""Embedding providers for the RAG pipeline.

    hash              dependency-free signed feature hashing over word unigrams + bigrams (lexical, offline)
    fastembed         open-source local model via ONNX runtime (pip install '.[embeddings]')
    openai_compatible /embeddings endpoint (e.g. Qwen text-embedding-v4 on DashScope)

All vectors are L2-normalized and have EMBEDDING_DIM dimensions so cosine distance works uniformly.
Changing provider requires re-embedding (POST /api/v1/documents/reindex).
"""

import asyncio
import hashlib
import math
import re
from abc import ABC, abstractmethod

import httpx

from app.core.config import get_settings

_TOKEN = re.compile(r"[\w؀-ۿ]+", re.UNICODE)


def _normalize(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def _fit(v: list[float], dim: int) -> list[float]:
    if len(v) == dim:
        return v
    return (v + [0.0] * dim)[:dim]


class EmbeddingProvider(ABC):
    name = "base"

    def __init__(self, dim: int) -> None:
        self.dim = dim

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]: ...


class HashEmbedding(EmbeddingProvider):
    name = "hash"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._one(t) for t in texts]

    def _one(self, text: str) -> list[float]:
        v = [0.0] * self.dim
        toks = [t.lower() for t in _TOKEN.findall(text)]
        feats = toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:], strict=False)]
        for f in feats:
            h = int.from_bytes(hashlib.blake2b(f.encode(), digest_size=8).digest(), "big")
            idx = h % self.dim
            v[idx] += 1.0 if (h >> 63) & 1 else -1.0
        # sublinear term frequency
        v = [math.copysign(math.log1p(abs(x)), x) for x in v]
        return _normalize(v)


class FastEmbedEmbedding(EmbeddingProvider):
    name = "fastembed"

    def __init__(self, dim: int, model: str) -> None:
        super().__init__(dim)
        from fastembed import TextEmbedding  # optional dependency

        self._model = TextEmbedding(model_name=model)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vecs = await asyncio.to_thread(lambda: [list(map(float, v)) for v in self._model.embed(texts)])
        return [_normalize(_fit(v, self.dim)) for v in vecs]


class OpenAICompatibleEmbedding(EmbeddingProvider):
    name = "openai_compatible"

    def __init__(self, dim: int, base_url: str, api_key: str | None, model: str) -> None:
        super().__init__(dim)
        self._url = base_url.rstrip("/") + "/embeddings"
        self._model = model
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    async def embed(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        async with httpx.AsyncClient(timeout=60, headers=self._headers) as client:
            for i in range(0, len(texts), 10):  # DashScope caps batch size at 10
                batch = texts[i : i + 10]
                r = await client.post(self._url, json={"model": self._model, "input": batch, "dimensions": self.dim})
                r.raise_for_status()
                data = sorted(r.json()["data"], key=lambda d: d["index"])
                out += [_normalize(_fit(d["embedding"], self.dim)) for d in data]
        return out


_provider: EmbeddingProvider | None = None


def get_embedder() -> EmbeddingProvider:
    global _provider
    if _provider is None:
        s = get_settings()
        if s.embedding_provider == "fastembed":
            _provider = FastEmbedEmbedding(s.embedding_dim, s.fastembed_model)
        elif s.embedding_provider == "openai_compatible":
            key = s.embedding_api_key or s.qwen_api_key
            _provider = OpenAICompatibleEmbedding(
                s.embedding_dim, s.embedding_base_url, key.get_secret_value() if key else None, s.embedding_model
            )
        else:
            _provider = HashEmbedding(s.embedding_dim)
    return _provider


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=False))
