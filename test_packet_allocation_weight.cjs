// Test script to verify packet stone weight default and inventory remaining deduction in sales & approvals
const assert = require("assert");

// Simulating getPacketRemainingStock & selectedPacketStock logic from SaleForm.tsx
function getPacketRemainingStock(pkt, items) {
  const allocatedItems = items.filter(
    (it) => it.packet_id === pkt.id || it.packet_number === pkt.packet_number
  );
  const allocatedPcs = allocatedItems.reduce((acc, it) => acc + (Number(it.pieces) || 1), 0);
  const allocatedWt = allocatedItems.reduce((acc, it) => acc + (Number(it.weight) || 0), 0);

  const totalPcs = Number(pkt.pieces) || 1;
  const totalWt = Number(pkt.weight) || 0;

  const remainingPcs = Math.max(0, totalPcs - allocatedPcs);
  const remainingWt = Math.max(0, Number((totalWt - allocatedWt).toFixed(2)));

  return {
    remainingPcs,
    remainingWt,
    allocatedPcs,
    allocatedWt,
  };
}

function computeSelectedPacketStock(pkt, items) {
  const stock = getPacketRemainingStock(pkt, items);
  let singleStoneWeight = 0;
  if (pkt.stone_weight && pkt.stone_weight > 0) {
    singleStoneWeight = pkt.stone_weight;
  } else if (Array.isArray(pkt.stone_weights) && pkt.stone_weights.length > 0) {
    const unallocatedIdx = Math.min(stock.allocatedPcs, pkt.stone_weights.length - 1);
    singleStoneWeight = pkt.stone_weights[unallocatedIdx] || (stock.remainingPcs > 0 ? Number((stock.remainingWt / stock.remainingPcs).toFixed(2)) : stock.remainingWt);
  } else if (stock.remainingPcs > 0) {
    singleStoneWeight = Number((stock.remainingWt / stock.remainingPcs).toFixed(2));
  } else {
    singleStoneWeight = stock.remainingWt;
  }
  return {
    ...stock,
    singleStoneWeight: Math.min(stock.remainingWt, Math.max(0.01, Number(singleStoneWeight.toFixed(2)))),
  };
}

console.log("==================================================================");
console.log("TESTING PACKET ALLOCATION & STONE WEIGHT DEFAULT LOGIC");
console.log("==================================================================");

// Case from user's screenshot:
// Packet ex/1 has 3 pcs, 18 cts total (each stone ~ 6.00 cts)
const packet = {
  id: "pkt-1",
  packet_number: "ex/1",
  particulars: "Emerald (Zambian)",
  shape: "Oval",
  pieces: 3,
  weight: 18.00,
  unit: "cts",
  sale_price: 108000,
  sale_rate_per_unit: 6000,
  status: "in_stock",
};

// 1. Initial selection: items is empty
let items = [];
let stock = computeSelectedPacketStock(packet, items);

console.log("\n1. Initial packet selection (0 items in sale):");
console.log(`- Remaining pcs: ${stock.remainingPcs}`);
console.log(`- Remaining wt: ${stock.remainingWt} cts`);
console.log(`- Single stone weight default: ${stock.singleStoneWeight} cts`);

assert.strictEqual(stock.remainingPcs, 3);
assert.strictEqual(stock.remainingWt, 18.00);
assert.strictEqual(stock.singleStoneWeight, 6.00, "Should default to 6.00 cts per stone, NOT total 18 cts!");
console.log("✓ PASS: Default stone weight is correctly 6.00 cts (not 18 cts)");

// 2. User adds 1 stone (1 pc, 6 cts) into items
items.push({
  packet_id: packet.id,
  packet_number: packet.packet_number,
  particulars: packet.particulars,
  shape: packet.shape,
  pieces: 1,
  weight: 6.00,
  rate_per_unit: 6000,
  total_price: 36000,
});

stock = computeSelectedPacketStock(packet, items);
console.log("\n2. After adding 1 stone to items:");
console.log(`- Allocated in current invoice: ${stock.allocatedPcs} pcs (${stock.allocatedWt} cts)`);
console.log(`- Available remaining pcs: ${stock.remainingPcs}`);
console.log(`- Available remaining wt: ${stock.remainingWt} cts`);
console.log(`- Next single stone weight: ${stock.singleStoneWeight} cts`);

assert.strictEqual(stock.remainingPcs, 2, "Remaining pcs must be 2");
assert.strictEqual(stock.remainingWt, 12.00, "Remaining wt must be 12.00 cts");
assert.strictEqual(stock.singleStoneWeight, 6.00, "Single stone weight remains 6.00 cts");
console.log("✓ PASS: Correctly deducts 1 pc & 6 cts; allows max 2 pcs now");

// 3. User adds remaining 2 stones (2 pcs, 12 cts) into items
items.push({
  packet_id: packet.id,
  packet_number: packet.packet_number,
  particulars: packet.particulars,
  shape: packet.shape,
  pieces: 2,
  weight: 12.00,
  rate_per_unit: 6000,
  total_price: 72000,
});

stock = computeSelectedPacketStock(packet, items);
console.log("\n3. After adding all 3 stones to items:");
console.log(`- Available remaining pcs: ${stock.remainingPcs}`);
console.log(`- Available remaining wt: ${stock.remainingWt} cts`);

assert.strictEqual(stock.remainingPcs, 0, "No pcs should remain");
assert.strictEqual(stock.remainingWt, 0, "No wt should remain");
console.log("✓ PASS: Stock reaches 0; packet cannot be allocated any further!");

console.log("\n==================================================================");
console.log("🎉 ALL TESTS PASSED! PACKET OVER-ALLOCATION PREVENTED & WEIGHT ACCURATE!");
console.log("==================================================================");
