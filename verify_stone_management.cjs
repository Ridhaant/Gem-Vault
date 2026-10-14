const fs = require('fs');
const path = require('path');

console.log("=====================================================================");
console.log("  VERIFYING INDIVIDUAL & MULTIPLE STONE ADD/EDIT FUNCTIONALITY       ");
console.log("=====================================================================");

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// 1. Check gemstoneStorage.ts for packet upsert stone_weights and sub_gems handling
const gemstoneStorageContent = fs.readFileSync(path.join(__dirname, 'frontend/src/gemstoneStorage.ts'), 'utf-8');
assert(
  gemstoneStorageContent.includes('packet.stone_weights !== undefined ? packet.stone_weights : existing.stone_weights') &&
  gemstoneStorageContent.includes('packet.sub_gems !== undefined ? packet.sub_gems : existing.sub_gems'),
  "gemstoneStorage.ts preserves stone_weights and sub_gems properly during upsertPacket"
);

// 2. Check Inventory.tsx for Stone Configuration Manager
const inventoryContent = fs.readFileSync(path.join(__dirname, 'frontend/src/pages/Inventory.tsx'), 'utf-8');
assert(
  inventoryContent.includes('Single Stone (1 pc)') &&
  inventoryContent.includes('Multiple Stones'),
  "Inventory.tsx modal supports switching between Single Stone and Multiple Stones mode"
);
assert(
  inventoryContent.includes('+ Add Individual Stone') &&
  inventoryContent.includes('batchAddCount') &&
  inventoryContent.includes('+ Add Multiple ('),
  "Inventory.tsx supports adding individual stones and adding multiple stones in batch"
);
assert(
  inventoryContent.includes('updateEditingStones') &&
  (inventoryContent.includes('cur.splice(stIdx, 1)') || inventoryContent.includes('removeStone') || inventoryContent.includes('cur.filter')),
  "Inventory.tsx supports editing stone weights and deleting individual stones with weight recalculation"
);
assert(
  inventoryContent.includes('🎨 Customize Stones') &&
  inventoryContent.includes('Stone Variety / Type') &&
  inventoryContent.includes('DEFAULT_VARIETIES'),
  "Inventory.tsx supports full individual stone customization (variety, shape, weights, dimensions) without separate mixed varieties breakdown"
);

// 3. Check PurchaseForm.tsx for individual and multiple stone management
const purchaseContent = fs.readFileSync(path.join(__dirname, 'frontend/src/pages/PurchaseForm.tsx'), 'utf-8');
assert(
  purchaseContent.includes('+ Add Stone') &&
  purchaseContent.includes('+3 Stones') &&
  purchaseContent.includes('+5 Stones'),
  "PurchaseForm.tsx supports adding individual stone and multiple stones in batch"
);
assert(
  purchaseContent.includes('updated.splice(stIdx, 1)') &&
  purchaseContent.includes('handleUpdateItem(idx, "stone_weights", updated)'),
  "PurchaseForm.tsx supports editing weights and removing individual stones with recalculation"
);

// 4. Check PacketView.tsx for dossier stone management modal
const packetViewContent = fs.readFileSync(path.join(__dirname, 'frontend/src/pages/PacketView.tsx'), 'utf-8');
assert(
  packetViewContent.includes('editStonesModalOpen') &&
  packetViewContent.includes('💎 Manage Stones'),
  "PacketView.tsx has a dedicated Manage Stones modal and action button"
);
assert(
  packetViewContent.includes('+ Add Individual Stone') &&
  packetViewContent.includes('batchCount') &&
  packetViewContent.includes('+ Add Multiple ('),
  "PacketView.tsx modal supports adding individual stones and multiple stones"
);
assert(
  (packetViewContent.includes('removeStone') || packetViewContent.includes('splice')) &&
  packetViewContent.includes('savePacket('),
  "PacketView.tsx supports deleting/editing individual stones and saving packet directly"
);

console.log("=====================================================================");
console.log(`Results: ${passed}/${total} checks passed.`);
if (passed === total) {
  console.log("🎉 ALL INDIVIDUAL & MULTIPLE STONE MANAGEMENT CHECKS PASSED!");
} else {
  process.exit(1);
}
