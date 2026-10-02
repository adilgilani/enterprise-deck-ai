"""Relational data model.

Every tenant-owned resource carries `organization_id`; all access goes through
`app.api.deps` / `app.services.tenancy`, which scope queries to the caller's organization.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, TimestampMixin, utcnow
from app.db.types import Embedding, JSONType

ORG_FK = "organizations.id"
USER_FK = "users.id"


def _org_fk() -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey(ORG_FK, ondelete="CASCADE"), index=True)


# ---------------------------------------------------------------------------- identity


class User(IdMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    avatar_url: Mapped[str | None] = mapped_column(String(1000))
    password_hash: Mapped[str | None] = mapped_column(String(255))  # null for SSO-only users
    auth_provider: Mapped[str] = mapped_column(String(40), default="password")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    memberships: Mapped[list["Membership"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Organization(IdMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    plan: Mapped[str] = mapped_column(String(40), default="enterprise")
    seats: Mapped[int] = mapped_column(Integer, default=25)
    # AI settings (model, system instructions, temperature, generation defaults) and workspace prefs.
    settings: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Membership(IdMixin, Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "organization_id", name="uq_membership_user_org"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(USER_FK, ondelete="CASCADE"), index=True)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    role: Mapped[str] = mapped_column(String(20), default="editor")  # owner | admin | editor | viewer
    department: Mapped[str | None] = mapped_column(String(120))
    title: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="memberships")
    organization: Mapped[Organization] = relationship()


class Invitation(IdMixin, Base):
    __tablename__ = "invitations"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    email: Mapped[str] = mapped_column(String(320), index=True)
    role: Mapped[str] = mapped_column(String(20), default="editor")
    department: Mapped[str | None] = mapped_column(String(120))
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | accepted | revoked
    invited_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuthSession(IdMixin, Base):
    __tablename__ = "auth_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(USER_FK, ondelete="CASCADE"), index=True)
    user_agent: Mapped[str | None] = mapped_column(String(500))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ApiKey(IdMixin, Base):
    __tablename__ = "api_keys"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    name: Mapped[str] = mapped_column(String(120))
    prefix: Mapped[str] = mapped_column(String(16))
    key_hash: Mapped[str] = mapped_column(String(128), unique=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ---------------------------------------------------------------------------- brand


class BrandSystem(IdMixin, TimestampMixin, Base):
    __tablename__ = "brand_systems"

    organization_id: Mapped[uuid.UUID] = _org_fk()
    name: Mapped[str] = mapped_column(String(200))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    brand_lock: Mapped[bool] = mapped_column(Boolean, default=True)
    # [{name, hex, role}] where role in primary|secondary|accent|background|surface|text|muted
    colors: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    # {heading, body, mono}
    fonts: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    logo_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("assets.id", ondelete="SET NULL"))
    guidelines: Mapped[str] = mapped_column(Text, default="")
    # [{id, rule, category}] e.g. "Never stretch the logo", "Max 3 colors per slide"
    visual_rules: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    # {summary, attributes[], do[], dont[]}
    tone_of_voice: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    # {name, industry, website, headquarters, description, services[], differentiators[], clients[]}
    company_profile: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    approved_messaging: Mapped[list[str]] = mapped_column(JSONType, default=list)
    default_style: Mapped[str] = mapped_column(String(30), default="executive")
    default_template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("templates.id", ondelete="SET NULL", use_alter=True)
    )


class Template(IdMixin, TimestampMixin, Base):
    __tablename__ = "templates"
    __table_args__ = (Index("ix_templates_org_category", "organization_id", "category"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40))
    kind: Mapped[str] = mapped_column(String(20), default="presentation")  # presentation | proposal | meeting
    schema: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)  # full deck schema
    source: Mapped[str] = mapped_column(String(20), default="built_in")  # built_in | uploaded | duplicated
    approved: Mapped[bool] = mapped_column(Boolean, default=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))


class Folder(IdMixin, Base):
    __tablename__ = "folders"
    __table_args__ = (UniqueConstraint("organization_id", "kind", "name", name="uq_folder_org_kind_name"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(20))  # presentations | assets
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Favorite(IdMixin, Base):
    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "resource_type", "resource_id", name="uq_favorite_user_resource"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(USER_FK, ondelete="CASCADE"), index=True)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    resource_type: Mapped[str] = mapped_column(String(30))
    resource_id: Mapped[uuid.UUID] = mapped_column(index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ---------------------------------------------------------------------------- presentations


class Presentation(IdMixin, TimestampMixin, Base):
    __tablename__ = "presentations"
    __table_args__ = (Index("ix_presentations_org_updated", "organization_id", "updated_at"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    # Deck-level schema: {version, subtitle, theme, meta}. Slides live in presentation_slides.
    schema: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))
    brand_system_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("brand_systems.id", ondelete="SET NULL"))
    template_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("templates.id", ondelete="SET NULL"))
    folder_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("folders.id", ondelete="SET NULL"))
    source: Mapped[str] = mapped_column(String(20), default="prompt")  # prompt | meeting | template | blank
    source_meeting_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("meetings.id", ondelete="SET NULL"))
    prompt: Mapped[str | None] = mapped_column(Text)
    options: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)  # type, audience, tone, slide_count
    style: Mapped[str] = mapped_column(String(30), default="executive")
    last_presented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    slides: Mapped[list["PresentationSlide"]] = relationship(
        back_populates="presentation", cascade="all, delete-orphan", order_by="PresentationSlide.position"
    )
    author: Mapped[User | None] = relationship(foreign_keys=[created_by])


class PresentationSlide(IdMixin, TimestampMixin, Base):
    __tablename__ = "presentation_slides"
    __table_args__ = (Index("ix_slides_presentation_position", "presentation_id", "position"),)

    presentation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("presentations.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    schema: Mapped[dict[str, Any]] = mapped_column(JSONType)

    presentation: Mapped[Presentation] = relationship(back_populates="slides")


# ---------------------------------------------------------------------------- proposals


class Proposal(IdMixin, TimestampMixin, Base):
    __tablename__ = "proposals"
    __table_args__ = (Index("ix_proposals_org_status", "organization_id", "status"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    client: Mapped[str] = mapped_column(String(200), index=True)
    industry: Mapped[str | None] = mapped_column(String(120))
    contact_name: Mapped[str | None] = mapped_column(String(200))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    opportunity: Mapped[str | None] = mapped_column(String(300))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    value: Mapped[float | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    deadline: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    # {sections: [{id, kind, title, blocks[]}], theme, brand_lock, creative_mode, compliance}
    schema: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    prompt: Mapped[str | None] = mapped_column(Text)
    brand_system_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("brand_systems.id", ondelete="SET NULL"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))

    author: Mapped[User | None] = relationship(foreign_keys=[created_by])


# ---------------------------------------------------------------------------- meetings


class Meeting(IdMixin, TimestampMixin, Base):
    __tablename__ = "meetings"
    __table_args__ = (Index("ix_meetings_org_started", "organization_id", "started_at"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    title: Mapped[str] = mapped_column(String(300))
    agenda: Mapped[str | None] = mapped_column(Text)
    # scheduled | live | processing | ready | failed
    status: Mapped[str] = mapped_column(String(20), default="scheduled", index=True)
    language: Mapped[str] = mapped_column(String(10), default="en")
    location: Mapped[str | None] = mapped_column(String(200))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))
    stt_provider: Mapped[str | None] = mapped_column(String(40))
    # {sample_rate, channels, encoding, bytes_received, chunks, storage_key}
    audio_meta: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    summary: Mapped[str | None] = mapped_column(Text)
    # Full structured intelligence + editable notes document
    intelligence: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    notes: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    presentation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("presentations.id", ondelete="SET NULL", use_alter=True)
    )

    participants: Mapped[list["MeetingParticipant"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )
    action_items: Mapped[list["ActionItem"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")
    author: Mapped[User | None] = relationship(foreign_keys=[created_by])


class MeetingParticipant(IdMixin, Base):
    __tablename__ = "meeting_participants"

    meeting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(320))
    speaker_label: Mapped[str | None] = mapped_column(String(40))

    meeting: Mapped[Meeting] = relationship(back_populates="participants")


class Transcript(IdMixin, TimestampMixin, Base):
    """Finalized transcript. `timestamps` holds [{speaker, text, start_ms, end_ms}]."""

    __tablename__ = "transcripts"

    meeting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), unique=True)
    content: Mapped[str] = mapped_column(Text, default="")
    timestamps: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    language: Mapped[str] = mapped_column(String(10), default="en")
    provider: Mapped[str | None] = mapped_column(String(40))


class TranscriptSegment(IdMixin, Base):
    """Append-only live segments written while the meeting streams."""

    __tablename__ = "transcript_segments"
    __table_args__ = (Index("ix_segments_meeting_seq", "meeting_id", "seq"),)

    meeting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    seq: Mapped[int] = mapped_column(Integer)
    speaker: Mapped[str] = mapped_column(String(120))
    text: Mapped[str] = mapped_column(Text)
    start_ms: Mapped[int] = mapped_column(Integer, default=0)
    end_ms: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str | None] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MeetingInsight(IdMixin, Base):
    __tablename__ = "meeting_insights"
    __table_args__ = (Index("ix_insights_meeting_type", "meeting_id", "type"),)

    meeting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    # topic | decision | action_item | question | risk | number | moment | next_step
    type: Mapped[str] = mapped_column(String(30))
    content: Mapped[str] = mapped_column(Text)
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSONType, default=dict)
    source: Mapped[str] = mapped_column(String(10), default="final")  # live | final
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ActionItem(IdMixin, Base):
    __tablename__ = "action_items"

    meeting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    title: Mapped[str] = mapped_column(String(500))
    owner: Mapped[str | None] = mapped_column(String(200))
    deadline: Mapped[date | None] = mapped_column(Date)
    deadline_text: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | in_progress | done
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="action_items")


# ---------------------------------------------------------------------------- assets & knowledge


class Asset(IdMixin, Base):
    __tablename__ = "assets"
    __table_args__ = (Index("ix_assets_org_type", "organization_id", "type"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    folder_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("folders.id", ondelete="SET NULL"))
    filename: Mapped[str] = mapped_column(String(300))
    name: Mapped[str] = mapped_column(String(300))
    type: Mapped[str] = mapped_column(String(20))  # logo | image | icon | video | document | chart | template
    mime_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    storage_key: Mapped[str] = mapped_column(String(500))
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSONType, default=dict)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Document(IdMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_org_category", "organization_id", "category"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    filename: Mapped[str] = mapped_column(String(300))
    title: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(40), default="company")
    mime_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    storage_key: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | processing | ready | failed
    extracted_text: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSONType, default=dict)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(IdMixin, Base):
    __tablename__ = "document_chunks"
    __table_args__ = (Index("ix_chunks_document_index", "document_id", "chunk_index"),)

    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    organization_id: Mapped[uuid.UUID] = _org_fk()  # denormalized so retrieval is tenant-scoped in one index scan
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    embedding: Mapped[list[float] | None] = mapped_column(Embedding())
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSONType, default=dict)

    document: Mapped[Document] = relationship(back_populates="chunks")


# ---------------------------------------------------------------------------- platform


class Job(IdMixin, Base):
    __tablename__ = "jobs"
    __table_args__ = (Index("ix_jobs_org_status", "organization_id", "status"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    type: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | processing | completed | failed
    progress: Mapped[int] = mapped_column(Integer, default=0)
    step: Mapped[str | None] = mapped_column(String(200))
    resource_type: Mapped[str | None] = mapped_column(String(30))
    resource_id: Mapped[uuid.UUID | None] = mapped_column()
    payload: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    result: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)
    error: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AIGeneration(IdMixin, Base):
    """One row per LLM call: model, latency, token usage, success — never the API key."""

    __tablename__ = "ai_generations"
    __table_args__ = (Index("ix_ai_generations_org_created", "organization_id", "created_at"),)

    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(ORG_FK, ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))
    task: Mapped[str] = mapped_column(String(60), index=True)
    provider: Mapped[str] = mapped_column(String(40))
    model: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20))  # success | repaired | failed
    attempts: Mapped[int] = mapped_column(Integer, default=1)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ShareLink(IdMixin, Base):
    __tablename__ = "share_links"
    __table_args__ = (Index("ix_share_links_resource", "resource_type", "resource_id"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    resource_type: Mapped[str] = mapped_column(String(30))  # presentation | meeting | proposal
    resource_id: Mapped[uuid.UUID] = mapped_column()
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    audience: Mapped[str] = mapped_column(String(20), default="external")  # internal | external
    allow_download: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(IdMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_org_created", "organization_id", "created_at"),)

    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(ORG_FK, ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(USER_FK, ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(80))
    resource: Mapped[str | None] = mapped_column(String(40))
    resource_id: Mapped[str | None] = mapped_column(String(64))
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSONType, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User | None] = relationship()


__all__ = [
    "ActionItem",
    "AIGeneration",
    "ApiKey",
    "Asset",
    "AuditLog",
    "AuthSession",
    "BrandSystem",
    "Document",
    "DocumentChunk",
    "Favorite",
    "Folder",
    "Invitation",
    "Job",
    "Meeting",
    "MeetingInsight",
    "MeetingParticipant",
    "Membership",
    "Organization",
    "Presentation",
    "PresentationSlide",
    "Proposal",
    "ShareLink",
    "Template",
    "Transcript",
    "TranscriptSegment",
    "User",
]
