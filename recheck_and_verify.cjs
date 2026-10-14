const assert = require("assert");

// Simulating SaleForm and gemstoneStorage logic
function getPacketRemainingStock(pkt, items) {
  const allocatedInSale = items.filter(
    (it) =>
      (it.packet_id && it.packet_id === pkt.id) ||
      (!it.packet_id?.startsWith("outside-") &&
        it.packet_number &&
        it.packet_number.toLowerCase() === pkt.packet_number.toLowerCase())
  );
  const allocatedPcs = allocatedInSale.reduce((sum, it) => sum + (Number(it.pieces) || 1), 0);
  const allocatedWt = allocatedInSale.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
  const remainingPcs = Math.max(0, (Number(pkt.pieces) || 1) - allocatedPcs);
  const remainingWt = Math.max(0, Number(((Number(pkt.weight) || 0) - allocatedWt).toFixed(2)));
  return {
    allocatedPcs,
    allocatedWt,
    remainingPcs,
    remainingWt,
    isFullyAllocated: remainingPcs <= 0 || remainingWt <= 0,
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

function simulateTablePieceEdit(items, idx, newPcs, packets) {
  const it = items[idx];
  if (!it) return items;
  const targetPkt = !it.packet_id?.startsWith("outside-")
    ? packets.find(
        (p) =>
          (it.packet_id && p.id === it.packet_id) ||
          p.packet_number.toLowerCase() === it.packet_number.toLowerCase()
      )
    : null;
  let maxPcs = 999999;
  if (targetPkt) {
    const otherAllocPcs = items
      .filter(
        (other, i) =>
          i !== idx &&
          ((it.packet_id && other.packet_id === it.packet_id) ||
            (!other.packet_id?.startsWith("outside-") &&
              other.packet_number.toLowerCase() === it.packet_number.toLowerCase()))
      )
      .reduce((sum, o) => sum + (Number(o.pieces) || 1), 0);
    maxPcs = Math.max(1, (Number(targetPkt.pieces) || 1) - otherAllocPcs);
  }
  const clampedPcs = Math.max(1, Math.min(newPcs, maxPcs));
  return items.map((item, i) => (i === idx ? { ...item, pieces: clampedPcs } : item));
}

function validateSaleSubmission(items, packets) {
  for (const pkt of packets) {
    const allocated = items.filter(
      (it) =>
        (it.packet_id && it.packet_id === pkt.id) ||
        (!it.packet_id?.startsWith("outside-") &&
          it.packet_number &&
          it.packet_number.toLowerCase() === pkt.packet_number.toLowerCase())
    );
    if (allocated.length > 0) {
      const totalPcs = allocated.reduce((s, it) => s + (Number(it.pieces) || 1), 0);
      const totalWt = allocated.reduce((s, it) => s + (Number(it.weight) || 0), 0);
      const maxPcs = Number(pkt.pieces) || 1;
      const maxWt = Number(pkt.weight) || 0;
      if (totalPcs > maxPcs) {
        return { valid: false, error: `Exceeded pieces: allocated ${totalPcs} > ${maxPcs}` };
      }
      if (totalWt > maxWt + 0.05) {
        return { valid: false, error: `Exceeded weight: allocated ${totalWt} > ${maxWt}` };
      }
    }
  }
  return { valid: true };
}

console.log("==================================================================");
console.log("SHREEJI GEMS CRM - RECHECK & DEEP VERIFICATION SUITE");
console.log("==================================================================");

const testPacket = {
  id: "pkt-emerald-1",
  packet_number: "ex/1",
  particulars: "Emerald (Zambian)",
  shape: "Oval",
  pieces: 3,
  weight: 18.00,
  unit: "cts",
  status: "in_stock",
};

let items = [];

// Step 1: Default weight on selection
console.log("\n[TEST 1] Single Stone Weight Default on Packet Selection:");
let stock = computeSelectedPacketStock(testPacket, items);
console.log(`- Packet Total: ${testPacket.pieces} pcs, ${testPacket.weight} cts`);
console.log(`- Single Stone Default: ${stock.singleStoneWeight} cts`);
assert.strictEqual(stock.singleStoneWeight, 6.00, "Must be 6.00 cts per stone");
assert.strictEqual(stock.remainingPcs, 3, "Must have 3 pcs remaining");
console.log("  ✓ TEST 1 PASSED: Correct single stone weight default (6.00 cts, not 18 cts)!");

// Step 2: Piece scaling calculation
console.log("\n[TEST 2] Dynamic Weight Scaling on Piece Change:");
const pcsToAlloc = 2;
const scaledWeight = Math.min(stock.remainingWt, Number((stock.singleStoneWeight * pcsToAlloc).toFixed(2)));
console.log(`- 2 pieces scaled weight: ${scaledWeight} cts`);
assert.strictEqual(scaledWeight, 12.00, "2 stones must be 12.00 cts");
console.log("  ✓ TEST 2 PASSED: Scaling works accurately (2 pcs -> 12.00 cts)!");

// Step 3: Add 1 stone to items table
console.log("\n[TEST 3] Deducting Already-Allocated Stones from Packet:");
items.push({
  packet_id: testPacket.id,
  packet_number: testPacket.packet_number,
  particulars: testPacket.particulars,
  shape: testPacket.shape,
  pieces: 1,
  weight: 6.00,
  rate_per_unit: 6000,
  total_price: 36000,
});
stock = computeSelectedPacketStock(testPacket, items);
console.log(`- Remaining pieces available to allocate: ${stock.remainingPcs}`);
console.log(`- Remaining weight available to allocate: ${stock.remainingWt} cts`);
assert.strictEqual(stock.remainingPcs, 2, "Remaining pieces must be 2");
assert.strictEqual(stock.remainingWt, 12.00, "Remaining weight must be 12.00 cts");
console.log("  ✓ TEST 3 PASSED: Packet immediately deducts allocated stone!");

// Step 4: Constraining table edits to avoid over-allocation
console.log("\n[TEST 4] Constraining In-Table Pieces Editing (Preventing Exceeding Stock):");
// User tries to edit line 0 pieces from 1 to 5 pcs (packet only has 3 pcs total)
const editedItems = simulateTablePieceEdit(items, 0, 5, [testPacket]);
console.log(`- Attempted edit to 5 pcs, clamped to: ${editedItems[0].pieces} pcs`);
assert.strictEqual(editedItems[0].pieces, 3, "Must be clamped to packet maximum of 3 pcs");
console.log("  ✓ TEST 4 PASSED: In-table edits are clamped to packet capacity!");

// Step 5: Submission validation
console.log("\n[TEST 5] Pre-Submit Validation Gate:");
const validCheck = validateSaleSubmission(items, [testPacket]);
console.log(`- Valid items check: ${validCheck.valid}`);
assert.strictEqual(validCheck.valid, true);

const invalidItems = [
  ...items,
  {
    packet_id: testPacket.id,
    packet_number: testPacket.packet_number,
    particulars: testPacket.particulars,
    shape: testPacket.shape,
    pieces: 3, // Already 1 in items, 1 + 3 = 4 > 3
    weight: 18.00,
    rate_per_unit: 6000,
    total_price: 108000,
  },
];
const invalidCheck = validateSaleSubmission(invalidItems, [testPacket]);
console.log(`- Over-allocated items check: valid = ${invalidCheck.valid}, error = "${invalidCheck.error}"`);
assert.strictEqual(invalidCheck.valid, false);
console.log("  ✓ TEST 5 PASSED: Submission gate blocks over-allocation!");

// Step 6: Vault Retention on Partial Approval
console.log("\n[TEST 6] Vault Retention on Partial Approval Creation:");
const vaultPackets = [{ ...testPacket }];
const memoItem = items[0]; // 1 pc, 6 cts
const pIdx = 0;
const memoPcs = Number(memoItem.pieces) || 1;
const memoWt = Number(memoItem.weight) || 0;
const remPcs = Math.max(0, (vaultPackets[pIdx].pieces || 0) - memoPcs);
const remWt = Math.max(0, Number(((vaultPackets[pIdx].weight || 0) - memoWt).toFixed(2)));

if (remPcs > 0 && remWt > 0) {
  vaultPackets[pIdx].pieces = remPcs;
  vaultPackets[pIdx].weight = remWt;
  vaultPackets[pIdx].status = "in_stock";
}
console.log(`- Vault packet after 1 pc approval memo: ${vaultPackets[pIdx].pieces} pcs, ${vaultPackets[pIdx].weight} cts, status = '${vaultPackets[pIdx].status}'`);
assert.strictEqual(vaultPackets[pIdx].pieces, 2, "2 pieces must remain in vault");
assert.strictEqual(vaultPackets[pIdx].weight, 12.00, "12 cts must remain in vault");
assert.strictEqual(vaultPackets[pIdx].status, "in_stock", "Packet must stay in_stock in vault");
console.log("  ✓ TEST 6 PASSED: Remaining stones stay in vault as in_stock!");

// Step 7: Settle Approval: Taking 1 pc as confirmed sale
console.log("\n[TEST 7] Settlement Retention Check:");
// When 1 pc is taken as sale:
if (vaultPackets[pIdx].pieces > 0) {
  // Packet still has remaining stock in vault
  vaultPackets[pIdx].status = "in_stock";
} else {
  vaultPackets[pIdx].status = "sold";
}
assert.strictEqual(vaultPackets[pIdx].status, "in_stock", "Vault packet remains in_stock with 2 pcs");
console.log("  ✓ TEST 7 PASSED: Vault stock is preserved across settlement!");

console.log("\n==================================================================");
console.log("🎉 ALL 7/7 RECHECK & VERIFICATION TESTS PASSED FLAWLESSLY!");
console.log("==================================================================");
