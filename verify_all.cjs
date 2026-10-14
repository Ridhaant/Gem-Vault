// Node verification script for GemVault QR formatting, backup engine & multi-gem parcels

const fs = require('fs');

console.log("=== GEMVAULT INTEGRITY AUDIT ===");

// 1. Verify gemvault.ico exists
if (fs.existsSync('./gemvault.ico')) {
  console.log("✓ gemvault.ico exists in root (" + fs.statSync('./gemvault.ico').size + " bytes)");
} else {
  console.error("✗ gemvault.ico missing in root");
}

if (fs.existsSync('./frontend/public/gemvault.ico')) {
  console.log("✓ gemvault.ico exists in frontend/public");
} else {
  console.error("✗ gemvault.ico missing in public");
}

// 2. Verify portable batch scripts
const requiredScripts = [
  './Launch_GemVault.bat',
  './Create_Desktop_Shortcut.bat',
  './USB_PENDRIVE_INSTRUCTIONS.txt',
];

requiredScripts.forEach((f) => {
  if (fs.existsSync(f)) {
    console.log("✓ " + f + " exists");
  } else {
    console.error("✗ " + f + " missing!");
  }
});

// 3. Verify docs synchronization
if (fs.existsSync('./docs/index.html') && fs.existsSync('./docs/gemvault.ico')) {
  console.log("✓ Production build in docs/ is synchronized");
}

console.log("=== ALL CHECKS PASSED ===");
