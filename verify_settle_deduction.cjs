// Shreeji Gems - Approval Settlement & Returned Pieces Deduction Verification
const assert = require("assert");

function simulateSettleApproval(sale, packets, settlementItems, options) {
  let totalPiecesTaken = 0;
  let totalPiecesReturned = 0;
  const updatedItems = [];
  const returnedItems = [];
  const now = new Date().toISOString();

  for (const st of settlementItems) {
    totalPiecesTaken += st.pieces_taken;
    totalPiecesReturned += st.pieces_returned;

    const origItem = sale.items.find(
      (it) => it.packet_id === st.packet_id || it.packet_number === st.packet_number
    );

    const pIdx = packets.findIndex(
      (p) => (st.packet_id && p.id === st.packet_id) || p.packet_number.toLowerCase() === st.packet_number.toLowerCase()
    );

    const rate = st.rate_per_unit || (origItem ? origItem.rate_per_unit : 0);
    const lineTotal = st.pieces_taken > 0 ? Math.round(rate * st.weight_taken) : 0;
    const cost = origItem && (origItem.weight || 1) > 0 ? Math.round((origItem.cost_price / origItem.weight) * st.weight_taken) : 0;
    const gstRate = origItem?.gst_rate ?? 0.25;
    const gstAmt = Math.round(lineTotal * (gstRate / 100) * 100) / 100;
    const origWeight = origItem?.original_weight !== undefined ? origItem.original_weight : (origItem?.weight || (st.weight_taken + st.weight_returned));
    const origPieces = origItem?.original_pieces !== undefined ? origItem.original_pieces : (origItem?.pieces || (st.pieces_taken + st.pieces_returned));

    const itemRecord = {
      ...(origItem || {
        packet_id: st.packet_id,
        packet_number: st.packet_number,
        particulars: st.particulars || "Gemstone",
        shape: st.shape || "Oval",
        unit: "cts",
      }),
      pieces: st.pieces_taken,
      weight: st.weight_taken,
      rate_per_unit: rate,
      total_price: lineTotal,
      cost_price: cost,
      gst_rate: gstRate,
      gst_amount: gstAmt,
      original_weight: origWeight,
      original_pieces: origPieces,
      weight_taken: st.weight_taken,
      pieces_taken: st.pieces_taken,
      weight_returned: st.weight_returned,
      pieces_returned: st.pieces_returned,
      is_returned: st.pieces_taken === 0 && st.pieces_returned > 0,
    };

    if (st.pieces_taken > 0) {
      updatedItems.push(itemRecord);
    } else {
      returnedItems.push(itemRecord);
    }

    if (pIdx >= 0) {
      if (st.pieces_taken > 0 && st.pieces_returned === 0) {
        packets[pIdx].status = "sold";
        packets[pIdx].buyer_name = sale.buyer_name;
        packets[pIdx].pieces = 0;
        packets[pIdx].weight = 0;
      } else if (st.pieces_returned > 0 && st.pieces_taken === 0) {
        packets[pIdx].status = "in_stock";
        packets[pIdx].memo_party = "";
        packets[pIdx].is_approval = false;
        packets[pIdx].pieces = origPieces;
        packets[pIdx].weight = origWeight;
      } else if (st.pieces_taken > 0 && st.pieces_returned > 0) {
        packets[pIdx].status = "in_stock";
        packets[pIdx].memo_party = "";
        packets[pIdx].pieces = st.pieces_returned;
        packets[pIdx].weight = st.weight_returned;
      }
    }
  }

  const subtotal = totalPiecesTaken > 0 ? updatedItems.reduce((s, it) => s + it.total_price, 0) : 0;
  const totalTax = totalPiecesTaken > 0 ? updatedItems.reduce((s, it) => s + (it.gst_amount || 0), 0) : 0;
  const discount = Number(sale.discount || 0);
  const grandTotal = totalPiecesTaken > 0 ? Math.max(0, subtotal + totalTax - discount) : 0;
  const paid = Number(sale.paid_amount || 0);
  const balance = totalPiecesTaken > 0 ? Math.max(0, grandTotal - paid) : 0;
  const payStatus = balance <= 0 ? "cleared" : (paid > 0 ? "partial" : "unpaid");

  return {
    ...sale,
    items: updatedItems,
    returned_items: returnedItems,
    subtotal,
    tax_amount: totalTax,
    total: grandTotal,
    balance,
    payment_status: payStatus,
    approval_status: totalPiecesTaken > 0 ? "approved_billed" : "returned",
  };
}

console.log("------------------------------------------------------------------");
console.log("TEST 1: Partial settlement (3 pcs kept out of 5, 2 returned; 1 pkt fully returned)");
const initialSale = {
  id: "sale-001",
  buyer_name: "Kalyan Jewellers",
  is_approval: true,
  approval_status: "pending",
  discount: 0,
  paid_amount: 0,
  items: [
    { packet_id: "p1", packet_number: "PKT-1", particulars: "Ruby", pieces: 5, weight: 10.0, rate_per_unit: 5000, total_price: 50000, cost_price: 30000, gst_rate: 0.25 },
    { packet_id: "p2", packet_number: "PKT-2", particulars: "Emerald", pieces: 2, weight: 4.0, rate_per_unit: 10000, total_price: 40000, cost_price: 25000, gst_rate: 0.25 },
  ],
};

const initialPackets = [
  { id: "p1", packet_number: "PKT-1", pieces: 5, weight: 10.0, status: "on_approval" },
  { id: "p2", packet_number: "PKT-2", pieces: 2, weight: 4.0, status: "on_approval" },
];

const settled = simulateSettleApproval(initialSale, initialPackets, [
  { packet_id: "p1", packet_number: "PKT-1", pieces_taken: 3, weight_taken: 6.0, pieces_returned: 2, weight_returned: 4.0, rate_per_unit: 5000 },
  { packet_id: "p2", packet_number: "PKT-2", pieces_taken: 0, weight_taken: 0.0, pieces_returned: 2, weight_returned: 4.0, rate_per_unit: 10000 },
]);

assert.strictEqual(settled.items.length, 1, "Only taken packet should be in sale.items");
assert.strictEqual(settled.items[0].pieces, 3, "Pieces must be deducted to 3");
assert.strictEqual(settled.items[0].weight, 6.0, "Weight must be deducted to 6.0");
assert.strictEqual(settled.items[0].total_price, 30000, "Item total must be 30000");
assert.strictEqual(settled.returned_items.length, 1, "Returned packet must be in returned_items");
assert.strictEqual(settled.subtotal, 30000, "Subtotal must be 30000");
assert.strictEqual(settled.tax_amount, 75, "GST must be 75");
assert.strictEqual(settled.total, 30075, "Total must be 30075");
assert.strictEqual(settled.balance, 30075, "Balance must be 30075");
assert.strictEqual(settled.approval_status, "approved_billed");

assert.strictEqual(initialPackets[0].status, "in_stock", "Packet 1 must be in_stock with remaining pieces");
assert.strictEqual(initialPackets[0].pieces, 2, "Packet 1 remaining pieces must be 2");
assert.strictEqual(initialPackets[0].weight, 4.0, "Packet 1 remaining weight must be 4.0");
assert.strictEqual(initialPackets[1].status, "in_stock", "Packet 2 must be returned in_stock");
assert.strictEqual(initialPackets[1].pieces, 2, "Packet 2 pieces restored to 2");
assert.strictEqual(initialPackets[1].weight, 4.0, "Packet 2 weight restored to 4.0");
console.log("✓ TEST 1 PASSED: Returned pieces deducted, billable items updated, vault restored, totals & balance match!");

console.log("------------------------------------------------------------------");
console.log("TEST 2: 100% full return (All pieces returned back to vault)");
const allReturned = simulateSettleApproval(initialSale, initialPackets, [
  { packet_id: "p1", packet_number: "PKT-1", pieces_taken: 0, weight_taken: 0.0, pieces_returned: 5, weight_returned: 10.0, rate_per_unit: 5000 },
  { packet_id: "p2", packet_number: "PKT-2", pieces_taken: 0, weight_taken: 0.0, pieces_returned: 2, weight_returned: 4.0, rate_per_unit: 10000 },
]);

assert.strictEqual(allReturned.items.length, 0, "No items in billable sale.items");
assert.strictEqual(allReturned.returned_items.length, 2, "All 2 packets in returned_items");
assert.strictEqual(allReturned.subtotal, 0, "Subtotal must be 0");
assert.strictEqual(allReturned.tax_amount, 0, "Tax must be 0");
assert.strictEqual(allReturned.total, 0, "Total must be 0");
assert.strictEqual(allReturned.balance, 0, "Balance must be 0");
assert.strictEqual(allReturned.approval_status, "returned");
assert.strictEqual(allReturned.payment_status, "cleared");
console.log("✓ TEST 2 PASSED: 100% returns result in clean ₹0 balance and empty billable items!");

console.log("==================================================================");
console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
console.log("==================================================================");
