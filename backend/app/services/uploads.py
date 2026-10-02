"""Upload validation: size limits, extension allow-list and content sniffing (magic bytes).

The declared Content-Type from the browser is never trusted on its own.
"""

import zipfile
from dataclasses import dataclass
from io import BytesIO

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings


@dataclass(frozen=True)
class FileKind:
    ext: str
    mime: str
    family: str  # image | video | document | text | presentation


KINDS: dict[str, FileKind] = {
    "png": FileKind("png", "image/png", "image"),
    "jpg": FileKind("jpg", "image/jpeg", "image"),
    "jpeg": FileKind("jpeg", "image/jpeg", "image"),
    "gif": FileKind("gif", "image/gif", "image"),
    "webp": FileKind("webp", "image/webp", "image"),
    "svg": FileKind("svg", "image/svg+xml", "image"),
    "mp4": FileKind("mp4", "video/mp4", "video"),
    "webm": FileKind("webm", "video/webm", "video"),
    "mov": FileKind("mov", "video/quicktime", "video"),
    "pdf": FileKind("pdf", "application/pdf", "document"),
    "docx": FileKind("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "document"),
    "pptx": FileKind("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "presentation"),
    "xlsx": FileKind("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "document"),
    "txt": FileKind("txt", "text/plain", "text"),
    "md": FileKind("md", "text/markdown", "text"),
    "csv": FileKind("csv", "text/csv", "text"),
    "json": FileKind("json", "application/json", "text"),
    "woff2": FileKind("woff2", "font/woff2", "document"),
    "ttf": FileKind("ttf", "font/ttf", "document"),
    "otf": FileKind("otf", "font/otf", "document"),
}

ASSET_EXTS = set(KINDS) - {"json"}
DOCUMENT_EXTS = {"pdf", "docx", "pptx", "txt", "md", "csv"}
TEMPLATE_EXTS = {"pptx", "json"}


def _sniff(ext: str, head: bytes, data: bytes) -> bool:
    if ext == "png":
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if ext in ("jpg", "jpeg"):
        return head.startswith(b"\xff\xd8\xff")
    if ext == "gif":
        return head[:6] in (b"GIF87a", b"GIF89a")
    if ext == "webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    if ext == "pdf":
        return head.startswith(b"%PDF-")
    if ext in ("docx", "pptx", "xlsx"):
        if not head.startswith(b"PK\x03\x04"):
            return False
        marker = {"docx": "word/", "pptx": "ppt/", "xlsx": "xl/"}[ext]
        try:
            with zipfile.ZipFile(BytesIO(data)) as z:
                return any(n.startswith(marker) for n in z.namelist())
        except zipfile.BadZipFile:
            return False
    if ext in ("mp4", "mov"):
        return head[4:8] == b"ftyp"
    if ext == "webm":
        return head.startswith(b"\x1a\x45\xdf\xa3")
    if ext == "woff2":
        return head.startswith(b"wOF2")
    if ext in ("ttf", "otf"):
        return head[:4] in (b"\x00\x01\x00\x00", b"OTTO", b"true")
    if ext == "svg":
        text = data[:4096].decode("utf-8", errors="ignore").lower()
        if "<script" in data.decode("utf-8", errors="ignore").lower():
            return False  # stored SVGs are served back to browsers — refuse active content
        return "<svg" in text
    if ext in ("txt", "md", "csv", "json"):
        try:
            data[:65536].decode("utf-8")
            return b"\x00" not in data[:65536]
        except UnicodeDecodeError:
            return False
    return False


async def read_validated(file: UploadFile, allowed: set[str]) -> tuple[bytes, FileKind]:
    settings = get_settings()
    name = (file.filename or "").strip()
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in allowed or ext not in KINDS:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported file type '.{ext}'. Allowed: {', '.join(sorted(allowed))}",
        )
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File exceeds {settings.max_upload_mb} MB limit")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    kind = KINDS[ext]
    if not _sniff(ext, data[:16], data):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"File content does not match its .{ext} extension")
    return data, kind
