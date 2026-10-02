import type { Deck, Slide, Theme } from "@/lib/deck/schema";

export type Role = "owner" | "admin" | "editor" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
}
export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  seats: number;
}
export interface Me {
  user: User;
  organization: Org;
  role: Role;
  memberships: { organization: Org; role: Role }[];
}
export interface TokenOut {
  access_token: string;
  expires_in: number;
  me: Me;
}
export interface Author {
  id: string;
  name: string;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed";
export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  step: string | null;
  resource_type: string | null;
  resource_id: string | null;
  result: Record<string, unknown>;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}
export interface GenerateOut {
  job: Job;
  presentation_id?: string | null;
  proposal_id?: string | null;
}

export interface BrandColor {
  name: string;
  hex: string;
  role: "primary" | "secondary" | "accent" | "background" | "surface" | "text" | "muted" | "extra";
}
export interface VisualRule {
  id: string;
  rule: string;
  category: string;
}
export interface Brand {
  id: string;
  name: string;
  is_default: boolean;
  brand_lock: boolean;
  colors: BrandColor[];
  fonts: { heading?: string; body?: string; mono?: string };
  logo_asset_id: string | null;
  logo_url: string | null;
  guidelines: string;
  visual_rules: VisualRule[];
  tone_of_voice: { summary?: string; attributes?: string[]; do?: string[]; dont?: string[] };
  company_profile: {
    name?: string;
    short_name?: string;
    industry?: string;
    website?: string;
    headquarters?: string;
    description?: string;
    services?: string[];
    differentiators?: string[];
    clients?: string[];
  };
  approved_messaging: string[];
  default_style: string;
  default_template_id: string | null;
  updated_at: string;
  completeness: Record<string, boolean>;
}
export interface BrandContext {
  brand_id: string | null;
  brand_name: string | null;
  company_name: string;
  brand_lock: boolean;
  default_style: string;
  colors: BrandColor[];
  fonts: Record<string, string>;
  checks: { label: string; ok: boolean; count?: number }[];
  knowledge: Record<string, number>;
}

export interface PresentationSummary {
  id: string;
  title: string;
  description: string;
  status: string;
  style: string;
  theme: Partial<Theme>;
  cover: Slide | null;
  slide_count: number;
  author: Author | null;
  folder_id: string | null;
  is_favorite: boolean;
  source: string;
  source_meeting_id: string | null;
  options: Record<string, unknown>;
  last_presented_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface PresentationFull extends PresentationSummary {
  deck: Deck;
  brand_system_id: string | null;
  prompt: string | null;
}
export interface Folder {
  id: string;
  name: string;
  kind: string;
  created_at: string;
}
export interface Share {
  id: string;
  token: string;
  url: string;
  audience: "internal" | "external";
  allow_download: boolean;
  has_password: boolean;
  expires_at: string | null;
  created_at: string;
  view_count: number;
  resource_type: string;
}

export type ProposalStatus = "generating" | "draft" | "internal_review" | "ready" | "sent" | "won" | "lost" | "failed";
export interface ProposalBlock {
  type: string;
  [k: string]: unknown;
}
export interface ProposalSection {
  id: string;
  kind: string;
  title: string;
  blocks: ProposalBlock[];
}
export interface ProposalSummary {
  id: string;
  client: string;
  industry: string | null;
  title: string;
  status: ProposalStatus;
  value: number | null;
  currency: string;
  deadline: string | null;
  author: Author | null;
  section_count: number;
  theme: Partial<Theme>;
  created_at: string;
  updated_at: string;
}
export interface ProposalFull extends ProposalSummary {
  contact_name: string | null;
  contact_email: string | null;
  opportunity: string | null;
  description: string;
  prompt: string | null;
  brand_system_id: string | null;
  schema: {
    subtitle?: string;
    sections?: ProposalSection[];
    theme?: Partial<Theme>;
    brand_lock?: boolean;
    creative_mode?: boolean;
    compliance?: { score: number; checks: { label: string; ok: boolean }[]; brand_lock: boolean };
    sources?: string[];
  };
}

export interface Participant {
  id: string;
  name: string;
  email: string | null;
}
export interface ActionItem {
  id: string;
  meeting_id: string;
  title: string;
  owner: string | null;
  deadline: string | null;
  deadline_text: string | null;
  status: "open" | "in_progress" | "done";
  created_at: string;
}
export interface Insight {
  id: string;
  type: string;
  content: string;
  meta: Record<string, unknown>;
  source: string;
}
export interface MeetingIntelligence {
  summary: string;
  topics: { title: string; summary?: string }[];
  decisions: { text: string; owner?: string | null; context?: string }[];
  action_items: { title: string; owner?: string | null; deadline?: string | null; priority?: string }[];
  risks: { text: string; severity?: string; mitigation?: string }[];
  questions: { text: string; asked_by?: string | null; answered?: boolean }[];
  numbers: { value: string; label: string; context?: string }[];
  next_steps: string[];
  highlights: { speaker?: string; quote: string; timestamp_ms?: number | null }[];
}
export interface MeetingSummary {
  id: string;
  title: string;
  status: "scheduled" | "live" | "processing" | "ready" | "failed";
  language: string;
  location: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  participants: Participant[];
  summary: string | null;
  action_item_count: number;
  open_action_items: number;
  decision_count: number;
  presentation_id: string | null;
  author: Author | null;
  created_at: string;
}
export interface MeetingFull extends MeetingSummary {
  agenda: string | null;
  intelligence: Partial<MeetingIntelligence>;
  notes: Record<string, unknown>;
  action_items: ActionItem[];
  live_insights: Insight[];
  audio_meta: Record<string, unknown>;
  stt_provider: string | null;
}
export interface TranscriptSegment {
  seq: number;
  speaker: string;
  text: string;
  start_ms: number;
  end_ms: number;
}
export interface WsTicket {
  ticket: string;
  url: string;
  provider: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: string;
  source: string;
  approved: boolean;
  usage_count: number;
  is_favorite: boolean;
  slide_count: number;
  cover: Slide | null;
  theme: Partial<Theme>;
  created_at: string;
}
export interface TemplateDetail extends Template {
  schema: Deck;
}

export interface Asset {
  id: string;
  name: string;
  filename: string;
  type: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  folder_id: string | null;
  meta: { width?: number; height?: number; tags?: string[]; ext?: string };
  uploaded_by: Author | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  title: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  status: "queued" | "processing" | "ready" | "failed";
  summary: string | null;
  meta: { chunks?: number; key_points?: string[]; error?: string; pages?: number; chars?: number; suggested_category?: string };
  chunk_count: number;
  uploaded_by: Author | null;
  created_at: string;
}
export interface DocumentDetail extends DocumentItem {
  extracted_text: string | null;
}
export interface SearchHit {
  content: string;
  title: string;
  category: string;
  document_id: string;
  score: number;
}

export interface Member {
  id: string;
  user: User;
  role: Role;
  department: string | null;
  title: string | null;
  last_active_at: string | null;
  created_at: string;
  stats: Record<string, number>;
}
export interface Invitation {
  id: string;
  email: string;
  role: Role;
  department: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  invite_url?: string;
}
export interface AuditEntry {
  id: string;
  action: string;
  resource: string | null;
  resource_id: string | null;
  meta: Record<string, unknown>;
  ip_address: string | null;
  user: Author | null;
  created_at: string;
}
export interface AISettings {
  model: string | null;
  system_instructions: string;
  temperature: number;
  default_slide_count: number;
  default_tone: string;
  creative_mode_default: boolean;
  use_knowledge_default: boolean;
  provider: string;
  provider_model: string;
  stt_provider_en: string;
  stt_provider_ur: string;
  embedding_provider: string;
  configured: boolean;
}
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  key?: string;
}
export interface SessionInfo {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
  current: boolean;
}
export interface Analytics {
  totals: Record<string, number>;
  weekly: { week: string; presentations: number; proposals: number; meetings: number; ai_generations: number }[];
  templates: { name: string; category: string; uses: number }[];
  brands: { name: string; uses: number }[];
  team: { name: string; presentations: number; proposals: number; meetings: number; total: number }[];
  deck_types: { type: string; count: number }[];
  ai_tasks: { task: string; count: number }[];
}
