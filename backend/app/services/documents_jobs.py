import uuid
from typing import Any

from app.models import Document
from app.services.documents import ingest_document
from app.services.jobs import JobContext, handler


@handler("document.ingest")
async def ingest_job(ctx: JobContext) -> dict[str, Any]:
    doc = await ctx.session.get(Document, uuid.UUID(ctx.job.payload["document_id"]))
    if doc is None or doc.organization_id != ctx.job.organization_id:
        raise ValueError("document not found")
    await ctx.progress(15, "Extracting text")
    doc = await ingest_document(ctx.session, doc)
    return {"document_id": str(doc.id), "chunks": (doc.meta or {}).get("chunks", 0), "status": doc.status}
