# Project Overview

## The business

Hungkee Motorcycle is a motorcycle and e-bike distribution business in Nigeria. The business imports motorcycles in shipping containers, holds inventory across two warehouses (Lagos and Kano), and distributes to a network of dealers across the country.

**Distribution topology.** Lagos is the import base — every container arrives there from overseas. From Lagos, stock is either shipped directly to dealer cities in the south, southwest, and southeast, or transferred north to the Kano warehouse, which then serves dealers in the north and middle belt. Kano never receives containers directly; it is supplied entirely from Lagos. The two-warehouse model lets the business serve geographically distant markets without round-tripping every shipment from Lagos.

**Key dealer cities served:**

*From Lagos warehouse (south, southwest, southeast):* Lagos, Ibadan, Akure, Benin City, Auchi, Asaba, Onitsha, Nnewi, Owerri, Aba, Port Harcourt, Uyo, Calabar, Abeokuta, Ilorin

*From Kano warehouse (north, middle belt):* Kano, Kaduna, Zaria, Bida, Minna, Abuja, Jos, Bauchi, Maiduguri, Sokoto, Katsina, Yola

The system supports shipments to any Nigerian state or city, but the cities above are the high-frequency dealer destinations and get prioritized in dropdowns and AI allocation suggestions.

The business currently runs on:

- **Excel sheets** for transactions, expenses, customer payments, opening balances, and cash position
- **Paper notebooks** for warehouse counts and dispatch records
- **WhatsApp threads** for dealer communication, order requests, and status updates
- **Photos and screenshots** for payment receipts sent by dealers

This setup works, but it produces a specific set of operational pains.

## The pain points RelayOps is built to address

**Communication fragmentation.** Dealer orders, status updates, and payment confirmations live across dozens of WhatsApp threads. Reconstructing what's happening with a particular dealer or shipment requires scrolling through chat history.

**Manual data entry.** Every payment receipt that comes in via WhatsApp gets manually transcribed into Excel — dealer name, amount, date, payment reference, which products it covers. This is slow and error-prone.

**Language friction.** Dealers communicate in their preferred languages (Hausa, Yoruba, Igbo, English, often mixed). Drafting outbound communications in each dealer's language consistently takes time. Internal records need to be in English for the operations team.

**Allocation uncertainty.** When a container lands, deciding how many units of each model go to which state warehouse currently relies on dealer requests being remembered, gut feel, and informal coordination. There's no single view of what's pending.

**No audit trail.** When something goes wrong — a shipment lost, a payment disputed, a dealer claim — reconstructing the timeline from scattered notebooks and chats is painful.

RelayOps doesn't try to forecast demand or optimize routing. Those are different problems requiring more historical data than the business currently has structured. RelayOps tackles the immediate, daily operational layer: turning informal communication into structured records and giving the team a single place to see what's happening.

## User roles

The system has two primary user types, each with different needs and different views.

### Admin / Operations team

The internal users running the business. They need:

- Full visibility into warehouse stock across all states
- Container intake workflow (recording arrivals, allocating to states)
- Dealer order management
- Payment reconciliation
- Daily operational summary
- Ability to send communications to dealers
- Audit trail for everything

Admin users authenticate via email and password. They see the full dashboard and have write access across the system.

### Dealer

External partners who receive shipments and submit payments. They need:

- View of their own incoming and recent shipments
- Ability to confirm receipt of shipments
- Ability to upload payment receipts
- Ability to ask status questions in natural language
- Communications history with the operations team

Dealer users authenticate via a simpler flow (email link or phone-based code in production; email/password in the portfolio version for simplicity). They see only their own data — row-level security ensures dealers cannot see other dealers' information.

## Core operational flows

### Flow 1: Container arrival and allocation

1. A container of motorcycles arrives at the Lagos warehouse
2. Admin records the container: container number, arrival date, contents (SKU and quantity)
3. Admin reviews outstanding dealer orders aggregated by destination city
4. AI suggests an allocation: how much stays in Lagos to serve southern dealers, how much transfers to Kano to serve northern dealers, and which dealer orders can be fulfilled from each warehouse
5. Admin reviews, adjusts, and confirms the allocation
6. System records the allocation as warehouse stock entries and creates a Lagos→Kano transfer shipment if needed
7. Dealer shipments are created for each dealer who has outstanding orders that can now be fulfilled, routed from the appropriate warehouse

### Flow 2: Dispatch to dealer

1. Admin selects a shipment ready to dispatch
2. AI drafts a dispatch notification in the dealer's preferred language, with English translation alongside
3. Admin reviews and approves the message
4. System records the message as sent and updates the shipment status to "dispatched"
5. (In production: message is sent via WhatsApp/SMS provider. In portfolio version: message is shown in the simulated dealer portal.)

### Flow 3: Status updates

1. Shipment moves through statuses: pending → dispatched → in_transit → delivered
2. Each status change is timestamped and recorded
3. Dealer can confirm receipt from their portal, which updates status to "delivered"
4. Admin can update statuses manually if needed (e.g., delays)

### Flow 4: Payment receipt processing

1. Dealer uploads a payment receipt (image or PDF) via their portal
2. System stores the file in Supabase Storage
3. AI vision extracts: amount, date, payment reference, payer name, any other visible details
4. System attempts to match the payment to an outstanding shipment for that dealer
5. If extraction is confident and a match is found: payment is logged, shipment marked as paid
6. If extraction is uncertain or no clear match: AI drafts a follow-up question to the dealer ("Was this payment for shipment #123 dispatched on May 4?"), admin reviews before sending
7. Admin can also manually upload receipts received outside the dealer portal (e.g., via WhatsApp)

### Flow 5: Daily operations review

1. Each morning, admin opens the dashboard
2. AI generates a daily summary: containers landing today, shipments dispatched yesterday, payments received, outstanding balances, items needing attention
3. Admin can ask follow-up questions in natural language ("which dealers haven't paid for their April shipments?")
4. Admin acts on flagged items

## What's deliberately not in scope

For honesty and to prevent scope creep, the following are explicitly **not** in v1:

- Demand forecasting (insufficient historical data, separate future project)
- Routing optimization
- Real-time GPS tracking
- Inventory reconciliation against historical sales
- Multi-tenant architecture (single business, single tenant)
- Real WhatsApp/SMS provider integration (simulated in portfolio version, integration noted as next step)
- Payment provider integration (receipts are documentary, not transactional)
- Mobile native apps (web responsive, mobile-first design for dealer side)

## Why this is the right scope

The features included solve immediate, daily pain. The features excluded would either require data the business doesn't yet have (forecasting), introduce significant operational risk before the foundation is proven (real notification integration), or expand the system into territory that doesn't compound the core value (mobile apps, payment processing).

Once the operational layer is running and producing structured data, future phases can build on top of it — including the demand forecasting project that this system's data will eventually make possible.
