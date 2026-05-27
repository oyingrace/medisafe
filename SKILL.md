---
name: medsafe-builder
description: >
  Build and extend MedSafe — a drug verification system on Nostr + Bitcoin Lightning.
  Use this skill whenever the user wants to scaffold, extend, debug, or modify any part
  of the MedSafe platform, including the manufacturer dashboard, WhatsApp bot backend,
  Nostr relay integration, Breez SDK Lightning payments, OCR pipeline, anomaly detection,
  or NeonDB schema. Also trigger for any task involving Nostr event signing, Breez SDK
  regtest setup, Tesseract.js OCR, or Twilio WhatsApp webhooks in this project context.
---

# MedSafe Builder Skill

## Project Overview
MedSafe is a pharmaceutical batch verification system. Manufacturers register drug batches
on the Nostr relay network, authenticated via Bitcoin Lightning micropayments (Breez SDK).
Consumers verify authenticity by sending a WhatsApp photo or text of the batch ID.

## Tech Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (Node.js runtime)
- **Blockchain/Protocol**: Nostr (nostr-tools), Breez SDK (Lightning micropayments)
- **Messaging**: Twilio WhatsApp API (webhook-based bot)
- **OCR**: Tesseract.js (batch ID extraction from images)
- **Database**: NeonDB (PostgreSQL, via @neondatabase/serverless)
- **Payments (post-hackathon)**: Cashwyre fiat on-ramp (Naira → BTC via Lightning)
- **Environment**: Regtest (hackathon), Testnet/Mainnet (production)

## Repository Structure
```
medsafe/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                  # Manufacturer dashboard home
│   │   ├── register/page.tsx         # Batch registration form
│   │   └── batches/page.tsx          # Registered batches list
│   ├── api/
│   │   ├── register-batch/route.ts   # POST: register batch on Nostr + Lightning
│   │   ├── verify-batch/route.ts     # GET: query Nostr relay for batch
│   │   ├── whatsapp-webhook/route.ts # POST: Twilio WhatsApp incoming handler
│   │   └── anomaly-check/route.ts   # POST: log verification + anomaly detection
│   ├── layout.tsx
│   └── page.tsx                      # Landing/marketing page
├── lib/
│   ├── nostr.ts                      # Nostr key gen, event creation, relay publish/query
│   ├── breez.ts                      # Breez SDK init, invoice creation, payment check
│   ├── ocr.ts                        # Tesseract.js image-to-batch-ID extraction
│   ├── twilio.ts                     # Twilio client, message sender
│   ├── db.ts                         # NeonDB client + schema helpers
│   └── anomaly.ts                    # Verification logging + spike detection
├── components/
│   ├── BatchRegistrationForm.tsx
│   ├── BatchTable.tsx
│   ├── VerificationResult.tsx
│   └── PaymentModal.tsx
├── types/
│   └── index.ts                      # Shared TypeScript interfaces
├── prisma/ (optional, if using Prisma ORM)
│   └── schema.prisma
├── .env.local                        # See Environment Variables section
├── PLAN.md
├── README.md
└── SKILL.md
```

## Core Data Model

### Nostr Batch Event (Kind: 30078 — application-specific)
```json
{
  "kind": 30078,
  "pubkey": "<manufacturer_pubkey>",
  "created_at": 1700000000,
  "tags": [
    ["d", "<batch_id>"],
    ["drug_name", "Amoxicillin 500mg"],
    ["manufacturer", "Fidson Healthcare"],
    ["manufacture_date", "2024-01-15"],
    ["expiry_date", "2026-01-15"],
    ["lightning_payment_hash", "<payment_hash>"]
  ],
  "content": "MedSafe batch registration",
  "sig": "<manufacturer_sig>"
}
```

### NeonDB Tables
```sql
-- verification_logs: every consumer check
CREATE TABLE verification_logs (
  id SERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL,
  result TEXT CHECK (result IN ('verified', 'fake', 'anomaly')),
  user_phone TEXT,
  region TEXT,
  queried_at TIMESTAMPTZ DEFAULT NOW()
);

-- anomaly_alerts: flagged clone batches
CREATE TABLE anomaly_alerts (
  id SERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL,
  alert_type TEXT,
  regions TEXT[],
  flagged_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE
);
```

## Environment Variables
```env
# Nostr
NOSTR_RELAY_URL=ws://localhost:7000          # regtest local relay
MANUFACTURER_PRIVATE_KEY=<nsec_hex>          # manufacturer's Nostr key

# Breez SDK
BREEZ_API_KEY=<your_breez_api_key>
BREEZ_WORKING_DIR=./breez-data
BREEZ_NETWORK=regtest                        # regtest | testnet | mainnet

# Twilio
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # Twilio sandbox number

# NeonDB
DATABASE_URL=<neon_postgres_connection_string>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
BATCH_REGISTRATION_SATS=100                  # sats per batch (regtest)
```

## Key Implementation Patterns

### 1. Registering a Batch (API Route)
```
POST /api/register-batch
Body: { batchId, drugName, manufacturer, manufactureDate, expiryDate }

Steps:
1. Create Breez invoice for 100 sats
2. Return invoice to frontend → show PaymentModal
3. Frontend polls /api/register-batch/confirm?hash=<payment_hash>
4. On payment confirmed → sign + publish Nostr event
5. Return { success: true, nostrEventId }
```

### 2. Verifying a Batch (API Route)
```
GET /api/verify-batch?batchId=<id>

Steps:
1. Query Nostr relay for kind:30078 event with tag d=<batchId>
2. Verify event signature against manufacturer's known pubkey
3. Log result to NeonDB verification_logs
4. Run anomaly check (same batch, many regions, short time)
5. Return { status: 'verified'|'fake'|'anomaly', details }
```

### 3. WhatsApp Webhook
```
POST /api/whatsapp-webhook
Twilio sends: { Body, From, MediaUrl0? }

Steps:
1. If MediaUrl0 exists → download image → run Tesseract OCR → extract batch ID
2. If text → parse batch ID directly (strip whitespace/noise)
3. Call verify-batch logic internally
4. Format response message → send via Twilio
5. Log verification
```

## Breez SDK Regtest Notes
- Use the Breez Greenlight regtest environment per docs: https://sdk-doc-spark.breez.technology/guide/testing.html
- Always call `breezServices.sync()` before creating invoices
- For regtest, fund the node via the Breez CLI faucet commands
- Payment confirmation: poll `breezServices.paymentByHash(hash)` every 2s, timeout after 5 min
- Keep Breez working dir persistent across requests (use a singleton pattern in lib/breez.ts)

## Nostr Relay Notes
- For regtest/hackathon: run a local relay (nostream or strfry) on ws://localhost:7000
- Use `nostr-tools` for all Nostr operations
- Event kind 30078 = NIP-78 application-specific data (correct choice for MedSafe)
- Always verify event.sig before trusting any batch data returned from relay
- Publish to multiple relays in production for redundancy

## OCR Notes
- Use Tesseract.js v4+ with `eng` language pack
- Pre-process image: grayscale + contrast boost improves accuracy on drug packaging
- Target regex after OCR: `/\b[A-Z0-9]{6,16}\b/` — typical batch ID format
- Always provide text fallback (user can type batch ID if photo OCR fails)
- Log OCR confidence score; if < 70%, ask user to retake photo

## Anomaly Detection Logic
```
Flag as anomaly if:
- Same batch_id verified > 50 times in < 24 hours AND
- Verifications come from > 3 distinct regions
Rationale: legitimate batch is typically distributed regionally,
not queried nationally/globally in a single day → suggests cloned packaging
```

## UI/UX Guidelines
- Dashboard: clean, professional medical aesthetic (white + green #16a34a)
- Use shadcn/ui components throughout
- PaymentModal: show Lightning invoice QR + copy button + real-time payment status
- WhatsApp bot responses: keep under 160 chars, use emoji for status (✅ ❌ ⚠️)
- Mobile-first: manufacturers may access dashboard on phones

## Common Pitfalls to Avoid
1. Never store manufacturer private keys in the database — keep in env or hardware
2. Breez SDK is not thread-safe; use singleton + queue pattern
3. Twilio webhook must respond within 15 seconds — run OCR async if needed
4. Nostr relay queries are async/subscription-based; use Promise with timeout wrapper
5. NeonDB serverless needs connection pooling — use `@neondatabase/serverless` with Pool