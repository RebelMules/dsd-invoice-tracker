# DSD Invoice Tracker

Cloud-based invoice tracking system for Direct Store Delivery vendors.

## Quick Setup

### 1. Create Postgres Database
Go to: https://vercel.com/rebelmules/dsd-invoice-tracker/stores

Click **Create Database** → **Postgres** → **Continue**

Name it: `dsd-tracker-db`

### 2. Run Schema Migration
After database is created, the connection string will be in environment variables.

```bash
cd ~/clawd/projects/dsd-tracker
npm install
npm run db:migrate
```

### 3. Deploy
```bash
vercel --prod
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DSD INVOICE TRACKER                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Invoice Scans (PDF)                                         │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ Vercel Blob │───▶│ ClawdBot    │───▶│ Vercel      │      │
│  │ (Storage)   │    │ (OCR/Parse) │    │ Postgres    │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                                              │               │
│                                              ▼               │
│                                    ┌─────────────────┐      │
│                                    │ Dashboard/API   │      │
│                                    │ - Cost Trends   │      │
│                                    │ - Price Alerts  │      │
│                                    │ - Vendor Cards  │      │
│                                    └─────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Database Tables

| Table | Purpose |
|-------|---------|
| vendors | DSD vendor master (Coke, Pepsi, Frito, etc.) |
| products | UPC/item master with current costs |
| invoices | Invoice headers with totals |
| invoice_lines | Line item detail |
| promotions | Promo/allowance tracking |
| price_history | Cost changes over time |
| scan_log | Processing status for scanned files |

## API Endpoints

```
POST /api/invoices/upload    - Upload scanned invoice
GET  /api/invoices           - List invoices
GET  /api/products           - Product master
GET  /api/vendors            - Vendor list
GET  /api/reports/costs      - Cost trend report
GET  /api/reports/prices     - Price change alerts
```

## Environment Variables

After creating Postgres, these will be auto-populated:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`
- `BLOB_READ_WRITE_TOKEN` (for scan storage)
