# Architecture

## The five-layer system

RelayOps is structured around a clear flow: unstructured input becomes structured data, which feeds a dashboard where humans make decisions, which the system then executes, with AI assisting at each step.

```
┌────────────────────────────────────────────────────────────────┐
│                    UNSTRUCTURED INPUT                           │
│  Dealer messages • Receipt photos • Container manifests         │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                  AI STRUCTURING LAYER                           │
│  Parse messages • Extract receipt fields • Validate input       │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                    STRUCTURED DATA                              │
│   Orders • Payments • Shipments • Status events • Audit log     │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                       DASHBOARD                                 │
│  Single source of truth — admin and dealer views                │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                    HUMAN DECISIONS                              │
│  Allocation • Approval • Confirmation • Override                │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                       EXECUTION                                 │
│  Create shipments • Update stock • Send communications          │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                       AI ASSIST                                 │
│  Daily summaries • Natural-language queries • Anomaly flags     │
└────────────────────────────────────────────────────────────────┘
```

Each layer has a defined responsibility. The separation is deliberate — it makes the system easier to reason about, easier to test, and easier to extend.

## Layer 1 — Unstructured Input

The system accepts three categories of unstructured input.

**Dealer messages.** Free-text orders, status questions, complaints, and confirmations from dealers. These come through the dealer portal as natural-language messages. In production, they would also flow in via WhatsApp; in the portfolio version, the dealer portal simulates this interface.

**Receipts.** Image (JPG, PNG) or PDF uploads of payment confirmations. These can be Nigerian bank transfer screenshots, formal invoices, or photos of physical payment slips. The format is unpredictable.

**Container manifests.** When a container lands, admin records its contents either by structured manual entry (SKU + quantity grid) or by uploading a manifest document. The structured manual path is the primary flow for v1; document upload is a stretch capability.

All three categories share a common trait: they're how humans naturally communicate, not how systems naturally consume data. Layer 2 closes that gap.

## Layer 2 — AI Structuring Layer

This is the core intelligence of the system. It has three primary jobs.

**Parse dealer messages into structured intent.** A message like "abeg send me 5 of the new red ones plus 3 e-bikes for next week" gets parsed into a structured request: SKU references, quantities, requested dates, dealer identification, language detected. Ambiguities are flagged rather than guessed at.

**Extract receipt data via vision.** A receipt image is sent to Claude's vision API. The model returns structured fields: amount, currency, date, payment reference, payer name, recipient bank, any visible memo. A confidence flag accompanies each field. If the model can't read a field, it says so explicitly rather than hallucinating.

**Validate and route.** Parsed input is validated against existing data. Does the dealer exist? Are the referenced SKUs in the catalog? Does the payment amount roughly match an outstanding shipment? Routing decisions follow: high-confidence valid input flows to structured data; low-confidence or ambiguous input flows to a human review queue with an AI-drafted clarification message.

The principle is **explicit confidence over implicit certainty**. The system always knows how confident it is in its parsing, and humans can override anything.

## Layer 3 — Structured Data

The persistent backbone. Postgres via Supabase, with a schema designed around the operational entities: SKUs, warehouses, containers, dealers, orders, shipments, payments, status events, message logs.

Two design principles:

**Append-only audit trail.** Status changes and significant events are written as new rows in a `status_events` table, not by mutating existing records. This gives a full history for any shipment, payment, or dealer interaction. Mutations to primary entities (orders, shipments) are tracked via `updated_at` and a separate audit log.

**Soft deletes.** Records are marked deleted rather than removed, so historical data and references remain intact for queries and reporting.

The schema is documented in detail in [`DATA_MODEL.md`](DATA_MODEL.md).

## Layer 4 — Dashboard

The single place where the operations team and dealers see what's happening. Two distinct views:

**Admin dashboard.** Full operational visibility:
- Warehouse stock by state and SKU
- Active shipments by status
- Recent payments and outstanding balances
- Pending dealer messages requiring response
- AI-generated daily summary at the top
- Natural-language query box

**Dealer portal.** Personal view, mobile-first:
- Their incoming and recent shipments
- Their payment history
- Quick actions: confirm receipt, upload receipt, ask question
- Communications history with operations team

Row-level security in Supabase enforces that dealers only see their own data. The admin role bypasses these restrictions.

## Layer 5 — Human Decisions

The dashboard surfaces information; humans make the decisions. The system is explicitly designed to keep humans in control of:

- **Allocation decisions** — AI suggests, admin approves
- **Outbound communications** — AI drafts, admin reviews and sends
- **Payment matching** — AI proposes a match, admin confirms
- **Status overrides** — admin can update any status with a reason logged

This isn't a limitation. It's the design. Full automation in this domain would require either much higher trust in the AI (which only comes from running with humans in the loop first) or a much narrower problem definition (which would lose the business value).

## Layer 6 — Execution

Once humans confirm decisions, the system executes:

- Creates shipment records
- Updates warehouse stock
- Logs status events
- Records sent messages
- Marks payments as matched
- Stores the audit trail

Execution is mechanical and deterministic. No AI involvement here. AI's job ended at suggestion; once a human decided, execution is plain code.

## Layer 7 — AI Assist

Continuous AI capabilities that run alongside the structured operations:

**Daily operations summary.** Generated each morning. Combines yesterday's activity, today's incoming events, and flagged items into a readable briefing. Uses recent structured data as context.

**Natural-language query.** A query box on the admin dashboard accepts questions like "how many Model A in Lagos?" or "which dealers haven't paid for April shipments?" The AI translates these into database queries, runs them, and returns results in natural language with the underlying data. Results are deterministic — the AI doesn't fabricate numbers; it reads them from the database.

**Dealer query handling.** Dealers can ask their portal questions like "when's my Lagos shipment coming?" The AI looks up their data and responds.

**Anomaly flagging.** Light-weight rules with AI explanation: a payment significantly different from expected amount, a shipment overdue, a sudden change in dealer order patterns. Flagged items appear in the daily summary.

## The four AI roles

Across all the layers, AI plays four distinct roles. This framing is the intellectual core of the project.

**Role 1: Structuring messy input.** Turning natural-language messages and images into structured data. This is where AI provides the most leverage — the work it does here would otherwise be done manually by a person reading and transcribing.

**Role 2: Assisting decisions.** Suggesting allocations, proposing payment matches, recommending follow-up questions. The AI is a co-pilot for the operations team.

**Role 3: Automating communication.** Drafting messages in the dealer's preferred language, generating daily summaries, writing follow-up clarifications. AI handles the writing; humans review.

**Role 4: Acting as interface.** Answering natural-language queries against structured data, giving dealers a conversational way to check status. AI as the friendly front of the system.

Each role has a different risk profile. Structuring input has medium risk (mistakes are visible and correctable in review). Assisting decisions has low risk (AI suggests, human decides). Automating communication has medium risk (a wrong message goes out — mitigated by human review gate). Acting as interface has low risk for queries against existing data (the AI reads, it doesn't invent).

This explicit accounting of where AI is used and how risky each use is — that's what separates a thoughtful AI system from one that bolts AI on for marketing.

## Data flow examples

### Container arrival
```
Admin manual entry
   → Container record created (Layer 3)
   → AI computes Lagos/Kano split + dealer allocation suggestion (Layer 2)
   → Suggestion shown on dashboard (Layer 4)
   → Admin reviews and confirms (Layer 5)
   → Stock entries created, transfer + dealer shipments generated (Layer 6)
   → Updated dashboard reflects new state (Layer 4)
```

### Receipt processing
```
Dealer uploads photo (Layer 1)
   → File stored in Supabase Storage
   → Claude vision extracts fields (Layer 2)
   → Match attempted against outstanding shipments (Layer 2)
   → Match suggestion appears in admin queue (Layer 4)
   → Admin reviews, AI drafts clarification if needed (Layer 7)
   → Admin confirms match or sends clarification (Layer 5)
   → Payment record created and linked (Layer 6)
```

### Daily summary
```
Cron / on-load trigger
   → AI Assist queries recent structured data (Layer 7)
   → AI synthesizes a summary
   → Summary appears at top of admin dashboard (Layer 4)
```

## Why this architecture matters for the build

The five-layer model isn't decorative — it shapes every implementation decision.

When we hit a build decision point, the question becomes: which layer does this belong in? If the answer is "two of them," we've found a design issue and need to clarify boundaries before writing code.

When we add a feature, we ask: what layer is this in, and what does it touch upstream and downstream?

When something breaks, we know where to look: parsing issue → Layer 2; visibility issue → Layer 4; execution issue → Layer 6.

This is what separates a system from a pile of features. The layers are the contract.
