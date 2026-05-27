# MedSafe — Build Plan

## Hackathon Goal
Ship a working demo where:
1. A manufacturer registers a drug batch via dashboard → pays 100 sats on regtest Lightning → batch recorded on local Nostr relay
2. A user sends a WhatsApp message (text or photo) → gets back verified ✅ / fake ❌ / anomaly ⚠️

---

## Phase 0 — Project Setup (Do First)
- [ ] `npx create-next-app@latest medsafe --typescript --tailwind --app --src-dir no`
- [ ] Install dependencies (see full list below)
- [ ] Set up `.env.local` with all keys
- [ ] Run local Nostr relay (nostream via Docker)
- [ ] Initialize NeonDB schema (run SQL from SKILL.md)
- [ ] Verify Breez SDK regtest node connects and syncs

### Install Commands
```bash
npm install nostr-tools @breeztech/react-native-breez-sdk-liquid \
  tesseract.js twilio @neondatabase/serverless \
  @radix-ui/react-dialog @radix-ui/react-label \
  shadcn-ui lucide-react qrcode.react
npx shadcn@latest init
npx shadcn@latest add button input card table dialog badge toast
```

> Note: Breez SDK for Node.js — use `@breeztech/breez-sdk-liquid` (the JS/Node binding).
> Check latest package name at https://sdk-doc-spark.breez.technology

---

## Phase 1 — Core Library Layer (`/lib`)

### 1.1 `lib/db.ts` — NeonDB Client
- Export a singleton `Pool` instance using `@neondatabase/serverless`
- Export helper functions: `logVerification()`, `getAnomalyStats()`, `createAnomalyAlert()`
- Run `CREATE TABLE IF NOT EXISTS` migrations on first connection

### 1.2 `lib/nostr.ts` — Nostr Integration
- `generateManufacturerKeypair()` → returns `{ privateKey, publicKey }`
- `createBatchEvent(batchData, privateKey)` → returns signed Nostr event
- `publishBatchEvent(event)` → publishes to relay, returns event ID
- `queryBatchById(batchId)` → queries relay, returns event or null
- `verifyEventSignature(event)` → returns boolean

### 1.3 `lib/breez.ts` — Lightning Payments
- `initBreezSDK()` → singleton init, call once at startup
- `createBatchInvoice(batchId)` → returns `{ invoice, paymentHash }`
- `checkPaymentStatus(paymentHash)` → returns `'pending' | 'paid' | 'failed'`
- Handle regtest-specific config (network, working dir)

### 1.4 `lib/ocr.ts` — Image Processing
- `extractBatchIdFromImage(imageUrl)` → downloads image, runs Tesseract, returns batch ID string or null
- `preprocessImage(buffer)` → grayscale + contrast (use jimp or sharp)
- Log confidence score, return null if < 70%

### 1.5 `lib/twilio.ts` — WhatsApp Messaging
- `sendWhatsAppMessage(to, message)` → sends via Twilio client
- `parseIncomingMessage(body)` → extracts batch ID from text
- Format response templates: verified, fake, anomaly, ocr_failed, help

### 1.6 `lib/anomaly.ts` — Anomaly Detection
- `logAndCheckAnomaly(batchId, userPhone, region)` → logs to DB, returns anomaly flag
- `detectCloneBatch(batchId)` → query last 24h verifications, apply threshold logic
- `createAnomalyAlert(batchId, regions)` → persists alert to DB

---

## Phase 2 — API Routes (`/app/api`)

### 2.1 `POST /api/register-batch`
```
Request:  { batchId, drugName, manufacturer, manufactureDate, expiryDate }
Response: { invoice, paymentHash } — frontend shows QR code
```
- Validate input
- Call `createBatchInvoice(batchId)`
- Store pending batch in DB with `status: 'pending_payment'`
- Return invoice

### 2.2 `GET /api/register-batch/confirm`
```
Request:  ?paymentHash=<hash>
Response: { status: 'pending'|'paid', nostrEventId? }
```
- Poll `checkPaymentStatus(paymentHash)`
- On paid → `createBatchEvent()` → `publishBatchEvent()`
- Update DB record `status: 'registered'`
- Return nostr event ID

### 2.3 `GET /api/verify-batch`
```
Request:  ?batchId=<id>
Response: { status: 'verified'|'fake'|'anomaly', details? }
```
- `queryBatchById(batchId)` on Nostr relay
- `verifyEventSignature(event)` if found
- `logAndCheckAnomaly(batchId, ...)`
- Return structured result

### 2.4 `POST /api/whatsapp-webhook`
```
Twilio sends: Body (text), From (phone), MediaUrl0 (optional image)
Response: TwiML `<Response><Message>...</Message></Response>`
```
- If image → `extractBatchIdFromImage(MediaUrl0)`
- If text → `parseIncomingMessage(Body)`
- Call verify-batch logic
- `sendWhatsAppMessage(From, formattedResult)`
- Must respond < 15s (run heavy OCR async if needed, send "processing..." first)

### 2.5 `POST /api/anomaly-check`
- Internal route called by verify-batch
- Checks DB for spike patterns
- Creates alert if threshold exceeded

---

## Phase 3 — Manufacturer Dashboard (`/app/(dashboard)`)

### 3.1 Landing / Home `page.tsx`
- Stats: total registered batches, total verifications, active alerts
- Quick links: Register Batch, View Batches
- Recent activity feed

### 3.2 Register Batch `register/page.tsx`
- Form: Batch ID, Drug Name, Manufacturer Name, Manufacture Date, Expiry Date
- On submit → `POST /api/register-batch` → show `PaymentModal`
- `PaymentModal`: Lightning invoice QR code + copy button + polling status
- On payment confirmed → success screen with Nostr event ID

### 3.3 Batch List `batches/page.tsx`
- Table: Batch ID | Drug Name | Registered | Status | Verifications
- Filter by status (all / registered / pending)
- Click row → batch detail with verification history

---

## Phase 4 — Components

| Component | Purpose |
|-----------|---------|
| `BatchRegistrationForm.tsx` | Controlled form with validation |
| `PaymentModal.tsx` | Lightning QR, copy invoice, polling payment status |
| `BatchTable.tsx` | Sortable/filterable table of registered batches |
| `VerificationResult.tsx` | Reusable ✅/❌/⚠️ result display card |
| `StatsCard.tsx` | Dashboard metric cards |

---

## Phase 5 — Demo Script (Hackathon Presentation)

**Setup before demo:**
1. Local Nostr relay running (`docker run nostream`)
2. Breez regtest node synced and funded
3. Twilio WhatsApp sandbox configured with ngrok webhook URL
4. `.env.local` all populated

**Live demo flow:**
1. Open manufacturer dashboard → Register Batch → fill form
2. Lightning invoice appears → pay via Breez CLI or regtest wallet
3. Payment confirms → "Batch registered on Nostr ✅" 
4. Open WhatsApp on judge's phone → send batch ID text to Twilio sandbox number
5. Bot responds: "✅ VERIFIED — Amoxicillin 500mg | Fidson Healthcare | Expires Jan 2026"
6. Send fake batch ID → "❌ NOT FOUND — This batch is not registered..."
7. Show anomaly dashboard (pre-seeded with data)

---

## Phase 6 — Post-Hackathon Roadmap

- [ ] **Cashwyre Naira on-ramp**: Manufacturers pay in NGN → Cashwyre converts → Lightning sats
- [ ] **NAFDAC API integration**: Cross-reference with official batch registry
- [ ] **Multi-relay redundancy**: Publish to 3+ public Nostr relays
- [ ] **Manufacturer KYC**: Verify company identity before issuing Nostr keypair
- [ ] **Pharmacy portal**: Dedicated interface for pharmacists (bulk verification)
- [ ] **Mobile app**: React Native wrapper for offline-capable verification
- [ ] **SMS fallback**: USSD/SMS for users without WhatsApp
- [ ] **Analytics dashboard**: Counterfeit hotspot mapping by region

---

## Dependencies Reference

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "nostr-tools": "^2.0.0",
    "tesseract.js": "^5.0.0",
    "twilio": "^5.0.0",
    "@neondatabase/serverless": "^0.9.0",
    "qrcode.react": "^3.1.0",
    "lucide-react": "^0.400.0",
    "jimp": "^0.22.0"
  }
}
```

---

## Build Order Summary

```
Phase 0: Setup + env + local relay + DB schema
  ↓
Phase 1: lib/ layer (nostr → breez → ocr → twilio → anomaly)
  ↓
Phase 2: API routes (register → confirm → verify → whatsapp)
  ↓
Phase 3: Dashboard UI (home → register form → batch list)
  ↓
Phase 4: Polish components + PaymentModal
  ↓
Phase 5: End-to-end demo test + ngrok setup
```

**Total estimated build time**: 2–3 focused days for a working hackathon demo.