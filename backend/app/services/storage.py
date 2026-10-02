"""File storage abstraction. PostgreSQL stores only metadata + storage keys.

    StorageProvider
      ├── LocalStorage   filesystem (dev without Docker)
      └── S3Storage      MinIO (self-hosted, default in Docker) or any S3-compatible service
"""

import asyncio
import re
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import Settings, get_settings


class StorageError(Exception):
    pass


def make_key(org_id: uuid.UUID, kind: str, filename: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", filename).strip("-")[-120:] or "file"
    return f"org/{org_id}/{kind}/{uuid.uuid4().hex}/{safe}"


class StorageProvider(ABC):
    name = "base"

    @abstractmethod
    async def put(self, key: str, data: bytes, content_type: str) -> None: ...

    @abstractmethod
    async def get(self, key: str) -> bytes: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    async def ensure_ready(self) -> None:
        return None


class LocalStorage(StorageProvider):
    name = "local"

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if not p.is_relative_to(self.root):  # path traversal guard
            raise StorageError("invalid storage key")
        return p

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        p = self._path(key)
        await asyncio.to_thread(p.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(p.write_bytes, data)

    async def get(self, key: str) -> bytes:
        p = self._path(key)
        if not p.exists():
            raise StorageError("object not found")
        return await asyncio.to_thread(p.read_bytes)

    async def delete(self, key: str) -> None:
        p = self._path(key)
        if p.exists():
            await asyncio.to_thread(p.unlink)


class S3Storage(StorageProvider):
    """S3 API via boto3 (run in a thread). Works with MinIO, AWS S3, Cloudflare R2, Ceph, etc."""

    name = "s3"

    def __init__(self, settings: Settings) -> None:
        import boto3
        from botocore.config import Config

        if not settings.minio_access_key or not settings.minio_secret_key:
            raise StorageError("MINIO_ACCESS_KEY / MINIO_SECRET_KEY are required for S3 storage")
        self.bucket = settings.minio_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.minio_endpoint or None,
            aws_access_key_id=settings.minio_access_key.get_secret_value(),
            aws_secret_access_key=settings.minio_secret_key.get_secret_value(),
            region_name=settings.minio_region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    async def ensure_ready(self) -> None:
        def _ensure() -> None:
            try:
                self.client.head_bucket(Bucket=self.bucket)
            except Exception:
                self.client.create_bucket(Bucket=self.bucket)

        await asyncio.to_thread(_ensure)

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(self.client.put_object, Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    async def get(self, key: str) -> bytes:
        def _get() -> bytes:
            try:
                return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
            except Exception as e:
                raise StorageError("object not found") from e

        return await asyncio.to_thread(_get)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=key)


_storage: StorageProvider | None = None


def get_storage() -> StorageProvider:
    global _storage
    if _storage is None:
        s = get_settings()
        _storage = S3Storage(s) if s.storage_provider in ("minio", "s3") else LocalStorage(s.local_storage_dir)
    return _storage
