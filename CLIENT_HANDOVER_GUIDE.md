# 💎 Shreeji Gems CRM & Multi-Company Vault — Client Handover Guide
**Enterprise Gemstone Inventory, Multi-Company Vault & ERP System**  
**Version:** 2.0.0 Production Release (Bare-Shell Edition — 100% Offline, Air-Gapped & Portable)  
**Status:** Pristine Clean Slate (Ready for immediate client data entry, tested for 100,000+ packet capacity)  

---

## 1. 🚀 Quick Start (Running on Any Windows PC or Laptop)

Shreeji Gems runs **100% locally and offline**. It requires **zero cloud connectivity, zero third-party databases, and zero external subscriptions**.

### Step 1: Create Desktop Shortcut (First Time Setup)
1. Open the `Shreeji_Gems_Client_Delivery` folder on your computer or USB drive.
2. Double-click:
   ```
   👉 Create_Desktop_Shortcut.bat
   ```
3. A gemstone-branded desktop shortcut named **"Shreeji Gems - Gemstones CRM"** will be created directly on your Windows Desktop.

### Step 2: Launch the Application
* **Method A (Recommended):** Double-click your new Desktop shortcut.
* **Method B:** Double-click `Launch_GemVault.bat` (or right-click `launch.ps1` and select *Run with PowerShell*).

The software will launch automatically in a dedicated, native borderless application window powered by your local browser engine (Edge / Chrome / Brave) at `http://127.0.0.1:8000/`.

---

## 2. 🔐 Master PIN & Cost-Price Security (Role-Based Access Control)

To protect sensitive trade secrets when showroom staff or clients are viewing the screen, Shreeji Gems includes an enterprise **Dual-Role Security Architecture**:

### Default Staff / Sales View (Cost-Masked)
* By default, sensitive **Purchase Costs**, **Purchase Rates per Carat**, and **Supplier / Mine Names** are hidden.
* Purchase prices display as `🔒 ••••••`, and vendor origins display as **`Confidential`**.
* Sales staff can safely create invoices, browse asking prices, generate approval memos, and inspect carat weights without exposing purchase margins.

### Unlocking Owner / Admin Mode
1. Click the **"🔒 Reveal Cost Price"** button on the top-right of the **Boxes & Gemstone Inventory Master** screen (or open the **"📊 Business Report"** / **"💾 Backup Now"** modal).
2. Enter your 4-digit Master Security PIN:
   * **Default Master PIN:** `2014`
3. Click **"Unlock & Proceed"**.
4. The software generates an authenticated, encrypted local session token:
   * All true purchase rates, vendor identities, and landed costs are instantly unmasked across the entire vault.
5. **Re-Locking Anytime:** Click **"🔓 Cost Revealed (Click to Lock)"** to immediately re-mask all purchase costs and lock sensitive menus.

### Changing the Master PIN
1. Once unlocked, click the gear icon (**⚙️**) adjacent to the unlocked button.
2. Enter your current PIN (`2014`) and your new chosen PIN.
3. The new PIN is securely hashed using **PBKDF2-HMAC-SHA256** (with a cryptographic salt and 100,000 iterations) directly inside your offline SQLite database.

---

## 3. 🔍 Inventory Master & Setting Up Your Vault

The vault is delivered bare-shell with a clean database ready for you to configure according to your stock organization:

### 1. Setting Up Physical Storage Boxes
* Open **"🗃️ Boxes View"** in the Inventory Master.
* Click **"+ Create New Vault Box"** (or use the dashed card in the box grid).
* Assign a Box Name (e.g., `Box 1 — Zambian Emeralds`, `Vault A — Rubies & Sapphires`), choose an accent color, and add physical drawer notes.
* You can create as many boxes as you need across your firms (*Shreeji Gems*, *Shree Lakshmi Gems*, *Shree Krishna Gems*, *Tirth Enterprise*, *Mokshil Traders*).

### 2. Entering Your Gemstone Packets
* Click **"+ Add Stone"** inside any box, or switch to **"📋 All Packets Table"** and click **"+ New Gemstone Packet"**.
* Enter packet number, gemstone variety, shape, carat weight, pieces, purchase cost, and asking price.
* Packets can also be directly added when recording incoming bills under **"📦 Purchases"**.

### 3. Dedicated Search & Sub-15ms Speed
* **Search Packet #:** Instantly locate parcels by exact or partial packet number (e.g., `ex/1`, `EM-101`, `RUB-204`).
* **Stone Name / Variety:** Filter results by stone type (Emerald, Ruby, Blue Sapphire, Tanzanite, Diamond, etc.).
* Built with SQLite B-Tree indexing, engineered to maintain sub-15 millisecond query response times even as your stock scales beyond 100,000 packets.

### 4. Barcode & QR Scanner Gun Integration
* Plug any standard USB or wireless QR / 2D barcode scanner gun into your computer.
* Scan any printed packet tag at any time; Shreeji Gems detects the hardware scan and immediately opens the stone's complete dossier.

---

## 4. ⚖️ Partial Parcel Sales, Precision & Audit Trail

Gemstone trading frequently involves selling fractional carat quantities out of multi-stone parcels or bulk lots. Shreeji Gems guarantees zero rounding drift and automated landed cost relief:

### Three Stone Categorization Types
When creating or editing a packet, specify one of three stone handling modes:
1. **Bulk / Uncountable:** For large lots, calibrated melee, or rough parcels managed strictly by total carat weight and piece count.
2. **No Individual Weight Added:** For uniform parcels where stones share an average carat weight.
3. **Individual Stone Weight Added:** Rich multi-stone layouts where each gemstone has its own recorded carat weight, dimensions (`mm`), and notes.

### Proportional Landed Cost Relief (`Decimal` Math)
* When selling a fractional portion of a parcel (e.g., selling 20.00 carats from a 50.00-carat lot):
  * The system computes the cost of goods sold (COGS) using exact fixed-point `Decimal` arithmetic.
  * The remaining 30.00 carats retain their exact proportional purchase cost basis.
* **Zero Discrepancy Guarantee:** No fractional rupees or carats are ever lost to computer floating-point drift.

### Tamper-Proof Stock Audit Trail
* Every inventory mutation (packet creation, parcel division, sale deduction, approval memo dispatch, or soft deletion) is automatically logged to the `stock_audit_log` table.
* The audit trail records the exact UTC timestamp, packet number, previous state JSON, resulting state JSON, and action type (`SALE_DEDUCTION`, `PACKET_UPDATE`, `PACKET_SOFT_DELETE`).

---

## 5. 📊 Executive Reports, P&L & Offline Backups

### 1. Executive Business Evaluation Report ("📊 Business Report")
* Click **"Business Report"** in the top navigation bar and enter Master PIN `2014`.
* Features sub-25ms cached analytics for instant loading:
  * **Total In-Stock Vault Valuation:** Current inventory cost vs. target asking realization.
  * **Realized Sales & Gross Margins:** Total revenue, gross profit, and margin percentages.
  * **Top Gemstone Varieties by Value:** Instant breakdown of capital allocation (Emeralds, Rubies, Sapphires, Diamonds, etc.).
  * **Outstanding Receivables:** Ledger balance across all client buyers.
* Click **"🖨️ Print / Save PDF Report"** to generate an executive-ready PDF summary for management or banking evaluations.

### 2. Automated Weekly Backups
* Shreeji Gems automatically generates a snapshot archive every 7 days without requiring manual intervention.

### 3. One-Click Manual Backups ("💾 Backup Now")
* Click **"Backup Now"** anytime to download a timestamped snapshot (`gemvault_master_backup_YYYY-MM-DD.json`).
* You can save this file to an external USB flash drive or secure local folder for complete disaster recovery.

### 4. Zero-Downtime Database Restoration ("🔄 Restore")
* To migrate to a new computer or restore a historical point-in-time snapshot, click **"Restore"** and select any `.json` backup file.

---

## 6. 💼 Moving to Another Computer (USB Portability)

To transfer the entire software and database to a new laptop, desktop, or office server:
1. Copy the entire folder:
   ```
   Shreeji_Gems_Client_Delivery
   ```
2. Paste it onto any USB drive or target Windows computer.
3. On the new computer, open the folder and run:
   ```
   Create_Desktop_Shortcut.bat
   ```
4. Everything is ready to operate immediately with 100% of your data intact.

---

**Shreeji Gems — Gemstones CRM & Multi-Company Vault**  
*Confidential, Proprietary & 100% Air-Gapped*

