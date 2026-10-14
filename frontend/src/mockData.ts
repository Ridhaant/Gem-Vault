import type {
  GemPacket,
  GemSale,
  GemBrokerage,
  GemPurchase,
  GemExpense,
  GemBuyer,
  GemBox,
  GemAsset,
} from "./types/gemstone";
import {
  getStoredPackets,
  getPacketByNumber,
  savePacket,
  deletePacket,
  getStoredSales,
  saveSale,
  deleteSale,
  addPaymentToSale,
  getStoredBrokerage,
  saveBrokerageDeal,
  deleteBrokerageDeal,
  getStoredPurchases,
  savePurchase,
  deletePurchase,
  getStoredExpenses,
  saveExpense,
  deleteExpense,
  getStoredBuyers,
  saveBuyer,
  getStoredBoxes,
  saveBox,
  deleteBox,
  getStoredParticulars,
  saveCustomParticular,
  getStoredLabs,
  saveCustomLab,
  getStoredAssets,
  saveAsset,
  deleteAsset,
  getLiquidCash,
  setLiquidCash,
  getStoredAssetCategories,
  saveAssetCategory,
  deleteAssetCategory,
  getStoredPettyCategories,
  savePettyCategory,
  deletePettyCategory,
  markSaleFullPaymentReceived,
  getStoredGstSettings,
  saveGstSettings,
  getStoredCustomBoxTags,
  saveCustomBoxTag,
  deleteCustomBoxTag,
  renamePacketNumber,
  getStoredShapes,
  saveCustomShape,
  deleteCustomShape,
  getCostPricePassword,
  setCostPricePassword,
  verifyCostPricePassword,
  addPaymentToPurchase,
  markPurchaseFullPaymentPaid,
  settleApprovalMemo,
  verifyAnalyticsPassword,
  setAnalyticsPassword,
  getOverallProfitAndAnalytics,
  exportLocalBackup,
  importLocalBackup,
  resetToGemstoneSeed,
  DEFAULT_PACKETS,
  DEFAULT_SALES,
  DEFAULT_BROKERAGE,
  DEFAULT_PURCHASES,
  DEFAULT_EXPENSES,
  DEFAULT_BUYERS,
  DEFAULT_BOXES,
  DEFAULT_ASSETS,
  DEFAULT_GST_SETTINGS,
} from "./gemstoneStorage";

export {
  DEFAULT_PACKETS,
  DEFAULT_SALES,
  DEFAULT_BROKERAGE,
  DEFAULT_PURCHASES,
  DEFAULT_EXPENSES,
  DEFAULT_BUYERS,
  DEFAULT_BOXES,
  DEFAULT_ASSETS,
};

// Map packets to product-like format for legacy routes if needed
export function getLegacyProducts() {
  return getStoredPackets().map((p) => ({
    id: p.id,
    model: `${p.packet_number} — ${p.particulars} (${p.weight} ${p.unit || "ct"} ${p.shape})`,
    sku: p.packet_number,
    category: p.particulars.split("(")[0].trim(),
    cost_price: p.purchase_price,
    sell_price: p.sale_price,
    qty_on_hand: p.status === "in_stock" ? p.pieces : 0,
    carats: p.weight,
    unit: p.unit || "cts",
    mm_size: p.mm_size,
    status: p.status,
  }));
}

export function handleMockApi(path: string, method = "GET", body?: any): any {
  const p = path.replace(/^\/api/, "");

  // Authentication (100% Local offline vault master credentials)
  if (p === "/auth/login") {
    const { email } = body || {};
    return {
      access_token: "gemvault-local-token-" + Date.now(),
      user: {
        id: "u_owner",
        email: email || "admin@shreejigems.com",
        name: "Shreeji Gems",
        role: "owner",
        active: true,
      },
    };
  }

  if (p === "/auth/me") {
    return {
      id: "u_owner",
      email: "admin@shreejigems.com",
      name: "Shreeji Gems",
      role: "owner",
      active: true,
    };
  }

  // -------------------------------------------------------------
  // Boxes
  // -------------------------------------------------------------
  if (p === "/boxes") {
    if (method === "GET") return getStoredBoxes();
    if (method === "POST") return saveBox(body);
  }

  const boxMatch = p.match(/^\/boxes\/([^/?]+)$/);
  if (boxMatch) {
    const bId = boxMatch[1];
    if (method === "GET") {
      const found = getStoredBoxes().find((b) => b.id === bId);
      if (!found) throw new Error("Box not found");
      return found;
    }
    if (method === "PUT" || method === "PATCH") return saveBox({ ...body, id: bId });
    if (method === "DELETE") return { success: deleteBox(bId) };
  }

  // -------------------------------------------------------------
  // Custom Box Color Tags & Gemstone Names
  // -------------------------------------------------------------
  if (p === "/custom-box-tags") {
    if (method === "GET") return getStoredCustomBoxTags();
    if (method === "POST") return saveCustomBoxTag(body?.label, body?.color);
  }

  const boxTagMatch = p.match(/^\/custom-box-tags\/([^/?]+)$/);
  if (boxTagMatch) {
    const tagId = boxTagMatch[1];
    if (method === "DELETE") return { success: true, tags: deleteCustomBoxTag(tagId) };
  }

  // -------------------------------------------------------------
  // Custom Particulars & Labs
  // -------------------------------------------------------------
  if (p === "/custom-particulars") {
    if (method === "GET") return getStoredParticulars();
    if (method === "POST") return saveCustomParticular(body?.name);
  }

  if (p === "/custom-labs") {
    if (method === "GET") return getStoredLabs();
    if (method === "POST") return saveCustomLab(body?.name);
  }

  // -------------------------------------------------------------
  // Assets & Liquid Cash
  // -------------------------------------------------------------
  if (p === "/assets") {
    if (method === "GET") return getStoredAssets();
    if (method === "POST") return saveAsset(body);
  }

  const assetMatch = p.match(/^\/assets\/([^/?]+)$/);
  if (assetMatch) {
    const aId = assetMatch[1];
    if (method === "GET") {
      const found = getStoredAssets().find((a) => a.id === aId);
      if (!found) throw new Error("Asset not found");
      return found;
    }
    if (method === "PUT" || method === "PATCH") return saveAsset({ ...body, id: aId });
    if (method === "DELETE") return { success: deleteAsset(aId) };
  }

  if (p === "/liquid-cash") {
    if (method === "GET") return { amount: getLiquidCash() };
    if (method === "POST" || method === "PUT") return { amount: setLiquidCash(body?.amount) };
  }

  // -------------------------------------------------------------
  // GST Settings (Customizable Rates & HSN)
  // -------------------------------------------------------------
  if (p === "/gst-settings") {
    if (method === "GET") return getStoredGstSettings();
    if (method === "POST" || method === "PUT") return saveGstSettings(body);
  }

  // -------------------------------------------------------------
  // Analytics Password Verification
  // -------------------------------------------------------------
  if (p === "/analytics/verify-password" && method === "POST") {
    const valid = verifyAnalyticsPassword(body?.password || "");
    return { valid };
  }

  if (p === "/analytics/change-password" && method === "POST") {
    setAnalyticsPassword(body?.new_password || "");
    return { success: true };
  }

  // -------------------------------------------------------------
  // Packets (Inventory)
  // -------------------------------------------------------------
  if (p === "/packets" || p === "/products") {
    if (method === "GET") {
      return getStoredPackets();
    }
    if (method === "POST") {
      return savePacket(body);
    }
  }

  const renameMatch = p.match(/^\/(?:packets|products)\/(.+)\/rename$/);
  if (renameMatch && method === "POST") {
    const id = decodeURIComponent(renameMatch[1]);
    const res = renamePacketNumber(id, body?.new_packet_number || body?.packet_number);
    if (!res.success) {
      throw new Error(res.error || "Failed to rename packet");
    }
    return res.packet;
  }

  const packetMatch = p.match(/^\/(?:packets|products)\/(.+)$/);
  if (packetMatch) {
    const id = decodeURIComponent(packetMatch[1]);
    if (method === "GET") {
      const found = getPacketByNumber(id);
      if (!found) throw new Error(`Packet "${id}" not found`);
      return found;
    }
    if (method === "PUT" || method === "PATCH") {
      return savePacket({ ...body, id });
    }
    if (method === "DELETE") {
      return { success: deletePacket(id) };
    }
  }

  // -------------------------------------------------------------
  // Sales & Approvals
  // -------------------------------------------------------------
  if (p === "/sales" || p === "/orders?kind=sale") {
    if (method === "GET") {
      return getStoredSales();
    }
    if (method === "POST") {
      return saveSale(body);
    }
  }

  if (p.startsWith("/orders") && !p.includes("/")) {
    if (method === "GET") {
      if (p.includes("kind=purchase")) return getStoredPurchases();
      return getStoredSales();
    }
  }

  const salePaymentMatch = p.match(/^\/(?:sales|orders)\/([^/?]+)\/payments$/);
  if (salePaymentMatch && method === "POST") {
    const sId = salePaymentMatch[1];
    const updated = addPaymentToSale(sId, body);
    if (!updated) throw new Error("Sale not found");
    return updated;
  }

  const saleFullPaymentMatch = p.match(/^\/(?:sales|orders)\/([^/?]+)\/full-payment$/);
  if (saleFullPaymentMatch && method === "POST") {
    const sId = saleFullPaymentMatch[1];
    const updated = markSaleFullPaymentReceived(sId, body?.mode || "Cash");
    if (!updated) throw new Error("Sale not found");
    return updated;
  }

  const saleMatch = p.match(/^\/(?:sales|orders)\/([^/?]+)$/);
  if (saleMatch) {
    const sId = saleMatch[1];
    if (method === "GET") {
      const found = getStoredSales().find((s) => s.id === sId || s.invoice_no === sId);
      if (found) return found;
      const foundPur = getStoredPurchases().find((x) => x.id === sId || x.purchase_no === sId);
      if (foundPur) return foundPur;
      throw new Error("Order not found");
    }
    if (method === "PUT" || method === "PATCH") {
      return saveSale({ ...body, id: sId });
    }
    if (method === "DELETE") {
      return { success: deleteSale(sId) };
    }
  }

  const settleApprovalMatch = p.match(/^\/sales\/([^/?]+)\/settle-approval$/);
  if (settleApprovalMatch && method === "POST") {
    const sId = settleApprovalMatch[1];
    return settleApprovalMemo(sId, body?.items || [], body?.options);
  }

  // -------------------------------------------------------------
  // Brokerage (Third-Party Deals)
  // -------------------------------------------------------------
  if (p === "/brokerage") {
    if (method === "GET") {
      return getStoredBrokerage();
    }
    if (method === "POST") {
      return saveBrokerageDeal(body);
    }
  }

  const brokerageMatch = p.match(/^\/brokerage\/([^/?]+)$/);
  if (brokerageMatch) {
    const bId = brokerageMatch[1];
    if (method === "GET") {
      const found = getStoredBrokerage().find((x) => x.id === bId || x.deal_no === bId);
      if (!found) throw new Error("Brokerage deal not found");
      return found;
    }
    if (method === "PUT" || method === "PATCH") {
      return saveBrokerageDeal({ ...body, id: bId });
    }
    if (method === "DELETE") {
      return { success: deleteBrokerageDeal(bId) };
    }
  }

  // -------------------------------------------------------------
  // Purchases (New Packet Intake)
  // -------------------------------------------------------------
  if (p === "/purchases") {
    if (method === "GET") {
      return getStoredPurchases();
    }
    if (method === "POST") {
      return savePurchase(body);
    }
  }

  const purchaseMatch = p.match(/^\/purchases\/([^/?]+)$/);
  if (purchaseMatch) {
    const purId = purchaseMatch[1];
    if (method === "GET") {
      const found = getStoredPurchases().find((x) => x.id === purId || x.purchase_no === purId);
      if (!found) throw new Error("Purchase not found");
      return found;
    }
    if (method === "PUT" || method === "PATCH") {
      return savePurchase({ ...body, id: purId });
    }
    if (method === "DELETE") {
      return { success: deletePurchase(purId) };
    }
  }

  const purchasePaymentMatch = p.match(/^\/purchases\/([^/?]+)\/payments$/);
  if (purchasePaymentMatch && method === "POST") {
    const purId = purchasePaymentMatch[1];
    const updated = addPaymentToPurchase(purId, body);
    if (!updated) throw new Error("Purchase not found");
    return updated;
  }

  const purchaseFullPayMatch = p.match(/^\/purchases\/([^/?]+)\/full-payment$/);
  if (purchaseFullPayMatch && method === "POST") {
    const purId = purchaseFullPayMatch[1];
    const updated = markPurchaseFullPaymentPaid(purId, body?.payment_mode);
    if (!updated) throw new Error("Purchase not found");
    return updated;
  }

  // -------------------------------------------------------------
  // Expenses
  // -------------------------------------------------------------
  if (p === "/expenses") {
    if (method === "GET") {
      return getStoredExpenses();
    }
    if (method === "POST") {
      return saveExpense(body);
    }
  }

  const expenseMatch = p.match(/^\/expenses\/([^/?]+)$/);
  if (expenseMatch) {
    const expId = expenseMatch[1];
    if (method === "GET") {
      const found = getStoredExpenses().find((e) => e.id === expId);
      if (!found) throw new Error("Expense not found");
      return found;
    }
    if (method === "PUT" || method === "PATCH") {
      return saveExpense({ ...body, id: expId });
    }
    if (method === "DELETE") {
      return { success: deleteExpense(expId) };
    }
  }

  // -------------------------------------------------------------
  // Category Customization (Petty Expenses & Assets)
  // -------------------------------------------------------------
  if (p === "/petty-categories") {
    if (method === "GET") return getStoredPettyCategories();
    if (method === "POST") return savePettyCategory(body?.name || body?.category);
  }
  const pettyCatDeleteMatch = p.match(/^\/petty-categories\/(.+)$/);
  if (pettyCatDeleteMatch && method === "DELETE") {
    const name = decodeURIComponent(pettyCatDeleteMatch[1]);
    return deletePettyCategory(name);
  }

  if (p === "/asset-categories") {
    if (method === "GET") return getStoredAssetCategories();
    if (method === "POST") return saveAssetCategory(body?.name || body?.category);
  }
  const assetCatDeleteMatch = p.match(/^\/asset-categories\/(.+)$/);
  if (assetCatDeleteMatch && method === "DELETE") {
    const name = decodeURIComponent(assetCatDeleteMatch[1]);
    return deleteAssetCategory(name);
  }

  // -------------------------------------------------------------
  // Custom Shapes
  // -------------------------------------------------------------
  if (p === "/custom-shapes" || p === "/shapes") {
    if (method === "GET") return getStoredShapes();
    if (method === "POST") return saveCustomShape(body?.name || body?.shape);
  }
  const shapeDeleteMatch = p.match(/^\/(?:custom-shapes|shapes)\/(.+)$/);
  if (shapeDeleteMatch && method === "DELETE") {
    const name = decodeURIComponent(shapeDeleteMatch[1]);
    return deleteCustomShape(name);
  }

  // -------------------------------------------------------------
  // Cost Price Password
  // -------------------------------------------------------------
  if (p === "/cost-price-password/verify" && method === "POST") {
    return { valid: verifyCostPricePassword(body?.password) };
  }
  if (p === "/cost-price-password/set" && method === "POST") {
    return { success: setCostPricePassword(body?.password) };
  }

  // -------------------------------------------------------------
  // Buyers / Dealers
  // -------------------------------------------------------------
  if (p === "/buyers" || p === "/dealers") {
    if (method === "GET") {
      return getStoredBuyers();
    }
    if (method === "POST") {
      return saveBuyer(body);
    }
  }

  // -------------------------------------------------------------
  // Overall Profit and Analytics & Dashboard
  // -------------------------------------------------------------
  if (p.startsWith("/analytics") || p === "/reports/overview" || p === "/dashboard") {
    const urlParams = new URLSearchParams(p.includes("?") ? p.split("?")[1] : "");
    const comp = urlParams.get("company") || undefined;
    return getOverallProfitAndAnalytics(comp);
  }

  // -------------------------------------------------------------
  // Local Backup and Reset Controls
  // -------------------------------------------------------------
  if (p === "/backup/export") {
    return { json: exportLocalBackup() };
  }

  if (p === "/backup/import" && method === "POST") {
    return importLocalBackup(body?.json);
  }

  if (p === "/backup/reset" && method === "POST") {
    resetToGemstoneSeed();
    return { success: true, message: "Reset to default gemstone database complete." };
  }

  // Fallback default
  return null;
}
