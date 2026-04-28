# Build Plan

The work blocks for getting RelayOps from empty repo to deployed v1.

Time estimates assume focused, full-time work. Actual wall-clock time depends on rhythm. Block boundaries are checkpoints, not deadlines — if a block runs over, we adjust the next block's scope rather than rush.

## Pre-build setup (already done or in progress)

- ✅ GitHub repo created: `Simeon-gab/relayops`
- ✅ Supabase project created: `qflnjtigsbeegpmkinqz`
- 🟡 Anthropic Console account — create when needed (Block 5)
- 🟡 Local Node 20+ — confirm before starting

## Block 1 — Project scaffolding & connection (≈3 hours)

**Goal.** A running Next.js app deployed to Vercel, connected to Supabase, with auth working for one admin test user.

**Tasks.**
1. Initialize Next.js 14 project with TypeScript, Tailwind, App Router
2. Install shadcn/ui base components (button, input, card, table, dialog, sheet, form)
3. Set up project structure: `app/`, `components/`, `lib/`, `types/`, `supabase/`
4. Initialize Supabase client (server and browser variants)
5. Configure environment variables: `.env.local` for dev, Vercel env for production
6. Create initial git commit, push to GitHub
7. Connect repo to Vercel, deploy
8. Set up Supabase Auth — email/password
9. Create one admin user manually in Supabase dashboard
10. Build a minimal sign-in page that works against Supabase Auth
11. Build a protected `/dashboard` route that shows "Hello [admin email]"

**Success criteria.**
- Code is on GitHub, deployed to Vercel
- Sign-in works with the test user
- Protected route redirects unauthenticated users to sign-in
- Local dev server runs without errors

**What we are deliberately not doing yet.** Database schema, RLS policies, dealer auth flow, any UI beyond sign-in/dashboard placeholder. Get the foundation solid before adding complexity.

## Block 2 — Database schema & RLS (≈3 hours)

**Goal.** Full database schema deployed, RLS policies in place, migration files committed.

**Tasks.**
1. Write SQL migration for all tables in `DATA_MODEL.md`:
   - `products`, `warehouses`, `containers`, `container_items`, `warehouse_stock`, `stock_movements`, `dealers`, `dealer_orders`, `dealer_order_items`, `shipments`, `shipment_items`, `status_events`, `messages`, `message_parse_results`, `payments`, `receipts`, `receipt_extractions`, `users`, `audit_log`
2. Add indexes for the query patterns documented
3. Set up RLS policies:
   - Admin: full access via role check
   - Dealer: scoped access via `auth.uid()` matching `dealer.user_id`
4. Create seed script that inserts:
   - 2 warehouses (Lagos, Kano)
   - ~10 sample products (mix of motorcycles and e-bikes)
   - ~8 sample dealers across the key cities
   - Several historical shipments and orders for demo data
5. Run migration on Supabase, verify schema
6. Run seed script, verify data
7. Add `supabase/migrations/` and `supabase/seed.sql` to repo

**Success criteria.**
- All tables exist in Supabase with correct columns and constraints
- RLS policies enforce admin/dealer separation (test by querying as each role)
- Seed data is in place and queryable
- Repo includes SQL files for everything

**Risk.** RLS can be tricky. If a policy is wrong, dealers might see other dealers' data. Test explicitly with two dealer accounts before moving on.

## Block 3 — Admin dashboard core (≈4 hours)

**Goal.** Admin can log in and see warehouse stock, active shipments, and dealer list. Read-only views first.

**Tasks.**
1. Layout shell: sidebar nav, top bar with user menu, main content area
2. Dashboard home page with placeholder cards for: warehouse stock, active shipments, recent payments, items needing attention
3. Warehouses view: table showing each warehouse with stock by SKU
4. Products view: table of all products
5. Dealers view: table of all dealers with key info
6. Shipments view: table with filters by status, type, warehouse
7. Server actions for fetching data with proper auth checks
8. Loading states and empty states
9. Basic responsive design (works on tablet, fine on phone)

**Success criteria.**
- All views populated from seed data
- Navigation works
- Data is correctly scoped by RLS
- No client-side data leaks

**What's out.** Editing, creating, AI features, dealer view. Just admin read views first.

## Block 4 — Container intake flow (≈3 hours)

**Goal.** Admin can record a container and add its contents.

**Tasks.**
1. "New container" form: container number, arrival date, notes
2. Container detail view with editable line items
3. Add product line items: SKU select, quantity input
4. Save container and items in a transaction
5. Container list view with status indicators
6. Stock movement records created on container confirmation
7. Audit log entries for container actions

**Success criteria.**
- Admin can record a container end-to-end
- Container items are saved correctly
- Stock movements record the inflow
- Container appears in the list

**What's out.** AI allocation suggestion (next block).

## Block 5 — AI integration foundation (≈2 hours)

**Goal.** Anthropic API connected, basic call wrapper working, ready to use across features.

**Tasks.**
1. Get Anthropic API key from console.anthropic.com
2. Add `ANTHROPIC_API_KEY` to local env and Vercel env
3. Install `@anthropic-ai/sdk`
4. Create `lib/ai/client.ts` — wrapper for Anthropic calls
5. Create `lib/ai/types.ts` — shared types for AI responses
6. Build a generic `callClaude()` function with:
   - System prompt + user prompt structure
   - JSON parsing with error handling
   - Logging input/output for debugging
7. Test with a simple "say hello" call
8. Add cost-conscious logging (token counts)

**Success criteria.**
- API call succeeds from server-side code
- JSON responses parse cleanly
- Errors are caught and logged
- Token usage is visible in logs

## Block 6 — Container allocation suggestion (≈3 hours)

**Goal.** AI suggests allocation when a container is ready to allocate.

**Tasks.**
1. Build the allocation prompt (system + user) per `AI_DESIGN.md` Feature 2
2. Server action: gather container contents, current stock, pending dealer orders, configurable rules
3. Call Claude with the gathered context
4. Parse response, validate structure
5. UI: "Suggest allocation" button on container detail
6. Display suggestion: Lagos retention, Kano transfer, fulfillable orders, warnings
7. Allow admin to edit quantities
8. "Confirm allocation" creates: transfer shipment (Lagos→Kano), dealer shipments, stock movements
9. All in a single transaction

**Success criteria.**
- AI returns sensible suggestions on test data
- Admin can edit and confirm
- Confirmed allocations correctly update stock and create shipments

## Block 7 — Shipment management (≈3 hours)

**Goal.** Shipments can move through statuses; admin can dispatch and update.

**Tasks.**
1. Shipment detail view
2. Status update flow: pending → dispatched → in_transit → delivered
3. Each status change creates a `status_events` row
4. "Dispatch shipment" action updates status, sets `dispatched_at`
5. Manual delivery confirmation by admin
6. Filtering and search on shipments list
7. Audit log entries

**Success criteria.**
- Status transitions work correctly
- Status history is preserved
- Admin can drive a shipment from creation to delivery

## Block 8 — Dispatch message drafting (AI feature) (≈2 hours)

**Goal.** AI drafts dispatch notification messages in dealer's preferred language.

**Tasks.**
1. Build the dispatch message prompt per `AI_DESIGN.md` Feature 3
2. "Draft message" button on shipment detail
3. Server action calls Claude with shipment + dealer context
4. UI shows: localized message + English translation, side by side
5. Edit, regenerate, or approve
6. Approval logs the message in `messages` table

**Success criteria.**
- Messages generate in correct language
- English translation accompanies localized version
- Messages are logged on approval

## Block 9 — Dealer portal (auth + read views) (≈4 hours)

**Goal.** Dealers can log in and see their shipments, payments, and recent messages.

**Tasks.**
1. Dealer auth flow (separate sign-in or shared with admin via role)
2. Dealer-specific layout (mobile-first, simpler nav)
3. Home page: incoming shipments, recent activity
4. Shipment list and detail views (scoped to dealer)
5. Payment history view
6. Messages history view
7. Verify RLS — dealer cannot access another dealer's data even by URL manipulation
8. Create a few test dealer users in Supabase Auth, link to seeded dealer records

**Success criteria.**
- Dealer logs in, sees only their data
- Mobile UX is solid
- RLS holds against URL-based attacks

## Block 10 — Receipt upload + extraction (≈4 hours)

**Goal.** Dealers can upload receipts; AI extracts; admin reviews and confirms.

**Tasks.**
1. Supabase Storage bucket for receipts, with appropriate access policies
2. Dealer-side upload UI (file picker, supports images and PDF)
3. On upload: file goes to storage, `receipts` row created
4. Background or on-upload server action: fetch file, send to Claude vision per `AI_DESIGN.md` Feature 4
5. Save extraction results to `receipt_extractions`
6. Auto-attempt match to outstanding shipments per Feature 5
7. Admin queue: receipts pending review with extraction details
8. Admin can confirm match (creates payment record), edit fields, or reject
9. PDF rendering — for PDFs, may need to convert first page to image before sending to vision (use a server-side PDF library)

**Success criteria.**
- Dealer can upload, sees confirmation
- Admin sees pending review item with extracted data
- Admin can confirm or correct
- Confirmed payments link to shipments and update payment totals

**Risk.** PDF handling can be fiddly. If it slows the block, we accept image-only for v1 and note PDF as next-up.

## Block 11 — Dealer message handling (≈2 hours)

**Goal.** Dealers can send free-text messages from portal; AI parses; admin handles.

**Tasks.**
1. Dealer portal: simple message input (free text)
2. On send, message logged in `messages` table
3. Server action: call Claude per Feature 1 to parse
4. Save parse results to `message_parse_results`
5. Admin queue: pending messages with parse interpretation
6. Admin can: approve as-is (e.g., create draft order from parse), reply with AI-drafted clarification, or handle manually
7. Reply flow uses Feature 6 (AI clarification drafting)

**Success criteria.**
- Dealer can send messages
- Messages parse and surface for admin
- Admin can act on parsed messages

## Block 12 — Daily summary + natural-language query (≈3 hours)

**Goal.** Admin dashboard shows AI-generated daily summary and supports natural-language queries.

**Tasks.**
1. Daily summary feature per Feature 7:
   - Server action: gather yesterday's data + flagged items
   - Call Claude
   - Display on admin dashboard home
   - Refresh button
2. Natural-language query box per Feature 8:
   - Input on admin dashboard
   - Server action: AI interprets, system runs structured query, AI wraps result
   - Display results with the underlying data visible
3. Schema description (used in NL query prompts) — write once, store as constant

**Success criteria.**
- Daily summary generates on demand and reflects real data
- NL query handles common questions ("how many X in Y warehouse", "which dealers haven't paid for shipments dispatched in the last 30 days")
- Results are accurate (verifiable against the database)

## Block 13 — Polish, demo data, deployment (≈3 hours)

**Goal.** System is presentation-ready.

**Tasks.**
1. Comprehensive seed data: enough containers, shipments, dealers, payments, messages to make every screen look populated
2. Visual polish: empty states, loading skeletons, error boundaries
3. Mobile responsiveness pass on dealer-facing views
4. Sample receipt images for the demo (anonymized or synthetic)
5. Sample dealer messages in different languages for the demo
6. Final deploy to Vercel with production env vars
7. Smoke test the full flow on production deployment

**Success criteria.**
- Production URL works end-to-end
- Every screen has data and looks complete
- No console errors, no broken flows
- Demo can walk through all five core flows from `PROJECT_OVERVIEW.md`

## Block 14 — Documentation & case study (≈3 hours)

**Goal.** Repo and case study are publication-ready.

**Tasks.**
1. Update README with deployed URL, screenshots, "what's included" summary
2. Write the case study narrative — the story of why this exists, what it does, how it's built, what's next
3. Take screenshots of all key flows
4. Record a short demo video (optional but high-impact for portfolio)
5. Add CONTRIBUTING.md, LICENSE
6. Final commit, final push

**Success criteria.**
- A first-time visitor can understand what RelayOps is in 30 seconds from the README
- The case study reads as a real product story
- Screenshots and/or video bring the system to life
- The repo looks like a professional project, not a tutorial

## Total estimated hours

42 hours of focused work, in 14 blocks.

This is realistic for ~3-4 working days at full focus. The plan has buffer built in — most blocks have small slack, and the last two blocks (polish and docs) can absorb overruns from earlier blocks if needed.

## Cut points if we fall behind

If we hit time pressure, here is the priority order for what to cut, in order:

1. **PDF receipt support** (image-only is fine for v1) — saves 30-60 min
2. **Dealer messaging UI polish** — keep it functional, less polished
3. **Daily summary** (defer to v1.1)
4. **Natural-language query** (defer to v1.1)
5. **Multi-language messages** (English-only for v1, multi-language as v1.1)

We do not cut: container intake, allocation, shipments, receipt extraction, dealer portal, RLS. Those are the spine of the system.

## Cut points we will not consider

These are non-negotiable:
- Real RLS policies (security-critical)
- Audit logging on sensitive actions
- Soft deletes (data integrity)
- Confidence handling on AI outputs (the system's whole value depends on this)
