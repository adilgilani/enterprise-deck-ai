"""Request/response models for the REST API (these drive the OpenAPI docs at /docs)."""

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.ai import ProposalSection
from app.schemas.deck import Deck, Slide, Style

Role = Literal["owner", "admin", "editor", "viewer"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------- auth


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    company_name: str = Field(min_length=2, max_length=200)
    industry: str | None = Field(None, max_length=120)
    website: str | None = Field(None, max_length=300)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserOut(ORM):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None = None


class OrgOut(ORM):
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    seats: int


class MembershipBrief(BaseModel):
    organization: OrgOut
    role: Role


class MeOut(BaseModel):
    user: UserOut
    organization: OrgOut
    role: Role
    memberships: list[MembershipBrief]


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    me: MeOut


class SessionOut(ORM):
    id: uuid.UUID
    user_agent: str | None
    ip_address: str | None
    created_at: datetime
    last_seen_at: datetime
    current: bool = False


# ---------------------------------------------------------------------------- jobs


class JobOut(ORM):
    id: uuid.UUID
    type: str
    status: str
    progress: int
    step: str | None
    resource_type: str | None
    resource_id: uuid.UUID | None
    result: dict[str, Any]
    error: str | None
    created_at: datetime
    finished_at: datetime | None


# ---------------------------------------------------------------------------- brand


class ColorIn(BaseModel):
    name: str = Field(max_length=60)
    hex: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    role: Literal["primary", "secondary", "accent", "background", "surface", "text", "muted", "extra"] = "extra"


class VisualRule(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    rule: str = Field(max_length=300)
    category: str = Field("general", max_length=40)


class ToneOfVoice(BaseModel):
    summary: str = ""
    attributes: list[str] = []
    do: list[str] = []
    dont: list[str] = []


class CompanyProfile(BaseModel):
    name: str = ""
    short_name: str = ""
    industry: str = ""
    website: str = ""
    headquarters: str = ""
    description: str = ""
    services: list[str] = []
    differentiators: list[str] = []
    clients: list[str] = []


class BrandOut(ORM):
    id: uuid.UUID
    name: str
    is_default: bool
    brand_lock: bool
    colors: list[dict[str, Any]]
    fonts: dict[str, Any]
    logo_asset_id: uuid.UUID | None
    logo_url: str | None = None
    guidelines: str
    visual_rules: list[dict[str, Any]]
    tone_of_voice: dict[str, Any]
    company_profile: dict[str, Any]
    approved_messaging: list[str]
    default_style: str
    default_template_id: uuid.UUID | None
    updated_at: datetime
    completeness: dict[str, bool] = {}


class BrandUpsert(BaseModel):
    name: str | None = Field(None, max_length=200)
    brand_lock: bool | None = None
    colors: list[ColorIn] | None = Field(None, max_length=16)
    fonts: dict[str, str] | None = None
    logo_asset_id: uuid.UUID | None = None
    guidelines: str | None = Field(None, max_length=20000)
    visual_rules: list[VisualRule] | None = Field(None, max_length=40)
    tone_of_voice: ToneOfVoice | None = None
    company_profile: CompanyProfile | None = None
    approved_messaging: list[str] | None = Field(None, max_length=40)
    default_style: Style | None = None
    default_template_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------- presentations

DeckType = Literal[
    "investor", "board", "sales", "company_overview", "strategy", "product_launch", "annual_report", "training",
    "market_analysis", "custom",
]
Audience = Literal["executives", "investors", "customers", "employees", "partners"]
Tone = Literal["executive", "premium", "minimal", "bold", "data_driven", "storytelling"]
PresentationStatus = Literal["generating", "draft", "in_review", "approved", "presented", "failed", "archived"]


class AuthorOut(ORM):
    id: uuid.UUID
    name: str


class PresentationSummary(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    status: str
    style: str
    theme: dict[str, Any]
    cover: dict[str, Any] | None
    slide_count: int
    author: AuthorOut | None
    folder_id: uuid.UUID | None
    is_favorite: bool
    source: str
    source_meeting_id: uuid.UUID | None
    options: dict[str, Any]
    last_presented_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PresentationOut(PresentationSummary):
    deck: dict[str, Any]
    brand_system_id: uuid.UUID | None
    prompt: str | None


class PresentationCreate(BaseModel):
    title: str = Field("Untitled presentation", min_length=1, max_length=300)
    description: str = Field("", max_length=2000)
    template_id: uuid.UUID | None = None
    folder_id: uuid.UUID | None = None
    deck: Deck | None = None


class PresentationUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = Field(None, max_length=2000)
    status: PresentationStatus | None = None
    folder_id: uuid.UUID | None = None
    clear_folder: bool = False
    style: Style | None = None
    deck: Deck | None = None


class GenerateIn(BaseModel):
    prompt: str = Field(min_length=3, max_length=6000)
    deck_type: DeckType = "custom"
    audience: Audience = "executives"
    tone: Tone = "executive"
    slide_count: int = Field(10, ge=3, le=40)
    brand_system_id: uuid.UUID | None = None
    style: Style | None = None
    creative_mode: bool = False
    use_knowledge: bool = True
    title: str | None = Field(None, max_length=300)


class GenerateOut(BaseModel):
    job: JobOut
    presentation_id: uuid.UUID | None = None
    proposal_id: uuid.UUID | None = None


class SlideAIEditIn(BaseModel):
    command: str = Field(min_length=2, max_length=500)
    slide: Slide | None = None  # current (possibly unsaved) slide from the editor


class SlideAIEditOut(BaseModel):
    slide: dict[str, Any]
    explanation: str


class ExportIn(BaseModel):
    format: Literal["pptx", "pdf"] = "pptx"
    include_notes: bool = True


class ShareIn(BaseModel):
    audience: Literal["internal", "external"] = "external"
    allow_download: bool = False
    password: str | None = Field(None, min_length=4, max_length=100)
    expires_in_days: int | None = Field(None, ge=1, le=365)


class ShareOut(BaseModel):
    id: uuid.UUID
    token: str
    url: str
    audience: str
    allow_download: bool
    has_password: bool
    expires_at: datetime | None
    created_at: datetime
    view_count: int
    resource_type: str


class FolderIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: Literal["presentations", "assets"] = "presentations"


class FolderOut(ORM):
    id: uuid.UUID
    name: str
    kind: str
    created_at: datetime


# ---------------------------------------------------------------------------- proposals

ProposalStatus = Literal["generating", "draft", "internal_review", "ready", "sent", "won", "lost", "failed"]


class ProposalBase(BaseModel):
    client: str = Field(min_length=1, max_length=200)
    industry: str | None = Field(None, max_length=120)
    contact_name: str | None = Field(None, max_length=200)
    contact_email: EmailStr | None = None
    opportunity: str | None = Field(None, max_length=300)
    title: str = Field("Untitled proposal", min_length=1, max_length=300)
    description: str = Field("", max_length=4000)
    value: float | None = Field(None, ge=0, le=1e12)
    currency: str = Field("USD", min_length=3, max_length=3)
    deadline: date | None = None

    @field_validator("contact_email", mode="before")
    @classmethod
    def _blank_email(cls, v: Any) -> Any:
        return v or None


class ProposalGenerateIn(ProposalBase):
    prompt: str = Field(min_length=3, max_length=6000)
    sections: list[str] | None = None
    creative_mode: bool = False
    brand_system_id: uuid.UUID | None = None


class ProposalUpdate(BaseModel):
    client: str | None = Field(None, max_length=200)
    industry: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    opportunity: str | None = None
    title: str | None = Field(None, max_length=300)
    description: str | None = None
    value: float | None = None
    currency: str | None = None
    deadline: date | None = None
    status: ProposalStatus | None = None
    sections: list[ProposalSection] | None = None
    creative_mode: bool | None = None


class ProposalSummary(BaseModel):
    id: uuid.UUID
    client: str
    industry: str | None
    title: str
    status: str
    value: float | None
    currency: str
    deadline: date | None
    author: AuthorOut | None
    section_count: int
    theme: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ProposalOut(ProposalSummary):
    contact_name: str | None
    contact_email: str | None
    opportunity: str | None
    description: str
    prompt: str | None
    schema_: dict[str, Any] = Field(serialization_alias="schema")
    brand_system_id: uuid.UUID | None


class SectionEditIn(BaseModel):
    section: ProposalSection
    command: str = Field(min_length=2, max_length=500)


class SectionEditOut(BaseModel):
    section: dict[str, Any]
    explanation: str


# ---------------------------------------------------------------------------- meetings


class ParticipantIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None

    @field_validator("email", mode="before")
    @classmethod
    def _blank(cls, v: Any) -> Any:
        return v or None


class ParticipantOut(ORM):
    id: uuid.UUID
    name: str
    email: str | None


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    participants: list[ParticipantIn] = Field(default_factory=list, max_length=50)
    agenda: str | None = Field(None, max_length=5000)
    language: Literal["en", "ur", "auto"] = "en"
    scheduled_at: datetime | None = None
    location: str | None = Field(None, max_length=200)


class MeetingUpdate(BaseModel):
    title: str | None = Field(None, max_length=300)
    agenda: str | None = None
    intelligence: dict[str, Any] | None = None
    notes: dict[str, Any] | None = None


class MeetingEndIn(BaseModel):
    output: Literal["notes", "presentation", "both"] = "notes"


class ActionItemOut(ORM):
    id: uuid.UUID
    meeting_id: uuid.UUID
    title: str
    owner: str | None
    deadline: date | None
    deadline_text: str | None
    status: str
    created_at: datetime


class ActionItemUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    owner: str | None = None
    deadline: date | None = None
    status: Literal["open", "in_progress", "done"] | None = None


class ActionItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    owner: str | None = None
    deadline: date | None = None


class InsightOut(ORM):
    id: uuid.UUID
    type: str
    content: str
    meta: dict[str, Any]
    source: str


class MeetingSummary(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    language: str
    location: str | None
    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None
    duration_seconds: int | None
    participants: list[ParticipantOut]
    summary: str | None
    action_item_count: int
    open_action_items: int
    decision_count: int
    presentation_id: uuid.UUID | None
    author: AuthorOut | None
    created_at: datetime


class MeetingOut(MeetingSummary):
    agenda: str | None
    intelligence: dict[str, Any]
    notes: dict[str, Any]
    action_items: list[ActionItemOut]
    live_insights: list[InsightOut]
    audio_meta: dict[str, Any]
    stt_provider: str | None


class TranscriptSegmentOut(BaseModel):
    seq: int
    speaker: str
    text: str
    start_ms: int
    end_ms: int


class WsTicketOut(BaseModel):
    ticket: str
    url: str
    provider: str
    expires_in: int = 60


# ---------------------------------------------------------------------------- templates, assets, documents


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    category: str
    kind: str
    source: str
    approved: bool
    usage_count: int
    is_favorite: bool
    slide_count: int
    cover: dict[str, Any] | None
    theme: dict[str, Any]
    created_at: datetime


class TemplateDetail(TemplateOut):
    schema_: dict[str, Any] = Field(serialization_alias="schema")


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field("", max_length=2000)
    category: str = Field("strategy", max_length=40)
    presentation_id: uuid.UUID | None = None
    deck: Deck | None = None


class AssetOut(BaseModel):
    id: uuid.UUID
    name: str
    filename: str
    type: str
    mime_type: str
    size_bytes: int
    url: str
    folder_id: uuid.UUID | None
    meta: dict[str, Any]
    uploaded_by: AuthorOut | None
    created_at: datetime


class AssetUpdate(BaseModel):
    name: str | None = Field(None, max_length=300)
    type: Literal["logo", "image", "icon", "video", "document", "chart", "template"] | None = None
    folder_id: uuid.UUID | None = None
    clear_folder: bool = False
    tags: list[str] | None = None


class DocumentOut(BaseModel):
    id: uuid.UUID
    filename: str
    title: str
    category: str
    mime_type: str
    size_bytes: int
    status: str
    summary: str | None
    meta: dict[str, Any]
    chunk_count: int
    uploaded_by: AuthorOut | None
    created_at: datetime


class DocumentDetail(DocumentOut):
    extracted_text: str | None


class DocumentTextIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    category: str = Field("company", max_length=40)
    text: str = Field(min_length=20, max_length=500_000)


class SearchIn(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    k: int = Field(6, ge=1, le=20)
    categories: list[str] | None = None


class SearchHit(BaseModel):
    content: str
    title: str
    category: str
    document_id: str
    score: float


# ---------------------------------------------------------------------------- team & settings


class MemberOut(BaseModel):
    id: uuid.UUID
    user: UserOut
    role: Role
    department: str | None
    title: str | None
    last_active_at: datetime | None
    created_at: datetime
    stats: dict[str, int] = {}


class MemberUpdate(BaseModel):
    role: Role | None = None
    department: str | None = Field(None, max_length=120)
    title: str | None = Field(None, max_length=120)


class InviteIn(BaseModel):
    email: EmailStr
    role: Role = "editor"
    department: str | None = Field(None, max_length=120)


class InvitationOut(ORM):
    id: uuid.UUID
    email: str
    role: str
    department: str | None
    status: str
    created_at: datetime
    expires_at: datetime


class InvitationCreated(InvitationOut):
    invite_url: str


class AcceptInviteIn(BaseModel):
    token: str
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=10, max_length=200)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=200)
    slug: str | None = Field(None, pattern=r"^[a-z0-9-]{2,60}$")


class AISettings(BaseModel):
    model: str | None = Field(None, max_length=120)
    system_instructions: str = Field("", max_length=8000)
    temperature: float = Field(0.4, ge=0, le=1.5)
    default_slide_count: int = Field(10, ge=3, le=40)
    default_tone: Tone = "executive"
    creative_mode_default: bool = False
    use_knowledge_default: bool = True


class AISettingsOut(AISettings):
    provider: str
    provider_model: str
    stt_provider_en: str
    stt_provider_ur: str
    embedding_provider: str
    configured: bool


class ApiKeyIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ApiKeyOut(ORM):
    id: uuid.UUID
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None


class ApiKeyCreated(ApiKeyOut):
    key: str


class AuditLogOut(BaseModel):
    id: uuid.UUID
    action: str
    resource: str | None
    resource_id: str | None
    meta: dict[str, Any]
    ip_address: str | None
    user: AuthorOut | None
    created_at: datetime


class Page(BaseModel):
    items: list[Any]
    total: int
