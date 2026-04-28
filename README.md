# RelayOps

**An AI-driven operations and workflow system for motorcycle distribution in emerging markets.**

Built for Hungkee Motorcycle — a multi-state motorcycle and e-bike distribution business in Nigeria. RelayOps replaces scattered Excel sheets, paper notebooks, and informal WhatsApp threads with a unified system where AI does the heavy lifting of turning unstructured communication into structured operational data.

---

## What it does

Distribution businesses in emerging markets run on informal communication. Dealers send orders via WhatsApp in mixed languages. Payment receipts arrive as photos. Shipment status lives in chat threads. The friction between this reality and the structured records businesses need creates daily operational drag and decision-making errors.

RelayOps bridges that gap.

When a container of motorcycles lands at the Lagos warehouse, the system helps allocate stock between Lagos and the Kano northern hub, and onward to dealer cities, based on pending dealer requests and configurable rules. It drafts dispatch notifications to dealers in their preferred language — Hausa, Yoruba, Igbo, or English. When dealers send back payment receipts as photos, AI extracts the structured data and matches it against outstanding shipments. Throughout, an admin dashboard surfaces what's in stock, what's in transit, what's been paid for, and what needs attention — replacing the notebooks and Excel sheets the team currently relies on.

The system is designed around a clear principle: **AI suggests, humans decide, the system records.**

---

## Core capabilities

**Container intake and allocation.** Record arrivals manually or via document upload. AI suggests allocation between the Lagos primary warehouse and the Kano northern hub, then onward to dealer cities, based on configurable rules and outstanding dealer orders.

**Multi-language dealer communication.** AI drafts dispatch notifications in the dealer's preferred Nigerian language. All messages are stored with English translations for the operations team's records and audit trail.

**Receipt extraction.** Dealers submit payment receipts as photos or PDFs. Claude vision extracts amount, date, payment reference, and matches the payment against existing shipments. Missing or ambiguous information triggers an AI-drafted follow-up question to the dealer.

**Operations dashboard.** Real-time view of warehouse stock, active shipments, recent payments, outstanding balances per dealer, and an AI-generated daily operations summary. Natural-language query box for ad-hoc questions ("how many Model A in Lagos?").

**Dealer portal.** Mobile-first view for dealers to see their incoming shipments, confirm receipt, upload payment receipts, and ask status questions in natural language.

---

## System architecture

```
Unstructured Input  →  AI Structuring Layer  →  Structured Data
                              ↓
                          Dashboard
                              ↓
                       Human Decisions
                              ↓
                          Execution
                              ↓
                          AI Assist
```

Each layer is documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend | Next.js Server Actions, API Routes |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (admin and dealer roles) |
| File Storage | Supabase Storage (receipts, manifests) |
| AI | Anthropic Claude (Sonnet) — text parsing, drafting, summaries, vision extraction |
| Hosting | Vercel |

One AI provider for everything — text and vision — chosen for simplicity and consistency in a 72-hour build window.

---

## Documentation

Full documentation lives in [`docs/`](docs/):

- [`PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) — Business context, user roles, core flows
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Five-layer system breakdown, AI roles
- [`DATA_MODEL.md`](docs/DATA_MODEL.md) — Database schema and design rationale
- [`AI_DESIGN.md`](docs/AI_DESIGN.md) — AI features, prompt structures, human review gates
- [`BUILD_PLAN.md`](docs/BUILD_PLAN.md) — Work blocks for development

---

## Status

In active development for Hungkee Motorcycle. The operations dashboard and AI structuring layer are the v1 focus. The WhatsApp/SMS notification flow is simulated in the current build pending integration with a messaging provider — see [`AI_DESIGN.md`](docs/AI_DESIGN.md) for the integration roadmap.

---

## Author

Built by [Simeon Gabriel](https://ayotomcs.me) — AI engineer and AI systems builder based in Lagos, Nigeria.
