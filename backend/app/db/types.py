"""Portable column types.

PostgreSQL gets JSONB and pgvector; SQLite (local fallback / tests) gets JSON for both.
"""

from typing import Any

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

from app.core.config import get_settings

JSONType = JSON().with_variant(JSONB(), "postgresql")


class Embedding(TypeDecorator[list[float]]):
    """`vector(n)` on PostgreSQL (pgvector), JSON array elsewhere."""

    impl = JSON
    cache_ok = True

    def __init__(self, dim: int | None = None) -> None:
        super().__init__()
        self.dim = dim or get_settings().embedding_dim

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql" and get_settings().pgvector_enabled:
            from pgvector.sqlalchemy import Vector

            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        return [float(x) for x in value]

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        return [float(x) for x in value]
