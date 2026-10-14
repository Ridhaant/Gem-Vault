import { formatINR, shortDate } from "./format";
import { COMPANY_DETAILS } from "./receipt";
import type { GemSale, GemPurchase, GemSaleItem } from "./types/gemstone";

function openPrintWindow(html: string) {
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

const COMMON_PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    margin: 0;
    padding: 24px;
    font-size: 12px;
    line-height: 1.4;
  }
  .header {
    border-bottom: 2px solid #0f4c5c;
    padding-bottom: 12px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .company-title {
    font-size: 20px;
    font-weight: 900;
    color: #0f4c5c;
    letter-spacing: 0.5px;
  }
  .company-sub {
    font-size: 11px;
    color: #475569;
    margin-top: 3px;
  }
  .doc-title {
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    text-align: right;
  }
  .doc-meta {
    font-size: 11px;
    color: #64748b;
    text-align: right;
    margin-top: 4px;
  }
  .section-block {
    margin-bottom: 24px;
    page-break-inside: avoid;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    overflow: hidden;
  }
  .section-header {
    background: #f1f5f9;
    padding: 10px 14px;
    border-bottom: 1px solid #cbd5e1;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .section-title {
    font-size: 14px;
    font-weight: 800;
    color: #0f4c5c;
  }
  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .table th {
    background: #f8fafc;
    color: #334155;
    font-weight: 700;
    text-align: left;
    padding: 7px 10px;
    border-bottom: 1px solid #cbd5e1;
  }
  .table td {
    padding: 7px 10px;
    border-bottom: 1px solid #e2e8f0;
    color: #0f172a;
  }
  .table tr:last-child td {
    border-bottom: none;
  }
  .table .num {
    text-align: right;
  }
  .subtotal-row td {
    background: #f8fafc;
    font-weight: 800;
    border-top: 2px solid #cbd5e1;
    border-bottom: none;
  }
  .grand-summary {
    background: #f8fafc;
    border: 2px solid #0f4c5c;
    border-radius: 6px;
    padding: 16px;
    margin-top: 20px;
    page-break-inside: avoid;
  }
  .grand-summary-title {
    font-size: 13px;
    font-weight: 800;
    color: #0f4c5c;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }
  .summary-card {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    padding: 10px;
    border-radius: 4px;
  }
  .summary-label {
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 700;
  }
  .summary-val {
    font-size: 16px;
    font-weight: 900;
    color: #0f172a;
    margin-top: 4px;
  }
  .tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
  }
  .tag-green { background: #dcfce7; color: #15803d; }
  .tag-blue { background: #dbeafe; color: #1e40af; }
  .tag-orange { background: #ffedd5; color: #c2410c; }
  .no-print {
    margin-bottom: 16px;
    text-align: center;
  }
  .print-btn {
    background: #0f4c5c;
    color: #fff;
    border: none;
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 700;
    border-radius: 6px;
    cursor: pointer;
  }
  @media print {
    .no-print { display: none !important; }
    body { padding: 0; }
  }
`;

/**
 * Print Buyer Approval & Memo Statement grouped buyer name-wise
 * Supports filtering company-wise and toggling between:
 * - "left": Active memos still left with buyers
 * - "taken_as_sale": Approved memos taken and counted as confirmed commercial sales
 * - "all": All approvals
 */
export function printBuyerApprovalStatement(
  sales: GemSale[],
  options?: { company?: string; buyer?: string; filterMode?: "left" | "taken_as_sale" | "all" }
) {
  const comp = options?.company && options.company !== "all" ? options.company : undefined;
  const buyer = options?.buyer && options.buyer !== "all" ? options.buyer.trim().toLowerCase() : undefined;
  const mode = options?.filterMode || "left";

  let filtered = sales;
  if (comp) {
    filtered = filtered.filter((s) => s.company_name === comp);
  }
  if (buyer) {
    filtered = filtered.filter((s) => (s.buyer_name || "").trim().toLowerCase() === buyer);
  }

  const approvalSales = filtered.filter((s) => {
    if (mode === "taken_as_sale") {
      return s.approval_status === "approved_billed" || Boolean(s.approval_billed_date);
    }
    if (mode === "left") {
      return s.is_approval && s.approval_status !== "approved_billed";
    }
    return s.is_approval || s.approval_status === "approved_billed";
  });

  const isTakenMode = mode === "taken_as_sale";
  const buyerTitlePrefix = options?.buyer && options.buyer !== "all" ? `${options.buyer} — ` : "";
  const docTitle = isTakenMode
    ? `${buyerTitlePrefix}Approvals Taken as Sale Statement`
    : `${buyerTitlePrefix}Buyer Approvals Statement (Approvals Left)`;
  const statusMeta = isTakenMode
    ? "Status: Confirmed & Counted as Commercial Sales"
    : "Status: Active Memos on Inspection (Left with Buyers)";

  // Group by buyer name
  const buyerGroups: Record<string, { buyer: string; city?: string; phone?: string; sales: GemSale[] }> = {};
  approvalSales.forEach((s) => {
    const key = (s.buyer_name || "Unassigned Buyer").trim();
    if (!buyerGroups[key]) {
      buyerGroups[key] = {
        buyer: key,
        city: s.buyer_city,
        phone: s.buyer_phone,
        sales: [],
      };
    }
    buyerGroups[key].sales.push(s);
  });

  const sortedBuyerKeys = Object.keys(buyerGroups).sort((a, b) => a.localeCompare(b));

  let totalMemos = 0;
  let totalStonesPieces = 0;
  let totalStonesWeight = 0;
  let totalMemoValue = 0;

  const buyerSectionsHtml = sortedBuyerKeys.map((key) => {
    const group = buyerGroups[key];
    let groupPcs = 0;
    let groupWeight = 0;
    let groupVal = 0;

    const rowsHtml = group.sales.flatMap((sale) => {
      totalMemos++;
      return (sale.items || []).map((it) => {
        const pcs = it.pieces || 1;
        const wt = it.weight || 0;
        const val = it.total_price || 0;

        groupPcs += pcs;
        groupWeight += wt;
        groupVal += val;

        totalStonesPieces += pcs;
        totalStonesWeight += wt;
        totalMemoValue += val;

        return `
          <tr>
            <td><strong style="color: #0f4c5c;">${sale.invoice_no}</strong></td>
            <td>${shortDate(sale.date)}</td>
            <td><strong>${it.packet_number}</strong></td>
            <td>${it.particulars || "Gemstone"}</td>
            <td>${it.shape || "—"}</td>
            <td class="num">${pcs}</td>
            <td class="num">${wt.toFixed(2)} ${it.unit || "cts"}</td>
            <td class="num">${formatINR(it.rate_per_unit || (wt ? Math.round(val / wt) : 0))}</td>
            <td class="num"><strong>${formatINR(val)}</strong></td>
          </tr>
        `;
      });
    }).join("");

    return `
      <div class="section-block">
        <div class="section-header">
          <div>
            <span class="section-title">👤 ${group.buyer}</span>
            ${group.city ? `<span style="color: #64748b; font-size: 11px; margin-left: 8px;">📍 ${group.city}</span>` : ""}
            ${group.phone ? `<span style="color: #64748b; font-size: 11px; margin-left: 8px;">📞 ${group.phone}</span>` : ""}
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #475569;">
            ${group.sales.length} ${isTakenMode ? "Billed Sale" : "Active Memo"}${group.sales.length > 1 ? "s" : ""}
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Voucher / Ref #</th>
              <th>Date</th>
              <th>Packet #</th>
              <th>Particulars</th>
              <th>Shape</th>
              <th class="num">Pieces</th>
              <th class="num">Weight</th>
              <th class="num">Rate / ct</th>
              <th class="num">${isTakenMode ? "Sale Amount" : "Memo Value"}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="subtotal-row">
              <td colspan="5" style="text-align: right;">Subtotal for ${group.buyer}:</td>
              <td class="num">${groupPcs} pcs</td>
              <td class="num">${groupWeight.toFixed(2)} cts</td>
              <td></td>
              <td class="num" style="color: #0f4c5c;">${formatINR(groupVal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${docTitle} — ${COMPANY_DETAILS.name}</title>
      <style>${COMMON_PRINT_STYLES}</style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Statement</button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">💎 ${comp || COMPANY_DETAILS.name}</div>
          <div class="company-sub">${COMPANY_DETAILS.address}</div>
          <div class="company-sub">GSTIN: ${COMPANY_DETAILS.gstin} · Contact: ${COMPANY_DETAILS.contact}</div>
        </div>
        <div>
          <div class="doc-title">${docTitle}</div>
          <div class="doc-meta">Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
          <div class="doc-meta">${statusMeta}</div>
          ${comp ? `<div class="doc-meta" style="color: #0f4c5c; font-weight: 700;">Company: ${comp}</div>` : ""}
        </div>
      </div>

      ${buyerSectionsHtml || `<div style="text-align: center; padding: 40px; color: #64748b;">No matching approval records found.</div>`}

      <div class="grand-summary">
        <div class="grand-summary-title">Statement Summary Totals</div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total Buyers</div>
            <div class="summary-val">${sortedBuyerKeys.length} Buyers</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Vouchers</div>
            <div class="summary-val">${totalMemos} Vouchers</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Stones ${isTakenMode ? "Sold" : "Out"}</div>
            <div class="summary-val">${totalStonesPieces} pcs (${totalStonesWeight.toFixed(2)} cts)</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total ${isTakenMode ? "Sales Revenue" : "Approval Valuation"}</div>
            <div class="summary-val" style="color: #0f4c5c;">${formatINR(totalMemoValue)}</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid;">
        <div style="border-top: 1px solid #94a3b8; width: 200px; text-align: center; font-size: 11px; padding-top: 6px;">
          Receiver's Signature & Date
        </div>
        <div style="border-top: 1px solid #94a3b8; width: 220px; text-align: center; font-size: 11px; padding-top: 6px;">
          For ${comp || COMPANY_DETAILS.name}<br>Authorized Signatory
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `;

  openPrintWindow(html);
}

/**
 * Print Supplier Purchase Statement grouped supplier name-wise
 */
export function printSupplierPurchaseStatement(purchases: GemPurchase[]) {
  // Group by supplier name
  const supplierGroups: Record<string, { supplier: string; city?: string; phone?: string; purchases: GemPurchase[] }> = {};
  purchases.forEach((p) => {
    const key = (p.supplier_name || "Unassigned Supplier").trim();
    if (!supplierGroups[key]) {
      supplierGroups[key] = {
        supplier: key,
        city: p.supplier_city,
        phone: p.supplier_phone,
        purchases: [],
      };
    }
    supplierGroups[key].purchases.push(p);
  });

  const sortedSupplierKeys = Object.keys(supplierGroups).sort((a, b) => a.localeCompare(b));

  let totalLots = 0;
  let grandTotalCost = 0;
  let grandPaid = 0;
  let grandBalance = 0;

  const supplierSectionsHtml = sortedSupplierKeys.map((key) => {
    const group = supplierGroups[key];
    let groupCost = 0;
    let groupPaid = 0;
    let groupBal = 0;

    const rowsHtml = group.purchases.map((pur) => {
      totalLots++;
      groupCost += pur.total_cost || 0;
      groupPaid += pur.paid_amount || 0;
      groupBal += pur.balance_payable || 0;

      grandTotalCost += pur.total_cost || 0;
      grandPaid += pur.paid_amount || 0;
      grandBalance += pur.balance_payable || 0;

      const pktsText = (pur.items || []).map((it) => `${it.packet_number} (${it.weight}ct)`).join(", ");
      const creditText = pur.credit_days ? `${pur.credit_days}d (${pur.due_date ? shortDate(pur.due_date) : ""})` : "Cash / Immediate";

      return `
        <tr>
          <td><strong style="color: #0f4c5c;">${pur.purchase_no}</strong></td>
          <td>${shortDate(pur.date)}</td>
          <td>${pur.lot_ref || "—"}</td>
          <td><span style="font-size: 10px;">${pktsText || "—"}</span></td>
          <td>${pur.broker_name ? `${pur.broker_name} (${pur.brokerage_type === "percent" ? `${pur.brokerage_rate}%` : `₹${pur.brokerage_amount}`})` : "—"}</td>
          <td>${creditText}</td>
          <td class="num"><strong>${formatINR(pur.total_cost)}</strong></td>
          <td class="num" style="color: #15803d;">${formatINR(pur.paid_amount)}</td>
          <td class="num" style="color: ${pur.balance_payable > 0 ? '#b91c1c' : '#64748b'}; font-weight: 700;">
            ${formatINR(pur.balance_payable)}
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="section-block">
        <div class="section-header">
          <div>
            <span class="section-title">🏢 ${group.supplier}</span>
            ${group.city ? `<span style="color: #64748b; font-size: 11px; margin-left: 8px;">📍 ${group.city}</span>` : ""}
            ${group.phone ? `<span style="color: #64748b; font-size: 11px; margin-left: 8px;">📞 ${group.phone}</span>` : ""}
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #475569;">
            ${group.purchases.length} Purchase Lot${group.purchases.length > 1 ? "s" : ""}
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Voucher #</th>
              <th>Date</th>
              <th>Lot Ref</th>
              <th>Packets Created</th>
              <th>Broker / Middleman</th>
              <th>Credit Terms</th>
              <th class="num">Procurement Cost</th>
              <th class="num">Paid</th>
              <th class="num">Balance Due</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="subtotal-row">
              <td colspan="6" style="text-align: right;">Subtotal for ${group.supplier}:</td>
              <td class="num" style="color: #0f4c5c;">${formatINR(groupCost)}</td>
              <td class="num" style="color: #15803d;">${formatINR(groupPaid)}</td>
              <td class="num" style="color: ${groupBal > 0 ? '#b91c1c' : '#64748b'};">${formatINR(groupBal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Supplier-Wise Procurement Statement — ${COMPANY_DETAILS.name}</title>
      <style>${COMMON_PRINT_STYLES}</style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Statement</button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">💎 ${COMPANY_DETAILS.name}</div>
          <div class="company-sub">${COMPANY_DETAILS.address}</div>
          <div class="company-sub">GSTIN: ${COMPANY_DETAILS.gstin} · Contact: ${COMPANY_DETAILS.contact}</div>
        </div>
        <div>
          <div class="doc-title">Supplier Purchases Statement</div>
          <div class="doc-meta">Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
          <div class="doc-meta">Grouping: Supplier / Mine Wise</div>
        </div>
      </div>

      ${supplierSectionsHtml || `<div style="text-align: center; padding: 40px; color: #64748b;">No purchase records found.</div>`}

      <div class="grand-summary">
        <div class="grand-summary-title">Overall Procurement & Payables Summary</div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total Suppliers</div>
            <div class="summary-val">${sortedSupplierKeys.length} Suppliers</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Procurement Lots</div>
            <div class="summary-val">${totalLots} Lots</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Procurement Cost</div>
            <div class="summary-val" style="color: #0f4c5c;">${formatINR(grandTotalCost)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Amount Paid</div>
            <div class="summary-val" style="color: #15803d;">${formatINR(grandPaid)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Balance Payable</div>
            <div class="summary-val" style="color: ${grandBalance > 0 ? '#b91c1c' : '#64748b'};">${formatINR(grandBalance)}</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid;">
        <div style="border-top: 1px solid #94a3b8; width: 200px; text-align: center; font-size: 11px; padding-top: 6px;">
          Accounts Verification
        </div>
        <div style="border-top: 1px solid #94a3b8; width: 220px; text-align: center; font-size: 11px; padding-top: 6px;">
          For ${COMPANY_DETAILS.name}<br>Authorized Signatory
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `;

  openPrintWindow(html);
}

/**
 * Print Purchase Register (All currently filtered purchases, or single supplier)
 */
export function printPurchaseRegister(purchases: GemPurchase[], filterLabel?: string, supplierName?: string) {
  let targetPurchases = purchases;
  if (supplierName && supplierName !== "all") {
    targetPurchases = targetPurchases.filter(
      (p) => (p.supplier_name || "").trim().toLowerCase() === supplierName.trim().toLowerCase()
    );
  }

  const totalCost = targetPurchases.reduce((s, p) => s + (p.total_cost || 0), 0);
  const totalPaid = targetPurchases.reduce((s, p) => s + (p.paid_amount || 0), 0);
  const totalBalance = targetPurchases.reduce((s, p) => s + (p.balance_payable || 0), 0);

  const isSupplierFocus = Boolean(supplierName && supplierName !== "all");

  const rowsHtml = targetPurchases.map((p) => {
    const pktsCount = p.items?.length || 0;
    const carats = (p.items || []).reduce((sum, it) => sum + (it.weight || 0), 0);
    return `
      <tr>
        <td><strong>${p.purchase_no}</strong></td>
        <td>${shortDate(p.date)}</td>
        <td><strong>${p.supplier_name}</strong>${p.supplier_city ? `<br><small style="color:#64748b;">${p.supplier_city}</small>` : ""}</td>
        <td>${p.lot_ref || "—"}</td>
        <td>${pktsCount} pkts (${carats.toFixed(2)} cts)</td>
        <td>${p.broker_name ? `${p.broker_name} (${p.brokerage_type === "percent" ? `${p.brokerage_rate}%` : `₹${p.brokerage_amount}`})` : "—"}</td>
        <td>${p.credit_days ? `${p.credit_days}d (${p.due_date ? shortDate(p.due_date) : ""})` : "Immediate"}</td>
        <td class="num"><strong>${formatINR(p.total_cost)}</strong></td>
        <td class="num" style="color: #15803d;">${formatINR(p.paid_amount)}</td>
        <td class="num" style="color: ${p.balance_payable > 0 ? '#b91c1c' : '#64748b'}; font-weight: 700;">${formatINR(p.balance_payable)}</td>
        <td style="text-align: center;">
          <span class="tag ${p.payment_status === "cleared" ? "tag-green" : p.payment_status === "partial" ? "tag-orange" : "tag-blue"}">
            ${p.payment_status.toUpperCase()}
          </span>
        </td>
      </tr>
    `;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${isSupplierFocus ? `${supplierName} — Purchase Register` : `Gemstone Procurement Register`} — ${COMPANY_DETAILS.name}</title>
      <style>${COMMON_PRINT_STYLES}</style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Register</button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">💎 ${COMPANY_DETAILS.name}</div>
          <div class="company-sub">${COMPANY_DETAILS.address}</div>
          <div class="company-sub">GSTIN: ${COMPANY_DETAILS.gstin} · Contact: ${COMPANY_DETAILS.contact}</div>
        </div>
        <div>
          <div class="doc-title">${isSupplierFocus ? "Supplier Procurement Register" : "Procurement & Intake Register"}</div>
          <div class="doc-meta">Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
          ${isSupplierFocus ? `<div class="doc-meta" style="color: #0f4c5c; font-weight: 800; font-size: 13px;">🏢 Supplier: ${supplierName}</div>` : ""}
          ${filterLabel ? `<div class="doc-meta">Filter: ${filterLabel}</div>` : ""}
        </div>
      </div>

      <table class="table" style="border: 1px solid #cbd5e1; border-radius: 6px;">
        <thead>
          <tr>
            <th>Voucher #</th>
            <th>Date</th>
            <th>Supplier</th>
            <th>Lot Ref</th>
            <th>Packets Created</th>
            <th>Middleman Broker</th>
            <th>Credit Terms</th>
            <th class="num">Total Cost</th>
            <th class="num">Paid</th>
            <th class="num">Balance Due</th>
            <th style="text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="11" style="text-align:center; padding: 20px; color:#64748b;">No purchase lots found${supplierName ? ` for supplier "${supplierName}"` : ""}.</td></tr>`}
          <tr class="subtotal-row">
            <td colspan="7" style="text-align: right;">Total (${targetPurchases.length} Lots):</td>
            <td class="num" style="color: #0f4c5c;">${formatINR(totalCost)}</td>
            <td class="num" style="color: #15803d;">${formatINR(totalPaid)}</td>
            <td class="num" style="color: ${totalBalance > 0 ? '#b91c1c' : '#64748b'};">${formatINR(totalBalance)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `;

  openPrintWindow(html);
}

/**
 * Print Individual Purchase Intake Voucher
 */
export function printPurchaseVoucher(purchase: GemPurchase) {
  const items = purchase.items || [];
  const totalWeight = items.reduce((sum, it) => sum + (it.weight || 0), 0);
  const totalPieces = items.reduce((sum, it) => sum + (it.pieces || 1), 0);

  const itemsHtml = items.map((it, idx) => {
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${it.packet_number}</strong></td>
        <td>${it.box_name || "Vault"}</td>
        <td><strong>${it.particulars}</strong></td>
        <td>${it.shape || "—"}</td>
        <td class="num">${it.pieces || 1}</td>
        <td class="num">${it.stone_weight ? `${it.stone_weight.toFixed(2)} ct/pc` : "—"}</td>
        <td class="num"><strong>${it.weight.toFixed(2)} ${it.unit || "cts"}</strong></td>
        <td class="num">${formatINR(it.purchase_rate_per_unit || (it.weight ? Math.round(it.cost_price / it.weight) : 0))}</td>
        <td class="num"><strong>${formatINR(it.cost_price)}</strong></td>
        <td class="num" style="color: #0f4c5c;">${formatINR(it.target_sale_price || 0)}</td>
      </tr>
    `;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Purchase Voucher ${purchase.purchase_no} — ${COMPANY_DETAILS.name}</title>
      <style>${COMMON_PRINT_STYLES}</style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Intake Voucher</button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">💎 ${COMPANY_DETAILS.name}</div>
          <div class="company-sub">${COMPANY_DETAILS.address}</div>
          <div class="company-sub">GSTIN: ${COMPANY_DETAILS.gstin} · Contact: ${COMPANY_DETAILS.contact}</div>
        </div>
        <div>
          <div class="doc-title">Procurement Intake Voucher</div>
          <div class="doc-meta" style="font-size: 14px; font-weight: 800; color: #0f4c5c;">${purchase.purchase_no}</div>
          <div class="doc-meta">Date: ${shortDate(purchase.date)}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Supplier Details</div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px;">${purchase.supplier_name}</div>
          ${purchase.supplier_city ? `<div style="font-size: 11px; color: #475569;">📍 ${purchase.supplier_city}</div>` : ""}
          ${purchase.supplier_phone ? `<div style="font-size: 11px; color: #475569;">📞 ${purchase.supplier_phone}</div>` : ""}
          ${purchase.lot_ref ? `<div style="font-size: 11px; color: #0f4c5c; margin-top: 4px;"><strong>Lot Reference:</strong> ${purchase.lot_ref}</div>` : ""}
        </div>

        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Terms & Middleman Broker</div>
          <div style="font-size: 12px; margin-top: 4px;"><strong>Credit Term:</strong> ${purchase.credit_days ? `${purchase.credit_days} Days (Due: ${shortDate(purchase.due_date || "")})` : "Immediate / Cash"}</div>
          <div style="font-size: 12px;"><strong>Payment Mode:</strong> ${purchase.payment_mode || "Bank Wire"}</div>
          ${purchase.broker_name ? `
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-size: 12px;">
              <strong>Middleman Broker:</strong> ${purchase.broker_name} ${purchase.broker_phone ? `(${purchase.broker_phone})` : ""}<br>
              Brokerage: ${purchase.brokerage_type === "percent" ? `${purchase.brokerage_rate}%` : `Manual`} = <strong>${formatINR(purchase.brokerage_amount || 0)}</strong>
              ${purchase.brokerage_paid ? '<span style="color: #15803d; font-weight: 700;"> (Paid)</span>' : '<span style="color: #b91c1c; font-weight: 700;"> (Unpaid)</span>'}
            </div>
          ` : '<div style="font-size: 11px; color: #64748b; margin-top: 4px;">Direct Procurement (No Broker)</div>'}
        </div>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-title">💎 Gemstone Packets Intake to Vault (${items.length} Packets)</span>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Packet #</th>
              <th>Vault Box</th>
              <th>Particulars</th>
              <th>Shape</th>
              <th class="num">Pieces</th>
              <th class="num">Weight / Pc</th>
              <th class="num">Total Weight</th>
              <th class="num">Cost Rate / ct</th>
              <th class="num">Total Cost Price</th>
              <th class="num">Target Ask Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr class="subtotal-row">
              <td colspan="5" style="text-align: right;">Total Intake:</td>
              <td class="num">${totalPieces} pcs</td>
              <td></td>
              <td class="num">${totalWeight.toFixed(2)} cts</td>
              <td></td>
              <td class="num" style="color: #0f4c5c;">${formatINR(purchase.total_cost)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <table style="width: 320px; font-size: 12px; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #475569;">Total Lot Procurement Cost:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; font-size: 14px;">${formatINR(purchase.total_cost)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #15803d;">Paid to Supplier:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #15803d;">${formatINR(purchase.paid_amount)}</td>
          </tr>
          <tr style="border-top: 2px solid #0f4c5c;">
            <td style="padding: 8px 0; font-weight: 800; color: ${purchase.balance_payable > 0 ? '#b91c1c' : '#475569'}; font-size: 14px;">Balance Payable:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 900; color: ${purchase.balance_payable > 0 ? '#b91c1c' : '#475569'}; font-size: 15px;">${formatINR(purchase.balance_payable)}</td>
          </tr>
        </table>
      </div>

      ${purchase.notes ? `
        <div style="margin-top: 16px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px;">
          <strong>Intake Notes:</strong> ${purchase.notes}
        </div>
      ` : ""}

      <div style="margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid;">
        <div style="border-top: 1px solid #94a3b8; width: 200px; text-align: center; font-size: 11px; padding-top: 6px;">
          Supplier's Acknowledgment
        </div>
        <div style="border-top: 1px solid #94a3b8; width: 220px; text-align: center; font-size: 11px; padding-top: 6px;">
          For ${COMPANY_DETAILS.name}<br>Authorized Signatory
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `;

  openPrintWindow(html);
}

/**
 * Print Filtered Commercial Sales & Approvals Report
 */
export function printFilteredSalesReport(sales: GemSale[], filterInfo?: { viewSection?: string; company?: string; dateRange?: string; status?: string }) {
  const totalSubtotal = sales.reduce((s, x) => s + (x.subtotal || 0), 0);
  const totalTax = sales.reduce((s, x) => s + (x.tax_amount || 0), 0);
  const totalGrand = sales.reduce((s, x) => s + (x.total || 0), 0);
  const totalBalance = sales.reduce((s, x) => s + (x.balance || 0), 0);

  const rowsHtml = sales.map((sale) => {
    const isOutsideStock = sale.sell_type === "outside_stock";
    const isApproval = sale.is_approval && sale.approval_status !== "approved_billed";
    const itemsText = (sale.items || []).map((it) => `${it.packet_number} (${it.particulars}, ${it.weight}ct)`).join(", ");

    return `
      <tr>
        <td>
          <span class="tag ${isOutsideStock ? "tag-orange" : "tag-green"}">
            ${isOutsideStock ? "Outside" : "Own"}
          </span>
          <br><strong>${sale.invoice_no}</strong>
        </td>
        <td>${shortDate(sale.date)}</td>
        <td>${sale.company_name || "—"}</td>
        <td><strong>${sale.buyer_name}</strong>${sale.buyer_city ? `<br><small style="color:#64748b;">${sale.buyer_city}</small>` : ""}</td>
        <td style="max-width: 200px; font-size: 10px;">${itemsText}</td>
        <td class="num">${formatINR(sale.subtotal)}</td>
        <td class="num" style="color: #64748b;">${formatINR(sale.tax_amount || 0)}</td>
        <td class="num"><strong>${formatINR(sale.total)}</strong></td>
        <td class="num" style="color: ${sale.balance > 0 ? '#b91c1c' : '#64748b'}; font-weight: 700;">${formatINR(sale.balance)}</td>
        <td style="text-align: center;">
          <span class="tag ${isApproval ? "tag-blue" : sale.payment_status === "cleared" ? "tag-green" : "tag-orange"}">
            ${isApproval ? "APPROVAL" : sale.payment_status.toUpperCase()}
          </span>
        </td>
      </tr>
    `;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Sales & Approvals Register — ${COMPANY_DETAILS.name}</title>
      <style>${COMMON_PRINT_STYLES}</style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Report</button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">💎 ${COMPANY_DETAILS.name}</div>
          <div class="company-sub">${COMPANY_DETAILS.address}</div>
          <div class="company-sub">GSTIN: ${COMPANY_DETAILS.gstin} · Contact: ${COMPANY_DETAILS.contact}</div>
        </div>
        <div>
          <div class="doc-title">Commercial Sales & Approvals Register</div>
          <div class="doc-meta">Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
          ${filterInfo?.viewSection ? `<div class="doc-meta">Section: ${filterInfo.viewSection}</div>` : ""}
          ${filterInfo?.company ? `<div class="doc-meta">Company: ${filterInfo.company}</div>` : ""}
          ${filterInfo?.dateRange ? `<div class="doc-meta">Date Range: ${filterInfo.dateRange}</div>` : ""}
        </div>
      </div>

      <table class="table" style="border: 1px solid #cbd5e1; border-radius: 6px;">
        <thead>
          <tr>
            <th>Ref / Tag</th>
            <th>Date</th>
            <th>Company</th>
            <th>Buyer Name</th>
            <th>Stones / Items</th>
            <th class="num">Taxable</th>
            <th class="num">GST</th>
            <th class="num">Grand Total</th>
            <th class="num">Balance Due</th>
            <th style="text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="subtotal-row">
            <td colspan="5" style="text-align: right;">Total (${sales.length} Deals):</td>
            <td class="num">${formatINR(totalSubtotal)}</td>
            <td class="num">${formatINR(totalTax)}</td>
            <td class="num" style="color: #0f4c5c;">${formatINR(totalGrand)}</td>
            <td class="num" style="color: ${totalBalance > 0 ? '#b91c1c' : '#64748b'};">${formatINR(totalBalance)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `;

  openPrintWindow(html);
}

/**
 * Print Buyer-Wise Sales & Approval Ledger Report
 * Replicates the exact 10-column tabular layout from physical gemstone trade ledgers (e.g. "JINESHBHAI"):
 * Header: Centered BUYER NAME
 * Columns: DATE | NO | PARTICULARS | PCS | WEIGHT | RET | TAKEN | RATE | RS | PKT
 */
export function printBuyerWiseLedgerReport(
  sales: GemSale[],
  buyerName?: string,
  companyName?: string
) {
  let targetSales = sales;
  if (companyName && companyName !== "all") {
    targetSales = targetSales.filter((s) => s.company_name === companyName);
  }

  function fmtDate(iso?: string | null): string {
    if (!iso) return "";
    try {
      const parts = iso.slice(0, 10).split("-");
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const mon = String(d.getMonth() + 1).padStart(2, "0");
        const yr = d.getFullYear();
        return `${day}-${mon}-${yr}`;
      }
      return iso;
    } catch {
      return iso || "";
    }
  }

  // Determine which buyers to render
  const isSingleBuyer = Boolean(buyerName && buyerName !== "all");
  let buyerList: string[] = [];
  if (isSingleBuyer && buyerName) {
    buyerList = [buyerName.trim()];
  } else {
    const set = new Set<string>();
    targetSales.forEach((s) => {
      if (s.buyer_name && s.buyer_name.trim()) set.add(s.buyer_name.trim());
    });
    buyerList = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (buyerList.length === 0) buyerList = ["Unassigned Buyer"];
  }

  let grandTotalPcs = 0;
  let grandTotalWeight = 0;
  let grandTotalRet = 0;
  let grandTotalTaken = 0;
  let grandTotalRs = 0;

  const sectionsHtml = buyerList.map((curBuyer, bIdx) => {
    const cleanBuyer = curBuyer.trim().toLowerCase();
    const curSales = targetSales
      .filter((s) => (s.buyer_name || "").trim().toLowerCase() === cleanBuyer)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    let bPcs = 0;
    let bWeight = 0;
    let bRet = 0;
    let bTaken = 0;
    let bRs = 0;
    const rowsHtml: string[] = [];
    let lineCounter = 1;

    curSales.forEach((sale) => {
      const saleDateStr = fmtDate(sale.date);

      const ledgerItems: GemSaleItem[] = [...(sale.items || []), ...(sale.returned_items || [])];

      ledgerItems.forEach((it, itIdx) => {
        const isRet = Boolean(it.is_returned || (sale.approval_status === "returned" && !it.weight_taken));
        const pcs = it.pieces_taken !== undefined 
          ? (isRet ? (it.original_pieces || it.pieces_returned || it.pieces || 1) : it.pieces_taken)
          : (it.pieces || 1);
        const originalWt = it.original_weight !== undefined 
          ? it.original_weight 
          : ((it.weight_taken || 0) + (it.weight_returned || 0) || it.weight || 0);
        const wtRet = it.weight_returned !== undefined 
          ? it.weight_returned 
          : (isRet ? originalWt : 0);
        const wtTaken = it.weight_taken !== undefined 
          ? it.weight_taken 
          : (isRet ? 0 : (originalWt - wtRet > 0 ? Number((originalWt - wtRet).toFixed(2)) : originalWt));
        const rate = it.rate_per_unit || (originalWt > 0 ? Math.round((it.total_price || 0) / originalWt) : 0);
        const rs = isRet ? 0 : (it.total_price || Math.round(wtTaken * rate));

        bPcs += pcs;
        bWeight += originalWt;
        bRet += wtRet;
        bTaken += wtTaken;
        bRs += rs;

        const dateDisplay = itIdx === 0 ? saleDateStr : "";
        const noDisplay = it.slip_no !== undefined ? it.slip_no : (itIdx + 1);
        const retBadge = wtRet > 0 || isRet ? `<span style="color: #c026d3; font-weight: 800;">RET</span>` : "";

        rowsHtml.push(`
          <tr>
            <td style="text-align: center; white-space: nowrap; font-weight: 700;">${dateDisplay}</td>
            <td style="text-align: center;">${noDisplay}</td>
            <td style="text-align: left; font-weight: 700; text-transform: uppercase;">${it.particulars || "Gemstone"}</td>
            <td class="num">${pcs}</td>
            <td class="num">${originalWt > 0 ? originalWt.toFixed(2) : "—"}</td>
            <td class="num">${wtRet > 0 ? wtRet.toFixed(2) : "0"}</td>
            <td class="num font-bold">${wtTaken > 0 ? wtTaken.toFixed(2) : (wtRet > 0 ? "0" : originalWt.toFixed(2))}</td>
            <td class="num">${rate > 0 ? rate : "—"}</td>
            <td class="num font-bold">${rs > 0 ? rs : "0"}</td>
            <td style="text-align: center; font-weight: 700; text-transform: uppercase;">${it.packet_number || "—"}</td>
          </tr>
        `);
        lineCounter++;
      });
    });

    grandTotalPcs += bPcs;
    grandTotalWeight += bWeight;
    grandTotalRet += bRet;
    grandTotalTaken += bTaken;
    grandTotalRs += bRs;

    return `
      <div class="buyer-section ${bIdx > 0 ? "page-break" : ""}" style="margin-bottom: 28px;">
        <div class="buyer-title">${curBuyer.toUpperCase()}</div>
        ${companyName && companyName !== "all" ? `<div style="text-align: center; font-size: 11px; color: #475569; margin-bottom: 8px; font-weight: 700;">${companyName}</div>` : ""}

        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 85px;">DATE</th>
              <th style="width: 35px;">NO</th>
              <th>PARTICULARS</th>
              <th style="width: 45px;">PCS</th>
              <th style="width: 60px;">WEIGHT</th>
              <th style="width: 50px;">RET</th>
              <th style="width: 60px;">TAKEN</th>
              <th style="width: 65px;">RATE</th>
              <th style="width: 75px;">RS</th>
              <th style="width: 85px;">PKT</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.join("") || `<tr><td colspan="10" style="text-align: center; padding: 20px; color: #64748b;">No transactions recorded for ${curBuyer}.</td></tr>`}
            <tr class="total-row">
              <td colspan="3" style="text-align: right; font-weight: 900;">TOTAL:</td>
              <td class="num">${bPcs}</td>
              <td class="num">${bWeight.toFixed(2)}</td>
              <td class="num">${bRet.toFixed(2)}</td>
              <td class="num">${bTaken.toFixed(2)}</td>
              <td></td>
              <td class="num" style="font-size: 13px; font-weight: 900;">${bRs.toLocaleString("en-IN")}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join("");

  const docTitle = isSingleBuyer && buyerName ? `${buyerName.toUpperCase()} — Ledger Statement` : "Buyer-Wise Sales & Approvals Ledger";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${docTitle}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 16px;
          font-size: 11px;
        }
        .buyer-title {
          text-align: center;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 8px;
          color: #000;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          border: 1.5px solid #000;
          font-size: 11px;
        }
        .report-table th, .report-table td {
          border: 1px solid #000;
          padding: 5px 6px;
          line-height: 1.25;
        }
        .report-table th {
          background: #e2e8f0;
          font-weight: 900;
          text-align: center;
          letter-spacing: 0.5px;
          font-size: 11px;
        }
        .report-table .num {
          text-align: right;
        }
        .report-table .font-bold {
          font-weight: 800;
        }
        .total-row td {
          border-top: 2px solid #000;
          font-weight: 900;
          background: #f8fafc;
        }
        .no-print {
          text-align: center;
          margin-bottom: 14px;
        }
        .print-btn {
          background: #0f4c5c;
          color: #fff;
          border: none;
          padding: 7px 20px;
          font-size: 12px;
          font-weight: 700;
          border-radius: 4px;
          cursor: pointer;
        }
        @media print {
          .no-print { display: none !important; }
          body { padding: 0; }
          .page-break { page-break-before: always; }
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Statement</button>
      </div>

      ${sectionsHtml}

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `;

  openPrintWindow(html);
}

