# HANAZO (हनाज़ो) — Nigerian Courier Cluster & Bin Sorter

> **Hanya** (Hausa: *Path*) + **Ọ̀nà** (Yoruba: *Road*) + **Ụzọ** (Igbo: *Route*) = **HANAZO**

Hanazo is an industrial pre-dispatch parcel sorting and bin allocation web application built specifically for Nigerian courier hubs and e-commerce distribution warehouses. It solves the last-mile sorting bottleneck by translating chaotic, landmark-heavy delivery addresses into physical dispatch bins in under 300ms using the official **NIPOST National Digital Alphanumeric Postcode System (NDAPS)**.

---

## ⚡ Core Architecture

```
Raw Waybill Text / Barcode Scan
            │
            ▼
┌──────────────────────────────┐
│  Nigerian Address Parser     │── Strip conversational noise & extract landmarks
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Multi-Tier District Cascade │
│  ├─ Tier 1: 15ms Alias Match │── Curated landmark & neighborhood dictionary
│  ├─ Tier 2: NDAPS API (500ms)│── Live api.postcode.gov.ng autocomplete
│  └─ Tier 3: Levenshtein Fuzzy│── Edit-distance tolerance for Nigerian typos
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     Bin Allocation Engine    │── Map resolved district to Rider Bin (1–10)
│   (or Bin 99 for Overflow)   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│   Industrial Sorter UI       │── Massive 9xl Bin Card + Web Audio Chime
│   Printable Delivery Sheet   │── Sequenced Rider Delivery Manifest
└──────────────────────────────┘
```

---

## 🚀 Key Features

- **Industrial Sorter UI:** Auto-focused single-input screen designed for physical handheld USB/Bluetooth barcode scanners.
- **Massive Bin Display:** Real-time `text-9xl` visual display of the physical sorting bin (1–10) with rider assignment, district code, and landmark metadata.
- **Synthesized Audio Feedback:** Web Audio API chimes provide instant acoustic confirmation to warehouse sorters without looking at a monitor.
- **Bulk Morning Batch Sorting:** Paste 50–200 waybill addresses at once to automatically generate batch containers and printable rider manifests.
- **Rider Fleet & Coverage Map:** Dynamic configuration of rider bins, assigned districts, and visual identification of uncovered delivery zones.
- **100% Offline-First PWA:** Autonomous in-browser sorting powered by IndexedDB and Service Worker caching when warehouse Wi-Fi drops. Automatically syncs queued scans upon reconnection.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org) (App Router, Serverless Functions, React 19)
- **Styling:** [TailwindCSS v4](https://tailwindcss.com) with opinionated industrial dark theme (`#0A0A0A`)
- **Database & ORM:** [Drizzle ORM](https://orm.drizzle.team) with dual engine support:
  - **Online:** PostgreSQL via `@neondatabase/serverless` with WebSocket connection pooling
  - **Offline Fallback:** `better-sqlite3` local database (`./hanazo-offline.db`)
- **Validation:** [Zod](https://zod.dev)
- **Icons:** [Lucide React](https://lucide.dev)
- **Package Manager:** `pnpm`

---

## 📋 Environment Variables Reference

Create a `.env.local` file in the project root:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Neon or Supabase) | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `OFFLINE_MODE` | Switch to local SQLite file database | `false` (default) or `true` |
| `SQLITE_DB_PATH` | Path to local SQLite database file | `./hanazo-offline.db` |
| `NIPOST_API_URL` | Base URL for official NIPOST NDAPS service | `https://api.postcode.gov.ng` |
| `NIPOST_API_KEY` | NIPOST developer API access key | `nipost_test_xxxx` |
| `NEXT_PUBLIC_APP_NAME` | Public branding string | `Hanazo` |
| `HANAZO_API_KEY` | Optional secret key for external B2B API access | `hanazo_live_secret_xxxx` |

---

## 📦 Local Development Setup

### 1. Prerequisites
- **Node.js:** v18.18.0 or newer (Node.js 20+ recommended)
- **pnpm:** v9 or v11 (`corepack enable && corepack prepare pnpm@latest --activate`)

### 2. Install Dependencies
```bash
git clone https://github.com/your-org/hanazo.git
cd hanazo
pnpm install
```

### 3. Database Initialization

#### Option A: Local SQLite (Offline Mode — Zero Config)
```bash
# 1. Enable offline mode in .env.local:
echo "OFFLINE_MODE=true" >> .env.local

# 2. Seed official district nodes into SQLite:
npx tsx src/db/seed-offline.ts
```

#### Option B: PostgreSQL (Neon / Supabase)
```bash
# 1. Set your DATABASE_URL in .env.local:
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require"

# 2. Push schema to database:
pnpm drizzle-kit push

# 3. Seed reference district dataset:
npx tsx src/db/seed.ts
```

### 4. Start Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Serverless Deployment on Vercel

Hanazo is pre-configured for Vercel Serverless in London (`lhr1`), providing sub-150ms round-trip latency to West Africa.

### 1. Deploy via Vercel CLI
```bash
pnpm dlx vercel
```

### 2. Configure Environment Variables in Vercel Dashboard
In **Project Settings → Environment Variables**, add:
- `DATABASE_URL`: Your Neon or Supabase connection string.
- `NIPOST_API_URL`: `https://api.postcode.gov.ng`
- `NIPOST_API_KEY`: Your NIPOST API key.
- `OFFLINE_MODE`: `false`
- `HANAZO_API_KEY`: Secret key for B2B API clients.

### 3. Database Pooling on Vercel
- **Neon:** Hanazo automatically activates WebSocket connection pooling via `@neondatabase/serverless`.
- **Supabase:** Hanazo automatically detects Supabase hosts and routes through transaction pooling with `?pgbouncer=true`.

---

## 📡 API Reference

All API routes support CORS and return typed JSON payloads.

### 1. Single Parcel Sort
`POST /api/sort`
```bash
curl -X POST https://your-domain.vercel.app/api/sort \
  -H "Content-Type: application/json" \
  -H "X-Hanazo-Key: your_key" \
  -d '{
    "rawAddress": "No 14, Admiralty Way, opposite Zenith Bank, Lekki Phase 1, Lagos",
    "hubId": "c7116411-db30-49e1-9827-0520bd4f4d1e"
  }'
```
**Response:**
```json
{
  "parcelId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "batchId": "7d2a9427-1510-46b0-8018-2864377349ab",
  "bin": 1,
  "riderId": "rider-uuid",
  "riderName": "Chinedu Okafor",
  "districtCode": "LA-02-A01",
  "districtName": "Lekki Phase 1",
  "confidence": "high",
  "extractedLandmark": "zenith bank",
  "isOverflow": false
}
```

### 2. Bulk Batch Sort
`POST /api/batch`
```bash
curl -X POST https://your-domain.vercel.app/api/batch \
  -H "Content-Type: application/json" \
  -H "X-Hanazo-Key: your_key" \
  -d '{
    "addresses": [
      "No 10 Allen Avenue, Ikeja, Lagos",
      "Plot 4 Admiralty Way Lekki Phase 1"
    ],
    "hubId": "hub-uuid"
  }'
```

### 3. Health Check
`GET /api/health`
```bash
curl https://your-domain.vercel.app/api/health
```
**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "nipost": "reachable",
  "version": "0.1.0",
  "latencyMs": 42,
  "timestamp": "2026-11-11T20:39:56.000Z"
}
```

---

## 📄 License
Private & Proprietary — Built for the Nigerian Logistics Ecosystem.
