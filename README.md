# Enterprise AI Presentation Infrastructure

Brand-locked AI **presentations**, client **proposals** and **meeting intelligence** — all running on one persistent
**Brand System** and **Company AI Context**. A company defines its identity once; every deck, proposal and meeting
readout follows it automatically.

> The frontend lives at the repository root (not `frontend/`) because this repo is synced with Lovable, which requires
> `package.json` at the root. The backend is in [`backend/`](backend/).

## 1. Architecture

```
Browser (TanStack Start + React 19, Tailwind, shadcn/ui)
   │  REST /api/v1  (Bearer JWT, X-Organization-Id selects one of *your* workspaces)
   │  WebSocket /api/v1/meetings/{id}/live  (16 kHz PCM16 mic audio ⇄ transcript + live insights)
   ▼
FastAPI (backend/app)
   ├── api/v1/*            routers: auth, brand, presentations, slides, proposals, meetings, templates,
   │                       assets, documents (AI Library), team, settings, analytics, audit, jobs, public shares
   ├── api/deps.py         central auth, tenancy (get_owned), roles, rate limiting, audit
   ├── services/ai         AIService → LLMProvider (QwenProvider · OpenAICompatibleProvider · MockProvider)
   │                       structured prompts → JSON → Pydantic validation → repair → AIGeneration record
   ├── services/stt        STTProvider (mock · faster-whisper · Deepgram · Soniox), routed by meeting language
   ├── services/documents  parse (pypdf/python-docx/python-pptx/csv) → normalize → chunk → embed → pgvector
   ├── services/export     one layout engine → python-pptx (editable PPTX) + reportlab (vector PDF)
   ├── services/storage    StorageProvider (LocalStorage · S3Storage for MinIO/S3/SeaweedFS)
   └── services/jobs       Job table + backends: inline (dev) · arq/Redis worker (prod) · eager (tests)
PostgreSQL 17 + pgvector  ·  Redis (arq queue)  ·  MinIO (object storage)
```

**Presentation schema** — the LLM never writes HTML. It returns JSON validated against
[`backend/app/schemas/deck.py`](backend/app/schemas/deck.py) (mirrored in [`src/lib/deck/schema.ts`](src/lib/deck/schema.ts)):
17 layouts (hero, split, grid, metrics, comparison, timeline, process, chart, table, full image, quote, before/after,
architecture, roadmap, team, agenda, closing) and 13 element types (text, bullets, image, chart, table, metric, shape,
timeline, diagram, icon, quote, columns, people) with per-element **animations** (fade, slide, scale, reveal, stagger,
progressive chart reveal) and per-slide **transitions** (fade, dissolve, slide, none). The same JSON drives the web
renderer, editor, presenter, PPTX and PDF exporters.

## 2. Local setup (no Docker — fastest)

```bash
# backend (Python 3.12+; uses SQLite + local file storage + in-process jobs + mock AI by default)
cd backend
uv venv .venv && uv pip install --python .venv -e ".[dev]"     # or: python -m venv .venv && pip install -e ".[dev]"
cp ../.env.example .env                                         # optional; defaults work
.venv/Scripts/python -m app.cli bootstrap                       # alembic upgrade head + seed Acme Corporation
.venv/Scripts/uvicorn app.main:app --reload --port 8000         # http://localhost:8000/docs

# frontend (repo root)
bun install            # or: npx bun install
bunx vite dev --port 8080   # http://localhost:8080  (VITE_API_URL defaults to http://localhost:8000)
```

Sign in with the seeded demo workspace: **adil@acme.com / AcmeDemo2026!** (Owner). Other seeded users
(sara@, ahmed@, lena@, omar@, priya@acme.com) share the same password with Admin/Editor/Viewer roles.

## 3. Docker

```bash
cp .env.example .env
docker compose up
```
Services: `postgres` (pgvector/pgvector:pg17), `redis`, `minio` (console :9001), `backend` (runs migrations + seed on
start), `worker` (arq), `frontend` (bun + vite). MinIO can be swapped for any S3-compatible store (SeaweedFS S3 gateway,
Ceph, AWS S3) by changing `MINIO_ENDPOINT`.

## 4. Environment variables

See [`.env.example`](.env.example) — every variable is documented there. Secrets (LLM/STT keys, DB and storage
credentials) are read **only by the backend**; nothing secret is exposed to the browser (only `VITE_API_URL`).

## 5. Database & migrations

```bash
cd backend
alembic upgrade head            # creates all tables, indexes, the pgvector extension and an HNSW index
python -m app.cli seed --reset  # recreate the demo workspace
```
The initial migration (`alembic/versions/0001_initial_schema.py`) works on PostgreSQL (with pgvector) and SQLite.
For a PostgreSQL server without the pgvector extension set `PGVECTOR_ENABLED=false` (embeddings stored as JSON,
ranked in Python).

## 6. Qwen / LLM configuration

| Provider | Settings |
|---|---|
| Qwen 3.5 (DashScope) | `LLM_PROVIDER=qwen`, `QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL` (thinking mode off by default for reliable JSON) |
| Self-hosted Qwen / any OpenAI-compatible server | `LLM_PROVIDER=openai_compatible`, `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY`, `OPENAI_COMPATIBLE_MODEL` |
| Development | `LLM_PROVIDER=mock` — deterministic, context-aware structured output for every task |

Every AI call: structured prompt (company profile + tone + approved messaging injected automatically; retrieved
knowledge fenced as untrusted data) → JSON mode → lenient parse → Pydantic validation → deterministic repair → LLM
repair pass with the validation errors → useful error. Each call writes an `ai_generations` row (model, latency,
tokens, attempts, status). Admins can set model override, system instructions and temperature in **Settings → AI**.

## 7. Workers & background jobs

Long work (generation, meeting processing, ingestion, exports) creates a `jobs` row and returns `202` with the job;
the UI polls `GET /api/v1/jobs/{id}` (status `queued → processing → completed | failed`, progress %, step label).
`JOB_BACKEND=inline` (dev) runs jobs in the API process; `JOB_BACKEND=arq` enqueues to Redis and
`arq app.worker.WorkerSettings` consumes them.

## 8. Meeting transcription

Browser mic → AudioWorklet (16 kHz PCM16, 100 ms frames) → WebSocket → `STTProvider` → transcript segments (persisted)
→ periodic live insights (only when new speech arrived, every `LIVE_INSIGHT_INTERVAL_SECONDS`) → **End Meeting** →
pipeline (finalize transcript → chunked LLM analysis → decisions / actions with owners & normalized deadlines / risks /
questions / numbers / next steps → notes → optional branded deck). Raw audio is stored as WAV in object storage.

| Language | Provider | Settings |
|---|---|---|
| English | `deepgram` (streaming, diarization) | `STT_PROVIDER_EN=deepgram`, `DEEPGRAM_API_KEY` |
| English (open source, local) | `whisper` (faster-whisper) | `pip install -e ".[whisper]"`, `STT_PROVIDER_EN=whisper`, `WHISPER_MODEL` |
| Urdu / Urdu-English | `soniox` (real-time, diarization, language ID) | `STT_PROVIDER_UR=soniox`, `SONIOX_API_KEY`, `SONIOX_MODEL=stt-rt-v4`, `SONIOX_URL` (JP endpoint default) |
| Demo | `mock` | scripted conversation paced by received audio |

The capture screen has a "Demo without microphone" option that streams simulated audio.

## 9. Exports

* **PPTX** — python-pptx, fully editable: native text boxes, shapes, connectors, **native charts with embedded data**,
  native tables, speaker notes, slide transitions (fade/dissolve/push). Element entrance animations are rendered in the
  web presenter only.
* **PDF** — vector PDF via reportlab from the same layout engine; proposals and meeting notes are typeset documents.
* **Web** — `/present/{id}` presenter (keyboard, transitions, animations, notes) and secure share links `/s/{token}`
  (internal or external, view-only, optional download, password, expiry, revocation, view counts).

## 10. Testing

```bash
cd backend && .venv/Scripts/python -m pytest -q        # 38 tests: auth, isolation, permissions, flows 1–5, AI schema
cd .. && bun run test                                   # frontend (vitest)
```
Backend tests run on SQLite with eager jobs and mock providers, covering: create → generate → edit → export
(editable PPTX verified), proposal + brand + RAG, live WebSocket meeting → notes, meeting → deck, document upload →
retrieval → generation, share links, upload validation, AI repair pipeline.

## 11. Security & multi-tenancy

Argon2id password hashing · JWT sessions with server-side revocation · API keys (hashed) · organization resolved from
the user's memberships (never trusted from the client) · `get_owned()` returns 404 for other tenants' rows · roles
owner/admin/editor/viewer · per-IP auth and per-user AI rate limits · upload size limits + extension allow-list +
magic-byte sniffing (active SVG rejected) · audit log · request IDs in structured logs with secrets redacted · CORS
allow-list · security headers.

## 12. Production considerations

Use PostgreSQL with pgvector, Redis + dedicated arq workers, S3-compatible storage, a strong `SECRET_KEY`,
`ENVIRONMENT=production`, `LOG_JSON=true`, TLS termination, and a Redis-backed rate limiter for multi-instance APIs.
Add SSO (SAML/OIDC) via the `auth_provider` field on users. Run `alembic upgrade head` as a release step.
