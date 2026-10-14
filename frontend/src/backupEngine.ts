// Shreeji Gems Automated Weekly Backup & Business Evaluation Report Engine
// 100% Offline, Local Storage & File Archival System

import {
  getStoredPackets,
  getStoredSales,
  getStoredBrokerage,
  getStoredPurchases,
  getStoredExpenses,
  getStoredBuyers,
  getOverallProfitAndAnalytics,
  exportLocalBackup,
  importLocalBackup,
} from "./gemstoneStorage";
import { formatINR } from "./format";
import type { GemPacket } from "./types/gemstone";

export interface BackupHistoryItem {
  id: string;
  timestamp: string; // ISO string
  type: "weekly_auto" | "manual";
  dateFormatted: string;
  totalPackets: number;
  totalCarats: number;
  inventoryValuation: number;
  totalSales: number;
  netProfit: number;
  sizeBytes: number;
  jsonPayload: string;
}

export interface BusinessEvaluationReportData {
  reportDate: string;
  periodLabel: string;
  generatedAt: string;
  inventory: {
    totalPackets: number;
    inStockPackets: number;
    onMemoPackets: number;
    soldPackets: number;
    totalCarats: number;
    inStockCarats: number;
    costValuation: number;
    askingValuation: number;
    potentialProfit: number;
    avgCostPerCarat: number;
    multiGemBoxesCount: number;
  };
  financials: {
    realizedRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    grossMarginPercent: number;
    brokerageEarnings: number;
    totalExpenses: number;
    netOperatingProfit: number;
    outstandingReceivables: number;
  };
  varietyBreakdown: Array<{
    variety: string;
    packetsCount: number;
    carats: number;
    costValuation: number;
    askingValuation: number;
  }>;
  shapeBreakdown: Array<{
    shape: string;
    packetsCount: number;
    carats: number;
  }>;
  recentPackets: GemPacket[];
}

const BACKUP_HISTORY_KEY = "gemvault_backup_history_records";
const LAST_WEEKLY_BACKUP_KEY = "gemvault_last_weekly_backup_timestamp";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Retrieves all archived local backups from localStorage
 */
export function getLocalBackupHistory(): BackupHistoryItem[] {
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Saves a backup snapshot to the local archive list (keeps up to 52 weekly backups)
 */
function saveToLocalHistory(item: BackupHistoryItem) {
  try {
    const list = getLocalBackupHistory();
    const updated = [item, ...list.filter((x) => x.id !== item.id)].slice(0, 52);
    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Could not save to localStorage backup history:", err);
  }
}

/**
 * Helper to escape HTML characters in data strings
 */
function esc(str: any): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generates an exhaustive, beautifully formatted Microsoft Word Document (.doc with WordprocessingML/HTML)
 * containing itemized records, specs, and financial metrics across ALL sections of the gemstone software:
 * 1. Executive Summary & Vault Financial Valuation
 * 2. Complete Packet Inventory Master (Every packet, all specs, prices, status, lab certs)
 * 3. Mixed Parcel Lots & Sub-Gem Itemization
 * 4. Purchases & Procurement Intake Registry
 * 5. Sales & Customer Invoicing Master Registry
 * 6. Brokerage Deals Registry (Non-Inventory)
 * 7. Operating Expenses Master Ledger
 * 8. Buyers & Client Network Directory
 * 9. Gemstone Variety & Shape Analytics
 */
export function generateMasterWordDocumentHtml(): string {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeFormatted = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const packets = getStoredPackets();
  const sales = getStoredSales();
  const purchases = getStoredPurchases();
  const expenses = getStoredExpenses();
  const brokerage = getStoredBrokerage();
  const buyers = getStoredBuyers();
  const report = generateBusinessEvaluationReport();
  const stats = getOverallProfitAndAnalytics();

  // Multi-gem boxes
  const multiGemPackets = packets.filter(
    (p) => (p.sub_gems && p.sub_gems.length > 0) || (p.pieces || 1) > 1
  );

  return `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>SHREEJI GEMS Master System Backup &amp; Business Audit Dossier</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page {
    size: A4 portrait;
    margin: 1.2cm 1.2cm 1.2cm 1.2cm;
    mso-page-orientation: portrait;
  }
  body {
    font-family: Calibri, "Segoe UI", Arial, sans-serif;
    font-size: 9.5pt;
    color: #0f172a;
    line-height: 1.35;
    background-color: #ffffff;
    margin: 0;
    padding: 0;
  }
  .header-box {
    border-bottom: 2.5pt solid #047857;
    padding-bottom: 8pt;
    margin-bottom: 14pt;
  }
  .doc-title {
    font-size: 20pt;
    font-weight: bold;
    color: #047857;
    margin: 0;
  }
  .doc-subtitle {
    font-size: 11pt;
    color: #475569;
    font-weight: 600;
    margin-top: 2pt;
    margin-bottom: 6pt;
  }
  .meta-table {
    width: 100%;
    font-size: 8.5pt;
    color: #334155;
    border-collapse: collapse;
    margin-top: 4pt;
  }
  .meta-table td {
    border: none;
    padding: 2pt 4pt;
  }
  h2 {
    font-size: 12pt;
    color: #064e3b;
    background-color: #ecfdf5;
    border-left: 5pt solid #047857;
    padding: 4pt 8pt;
    margin-top: 18pt;
    margin-bottom: 6pt;
    page-break-after: avoid;
  }
  h3 {
    font-size: 10pt;
    color: #1e293b;
    margin-top: 8pt;
    margin-bottom: 4pt;
  }
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12pt;
    font-size: 8pt;
  }
  table.data-table th {
    background-color: #047857;
    color: #ffffff;
    font-weight: bold;
    padding: 4pt 5pt;
    border: 0.5pt solid #064e3b;
    text-align: left;
  }
  table.data-table td {
    padding: 3.5pt 5pt;
    border: 0.5pt solid #cbd5e1;
    vertical-align: top;
  }
  table.data-table tr:nth-child(even) td {
    background-color: #f8fafc;
  }
  .num {
    text-align: right;
    font-family: Consolas, monospace;
  }
  .badge-instock {
    background-color: #d1fae5;
    color: #065f46;
    font-weight: bold;
    padding: 1.5pt 4pt;
  }
  .badge-sold {
    background-color: #fee2e2;
    color: #991b1b;
    font-weight: bold;
    padding: 1.5pt 4pt;
  }
  .badge-memo {
    background-color: #fef3c7;
    color: #92400e;
    font-weight: bold;
    padding: 1.5pt 4pt;
  }
  .kpi-grid {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12pt;
  }
  .kpi-grid td {
    border: 0.5pt solid #cbd5e1;
    background-color: #f8fafc;
    padding: 6pt 8pt;
    vertical-align: top;
  }
  .kpi-title {
    font-size: 7.5pt;
    font-weight: bold;
    color: #64748b;
    text-transform: uppercase;
  }
  .kpi-number {
    font-size: 13pt;
    font-weight: bold;
    color: #0f172a;
    margin-top: 2pt;
  }
  .kpi-sub {
    font-size: 7.5pt;
    color: #059669;
    font-weight: 600;
    margin-top: 1pt;
  }
  .footer-seal {
    margin-top: 25pt;
    border-top: 1.5pt solid #94a3b8;
    padding-top: 10pt;
    font-size: 8.5pt;
    color: #64748b;
    page-break-inside: avoid;
  }
</style>
</head>
<body>

  <!-- MASTER DOCUMENT HEADER -->
  <div class="header-box">
    <table style="width:100%; border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          <div class="doc-title">SHREEJI GEMS &bull; MASTER SYSTEM BACKUP DOSSIER</div>
          <div class="doc-subtitle">Complete Business Evaluation, Inventory, Sales, Purchases, Brokerage &amp; Expenses Master Record</div>
        </td>
        <td style="text-align:right; vertical-align:top;">
          <div style="font-size:11pt; font-weight:bold; color:#047857;">OFFICIAL BACKUP ARCHIVE</div>
          <div style="font-size:8.5pt; color:#64748b;">Format: Microsoft Word Document (.doc)</div>
        </td>
      </tr>
    </table>
    <table class="meta-table">
      <tr>
        <td><strong>Backup Date:</strong> ${esc(dateFormatted)} (${esc(timeFormatted)})</td>
        <td><strong>Total Database Packets:</strong> ${packets.length} Packets</td>
        <td><strong>Storage Engine:</strong> 100% Offline Local Machine</td>
      </tr>
      <tr>
        <td><strong>Invoiced Sales:</strong> ${sales.length} Deals</td>
        <td><strong>Procurement Records:</strong> ${purchases.length} Intake Vouchers</td>
        <td><strong>Audit Signature:</strong> GV-SEC-${Date.now().toString(36).toUpperCase()}</td>
      </tr>
    </table>
  </div>

  <!-- EXECUTIVE SUMMARY & MASTER FINANCIAL VALUATION -->
  <h2>1. Executive Summary &amp; Vault Financial Valuation</h2>
  <table class="kpi-grid">
    <tr>
      <td style="width:25%;">
        <div class="kpi-title">Vault Cost Valuation</div>
        <div class="kpi-number">${esc(formatINR(report.inventory.costValuation))}</div>
        <div class="kpi-sub">${report.inventory.inStockPackets} In-Stock Pkts (${report.inventory.inStockCarats} cts)</div>
      </td>
      <td style="width:25%;">
        <div class="kpi-title">Vault Asking Valuation</div>
        <div class="kpi-number">${esc(formatINR(report.inventory.askingValuation))}</div>
        <div class="kpi-sub">+${esc(formatINR(report.inventory.potentialProfit))} Projected Margin</div>
      </td>
      <td style="width:25%;">
        <div class="kpi-title">Realized Sales Revenue</div>
        <div class="kpi-number" style="color:#059669;">${esc(formatINR(report.financials.realizedRevenue))}</div>
        <div class="kpi-sub">Gross Margin: ${report.financials.grossMarginPercent}%</div>
      </td>
      <td style="width:25%;">
        <div class="kpi-title">Net Operating Profit</div>
        <div class="kpi-number" style="color:#047857;">${esc(formatINR(report.financials.netOperatingProfit))}</div>
        <div class="kpi-sub">Bottom-Line Trading Net</div>
      </td>
    </tr>
  </table>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width:40%;">Master Financial Parameter</th>
        <th class="num" style="width:25%;">Value (INR)</th>
        <th style="width:35%;">Audit / Accounting Notes</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Realized Sales Revenue</strong></td>
        <td class="num"><strong>${esc(formatINR(report.financials.realizedRevenue))}</strong></td>
        <td>Total billed invoices from closed transactions</td>
      </tr>
      <tr>
        <td>Less: Cost of Goods Sold (COGS)</td>
        <td class="num" style="color:#dc2626;">-${esc(formatINR(report.financials.costOfGoodsSold))}</td>
        <td>Original acquisition cost of delivered stones</td>
      </tr>
      <tr style="background-color:#ecfdf5;">
        <td><strong>Gross Trading Margin</strong></td>
        <td class="num" style="color:#059669;"><strong>${esc(formatINR(report.financials.grossProfit))}</strong></td>
        <td><strong>${report.financials.grossMarginPercent}% Gross Trading Spread</strong></td>
      </tr>
      <tr>
        <td>Add: Brokerage Facilitation Commissions</td>
        <td class="num" style="color:#059669;">+${esc(formatINR(report.financials.brokerageEarnings))}</td>
        <td>Commissions from non-inventory third-party deals</td>
      </tr>
      <tr>
        <td>Less: Operating Expenses</td>
        <td class="num" style="color:#dc2626;">-${esc(formatINR(report.financials.totalExpenses))}</td>
        <td>Certification, travel, vault rent, logistics, overhead</td>
      </tr>
      <tr style="background-color:#f0fdf4; font-weight:bold;">
        <td><strong>NET OPERATING PROFIT</strong></td>
        <td class="num" style="color:#047857;"><strong>${esc(formatINR(report.financials.netOperatingProfit))}</strong></td>
        <td><strong>Net Profit after all trade &amp; operational expenses</strong></td>
      </tr>
      <tr>
        <td>Outstanding Receivables from Buyers</td>
        <td class="num" style="color:#f59e0b;">${esc(formatINR(report.financials.outstandingReceivables))}</td>
        <td>Unsettled buyer invoice balances pending collection</td>
      </tr>
      <tr>
        <td>Current In-Stock Inventory Cost Basis</td>
        <td class="num">${esc(formatINR(report.inventory.costValuation))}</td>
        <td>Asset backing across ${report.inventory.inStockPackets} active gemstones</td>
      </tr>
    </tbody>
  </table>

  <!-- SECTION 2: COMPLETE PACKET INVENTORY MASTER -->
  <h2>2. Complete Gemstone Packet Inventory Master (${packets.length} Packets)</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Packet #</th>
        <th>Particulars / Gem Variety</th>
        <th>Shape &amp; Size</th>
        <th class="num">Weight</th>
        <th class="num">Pcs</th>
        <th class="num">Cost (INR)</th>
        <th>Purchase Date &amp; Supplier</th>
        <th class="num">Sale Price (INR)</th>
        <th>Status</th>
        <th>Buyer / Sold Details</th>
        <th>Lab &amp; Cert #</th>
      </tr>
    </thead>
    <tbody>
      ${packets
        .map((p) => {
          const statusBadge =
            p.status === "in_stock"
              ? `<span class="badge-instock">IN STOCK</span>`
              : p.status === "sold"
              ? `<span class="badge-sold">SOLD</span>`
              : `<span class="badge-memo">ON APPROVAL</span>`;

          const buyerDetails =
            p.status === "sold"
              ? `Buyer: ${esc(p.buyer_name || "Direct")}<br/>Sold: ${esc(formatINR(p.sold_price || p.sale_price))} (${esc(p.sale_date || "-")})`
              : p.status === "on_memo"
              ? `Approval: ${esc(p.memo_party || "-")}<br/>Date: ${esc(p.memo_date || "-")}`
              : "In Vault";

          const certInfo = p.cert_lab
            ? `${esc(p.cert_lab)} ${p.cert_no ? `#${esc(p.cert_no)}` : ""}`
            : "Self / None";

          return `
      <tr>
        <td><strong>${esc(p.packet_number)}</strong></td>
        <td><strong>${esc(p.particulars)}</strong><br/><span style="color:#64748b; font-size:7.5pt;">${esc(p.origin || "")} &bull; ${esc(p.treatment || "")}</span></td>
        <td>${esc(p.shape)}<br/><span style="color:#64748b; font-size:7.5pt;">${esc(p.mm_size || "-")}</span></td>
        <td class="num"><strong>${p.weight}</strong> ${p.unit || "cts"}</td>
        <td class="num">${p.pieces || 1}</td>
        <td class="num">${esc(formatINR(p.purchase_price))}<br/><span style="color:#64748b; font-size:7pt;">₹${Math.round(p.purchase_rate_per_unit || p.purchase_rate_per_ct || 0)}/${p.unit === "g" ? "g" : "ct"}</span></td>
        <td>${esc(p.purchase_date || "-")}<br/><span style="color:#64748b; font-size:7.5pt;">${esc(p.supplier_name || "-")}</span></td>
        <td class="num"><strong>${esc(formatINR(p.sale_price))}</strong><br/><span style="color:#64748b; font-size:7pt;">₹${Math.round(p.sale_rate_per_unit || p.sale_rate_per_ct || 0)}/${p.unit === "g" ? "g" : "ct"}</span></td>
        <td>${statusBadge}</td>
        <td>${buyerDetails}</td>
        <td>${certInfo}</td>
      </tr>`;
        })
        .join("")}
    </tbody>
  </table>

  <!-- SECTION 3: MIXED PARCEL LOTS & SUB-GEM ITEMIZATION -->
  <h2>3. Mixed Parcel Lots &amp; Multi-Gem Itemization (${multiGemPackets.length} Lots)</h2>
  ${
    multiGemPackets.length === 0
      ? `<p style="color:#64748b; font-style:italic;">No mixed parcel or multi-stone boxes recorded.</p>`
      : `
  <table class="data-table">
    <thead>
      <tr>
        <th>Parent Packet #</th>
        <th>Lot Description</th>
        <th>Sub-Gem / Variety</th>
        <th>Shape</th>
        <th>MM Dimensions</th>
        <th class="num">Weight (cts)</th>
        <th class="num">Pcs</th>
        <th>Sub-Item Specifications / Notes</th>
      </tr>
    </thead>
    <tbody>
      ${multiGemPackets
        .map((p) => {
          if (p.sub_gems && p.sub_gems.length > 0) {
            return p.sub_gems
              .map(
                (sg) => `
            <tr>
              <td><strong>${esc(p.packet_number)}</strong></td>
              <td>${esc(p.particulars)}</td>
              <td><strong>${esc(sg.variety)}</strong></td>
              <td>${esc(sg.shape)}</td>
              <td>${esc(sg.mm_size || "-")}</td>
              <td class="num"><strong>${sg.weight}</strong> cts</td>
              <td class="num">${sg.pieces || 1}</td>
              <td>${esc(sg.notes || "-")}</td>
            </tr>`
              )
              .join("");
          } else {
            return `
            <tr>
              <td><strong>${esc(p.packet_number)}</strong></td>
              <td>${esc(p.particulars)}</td>
              <td>Bulk Matched Lot</td>
              <td>${esc(p.shape)}</td>
              <td>${esc(p.mm_size || "-")}</td>
              <td class="num"><strong>${p.weight}</strong> cts</td>
              <td class="num">${p.pieces || 1}</td>
              <td>Calibrated parcel of matched stones (${esc(p.notes || "-")})</td>
            </tr>`;
          }
        })
        .join("")}
    </tbody>
  </table>`
  }

  <!-- SECTION 4: PURCHASES & PROCUREMENT INTAKE REGISTRY -->
  <h2>4. Purchases &amp; Procurement Intake Registry (${purchases.length} Vouchers)</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Voucher #</th>
        <th>Date</th>
        <th>Supplier / Mine</th>
        <th>Contact / City</th>
        <th>Packets Purchased</th>
        <th class="num">Total Cost (INR)</th>
        <th class="num">Paid Amount</th>
        <th class="num">Balance Payable</th>
        <th>Payment Status &amp; Mode</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${purchases
        .map((pur) => {
          const packetList = (pur.items || [])
            .map((it) => `${esc(it.packet_number)} (${esc(it.particulars)}, ${it.weight}cts)`)
            .join("; ");
          return `
      <tr>
        <td><strong>${esc(pur.purchase_no)}</strong></td>
        <td>${esc(pur.date)}</td>
        <td><strong>${esc(pur.supplier_name)}</strong></td>
        <td>${esc(pur.supplier_phone || "-")}<br/><span style="color:#64748b; font-size:7.5pt;">${esc(pur.supplier_city || "")}</span></td>
        <td>${packetList || "Direct packet intake"}</td>
        <td class="num"><strong>${esc(formatINR(pur.total_cost))}</strong></td>
        <td class="num">${esc(formatINR(pur.paid_amount))}</td>
        <td class="num" style="color:${pur.balance_payable > 0 ? "#dc2626" : "#059669"};">${esc(formatINR(pur.balance_payable))}</td>
        <td><strong>${esc(pur.payment_status.toUpperCase())}</strong><br/><span style="color:#64748b; font-size:7.5pt;">${esc(pur.payment_mode || "-")}</span></td>
        <td>${esc(pur.notes || "-")}</td>
      </tr>`;
        })
        .join("")}
    </tbody>
  </table>

  <!-- SECTION 5: SALES & CUSTOMER INVOICING MASTER REGISTRY -->
  <h2>5. Sales &amp; Customer Invoicing Master Registry (${sales.length} Invoices)</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Invoice #</th>
        <th>Date</th>
        <th>Buyer / Customer</th>
        <th>Contact / City</th>
        <th>Invoiced Gemstones / Packets</th>
        <th class="num">Subtotal</th>
        <th class="num">Grand Total</th>
        <th class="num">Amount Paid</th>
        <th class="num">Balance Due</th>
        <th>Payment Status</th>
        <th>Due Date / Terms</th>
      </tr>
    </thead>
    <tbody>
      ${sales
        .map((s) => {
          const itemList = (s.items || [])
            .map(
              (it) =>
                `<strong>${esc(it.packet_number)}</strong> &bull; ${esc(it.particulars)} (${it.weight} ${it.unit || "cts"} @ ₹${Math.round(it.rate_per_unit || it.rate_per_ct || 0)}/${it.unit === "g" ? "g" : "ct"} = ₹${formatINR(it.total_price)})`
            )
            .join("<br/>");
          return `
      <tr>
        <td><strong>${esc(s.invoice_no)}</strong></td>
        <td>${esc(s.date)}</td>
        <td><strong>${esc(s.buyer_name)}</strong></td>
        <td>${esc(s.buyer_phone || "-")}<br/><span style="color:#64748b; font-size:7.5pt;">${esc(s.buyer_city || "")}</span></td>
        <td>${itemList || "Direct gemstone sale"}</td>
        <td class="num">${esc(formatINR(s.subtotal))}</td>
        <td class="num"><strong>${esc(formatINR(s.total))}</strong></td>
        <td class="num">${esc(formatINR(s.paid_amount))}</td>
        <td class="num" style="color:${s.balance > 0 ? "#dc2626" : "#059669"}; font-weight:bold;">${esc(formatINR(s.balance))}</td>
        <td><strong>${esc((s.is_approval ? `MEMO (${s.approval_status || "PENDING"})` : s.payment_status).toUpperCase())}</strong><br/><span style="color:#64748b; font-size:7.5pt;">${esc(s.payment_mode || "-")}</span></td>
        <td>${esc(s.due_date || "Immediate")}<br/><span style="color:#64748b; font-size:7.5pt;">${esc(s.notes || "")}</span></td>
      </tr>`;
        })
        .join("")}
    </tbody>
  </table>

  <!-- SECTION 6: BROKERAGE DEALS REGISTRY -->
  <h2>6. Brokerage &amp; Facilitated Deals Registry (${brokerage.length} Deals &bull; Non-Inventory)</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Deal #</th>
        <th>Date</th>
        <th>Gemstone Particulars</th>
        <th class="num">Weight</th>
        <th>Seller / Source</th>
        <th>Buyer / Destination</th>
        <th class="num">Deal Value</th>
        <th class="num">Comm. %</th>
        <th class="num">Commission</th>
        <th class="num">Received</th>
        <th class="num">Receivable</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${brokerage
        .map((b) => `
      <tr>
        <td><strong>${esc(b.deal_no)}</strong></td>
        <td>${esc(b.date)}</td>
        <td><strong>${esc(b.particulars)}</strong><br/><span style="color:#64748b; font-size:7.5pt;">${esc(b.shape)} &bull; ${esc(b.cert_lab || "Self")}</span></td>
        <td class="num"><strong>${b.weight}</strong> cts<br/><span style="color:#64748b; font-size:7pt;">${b.pieces || 1} pcs</span></td>
        <td>${esc(b.seller_name)}</td>
        <td>${esc(b.buyer_name)}</td>
        <td class="num">${esc(formatINR(b.deal_value))}</td>
        <td class="num">${b.brokerage_percent}%</td>
        <td class="num" style="color:#059669; font-weight:bold;">${esc(formatINR(b.commission_amount))}</td>
        <td class="num">${esc(formatINR(b.received_amount))}</td>
        <td class="num" style="color:${b.balance_receivable > 0 ? "#dc2626" : "#059669"};">${esc(formatINR(b.balance_receivable))}</td>
        <td><strong>${esc(b.settlement_status.toUpperCase())}</strong></td>
      </tr>`)
        .join("")}
    </tbody>
  </table>

  <!-- SECTION 7: OPERATING EXPENSES MASTER LEDGER -->
  <h2>7. Operating Expenses Master Ledger (${expenses.length} Expense Records)</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Expense ID</th>
        <th>Date</th>
        <th>Expense Category</th>
        <th>Payee / Vendor</th>
        <th>Packet Reference</th>
        <th class="num">Amount (INR)</th>
        <th>Payment Mode</th>
        <th>Description / Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${expenses
        .map((e) => `
      <tr>
        <td><strong>${esc(e.id)}</strong></td>
        <td>${esc(e.date)}</td>
        <td><strong>${esc(e.category)}</strong></td>
        <td>${esc(e.payee || "-")}</td>
        <td>${esc(e.packet_ref || "-")}</td>
        <td class="num" style="color:#dc2626; font-weight:bold;">${esc(formatINR(e.amount))}</td>
        <td>${esc(e.payment_mode || "-")}</td>
        <td>${esc(e.note || "-")}</td>
      </tr>`)
        .join("")}
      <tr style="background-color:#fee2e2; font-weight:bold;">
        <td colspan="5" style="text-align:right;"><strong>TOTAL OPERATING EXPENSES:</strong></td>
        <td class="num" style="color:#dc2626;"><strong>${esc(formatINR(report.financials.totalExpenses))}</strong></td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>

  <!-- SECTION 8: BUYERS & CLIENT NETWORK DIRECTORY -->
  <h2>8. Buyers &amp; Client Network Directory (${buyers.length} Registered Accounts)</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th>Client / Firm Name</th>
        <th>Contact Person</th>
        <th>Phone / WhatsApp</th>
        <th>City / Market</th>
        <th>Address</th>
        <th class="num">Total Purchases</th>
        <th class="num">Current Balance</th>
        <th>Notes / Preferences</th>
      </tr>
    </thead>
    <tbody>
      ${buyers
        .map((b) => {
          // Calculate client spend from confirmed sales (exclude unapproved approvals and returned memos)
          const clientSales = sales.filter(
            (s) =>
              s.buyer_name?.toLowerCase().includes(b.name.toLowerCase()) &&
              s.approval_status !== "returned" &&
              (!s.is_approval || s.approval_status === "approved_billed")
          );
          const totalSpend = clientSales.reduce((sum, s) => sum + (s.total || 0), 0);
          const totalBalance = clientSales.reduce((sum, s) => sum + (s.balance || 0), 0);
          return `
      <tr>
        <td><strong>${esc(b.company || b.name)}</strong></td>
        <td>${esc(b.name)}</td>
        <td>${esc(b.phone || "-")}${b.whatsapp ? `<br/><span style="color:#25d366; font-size:7.5pt;">WA: ${esc(b.whatsapp)}</span>` : ""}</td>
        <td><strong>${esc(b.city || "-")}</strong></td>
        <td>${esc(b.address || "-")}</td>
        <td class="num">${esc(formatINR(totalSpend))}</td>
        <td class="num" style="color:${totalBalance > 0 ? "#dc2626" : "#059669"}; font-weight:bold;">${esc(formatINR(totalBalance))}</td>
        <td>${esc(b.notes || "-")}</td>
      </tr>`;
        })
        .join("")}
    </tbody>
  </table>

  <!-- SECTION 9: GEMSTONE VARIETY & SHAPE ANALYTICS -->
  <h2>9. Gemstone Variety &amp; Shape Distribution Analytics</h2>
  <table style="width:100%; border-collapse:collapse;">
    <tr>
      <td style="width:50%; vertical-align:top; padding-right:6pt;">
        <h3>A. Inventory by Gemstone Variety</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Variety</th>
              <th class="num">Pkts</th>
              <th class="num">Carats</th>
              <th class="num">Cost (INR)</th>
              <th class="num">Ask (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${report.varietyBreakdown
              .map((v) => `
            <tr>
              <td><strong>${esc(v.variety)}</strong></td>
              <td class="num">${v.packetsCount}</td>
              <td class="num">${v.carats} cts</td>
              <td class="num">${esc(formatINR(v.costValuation))}</td>
              <td class="num">${esc(formatINR(v.askingValuation))}</td>
            </tr>`)
              .join("")}
          </tbody>
        </table>
      </td>
      <td style="width:50%; vertical-align:top; padding-left:6pt;">
        <h3>B. Inventory by Cut &amp; Shape</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Shape</th>
              <th class="num">Packets</th>
              <th class="num">Total Carats</th>
            </tr>
          </thead>
          <tbody>
            ${report.shapeBreakdown
              .map((s) => `
            <tr>
              <td><strong>${esc(s.shape)}</strong></td>
              <td class="num">${s.packetsCount}</td>
              <td class="num">${s.carats} cts</td>
            </tr>`)
              .join("")}
          </tbody>
        </table>
      </td>
    </tr>
  </table>

  <!-- AUDIT FOOTER & SEAL -->
  <div class="footer-seal">
    <table style="width:100%; border-collapse:collapse;">
      <tr>
        <td style="width:60%; vertical-align:top;">
          <strong>CONFIDENTIAL GEMSTONE VAULT AUDIT &amp; BACKUP RECORD</strong><br/>
          This document represents the master system ledger generated directly from the Shreeji Gems local offline database.<br/>
          All packet weights, valuations, transactions, invoices, and ledgers are verified and sealed.
        </td>
        <td style="width:40%; text-align:right; vertical-align:bottom;">
          <div>Authorized Vault Signature &amp; Seal</div>
          <div style="margin-top:20pt; border-bottom:1pt solid #0f172a; width:180pt; margin-left:auto;"></div>
          <div style="font-size:7.5pt; color:#64748b; margin-top:2pt;">Vault Custodian / Managing Partner</div>
        </td>
      </tr>
    </table>
  </div>

</body>
</html>
`;
}

/**
 * Downloads the master backup as a rich Microsoft Word Document (.doc)
 * containing full details of all 9 sections of the software.
 */
export function downloadMasterWordBackup(customFilename?: string): string {
  const htmlContent = generateMasterWordDocumentHtml();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(":", "-");
  const filename = customFilename || `gemvault_master_backup_${dateStr}_${timeStr}.doc`;

  // Prepend UTF-8 BOM so Microsoft Word parses special characters and rupee symbols properly
  const blob = new Blob(["\ufeff" + htmlContent], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
}

/**
 * Downloads the raw JSON database backup file
 */
export function downloadJsonBackup(customFilename?: string): string {
  const jsonStr = exportLocalBackup();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(":", "-");
  const filename = customFilename || `gemvault_backup_${dateStr}_${timeStr}.json`;

  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
}

/**
 * Creates and downloads a complete master backup as a Word document (.doc)
 * and saves a recovery JSON snapshot to the local history.
 */
export function createAndDownloadBackupNow(isAutoWeekly = false): {
  success: boolean;
  filename: string;
  historyItem: BackupHistoryItem;
} {
  const jsonStr = exportLocalBackup();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(":", "-");
  const wordFilename = isAutoWeekly
    ? `gemvault_weekly_auto_backup_${dateStr}.doc`
    : `gemvault_master_backup_${dateStr}_${timeStr}.doc`;
  const jsonFilename = isAutoWeekly
    ? `gemvault_weekly_auto_backup_${dateStr}.json`
    : `gemvault_master_backup_${dateStr}_${timeStr}.json`;

  const stats = getOverallProfitAndAnalytics();
  const packets = getStoredPackets();
  const totalCarats = packets.reduce((s, p) => s + (p.weight || 0), 0);

  const historyItem: BackupHistoryItem = {
    id: `bak-${Date.now()}`,
    timestamp: now.toISOString(),
    type: isAutoWeekly ? "weekly_auto" : "manual",
    dateFormatted: `${dateStr} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    totalPackets: packets.length,
    totalCarats: Math.round(totalCarats * 100) / 100,
    inventoryValuation: stats.vault_cost_valuation,
    totalSales: stats.total_sales_revenue,
    netProfit: stats.net_profit,
    sizeBytes: new Blob([jsonStr]).size,
    jsonPayload: jsonStr,
  };

  // Archive snapshot in local history for instant 1-click restore
  saveToLocalHistory(historyItem);

  // Trigger Word document backup download (.doc) containing all sections of the software
  downloadMasterWordBackup(wordFilename);

  // Trigger simultaneous JSON database snapshot download (.json) for easy transfer and restore
  setTimeout(() => {
    try {
      downloadJsonBackup(jsonFilename);
    } catch (err) {
      console.error("Error downloading companion JSON backup:", err);
    }
  }, 120);

  return { success: true, filename: `${wordFilename} & ${jsonFilename}`, historyItem };
}

/**
 * Compiles a comprehensive Business Evaluation Report
 */
export function generateBusinessEvaluationReport(): BusinessEvaluationReportData {
  const now = new Date();
  const packets = getStoredPackets();
  const sales = getStoredSales();
  const expenses = getStoredExpenses();
  const brokerage = getStoredBrokerage();
  const stats = getOverallProfitAndAnalytics();

  const inStock = packets.filter((p) => p.status === "in_stock");
  const onMemo = packets.filter((p) => p.status === "on_memo");
  const sold = packets.filter((p) => p.status === "sold");

  const totalCarats = packets.reduce((s, p) => s + (p.weight || 0), 0);
  const inStockCarats = inStock.reduce((s, p) => s + (p.weight || 0), 0);
  const costValuation = inStock.reduce((s, p) => s + (p.purchase_price || 0), 0);
  const askingValuation = inStock.reduce((s, p) => s + (p.sale_price || 0), 0);
  const potentialProfit = askingValuation - costValuation;
  const avgCostPerCarat = inStockCarats > 0 ? Math.round(costValuation / inStockCarats) : 0;
  const multiGemBoxesCount = packets.filter((p) => (p.sub_gems && p.sub_gems.length > 0) || (p.pieces || 1) > 1).length;

  // Confirmed sales only (exclude unapproved approvals and returned vouchers)
  const confirmedSales = sales.filter(
    (s) => s.approval_status !== "returned" && (!s.is_approval || s.approval_status === "approved_billed")
  );

  // Realized financials
  const realizedRevenue = confirmedSales.reduce((s, sale) => s + (sale.total || 0), 0);
  const cogs = confirmedSales.reduce((s, sale) => {
    const saleCost = (sale.items || []).reduce((sum, item) => sum + (item.cost_price || 0), 0);
    return s + saleCost;
  }, 0);
  const grossProfit = realizedRevenue - cogs;
  const grossMarginPercent = realizedRevenue > 0 ? Math.round((grossProfit / realizedRevenue) * 100) : 0;
  const brokerageEarnings = brokerage.reduce((s, b) => s + (b.commission_amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netOperatingProfit = grossProfit + brokerageEarnings - totalExpenses;
  const outstandingReceivables = confirmedSales.reduce((s, sale) => s + (sale.balance || 0), 0);

  // Variety breakdown
  const varietyMap: Record<string, { count: number; carats: number; cost: number; ask: number }> = {};
  packets.forEach((p) => {
    // Extract base variety
    const baseVar = p.particulars.split(/[\(\-–]/)[0].trim() || "Other Gemstone";
    if (!varietyMap[baseVar]) {
      varietyMap[baseVar] = { count: 0, carats: 0, cost: 0, ask: 0 };
    }
    varietyMap[baseVar].count += 1;
    varietyMap[baseVar].carats += p.weight || 0;
    varietyMap[baseVar].cost += p.purchase_price || 0;
    varietyMap[baseVar].ask += p.sale_price || 0;
  });

  const varietyBreakdown = Object.entries(varietyMap)
    .map(([variety, data]) => ({
      variety,
      packetsCount: data.count,
      carats: Math.round(data.carats * 100) / 100,
      costValuation: data.cost,
      askingValuation: data.ask,
    }))
    .sort((a, b) => b.costValuation - a.costValuation);

  // Shape breakdown
  const shapeMap: Record<string, { count: number; carats: number }> = {};
  packets.forEach((p) => {
    const sh = p.shape || "Standard";
    if (!shapeMap[sh]) shapeMap[sh] = { count: 0, carats: 0 };
    shapeMap[sh].count += 1;
    shapeMap[sh].carats += p.weight || 0;
  });

  const shapeBreakdown = Object.entries(shapeMap)
    .map(([shape, data]) => ({
      shape,
      packetsCount: data.count,
      carats: Math.round(data.carats * 100) / 100,
    }))
    .sort((a, b) => b.packetsCount - a.packetsCount);

  return {
    reportDate: now.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    periodLabel: `Week of ${now.toISOString().slice(0, 10)}`,
    generatedAt: now.toLocaleString(),
    inventory: {
      totalPackets: packets.length,
      inStockPackets: inStock.length,
      onMemoPackets: onMemo.length,
      soldPackets: sold.length,
      totalCarats: Math.round(totalCarats * 100) / 100,
      inStockCarats: Math.round(inStockCarats * 100) / 100,
      costValuation,
      askingValuation,
      potentialProfit,
      avgCostPerCarat,
      multiGemBoxesCount,
    },
    financials: {
      realizedRevenue,
      costOfGoodsSold: cogs,
      grossProfit,
      grossMarginPercent,
      brokerageEarnings,
      totalExpenses,
      netOperatingProfit,
      outstandingReceivables,
    },
    varietyBreakdown,
    shapeBreakdown,
    recentPackets: packets.slice(0, 10),
  };
}

/**
 * Prints the business evaluation report in a clean executive document format
 */
export function printBusinessEvaluationReport() {
  const report = generateBusinessEvaluationReport();
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>SHREEJI GEMS — Executive Business Evaluation & Inventory Report</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            line-height: 1.45;
            margin: 0;
            padding: 0;
            background: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2.5px solid #047857;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .title { font-size: 24px; font-weight: 900; color: #047857; letter-spacing: 0.5px; }
          .subtitle { font-size: 13px; color: #475569; font-weight: 600; }
          .meta-box { text-align: right; font-size: 11px; color: #64748b; line-height: 1.4; }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .kpi-card {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px 12px;
            background: #f8fafc;
          }
          .kpi-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
          .kpi-val { font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 2px; }
          .kpi-sub { font-size: 10px; color: #059669; font-weight: 700; }
          .section-title {
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-left: 4px solid #047857;
            padding-left: 8px;
            margin: 20px 0 10px;
            color: #0f172a;
          }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px; }
          th { background: #f1f5f9; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 800; }
          td { padding: 6px 8px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #fafafa; }
          .num { text-align: right; }
          .footer {
            margin-top: 30px;
            border-top: 1px solid #cbd5e1;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">💎 SHREEJI GEMS EXECUTIVE REPORT</div>
            <div class="subtitle">Complete Gemstone Vault Valuation, P&L & Inventory Velocity Analysis</div>
          </div>
          <div class="meta-box">
            <div><strong>Report Period:</strong> ${report.periodLabel}</div>
            <div><strong>Generated:</strong> ${report.generatedAt}</div>
            <div><strong>Storage:</strong> 100% Offline Local Machine</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Vault Cost Valuation</div>
            <div class="kpi-val">${formatINR(report.inventory.costValuation)}</div>
            <div class="kpi-sub">${report.inventory.inStockPackets} Active Packets (${report.inventory.inStockCarats} cts)</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Vault Asking Valuation</div>
            <div class="kpi-val">${formatINR(report.inventory.askingValuation)}</div>
            <div class="kpi-sub">+${formatINR(report.inventory.potentialProfit)} Target Spread</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Net Operating Profit</div>
            <div class="kpi-val" style="color: #059669;">${formatINR(report.financials.netOperatingProfit)}</div>
            <div class="kpi-sub">${report.financials.grossMarginPercent}% Margin on Realized Sales</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Brokerage & Receivables</div>
            <div class="kpi-val">${formatINR(report.financials.brokerageEarnings)}</div>
            <div class="kpi-sub">${formatINR(report.financials.outstandingReceivables)} Pending Due</div>
          </div>
        </div>

        <div class="section-title">1. Financial Performance & P&L Statement</div>
        <table>
          <thead>
            <tr>
              <th>Financial Parameter</th>
              <th class="num">Amount (INR)</th>
              <th>Executive Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Realized Gemstone Sales Revenue</strong></td>
              <td class="num"><strong>${formatINR(report.financials.realizedRevenue)}</strong></td>
              <td>Invoiced sales from closed packets</td>
            </tr>
            <tr>
              <td>Less: Cost of Goods Sold (Procurement Cost)</td>
              <td class="num" style="color: #dc2626;">-${formatINR(report.financials.costOfGoodsSold)}</td>
              <td>Original cost basis of sold stones</td>
            </tr>
            <tr style="background: #ecfdf5;">
              <td><strong>Gross Trading Profit</strong></td>
              <td class="num" style="color: #059669;"><strong>${formatINR(report.financials.grossProfit)}</strong></td>
              <td><strong>${report.financials.grossMarginPercent}% Gross Trading Margin</strong></td>
            </tr>
            <tr>
              <td>Add: External Brokerage Commissions</td>
              <td class="num" style="color: #059669;">+${formatINR(report.financials.brokerageEarnings)}</td>
              <td>Non-inventory facilitated deals</td>
            </tr>
            <tr>
              <td>Less: Total Operating Expenses</td>
              <td class="num" style="color: #dc2626;">-${formatINR(report.financials.totalExpenses)}</td>
              <td>Certification, travel, office, logistics</td>
            </tr>
            <tr style="background: #f0fdf4; font-size: 12px; font-weight: 800;">
              <td><strong>NET OPERATING PROFIT</strong></td>
              <td class="num" style="color: #047857;"><strong>${formatINR(report.financials.netOperatingProfit)}</strong></td>
              <td><strong>Bottom Line Operating Net</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">2. Vault Inventory Breakdown by Gemstone Variety</div>
        <table>
          <thead>
            <tr>
              <th>Gemstone Variety</th>
              <th class="num">Packets</th>
              <th class="num">Total Carats</th>
              <th class="num">Cost Valuation</th>
              <th class="num">Asking Valuation</th>
              <th class="num">Potential Margin</th>
            </tr>
          </thead>
          <tbody>
            ${report.varietyBreakdown
              .map(
                (v) => `
              <tr>
                <td><strong>${v.variety}</strong></td>
                <td class="num">${v.packetsCount}</td>
                <td class="num">${v.carats} cts</td>
                <td class="num">${formatINR(v.costValuation)}</td>
                <td class="num">${formatINR(v.askingValuation)}</td>
                <td class="num" style="color: #059669; font-weight: 700;">+${formatINR(v.askingValuation - v.costValuation)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="section-title">3. Packet Status Distribution</div>
        <div style="display: flex; gap: 20px; font-size: 11px; margin-bottom: 15px;">
          <div style="border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 4px; flex: 1;">
            <strong>Vault In Stock:</strong> ${report.inventory.inStockPackets} Packets (${report.inventory.inStockCarats} cts) • ${formatINR(report.inventory.costValuation)}
          </div>
          <div style="border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 4px; flex: 1;">
            <strong>On Approval:</strong> ${report.inventory.onMemoPackets} Packets out on inspection
          </div>
          <div style="border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 4px; flex: 1;">
            <strong>Sold & Dispatched:</strong> ${report.inventory.soldPackets} Packets completed
          </div>
          <div style="border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 4px; flex: 1;">
            <strong>Multi-Stone Parcel Boxes:</strong> ${report.inventory.multiGemBoxesCount} Boxes containing mixed gems
          </div>
        </div>

        <div class="footer">
          <div>SHREEJI GEMS CRM — Confidential Business Evaluation & Valuation Audit</div>
          <div>Authorized Signature & Vault Seal: ___________________________</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Checks weekly backup schedule:
 * If 7 days have elapsed since last weekly backup (or never run),
 * automatically compiles and saves a weekly backup snapshot.
 */
export function checkAndRunAutomatedWeeklyBackup(): {
  triggered: boolean;
  historyItem?: BackupHistoryItem;
  message: string;
} {
  try {
    const lastTimestamp = localStorage.getItem(LAST_WEEKLY_BACKUP_KEY);
    const now = Date.now();

    if (!lastTimestamp || now - parseInt(lastTimestamp, 10) >= WEEK_MS) {
      // Trigger automatic weekly backup
      const { historyItem, filename } = createAndDownloadBackupNow(true);
      localStorage.setItem(LAST_WEEKLY_BACKUP_KEY, now.toString());
      return {
        triggered: true,
        historyItem,
        message: `Automated weekly backup saved (${filename})! Stored locally on computer.`,
      };
    }

    const nextDueDays = Math.ceil(
      (WEEK_MS - (now - parseInt(lastTimestamp, 10))) / (24 * 60 * 60 * 1000)
    );

    return {
      triggered: false,
      message: `Weekly backup is up to date. Next automatic backup due in ${nextDueDays} day(s).`,
    };
  } catch (err: any) {
    return {
      triggered: false,
      message: "Automated backup check error: " + err.message,
    };
  }
}

/**
 * Restores database from a given JSON payload string
 */
export function restoreDatabaseFromJson(jsonContent: string): {
  success: boolean;
  message: string;
} {
  return importLocalBackup(jsonContent);
}
