# Shreeji Gems — Gemstones CRM, Packet Inventory & Trading Vault (PRD)

## Product Overview
Shreeji Gems CRM is an offline-first, privacy-focused ERP/CRM system purpose-built for gemstone merchants, high-jewelry dealers, and brokers operating across the Bharat Diamond Bourse (BDB), Zaveri Bazaar (Mumbai), Jaipur, Bangkok, and international gem bourses.

### Privacy & Architecture Philosophy
- **100% Local & Privacy-First**: All inventory costs, asking prices, transaction history, broker commissions, client registries, and secret vault passwords remain strictly on the user's machine (zero unencrypted cloud transmission).
- **Dual Engine Architecture**:
  - **Client-Side Engine**: 100% reactive offline local storage (`frontend/src/gemstoneStorage.ts`, `frontend/src/packetStones.ts`, and `frontend/src/mockData.ts`).
  - **Local API Server**: Optional Python FastAPI backend (`backend/server.py`) with SQLite persistence (`gemvault_local.db`).
  - **Static Documentation Build**: Synchronized GitHub Pages build target (`docs/`) via `node sync-docs.js`.

---

## Core Entities & Data Architecture

### 1. Packet Inventory Master (`GemPacket`)
- **Packet Identifier**: Unique packet numbering (`ex/1`, `ex/2`, `EM-101`, `RUB-04`). Uniqueness enforced within assigned box.
- **Box Management**: Organized in multi-box vault trays (`Box 1 — Emerald Vault`, `Box 2 — Rubies & Sapphires`, etc.).
- **Particulars**: Gemstone variety, origin (Zambian, Burmese Mogok, Ceylon, Colombian, Mozambique), treatments (Natural, Heated, Oiled, Minor Oil, Certified Unheated), and certification labs (GIA, GRS, IGI, Gübelin, SSEF, Self).
- **Cut & Shape**: Oval, Cushion, Emerald Cut, Round Brilliant, Pear, Marquise, Princess, Cabochon, Radiant, Heart, Trilliant, Asscher, Baguette, Calibrated.
- **Weight & Pieces**: Total weight in carats (`cts`) and pieces (`pcs`), with individual stone weight breakdowns (`stone_details`, `stone_weights`, and `sub_gems` for mixed parcels).
- **Pricing & Margin**: Purchase cost, cost rate per carat, purchase date, supplier, target asking price, asking rate per carat, and minimum sale threshold.
- **Stock Status**: `in_stock`, `on_approval` (issued on memo for inspection), `reserved`, or `sold`.
- **Individual Stone State Tracking**: Exact tracking of each individual stone's lifecycle across partial memo allocations, partial approvals, and returns.

### 2. Sales & Approval Vouchers (`GemSale`)
- **Direct Sales Invoices**: Packet allocation, rate per carat or total line pricing, GST handling (0.25% diamonds/gems, 1.5%, 3% jewelry), part-payments, and commercial receipt printing with local QR code verification.
- **Approval Memos (Jangad / Memo)**: Issuing stones on approval to parties for examination without immediate billing.
- **Approval Settlement (Partial & Full Returns)**:
  - Supports customer taking a subset of pieces/carats and returning the rest to the vault.
  - Automatically updates invoice total, balances, and restores returned stones to vault stock with correct piece/carat recalculations.

### 3. Third-Party Brokerage (`GemBrokerage`)
- Handles brokered transactions between external sellers (Party A) and buyers (Party B) where the merchant acts purely as a middleman.
- Calculates commission percentages (e.g., 1.5%) or fixed fees, tracking receivable balances and settlements.

### 4. Purchases & Inward Intake (`GemPurchase`)
- Intake of rough and polished lots directly into vault packets (`ex/1`, `ex/2`...).
- Batch packet allocation with stone breakdown, box assignment, supplier payables, and optional middleman brokerage tracking.

### 5. Categorized Operating Expenses (`GemExpense`)
- Tracks lab certification fees, lapidary cutting/polishing, safe deposit locker rentals, armored transport (Brinks/Malca-Amit), trade shows, and office salaries.

### 6. Reports & Financial Valuation (`/reports`)
- Comprehensive P&L statement (Gross revenue, COGS, gross margin, brokerage commission, net business profit).
- Complete inventory valuation at cost vs. asking price and unrealized vault profit.
- Variety and shape analytics, buyer rankings, and password-protected cost reveal.

### 7. Backup, Restore & Archival Engine (`backupEngine.ts`)
- One-click JSON backup and restore covering all data tables, custom shapes, and system settings.
- Weekly automated backup snapshots and business evaluation report generator.
- Comprehensive Word Document (.doc) export containing full inventory dossiers.

---

## Active Routes Map (`HashRouter`)
- `#/inventory`: Primary Packet & Box Vault Master
- `#/purchases`: Purchase Procurement Master List
- `#/purchases/new`: Purchase Intake & New Packet Creation
- `#/purchases/:id/edit`: Edit Purchase
- `#/sales`: Sales Invoices & Approval Vouchers Master
- `#/sales/new`: Create Sale Invoice or Approval Memo Voucher
- `#/sales/:id`: Luxury Printable Invoice View & QR Verification
- `#/sales/:id/edit`: Edit Invoice / Approval
- `#/brokerage`: Third-Party Brokerage Deals Ledger
- `#/expenses`: Operating Expenses & Laboratory Charges
- `#/assets`: Fixed Assets & Liquid Cash Management
- `#/reports`: P&L Waterfall, Valuation & Analytics (Password Protected)
- `#/buyers`: Customer & Supplier Network Directory
- `#/packet/:id`: Public Offline Packet Dossier Document View
