# GemVault 💎 — Gemstones CRM, Packet Inventory & Analytics Master

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-brightgreen?style=for-the-badge&logo=github)](https://ridhaant.github.io/Gem-Vault/)
[![React 19](https://img.shields.io/badge/React_19-React_Router_7-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Vite-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> 🌐 **Live Demo for Recruiters & Reviewers:**
> Explore the live application running on GitHub Pages: **[https://ridhaant.github.io/Gem-Vault/](https://ridhaant.github.io/Gem-Vault/)**  
> *(One-click access: click **"Unlock Local Vault"** on the login screen with prefilled credentials to explore live sample inventory, QR codes, analytics, and sales invoicing!)*

A production-grade, privacy-first **Gemstones Trading & Vault Management CRM** engineered for precious stone merchants, gemstone dealers, and brokers (operating across Bharat Diamond Bourse, Zaveri Bazaar, Bangkok, Sri Lanka, and international bourses).

> **🔒 100% Local & Offline Guarantee:**
> All gemstone inventory, purchase costs, valuations, client names, and brokerage commissions are stored locally on your device with reactive localStorage fallback and optional SQLite/FastAPI backend. Zero confidential vault data is uploaded to external third-party servers.

---


## 💎 Core Modules & Capabilities

### 1. Packet Inventory Master (`/inventory`)
Gemstones are tracked in standardized industry **packets** (`ex/1`, `ex/2`, ...):
- **Packet Number**: e.g., `ex/1`, `ex/2`, `EM-101`, `RUB-04`
- **Particulars**: Gemstone variety & classification (Emerald, Ruby, Blue Sapphire, Yellow Sapphire, Tanzanite, Diamond, Alexandrite, etc.) with origin (Zambian, Burmese Mogok, Ceylon, etc.), treatment, and lab certification.
- **Shape / Cut**: Oval, Cushion, Emerald Cut, Round Brilliant, Pear, Marquise, Princess, Cabochon, Radiant, Heart, Trilliant, Asscher, Baguette.
- **Weight**: Exact weight in carats (cts).
- **Pieces**: Single stones (1 pc), matching pairs (2 pcs), or parcel layouts (e.g. 45 pcs).
- **MM Size**: Calibrated dimensions (e.g. `11.2 x 8.4 x 5.6 mm`, `5.0 mm calibrated`).
- **Purchase Price with Date**: Cost price, rate per carat, purchase date & supplier.
- **Sale Price**: Target / asking price & rate per carat.
- **Buyer Name with Date and Price**: Automatically recorded upon sale or reservation.
- **Status Tracking**: `In Stock`, `On Memo` (issued for broker/client inspection), `Reserved`, `Sold`.
- **Instant QR Code for Each Packet**: Generates high-density local QR codes with single-click packet tag & label printing.

### 2. Sales Invoicing & Receivables (`/sales`, `/sales/new`)
- **Packet Allocation**: Pick in-stock packets directly from the vault to generate sales invoices.
- **Rate / Price Customization**: Adjust selling rate per carat or total price with real-time gross margin math.
- **Automated Inventory Sync**: Finalizing a sale marks the allocated packets as `Sold` and records the buyer name, sale date, and sold price. Deleting an invoice automatically restores packets back to stock.
- **Printable Gemstone Invoices**: Commercial jewelry bills with letterhead, QR verification stamp, carat weights, and terms.
- **Settlement Tracking**: Part-payments, balance due, payment modes (Bank Wire, Cash, Cheque, Angadia courier), and aging status (`cleared`, `partial`, `unpaid`).

### 3. Third-Party Brokerage (`/brokerage`)
*Brokerage deals brokered between external buyers and sellers without holding inventory in stock:*
- **Deal Reference # & Date**
- **Parties**: Seller (Party A) and Buyer (Party B)
- **Stone Details**: Description, shape, carats, pcs, lab report
- **Financials**: Total deal value, commission percentage (e.g., 1.5%), commission amount, commission source (buyer, seller, or both).
- **Settlements**: Tracks received vs. pending brokerage earnings (100% service profit).

### 4. Purchases & Packet Intake (`/purchases`, `/purchases/new`)
- **Direct Packet Intake**: Procure rough or cut lots from mines/dealers and create new packets (`ex/1`, `ex/2`...) directly into inventory.
- **Batch Packet Creation**: Input multiple packets per supplier bill with auto-generated packet numbers and instant QR codes.
- **Supplier Payables**: Tracks supplier settlements and balances due.

### 5. Categorized Operating Expenses (`/expenses`)
- **Gemological Laboratory Fees**: GIA, GRS, IGI, Gübelin, SSEF testing and certs.
- **Cutting & Polishing**: Lapidary faceting and repolishing.
- **Vault & Safe Deposit**: Strongroom locker rentals & security.
- **Armored Logistics**: Brinks, Malca-Amit insured transit.
- **Trade Shows & Travel**: Gem fairs in Tucson, Hong Kong, Jaipur, Vicenza.
- **Packaging & Tools**: Folding gem papers, stone boxes, loupes, carat scales.
- **Staff & Operations**: Office and salaries.

### 6. Overall Profit & Analytics (`/reports`)
*Complete executive evaluation of your gemstone enterprise:*
- **P&L Financial Waterfall**:
  - `Gross Sales Revenue` − `Cost of Goods Sold (COGS)` = `Gross Trading Profit`
  - `+ Brokerage Commissions Earned` = `Total Gross Income`
  - `− Operating Expenses` = `NET BUSINESS PROFIT`
- **Vault Inventory Valuation**:
  - Total carats & active packets in vault
  - Invested capital at cost price
  - Projected valuation at target asking price
  - Unrealized potential profit in inventory
- **Multi-Dimensional Breakdowns**:
  - Profit and volume by gemstone variety (Emeralds vs Rubies vs Sapphires)
  - Stock value distribution by shape / cut
  - Top buyers leaderboard by revenue and gross profit generated
  - Monthly P&L performance table and trend bars

### 7. Instant Packet QR Code Generator & Scanner
- **Zero-Dependency Local QR Generator**: Pure TypeScript algorithm that encodes packet specifications into printable tags and SVG/PNG barcodes.
- **Printable Gem Envelope Tags**: Sized for standard folding gemstone diamond papers and gem display boxes.
- **Batch Print**: Print multiple packet QR labels simultaneously on standard sheets.
- **Instant QR Lookup Scanner**: Floating scanner modal accessible from any page via barcode reader, camera, or quick search.

### 8. Local Backup & Data Privacy (`🔒 100% Local (No Cloud)`)
- **One-Click Local Backup**: Export complete database into a `.json` backup file.
- **One-Click Restore**: Load previous backup file with full database reconstitution.
- **Reset Demo Data**: Easily restore high-value sample gems (Burmese Rubies, Zambian Emeralds, Ceylon Sapphires, Tanzanites, Diamonds).

---

## 💻 Running the Application

### Option A: Frontend Web Application (Instant Local Run)
```bash
cd frontend
npm install
npm run dev
```
Open browser at `http://localhost:5173`. Works 100% offline out of the box with built-in reactive local storage!

### Option B: With Local Python FastAPI Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python server.py
```
Backend runs at `http://127.0.0.1:8000` with local SQLite file database (`gemvault_local.db`).
