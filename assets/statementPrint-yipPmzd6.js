import{i as e,n as t}from"./format-Dum9MWd4.js";var n={name:`SHREEJI GEMS`,addressLine1:`SUITE 14, BOURSE TOWER`,addressLine2:`OPAL & EMERALD ROW, BHARAT DIAMOND BOURSE`,addressLine3:`BKC, BANDRA EAST, MUMBAI, MAHARASHTRA 400051`,address:`SUITE 14, BOURSE TOWER, OPAL & EMERALD ROW, BHARAT DIAMOND BOURSE, BKC, BANDRA EAST, MUMBAI 400051`,gstin:`27AAACG1148H1Z8`,stateName:`Maharashtra`,stateCode:`27`,contact:`+91 98200 12345, +91 98200 67890`,email:`contact@shreejigems.com`,pan:`AACCG1145H`,bankName:`HDFC BANK LTD — BULLION & DIAMOND BRANCH`,accountNo:`50200084930219`,bankAccount:`50200084930219`,ifsc:`HDFC0000060`,bankIfsc:`HDFC0000060`};function r(e){let t=window.open(``,`_blank`);t&&(t.document.write(e),t.document.close())}var i=`
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
`;function a(a,o){let s=o?.company&&o.company!==`all`?o.company:void 0,c=o?.buyer&&o.buyer!==`all`?o.buyer.trim().toLowerCase():void 0,l=o?.filterMode||`left`,u=a;s&&(u=u.filter(e=>e.company_name===s)),c&&(u=u.filter(e=>(e.buyer_name||``).trim().toLowerCase()===c));let d=u.filter(e=>l===`taken_as_sale`?e.approval_status===`approved_billed`||!!e.approval_billed_date:l===`left`?e.is_approval&&e.approval_status!==`approved_billed`:e.is_approval||e.approval_status===`approved_billed`),f=l===`taken_as_sale`,p=o?.buyer&&o.buyer!==`all`?`${o.buyer} — `:``,m=f?`${p}Approvals Taken as Sale Statement`:`${p}Buyer Approvals Statement (Approvals Left)`,h=f?`Status: Confirmed & Counted as Commercial Sales`:`Status: Active Memos on Inspection (Left with Buyers)`,g={};d.forEach(e=>{let t=(e.buyer_name||`Unassigned Buyer`).trim();g[t]||(g[t]={buyer:t,city:e.buyer_city,phone:e.buyer_phone,sales:[]}),g[t].sales.push(e)});let _=Object.keys(g).sort((e,t)=>e.localeCompare(t)),v=0,y=0,b=0,x=0,S=_.map(n=>{let r=g[n],i=0,a=0,o=0,s=r.sales.flatMap(n=>(v++,(n.items||[]).map(r=>{let s=r.pieces||1,c=r.weight||0,l=r.total_price||0;return i+=s,a+=c,o+=l,y+=s,b+=c,x+=l,`
          <tr>
            <td><strong style="color: #0f4c5c;">${n.invoice_no}</strong></td>
            <td>${e(n.date)}</td>
            <td><strong>${r.packet_number}</strong></td>
            <td>${r.particulars||`Gemstone`}</td>
            <td>${r.shape||`—`}</td>
            <td class="num">${s}</td>
            <td class="num">${c.toFixed(2)} ${r.unit||`cts`}</td>
            <td class="num">${t(r.rate_per_unit||(c?Math.round(l/c):0))}</td>
            <td class="num"><strong>${t(l)}</strong></td>
          </tr>
        `}))).join(``);return`
      <div class="section-block">
        <div class="section-header">
          <div>
            <span class="section-title">👤 ${r.buyer}</span>
            ${r.city?`<span style="color: #64748b; font-size: 11px; margin-left: 8px;">📍 ${r.city}</span>`:``}
            ${r.phone?`<span style="color: #64748b; font-size: 11px; margin-left: 8px;">📞 ${r.phone}</span>`:``}
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #475569;">
            ${r.sales.length} ${f?`Billed Sale`:`Active Memo`}${r.sales.length>1?`s`:``}
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
              <th class="num">${f?`Sale Amount`:`Memo Value`}</th>
            </tr>
          </thead>
          <tbody>
            ${s}
            <tr class="subtotal-row">
              <td colspan="5" style="text-align: right;">Subtotal for ${r.buyer}:</td>
              <td class="num">${i} pcs</td>
              <td class="num">${a.toFixed(2)} cts</td>
              <td></td>
              <td class="num" style="color: #0f4c5c;">${t(o)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `}).join(``);r(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${m} — ${n.name}</title>
      <style>${i}</style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Statement</button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">💎 ${s||n.name}</div>
          <div class="company-sub">${n.address}</div>
          <div class="company-sub">GSTIN: ${n.gstin} · Contact: ${n.contact}</div>
        </div>
        <div>
          <div class="doc-title">${m}</div>
          <div class="doc-meta">Generated: ${new Date().toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`})}</div>
          <div class="doc-meta">${h}</div>
          ${s?`<div class="doc-meta" style="color: #0f4c5c; font-weight: 700;">Company: ${s}</div>`:``}
        </div>
      </div>

      ${S||`<div style="text-align: center; padding: 40px; color: #64748b;">No matching approval records found.</div>`}

      <div class="grand-summary">
        <div class="grand-summary-title">Statement Summary Totals</div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total Buyers</div>
            <div class="summary-val">${_.length} Buyers</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Vouchers</div>
            <div class="summary-val">${v} Vouchers</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Stones ${f?`Sold`:`Out`}</div>
            <div class="summary-val">${y} pcs (${b.toFixed(2)} cts)</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total ${f?`Sales Revenue`:`Approval Valuation`}</div>
            <div class="summary-val" style="color: #0f4c5c;">${t(x)}</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid;">
        <div style="border-top: 1px solid #94a3b8; width: 200px; text-align: center; font-size: 11px; padding-top: 6px;">
          Receiver's Signature & Date
        </div>
        <div style="border-top: 1px solid #94a3b8; width: 220px; text-align: center; font-size: 11px; padding-top: 6px;">
          For ${s||n.name}<br>Authorized Signatory
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      <\/script>
    </body>
    </html>
  `)}function o(a){let o={};a.forEach(e=>{let t=(e.supplier_name||`Unassigned Supplier`).trim();o[t]||(o[t]={supplier:t,city:e.supplier_city,phone:e.supplier_phone,purchases:[]}),o[t].purchases.push(e)});let s=Object.keys(o).sort((e,t)=>e.localeCompare(t)),c=0,l=0,u=0,d=0,f=s.map(n=>{let r=o[n],i=0,a=0,s=0,f=r.purchases.map(n=>{c++,i+=n.total_cost||0,a+=n.paid_amount||0,s+=n.balance_payable||0,l+=n.total_cost||0,u+=n.paid_amount||0,d+=n.balance_payable||0;let r=(n.items||[]).map(e=>`${e.packet_number} (${e.weight}ct)`).join(`, `),o=n.credit_days?`${n.credit_days}d (${n.due_date?e(n.due_date):``})`:`Cash / Immediate`;return`
        <tr>
          <td><strong style="color: #0f4c5c;">${n.purchase_no}</strong></td>
          <td>${e(n.date)}</td>
          <td>${n.lot_ref||`—`}</td>
          <td><span style="font-size: 10px;">${r||`—`}</span></td>
          <td>${n.broker_name?`${n.broker_name} (${n.brokerage_type===`percent`?`${n.brokerage_rate}%`:`₹${n.brokerage_amount}`})`:`—`}</td>
          <td>${o}</td>
          <td class="num"><strong>${t(n.total_cost)}</strong></td>
          <td class="num" style="color: #15803d;">${t(n.paid_amount)}</td>
          <td class="num" style="color: ${n.balance_payable>0?`#b91c1c`:`#64748b`}; font-weight: 700;">
            ${t(n.balance_payable)}
          </td>
        </tr>
      `}).join(``);return`
      <div class="section-block">
        <div class="section-header">
          <div>
            <span class="section-title">🏢 ${r.supplier}</span>
            ${r.city?`<span style="color: #64748b; font-size: 11px; margin-left: 8px;">📍 ${r.city}</span>`:``}
            ${r.phone?`<span style="color: #64748b; font-size: 11px; margin-left: 8px;">📞 ${r.phone}</span>`:``}
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #475569;">
            ${r.purchases.length} Purchase Lot${r.purchases.length>1?`s`:``}
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
            ${f}
            <tr class="subtotal-row">
              <td colspan="6" style="text-align: right;">Subtotal for ${r.supplier}:</td>
              <td class="num" style="color: #0f4c5c;">${t(i)}</td>
              <td class="num" style="color: #15803d;">${t(a)}</td>
              <td class="num" style="color: ${s>0?`#b91c1c`:`#64748b`};">${t(s)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `}).join(``);r(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Supplier-Wise Procurement Statement — ${n.name}</title>
      <style>${i}</style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Statement</button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">💎 ${n.name}</div>
          <div class="company-sub">${n.address}</div>
          <div class="company-sub">GSTIN: ${n.gstin} · Contact: ${n.contact}</div>
        </div>
        <div>
          <div class="doc-title">Supplier Purchases Statement</div>
          <div class="doc-meta">Generated: ${new Date().toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`})}</div>
          <div class="doc-meta">Grouping: Supplier / Mine Wise</div>
        </div>
      </div>

      ${f||`<div style="text-align: center; padding: 40px; color: #64748b;">No purchase records found.</div>`}

      <div class="grand-summary">
        <div class="grand-summary-title">Overall Procurement & Payables Summary</div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total Suppliers</div>
            <div class="summary-val">${s.length} Suppliers</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Procurement Lots</div>
            <div class="summary-val">${c} Lots</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Procurement Cost</div>
            <div class="summary-val" style="color: #0f4c5c;">${t(l)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Amount Paid</div>
            <div class="summary-val" style="color: #15803d;">${t(u)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Balance Payable</div>
            <div class="summary-val" style="color: ${d>0?`#b91c1c`:`#64748b`};">${t(d)}</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid;">
        <div style="border-top: 1px solid #94a3b8; width: 200px; text-align: center; font-size: 11px; padding-top: 6px;">
          Accounts Verification
        </div>
        <div style="border-top: 1px solid #94a3b8; width: 220px; text-align: center; font-size: 11px; padding-top: 6px;">
          For ${n.name}<br>Authorized Signatory
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      <\/script>
    </body>
    </html>
  `)}function s(a,o,s){let c=a;s&&s!==`all`&&(c=c.filter(e=>(e.supplier_name||``).trim().toLowerCase()===s.trim().toLowerCase()));let l=c.reduce((e,t)=>e+(t.total_cost||0),0),u=c.reduce((e,t)=>e+(t.paid_amount||0),0),d=c.reduce((e,t)=>e+(t.balance_payable||0),0),f=!!(s&&s!==`all`),p=c.map(n=>{let r=n.items?.length||0,i=(n.items||[]).reduce((e,t)=>e+(t.weight||0),0);return`
      <tr>
        <td><strong>${n.purchase_no}</strong></td>
        <td>${e(n.date)}</td>
        <td><strong>${n.supplier_name}</strong>${n.supplier_city?`<br><small style="color:#64748b;">${n.supplier_city}</small>`:``}</td>
        <td>${n.lot_ref||`—`}</td>
        <td>${r} pkts (${i.toFixed(2)} cts)</td>
        <td>${n.broker_name?`${n.broker_name} (${n.brokerage_type===`percent`?`${n.brokerage_rate}%`:`₹${n.brokerage_amount}`})`:`—`}</td>
        <td>${n.credit_days?`${n.credit_days}d (${n.due_date?e(n.due_date):``})`:`Immediate`}</td>
        <td class="num"><strong>${t(n.total_cost)}</strong></td>
        <td class="num" style="color: #15803d;">${t(n.paid_amount)}</td>
        <td class="num" style="color: ${n.balance_payable>0?`#b91c1c`:`#64748b`}; font-weight: 700;">${t(n.balance_payable)}</td>
        <td style="text-align: center;">
          <span class="tag ${n.payment_status===`cleared`?`tag-green`:n.payment_status===`partial`?`tag-orange`:`tag-blue`}">
            ${n.payment_status.toUpperCase()}
          </span>
        </td>
      </tr>
    `}).join(``);r(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${f?`${s} — Purchase Register`:`Gemstone Procurement Register`} — ${n.name}</title>
      <style>${i}</style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Register</button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">💎 ${n.name}</div>
          <div class="company-sub">${n.address}</div>
          <div class="company-sub">GSTIN: ${n.gstin} · Contact: ${n.contact}</div>
        </div>
        <div>
          <div class="doc-title">${f?`Supplier Procurement Register`:`Procurement & Intake Register`}</div>
          <div class="doc-meta">Generated: ${new Date().toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`})}</div>
          ${f?`<div class="doc-meta" style="color: #0f4c5c; font-weight: 800; font-size: 13px;">🏢 Supplier: ${s}</div>`:``}
          ${o?`<div class="doc-meta">Filter: ${o}</div>`:``}
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
          ${p||`<tr><td colspan="11" style="text-align:center; padding: 20px; color:#64748b;">No purchase lots found${s?` for supplier "${s}"`:``}.</td></tr>`}
          <tr class="subtotal-row">
            <td colspan="7" style="text-align: right;">Total (${c.length} Lots):</td>
            <td class="num" style="color: #0f4c5c;">${t(l)}</td>
            <td class="num" style="color: #15803d;">${t(u)}</td>
            <td class="num" style="color: ${d>0?`#b91c1c`:`#64748b`};">${t(d)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      <\/script>
    </body>
    </html>
  `)}function c(a){let o=a.items||[],s=o.reduce((e,t)=>e+(t.weight||0),0),c=o.reduce((e,t)=>e+(t.pieces||1),0),l=o.map((e,n)=>`
      <tr>
        <td>${n+1}</td>
        <td><strong>${e.packet_number}</strong></td>
        <td>${e.box_name||`Vault`}</td>
        <td><strong>${e.particulars}</strong></td>
        <td>${e.shape||`—`}</td>
        <td class="num">${e.pieces||1}</td>
        <td class="num">${e.stone_weight?`${e.stone_weight.toFixed(2)} ct/pc`:`—`}</td>
        <td class="num"><strong>${e.weight.toFixed(2)} ${e.unit||`cts`}</strong></td>
        <td class="num">${t(e.purchase_rate_per_unit||(e.weight?Math.round(e.cost_price/e.weight):0))}</td>
        <td class="num"><strong>${t(e.cost_price)}</strong></td>
        <td class="num" style="color: #0f4c5c;">${t(e.target_sale_price||0)}</td>
      </tr>
    `).join(``);r(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Purchase Voucher ${a.purchase_no} — ${n.name}</title>
      <style>${i}</style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Intake Voucher</button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">💎 ${n.name}</div>
          <div class="company-sub">${n.address}</div>
          <div class="company-sub">GSTIN: ${n.gstin} · Contact: ${n.contact}</div>
        </div>
        <div>
          <div class="doc-title">Procurement Intake Voucher</div>
          <div class="doc-meta" style="font-size: 14px; font-weight: 800; color: #0f4c5c;">${a.purchase_no}</div>
          <div class="doc-meta">Date: ${e(a.date)}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Supplier Details</div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px;">${a.supplier_name}</div>
          ${a.supplier_city?`<div style="font-size: 11px; color: #475569;">📍 ${a.supplier_city}</div>`:``}
          ${a.supplier_phone?`<div style="font-size: 11px; color: #475569;">📞 ${a.supplier_phone}</div>`:``}
          ${a.lot_ref?`<div style="font-size: 11px; color: #0f4c5c; margin-top: 4px;"><strong>Lot Reference:</strong> ${a.lot_ref}</div>`:``}
        </div>

        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Terms & Middleman Broker</div>
          <div style="font-size: 12px; margin-top: 4px;"><strong>Credit Term:</strong> ${a.credit_days?`${a.credit_days} Days (Due: ${e(a.due_date||``)})`:`Immediate / Cash`}</div>
          <div style="font-size: 12px;"><strong>Payment Mode:</strong> ${a.payment_mode||`Bank Wire`}</div>
          ${a.broker_name?`
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-size: 12px;">
              <strong>Middleman Broker:</strong> ${a.broker_name} ${a.broker_phone?`(${a.broker_phone})`:``}<br>
              Brokerage: ${a.brokerage_type===`percent`?`${a.brokerage_rate}%`:`Manual`} = <strong>${t(a.brokerage_amount||0)}</strong>
              ${a.brokerage_paid?`<span style="color: #15803d; font-weight: 700;"> (Paid)</span>`:`<span style="color: #b91c1c; font-weight: 700;"> (Unpaid)</span>`}
            </div>
          `:`<div style="font-size: 11px; color: #64748b; margin-top: 4px;">Direct Procurement (No Broker)</div>`}
        </div>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-title">💎 Gemstone Packets Intake to Vault (${o.length} Packets)</span>
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
            ${l}
            <tr class="subtotal-row">
              <td colspan="5" style="text-align: right;">Total Intake:</td>
              <td class="num">${c} pcs</td>
              <td></td>
              <td class="num">${s.toFixed(2)} cts</td>
              <td></td>
              <td class="num" style="color: #0f4c5c;">${t(a.total_cost)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <table style="width: 320px; font-size: 12px; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #475569;">Total Lot Procurement Cost:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; font-size: 14px;">${t(a.total_cost)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #15803d;">Paid to Supplier:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #15803d;">${t(a.paid_amount)}</td>
          </tr>
          <tr style="border-top: 2px solid #0f4c5c;">
            <td style="padding: 8px 0; font-weight: 800; color: ${a.balance_payable>0?`#b91c1c`:`#475569`}; font-size: 14px;">Balance Payable:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 900; color: ${a.balance_payable>0?`#b91c1c`:`#475569`}; font-size: 15px;">${t(a.balance_payable)}</td>
          </tr>
        </table>
      </div>

      ${a.notes?`
        <div style="margin-top: 16px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px;">
          <strong>Intake Notes:</strong> ${a.notes}
        </div>
      `:``}

      <div style="margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid;">
        <div style="border-top: 1px solid #94a3b8; width: 200px; text-align: center; font-size: 11px; padding-top: 6px;">
          Supplier's Acknowledgment
        </div>
        <div style="border-top: 1px solid #94a3b8; width: 220px; text-align: center; font-size: 11px; padding-top: 6px;">
          For ${n.name}<br>Authorized Signatory
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      <\/script>
    </body>
    </html>
  `)}function l(a,o){let s=a.reduce((e,t)=>e+(t.subtotal||0),0),c=a.reduce((e,t)=>e+(t.tax_amount||0),0),l=a.reduce((e,t)=>e+(t.total||0),0),u=a.reduce((e,t)=>e+(t.balance||0),0),d=a.map(n=>{let r=n.sell_type===`outside_stock`,i=n.is_approval&&n.approval_status!==`approved_billed`,a=(n.items||[]).map(e=>`${e.packet_number} (${e.particulars}, ${e.weight}ct)`).join(`, `);return`
      <tr>
        <td>
          <span class="tag ${r?`tag-orange`:`tag-green`}">
            ${r?`Outside`:`Own`}
          </span>
          <br><strong>${n.invoice_no}</strong>
        </td>
        <td>${e(n.date)}</td>
        <td>${n.company_name||`—`}</td>
        <td><strong>${n.buyer_name}</strong>${n.buyer_city?`<br><small style="color:#64748b;">${n.buyer_city}</small>`:``}</td>
        <td style="max-width: 200px; font-size: 10px;">${a}</td>
        <td class="num">${t(n.subtotal)}</td>
        <td class="num" style="color: #64748b;">${t(n.tax_amount||0)}</td>
        <td class="num"><strong>${t(n.total)}</strong></td>
        <td class="num" style="color: ${n.balance>0?`#b91c1c`:`#64748b`}; font-weight: 700;">${t(n.balance)}</td>
        <td style="text-align: center;">
          <span class="tag ${i?`tag-blue`:n.payment_status===`cleared`?`tag-green`:`tag-orange`}">
            ${i?`APPROVAL`:n.payment_status.toUpperCase()}
          </span>
        </td>
      </tr>
    `}).join(``);r(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Sales & Approvals Register — ${n.name}</title>
      <style>${i}</style>
    </head>
    <body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print Report</button>
      </div>

      <div class="header">
        <div>
          <div class="company-title">💎 ${n.name}</div>
          <div class="company-sub">${n.address}</div>
          <div class="company-sub">GSTIN: ${n.gstin} · Contact: ${n.contact}</div>
        </div>
        <div>
          <div class="doc-title">Commercial Sales & Approvals Register</div>
          <div class="doc-meta">Generated: ${new Date().toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`})}</div>
          ${o?.viewSection?`<div class="doc-meta">Section: ${o.viewSection}</div>`:``}
          ${o?.company?`<div class="doc-meta">Company: ${o.company}</div>`:``}
          ${o?.dateRange?`<div class="doc-meta">Date Range: ${o.dateRange}</div>`:``}
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
          ${d}
          <tr class="subtotal-row">
            <td colspan="5" style="text-align: right;">Total (${a.length} Deals):</td>
            <td class="num">${t(s)}</td>
            <td class="num">${t(c)}</td>
            <td class="num" style="color: #0f4c5c;">${t(l)}</td>
            <td class="num" style="color: ${u>0?`#b91c1c`:`#64748b`};">${t(u)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      <\/script>
    </body>
    </html>
  `)}function u(e,t,n){let i=e;n&&n!==`all`&&(i=i.filter(e=>e.company_name===n));function a(e){if(!e)return``;try{let t=e.slice(0,10).split(`-`);if(t.length===3)return`${t[2]}-${t[1]}-${t[0]}`;let n=new Date(e);return isNaN(n.getTime())?e:`${String(n.getDate()).padStart(2,`0`)}-${String(n.getMonth()+1).padStart(2,`0`)}-${n.getFullYear()}`}catch{return e||``}}let o=!!(t&&t!==`all`),s=[];if(o&&t)s=[t.trim()];else{let e=new Set;i.forEach(t=>{t.buyer_name&&t.buyer_name.trim()&&e.add(t.buyer_name.trim())}),s=Array.from(e).sort((e,t)=>e.localeCompare(t)),s.length===0&&(s=[`Unassigned Buyer`])}let c=0,l=0,u=0,d=0,f=0,p=s.map((e,t)=>{let r=e.trim().toLowerCase(),o=i.filter(e=>(e.buyer_name||``).trim().toLowerCase()===r).sort((e,t)=>(e.date||``).localeCompare(t.date||``)),s=0,p=0,m=0,h=0,g=0,_=[],v=1;return o.forEach(e=>{let t=a(e.date);[...e.items||[],...e.returned_items||[]].forEach((n,r)=>{let i=!!(n.is_returned||e.approval_status===`returned`&&!n.weight_taken),a=n.pieces_taken===void 0?n.pieces||1:i?n.original_pieces||n.pieces_returned||n.pieces||1:n.pieces_taken,o=n.original_weight===void 0?(n.weight_taken||0)+(n.weight_returned||0)||n.weight||0:n.original_weight,c=n.weight_returned===void 0?i?o:0:n.weight_returned,l=n.weight_taken===void 0?i?0:o-c>0?Number((o-c).toFixed(2)):o:n.weight_taken,u=n.rate_per_unit||(o>0?Math.round((n.total_price||0)/o):0),d=i?0:n.total_price||Math.round(l*u);s+=a,p+=o,m+=c,h+=l,g+=d;let f=r===0?t:``,y=n.slip_no===void 0?r+1:n.slip_no;_.push(`
          <tr>
            <td style="text-align: center; white-space: nowrap; font-weight: 700;">${f}</td>
            <td style="text-align: center;">${y}</td>
            <td style="text-align: left; font-weight: 700; text-transform: uppercase;">${n.particulars||`Gemstone`}</td>
            <td class="num">${a}</td>
            <td class="num">${o>0?o.toFixed(2):`—`}</td>
            <td class="num">${c>0?c.toFixed(2):`0`}</td>
            <td class="num font-bold">${l>0?l.toFixed(2):c>0?`0`:o.toFixed(2)}</td>
            <td class="num">${u>0?u:`—`}</td>
            <td class="num font-bold">${d>0?d:`0`}</td>
            <td style="text-align: center; font-weight: 700; text-transform: uppercase;">${n.packet_number||`—`}</td>
          </tr>
        `),v++})}),c+=s,l+=p,u+=m,d+=h,f+=g,`
      <div class="buyer-section ${t>0?`page-break`:``}" style="margin-bottom: 28px;">
        <div class="buyer-title">${e.toUpperCase()}</div>
        ${n&&n!==`all`?`<div style="text-align: center; font-size: 11px; color: #475569; margin-bottom: 8px; font-weight: 700;">${n}</div>`:``}

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
            ${_.join(``)||`<tr><td colspan="10" style="text-align: center; padding: 20px; color: #64748b;">No transactions recorded for ${e}.</td></tr>`}
            <tr class="total-row">
              <td colspan="3" style="text-align: right; font-weight: 900;">TOTAL:</td>
              <td class="num">${s}</td>
              <td class="num">${p.toFixed(2)}</td>
              <td class="num">${m.toFixed(2)}</td>
              <td class="num">${h.toFixed(2)}</td>
              <td></td>
              <td class="num" style="font-size: 13px; font-weight: 900;">${g.toLocaleString(`en-IN`)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    `}).join(``);r(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${o&&t?`${t.toUpperCase()} — Ledger Statement`:`Buyer-Wise Sales & Approvals Ledger`}</title>
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

      ${p}

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      <\/script>
    </body>
    </html>
  `)}export{c as a,s as i,u as n,o,l as r,a as t};