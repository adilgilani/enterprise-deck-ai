"""Structured logging with request-scoped context (request id, user id, organization id).

Secrets are never passed to the logger; `redact` is applied to dict payloads as a second line of defence.
"""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)
org_id_var: ContextVar[str | None] = ContextVar("org_id", default=None)

_SENSITIVE = ("password", "api_key", "apikey", "secret", "token", "authorization", "access_key")


def redact(data: Any) -> Any:
    if isinstance(data, dict):
        return {
            k: ("***" if any(s in str(k).lower() for s in _SENSITIVE) else redact(v)) for k, v in data.items()
        }
    if isinstance(data, list):
        return [redact(v) for v in data]
    return data


class ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        record.user_id = user_id_var.get()
        record.org_id = org_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key in ("request_id", "user_id", "org_id"):
            if getattr(record, key, None):
                payload[key] = getattr(record, key)
        extra = getattr(record, "data", None)
        if isinstance(extra, dict):
            payload.update(redact(extra))
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class TextFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        ctx = " ".join(
            f"{k}={getattr(record, k)}" for k in ("request_id", "user_id", "org_id") if getattr(record, k, None)
        )
        extra = getattr(record, "data", None)
        data = f" {json.dumps(redact(extra), default=str)}" if isinstance(extra, dict) else ""
        base = f"{self.formatTime(record, '%H:%M:%S')} {record.levelname:<7} {record.name}: {record.getMessage()}"
        out = f"{base}{data}{(' [' + ctx + ']') if ctx else ''}"
        if record.exc_info:
            out += "\n" + self.formatException(record.exc_info)
        return out


def configure_logging(level: str = "INFO", json_logs: bool = False) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(ContextFilter())
    handler.setFormatter(JsonFormatter() if json_logs else TextFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    for noisy in ("httpx", "httpcore", "botocore", "boto3", "urllib3", "aiosqlite", "multipart"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
