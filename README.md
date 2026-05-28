# MedSafe

*Verifying Africa’s Health with Bitcoin & WhatsApp*

> “In Africa, fake drugs kill 500,000 people yearly. MedSafe stops it — one WhatsApp photo at a time.”

# Overview

MedSafe is a drug verification system built on the Nostr protocol and Bitcoin Lightning Network to combat counterfeit and substandard medicines across Africa. It allows users to verify the authenticity of a drug by simply sending a photo of the drug pack via WhatsApp, or by sending the batch id as a text message, while manufacturers register their legitimate batches directly on the Nostr relay network — secured and authenticated through Bitcoin Lightning micropayments via Breez SDK — creating a transparent, immutable, and auditable ledger of all authentic pharmaceuticals making them also subject to verification via a simple text.

# Problem 

Counterfeit and substandard drugs are a major cause of preventable deaths in Africa.

- WHO reports that 1 in 10 medicines in Africa is fake.
- Over 500,000 deaths yearly linked to counterfeit drugs (UNODC, 2023).
- Over $200 billion lost annually in global counterfeit pharma trade.
- Existing verification systems (scratch codes, SMS) are slow, corruptible, and easily faked.

# Solution

Medsafe provides an immutable, verifiable, and accessible drug verification network powered by Nostr & Bitcoin.

## How It Works 

| Step | Description |
| --- | --- |
| 1. Drug Registration | Manufacturers register batches (Batch ID, Drug Name, Dates, etc.) through the MedSafe dashboard. After a Lightning micropayment via Breez SDK, the batch is signed and published to the Nostr relay as a tamper-evident record. |
| 2. Consumer Verification | A patient sends a batch ID (text) or photo of the drug packaging via WhatsApp (Twilio webhook). |
| 3. OCR Extraction | If an image is sent, the backend uses Google Gemini 2.5 Flash (via OpenRouter) to extract the batch ID from the photo. Tesseract.js serves as a local fallback when no API key is configured. |
| 4. Nostr Query + Signature Check | The backend queries MedSafe batch events from Nostr and verifies event signatures before trusting the data. |
| 5. Instant Response | The user receives either `✅ Verified` or `❌ Not Found — Possible Fake`. |
| 6. Anomaly Detection | Verification logs are stored (Neon/Postgres) and suspicious spikes (e.g., same batch queried across many regions in short time) are flagged as anomalies (`⚠️`). |

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend (Admin)** | Next.js 15 + Tailwind CSS + shadcn/ui | Manufacturer dashboard to register and monitor drug batches |
| **Blockchain Records** | Nostr Protocol (kind 30078) | Immutable, tamper-evident batch registration events |
| **Anti-Spam / Payment** | Bitcoin Lightning via Breez SDK | Micropayment required to register a batch, preventing fake entries |
| **Consumer Verification** | Twilio WhatsApp API | Users verify drugs by sending a batch ID or photo via WhatsApp |
| **OCR / Vision** | Google Gemini 2.5 Flash | Extracts batch IDs from drug packaging photos automatically |
| **OCR Fallback** | Tesseract.js | Local batch ID extraction when AI is not configured|
| **Database** | Neon (PostgreSQL) | Stores batch records, verification logs, and anomaly alerts |
| **Anomaly Detection** | Custom heuristics + Postgres | Flags suspicious verification spikes across regions |

