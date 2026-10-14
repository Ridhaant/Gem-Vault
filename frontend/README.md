# GEMVAULT — Gemstones CRM & Packet Inventory Master

Modern React 19 + TypeScript + Vite web client for the GEMVAULT Gemstones CRM & Packet Inventory Master.

## Features
- **Strict Packet Data Structure**: High-precision packets (`ex/1`, `ex/2`), variety, shape, carat weight, pieces, mm dimensions, purchase price + date, asking price, buyer name + date.
- **ISO/IEC 18004 QR Generation**: Instant packet label printing, pouch tag QR codes, and camera scanner lookup.
- **Vault Inventory & Procurement**: Intake rough/cut packets, real-time stock levels, and memo allocations.
- **Sales & Gemstone Invoicing**: Allocation from vault, buyer tracking, margin calculations, and luxury tax invoice export.
- **Brokerage Deals**: Track 3rd-party transactions not in vault inventory with commission splits.
- **Business Evaluation & Analytics**: P&L analysis, COGS, gross margins, brokerage income, operating expenses, and vault valuation.
- **100% Local Air-Gapped Operation**: Zero cloud transmission, SQLite offline backend, and JSON backups.

## Development

```bash
# Install dependencies
npm install

# Start Vite dev server with proxy to backend (http://127.0.0.1:8000)
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview
```

## Environment Variables
Create `.env` in this directory:
```env
# Optional: Set remote backend URL for production deployment.
# Leave empty during local development to use the Vite local proxy.
VITE_API_URL=
```
