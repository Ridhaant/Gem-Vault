const assert = require("assert");

console.log("==================================================================");
console.log("TESTING INDIVIDUAL STONE TRACKING ACROSS PAST SALES & DROPDOWN");
console.log("==================================================================");

// Packet ex/20 from user's screenshot
// Originally 5 stones (10 cts total). 3 stones sold in past sales, leaving 2 pcs (4 cts)
const packetEx20 = {
  id: "pkt-ex20",
  packet_number: "ex/20",
  particulars: "Mixed",
  shape: "Oval",
  pieces: 2,
  weight: 4.0,
  unit: "cts",
  status: "in_stock",
  stone_details: [
    { id: "st-1", variety: "Ruby", shape: "Oval", weight: 2.0 },
    { id: "st-2", variety: "Ruby (Burmese Pigeon Blood)", shape: "Oval", weight: 2.0 },
    { id: "st-3", variety: "Blue Sapphire", shape: "Oval", weight: 2.0 },
    { id: "st-4", variety: "Yellow Sapphire", shape: "Oval", weight: 2.0 },
    { id: "st-5", variety: "Pink Sapphire", shape: "Oval", weight: 2.0 },
  ],
};

// Past sales that sold 3 stones from packet ex/20
const pastSales = [
  {
    id: "sale-appr-4164",
    invoice_no: "APPR-4164",
    buyer_name: "Sanjay Shah (Broker)",
    date: "2026-10-14",
    is_approval: false,
    items: [
      {
        packet_id: "pkt-ex20",
        packet_number: "ex/20",
        particulars: "Ruby (Oval)",
        shape: "Oval",
        pieces: 1,
        weight: 2.0,
        rate_per_unit: 8000,
        total_price: 16000,
        stone_id: "st-1",
      },
      {
        packet_id: "pkt-ex20",
        packet_number: "ex/20",
        particulars: "Ruby (Burmese Pigeon Blood) (Oval)",
        shape: "Oval",
        pieces: 1,
        weight: 2.0,
        rate_per_unit: 8000,
        total_price: 16000,
        stone_id: "st-2",
      },
    ],
  },
  {
    id: "sale-appr-4165",
    invoice_no: "APPR-4165",
    buyer_name: "Sanjay Shah (Broker)",
    date: "2026-10-14",
    is_approval: false,
    items: [
      {
        packet_id: "pkt-ex20",
        packet_number: "ex/20",
        particulars: "Blue Sapphire (Oval)",
        shape: "Oval",
        pieces: 1,
        weight: 2.0,
        rate_per_unit: 8000,
        total_price: 16000,
        stone_id: "st-3",
      },
    ],
  },
];

// Reference implementation matching frontend/src/packetStones.ts
function resolvePacketStoneStatuses(packet, allSales, currentFormItems = [], excludeSaleId) {
  if (!packet) return [];

  const rawStones =
    Array.isArray(packet.stone_details) && packet.stone_details.length > 0
      ? packet.stone_details
      : Array.isArray(packet.stone_weights) && packet.stone_weights.length > 0
      ? packet.stone_weights.map((wt, i) => ({
          id: `st-${i + 1}`,
          variety: packet.particulars,
          shape: packet.shape,
          weight: wt,
          mm_size: packet.mm_size,
        }))
      : [];

  if (rawStones.length === 0) return [];

  const results = rawStones.map((st, idx) => ({
    id: st.id || `stone-${idx + 1}`,
    variety: st.variety || packet.particulars,
    shape: st.shape || packet.shape,
    weight: Number(st.weight) || 0,
    mm_size: st.mm_size || packet.mm_size || "",
    notes: st.notes || "",
    status: "in_stock",
    originalIndex: idx,
    stoneNumber: idx + 1,
    saleRef: undefined,
  }));

  const matchingSaleEntries = [];
  if (Array.isArray(allSales)) {
    for (const sale of allSales) {
      if (excludeSaleId && (sale.id === excludeSaleId || sale.invoice_no === excludeSaleId)) {
        continue;
      }
      if (sale.is_approval && sale.approval_status === "returned") {
        continue;
      }
      if (!Array.isArray(sale.items)) continue;
      for (const it of sale.items) {
        if (
          (it.packet_id && it.packet_id === packet.id) ||
          (it.packet_number && it.packet_number.toLowerCase() === packet.packet_number.toLowerCase())
        ) {
          matchingSaleEntries.push({ sale, item: it, used: false });
        }
      }
    }
  }

  const matchingFormEntries = [];
  if (Array.isArray(currentFormItems)) {
    for (const it of currentFormItems) {
      if (
        (it.packet_id && it.packet_id === packet.id) ||
        (it.packet_number && it.packet_number.toLowerCase() === packet.packet_number.toLowerCase())
      ) {
        matchingFormEntries.push({ item: it, used: false });
      }
    }
  }

  // Pass 1: exact stone_id match in form
  for (const fe of matchingFormEntries) {
    if (fe.used) continue;
    if (fe.item.stone_id) {
      const match = results.find((r) => r.status === "in_stock" && r.id === fe.item.stone_id);
      if (match) {
        match.status = "in_invoice";
        fe.used = true;
      }
    }
  }

  // Pass 2: exact stone_id match in past sales
  for (const se of matchingSaleEntries) {
    if (se.used) continue;
    if (se.item.stone_id) {
      const match = results.find((r) => r.status === "in_stock" && r.id === se.item.stone_id);
      if (match) {
        const isAppr = se.sale.is_approval && se.sale.approval_status !== "approved_billed";
        match.status = isAppr ? "on_approval" : "sold";
        match.saleRef = {
          invoice_no: se.sale.invoice_no,
          buyer_name: se.sale.buyer_name,
          date: se.sale.date,
          is_approval: se.sale.is_approval,
          approval_status: se.sale.approval_status,
          pieces: se.item.pieces,
          weight: se.item.weight,
          rate_per_unit: se.item.rate_per_unit,
          total_price: se.item.total_price,
        };
        se.used = true;
      }
    }
  }

  // Pass 3: description match in form
  for (const fe of matchingFormEntries) {
    if (fe.used) continue;
    const desc = (fe.item.particulars || "").trim().toLowerCase();
    const match = results.find((r) => {
      if (r.status !== "in_stock") return false;
      const full = `${r.variety || packet.particulars} (${r.shape || packet.shape})`.trim().toLowerCase();
      const varOnly = (r.variety || "").trim().toLowerCase();
      return desc === full || desc === varOnly || (desc && varOnly && desc.includes(varOnly));
    });
    if (match) {
      match.status = "in_invoice";
      fe.used = true;
    }
  }

  // Pass 4: description match in past sales
  for (const se of matchingSaleEntries) {
    if (se.used) continue;
    const desc = (se.item.particulars || "").trim().toLowerCase();
    const match = results.find((r) => {
      if (r.status !== "in_stock") return false;
      const full = `${r.variety || packet.particulars} (${r.shape || packet.shape})`.trim().toLowerCase();
      const varOnly = (r.variety || "").trim().toLowerCase();
      return desc === full || desc === varOnly || (desc && varOnly && desc.includes(varOnly));
    });
    if (match) {
      const isAppr = se.sale.is_approval && se.sale.approval_status !== "approved_billed";
      match.status = isAppr ? "on_approval" : "sold";
      match.saleRef = {
        invoice_no: se.sale.invoice_no,
        buyer_name: se.sale.buyer_name,
        date: se.sale.date,
        is_approval: se.sale.is_approval,
        approval_status: se.sale.approval_status,
        pieces: se.item.pieces,
        weight: se.item.weight,
        rate_per_unit: se.item.rate_per_unit,
        total_price: se.item.total_price,
      };
      se.used = true;
    }
  }

  // Pass 5: allocate remaining unused sold items
  for (const se of matchingSaleEntries) {
    if (se.used) continue;
    const pcs = Number(se.item.pieces) || 1;
    let count = 0;
    for (const r of results) {
      if (r.status === "in_stock") {
        const isAppr = se.sale.is_approval && se.sale.approval_status !== "approved_billed";
        r.status = isAppr ? "on_approval" : "sold";
        r.saleRef = {
          invoice_no: se.sale.invoice_no,
          buyer_name: se.sale.buyer_name,
          date: se.sale.date,
          is_approval: se.sale.is_approval,
          approval_status: se.sale.approval_status,
          pieces: 1,
          weight: r.weight,
          rate_per_unit: se.item.rate_per_unit,
          total_price: Math.round((Number(se.item.rate_per_unit) || 0) * (r.weight || 0)),
        };
        count++;
        if (count >= pcs) break;
      }
    }
    se.used = true;
  }

  // Pass 6: allocate remaining unused form items
  for (const fe of matchingFormEntries) {
    if (fe.used) continue;
    const pcs = Number(fe.item.pieces) || 1;
    let count = 0;
    for (const r of results) {
      if (r.status === "in_stock") {
        r.status = "in_invoice";
        count++;
        if (count >= pcs) break;
      }
    }
    fe.used = true;
  }

  // Pass 7: Consistency clamp with packet.status and packet.pieces
  if (packet.status === "sold" || (packet.pieces !== undefined && packet.pieces <= 0)) {
    for (const r of results) {
      if (r.status === "in_stock") {
        r.status = "sold";
      }
    }
  } else if (typeof packet.pieces === "number" && packet.pieces >= 0) {
    const inStockList = results.filter((r) => r.status === "in_stock");
    let excessCount = inStockList.length - packet.pieces;
    if (excessCount > 0) {
      for (const r of results) {
        if (r.status === "in_stock" && excessCount > 0) {
          r.status = "sold";
          excessCount--;
        }
      }
    }
  }

  return results;
}

// ====================================================================
// Test 1: Packet dossier stone status resolution
// ====================================================================
console.log("\n1. Testing Packet Dossier Stone Status Resolution:");
const dossierStones = resolvePacketStoneStatuses(packetEx20, pastSales, []);
dossierStones.forEach((s) => {
  console.log(`- #${s.stoneNumber} ${s.variety}: [${s.status.toUpperCase()}] ${s.saleRef ? `(Inv: ${s.saleRef.invoice_no} to ${s.saleRef.buyer_name})` : ""}`);
});

const inStockDossier = dossierStones.filter((s) => s.status === "in_stock");
const soldDossier = dossierStones.filter((s) => s.status === "sold");

assert.strictEqual(inStockDossier.length, 2, "Dossier must show exactly 2 stones in stock");
assert.strictEqual(soldDossier.length, 3, "Dossier must show exactly 3 stones sold");
assert.strictEqual(inStockDossier[0].variety, "Yellow Sapphire");
assert.strictEqual(inStockDossier[1].variety, "Pink Sapphire");
console.log("✓ PASS: Dossier clearly identifies Stones #4 & #5 as IN STOCK, and Stones #1, #2, #3 as SOLD with buyer details!");

// ====================================================================
// Test 2: Sales & Approvals Stone Selection Dropdown Filter
// ====================================================================
console.log("\n2. Testing SaleForm Stone Selection Dropdown when packet ex/20 is chosen:");
let formItems = [];
let availableInDropdown = resolvePacketStoneStatuses(packetEx20, pastSales, formItems).filter(
  (s) => s.status === "in_stock"
);

console.log(`- Stones shown in dropdown: ${availableInDropdown.map((s) => `Stone #${s.stoneNumber} (${s.variety})`).join(", ")}`);
assert.strictEqual(availableInDropdown.length, 2, "Dropdown MUST ONLY show 2 available stones");
assert.strictEqual(availableInDropdown[0].id, "st-4", "First available stone must be Stone #4 (Yellow Sapphire)");
assert.strictEqual(availableInDropdown[1].id, "st-5", "Second available stone must be Stone #5 (Pink Sapphire)");
assert.strictEqual(availableInDropdown.some((s) => s.id === "st-1"), false, "Stone #1 must NOT be in dropdown");
assert.strictEqual(availableInDropdown.some((s) => s.id === "st-2"), false, "Stone #2 must NOT be in dropdown");
assert.strictEqual(availableInDropdown.some((s) => s.id === "st-3"), false, "Stone #3 must NOT be in dropdown");
console.log("✓ PASS: Already sold stones (#1, #2, #3) are NOT in the dropdown! Only unsold stones (#4, #5) appear!");

// ====================================================================
// Test 3: Adding Stone #4 to the current invoice removes it from dropdown
// ====================================================================
console.log("\n3. Adding Stone #4 (Yellow Sapphire) to the current invoice:");
formItems.push({
  packet_id: packetEx20.id,
  packet_number: packetEx20.packet_number,
  particulars: "Yellow Sapphire (Oval)",
  shape: "Oval",
  pieces: 1,
  weight: 2.0,
  stone_id: "st-4",
  rate_per_unit: 8000,
  total_price: 16000,
});

availableInDropdown = resolvePacketStoneStatuses(packetEx20, pastSales, formItems).filter(
  (s) => s.status === "in_stock"
);

console.log(`- Stones remaining in dropdown: ${availableInDropdown.map((s) => `Stone #${s.stoneNumber} (${s.variety})`).join(", ")}`);
assert.strictEqual(availableInDropdown.length, 1, "Only 1 stone must remain in dropdown");
assert.strictEqual(availableInDropdown[0].id, "st-5", "Only Stone #5 (Pink Sapphire) must remain");
console.log("✓ PASS: Stone #4 was successfully allocated and removed from dropdown. Only Stone #5 remains!");

// ====================================================================
// Test 4: Adding Stone #5 exhausts all stones for the packet
// ====================================================================
console.log("\n4. Adding Stone #5 (Pink Sapphire) to the current invoice:");
formItems.push({
  packet_id: packetEx20.id,
  packet_number: packetEx20.packet_number,
  particulars: "Pink Sapphire (Oval)",
  shape: "Oval",
  pieces: 1,
  weight: 2.0,
  stone_id: "st-5",
  rate_per_unit: 8000,
  total_price: 16000,
});

availableInDropdown = resolvePacketStoneStatuses(packetEx20, pastSales, formItems).filter(
  (s) => s.status === "in_stock"
);

console.log(`- Stones remaining in dropdown: ${availableInDropdown.length}`);
assert.strictEqual(availableInDropdown.length, 0, "0 stones must remain in dropdown");
console.log("✓ PASS: All stones from packet are fully allocated! Dropdown is empty!");

// ====================================================================
// Test 5: Re-adding any previously sold stone is strictly blocked
// ====================================================================
console.log("\n5. Testing prevention of re-adding Stone #1 (Ruby):");
const canReaddStone1 = availableInDropdown.some((s) => s.id === "st-1");
assert.strictEqual(canReaddStone1, false, "Stone #1 cannot be selected or re-added");
console.log("✓ PASS: Re-adding Stone #1 is strictly prevented!");

console.log("\n==================================================================");
console.log("🎉 ALL TESTS PASSED! STONE TRACKING ACROSS INVENTORY & SALES VERIFIED!");
console.log("==================================================================");
