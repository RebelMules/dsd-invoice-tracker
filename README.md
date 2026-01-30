# DSD Invoice Tracker

A Next.js application for Direct Store Delivery (DSD) invoice tracking and receiving verification at grocery stores.

## Features

- **📦 Receiving Workflow** - Two modes: Invoice-First (recommended) or Scan-First
- **📷 Invoice Capture** - Camera-based invoice photo capture
- **📱 Barcode Scanning** - UPC scanning with native BarcodeDetector API + html5-qrcode fallback
- **🔍 UPC Lookups** - Auto-match products against internal catalog and AWG database
- **✅ Verification** - Real-time count verification against invoice line items
- **📊 Dashboard** - Overview of invoices, pending approvals, and vendor activity

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Neon Postgres (serverless)
- **OCR**: Azure Form Recognizer
- **AI Parsing**: Claude (Anthropic) for invoice data extraction
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Database Schema

```
vendors          - DSD vendor master data
products         - Product catalog with UPCs
invoices         - Invoice headers
invoice_lines    - Invoice line items
awg_catalog      - AWG wholesale product database
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/stats` | GET | Dashboard statistics |
| `/api/lookup/upc` | GET | UPC product lookup |
| `/api/lookup/upc` | POST | Add product to catalog |
| `/api/process-invoice` | POST | OCR + parse invoice image |
| `/api/receiving/submit` | POST | Save receiving session |

## Environment Variables

```bash
# Neon Postgres
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...

# Azure Form Recognizer
AZURE_FORM_RECOGNIZER_ENDPOINT=https://...
AZURE_FORM_RECOGNIZER_KEY=...

# Optional: Anthropic for Claude parsing
ANTHROPIC_API_KEY=sk-ant-...
```

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Receiving Workflow

### Invoice-First Mode (Recommended)
1. Capture invoice photo with camera
2. Azure OCR extracts text
3. Claude parses line items
4. Scan products to verify quantities
5. Submit with discrepancy flagging

### Scan-First Mode
1. Select vendor
2. Scan products as they arrive
3. Capture invoice after
4. Submit receiving record

## Deployment

Configured for Vercel deployment with Neon database.

## License

Private - Grocery Basket
