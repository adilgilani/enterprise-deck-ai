// "Work AI — Platform & Technical Deep-Dive" (WorkAI_Platform_Technical_Deck.pptx), text verbatim,
// re-rendered in the Stixor presentation template. Used to show template fidelity in the library.
import type { Slide } from "@/lib/mock-data";

const footer = "Work AI";

export const workAiDeck: Slide[] = [
  {
    id: "wa-1",
    kind: "cover",
    kicker: "Platform & technical deep-dive",
    title: "Work AI",
    subtitle: "Architecture, AI Pipeline & Product Capabilities",
    meta: [
      { label: "Prepared for", value: "Riyadh Bank" },
      { label: "Prepared by", value: "Stixor Technologies" },
      { label: "Date", value: "16 July 2026" },
    ],
  },
  {
    id: "wa-2",
    kind: "overview",
    kicker: "The problem",
    footer,
    title: "Most Organisations Don’t Have a Knowledge Problem — They Have a Retrieval Problem",
    lead: "The answer usually already exists — in a 300-page specification, a spreadsheet from two quarters ago, a Teams thread, or a drawing nobody has opened since handover.",
    metrics: [
      { label: "Searching & gathering information", value: "20" },
      { label: "Focused, productive work", value: "80" },
    ],
    items: [
      {
        title: "Slow Onboarding",
        text: "New staff take months to become productive because knowledge is undocumented in practice, even when it is documented on paper.",
      },
      {
        title: "Expert Time Drain",
        text: "Senior experts spend their week re-answering questions that have already been answered before.",
      },
      {
        title: "Stale Decisions",
        text: "Decisions get made from whichever document someone happened to find first — not the current one.",
      },
      {
        title: "Knowledge Walks Out the Door",
        text: "Institutional knowledge leaves the organisation the moment people do.",
      },
    ],
    callout:
      "Knowledge workers lose roughly one full day a week just searching for and gathering information — McKinsey Global Institute.",
  },
  {
    id: "wa-3",
    kind: "cards",
    kicker: "The solution",
    footer,
    title: "Work AI: One Place to Ask, Answers You Can Verify",
    lead: "A private, enterprise AI assistant that reads across your documents, spreadsheets, drawings, email, chat and databases — and shows the exact source behind every claim it makes.",
    items: [
      {
        title: "Unified Access",
        text: "Google Drive, SharePoint, Outlook, Gmail, Slack, Teams and PostgreSQL — one question box for everything your organisation already knows.",
      },
      {
        title: "Verified, Not Guessed",
        text: "Every claim is backed by a citation that opens the source document and highlights the exact passage it came from.",
      },
      {
        title: "Deployed Your Way",
        text: "Cloud, private cloud, on-premise, or fully air-gapped with self-hosted models — no data need ever leave your network.",
      },
    ],
    callout:
      "“Not a chatbot with your files bolted on — a governed platform for enterprise knowledge.”",
  },
  {
    id: "wa-4",
    kind: "table",
    kicker: "Key features & benefits",
    footer,
    title: "Core Capabilities, Mapped to Business Outcomes",
    lead: "Each capability is built to remove a specific point of friction — so adoption shows up as measurable time saved, not just another tool.",
    table: {
      head: ["Feature", "What It Delivers For Your Business"],
      rows: [
        [
          "AI Chat Assistant",
          "Ask in plain language and get a direct answer — not a list of links to read.",
        ],
        [
          "Verified Citations",
          "Every claim is checked in one click, so answers can be trusted and used with confidence.",
        ],
        [
          "Document & Figure Understanding",
          "Nothing is invisible — scanned pages, tables, charts and drawings are read, not skipped.",
        ],
        [
          "Exact Data Answers",
          "Counts and averages come from real queries, not estimates — so the numbers are always right.",
        ],
        [
          "Permission-Aware Retrieval",
          "Connecting a corporate file store never quietly exposes it — people see only what they already can.",
        ],
        [
          "Flexible Deployment",
          "Runs in your cloud, your data centre, or fully air-gapped — no dependency on where your data can live.",
        ],
      ],
    },
  },
  {
    id: "wa-5",
    kind: "steps",
    kicker: "Product flow",
    footer,
    title: "How Work AI Works",
    items: [
      {
        title: "Connect Your Knowledge",
        text: "A guided sign-in to Google Drive, SharePoint, Outlook, Gmail, Slack, Teams and PostgreSQL — no migration, no re-filing.",
      },
      {
        title: "Understand Every Document",
        text: "Text extracted, scanned pages OCR’d, tables kept structured, figures and drawings described — then embedded into a search index.",
      },
      {
        title: "Ask in Plain Language",
        text: "The assistant decides what it needs: search the index, query a database for an exact figure, search live in email/Slack/Teams, or ask a clarifying question.",
      },
      {
        title: "Verify Every Answer",
        text: "Every claim carries a numbered citation. Clicking it opens the source and highlights the exact passage — the actual page, cell range, or paragraph.",
      },
      {
        title: "Govern Access & Usage",
        text: "Permissions from source systems are mirrored and enforced at search time. Admins control roles, quotas, retention and audit trails.",
      },
    ],
  },
  {
    id: "wa-6",
    kind: "dark-cards",
    kicker: "Product capability",
    footer,
    title: "Exact Answers, Not Estimates",
    lead: "Language models are notoriously unreliable at arithmetic over long tables. Work AI does not ask one to try — analytical questions are answered by running a real query.",
    items: [
      {
        title: "Spreadsheets",
        text: "An uploaded workbook loads into a sandboxed, in-memory analytical database (DuckDB / PyArrow) and is queried exactly — counts, averages, filters, group-bys, full row listings.",
      },
      {
        title: "Connected Databases",
        text: "PostgreSQL sources are queried live at question time — the assistant inspects permitted tables and runs a read-only query, so answers reflect data as it stands right now.",
      },
      {
        title: "Read-Only by Construction",
        text: "Every generated query is parsed and validated (sqlglot) before execution — only read operations against permitted tables are allowed.",
      },
    ],
  },
  {
    id: "wa-7",
    kind: "table",
    kicker: "Platform features",
    footer,
    title: "Enterprise Connectors",
    table: {
      head: ["Connector", "Mode", "What It Brings In"],
      rows: [
        [
          "Google Drive",
          "Indexed",
          "Documents, spreadsheets and presentations from selected drives and folders.",
        ],
        ["SharePoint", "Indexed", "Document libraries and sites, including their permissions."],
        ["Outlook", "Live", "Mail content, searched on the signed-in user’s behalf."],
        [
          "Slack",
          "Live",
          "Channel and message search at question time, linked back to the thread.",
        ],
        [
          "Microsoft Teams",
          "Live",
          "Message and people search at question time via Microsoft Graph.",
        ],
        ["PostgreSQL", "Live", "Read-only queries against permitted tables in your own databases."],
      ],
    },
  },
  {
    id: "wa-8",
    kind: "groups",
    kicker: "Technology",
    footer,
    title: "Technology Stack",
    items: [
      {
        title: "Frontend",
        text: "Next.js 15, React 19, TypeScript\nTailwind CSS 4 · shadcn/ui, Radix UI\nTanStack Query / Table, Zustand\nPDF.js, docx-preview, ExcelJS, SheetJS",
      },
      {
        title: "Backend & API",
        text: "Python 3, FastAPI, Uvicorn\nPydantic v2 · SQLAlchemy 2 (async)\nCelery + Flower · Alembic migrations\nJWT (RS256) · Passlib/bcrypt · structlog",
      },
      {
        title: "AI & Retrieval",
        text: "LangGraph, LangChain agent runtime\nQdrant vector DB · hybrid dense + BM25\nGemini, OpenAI, Anthropic, vLLM, Ollama\nSelf-hosted Qwen3-VL class vision model",
      },
      {
        title: "Document Processing",
        text: "LiteParse (PDFium) · Tesseract OCR\npython-docx / -pptx, openpyxl, xlrd\nLibreOffice, ImageMagick conversion\nDuckDB + PyArrow · sqlglot query safety",
      },
      {
        title: "Data & Infrastructure",
        text: "PostgreSQL 16 · Redis 7 · Qdrant\nMinIO (S3-compatible) object storage\nDocker / Docker Compose packaging\nSMTP for invitations & notifications",
      },
      {
        title: "Observability",
        text: "Langfuse — LLM/agent tracing\nstructlog + request tracing\nFlower — background job monitoring\npytest, Vitest test suites",
      },
    ],
  },
  {
    id: "wa-9",
    kind: "table",
    kicker: "Deployment & roadmap",
    footer,
    title: "Deployment Options",
    table: {
      head: ["Model", "What It Means", "Best For"],
      rows: [
        [
          "Cloud (hosted)",
          "Stixor hosts and operates the platform; you sign in and use it.",
          "Fastest start, minimal internal IT involvement.",
        ],
        [
          "Private Cloud",
          "Deployed into your own cloud account and network.",
          "Cloud economics under your own governance.",
        ],
        [
          "On-Premise",
          "Deployed into your own data centre.",
          "Data-residency or regulatory requirements.",
        ],
        [
          "Air-Gapped",
          "Fully self-hosted models, no external network access at all.",
          "Classified, export-controlled, highly sensitive environments.",
        ],
      ],
    },
  },
  {
    id: "wa-10",
    kind: "closing",
    kicker: "Closing",
    title: "Why Work AI",
    items: [
      {
        title: "It reads what others skip",
        text: "Scanned pages, tables, figures, charts and technical drawings are understood, not ignored.",
      },
      {
        title: "It calculates instead of guessing",
        text: "Analytical questions are answered by running real queries against real data — exactly and repeatably.",
      },
      {
        title: "It proves every claim",
        text: "One click from any statement to the highlighted passage in the original document.",
      },
      {
        title: "It respects the permissions you already have",
        text: "Source-system access rules are enforced inside retrieval itself.",
      },
      {
        title: "It is genuinely yours",
        text: "Deploy in your cloud, your data centre, or fully air-gapped — no vendor lock-in on the AI provider.",
      },
      {
        title: "It is a platform, not a prototype",
        text: "Roles, quotas, analytics, audit, retention, branding and health monitoring are already there.",
      },
    ],
    callout:
      "An assistant your people can trust with real work: it finds the answer, it shows you where the answer came from, and it never shows anyone something they were not meant to see.",
  },
];
