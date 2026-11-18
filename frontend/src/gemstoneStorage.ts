import type {
  GemPacket,
  GemSale,
  GemBrokerage,
  GemPurchase,
  GemExpense,
  GemBuyer,
  GemBox,
  GemAsset,
  WeightUnit,
  GstSettings,
  GemSalePayment,
  GemSaleItem,
  GemStoneDetail,
  SaleLedgerItem,
  BalanceSheetData,
} from "./types/gemstone";
import { DEFAULT_SHAPES } from "./types/gemstone";
import { DEFAULT_BOXES_168 } from "./defaultBoxes";
import { parseParticularsVariety, isGenericVariety, resolvePacketStoneStatuses, resolvePacketSubGemStatuses, hasGenuineIndividualWeights } from "./packetStones";
import { idbGet, idbSet, idbGetAll, idbClear } from "./offlineDb";

export function normalizeBoxName(name?: string | null): string {
  if (!name) return "";
  return name.replace(/[—–-]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

const STORAGE_PREFIX = "gemvault_local_";

export const DEFAULT_BOXES: GemBox[] = DEFAULT_BOXES_168;


export const DEFAULT_PARTICULARS: string[] = [
  // Emeralds
  "Emerald (Zambian)",
  "Emerald (Colombian)",
  "Emerald (Panjshir / Afghan)",
  "Emerald (Russian / Ural)",
  "Emerald (Brazilian)",
  "Emerald (Ethiopian)",
  "Emerald (Sandawana)",
  "Emerald (Swat / Pakistan)",
  "Emerald Cat's Eye",
  "Trapiche Emerald",
  // Rubies
  "Ruby (Burmese Pigeon Blood)",
  "Ruby (Mozambique)",
  "Ruby (Madagascar)",
  "Ruby (Thai / Siamese)",
  "Ruby (Ceylon / Sri Lanka)",
  "Star Ruby (Natural Unheated)",
  // Sapphires
  "Blue Sapphire (Ceylon Royal Blue)",
  "Blue Sapphire (Ceylon Cornflower)",
  "Blue Sapphire (Kashmir Velvet)",
  "Blue Sapphire (Burmese)",
  "Blue Sapphire (Madagascar)",
  "Yellow Sapphire (Ceylon Pukhraj)",
  "Yellow Sapphire (Bangkok)",
  "Pink Sapphire (Ceylon)",
  "Pink Sapphire (Madagascar)",
  "Padparadscha Sapphire (Natural Lotus)",
  "White Sapphire (Safed Pukhraj)",
  "Green Sapphire",
  "Purple / Violet Sapphire",
  "Star Sapphire (Natural Asterism)",
  "Color-Change Sapphire",
  // Diamonds
  "Diamond Solitaire",
  "Diamond Melee Parcel",
  "Diamond (Fancy Yellow)",
  "Diamond (Fancy Pink)",
  "Diamond (Fancy Blue)",
  "Diamond (Black)",
  // Beryl Family
  "Aquamarine (Santa Maria Deep Blue)",
  "Aquamarine (Mozambique / Madagascar)",
  "Morganite (Peach / Pink Beryl)",
  "Heliodor (Golden Beryl)",
  "Bixbite (Red Beryl)",
  "Goshenite (White Beryl)",
  // Spinels
  "Red Spinel (Burmese / Mahenge)",
  "Hot Pink / Neon Spinel (Mahenge)",
  "Cobalt Blue Spinel (Luc Yen)",
  "Purple / Violet Spinel",
  "Black Spinel",
  // Tourmalines
  "Paraiba Tourmaline (Neon Blue)",
  "Rubellite (Pigeon Blood / Raspberry)",
  "Indicolite (Blue Tourmaline)",
  "Chrome Tourmaline (Vivid Green)",
  "Bi-Color / Watermelon Tourmaline",
  "Yellow / Canary Tourmaline",
  "Dravite (Brown Tourmaline)",
  "Black Tourmaline (Schorl)",
  // Chrysoberyl & Alexandrite
  "Alexandrite (Color Change - Russian / Brazilian)",
  "Chrysoberyl Cat's Eye (Lehsunia - Honey & Milk)",
  "Yellow / Golden Chrysoberyl",
  // Tanzanite & Zoisite
  "Tanzanite (Merelani AAA Royal Blue)",
  "Tanzanite (Peacock Green / Fancy)",
  // Opals
  "Opal (Australian Black - Lightning Ridge)",
  "Opal (Australian White / Crystal)",
  "Opal (Australian Boulder)",
  "Fire Opal (Mexican Sun Color)",
  "Opal (Ethiopian Welo Hydrophane)",
  // Garnet Family
  "Tsavorite Garnet (Vivid Green)",
  "Demantoid Garnet (Russian Horsetail)",
  "Spessartite / Mandarin Garnet",
  "Rhodolite Garnet (Purplish Red)",
  "Hessonite Garnet (Ceylon Gomedh)",
  "Malaia / Color-Change Garnet",
  "Pyrope-Almandine Garnet",
  // Topaz
  "Imperial Topaz (Natural Golden Sherry)",
  "Swiss Blue Topaz",
  "London Blue Topaz",
  "Sky Blue Topaz",
  "White / Clear Topaz",
  // Quartz & Chalcedony
  "Amethyst (Deep Siberian / Zambian)",
  "Citrine (Madeira / Golden)",
  "Ametrine (Bolivian)",
  "Rose Quartz (Madagascar Star)",
  "Smoky Quartz",
  "Rutilated / Tourmalinated Quartz",
  "Blue Chalcedony / Chrysoprase",
  "Carnelian",
  "Black Onyx",
  // Peridot & Zircon
  "Peridot (Burmese / Pakistani Suppat)",
  "Blue Zircon (Cambodian Ratanakiri)",
  "White Zircon (Natural Starlite)",
  // Organic & Navratna Gems
  "Natural Basra Pearl",
  "South Sea Pearl (Golden / White)",
  "Tahitian Black Pearl",
  "Cultured Pearl (Japanese Akoya)",
  "Red Coral (Italian / Mediterranean Moonga)",
  "Turquoise (Persian Neyshabur)",
  "Turquoise (Arizona Sleeping Beauty)",
  "Lapis Lazuli (Badakhshan Afghan Royal)",
  "Natural Baltic Amber",
  "Imperial Jadeite (Type A Jade)",
  "Moonstone (Rainbow / Ceylon Blue Sheen)",
  "Sunstone (Oregon Schiller)",
  "Iolite (Neeli - Water Sapphire)",
  "Kunzite / Hiddenite (Spodumene)",
];

export const DEFAULT_CERT_LABS: string[] = [
  "GIA",
  "GRS",
  "IGI",
  "Gübelin",
  "SSEF",
  "GII Mumbai",
  "IGI-GTL Jaipur",
  "Lotus Gemology",
  "HRD Antwerp",
  "Self / None",
];

export const DEFAULT_PACKETS: GemPacket[] = [];
export const DEFAULT_SALES: GemSale[] = [];
export const DEFAULT_BROKERAGE: GemBrokerage[] = [];
export const DEFAULT_PURCHASES: GemPurchase[] = [];
export const DEFAULT_EXPENSES: GemExpense[] = [];
export const DEFAULT_ASSETS: GemAsset[] = [];
export const DEFAULT_BUYERS: GemBuyer[] = [];

// High-performance In-Memory Storage Cache & IndexedDB Fallback
const memoryCache: Record<string, any> = {};
let isHydratedFromIdb = false;

// Initialize in-memory cache & hydrate from IndexedDB
export async function initOfflineStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    // 1. Initial quick-load from localStorage into memoryCache
    const keys = [
      "boxes",
      "packets",
      "sales",
      "brokerage",
      "purchases",
      "expenses",
      "assets",
      "buyers",
      "liquid_cash",
      "gemvault_suppliers",
      "gemvault_brokers",
      "custom_box_tags",
      "custom_particulars",
      "custom_labs",
      "gst_settings",
    ];
    for (const k of keys) {
      if (memoryCache[k] === undefined) {
        try {
          const raw = localStorage.getItem(STORAGE_PREFIX + k);
          if (raw) memoryCache[k] = JSON.parse(raw);
        } catch {}
      }
    }

    // 2. Hydrate from high-capacity IndexedDB (unlimited quota for 100k+ stones)
    if (window.indexedDB) {
      const allIdb = await idbGetAll();
      let changed = false;
      for (const k of Object.keys(allIdb)) {
        const idbVal = allIdb[k];
        if (idbVal !== undefined && idbVal !== null) {
          const memVal = memoryCache[k];
          if (!memVal || (Array.isArray(idbVal) && idbVal.length >= (Array.isArray(memVal) ? memVal.length : 0))) {
            memoryCache[k] = idbVal;
            changed = true;
          }
        }
      }
      isHydratedFromIdb = true;
      if (changed && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("gemvault_storage_hydrated"));
      }
    }

    // 3. Boxes initialized from storage or empty default
    if (!memoryCache["boxes"]) {
      memoryCache["boxes"] = DEFAULT_BOXES;
    }

    // 4. Client packets handled by backend or local database
    const currentPackets = memoryCache["packets"] || [];
  } catch (err) {
    console.warn("[Storage] Offline storage initialization warning:", err);
  }
}

// Automatically kick off hydration when module evaluates in browser
if (typeof window !== "undefined") {
  initOfflineStorage();
}

// Local Storage Accessors with In-Memory Cache
function getLocal<T>(key: string, defaultVal: T): T {
  if (key in memoryCache && memoryCache[key] !== undefined && memoryCache[key] !== null) {
    return memoryCache[key] as T;
  }
  try {
    const raw = typeof window !== "undefined" && window.localStorage ? localStorage.getItem(STORAGE_PREFIX + key) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryCache[key] = parsed;
      return parsed as T;
    }
  } catch (err) {
    console.warn(`Error reading ${key} from localStorage:`, err);
  }
  memoryCache[key] = defaultVal;
  return defaultVal;
}

// -------------------------------------------------------------
// Continuous Background Linearization & Simultaneous Live Sync
// -------------------------------------------------------------
let isLinearizing = false;
let syncTimer: any = null;

export function recheckAndLinearizeVault(): void {
  if (isLinearizing) return;
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    isLinearizing = true;

    // 1. Recheck Sales math
    const rawSales = localStorage.getItem(STORAGE_PREFIX + "sales");
    if (rawSales) {
      const sales: GemSale[] = JSON.parse(rawSales);
      let salesModified = false;
      sales.forEach((s) => {
        const total = Number(s.total) || 0;
        let sum = 0;
        let pModified = false;
        const cleanPayments = (s.payments || []).map((p) => {
          const a = Number(p.amount) || 0;
          if (sum + a > total) {
            pModified = true;
            const allowed = Math.max(0, Math.round((total - sum) * 100) / 100);
            sum = total;
            return { ...p, amount: allowed };
          }
          sum += a;
          return p;
        }).filter((p) => p.amount > 0);

        if (pModified) {
          s.payments = cleanPayments;
          salesModified = true;
        }

        const paid = Math.min(total, (s.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0));
        const correctBalance = Math.max(0, Math.round((total - paid) * 100) / 100);
        const correctStatus = correctBalance <= 0 ? "cleared" : paid > 0 ? "partial" : "unpaid";
        if (s.paid_amount !== paid || s.balance !== correctBalance || s.payment_status !== correctStatus) {
          s.paid_amount = paid;
          s.balance = correctBalance;
          s.payment_status = correctStatus;
          salesModified = true;
        }
      });
      if (salesModified) {
        setLocal("sales", sales);
      }
    }

    // 2. Recheck Purchases math
    const rawPurchases = getLocal<GemPurchase[]>("purchases", []);
    if (rawPurchases && rawPurchases.length > 0) {
      const purchases: GemPurchase[] = rawPurchases;
      let purModified = false;
      purchases.forEach((p) => {
        const totalCost = Number(p.total_cost) || 0;
        let supSum = 0;
        let supPModified = false;
        const cleanSupPayments = (p.payments || []).map((pm) => {
          const a = Number(pm.amount) || 0;
          if (supSum + a > totalCost) {
            supPModified = true;
            const allowed = Math.max(0, Math.round((totalCost - supSum) * 100) / 100);
            supSum = totalCost;
            return { ...pm, amount: allowed };
          }
          supSum += a;
          return pm;
        }).filter((pm) => pm.amount > 0);

        if (supPModified) {
          p.payments = cleanSupPayments;
          purModified = true;
        }

        const paid = Math.min(totalCost, (p.payments || []).reduce((acc, pay) => acc + (Number(pay.amount) || 0), 0));
        const correctBal = Math.max(0, Math.round((totalCost - paid) * 100) / 100);
        const correctStatus = correctBal <= 0 ? "cleared" : paid > 0 ? "partial" : "unpaid";
        if (p.paid_amount !== paid || p.balance_payable !== correctBal || p.payment_status !== correctStatus) {
          p.paid_amount = paid;
          p.balance_payable = correctBal;
          p.payment_status = correctStatus;
          purModified = true;
        }

        // Broker math: heal overpaid broker fees
        const totalBrk = Number(p.brokerage_amount) || 0;
        let brkSum = 0;
        let brkPModified = false;
        const cleanBrkPayments = (p.broker_payments || []).map((bpm) => {
          const a = Number(bpm.amount) || 0;
          if (brkSum + a > totalBrk) {
            brkPModified = true;
            const allowed = Math.max(0, Math.round((totalBrk - brkSum) * 100) / 100);
            brkSum = totalBrk;
            return { ...bpm, amount: allowed };
          }
          brkSum += a;
          return bpm;
        }).filter((bpm) => bpm.amount > 0);

        if (brkPModified) {
          p.broker_payments = cleanBrkPayments;
          purModified = true;
        }

        const paidFromPayments = (p.broker_payments || []).reduce((acc, bpay) => acc + (Number(bpay.amount) || 0), 0);
        const paidBrk = Math.min(totalBrk, Math.max(paidFromPayments, Number(p.brokerage_paid_amount) || (p.brokerage_paid ? totalBrk : 0)));
        const brkBal = p.brokerage_balance_due !== undefined ? Number(p.brokerage_balance_due) : Math.max(0, Math.round((totalBrk - paidBrk) * 100) / 100);
        const brkPaid = (totalBrk > 0 && brkBal <= 0) || Boolean(p.brokerage_paid);
        if (p.brokerage_paid_amount !== paidBrk || p.brokerage_balance_due !== brkBal || p.brokerage_paid !== brkPaid) {
          p.brokerage_paid_amount = paidBrk;
          p.brokerage_balance_due = brkBal;
          p.brokerage_paid = brkPaid;
          purModified = true;
        }
      });
      if (purModified) {
        setLocal("purchases", purchases);
      }
    }

    // 3. Recheck Brokerage Deals math
    const rawBrokerage = getLocal<GemBrokerage[]>("brokerage", []);
    if (rawBrokerage && rawBrokerage.length > 0) {
      const deals: GemBrokerage[] = rawBrokerage;
      let dealsModified = false;
      deals.forEach((d) => {
        const buyAmt = Number(d.buy_amount) || 0;
        const sellAmt = Number(d.sell_amount || d.deal_value) || 0;
        const correctComm = Math.round((sellAmt - buyAmt) * 100) / 100;
        if (d.commission_amount !== correctComm) {
          d.commission_amount = correctComm;
          dealsModified = true;
        }

        // Clamp seller payments to buy_amount
        let paidSeller = Number(d.amount_paid_to_seller) || 0;
        if (buyAmt > 0 && paidSeller > buyAmt) {
          paidSeller = buyAmt;
          d.amount_paid_to_seller = buyAmt;
          dealsModified = true;
        }

        // Clamp buyer receipts to sell_amount
        let recvBuyer = Number(d.amount_received_from_buyer) || 0;
        if (sellAmt > 0 && recvBuyer > sellAmt) {
          recvBuyer = sellAmt;
          d.amount_received_from_buyer = sellAmt;
          dealsModified = true;
        }

        // Clamp commission received to commission_amount
        let recComm = Number(d.received_amount) || 0;
        if (correctComm > 0 && recComm > correctComm) {
          recComm = correctComm;
          d.received_amount = correctComm;
          dealsModified = true;
        }
        const correctCommBal = Math.max(0, correctComm - recComm);
        if (d.balance_receivable !== correctCommBal) {
          d.balance_receivable = correctCommBal;
          dealsModified = true;
        }

        const isSellerSettled = buyAmt > 0 ? paidSeller >= buyAmt : paidSeller > 0;
        const isBuyerSettled = sellAmt > 0 ? recvBuyer >= sellAmt : recvBuyer > 0;
        let correctSettlementStatus = d.deal_settlement_status;
        if (isSellerSettled && isBuyerSettled) {
          correctSettlementStatus = "fully_settled";
        } else if (isSellerSettled && !isBuyerSettled) {
          correctSettlementStatus = "paid_seller_pending_buyer";
        } else if (!isSellerSettled && isBuyerSettled) {
          correctSettlementStatus = "paid_buyer_pending_seller";
        } else if (paidSeller > 0 || recvBuyer > 0) {
          correctSettlementStatus = "partial_settled";
        } else if (paidSeller === 0 && recvBuyer === 0) {
          correctSettlementStatus = "pending_both";
        }
        if (d.deal_settlement_status !== correctSettlementStatus) {
          d.deal_settlement_status = correctSettlementStatus;
          dealsModified = true;
        }
      });
      if (dealsModified) {
        setLocal("brokerage", deals);
      }
    }

    // 4. Overwrite JSON live backup simultaneously in background (using IndexedDB for high capacity)
    const backupData = {
      app: "Shreeji Gems CRM",
      version: "3.0.0",
      updated_at: new Date().toISOString(),
      boxes: getStoredBoxes(),
      packets: memoryCache['packets'] || [],
      sales: getStoredSales(),
      brokerage: getStoredBrokerage(),
      purchases: getStoredPurchases(),
      expenses: getStoredExpenses(),
      assets: getStoredAssets(),
      liquid_cash: getLiquidCash(),
      buyers: getStoredBuyers(),
    };
    idbSet("gemvault_latest_live_vault_backup", backupData).catch(() => {});

    // Update local snapshot archive safely (IndexedDB stores payload, localStorage keeps lightweight summary)
    const now = new Date();
    const liveEntry = {
      id: "live-auto-sync",
      timestamp: now.getTime(),
      dateFormatted: now.toLocaleString("en-IN"),
      type: "auto-sync",
      boxCount: (backupData.boxes || []).length,
      packetCount: (backupData.packets || []).length,
      salesCount: (backupData.sales || []).length,
    };
    idbSet("gemvault_live_snapshot_entry", { ...liveEntry, data: backupData }).catch(() => {});
  } catch (err) {
    console.warn("Background recheck & sync error:", err);
  } finally {
    isLinearizing = false;
  }
}

export function triggerBackgroundSyncAndRecheck(): void {
  if (typeof window === "undefined") return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    recheckAndLinearizeVault();
  }, 200);
}

function setLocal<T>(key: string, value: T): void {
  memoryCache[key] = value;

  // Persist to high-capacity IndexedDB asynchronously (handles hundreds of MBs effortlessly with no 5MB limit)
  idbSet(key, value).catch(() => {});

  // Large collections should NEVER be written to localStorage
  const heavyKeys = ["packets", "sales", "purchases", "brokerage", "expenses", "gemvault_latest_live_vault_backup", "gemvault_backup_history_records"];
  if (heavyKeys.includes(key)) {
    // Safely remove any legacy bloated key from localStorage if present to free quota
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem(STORAGE_PREFIX + key);
      }
    } catch {}
    if (!isLinearizing) {
      triggerBackgroundSyncAndRecheck();
    }
    return;
  }

  // Best-effort write to localStorage for tiny lightweight preferences only (< 25KB)
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const str = JSON.stringify(value);
      if (str.length < 25000) {
        localStorage.setItem(STORAGE_PREFIX + key, str);
      }
    }
    if (!isLinearizing) {
      triggerBackgroundSyncAndRecheck();
    }
  } catch (err: any) {
    console.warn(`[GemVault] localStorage quota reached for key "${key}". Safely persisted in IndexedDB and in-memory cache.`);
  }
}

// -------------------------------------------------------------
// Boxes
// -------------------------------------------------------------
export function getStoredBoxes(): GemBox[] {
  return getLocal<GemBox[]>("boxes", DEFAULT_BOXES);
}

export function saveBox(boxData: Partial<GemBox> & { name: string }): GemBox {
  const boxes = getStoredBoxes();
  const now = new Date().toISOString();

  if (boxData.id) {
    const idx = boxes.findIndex((b) => b.id === boxData.id);
    if (idx >= 0) {
      const oldName = boxes[idx].name;
      const updated: GemBox = { ...boxes[idx], ...boxData };
      boxes[idx] = updated;
      setLocal("boxes", boxes);

      // If box was renamed, cascade update to all packets currently assigned to this box
      if (oldName !== updated.name) {
        const packets = getStoredPackets();
        let changed = false;
        packets.forEach((p) => {
          if (p.box_name === oldName) {
            p.box_name = updated.name;
            changed = true;
          }
        });
        if (changed) {
          setLocal("packets", packets);
        }
      }

      return updated;
    }
  }

  const newBox: GemBox = {
    id: "box-" + Math.random().toString(36).substring(2, 9),
    name: boxData.name,
    description: boxData.description || "",
    color: boxData.color || "#10b981",
    created_at: now,
  };
  boxes.push(newBox);
  setLocal("boxes", boxes);
  return newBox;
}

export function deleteBox(id: string): boolean {
  const boxes = getStoredBoxes();
  const boxToDelete = boxes.find((b) => b.id === id);
  if (!boxToDelete) return false;

  setLocal("boxes", boxes.filter((b) => b.id !== id));

  // Reassign packets in deleted box to "Unassigned / General Vault"
  const packets = getStoredPackets();
  let changed = false;
  packets.forEach((p) => {
    if (p.box_name === boxToDelete.name) {
      p.box_name = "General Vault / Unassigned";
      changed = true;
    }
  });
  if (changed) {
    setLocal("packets", packets);
  }
  return true;
}

// -------------------------------------------------------------
// Custom Box Color Tags & Gemstone Names
// -------------------------------------------------------------
export interface CustomBoxTag {
  id: string;
  label: string;
  color: string;
  bg?: string;
}

export const DEFAULT_CUSTOM_BOX_TAGS: CustomBoxTag[] = [
  { id: "tag-tanzanite", label: "Tanzanite Royal", color: "#6366f1", bg: "rgba(99, 102, 241, 0.12)" },
  { id: "tag-tourmaline", label: "Tourmaline Mint", color: "#14b8a6", bg: "rgba(20, 184, 166, 0.12)" },
  { id: "tag-spinel", label: "Spinel Magenta", color: "#d946ef", bg: "rgba(217, 70, 239, 0.12)" },
  { id: "tag-aquamarine", label: "Aquamarine Sky", color: "#0ea5e9", bg: "rgba(14, 165, 233, 0.12)" },
  { id: "tag-alexandrite", label: "Alexandrite Shift", color: "#059669", bg: "rgba(5, 150, 105, 0.12)" },
  { id: "tag-opal", label: "Opal Fire", color: "#f97316", bg: "rgba(249, 115, 22, 0.12)" },
];

export function getStoredCustomBoxTags(): CustomBoxTag[] {
  return getLocal<CustomBoxTag[]>("custom_box_tags", DEFAULT_CUSTOM_BOX_TAGS);
}

export function saveCustomBoxTag(label: string, color: string): CustomBoxTag[] {
  if (!label || !label.trim()) return getStoredCustomBoxTags();
  const tags = getStoredCustomBoxTags();
  const cleanLabel = label.trim();
  const cleanColor = color && color.trim() ? color.trim() : "#10b981";

  const existingIdx = tags.findIndex((t) => t.label.toLowerCase() === cleanLabel.toLowerCase());
  if (existingIdx >= 0) {
    tags[existingIdx].color = cleanColor;
    tags[existingIdx].bg = `${cleanColor}20`;
  } else {
    tags.push({
      id: "tag-" + Math.random().toString(36).substring(2, 9),
      label: cleanLabel,
      color: cleanColor,
      bg: `${cleanColor}20`,
    });
  }
  setLocal("custom_box_tags", tags);
  return tags;
}

export function deleteCustomBoxTag(id: string): CustomBoxTag[] {
  const tags = getStoredCustomBoxTags().filter((t) => t.id !== id);
  setLocal("custom_box_tags", tags);
  return tags;
}

// -------------------------------------------------------------
// GST Settings (Customizable Rates & HSN)
// -------------------------------------------------------------
export const DEFAULT_GST_SETTINGS: GstSettings = {
  default_rate: 0.25,
  available_rates: [0, 0.25, 1.5, 3.0, 5.0, 12.0, 18.0],
  gemstone_hsn: "7103",
  diamond_hsn: "7102",
  jewellery_hsn: "7113",
  enable_gst_by_default: true,
};

export function getStoredGstSettings(): GstSettings {
  return getLocal<GstSettings>("gst_settings", DEFAULT_GST_SETTINGS);
}

export function saveGstSettings(settings: Partial<GstSettings>): GstSettings {
  const current = getStoredGstSettings();
  const updated: GstSettings = { ...current, ...settings };
  setLocal("gst_settings", updated);
  return updated;
}

// -------------------------------------------------------------
// Custom Particulars, Suppliers, Brokers & Labs
// -------------------------------------------------------------
const KNOWN_TEST_TERMS = new Set([
  "hero",
  "hjdfhhkalsd",
  "hello",
  "byebye",
  "test",
  "demo",
  "asdf",
  "qwerty",
  "test party",
  "test supplier",
  "test buyer",
  "test broker",
]);

export function isTestTerm(name: string): boolean {
  if (!name || typeof name !== "string") return true;
  const clean = name.trim().toLowerCase();
  if (KNOWN_TEST_TERMS.has(clean)) return true;
  if (clean.includes("hjdfhhkalsd") || clean === "hero" || clean === "hello" || clean === "byebye") {
    return true;
  }
  return false;
}

export function getStoredSuppliers(): string[] {
  const custom = getLocal<string[]>("gemvault_suppliers", []);
  const fromPurchases: string[] = [];
  try {
    const rawPur = localStorage.getItem(STORAGE_PREFIX + "purchases");
    const purList: GemPurchase[] = rawPur ? JSON.parse(rawPur) : DEFAULT_PURCHASES;
    purList.forEach((p) => {
      if (p.supplier_name && p.supplier_name.trim()) fromPurchases.push(p.supplier_name.trim());
    });
  } catch {}

  const fromPackets: string[] = [];
  try {
    const rawPkts = localStorage.getItem(STORAGE_PREFIX + "packets");
    const pktList: GemPacket[] = rawPkts ? JSON.parse(rawPkts) : DEFAULT_PACKETS;
    pktList.forEach((p) => {
      if (p.supplier_name && p.supplier_name.trim()) fromPackets.push(p.supplier_name.trim());
    });
  } catch {}
  return Array.from(new Set([...custom, ...fromPurchases, ...fromPackets]))
    .filter((s) => Boolean(s) && !isTestTerm(s))
    .sort((a, b) => a.localeCompare(b));
}

export function clearStoredSuppliers(): boolean {
  setLocal("gemvault_suppliers", []);
  return true;
}

export function deleteStoredSupplier(name: string): boolean {
  const custom = getLocal<string[]>("gemvault_suppliers", []);
  const clean = name.trim().toLowerCase();
  const filtered = custom.filter((s) => s.trim().toLowerCase() !== clean);
  setLocal("gemvault_suppliers", filtered);
  return true;
}

export function saveSupplier(name: string): string[] {
  if (!name || !name.trim() || isTestTerm(name)) return getStoredSuppliers();
  const list = getLocal<string[]>("gemvault_suppliers", []);
  const clean = name.trim();
  if (!list.includes(clean)) {
    list.push(clean);
    setLocal("gemvault_suppliers", list);
  }
  return getStoredSuppliers();
}

export function getStoredBrokers(): string[] {
  const custom = getLocal<string[]>("gemvault_brokers", []);
  const fromPurchases: string[] = [];
  try {
    const rawPur = localStorage.getItem(STORAGE_PREFIX + "purchases");
    const purList: GemPurchase[] = rawPur ? JSON.parse(rawPur) : DEFAULT_PURCHASES;
    purList.forEach((p) => {
      if (p.broker_name && p.broker_name.trim()) fromPurchases.push(p.broker_name.trim());
    });
  } catch {}

  const fromDeals: string[] = [];
  try {
    const rawBrk = localStorage.getItem(STORAGE_PREFIX + "brokerage");
    const brkList: GemBrokerage[] = rawBrk ? JSON.parse(rawBrk) : DEFAULT_BROKERAGE;
    brkList.forEach((b: any) => {
      if (b.broker_name && typeof b.broker_name === "string" && b.broker_name.trim()) {
        fromDeals.push(b.broker_name.trim());
      }
    });
  } catch {}
  return Array.from(new Set([...custom, ...fromPurchases, ...fromDeals]))
    .filter((b) => Boolean(b) && !isTestTerm(b))
    .sort((a, b) => a.localeCompare(b));
}

export function clearStoredBrokers(): boolean {
  setLocal("gemvault_brokers", []);
  return true;
}

export function deleteStoredBroker(name: string): boolean {
  const custom = getLocal<string[]>("gemvault_brokers", []);
  const clean = name.trim().toLowerCase();
  const filtered = custom.filter((b) => b.trim().toLowerCase() !== clean);
  setLocal("gemvault_brokers", filtered);
  return true;
}

export function saveBroker(name: string): string[] {
  if (!name || !name.trim() || isTestTerm(name)) return getStoredBrokers();
  const list = getLocal<string[]>("gemvault_brokers", []);
  const clean = name.trim();
  if (!list.includes(clean)) {
    list.push(clean);
    setLocal("gemvault_brokers", list);
  }
  return getStoredBrokers();
}

export function getStoredParticulars(): string[] {
  const custom = getLocal<string[]>("custom_particulars", DEFAULT_PARTICULARS);
  const fromPackets: string[] = [];
  try {
    const rawPkts = localStorage.getItem(STORAGE_PREFIX + "packets");
    const pktList: GemPacket[] = rawPkts ? JSON.parse(rawPkts) : DEFAULT_PACKETS;
    pktList.forEach((p) => {
      if (p.particulars && p.particulars.trim()) fromPackets.push(p.particulars.trim());
    });
  } catch {}

  const fromPurchases: string[] = [];
  try {
    const rawPur = localStorage.getItem(STORAGE_PREFIX + "purchases");
    const purList: GemPurchase[] = rawPur ? JSON.parse(rawPur) : DEFAULT_PURCHASES;
    purList.forEach((pur) => {
      (pur.items || []).forEach((it) => {
        if (it.particulars && it.particulars.trim()) fromPurchases.push(it.particulars.trim());
      });
    });
  } catch {}

  return Array.from(new Set([...custom, ...fromPackets, ...fromPurchases]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function saveCustomParticular(name: string): string[] {
  if (!name || !name.trim()) return getStoredParticulars();
  const list = getLocal<string[]>("custom_particulars", DEFAULT_PARTICULARS);
  const trimmed = name.trim();
  if (!list.includes(trimmed)) {
    list.push(trimmed);
    setLocal("custom_particulars", list);
  }
  return getStoredParticulars();
}

export function getStoredLabs(): string[] {
  return getLocal<string[]>("custom_labs", DEFAULT_CERT_LABS);
}

export function saveCustomLab(name: string): string[] {
  if (!name || !name.trim()) return getStoredLabs();
  const list = getStoredLabs();
  const trimmed = name.trim();
  if (!list.includes(trimmed)) {
    list.push(trimmed);
    setLocal("custom_labs", list);
  }
  return list;
}

// -------------------------------------------------------------
// Custom Gemstone Shapes
// -------------------------------------------------------------
export function getStoredShapes(): string[] {
  return getLocal<string[]>("custom_shapes", Array.from(DEFAULT_SHAPES));
}

export function saveCustomShape(name: string): string[] {
  if (!name || !name.trim()) return getStoredShapes();
  const list = getStoredShapes();
  const trimmed = name.trim();
  const exists = list.some((s) => s.toLowerCase() === trimmed.toLowerCase());
  if (!exists) {
    list.push(trimmed);
    setLocal("custom_shapes", list);
  }
  return list;
}

export function deleteCustomShape(name: string): string[] {
  const list = getStoredShapes().filter((s) => s.toLowerCase() !== name.trim().toLowerCase());
  setLocal("custom_shapes", list);
  return list;
}

// -------------------------------------------------------------
// Cost Price Password Protection (Default: "2014")
// -------------------------------------------------------------
export function getCostPricePassword(): string {
  return getLocal<string>("cost_price_password", "2014");
}

export function setCostPricePassword(newPass: string): boolean {
  if (!newPass || !newPass.trim()) return false;
  setLocal("cost_price_password", newPass.trim());
  return true;
}

export function verifyCostPricePassword(input: string): boolean {
  const stored = getCostPricePassword();
  return (input || "").trim() === stored.trim();
}

// -------------------------------------------------------------
// Assets & Liquid Cash
// -------------------------------------------------------------
export const DEFAULT_ASSET_CATEGORIES: string[] = [
  "Vault & Safe",
  "Equipment & Tools",
  "Deposit",
  "Fixed Asset",
  "Vehicle",
  "Office Locker",
  "Precision Scales & Gem Instruments",
  "Other",
];

export function getStoredAssetCategories(): string[] {
  return getLocal<string[]>("asset_categories", DEFAULT_ASSET_CATEGORIES);
}

export function saveAssetCategory(name: string): string[] {
  if (!name || !name.trim()) return getStoredAssetCategories();
  const list = [...getStoredAssetCategories()];
  const trimmed = name.trim();
  if (!list.includes(trimmed)) {
    list.push(trimmed);
    setLocal("asset_categories", list);
  }
  return list;
}

export function deleteAssetCategory(name: string): string[] {
  const list = getStoredAssetCategories().filter((c) => c !== name);
  setLocal("asset_categories", list);
  return list;
}

export function getStoredAssets(): GemAsset[] {
  return getLocal<GemAsset[]>("assets", DEFAULT_ASSETS);
}

export function saveAsset(assetData: Partial<GemAsset> & { name: string; valuation: number; category: any }): GemAsset {
  const assets = getStoredAssets();
  const now = new Date().toISOString();

  if (assetData.id) {
    const idx = assets.findIndex((a) => a.id === assetData.id);
    if (idx >= 0) {
      const updated: GemAsset = {
        ...assets[idx],
        ...assetData,
        valuation: Number(assetData.valuation) || 0,
        updated_at: now,
      } as GemAsset;
      assets[idx] = updated;
      setLocal("assets", assets);
      return updated;
    }
  }

  const newAsset: GemAsset = {
    id: "ast-" + Math.random().toString(36).substring(2, 9),
    name: assetData.name,
    category: assetData.category || "Fixed Asset",
    valuation: Number(assetData.valuation) || 0,
    purchase_date: assetData.purchase_date || now.slice(0, 10),
    company_name: assetData.company_name || "Shreeji Gems",
    notes: assetData.notes || "",
    created_at: now,
    updated_at: now,
  };
  assets.unshift(newAsset);
  setLocal("assets", assets);
  return newAsset;
}

export function deleteAsset(id: string): boolean {
  const assets = getStoredAssets();
  setLocal("assets", assets.filter((a) => a.id !== id));
  return true;
}

export function getLiquidCash(): number {
  return getLocal<number>("liquid_cash", 0);
}

export function setLiquidCash(amount: number): number {
  const val = Math.max(0, Number(amount) || 0);
  setLocal("liquid_cash", val);
  return val;
}

// -------------------------------------------------------------
// Password Protection for Profit Analytics
// -------------------------------------------------------------
const DEFAULT_ANALYTICS_PASS = "2014";

export function getAnalyticsPassword(): string {
  return getLocal<string>("analytics_password", DEFAULT_ANALYTICS_PASS);
}

export function verifyAnalyticsPassword(pass: string): boolean {
  const current = getAnalyticsPassword();
  return pass.trim() === current.trim();
}

export function setAnalyticsPassword(pass: string): void {
  if (pass && pass.trim()) {
    setLocal("analytics_password", pass.trim());
  }
}

// -------------------------------------------------------------
// Packets (Inventory)
// -------------------------------------------------------------
export { hasGenuineIndividualWeights };

export function ensurePacketAndStoneIds(pkt: GemPacket): boolean {
  let changed = false;
  if (!pkt.id) {
    pkt.id = "pkt-" + Math.random().toString(36).substring(2, 9);
    changed = true;
  }
  if (!pkt.is_uncountable) {
    const pcs = Number(pkt.pieces) || 0;
    const existingStones = Array.isArray(pkt.stone_details) ? pkt.stone_details : [];
    const targetCount = Math.max(pcs, existingStones.length);
    if (targetCount > 0) {
      if (!Array.isArray(pkt.stone_details)) {
        pkt.stone_details = [];
        changed = true;
      }
      const hasGenuine = hasGenuineIndividualWeights(pkt);

      while (pkt.stone_details.length < targetCount) {
        const idx = pkt.stone_details.length;
        const sWt = (hasGenuine && Array.isArray(pkt.stone_weights) && Number(pkt.stone_weights[idx]) > 0)
          ? Number(pkt.stone_weights[idx])
          : (hasGenuine && pcs === 1 ? Number(pkt.weight) || 0 : 0);

        pkt.stone_details.push({
          id: `${pkt.id}-s${idx + 1}`,
          variety: pkt.particulars || "Gemstone",
          shape: pkt.shape || "Oval",
          weight: sWt,
          mm_size: pkt.mm_size || "",
          status: "in_stock",
          notes: "",
        });
        changed = true;
      }

      pkt.stone_details.forEach((st, idx) => {
        if (!st.id) {
          st.id = `${pkt.id}-s${idx + 1}`;
          changed = true;
        }
        if (!st.variety) {
          st.variety = pkt.particulars || "Gemstone";
          changed = true;
        }
        if (!st.shape) {
          st.shape = pkt.shape || "Oval";
          changed = true;
        }
        if (!st.status) {
          st.status = "in_stock";
          changed = true;
        }
        // If this is an unweighted multi-stone packet, ensure unsold stones are not locked with artificial divided weight or scale weight
        if (!hasGenuine && pcs > 1 && st.status === "in_stock") {
          if (st.weight !== 0) {
            st.weight = 0;
            changed = true;
          }
        }
      });
      if (!hasGenuine && pcs > 1 && pkt.stone_weights !== undefined) {
        pkt.stone_weights = undefined;
        changed = true;
      }
    }
  }
  return changed;
}

export function healPacketsWithSales(packets: GemPacket[], sales: GemSale[]): boolean {
  if (!packets || packets.length === 0 || packets.length > 500 || !sales || sales.length === 0) {
    return false;
  }
  let modified = false;
  for (const pkt of packets) {
    if (!pkt) continue;
    if (ensurePacketAndStoneIds(pkt)) {
      modified = true;
    }
    const hasGenuine = hasGenuineIndividualWeights(pkt);
    if (!hasGenuine && Number(pkt.pieces) > 1) {
      if (pkt.stone_weights !== undefined) {
        pkt.stone_weights = undefined;
        modified = true;
      }
      if (Array.isArray(pkt.stone_details)) {
        for (const sd of pkt.stone_details) {
          if (sd.weight !== 0) {
            sd.weight = 0;
            modified = true;
          }
        }
      }
    }

    if (!hasGenuine && !pkt.is_uncountable) {
      if (pkt.stone_weights !== undefined) {
        pkt.stone_weights = undefined;
        modified = true;
      }

      // Recover ground-truth remaining pieces & weight from original purchase minus all sales
      let origWt = 0;
      let origPcs = 0;
      try {
        const rawPurchases = typeof window !== "undefined" && window.localStorage
          ? localStorage.getItem(STORAGE_PREFIX + "purchases")
          : null;
        const purchases: GemPurchase[] = rawPurchases ? JSON.parse(rawPurchases) : [];
        for (const pur of purchases) {
          const matchItem = (pur.items || []).find((it) => (it.packet_number || "").toLowerCase() === (pkt.packet_number || "").toLowerCase());
          if (matchItem) {
            origWt = Number(matchItem.weight) || 0;
            origPcs = Number(matchItem.pieces) || 0;
            break;
          }
        }
      } catch {}

      if (origPcs > 0 && origWt > 0) {
        let soldPcs = 0;
        let soldWt = 0;
        for (const s of sales) {
          if (s.approval_status === "returned") continue;
          for (const it of (s.items || [])) {
            if ((it.packet_number || "").toLowerCase() === (pkt.packet_number || "").toLowerCase() && !it.is_returned) {
              const pTaken = it.pieces_taken !== undefined ? Number(it.pieces_taken) : (it.pieces !== undefined ? Number(it.pieces) : 0);
              const wTaken = it.weight_taken !== undefined ? Number(it.weight_taken) : (it.weight !== undefined ? Number(it.weight) : 0);
              soldPcs += (pTaken || 0);
              soldWt += (wTaken || 0);
            }
          }
        }
        const trueRemPcs = Math.max(0, origPcs - soldPcs);
        const trueRemWt = Math.max(0, Number((origWt - soldWt).toFixed(2)));
        if (trueRemPcs !== pkt.pieces || Math.abs((pkt.weight || 0) - trueRemWt) > 0.005) {
          pkt.pieces = trueRemPcs;
          pkt.weight = trueRemWt;
          if (trueRemPcs === 0 && trueRemWt <= 0.001) {
            pkt.status = "sold";
          } else if (pkt.status === "sold" && (trueRemPcs > 0 || trueRemWt > 0.001)) {
            pkt.status = "in_stock";
          }
          modified = true;
        }
      }
    }
    const details = Array.isArray(pkt.stone_details) ? pkt.stone_details : [];
    const weights = Array.isArray(pkt.stone_weights) ? pkt.stone_weights : [];

    // If stone_details is empty or has fewer stones than stone_weights, reconstruct stone_details array
    if (hasGenuine && weights.length > details.length) {
      const newDetails: GemStoneDetail[] = weights.map((wt, i) => {
        if (details[i]) return details[i];
        return {
          id: `st-${i + 1}`,
          variety: pkt.particulars || "Gemstone",
          shape: pkt.shape || "Oval",
          weight: Number(wt) || 0,
          mm_size: pkt.mm_size || "",
        };
      });
      pkt.stone_details = newDetails;
      modified = true;
    }

    // Auto-heal any stone whose variety was overwritten with generic "Mixed"
    if (Array.isArray(pkt.stone_details) && pkt.stone_details.length > 0) {
      const hasGeneric = pkt.stone_details.some(
        (s) => isGenericVariety(s.variety, pkt.particulars)
      );
      if (hasGeneric) {
        const pktSalesItems: Array<{ particulars?: string; shape?: string; weight?: number; stone_id?: string }> = [];
        for (const s of sales) {
          if (!Array.isArray(s.items)) continue;
          for (const it of s.items) {
            if (
              (it.packet_id && it.packet_id === pkt.id) ||
              (it.packet_number && it.packet_number.toLowerCase() === pkt.packet_number.toLowerCase())
            ) {
              pktSalesItems.push(it);
            }
          }
        }

        const usedItemIndices = new Set<number>();
        for (let i = 0; i < pkt.stone_details.length; i++) {
          const s = pkt.stone_details[i];
          const isGen = isGenericVariety(s.variety, pkt.particulars);
          if (isGen) {
            let itemIdx = pktSalesItems.findIndex((it, idx) => !usedItemIndices.has(idx) && it.stone_id === s.id);
            if (itemIdx < 0) {
              itemIdx = pktSalesItems.findIndex(
                (it, idx) =>
                  !usedItemIndices.has(idx) &&
                  it.particulars &&
                  !isGenericVariety(it.particulars, pkt.particulars)
              );
            }
            if (itemIdx >= 0) {
              usedItemIndices.add(itemIdx);
              const it = pktSalesItems[itemIdx];
              const parsed = parseParticularsVariety(it.particulars, it.shape || pkt.shape);
              if (parsed.variety && !isGenericVariety(parsed.variety, pkt.particulars)) {
                s.variety = parsed.variety;
                if (parsed.shape) s.shape = parsed.shape;
                modified = true;
              }
            }
          }
        }
      }
    }

    // 1. Clean up duplicated stone_weights if stone_details already has the authoritative count
    const p = pkt;
    if (Array.isArray(p.stone_details) && p.stone_details.length > 0) {
      if (Array.isArray(p.stone_weights) && p.stone_weights.length > p.stone_details.length) {
        p.stone_weights = p.stone_details.map((s) => Number(s.weight) || 0).filter((w) => w > 0);
        modified = true;
      }
    }

    // 2. Auto-heal weight and pieces for packets with stone details (ONLY for genuine individual stone packets)
    const hasStones =
      (Array.isArray(pkt.stone_details) && pkt.stone_details.length > 0) ||
      (Array.isArray(pkt.stone_weights) && pkt.stone_weights.length > 0);

    if (hasStones && !pkt.is_uncountable && hasGenuineIndividualWeights(pkt)) {
      const stoneStatuses = resolvePacketStoneStatuses(pkt, sales);
      const inStock = stoneStatuses.filter((s) => s.status === "in_stock");
      const inStockPcs = inStock.length;
      const allInStockHaveWeights = inStockPcs > 0 && inStock.every((s) => Number(s.weight) > 0);

      const sRate =
        pkt.sale_rate_per_unit ||
        ((pkt.weight || 0) > 0 ? (pkt.sale_price || 0) / pkt.weight : 0);
      const pRate =
        pkt.purchase_rate_per_unit ||
        ((pkt.weight || 0) > 0 ? (pkt.purchase_price || 0) / pkt.weight : 0);

      if (pkt.status === "in_stock" || pkt.status === "sold") {
        if (stoneStatuses.length > 0 && inStockPcs === 0) {
          pkt.status = "sold";
          pkt.weight = 0;
          pkt.pieces = 0;
          modified = true;
        } else if (inStockPcs > 0 && allInStockHaveWeights) {
          const inStockWt = Number(inStock.reduce((sum, s) => sum + (Number(s.weight) || 0), 0).toFixed(2));
          if (Math.abs((pkt.weight || 0) - inStockWt) > 0.005 || pkt.pieces !== inStockPcs || pkt.status === "sold") {
            pkt.weight = inStockWt;
            pkt.pieces = inStockPcs;
            pkt.status = "in_stock";
            if (pRate) {
              pkt.purchase_price = Math.round(pRate * pkt.weight);
              pkt.purchase_rate_per_unit = Math.round(pRate);
            }
            if (sRate) {
              pkt.sale_price = Math.round(sRate * pkt.weight);
              pkt.sale_rate_per_unit = Math.round(sRate);
            }
            modified = true;
          }
        } else if (inStockPcs > 0) {
          // inStockPcs > 0, but NOT all in-stock stones have positive weights.
          // Recover true remaining weight from original purchase minus sales, or preserve existing packet weight
          let origWt = 0;
          let origPcs = 0;
          try {
            const rawPurchases = typeof window !== "undefined" && window.localStorage
              ? localStorage.getItem(STORAGE_PREFIX + "purchases")
              : null;
            const purchases: GemPurchase[] = rawPurchases ? JSON.parse(rawPurchases) : [];
            for (const pur of purchases) {
              const matchItem = (pur.items || []).find((it) => (it.packet_number || "").toLowerCase() === (pkt.packet_number || "").toLowerCase());
              if (matchItem) {
                origWt = Number(matchItem.weight) || 0;
                origPcs = Number(matchItem.pieces) || 0;
                break;
              }
            }
          } catch {}

          let soldWt = 0;
          for (const s of sales) {
            if (s.approval_status === "returned") continue;
            for (const it of (s.items || [])) {
              if ((it.packet_number || "").toLowerCase() === (pkt.packet_number || "").toLowerCase() && !it.is_returned) {
                soldWt += Number(it.weight_taken || it.weight || 0);
              }
            }
          }

          let recWt = origWt > 0 ? Math.max(0, Number((origWt - soldWt).toFixed(2))) : (Number(pkt.weight) > 0 ? pkt.weight : 0);
          if (recWt <= 0 && pkt.purchase_rate_per_unit > 0 && pkt.purchase_price > 0) {
            recWt = Number((pkt.purchase_price / pkt.purchase_rate_per_unit).toFixed(2));
          }
          if (recWt <= 0 && pkt.sale_rate_per_unit > 0 && pkt.sale_price > 0) {
            recWt = Number((pkt.sale_price / pkt.sale_rate_per_unit).toFixed(2));
          }

          if (recWt > 0) {
            pkt.weight = recWt;
            pkt.pieces = inStockPcs;
            if (pRate) {
              pkt.purchase_price = Math.round(pRate * pkt.weight);
              pkt.purchase_rate_per_unit = Math.round(pRate);
            }
            if (sRate) {
              pkt.sale_price = Math.round(sRate * pkt.weight);
              pkt.sale_rate_per_unit = Math.round(sRate);
            }
            modified = true;
          }
        }
      } else if (pkt.status === "on_approval") {
        const active = stoneStatuses.filter((s) => s.status === "in_stock" || s.status === "on_approval");
        const activeWt = Number(active.reduce((sum, s) => sum + (Number(s.weight) || 0), 0).toFixed(2));
        const activePcs = active.length;
        if (activeWt > 0 && (Math.abs((pkt.weight || 0) - activeWt) > 0.005 || pkt.pieces !== activePcs)) {
          pkt.weight = activeWt;
          pkt.pieces = activePcs;
          if (pRate) {
            pkt.purchase_price = Math.round(pRate * pkt.weight);
            pkt.purchase_rate_per_unit = Math.round(pRate);
          }
          if (sRate) {
            pkt.sale_price = Math.round(sRate * pkt.weight);
            pkt.sale_rate_per_unit = Math.round(sRate);
          }
          modified = true;
        }
      }
    } else if (Array.isArray(pkt.sub_gems) && pkt.sub_gems.length > 0 && !pkt.is_uncountable) {
      const subStatuses = resolvePacketSubGemStatuses(pkt, sales);
      const inStock = subStatuses.filter((s) => s.status === "in_stock");
      const inStockWt = Number(inStock.reduce((sum, s) => sum + (Number(s.weight) || 0), 0).toFixed(2));
      const inStockPcs = inStock.length;

      const sRate =
        pkt.sale_rate_per_unit ||
        ((pkt.weight || 0) > 0 ? (pkt.sale_price || 0) / pkt.weight : 0);
      const pRate =
        pkt.purchase_rate_per_unit ||
        ((pkt.weight || 0) > 0 ? (pkt.purchase_price || 0) / pkt.weight : 0);

      if (pkt.status === "in_stock") {
        if (inStockPcs === 0) {
          pkt.status = "sold";
          pkt.weight = 0;
          pkt.pieces = 0;
          modified = true;
        } else if (Math.abs((pkt.weight || 0) - inStockWt) > 0.005 || pkt.pieces !== inStockPcs) {
          pkt.weight = inStockWt;
          pkt.pieces = inStockPcs;
          if (pRate) {
            pkt.purchase_price = Math.round(pRate * pkt.weight);
            pkt.purchase_rate_per_unit = Math.round(pRate);
          }
          if (sRate) {
            pkt.sale_price = Math.round(sRate * pkt.weight);
            pkt.sale_rate_per_unit = Math.round(sRate);
          }
          modified = true;
        }
      }
    }
  }
  return modified;
}

export function getStoredPackets(): GemPacket[] {
  // Fast path: return memory cache directly to prevent freezing the UI on 95,000+ packets
  if (memoryCache["packets"] && Array.isArray(memoryCache["packets"])) {
    return memoryCache["packets"];
  }
  return getLocal<GemPacket[]>("packets", DEFAULT_PACKETS);
}

export function getPacketByNumber(query: string): GemPacket | undefined {
  if (!query) return undefined;
  let q = query.trim();

  const urlMatch = q.match(/#\/packet\/([^\/\?\s]+)/i);
  if (urlMatch) {
    q = decodeURIComponent(urlMatch[1]);
  }

  if (q.startsWith("{") && q.endsWith("}")) {
    try {
      const parsed = JSON.parse(q);
      if (parsed.pkt) q = parsed.pkt;
    } catch {}
  }

  const docMatch = q.match(/(?:Packet(?:\s+Number)?\s*[-:]\s*|SHREEJI(?:\s+GEMS)?:\s*|GEMVAULT:\s*)([a-zA-Z0-9_\/-]+)/i);
  if (docMatch) {
    q = docMatch[1].trim();
  }

  const packets = getStoredPackets();
  const qClean = q.toLowerCase().replace(/[^a-z0-9]/g, "");

  return packets.find((p) => {
    if (p.packet_number.toLowerCase() === q.toLowerCase()) return true;
    if (p.id.toLowerCase() === q.toLowerCase()) return true;
    const pClean = p.packet_number.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (pClean === qClean) return true;
    return false;
  });
}

export function savePacket(
  packet: Partial<GemPacket> & {
    packet_number: string;
    particulars: string;
    shape: string;
    weight: number;
    pieces: number;
  }
): GemPacket {
  const packets = getStoredPackets();
  const now = new Date().toISOString();

  const weight = Number(packet.weight) || 0;
  const unit: WeightUnit = packet.unit === "g" ? "g" : "cts";
  const purchase_rate = Number(packet.purchase_rate_per_unit) || (weight ? Math.round((Number(packet.purchase_price) || 0) / weight) : 0);
  const purchase_price = Number(packet.purchase_price) || Math.round(purchase_rate * weight);

  const sale_rate = Number(packet.sale_rate_per_unit) || (weight ? Math.round((Number(packet.sale_price) || 0) / weight) : 0);
  const sale_price = Number(packet.sale_price) || Math.round(sale_rate * weight);

  // Predefined HSN code mapping if missing
  let hsn = packet.hsn_code;
  let gstRate = packet.gst_rate ?? 0.25;
  if (!hsn) {
    const partLower = packet.particulars.toLowerCase();
    if (partLower.includes("diamond")) {
      hsn = "7102";
      gstRate = 0.25;
    } else if (partLower.includes("jewel") || partLower.includes("ring") || partLower.includes("necklace")) {
      hsn = "7113";
      gstRate = 3.0;
    } else {
      hsn = "7103";
      gstRate = 0.25;
    }
  }

  const targetBox = (packet.box_name || "").trim() || "Box 1";
  const cleanPktNum = (packet.packet_number || "").trim();
  if (!cleanPktNum) {
    throw new Error("Packet number cannot be empty.");
  }

  // Enforce: within the same box, packet number must be unique!
  const boxCollision = packets.find(
    (p) =>
      p.id !== packet.id &&
      normalizeBoxName(p.box_name) === normalizeBoxName(targetBox) &&
      p.packet_number.trim().toLowerCase() === cleanPktNum.toLowerCase()
  );
  if (boxCollision) {
    throw new Error(`Packet "${cleanPktNum}" already exists in ${targetBox}. Duplicate packet number in the same box is not allowed.`);
  }

  const isUncountable = Boolean(packet.is_uncountable);
  const pieces = isUncountable ? 0 : (packet.pieces !== undefined ? Number(packet.pieces) : 1);
  const stone_weight = isUncountable
    ? 0
    : (packet.stone_weight !== undefined && Number(packet.stone_weight) > 0
        ? Number(packet.stone_weight)
        : (pieces > 0 && weight > 0 ? Math.round((weight / pieces) * 100) / 100 : weight));

  if (packet.id) {
    const idx = packets.findIndex((p) => p.id === packet.id);
    if (idx >= 0) {
      const existing = packets[idx];
      const updated: GemPacket = {
        ...existing,
        ...packet,
        is_uncountable: isUncountable,
        packet_number: cleanPktNum,
        box_name: targetBox,
        weight,
        unit,
        pieces,
        stone_weight,
        stone_weights: isUncountable ? [] : (packet.stone_weights !== undefined ? packet.stone_weights : existing.stone_weights),
        stone_details: isUncountable ? [] : (packet.stone_details !== undefined ? packet.stone_details : existing.stone_details),
        sub_gems: packet.sub_gems !== undefined ? packet.sub_gems : existing.sub_gems,
        purchase_rate_per_unit: purchase_rate,
        purchase_price,
        sale_rate_per_unit: sale_rate,
        sale_price,
        hsn_code: hsn,
        gst_rate: gstRate,
        updated_at: now,
      } as GemPacket;
      ensurePacketAndStoneIds(updated);
      packets[idx] = updated;
      setLocal("packets", packets);
      return updated;
    }
  }

  // Create new packet
  const newPacket: GemPacket = {
    id: packet.id || ("pkt-" + Math.random().toString(36).substring(2, 9)),
    packet_number: cleanPktNum,
    box_name: targetBox,
    particulars: packet.particulars,
    shape: packet.shape,
    is_uncountable: isUncountable,
    weight,
    unit,
    pieces,
    stone_weight,
    stone_weights: isUncountable ? [] : (packet.stone_weights || (stone_weight ? Array(pieces).fill(stone_weight) : undefined)),
    stone_details: isUncountable ? [] : (packet.stone_details || undefined),
    mm_size: packet.mm_size || "",
    purchase_price,
    purchase_rate_per_unit: purchase_rate,
    purchase_date: packet.purchase_date || now.slice(0, 10),
    supplier_name: packet.supplier_name || "",
    sale_price,
    sale_rate_per_unit: sale_rate,
    min_sale_price: Number(packet.min_sale_price) || 0,
    status: (packet.status as any) || "in_stock",
    company_name: packet.company_name || "Shreeji Gems",
    buyer_name: packet.buyer_name || "",
    sale_date: packet.sale_date || "",
    sold_price: packet.sold_price,
    sold_rate_per_unit: packet.sold_rate_per_unit,
    memo_party: packet.memo_party || "",
    memo_date: packet.memo_date || "",
    memo_notes: packet.memo_notes || "",
    is_approval: packet.is_approval || false,
    approval_status: packet.approval_status || undefined,
    origin: packet.origin || "",
    treatment: packet.treatment || "None / Natural",
    cert_lab: packet.cert_lab || "Self / None",
    cert_no: packet.cert_no || "",
    color_grade: packet.color_grade || "",
    clarity: packet.clarity || "",
    hsn_code: hsn,
    gst_rate: gstRate,
    making_charges: Number(packet.making_charges) || 0,
    diamond_weight: Number(packet.diamond_weight) || 0,
    metal_weight: Number(packet.metal_weight) || 0,
    notes: packet.notes || "",
    sub_gems: packet.sub_gems || [],
    created_at: now,
    updated_at: now,
  };

  ensurePacketAndStoneIds(newPacket);
  packets.unshift(newPacket);
  setLocal("packets", packets);
  return newPacket;
}

export function deletePacket(id: string): boolean {
  const packets = getStoredPackets();
  const filtered = packets.filter((p) => p.id !== id);
  setLocal("packets", filtered);
  return true;
}

export function renamePacketNumber(
  packetId: string,
  newPacketNumber: string
): { success: boolean; error?: string; packet?: GemPacket } {
  const cleanNew = newPacketNumber ? newPacketNumber.trim() : "";
  if (!cleanNew) {
    return { success: false, error: "Packet number cannot be empty." };
  }

  const packets = getStoredPackets();
  const target = packets.find((p) => p.id === packetId || p.packet_number.toLowerCase() === packetId.toLowerCase());
  if (!target) {
    return { success: false, error: "Packet not found in vault inventory." };
  }

  const oldNumber = target.packet_number;

  // If identical, return success
  if (oldNumber.toLowerCase() === cleanNew.toLowerCase()) {
    target.packet_number = cleanNew;
    target.updated_at = new Date().toISOString();
    setLocal("packets", packets);
    return { success: true, packet: target };
  }

  // Check if new packet number already exists on a different packet within the SAME box
  const collision = packets.find(
    (p) =>
      p.id !== target.id &&
      normalizeBoxName(p.box_name) === normalizeBoxName(target.box_name) &&
      p.packet_number.trim().toLowerCase() === cleanNew.toLowerCase()
  );
  if (collision) {
    return {
      success: false,
      error: `Packet "${cleanNew}" already exists in ${target.box_name || "this box"}. Same box cannot have duplicate packet number.`,
    };
  }

  // Update packet
  target.packet_number = cleanNew;
  target.updated_at = new Date().toISOString();
  setLocal("packets", packets);

  // Cascade rename to sales / invoices
  try {
    const sales = getStoredSales();
    let salesChanged = false;
    sales.forEach((s) => {
      s.items?.forEach((item) => {
        if (item.packet_id === target.id || item.packet_number.toLowerCase() === oldNumber.toLowerCase()) {
          item.packet_number = cleanNew;
          salesChanged = true;
        }
      });
    });
    if (salesChanged) setLocal("sales", sales);
  } catch (err) {
    console.error("Error cascading packet rename to sales:", err);
  }

  // Cascade rename to purchases
  try {
    const purchases = getStoredPurchases();
    let purchasesChanged = false;
    purchases.forEach((p) => {
      p.items?.forEach((item) => {
        if (item.packet_number.toLowerCase() === oldNumber.toLowerCase()) {
          item.packet_number = cleanNew;
          purchasesChanged = true;
        }
      });
    });
    if (purchasesChanged) setLocal("purchases", purchases);
  } catch (err) {
    console.error("Error cascading packet rename to purchases:", err);
  }

  return { success: true, packet: target };
}

// -------------------------------------------------------------
// Sales & Approvals
// -------------------------------------------------------------
export function getStoredSales(): GemSale[] {
  return getLocal<GemSale[]>("sales", DEFAULT_SALES);
}

export function saveSale(saleData: any): GemSale {
  const sales = getStoredSales();
  const packets = getStoredPackets();
  const now = new Date().toISOString();

  const isApproval = !!saleData.is_approval;
  const approvalStatus = saleData.approval_status || (isApproval ? "pending" : undefined);
  const isApprovedBilled = approvalStatus === "approved_billed";

  const total = Number(saleData.total) || Number(saleData.subtotal) || 0;
  const initialPayment = Number(saleData.initial_payment) || 0;
  const paid = initialPayment > 0 ? initialPayment : Number(saleData.paid_amount) || 0;
  const balance = Math.max(0, total - paid);
  const payStatus = balance <= 0 ? "cleared" : paid > 0 ? "partial" : "unpaid";

  const payments = saleData.payments || [];
  if (initialPayment > 0 && payments.length === 0) {
    payments.push({
      id: "pm-" + Math.random().toString(36).substring(2, 9),
      date: saleData.date || now.slice(0, 10),
      amount: initialPayment,
      mode: saleData.payment_mode || "Bank Wire / NEFT",
      note: "Initial payment on invoice creation",
    });
  }

  let finalSale: GemSale;

  if (saleData.id) {
    const idx = sales.findIndex((s) => s.id === saleData.id);
    if (idx >= 0) {
      const oldSale = sales[idx];
      // Revert previous allocation from oldSale so editing an existing invoice does NOT double-deduct inventory
      if (oldSale.approval_status !== "returned" && Array.isArray(oldSale.items)) {
        for (const oldIt of oldSale.items) {
          if (oldIt.is_returned || (Number(oldIt.pieces) === 0 && Number(oldIt.weight) === 0)) continue;
          const pIdx = packets.findIndex(
            (p) =>
              (oldIt.packet_id && p.id === oldIt.packet_id) ||
              p.packet_number.toLowerCase() === (oldIt.packet_number || "").toLowerCase()
          );
          if (pIdx >= 0) {
            packets[pIdx].pieces = (packets[pIdx].pieces || 0) + (oldIt.is_uncountable ? 0 : (Number(oldIt.pieces) || 0));
            packets[pIdx].weight = Number(((packets[pIdx].weight || 0) + (Number(oldIt.weight) || 0)).toFixed(2));
            packets[pIdx].status = "in_stock";
            packets[pIdx].buyer_name = "";
            packets[pIdx].sale_date = "";
            packets[pIdx].sold_price = undefined;
            packets[pIdx].sold_rate_per_unit = undefined;
            packets[pIdx].sale_invoice_id = undefined;
            packets[pIdx].is_approval = false;
            packets[pIdx].approval_status = undefined;
            if (Array.isArray(packets[pIdx].stone_details)) {
              for (const sd of packets[pIdx].stone_details) {
                if (sd.status === "sold" || sd.status === "on_approval") {
                  if (!oldIt.stone_id || sd.id === oldIt.stone_id) {
                    sd.status = "in_stock";
                  }
                }
              }
            }
            if (packets[pIdx].purchase_rate_per_unit) {
              packets[pIdx].purchase_price = Math.round(packets[pIdx].purchase_rate_per_unit * packets[pIdx].weight);
            }
            if (packets[pIdx].sale_rate_per_unit) {
              packets[pIdx].sale_price = Math.round(packets[pIdx].sale_rate_per_unit * packets[pIdx].weight);
            }
          }
        }
      }

      finalSale = {
        ...sales[idx],
        ...saleData,
        company_name: saleData.company_name || sales[idx].company_name || "Shreeji Gems",
        sell_type: saleData.sell_type || sales[idx].sell_type || "own_stock",
        is_approval: isApproval,
        approval_status: approvalStatus,
        total,
        paid_amount: paid,
        balance,
        payment_status: payStatus,
        payments,
      };
      sales[idx] = finalSale;
    } else {
      finalSale = {
        id: saleData.id,
        invoice_no: saleData.invoice_no || `GEM-INV-${Date.now().toString().slice(-4)}`,
        date: saleData.date || now.slice(0, 10),
        company_name: saleData.company_name || "Shreeji Gems",
        sell_type: saleData.sell_type || "own_stock",
        is_approval: isApproval,
        approval_status: approvalStatus,
        buyer_name: saleData.buyer_name,
        buyer_phone: saleData.buyer_phone,
        buyer_city: saleData.buyer_city,
        buyer_address: saleData.buyer_address,
        items: saleData.items || [],
        subtotal: Number(saleData.subtotal) || total,
        discount: Number(saleData.discount) || 0,
        cgst_amount: Number(saleData.cgst_amount) || 0,
        sgst_amount: Number(saleData.sgst_amount) || 0,
        igst_amount: Number(saleData.igst_amount) || 0,
        tax_amount: Number(saleData.tax_amount) || 0,
        total,
        paid_amount: paid,
        balance,
        payment_status: payStatus,
        payment_mode: saleData.payment_mode,
        payments,
        credit_days: saleData.credit_days,
        due_date: saleData.due_date,
        notes: saleData.notes,
        created_at: now,
      };
      sales.unshift(finalSale);
    }
  } else {
    finalSale = {
      id: "inv-" + Math.random().toString(36).substring(2, 9),
      invoice_no: saleData.invoice_no || `GEM-INV-${Date.now().toString().slice(-4)}`,
      date: saleData.date || now.slice(0, 10),
      company_name: saleData.company_name || "Shreeji Gems",
      sell_type: saleData.sell_type || "own_stock",
      is_approval: isApproval,
      approval_status: approvalStatus,
      buyer_name: saleData.buyer_name,
      buyer_phone: saleData.buyer_phone,
      buyer_city: saleData.buyer_city,
      buyer_address: saleData.buyer_address,
      items: saleData.items || [],
      subtotal: Number(saleData.subtotal) || total,
      discount: Number(saleData.discount) || 0,
      cgst_amount: Number(saleData.cgst_amount) || 0,
      sgst_amount: Number(saleData.sgst_amount) || 0,
      igst_amount: Number(saleData.igst_amount) || 0,
      tax_amount: Number(saleData.tax_amount) || 0,
      total,
      paid_amount: paid,
      balance,
      payment_status: payStatus,
      payment_mode: saleData.payment_mode,
      payments,
      credit_days: saleData.credit_days,
      due_date: saleData.due_date,
      notes: saleData.notes,
      created_at: now,
    };
    sales.unshift(finalSale);
  }

  // Auto-save buyer and particulars
  if (finalSale.buyer_name) {
    saveBuyer({
      name: finalSale.buyer_name,
      phone: finalSale.buyer_phone,
      city: finalSale.buyer_city,
      address: finalSale.buyer_address,
    });
  }

  // Update Inventory Packets Status based on Sale / Approval / Return
  if (Array.isArray(finalSale.items)) {
    for (const item of finalSale.items) {
      if (item.particulars) saveCustomParticular(item.particulars);
      const pIdx = packets.findIndex((p) => p.id === item.packet_id || p.packet_number === item.packet_number);
      if (pIdx >= 0) {
        const isUncountable = Boolean(packets[pIdx].is_uncountable || item.is_uncountable);

        ensurePacketAndStoneIds(packets[pIdx]);
        if (!item.packet_id) item.packet_id = packets[pIdx].id;

        // Auto-assign stone_id if missing for countable packets ONLY if packet has genuine individual weights
        if (!isUncountable && !item.stone_id && Array.isArray(packets[pIdx].stone_details) && hasGenuineIndividualWeights(packets[pIdx])) {
          const avail = packets[pIdx].stone_details.find((st) => st.status === "in_stock");
          if (avail) {
            item.stone_id = avail.id;
          }
        }

        if (isApproval) {
          if (approvalStatus === "returned") {
            packets[pIdx].status = "in_stock";
            packets[pIdx].memo_party = "";
            packets[pIdx].is_approval = false;
            packets[pIdx].approval_status = "returned";
            if (item.stone_id && Array.isArray(packets[pIdx].stone_details) && hasGenuineIndividualWeights(packets[pIdx])) {
              const matchedSd = packets[pIdx].stone_details.find((st) => st.id === item.stone_id);
              if (matchedSd) matchedSd.status = "in_stock";
            }
          } else if (isApprovedBilled) {
            const soldPcs = isUncountable ? 0 : (Number(item.pieces) || 0);
            const soldWt = Number(item.weight) || 0;
            let basePcs = Number(packets[pIdx].pieces) || 0;
            let baseWt = Number(packets[pIdx].weight) || 0;
            if (baseWt <= 0 || basePcs <= 0) {
              if (packets[pIdx].sale_rate_per_unit > 0 && packets[pIdx].sale_price > 0) {
                baseWt = Number((packets[pIdx].sale_price / packets[pIdx].sale_rate_per_unit).toFixed(2));
              } else if (packets[pIdx].purchase_rate_per_unit > 0 && packets[pIdx].purchase_price > 0) {
                baseWt = Number((packets[pIdx].purchase_price / packets[pIdx].purchase_rate_per_unit).toFixed(2));
              }
              if (basePcs <= 0) {
                basePcs = (packets[pIdx].stone_details && packets[pIdx].stone_details.length > 0)
                  ? packets[pIdx].stone_details.length
                  : (soldPcs + 1);
              }
            }
            const remainingPcs = isUncountable ? 0 : Math.max(0, basePcs - soldPcs);
            const remainingWt = Math.max(0, Number((baseWt - soldWt).toFixed(2)));
            const hasStockRemaining = isUncountable ? remainingWt > 0.001 : (remainingPcs > 0 && remainingWt > 0.001);

            packets[pIdx].buyer_name = finalSale.buyer_name;
            packets[pIdx].sale_date = finalSale.date;
            packets[pIdx].sold_price = item.total_price;
            packets[pIdx].sold_rate_per_unit = item.rate_per_unit;
            packets[pIdx].sale_invoice_id = finalSale.id;
            packets[pIdx].is_approval = false;
            packets[pIdx].approval_status = "approved_billed";

            if (item.stone_id && Array.isArray(packets[pIdx].stone_details)) {
              const matchedSd = packets[pIdx].stone_details.find((st) => st.id === item.stone_id);
              if (matchedSd) {
                matchedSd.status = "sold";
                if (soldWt > 0) matchedSd.weight = soldWt;
              }
            }

            if (hasStockRemaining) {
              packets[pIdx].pieces = isUncountable ? 0 : remainingPcs;
              packets[pIdx].weight = remainingWt;
              packets[pIdx].status = "in_stock";
              if (packets[pIdx].purchase_rate_per_unit) {
                packets[pIdx].purchase_price = Math.round(packets[pIdx].purchase_rate_per_unit * remainingWt);
              }
              if (packets[pIdx].sale_rate_per_unit) {
                packets[pIdx].sale_price = Math.round(packets[pIdx].sale_rate_per_unit * remainingWt);
              }
            } else {
              packets[pIdx].status = "sold";
              packets[pIdx].pieces = 0;
              packets[pIdx].weight = 0;
            }
          } else {
            // Pending approval: deduct pieces and carats allocated to approval
            const memoPcs = isUncountable ? 0 : (Number(item.pieces) || 0);
            const memoWt = Number(item.weight) || 0;
            let basePcs = Number(packets[pIdx].pieces) || 0;
            let baseWt = Number(packets[pIdx].weight) || 0;
            if (baseWt <= 0 || basePcs <= 0) {
              if (packets[pIdx].sale_rate_per_unit > 0 && packets[pIdx].sale_price > 0) {
                baseWt = Number((packets[pIdx].sale_price / packets[pIdx].sale_rate_per_unit).toFixed(2));
              } else if (packets[pIdx].purchase_rate_per_unit > 0 && packets[pIdx].purchase_price > 0) {
                baseWt = Number((packets[pIdx].purchase_price / packets[pIdx].purchase_rate_per_unit).toFixed(2));
              }
              if (basePcs <= 0) {
                basePcs = (packets[pIdx].stone_details && packets[pIdx].stone_details.length > 0)
                  ? packets[pIdx].stone_details.length
                  : (memoPcs + 1);
              }
            }
            const remainingPcs = isUncountable ? 0 : Math.max(0, basePcs - memoPcs);
            const remainingWt = Math.max(0, Number((baseWt - memoWt).toFixed(2)));
            const hasStockRemaining = isUncountable ? remainingWt > 0.001 : (remainingPcs > 0 && remainingWt > 0.001);

            const pktHasGenuine = hasGenuineIndividualWeights(packets[pIdx]);
            if (pktHasGenuine && item.stone_id && Array.isArray(packets[pIdx].stone_details)) {
              const matchedSd = packets[pIdx].stone_details.find((st) => st.id === item.stone_id);
              if (matchedSd) {
                matchedSd.status = "on_approval";
                if (memoWt > 0) matchedSd.weight = memoWt;
              }
            }

            if (hasStockRemaining) {
              packets[pIdx].pieces = isUncountable ? 0 : remainingPcs;
              packets[pIdx].weight = remainingWt;
              packets[pIdx].status = "in_stock";
              if (Array.isArray(packets[pIdx].stone_details) && packets[pIdx].stone_details.length > 0) {
                const s = packets[pIdx].stone_details.find(
                  (st) =>
                    (item.stone_id && st.id === item.stone_id) ||
                    (item.particulars &&
                      (item.particulars.toLowerCase() === `${(st.variety || "").toLowerCase()} (${(st.shape || "").toLowerCase()})` ||
                        item.particulars.toLowerCase() === (st.variety || "").toLowerCase()))
                );
                if (s && isGenericVariety(s.variety, packets[pIdx].particulars) && item.particulars) {
                  const parsed = parseParticularsVariety(item.particulars, item.shape || packets[pIdx].shape);
                  if (parsed.variety && !isGenericVariety(parsed.variety, packets[pIdx].particulars)) {
                    s.variety = parsed.variety;
                    if (parsed.shape) s.shape = parsed.shape;
                  }
                }
              }
              if (packets[pIdx].purchase_rate_per_unit) {
                packets[pIdx].purchase_price = Math.round(packets[pIdx].purchase_rate_per_unit * remainingWt);
              }
              if (packets[pIdx].sale_rate_per_unit) {
                packets[pIdx].sale_price = Math.round(packets[pIdx].sale_rate_per_unit * remainingWt);
              }
            } else {
              packets[pIdx].status = "on_approval";
              packets[pIdx].memo_party = finalSale.buyer_name;
              packets[pIdx].memo_date = finalSale.date;
              packets[pIdx].is_approval = true;
              packets[pIdx].approval_status = "pending";
              packets[pIdx].pieces = 0;
              packets[pIdx].weight = 0;
            }
          }
        } else {
          // Direct confirmed sale: partial or full stone deduction
          const soldPcs = isUncountable ? 0 : (Number(item.pieces) || 0);
          const soldWt = Number(item.weight) || 0;
          let basePcs = Number(packets[pIdx].pieces) || 0;
          let baseWt = Number(packets[pIdx].weight) || 0;
          if (baseWt <= 0 || basePcs <= 0) {
            if (packets[pIdx].sale_rate_per_unit > 0 && packets[pIdx].sale_price > 0) {
              baseWt = Number((packets[pIdx].sale_price / packets[pIdx].sale_rate_per_unit).toFixed(2));
            } else if (packets[pIdx].purchase_rate_per_unit > 0 && packets[pIdx].purchase_price > 0) {
              baseWt = Number((packets[pIdx].purchase_price / packets[pIdx].purchase_rate_per_unit).toFixed(2));
            }
            if (basePcs <= 0) {
              basePcs = (packets[pIdx].stone_details && packets[pIdx].stone_details.length > 0)
                ? packets[pIdx].stone_details.length
                : (soldPcs + 1);
            }
          }
          const remainingPcs = isUncountable ? 0 : Math.max(0, basePcs - soldPcs);
          const remainingWt = Math.max(0, Number((baseWt - soldWt).toFixed(2)));
          const hasStockRemaining = isUncountable ? remainingWt > 0.001 : (remainingPcs > 0 && remainingWt > 0.001);

          packets[pIdx].buyer_name = finalSale.buyer_name;
          packets[pIdx].sale_date = finalSale.date;
          packets[pIdx].sold_price = item.total_price;
          packets[pIdx].sold_rate_per_unit = item.rate_per_unit;
          packets[pIdx].sale_invoice_id = finalSale.id;
          packets[pIdx].is_approval = false;

          const pktHasGenuine = hasGenuineIndividualWeights(packets[pIdx]);
          if (pktHasGenuine && item.stone_id && Array.isArray(packets[pIdx].stone_details)) {
            const matchedSd = packets[pIdx].stone_details.find((st) => st.id === item.stone_id);
            if (matchedSd) {
              matchedSd.status = "sold";
              if (soldWt > 0) matchedSd.weight = soldWt;
            }
          }

          if (hasStockRemaining) {
            packets[pIdx].pieces = isUncountable ? 0 : remainingPcs;
            packets[pIdx].weight = remainingWt;
            packets[pIdx].status = "in_stock";
            if (Array.isArray(packets[pIdx].stone_details) && packets[pIdx].stone_details.length > 0) {
              const s = packets[pIdx].stone_details.find(
                (st) =>
                  (item.stone_id && st.id === item.stone_id) ||
                  (item.particulars &&
                    (item.particulars.toLowerCase() === `${(st.variety || "").toLowerCase()} (${(st.shape || "").toLowerCase()})` ||
                      item.particulars.toLowerCase() === (st.variety || "").toLowerCase()))
              );
              if (s && isGenericVariety(s.variety, packets[pIdx].particulars) && item.particulars) {
                const parsed = parseParticularsVariety(item.particulars, item.shape || packets[pIdx].shape);
                if (parsed.variety && !isGenericVariety(parsed.variety, packets[pIdx].particulars)) {
                  s.variety = parsed.variety;
                  if (parsed.shape) s.shape = parsed.shape;
                }
              }
            }
            if (packets[pIdx].purchase_rate_per_unit) {
              packets[pIdx].purchase_price = Math.round(packets[pIdx].purchase_rate_per_unit * remainingWt);
            }
            if (packets[pIdx].sale_rate_per_unit) {
              packets[pIdx].sale_price = Math.round(packets[pIdx].sale_rate_per_unit * remainingWt);
            }
          } else {
            packets[pIdx].status = "sold";
            packets[pIdx].pieces = 0;
            packets[pIdx].weight = 0;
          }
        }
      }
    }
    healPacketsWithSales(packets, sales);
    setLocal("packets", packets);
  }

  setLocal("sales", sales);
  return finalSale;
}

export function deleteSale(id: string): boolean {
  const sales = getStoredSales();
  const packets = getStoredPackets();

  const saleToDelete = sales.find((s) => s.id === id);
  if (saleToDelete && Array.isArray(saleToDelete.items)) {
    // If sale was already fully returned on approval memo, items were already restored to vault during settlement
    if (saleToDelete.approval_status !== "returned") {
      for (const item of saleToDelete.items) {
        if (item.is_returned || (Number(item.pieces) === 0 && Number(item.weight) === 0)) continue;
        const pIdx = packets.findIndex(
          (p) =>
            (item.packet_id && p.id === item.packet_id) ||
            p.packet_number.toLowerCase() === (item.packet_number || "").toLowerCase()
        );
        if (pIdx >= 0) {
          packets[pIdx].pieces = (packets[pIdx].pieces || 0) + (item.is_uncountable ? 0 : (Number(item.pieces) || 0));
          packets[pIdx].weight = Number(((packets[pIdx].weight || 0) + (Number(item.weight) || 0)).toFixed(2));
          packets[pIdx].status = "in_stock";
          packets[pIdx].buyer_name = "";
          packets[pIdx].sale_date = "";
          packets[pIdx].sold_price = undefined;
          packets[pIdx].sold_rate_per_unit = undefined;
          packets[pIdx].sale_invoice_id = undefined;
          packets[pIdx].is_approval = false;
          packets[pIdx].approval_status = undefined;
          const pktHasGenuine = hasGenuineIndividualWeights(packets[pIdx]);
          if (pktHasGenuine) {
            if (Array.isArray(packets[pIdx].stone_details)) {
              for (const sd of packets[pIdx].stone_details) {
                if (sd.status === "sold" || sd.status === "on_approval") {
                  if (!item.stone_id || sd.id === item.stone_id) {
                    sd.status = "in_stock";
                  }
                }
              }
            }
          } else {
            // For unweighted parcels, restore piece count and carat weight without locking dummy stone weights
            if (Array.isArray(packets[pIdx].stone_details)) {
              for (const sd of packets[pIdx].stone_details) {
                if (sd.status === "sold" || sd.status === "on_approval") {
                  if (!item.stone_id || sd.id === item.stone_id) {
                    sd.status = "in_stock";
                    sd.weight = 0;
                  }
                }
              }
            }
            packets[pIdx].stone_weights = undefined;
          }
          if (packets[pIdx].purchase_rate_per_unit) {
            packets[pIdx].purchase_price = Math.round(packets[pIdx].purchase_rate_per_unit * packets[pIdx].weight);
          }
          if (packets[pIdx].sale_rate_per_unit) {
            packets[pIdx].sale_price = Math.round(packets[pIdx].sale_rate_per_unit * packets[pIdx].weight);
          }
        }
      }
      const filtered = sales.filter((s) => s.id !== id);
      healPacketsWithSales(packets, filtered);
      setLocal("packets", packets);
      setLocal("sales", filtered);
      return true;
    }
  }

  const filtered = sales.filter((s) => s.id !== id);
  setLocal("sales", filtered);
  return true;
}

export function markSaleFullPaymentReceived(saleId: string, paymentMode = "Cash"): GemSale | null {
  const sales = getStoredSales();
  const idx = sales.findIndex((s) => s.id === saleId);
  if (idx < 0) return null;

  const sale = sales[idx];
  const remaining = sale.balance;
  if (remaining <= 0) return sale;

  const now = new Date().toISOString();
  const newPayment = {
    id: "pm-" + Math.random().toString(36).substring(2, 9),
    date: now.slice(0, 10),
    amount: remaining,
    mode: (paymentMode || "Cash") as "Cash" | "Bank Wire / NEFT" | "Cheque" | "Angadia" | "UPI" | "Other",
    note: "Full payment received & balance cleared",
  };

  const payments = [...(sale.payments || []), newPayment];
  const updated: GemSale = {
    ...sale,
    payments,
    paid_amount: sale.total,
    balance: 0,
    payment_status: "cleared",
  };

  sales[idx] = updated;
  setLocal("sales", sales);
  return updated;
}

export function addPaymentToSale(saleId: string, payment: { amount: number; mode: any; date?: string; note?: string }): GemSale | null {
  const sales = getStoredSales();
  const idx = sales.findIndex((s) => s.id === saleId);
  if (idx < 0) return null;

  const sale = sales[idx];
  const total = Number(sale.total) || 0;
  const currentPaid = (sale.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingDue = Math.max(0, Math.round((total - currentPaid) * 100) / 100);
  const requestedAmt = Number(payment.amount) || 0;

  if (requestedAmt <= 0) return sale;
  if (requestedAmt > remainingDue) {
    throw new Error(`Payment amount (₹${requestedAmt}) cannot exceed remaining invoice balance due of ₹${remainingDue}`);
  }

  const newPayment: GemSalePayment = {
    id: "pm-" + Math.random().toString(36).substring(2, 9),
    date: payment.date || new Date().toISOString().slice(0, 10),
    amount: requestedAmt,
    mode: payment.mode || "Bank Wire / NEFT",
    note: payment.note || "",
  };

  const payments = [...(sale.payments || []), newPayment];
  const paid_amount = Math.min(total, payments.reduce((sum, p) => sum + p.amount, 0));
  const balance = Math.max(0, Math.round((total - paid_amount) * 100) / 100);
  const payment_status = balance <= 0 ? "cleared" : paid_amount > 0 ? "partial" : "unpaid";

  const updated: GemSale = {
    ...sale,
    payments,
    paid_amount,
    balance,
    payment_status,
  };

  sales[idx] = updated;
  setLocal("sales", sales);
  return updated;
}

// -------------------------------------------------------------
// Brokerage (Third-Party Deals)
// -------------------------------------------------------------
export function getStoredBrokerage(): GemBrokerage[] {
  return getLocal<GemBrokerage[]>("brokerage", DEFAULT_BROKERAGE);
}

export function saveBrokerageDeal(dealData: any): GemBrokerage {
  const deals = getStoredBrokerage();
  const now = new Date().toISOString();

  const weight = Number(dealData.weight) || 1.0;
  let buyRate = Number(dealData.buy_rate_per_unit) || 0;
  let sellRate = Number(dealData.sell_rate_per_unit) || 0;
  let buy = Number(dealData.buy_amount) || 0;
  let sell = Number(dealData.sell_amount) || Number(dealData.deal_value) || 0;

  if (buyRate > 0) {
    buy = Math.round(buyRate * weight);
  } else if (buy > 0 && weight > 0) {
    buyRate = Math.round(buy / weight);
  }

  if (sellRate > 0) {
    sell = Math.round(sellRate * weight);
  } else if (sell > 0 && weight > 0) {
    sellRate = Math.round(sell / weight);
  }

  const dealVal = sell || buy;
  
  // Calculate commission: spread (sell - buy) or rate difference * weight
  let commAmt = Number(dealData.commission_amount) || 0;
  if (sell && buy && sell >= buy) {
    commAmt = sell - buy;
  } else if (sellRate && buyRate && sellRate >= buyRate) {
    commAmt = Math.round((sellRate - buyRate) * weight);
  } else if (!commAmt && dealData.brokerage_percent) {
    commAmt = Math.round((dealVal * Number(dealData.brokerage_percent)) / 100);
  }

  // Strictly clamp counterparty amounts to stated limits
  let paidSeller = Math.min(buy, Math.max(0, Number(dealData.amount_paid_to_seller) || 0));
  let recvBuyer = Math.min(sell, Math.max(0, Number(dealData.amount_received_from_buyer) || 0));
  const rec = Math.min(commAmt, Math.max(0, Number(dealData.received_amount) || 0));
  const bal = Math.max(0, commAmt - rec);
  const status = bal <= 0 ? "received" : rec > 0 ? "partial" : "pending";

  const isSellerFullyPaid = buy > 0 ? paidSeller >= buy : paidSeller > 0;
  const isBuyerFullyRecv = sell > 0 ? recvBuyer >= sell : recvBuyer > 0;

  let computedDealSettlementStatus: GemBrokerage["deal_settlement_status"] = dealData.deal_settlement_status;
  if (isSellerFullyPaid && isBuyerFullyRecv) {
    computedDealSettlementStatus = "fully_settled";
  } else if (isSellerFullyPaid && !isBuyerFullyRecv) {
    computedDealSettlementStatus = "paid_seller_pending_buyer";
  } else if (!isSellerFullyPaid && isBuyerFullyRecv) {
    computedDealSettlementStatus = "paid_buyer_pending_seller";
  } else if (paidSeller > 0 || recvBuyer > 0) {
    computedDealSettlementStatus = "partial_settled";
  } else if (paidSeller === 0 && recvBuyer === 0) {
    computedDealSettlementStatus = "pending_both";
  }

  let finalDeal: GemBrokerage;

  if (dealData.id) {
    const idx = deals.findIndex((d) => d.id === dealData.id);
    if (idx >= 0) {
      const prev = deals[idx];
      let seller_payments = dealData.seller_payments || prev.seller_payments || [];
      let buyer_payments = dealData.buyer_payments || prev.buyer_payments || [];
      let commission_payments = dealData.commission_payments || prev.commission_payments || [];

      // If new payment amounts were set directly from settlement and not yet in history
      if (paidSeller > 0 && seller_payments.length === 0) {
        seller_payments = [
          {
            id: "sp-init-" + Math.random().toString(36).substring(2, 7),
            date: dealData.date_paid_to_seller || now.slice(0, 10),
            amount: paidSeller,
            mode: dealData.mode_paid_to_seller || "Bank Wire / NEFT",
            note: dealData.note_paid_to_seller || "Initial seller settlement payment",
          },
        ];
      }
      if (recvBuyer > 0 && buyer_payments.length === 0) {
        buyer_payments = [
          {
            id: "bp-init-" + Math.random().toString(36).substring(2, 7),
            date: dealData.date_received_from_buyer || now.slice(0, 10),
            amount: recvBuyer,
            mode: dealData.mode_received_from_buyer || "Bank Wire / NEFT",
            note: dealData.note_received_from_buyer || "Initial buyer payment received",
          },
        ];
      }
      if (rec > 0 && commission_payments.length === 0) {
        commission_payments = [
          {
            id: "cp-init-" + Math.random().toString(36).substring(2, 7),
            date: dealData.settlement_date || now.slice(0, 10),
            amount: rec,
            mode: dealData.payment_mode || "Bank Wire / NEFT",
            note: "Commission collection",
          },
        ];
      }

      // Ensure totals are synchronized with logged payments
      if (seller_payments.length > 0) {
        const sumSp = seller_payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        paidSeller = Math.min(buy, Math.max(paidSeller, sumSp));
      }
      if (buyer_payments.length > 0) {
        const sumBp = buyer_payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        recvBuyer = Math.min(sell, Math.max(recvBuyer, sumBp));
      }

      // Re-evaluate settlement status with verified totals
      const isSellerDone = buy > 0 ? paidSeller >= buy : paidSeller > 0;
      const isBuyerDone = sell > 0 ? recvBuyer >= sell : recvBuyer > 0;
      if (isSellerDone && isBuyerDone) {
        computedDealSettlementStatus = "fully_settled";
      } else if (isSellerDone && !isBuyerDone) {
        computedDealSettlementStatus = "paid_seller_pending_buyer";
      } else if (!isSellerDone && isBuyerDone) {
        computedDealSettlementStatus = "paid_buyer_pending_seller";
      } else if (paidSeller > 0 || recvBuyer > 0) {
        computedDealSettlementStatus = "partial_settled";
      } else {
        computedDealSettlementStatus = "pending_both";
      }

      finalDeal = {
        ...prev,
        ...dealData,
        company_name: dealData.company_name || prev.company_name || "Shreeji Gems",
        weight,
        buy_rate_per_unit: buyRate,
        sell_rate_per_unit: sellRate,
        buy_amount: buy,
        sell_amount: sell,
        deal_value: dealVal,
        commission_amount: commAmt,
        received_amount: rec,
        balance_receivable: bal,
        settlement_status: status,
        deal_settlement_status: computedDealSettlementStatus,
        amount_paid_to_seller: paidSeller,
        amount_received_from_buyer: recvBuyer,
        seller_payments,
        buyer_payments,
        commission_payments,
      };
      deals[idx] = finalDeal;
    } else {
      finalDeal = {
        id: dealData.id,
        deal_no: dealData.deal_no || `BRK-${new Date().getFullYear()}-${String(deals.length + 1).padStart(2, "0")}`,
        date: dealData.date || now.slice(0, 10),
        company_name: dealData.company_name || "Shreeji Gems",
        seller_name: dealData.seller_name,
        buyer_name: dealData.buyer_name,
        particulars: dealData.particulars,
        shape: dealData.shape || "Cushion",
        weight,
        unit: dealData.unit || "cts",
        pieces: Number(dealData.pieces) || 1,
        mm_size: dealData.mm_size || "",
        cert_lab: dealData.cert_lab || "",
        buy_rate_per_unit: buyRate,
        sell_rate_per_unit: sellRate,
        buy_amount: buy,
        sell_amount: sell,
        deal_value: dealVal,
        brokerage_percent: Number(dealData.brokerage_percent) || 1.5,
        commission_amount: commAmt,
        commission_from: dealData.commission_from || "both",
        settlement_status: status,
        received_amount: rec,
        balance_receivable: bal,
        deal_settlement_status: computedDealSettlementStatus || "pending_both",
        amount_paid_to_seller: paidSeller,
        date_paid_to_seller: dealData.date_paid_to_seller,
        mode_paid_to_seller: dealData.mode_paid_to_seller,
        note_paid_to_seller: dealData.note_paid_to_seller,
        amount_received_from_buyer: recvBuyer,
        date_received_from_buyer: dealData.date_received_from_buyer,
        mode_received_from_buyer: dealData.mode_received_from_buyer,
        note_received_from_buyer: dealData.note_received_from_buyer,
        seller_payments: dealData.seller_payments || [],
        buyer_payments: dealData.buyer_payments || [],
        commission_payments: dealData.commission_payments || [],
        payment_mode: dealData.payment_mode || "Bank Wire / NEFT",
        reflect_in_sales: dealData.reflect_in_sales !== false,
        notes: dealData.notes || "",
        created_at: now,
      };
      deals.unshift(finalDeal);
    }
  } else {
    finalDeal = {
      id: "brk-" + Math.random().toString(36).substring(2, 9),
      deal_no: dealData.deal_no || `BRK-${new Date().getFullYear()}-${String(deals.length + 1).padStart(2, "0")}`,
      date: dealData.date || now.slice(0, 10),
      company_name: dealData.company_name || "Shreeji Gems",
      seller_name: dealData.seller_name,
      buyer_name: dealData.buyer_name,
      particulars: dealData.particulars,
      shape: dealData.shape || "Cushion",
      weight,
      unit: dealData.unit || "cts",
      pieces: Number(dealData.pieces) || 1,
      mm_size: dealData.mm_size || "",
      cert_lab: dealData.cert_lab || "",
      buy_rate_per_unit: buyRate,
      sell_rate_per_unit: sellRate,
      buy_amount: buy,
      sell_amount: sell,
      deal_value: dealVal,
      brokerage_percent: Number(dealData.brokerage_percent) || 1.5,
      commission_amount: commAmt,
      commission_from: dealData.commission_from || "both",
      settlement_status: status,
      deal_settlement_status: computedDealSettlementStatus || "pending_both",
      amount_paid_to_seller: paidSeller,
      date_paid_to_seller: dealData.date_paid_to_seller,
      mode_paid_to_seller: dealData.mode_paid_to_seller,
      note_paid_to_seller: dealData.note_paid_to_seller,
      amount_received_from_buyer: recvBuyer,
      date_received_from_buyer: dealData.date_received_from_buyer,
      mode_received_from_buyer: dealData.mode_received_from_buyer,
      note_received_from_buyer: dealData.note_received_from_buyer,
      seller_payments: dealData.seller_payments || [],
      buyer_payments: dealData.buyer_payments || [],
      commission_payments: dealData.commission_payments || [],
      received_amount: rec,
      balance_receivable: bal,
      settlement_date: dealData.settlement_date,
      payment_mode: dealData.payment_mode || "Bank Wire / NEFT",
      reflect_in_sales: dealData.reflect_in_sales !== false,
      notes: dealData.notes || "",
      created_at: now,
    };
    deals.unshift(finalDeal);
  }

  setLocal("brokerage", deals);
  if (finalDeal.seller_name) {
    saveBuyer({ name: finalDeal.seller_name, company: finalDeal.seller_name, notes: "Seller (Brokerage)" });
    saveSupplier(finalDeal.seller_name);
  }
  if (finalDeal.buyer_name) {
    saveBuyer({ name: finalDeal.buyer_name, company: finalDeal.buyer_name, notes: "Buyer (Brokerage)" });
  }
  return finalDeal;
}

export function addPaymentToBrokerageSeller(
  dealId: string,
  payment: { amount: number; mode: any; date?: string; note?: string }
): GemBrokerage | null {
  const deals = getStoredBrokerage();
  const idx = deals.findIndex((d) => d.id === dealId);
  if (idx < 0) return null;

  const deal = deals[idx];
  const buyAmt = Number(deal.buy_amount) || 0;
  const currentPaid = (deal.seller_payments && deal.seller_payments.length > 0)
    ? deal.seller_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    : Number(deal.amount_paid_to_seller) || 0;
  const remainingDue = Math.max(0, Math.round((buyAmt - currentPaid) * 100) / 100);
  const requestedAmt = Number(payment.amount) || 0;

  if (requestedAmt <= 0) return deal;
  if (requestedAmt > remainingDue) {
    throw new Error(`Payment amount (₹${requestedAmt}) cannot exceed remaining seller payable of ₹${remainingDue}`);
  }

  const newPayment: GemSalePayment = {
    id: "spm-" + Math.random().toString(36).substring(2, 9),
    date: payment.date || new Date().toISOString().slice(0, 10),
    amount: requestedAmt,
    mode: payment.mode || "Bank Wire / NEFT",
    note: payment.note || "",
  };

  const seller_payments = [...(deal.seller_payments || []), newPayment];
  const amount_paid_to_seller = Math.min(buyAmt, seller_payments.reduce((sum, p) => sum + p.amount, 0));

  const isSellerFullyPaid = buyAmt > 0 ? amount_paid_to_seller >= buyAmt : amount_paid_to_seller > 0;
  const sellAmt = Number(deal.sell_amount || deal.deal_value) || 0;
  const recvBuyer = Number(deal.amount_received_from_buyer) || 0;
  const isBuyerFullyRecv = sellAmt > 0 ? recvBuyer >= sellAmt : recvBuyer > 0;

  let deal_settlement_status: GemBrokerage["deal_settlement_status"] = "pending_both";
  if (isSellerFullyPaid && isBuyerFullyRecv) deal_settlement_status = "fully_settled";
  else if (isSellerFullyPaid && !isBuyerFullyRecv) deal_settlement_status = "paid_seller_pending_buyer";
  else if (!isSellerFullyPaid && isBuyerFullyRecv) deal_settlement_status = "paid_buyer_pending_seller";
  else if (amount_paid_to_seller > 0 || recvBuyer > 0) deal_settlement_status = "partial_settled";

  const updated: GemBrokerage = {
    ...deal,
    seller_payments,
    amount_paid_to_seller,
    date_paid_to_seller: newPayment.date,
    mode_paid_to_seller: newPayment.mode,
    note_paid_to_seller: newPayment.note,
    deal_settlement_status,
  };

  deals[idx] = updated;
  setLocal("brokerage", deals);
  return updated;
}

export function addPaymentToBrokerageBuyer(
  dealId: string,
  payment: { amount: number; mode: any; date?: string; note?: string }
): GemBrokerage | null {
  const deals = getStoredBrokerage();
  const idx = deals.findIndex((d) => d.id === dealId);
  if (idx < 0) return null;

  const deal = deals[idx];
  const sellAmt = Number(deal.sell_amount || deal.deal_value) || 0;
  const currentRecv = (deal.buyer_payments && deal.buyer_payments.length > 0)
    ? deal.buyer_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    : Number(deal.amount_received_from_buyer) || 0;
  const remainingDue = Math.max(0, Math.round((sellAmt - currentRecv) * 100) / 100);
  const requestedAmt = Number(payment.amount) || 0;

  if (requestedAmt <= 0) return deal;
  if (requestedAmt > remainingDue) {
    throw new Error(`Receipt amount (₹${requestedAmt}) cannot exceed remaining buyer receivable of ₹${remainingDue}`);
  }

  const newPayment: GemSalePayment = {
    id: "bpm-" + Math.random().toString(36).substring(2, 9),
    date: payment.date || new Date().toISOString().slice(0, 10),
    amount: requestedAmt,
    mode: payment.mode || "Bank Wire / NEFT",
    note: payment.note || "",
  };

  const buyer_payments = [...(deal.buyer_payments || []), newPayment];
  const amount_received_from_buyer = Math.min(sellAmt, buyer_payments.reduce((sum, p) => sum + p.amount, 0));

  const buyAmt = Number(deal.buy_amount) || 0;
  const paidSeller = Number(deal.amount_paid_to_seller) || 0;
  const isSellerFullyPaid = buyAmt > 0 ? paidSeller >= buyAmt : paidSeller > 0;
  const isBuyerFullyRecv = sellAmt > 0 ? amount_received_from_buyer >= sellAmt : amount_received_from_buyer > 0;

  let deal_settlement_status: GemBrokerage["deal_settlement_status"] = "pending_both";
  if (isSellerFullyPaid && isBuyerFullyRecv) deal_settlement_status = "fully_settled";
  else if (isSellerFullyPaid && !isBuyerFullyRecv) deal_settlement_status = "paid_seller_pending_buyer";
  else if (!isSellerFullyPaid && isBuyerFullyRecv) deal_settlement_status = "paid_buyer_pending_seller";
  else if (paidSeller > 0 || amount_received_from_buyer > 0) deal_settlement_status = "partial_settled";

  const updated: GemBrokerage = {
    ...deal,
    buyer_payments,
    amount_received_from_buyer,
    date_received_from_buyer: newPayment.date,
    mode_received_from_buyer: newPayment.mode,
    note_received_from_buyer: newPayment.note,
    deal_settlement_status,
  };

  deals[idx] = updated;
  setLocal("brokerage", deals);
  return updated;
}

export function addPaymentToBrokerageCommission(
  dealId: string,
  payment: { amount: number; mode: any; date?: string; note?: string }
): GemBrokerage | null {
  const deals = getStoredBrokerage();
  const idx = deals.findIndex((d) => d.id === dealId);
  if (idx < 0) return null;

  const deal = deals[idx];
  const commAmt = Number(deal.commission_amount) || 0;
  const currentRecv = (deal.commission_payments && deal.commission_payments.length > 0)
    ? deal.commission_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    : Number(deal.received_amount) || 0;
  const remainingDue = Math.max(0, Math.round((commAmt - currentRecv) * 100) / 100);
  const requestedAmt = Number(payment.amount) || 0;

  if (requestedAmt <= 0) return deal;
  if (requestedAmt > remainingDue) {
    throw new Error(`Commission payment (₹${requestedAmt}) cannot exceed remaining commission balance of ₹${remainingDue}`);
  }

  const newPayment: GemSalePayment = {
    id: "cpm-" + Math.random().toString(36).substring(2, 9),
    date: payment.date || new Date().toISOString().slice(0, 10),
    amount: requestedAmt,
    mode: payment.mode || "Bank Wire / NEFT",
    note: payment.note || "",
  };

  const commission_payments = [...(deal.commission_payments || []), newPayment];
  const received_amount = Math.min(commAmt, commission_payments.reduce((sum, p) => sum + p.amount, 0));
  const balance_receivable = Math.max(0, commAmt - received_amount);
  const settlement_status = balance_receivable <= 0 ? "received" : received_amount > 0 ? "partial" : "pending";

  const updated: GemBrokerage = {
    ...deal,
    commission_payments,
    received_amount,
    balance_receivable,
    settlement_status,
    settlement_date: newPayment.date,
    payment_mode: newPayment.mode,
  };

  deals[idx] = updated;
  setLocal("brokerage", deals);
  return updated;
}

export function deleteBrokerageDeal(id: string): boolean {
  const deals = getStoredBrokerage();
  const filtered = deals.filter((d) => d.id !== id);
  setLocal("brokerage", filtered);
  return true;
}

// -------------------------------------------------------------
// Purchases (Intake)
// -------------------------------------------------------------
export function getStoredPurchases(): GemPurchase[] {
  return getLocal<GemPurchase[]>("purchases", DEFAULT_PURCHASES);
}

export function savePurchase(purchaseData: any): GemPurchase {
  const purchases = getStoredPurchases();
  const packets = getStoredPackets();
  const now = new Date().toISOString();

  const total = Number(purchaseData.total_cost) || 0;
  const paid = Number(purchaseData.paid_amount) || 0;
  const balance = Math.max(0, total - paid);
  const status = balance <= 0 ? "cleared" : paid > 0 ? "partial" : "unpaid";
  const creditDays = Number(purchaseData.credit_days) || 0;
  const dueDate = purchaseData.due_date || (creditDays > 0 ? new Date(new Date(purchaseData.date || now).getTime() + creditDays * 86400000).toISOString().slice(0, 10) : undefined);

  let payments: GemSalePayment[] = purchaseData.payments || [];
  if (paid > 0 && payments.length === 0) {
    payments = [
      {
        id: "pm-" + Math.random().toString(36).substring(2, 9),
        date: purchaseData.date || now.slice(0, 10),
        amount: paid,
        mode: (purchaseData.payment_mode || "Bank Wire / NEFT") as any,
        note: "Initial payment on purchase booking",
      },
    ];
  }

  const totalBrokerage = Number(purchaseData.brokerage_amount) || 0;
  const initialBrokerPaid = Number(purchaseData.brokerage_paid_amount) || (purchaseData.brokerage_paid ? totalBrokerage : 0);
  let brokerPayments: GemSalePayment[] = purchaseData.broker_payments || [];
  if (initialBrokerPaid > 0 && brokerPayments.length === 0) {
    brokerPayments = [
      {
        id: "pbm-" + Math.random().toString(36).substring(2, 9),
        date: purchaseData.date || now.slice(0, 10),
        amount: initialBrokerPaid,
        mode: (purchaseData.payment_mode || "Bank Wire / NEFT") as any,
        note: "Initial broker fee on purchase booking",
      },
    ];
  }
  const brokerBalDue = purchaseData.brokerage_balance_due !== undefined ? Number(purchaseData.brokerage_balance_due) : Math.max(0, totalBrokerage - initialBrokerPaid);
  const isBrokerPaid = totalBrokerage > 0 && brokerBalDue <= 0;

  let newPurchase: GemPurchase = {
    id: purchaseData.id || "pur-" + Math.random().toString(36).substring(2, 9),
    purchase_no: purchaseData.purchase_no || `PUR-${Date.now().toString().slice(-4)}`,
    date: purchaseData.date || now.slice(0, 10),
    company_name: purchaseData.company_name || "Shreeji Gems",
    supplier_name: purchaseData.supplier_name,
    supplier_phone: purchaseData.supplier_phone || "",
    supplier_city: purchaseData.supplier_city || "",
    lot_ref: purchaseData.lot_ref || "",
    items: purchaseData.items || [],
    total_cost: total,
    paid_amount: paid,
    balance_payable: balance,
    payment_status: status,
    payment_mode: purchaseData.payment_mode || "Bank Wire / NEFT",
    credit_days: creditDays,
    due_date: dueDate,
    payments,
    broker_name: purchaseData.broker_name || "",
    broker_phone: purchaseData.broker_phone || "",
    brokerage_type: purchaseData.brokerage_type || "percent",
    brokerage_rate: Number(purchaseData.brokerage_rate) || 0,
    brokerage_amount: totalBrokerage,
    brokerage_paid: isBrokerPaid,
    brokerage_paid_amount: initialBrokerPaid,
    brokerage_balance_due: brokerBalDue,
    broker_payments: brokerPayments,
    notes: purchaseData.notes || "",
    created_at: now,
  };

  if (newPurchase.supplier_name) {
    saveSupplier(newPurchase.supplier_name);
    saveBuyer({
      name: newPurchase.supplier_name,
      company: newPurchase.supplier_name,
      phone: newPurchase.supplier_phone || "",
      city: newPurchase.supplier_city || "",
      notes: "Supplier / Seller",
    });
  }
  if (newPurchase.broker_name) {
    saveBroker(newPurchase.broker_name);
    saveBuyer({
      name: newPurchase.broker_name,
      phone: newPurchase.broker_phone || "",
      notes: "Procurement Broker",
    });
  }
  if (Array.isArray(newPurchase.items)) {
    for (const it of newPurchase.items) {
      if (it.particulars) saveCustomParticular(it.particulars);
    }
  }

  const existingIdx = purchases.findIndex((p) => p.id === newPurchase.id);
  if (existingIdx >= 0) {
    purchases[existingIdx] = newPurchase;
  } else {
    purchases.unshift(newPurchase);
  }
  setLocal("purchases", purchases);

  // Auto-intake items into Vault Packets if not already created
  if (Array.isArray(newPurchase.items)) {
    for (const item of newPurchase.items) {
      const existingPkt = packets.find(
        (p) =>
          normalizeBoxName(p.box_name) === normalizeBoxName(item.box_name || "Box 1") &&
          p.packet_number.trim().toLowerCase() === item.packet_number.trim().toLowerCase()
      );
      if (!existingPkt) {
        savePacket({
          packet_number: item.packet_number,
          box_name: item.box_name || "Box 1",
          particulars: item.particulars,
          shape: item.shape,
          weight: item.weight,
          unit: item.unit || "cts",
          pieces: item.is_uncountable ? 0 : (item.pieces || 1),
          is_uncountable: !!item.is_uncountable,
          stone_weight: item.stone_weight,
          stone_weights: item.stone_weights,
          mm_size: item.mm_size || "",
          purchase_price: item.cost_price,
          purchase_rate_per_unit: item.purchase_rate_per_unit || (item.weight ? Math.round(item.cost_price / item.weight) : 0),
          purchase_date: newPurchase.date,
          supplier_name: newPurchase.supplier_name,
          sale_price: item.target_sale_price,
          sale_rate_per_unit: item.sale_rate_per_unit || (item.weight ? Math.round(item.target_sale_price / item.weight) : 0),
          company_name: newPurchase.company_name,
          origin: item.origin,
          treatment: item.treatment,
          cert_lab: item.cert_lab,
          hsn_code: item.hsn_code,
          stone_details: item.stone_details,
          sub_gems: item.sub_gems,
          purchase_id: newPurchase.id,
          purchase_no: newPurchase.purchase_no,
        } as any);
      }
    }
  }

  return newPurchase;
}

export function deletePurchase(id: string): boolean {
  const purchases = getStoredPurchases();
  const target = purchases.find((p) => p.id === id);
  if (!target) return false;

  // Cascade delete: remove created packets and stones from vault inventory
  const packets = getStoredPackets();
  const generatedPacketNumbers = new Set(
    (target.items || []).map((it) => (it.packet_number || "").trim().toLowerCase()).filter(Boolean)
  );
  const targetItemPktNumbers = generatedPacketNumbers;

  const remainingPackets = packets.filter((pkt) => {
    if ((pkt as any).purchase_id === target.id) return false;
    const pktNumLower = (pkt.packet_number || "").trim().toLowerCase();
    if (targetItemPktNumbers.has(pktNumLower)) {
      const sameSupplier = (pkt.supplier_name || "").trim().toLowerCase() === (target.supplier_name || "").trim().toLowerCase();
      const sameDate = !pkt.purchase_date || !target.date || pkt.purchase_date.slice(0, 10) === target.date.slice(0, 10);
      if (sameSupplier || sameDate) {
        return false;
      }
    }
    return true;
  });

  setLocal("packets", remainingPackets);
  const filtered = purchases.filter((p) => p.id !== id);
  setLocal("purchases", filtered);
  return true;
}

export function cancelPurchase(id: string, reason?: string): GemPurchase | null {
  const purchases = getStoredPurchases();
  const idx = purchases.findIndex((p) => p.id === id);
  if (idx < 0) return null;

  const pur = purchases[idx];
  pur.status = "cancelled";
  pur.cancelled_date = new Date().toISOString();
  pur.cancelled_reason = reason || "Purchase cancelled and returned to supplier";
  const target = pur;

  // Remove the purchase's packets from active vault inventory
  const packets = getStoredPackets();
  const generatedPacketNumbers = new Set(
    (target.items || []).map((it) => (it.packet_number || "").trim().toLowerCase()).filter(Boolean)
  );
  const targetItemPktNumbers = generatedPacketNumbers;

  const remainingPackets = packets.filter((pkt) => {
    if ((pkt as any).purchase_id === target.id) return false;
    const pktNumLower = (pkt.packet_number || "").trim().toLowerCase();
    if (targetItemPktNumbers.has(pktNumLower)) {
      const sameSupplier = (pkt.supplier_name || "").trim().toLowerCase() === (target.supplier_name || "").trim().toLowerCase();
      const sameDate = !pkt.purchase_date || !target.date || pkt.purchase_date.slice(0, 10) === target.date.slice(0, 10);
      if (sameSupplier || sameDate) {
        return false;
      }
    }
    return true;
  });

  setLocal("packets", remainingPackets);
  purchases[idx] = target;
  setLocal("purchases", purchases);
  return target;
}


export function addPaymentToPurchase(
  purchaseId: string,
  payment: { amount: number; mode: any; date?: string; note?: string }
): GemPurchase | null {
  const purchases = getStoredPurchases();
  const idx = purchases.findIndex((p) => p.id === purchaseId);
  if (idx < 0) return null;

  const purchase = purchases[idx];
  const totalCost = Number(purchase.total_cost) || 0;
  const currentPaid = (purchase.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingDue = Math.max(0, Math.round((totalCost - currentPaid) * 100) / 100);
  const requestedAmt = Number(payment.amount) || 0;

  if (requestedAmt <= 0) return purchase;
  if (requestedAmt > remainingDue) {
    throw new Error(`Payment amount (₹${requestedAmt}) cannot exceed remaining balance payable of ₹${remainingDue}`);
  }

  const newPayment: GemSalePayment = {
    id: "pm-" + Math.random().toString(36).substring(2, 9),
    date: payment.date || new Date().toISOString().slice(0, 10),
    amount: requestedAmt,
    mode: payment.mode || "Bank Wire / NEFT",
    note: payment.note || "",
  };

  const payments = [...(purchase.payments || []), newPayment];
  const paid_amount = Math.min(totalCost, payments.reduce((sum, p) => sum + p.amount, 0));
  const balance_payable = Math.max(0, Math.round((totalCost - paid_amount) * 100) / 100);
  const payment_status = balance_payable <= 0 ? "cleared" : paid_amount > 0 ? "partial" : "unpaid";

  const updated: GemPurchase = {
    ...purchase,
    payments,
    paid_amount,
    balance_payable,
    payment_status,
  };

  purchases[idx] = updated;
  setLocal("purchases", purchases);
  return updated;
}

export function markPurchaseFullPaymentPaid(
  purchaseId: string,
  paymentMode = "Bank Wire / NEFT"
): GemPurchase | null {
  const purchases = getStoredPurchases();
  const idx = purchases.findIndex((p) => p.id === purchaseId);
  if (idx < 0) return null;

  const pur = purchases[idx];
  const remaining = pur.balance_payable;
  if (remaining <= 0) return pur;

  const now = new Date().toISOString();
  const newPayment: GemSalePayment = {
    id: "pm-" + Math.random().toString(36).substring(2, 9),
    date: now.slice(0, 10),
    amount: remaining,
    mode: (paymentMode || "Bank Wire / NEFT") as any,
    note: "Full supplier balance cleared",
  };

  const payments = [...(pur.payments || []), newPayment];
  const updated: GemPurchase = {
    ...pur,
    payments,
    paid_amount: pur.total_cost,
    balance_payable: 0,
    payment_status: "cleared",
  };

  purchases[idx] = updated;
  setLocal("purchases", purchases);
  return updated;
}

export interface ApprovalItemSettlement {
  item_index?: number;
  item_id?: string;
  stone_id?: string;
  packet_id?: string;
  packet_number: string;
  particulars?: string;
  shape?: string;
  pieces_taken: number;
  weight_taken: number;
  pieces_returned: number;
  weight_returned: number;
  rate_per_unit?: number;
  total_price?: number;
  cost_price?: number;
  stone_weights?: number[];
  taken_stone_weights?: number[];
  returned_stone_weights?: number[];
}

export function settleApprovalMemo(
  saleId: string,
  settlementItems: ApprovalItemSettlement[],
  options?: {
    notes?: string;
  }
): { success: boolean; sale?: GemSale; error?: string } {
  const sales = getStoredSales();
  const packets = getStoredPackets();
  const idx = sales.findIndex((s) => s.id === saleId);
  if (idx < 0) return { success: false, error: "Approval voucher not found." };

  const sale = sales[idx];
  const now = new Date().toISOString();

  let totalPiecesTaken = 0;
  let totalPiecesReturned = 0;
  const updatedItems: GemSaleItem[] = [];
  const returnedItems: GemSaleItem[] = [];

  // Track inventory restorations per packet
  const touchedPacketIndices = new Set<number>();

  for (let stIdx = 0; stIdx < settlementItems.length; stIdx++) {
    const st = settlementItems[stIdx];
    // Disambiguate multi-stone packet items by index, stone_id, or particulars
    const origItem =
      (st.item_index !== undefined && sale.items && sale.items[st.item_index]) ||
      (st.stone_id && sale.items?.find((it) => it.stone_id === st.stone_id)) ||
      sale.items?.find((it, i) => i === stIdx && (it.packet_number.toLowerCase() === (st.packet_number || "").toLowerCase() || it.packet_id === st.packet_id)) ||
      sale.items?.find((it) => (it.packet_id === st.packet_id || it.packet_number.toLowerCase() === (st.packet_number || "").toLowerCase()) && (it.particulars || "").trim().toLowerCase() === (st.particulars || "").trim().toLowerCase()) ||
      sale.items?.find((it) => it.packet_id === st.packet_id || it.packet_number.toLowerCase() === (st.packet_number || "").toLowerCase());

    const pIdx = packets.findIndex(
      (p) => (st.packet_id && p.id === st.packet_id) || p.packet_number.toLowerCase() === (st.packet_number || "").toLowerCase()
    );

    const isUncountable = Boolean(
      origItem?.is_uncountable || (pIdx >= 0 && packets[pIdx].is_uncountable)
    );

    const origWeight = origItem?.original_weight !== undefined ? origItem.original_weight : (origItem?.weight || (st.weight_taken + st.weight_returned));
    const origPieces = origItem?.original_pieces !== undefined ? origItem.original_pieces : (origItem?.pieces !== undefined ? origItem.pieces : (isUncountable ? 0 : (st.pieces_taken + st.pieces_returned)));

    // Safety Invariant: For countable stones, carats cannot be returned without a piece,
    // and single-piece stones are strictly whole (either 100% taken or 100% returned).
    if (!isUncountable) {
      if (origPieces === 1) {
        if (st.pieces_taken > 0) {
          st.pieces_taken = 1;
          st.weight_taken = origWeight;
          st.pieces_returned = 0;
          st.weight_returned = 0;
        } else {
          st.pieces_taken = 0;
          st.weight_taken = 0;
          st.pieces_returned = 1;
          st.weight_returned = origWeight;
        }
      } else {
        if (st.pieces_returned === 0) {
          st.weight_returned = 0;
        }
        if (st.pieces_taken === 0) {
          st.weight_taken = 0;
        }
      }
    }

    totalPiecesTaken += st.pieces_taken;
    totalPiecesReturned += st.pieces_returned;

    if (st.pieces_taken > 0 && Number(st.weight_taken) <= 0) {
      st.weight_taken = origPieces > 0 ? Number(((origWeight / origPieces) * st.pieces_taken).toFixed(2)) : origWeight;
    }

    const rate = st.rate_per_unit || (origItem ? origItem.rate_per_unit : 0);
    const itemTaken = isUncountable ? st.weight_taken > 0 : st.pieces_taken > 0;
    const itemReturned = isUncountable ? st.weight_returned > 0 : st.pieces_returned > 0;

    const lineTotal = itemTaken ? Math.round(rate * st.weight_taken) : 0;
    const cost = origItem && (origItem.weight || 1) > 0 ? Math.round((origItem.cost_price / origItem.weight) * st.weight_taken) : 0;
    const gstRate = origItem?.gst_rate ?? 0.25;
    const gstAmt = Math.round(lineTotal * (gstRate / 100) * 100) / 100;

    const itemRecord: GemSaleItem = {
      ...(origItem || {
        packet_id: st.packet_id || "pkt-" + Date.now(),
        packet_number: st.packet_number,
        particulars: st.particulars || "Gemstone",
        shape: st.shape || "Oval",
        unit: "cts",
        mm_size: "",
      }),
      pieces: isUncountable ? 0 : st.pieces_taken,
      weight: st.weight_taken,
      rate_per_unit: rate,
      total_price: lineTotal,
      cost_price: cost,
      gst_rate: gstRate,
      gst_amount: gstAmt,
      original_weight: origWeight,
      original_pieces: origPieces,
      weight_taken: st.weight_taken,
      pieces_taken: isUncountable ? 0 : st.pieces_taken,
      weight_returned: st.weight_returned,
      pieces_returned: isUncountable ? 0 : st.pieces_returned,
      is_returned: isUncountable ? (st.weight_taken === 0 && st.weight_returned > 0) : (st.pieces_taken === 0 && st.pieces_returned > 0),
      is_uncountable: isUncountable,
    };

    if (Array.isArray(st.taken_stone_weights) && st.taken_stone_weights.length > 0) {
      itemRecord.stone_weights = st.taken_stone_weights;
    } else if (Array.isArray(origItem?.stone_weights) && origItem.stone_weights.length > 0 && st.pieces_taken > 0) {
      itemRecord.stone_weights = origItem.stone_weights.slice(0, st.pieces_taken);
    }

    if (itemTaken) {
      updatedItems.push(itemRecord);
    }

    // Only store in returnedItems if it was a 100% full return of this line item.
    // Partial returns are already tracked within itemRecord in updatedItems.
    if (!itemTaken && itemReturned) {
      const returnRec: GemSaleItem = {
        ...itemRecord,
        weight: st.weight_returned,
        pieces: isUncountable ? 0 : st.pieces_returned,
        is_returned: true,
        weight_taken: 0,
        pieces_taken: 0,
        weight_returned: st.weight_returned,
        pieces_returned: isUncountable ? 0 : st.pieces_returned,
        total_price: 0,
      };
      if (Array.isArray(st.returned_stone_weights) && st.returned_stone_weights.length > 0) {
        returnRec.stone_weights = st.returned_stone_weights;
      }
      returnedItems.push(returnRec);
    }

    // Restore returned pieces/carats to vault packet
    if (pIdx >= 0) {
      touchedPacketIndices.add(pIdx);
      const curPktPcs = Number(packets[pIdx].pieces) || 0;
      const curPktWt = Number(packets[pIdx].weight) || 0;

      if (st.pieces_returned > 0 || st.weight_returned > 0) {
        packets[pIdx].pieces = isUncountable ? 0 : (curPktPcs + st.pieces_returned);
        packets[pIdx].weight = Number((curPktWt + st.weight_returned).toFixed(2));

        const returnedWeights = Array.isArray(st.returned_stone_weights) && st.returned_stone_weights.length > 0
          ? st.returned_stone_weights
          : (Array.isArray(origItem?.stone_weights) && origItem.stone_weights.length > 0 && st.pieces_returned > 0
              ? origItem.stone_weights.slice(st.pieces_taken, st.pieces_taken + st.pieces_returned)
              : []);

        const pktHasGenuine = hasGenuineIndividualWeights(packets[pIdx]);
        if (pktHasGenuine) {
          if (Array.isArray(packets[pIdx].stone_details) && packets[pIdx].stone_details.length > 0) {
            if (origItem?.stone_id) {
              const sd = packets[pIdx].stone_details.find((s) => s.id === origItem.stone_id);
              if (sd) sd.status = "in_stock";
            } else {
              for (const retWt of returnedWeights) {
                const matchedSd = packets[pIdx].stone_details.find(
                  (sd) => sd.status === "on_approval" && Math.abs((sd.weight || 0) - retWt) <= 0.005
                );
                if (matchedSd) matchedSd.status = "in_stock";
              }
            }
            const validWts = packets[pIdx].stone_details
              .filter((s) => s.status === "in_stock")
              .map((s) => Number(s.weight) || 0)
              .filter((w) => w > 0);
            if (validWts.length > 0) {
              packets[pIdx].stone_weights = validWts;
            }
          } else if (returnedWeights.length > 0) {
            const curWts = Array.isArray(packets[pIdx].stone_weights) ? packets[pIdx].stone_weights : [];
            const nextWts = [...curWts];
            for (const rw of returnedWeights) {
              if (nextWts.length < (packets[pIdx].pieces || 0)) {
                nextWts.push(rw);
              }
            }
            packets[pIdx].stone_weights = nextWts;
          }
        } else {
          // Unweighted parcel or bulk inventory:
          // Strictly add pieces and carat weight back. Do not synthesize or store individual stone weights.
          if (Array.isArray(packets[pIdx].stone_details)) {
            packets[pIdx].stone_details.forEach((sd) => {
              if (sd.status === "on_approval" || !origItem?.stone_id || sd.id === origItem.stone_id) {
                sd.status = "in_stock";
                sd.weight = 0;
              }
            });
          }
          packets[pIdx].stone_weights = undefined;
        }
      }

      // Mark taken stones as sold in packet.stone_details
      if (st.pieces_taken > 0 || (isUncountable && st.weight_taken > 0)) {
        if (Array.isArray(packets[pIdx].stone_details) && packets[pIdx].stone_details.length > 0) {
          if (origItem?.stone_id) {
            const sd = packets[pIdx].stone_details.find((s) => s.id === origItem.stone_id);
            if (sd) sd.status = "sold";
          } else {
            const takenWeights = Array.isArray(st.taken_stone_weights) && st.taken_stone_weights.length > 0
              ? st.taken_stone_weights
              : (Array.isArray(origItem?.stone_weights) ? origItem.stone_weights.slice(0, st.pieces_taken) : []);
            for (const tkWt of takenWeights) {
              const matchedSd = packets[pIdx].stone_details.find(
                (sd) => sd.status === "on_approval" && Math.abs((sd.weight || 0) - tkWt) <= 0.005
              );
              if (matchedSd) matchedSd.status = "sold";
            }
          }
        }
      }
    }
  }

  // Update final status for all touched packets
  for (const pIdx of touchedPacketIndices) {
    const isUnc = Boolean(packets[pIdx].is_uncountable);

    // If packet has genuine individual stone weights, recalculate remaining pieces and weight directly from in-stock stones
    const details = packets[pIdx].stone_details;
    const inStock = Array.isArray(details) ? details.filter((s) => s.status === "in_stock") : [];
    const allInStockHaveWeights = inStock.length > 0 && inStock.every((s) => Number(s.weight) > 0);
    const pktHasGen = hasGenuineIndividualWeights(packets[pIdx]);

    if (pktHasGen && allInStockHaveWeights && details && !isUnc) {
      packets[pIdx].pieces = inStock.length;
      packets[pIdx].weight = Number(inStock.reduce((sum, s) => sum + (Number(s.weight) || 0), 0).toFixed(2));
      packets[pIdx].stone_weights = inStock.map((s) => Number(s.weight) || 0).filter((w) => w > 0);
    } else if (pktHasGen && inStock.length > 0 && details && !isUnc) {
      packets[pIdx].pieces = inStock.length;
      if (Number(packets[pIdx].weight) <= 0.001) {
        const curOrigPcs = Number(packets[pIdx].pieces) || inStock.length;
        const curOrigWt = (packets[pIdx].purchase_price && packets[pIdx].purchase_rate_per_unit ? packets[pIdx].purchase_price / packets[pIdx].purchase_rate_per_unit : 0) || (packets[pIdx].sale_price && packets[pIdx].sale_rate_per_unit ? packets[pIdx].sale_price / packets[pIdx].sale_rate_per_unit : 1);
        packets[pIdx].weight = Math.max(0.01, Number(((curOrigWt / curOrigPcs) * inStock.length).toFixed(2)));
      }
    }

    const pktWt = Number(packets[pIdx].weight) || 0;
    const pktPcs = Number(packets[pIdx].pieces) || 0;
    const hasRemaining = isUnc ? pktWt > 0.001 : (pktPcs > 0);

    if (hasRemaining) {
      packets[pIdx].status = "in_stock";
      packets[pIdx].memo_party = "";
      packets[pIdx].is_approval = false;
      packets[pIdx].approval_status = undefined;
    } else {
      packets[pIdx].status = "sold";
      packets[pIdx].buyer_name = sale.buyer_name;
      packets[pIdx].sale_date = now.slice(0, 10);
      packets[pIdx].is_approval = false;
      packets[pIdx].approval_status = "approved_billed";
      packets[pIdx].pieces = 0;
      packets[pIdx].weight = 0;
    }

    if (packets[pIdx].purchase_rate_per_unit) {
      packets[pIdx].purchase_price = Math.round(packets[pIdx].purchase_rate_per_unit * packets[pIdx].weight);
    }
    if (packets[pIdx].sale_rate_per_unit) {
      packets[pIdx].sale_price = Math.round(packets[pIdx].sale_rate_per_unit * packets[pIdx].weight);
    }
  }

  const hasAnyTaken = updatedItems.length > 0;
  const subtotal = hasAnyTaken ? updatedItems.reduce((s, it) => s + it.total_price, 0) : 0;
  const totalTax = hasAnyTaken ? updatedItems.reduce((s, it) => s + (it.gst_amount || 0), 0) : 0;
  const discount = Number(sale.discount || 0);
  const grandTotal = hasAnyTaken ? Math.max(0, subtotal + totalTax - discount) : 0;
  const paid = Number(sale.paid_amount || 0);
  const balance = hasAnyTaken ? Math.max(0, grandTotal - paid) : 0;
  const payStatus = balance <= 0 ? "cleared" : (paid > 0 ? "partial" : "unpaid");

  const finalApprovalStatus = hasAnyTaken ? "approved_billed" : "returned";
  const finalIsApproval = false;

  const updatedSale: GemSale = {
    ...sale,
    items: updatedItems,
    returned_items: returnedItems,
    subtotal: subtotal,
    tax_amount: totalTax,
    total: grandTotal,
    balance: balance,
    payment_status: payStatus,
    is_approval: finalIsApproval,
    approval_status: finalApprovalStatus,
    approval_billed_date: hasAnyTaken ? now.slice(0, 10) : undefined,
    notes:
      (sale.notes ? sale.notes + "\n" : "") +
      (options?.notes ||
        `Settlement: ${updatedItems.length} item(s) taken (${updatedItems.reduce((s, it) => s + it.weight, 0).toFixed(2)} cts), ${returnedItems.length} item(s) returned (${returnedItems.reduce((s, it) => s + it.weight, 0).toFixed(2)} cts) to vault.`),
  };

  sales[idx] = updatedSale;
  setLocal("sales", sales);

  healPacketsWithSales(packets, sales);
  setLocal("packets", packets);

  return { success: true, sale: updatedSale };
}

export function convertSaleToApproval(
  saleId: string,
  options?: { notes?: string }
): { success: boolean; sale: GemSale } {
  const sales = getStoredSales();
  const packets = getStoredPackets();
  const idx = sales.findIndex((s) => s.id === saleId);
  if (idx < 0) throw new Error("Sale invoice not found");

  const sale = sales[idx];
  const now = new Date().toISOString();

  // If already active approval, nothing to convert
  if (sale.is_approval && sale.approval_status === "pending") {
    return { success: true, sale };
  }

  // Restore any returned_items that were removed from sale.items during past settlement
  const restoredItems: GemSaleItem[] = [...(sale.items || [])];
  if (Array.isArray(sale.returned_items) && sale.returned_items.length > 0) {
    for (const ret of sale.returned_items) {
      const alreadyPresent = restoredItems.some(
        (it) =>
          (it.stone_id && ret.stone_id && it.stone_id === ret.stone_id) ||
          ((it.packet_number || "").trim().toLowerCase() === (ret.packet_number || "").trim().toLowerCase() &&
           (it.particulars || "").trim().toLowerCase() === (ret.particulars || "").trim().toLowerCase() &&
           Math.abs((it.weight || 0) - (ret.weight || 0)) <= 0.01)
      );
      if (!alreadyPresent) {
        restoredItems.push(ret);
      }
    }
  }

  // Reset all items back to active approval state with full original weights and pieces
  const finalItems = restoredItems.map((it) => {
    const origWt = it.original_weight !== undefined && it.original_weight > 0 ? it.original_weight : (it.weight || 0);
    const origPcs = it.original_pieces !== undefined ? it.original_pieces : (it.pieces !== undefined ? it.pieces : 0);
    const rate = it.rate_per_unit || (origWt > 0 ? Math.round((it.total_price || 0) / origWt) : 0);
    return {
      ...it,
      pieces: origPcs,
      weight: origWt,
      original_pieces: origPcs,
      original_weight: origWt,
      rate_per_unit: rate,
      total_price: Math.round(rate * origWt),
      weight_taken: 0,
      pieces_taken: 0,
      weight_returned: 0,
      pieces_returned: 0,
      is_returned: false,
    };
  });

  const subtotal = finalItems.reduce((s, it) => s + (it.total_price || 0), 0);
  const totalTax = finalItems.reduce((s, it) => s + (it.gst_amount || 0), 0);
  const grandTotal = Math.max(0, subtotal + totalTax - Number(sale.discount || 0));

  const updatedSale: GemSale = {
    ...sale,
    items: finalItems,
    returned_items: [],
    subtotal: subtotal,
    tax_amount: totalTax,
    total: grandTotal,
    balance: grandTotal,
    payment_status: "unpaid",
    is_approval: true,
    approval_status: "pending",
    approval_billed_date: undefined,
    notes:
      (sale.notes ? sale.notes + "\n" : "") +
      (options?.notes || `Converted from commercial sale to active approval memo on ${now.slice(0, 10)}.`),
  };

  // Re-update inventory packets associated with this sale to on_approval
  for (const item of finalItems) {
    const pIdx = packets.findIndex(
      (p) => p.id === item.packet_id || p.packet_number.toLowerCase() === (item.packet_number || "").toLowerCase()
    );
    if (pIdx >= 0) {
      packets[pIdx].status = "on_approval";
      packets[pIdx].memo_party = sale.buyer_name;
      packets[pIdx].memo_date = sale.date;
      packets[pIdx].is_approval = true;
      packets[pIdx].approval_status = "pending";
      packets[pIdx].buyer_name = "";
      packets[pIdx].sale_date = "";
      packets[pIdx].sold_price = undefined;
      packets[pIdx].sold_rate_per_unit = undefined;
      packets[pIdx].sale_invoice_id = undefined;

      if (Array.isArray(packets[pIdx].stone_details)) {
        if (item.stone_id) {
          const sd = packets[pIdx].stone_details.find((s) => s.id === item.stone_id);
          if (sd) sd.status = "on_approval";
        } else {
          for (const sd of packets[pIdx].stone_details) {
            if (sd.status === "sold" || sd.status === "in_stock") {
              sd.status = "on_approval";
            }
          }
        }
      }
    }
  }
  setLocal("packets", packets);

  sales[idx] = updatedSale;
  setLocal("sales", sales);

  return { success: true, sale: updatedSale };
}

// -------------------------------------------------------------
// Expenses (Petty & Business)
// -------------------------------------------------------------
export const DEFAULT_PETTY_CATEGORIES: string[] = [
  "Petty Cash / Refreshments",
  "Local Conveyance & Postage",
  "Office Supplies",
  "Tea & Refreshments",
  "Courier & Shipping",
  "Miscellaneous",
];

export function getStoredPettyCategories(): string[] {
  return getLocal<string[]>("petty_categories", DEFAULT_PETTY_CATEGORIES);
}

export function savePettyCategory(name: string): string[] {
  if (!name || !name.trim()) return getStoredPettyCategories();
  const list = [...getStoredPettyCategories()];
  const trimmed = name.trim();
  if (!list.includes(trimmed)) {
    list.push(trimmed);
    setLocal("petty_categories", list);
  }
  return list;
}

export function deletePettyCategory(name: string): string[] {
  const list = getStoredPettyCategories().filter((c) => c !== name);
  setLocal("petty_categories", list);
  return list;
}

export function getStoredExpenses(): GemExpense[] {
  const rawDirect = getLocal<GemExpense[]>("expenses", DEFAULT_EXPENSES);
  const directExpenses = (rawDirect || []).filter(
    (e) => !e.id.startsWith("pur-exp-") && !e.id.startsWith("brk-seller-exp-") && !e.id.startsWith("pur-brk-exp-")
  );
  let purchases: GemPurchase[] = [];
  try {
    const rawPur = localStorage.getItem(STORAGE_PREFIX + "purchases");
    purchases = rawPur ? JSON.parse(rawPur) : DEFAULT_PURCHASES;
  } catch {}

  const purchaseExpenses: GemExpense[] = purchases
    .filter((p) => p.status !== "cancelled")
    .map((p) => {
      const totalCarats = (p.items || []).reduce((sum, it) => sum + (it.weight || 0), 0);
      const totalPcs = (p.items || []).reduce((sum, it) => sum + (it.pieces || 1), 0);
      const pktsText = (p.items || []).map((it) => `${it.packet_number} (${it.weight}ct)`).join(", ");
      return {
        id: `pur-exp-${p.id}`,
        date: p.date,
        expense_type: "business" as const,
        company_name: p.company_name || "Shreeji Gems",
        category: "Purchased Stones",
        amount: p.total_cost || 0,
        payee: p.supplier_name || "Gemstone Supplier",
        packet_ref: pktsText || p.purchase_no,
        payment_mode: p.payment_mode || "Bank Wire / NEFT",
        note: `Gemstone Procurement #${p.purchase_no} (${totalPcs} pcs • ${totalCarats.toFixed(2)} cts)${p.lot_ref ? ` • Lot: ${p.lot_ref}` : ""}`,
        created_at: p.created_at || new Date().toISOString(),
      };
    });

  const purchaseBrokerageExpenses: GemExpense[] = purchases
    .filter((p) => p.status !== "cancelled" && (p.brokerage_amount || 0) > 0)
    .map((p) => {
      const totalBrk = Number(p.brokerage_amount) || 0;
      const paidBrk = Number(p.brokerage_paid_amount) || (p.brokerage_paid ? totalBrk : 0);
      const balBrk = p.brokerage_balance_due !== undefined ? p.brokerage_balance_due : Math.max(0, totalBrk - paidBrk);
      return {
        id: `pur-brk-exp-${p.id}`,
        date: p.date,
        expense_type: "business" as const,
        company_name: p.company_name || "Shreeji Gems",
        category: "Purchase Brokerage",
        amount: totalBrk,
        payee: p.broker_name || "Purchase Broker",
        packet_ref: p.purchase_no,
        payment_mode: p.payment_mode || "Bank Wire / NEFT",
        note: `Middleman Brokerage on Purchase #${p.purchase_no} (Paid: ₹${paidBrk.toLocaleString("en-IN")}, Due: ₹${balBrk.toLocaleString("en-IN")})${p.broker_phone ? ` • Phone: ${p.broker_phone}` : ""}`,
        created_at: p.created_at || new Date().toISOString(),
      };
    });

  let brokerages: GemBrokerage[] = [];
  try {
    const rawBrk = localStorage.getItem(STORAGE_PREFIX + "brokerage");
    brokerages = rawBrk ? JSON.parse(rawBrk) : DEFAULT_BROKERAGE;
  } catch {}

  const brokerageSellerExpenses: GemExpense[] = brokerages
    .filter((b) => (b.amount_paid_to_seller || 0) > 0)
    .map((b) => ({
      id: `brk-seller-exp-${b.id}`,
      date: b.date_paid_to_seller || b.date,
      expense_type: "business" as const,
      company_name: b.company_name || "Shreeji Gems",
      category: "Brokerage Payout",
      amount: b.amount_paid_to_seller || 0,
      payee: b.seller_name || "Deal Seller",
      packet_ref: b.deal_no,
      payment_mode: b.mode_paid_to_seller || "Bank Wire / NEFT",
      note: `Brokerage Deal #${b.deal_no} (Paid to Seller: ${b.seller_name}) • ${b.particulars} (${b.weight} ${b.unit || "cts"})${b.note_paid_to_seller ? ` • ${b.note_paid_to_seller}` : ""}`,
      created_at: b.created_at || new Date().toISOString(),
    }));

  return [...directExpenses, ...purchaseExpenses, ...purchaseBrokerageExpenses, ...brokerageSellerExpenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function setPurchaseBrokeragePaid(
  purchaseId: string,
  paid: boolean
): GemPurchase | null {
  const purchases = getStoredPurchases();
  const idx = purchases.findIndex((p) => p.id === purchaseId);
  if (idx < 0) return null;

  const totalBrk = purchases[idx].brokerage_amount || 0;
  purchases[idx].brokerage_paid = paid;
  if (paid) {
    purchases[idx].brokerage_paid_amount = totalBrk;
    purchases[idx].brokerage_balance_due = 0;
  } else {
    const paidSoFar = (purchases[idx].broker_payments || []).reduce((sum, p) => sum + p.amount, 0);
    purchases[idx].brokerage_paid_amount = paidSoFar;
    purchases[idx].brokerage_balance_due = Math.max(0, totalBrk - paidSoFar);
  }
  setLocal("purchases", purchases);
  return purchases[idx];
}

export function addPaymentToPurchaseBroker(
  purchaseId: string,
  payment: { amount: number; mode: any; date?: string; note?: string }
): GemPurchase | null {
  const purchases = getStoredPurchases();
  const idx = purchases.findIndex((p) => p.id === purchaseId);
  if (idx < 0) return null;

  const pur = purchases[idx];
  const totalBrokerage = Number(pur.brokerage_amount) || 0;
  const currentPaid = (pur.broker_payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingDue = Math.max(0, Math.round((totalBrokerage - currentPaid) * 100) / 100);
  const requestedAmt = Number(payment.amount) || 0;

  if (requestedAmt <= 0) return pur;
  if (requestedAmt > remainingDue) {
    throw new Error(`Payment amount (₹${requestedAmt}) cannot exceed remaining broker balance due of ₹${remainingDue}`);
  }

  const newPayment: GemSalePayment = {
    id: "pbm-" + Math.random().toString(36).substring(2, 9),
    date: payment.date || new Date().toISOString().slice(0, 10),
    amount: requestedAmt,
    mode: payment.mode || "Bank Wire / NEFT",
    note: payment.note || "",
  };

  const broker_payments = [...(pur.broker_payments || []), newPayment];
  const brokerage_paid_amount = Math.min(totalBrokerage, broker_payments.reduce((sum, p) => sum + p.amount, 0));
  const brokerage_balance_due = Math.max(0, Math.round((totalBrokerage - brokerage_paid_amount) * 100) / 100);
  const brokerage_paid = (totalBrokerage > 0 && brokerage_balance_due <= 0) || Boolean(pur.brokerage_paid);

  const updated: GemPurchase = {
    ...pur,
    broker_payments,
    brokerage_paid_amount,
    brokerage_balance_due,
    brokerage_paid,
  };

  purchases[idx] = updated;
  setLocal("purchases", purchases);
  return updated;
}

export function markPurchaseBrokerageFullPaid(
  purchaseId: string,
  paymentMode = "Bank Wire / NEFT"
): GemPurchase | null {
  const purchases = getStoredPurchases();
  const idx = purchases.findIndex((p) => p.id === purchaseId);
  if (idx < 0) return null;

  const pur = purchases[idx];
  const totalBrokerage = pur.brokerage_amount || 0;
  const alreadyPaid = (pur.broker_payments || []).reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, totalBrokerage - alreadyPaid);
  if (remaining <= 0 && pur.brokerage_paid) return pur;

  const now = new Date().toISOString();
  const newPayment: GemSalePayment = {
    id: "pbm-" + Math.random().toString(36).substring(2, 9),
    date: now.slice(0, 10),
    amount: remaining > 0 ? remaining : totalBrokerage,
    mode: (paymentMode || "Bank Wire / NEFT") as any,
    note: "Full middleman broker fee cleared",
  };

  const broker_payments = remaining > 0 ? [...(pur.broker_payments || []), newPayment] : (pur.broker_payments || []);
  const updated: GemPurchase = {
    ...pur,
    broker_payments,
    brokerage_paid_amount: totalBrokerage,
    brokerage_balance_due: 0,
    brokerage_paid: true,
  };

  purchases[idx] = updated;
  setLocal("purchases", purchases);
  return updated;
}

export function saveExpense(
  expData: Partial<GemExpense> & { category: any; amount: number; payee: string; expense_type?: "petty" | "business" }
): GemExpense {
  const directExpenses = getLocal<GemExpense[]>("expenses", DEFAULT_EXPENSES);
  const now = new Date().toISOString();

  const expType: "petty" | "business" = expData.expense_type === "petty" ? "petty" : "business";

  if (expData.id) {
    const idx = directExpenses.findIndex((e) => e.id === expData.id);
    if (idx >= 0) {
      const updated: GemExpense = {
        ...directExpenses[idx],
        ...expData,
        expense_type: expType,
        amount: Number(expData.amount) || 0,
      } as GemExpense;
      directExpenses[idx] = updated;
      setLocal("expenses", directExpenses);
      return updated;
    }
  }

  const newExp: GemExpense = {
    id: "exp-" + Math.random().toString(36).substring(2, 9),
    date: expData.date || now.slice(0, 10),
    expense_type: expType,
    company_name: expData.company_name || "Shreeji Gems",
    category: expData.category || "Miscellaneous",
    amount: Number(expData.amount) || 0,
    payee: expData.payee,
    packet_ref: expData.packet_ref || "",
    payment_mode: expData.payment_mode || "Bank Wire / NEFT",
    note: expData.note || "",
    created_at: now,
  };

  directExpenses.unshift(newExp);
  setLocal("expenses", directExpenses);
  return newExp;
}

export function deleteExpense(id: string): boolean {
  if (id.startsWith("brk-seller-exp-")) {
    const dealId = id.replace("brk-seller-exp-", "");
    const deals = getStoredBrokerage();
    const dIdx = deals.findIndex((d) => d.id === dealId);
    if (dIdx >= 0) {
      deals[dIdx].amount_paid_to_seller = 0;
      if (deals[dIdx].deal_settlement_status === "paid_seller_pending_buyer") {
        deals[dIdx].deal_settlement_status = "pending_both";
      } else if (deals[dIdx].deal_settlement_status === "fully_settled") {
        deals[dIdx].deal_settlement_status = "paid_buyer_pending_seller";
      }
      setLocal("brokerage", deals);
      return true;
    }
  }
  if (id.startsWith("pur-brk-exp-")) {
    const purId = id.replace("pur-brk-exp-", "");
    const purchases = getStoredPurchases();
    const pIdx = purchases.findIndex((p) => p.id === purId);
    if (pIdx >= 0) {
      purchases[pIdx].brokerage_amount = 0;
      purchases[pIdx].brokerage_rate = 0;
      purchases[pIdx].brokerage_paid = false;
      purchases[pIdx].brokerage_paid_amount = 0;
      purchases[pIdx].brokerage_balance_due = 0;
      setLocal("purchases", purchases);
      return true;
    }
  }
  const directExpenses = getLocal<GemExpense[]>("expenses", DEFAULT_EXPENSES);
  const filtered = directExpenses.filter((e) => e.id !== id);
  setLocal("expenses", filtered);
  return true;
}

// -------------------------------------------------------------
// Buyers & Sellers Directory
// -------------------------------------------------------------
export function getStoredBuyers(): GemBuyer[] {
  // Only return explicitly saved buyers directory records
  const stored = getLocal<GemBuyer[]>("buyers", DEFAULT_BUYERS);
  return (stored || []).filter((b) => b && b.name && !isTestTerm(b.name));
}

export function clearStoredBuyers(): boolean {
  setLocal("buyers", []);
  return true;
}

export function deleteBuyer(id: string): boolean {
  const buyers = getStoredBuyers();
  const filtered = buyers.filter((b) => b.id !== id && b.name.toLowerCase() !== id.toLowerCase());
  setLocal("buyers", filtered);
  return true;
}

// One-time cleanup of current saved suggestions as requested, while keeping the suggestion feature intact for new parties
(function cleanCurrentPartySuggestions() {
  try {
    const CLEANUP_KEY = STORAGE_PREFIX + "cleared_current_suggestions_v2";
    if (!localStorage.getItem(CLEANUP_KEY)) {
      localStorage.setItem(STORAGE_PREFIX + "buyers", JSON.stringify([]));
      localStorage.setItem(STORAGE_PREFIX + "gemvault_suppliers", JSON.stringify([]));
      localStorage.setItem(STORAGE_PREFIX + "gemvault_brokers", JSON.stringify([]));
      localStorage.setItem(CLEANUP_KEY, "true");
    }
  } catch {}
})();

export function saveBuyer(buyerData: Partial<GemBuyer> & { name: string }): GemBuyer {
  const buyers = getStoredBuyers();
  const now = new Date().toISOString();

  if (buyerData.id) {
    const idx = buyers.findIndex((b) => b.id === buyerData.id);
    if (idx >= 0) {
      const updated = { ...buyers[idx], ...buyerData };
      buyers[idx] = updated as GemBuyer;
      setLocal("buyers", buyers);
      return updated as GemBuyer;
    }
  }

  const newBuyer: GemBuyer = {
    id: "buy-" + Math.random().toString(36).substring(2, 9),
    name: buyerData.name,
    company: buyerData.company || buyerData.name,
    phone: buyerData.phone || "",
    whatsapp: buyerData.whatsapp || "",
    city: buyerData.city || "",
    address: buyerData.address || "",
    notes: buyerData.notes || "",
    created_at: now,
  };

  buyers.unshift(newBuyer);
  setLocal("buyers", buyers);
  return newBuyer;
}

// -------------------------------------------------------------
// Overall Profit and Analytics (Business Evaluation)
// -------------------------------------------------------------
export interface OverallAnalytics {
  total_sales_revenue: number;
  direct_sales_revenue: number;
  direct_sales_cogs: number;
  direct_sales_gross_profit: number;
  brokerage_deals_revenue: number;
  brokerage_deals_cogs: number;
  brokerage_deals_gross_profit: number;

  gross_sales: number;
  sales_returns_discount: number;
  net_sales: number;
  total_cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  brokerage_earnings: number;
  brokerage_paid_out: number;
  pending_brokerage: number;

  purchase_brokerage_incurred: number;
  purchase_brokerage_paid: number;
  purchase_brokerage_pending: number;

  total_expenses: number;
  net_expenses: number;
  petty_expenses: number;
  business_expenses: number;
  direct_overheads: number;
  net_profit: number;
  net_margin_pct: number;

  // Vault Inventory Evaluation
  vault_packets_count: number;
  vault_total_carats: number;
  vault_cost_valuation: number;
  vault_asking_valuation: number;
  unrealized_profit: number;
  memo_packets_count: number;
  memo_carats: number;
  sold_packets_count: number;

  // Breakdowns
  particulars_breakdown: Array<{
    particular: string;
    sold_count: number;
    in_stock_count: number;
    carats: number;
    revenue: number;
    cogs: number;
    gross_profit: number;
    margin_pct: number;
  }>;
  shape_breakdown: Array<{
    shape: string;
    count: number;
    carats: number;
    value: number;
  }>;
  top_buyers: Array<{
    name: string;
    deals_count: number;
    total_spend: number;
    gross_profit_generated: number;
  }>;
  expense_categories: Array<{
    category: string;
    amount: number;
    pct: number;
  }>;
  monthly_pnl: Array<{
    period: string; // YYYY-MM
    revenue: number;
    cogs: number;
    gross_profit: number;
    brokerage: number;
    purchase_brokerage: number;
    expenses: number;
    net_profit: number;
  }>;
  weekly_pnl: Array<{
    period: string; // e.g. "2026-W38"
    revenue: number;
    cogs: number;
    gross_profit: number;
    brokerage: number;
    purchase_brokerage: number;
    expenses: number;
    net_profit: number;
  }>;
  company_breakdown: Array<{
    company: string;
    sales_revenue: number;
    gross_profit: number;
    expenses: number;
    net_profit: number;
    packets_count: number;
  }>;

  // Detailed Sale-by-Sale Ledger & Comprehensive Balance Sheet
  sales_ledger: SaleLedgerItem[];
  balance_sheet: BalanceSheetData;
}

function getWeekNumber(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getOverallProfitAndAnalytics(filterCompany?: string): OverallAnalytics {
  let packets = getStoredPackets();
  let sales = getStoredSales();
  let brokerage = getStoredBrokerage();
  let expenses = getStoredExpenses();
  let purchases = getStoredPurchases();
  let assets = getStoredAssets();
  const liquidCash = getLiquidCash();

  if (filterCompany && filterCompany !== "all") {
    packets = packets.filter((p) => p.company_name === filterCompany);
    sales = sales.filter((s) => s.company_name === filterCompany);
    brokerage = brokerage.filter((b) => b.company_name === filterCompany);
    expenses = expenses.filter((e) => e.company_name === filterCompany);
    purchases = purchases.filter((p) => p.company_name === filterCompany);
    assets = assets.filter((a) => a.company_name === filterCompany);
  }

  // 1. Direct Sales & COGS (Only confirmed sales, exclude unapproved memos/approvals)
  let directSalesRevenue = 0;
  let directSalesCogs = 0;
  let totalDiscounts = 0;
  const buyerMap: Record<string, { count: number; spend: number; profit: number }> = {};
  const particularMap: Record<string, { sold: number; in_stock: number; carats: number; rev: number; cogs: number; profit: number }> = {};
  const monthMap: Record<string, { rev: number; cogs: number; brk: number; exp: number; purBrk: number }> = {};
  const weekMap: Record<string, { rev: number; cogs: number; brk: number; exp: number; purBrk: number }> = {};

  const salesLedger: SaleLedgerItem[] = [];

  for (const s of sales) {
    if (s.approval_status === "returned" || (s.is_approval && s.approval_status !== "approved_billed")) {
      continue;
    }

    const sTotal = Number(s.total) || 0;
    directSalesRevenue += sTotal;
    totalDiscounts += Number(s.discount) || 0;

    let saleCogs = 0;
    let sWeight = 0;
    let sPieces = 0;
    const partsList: string[] = [];

    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        if (it.is_returned) continue;
        const cPrice = Number(it.cost_price) || 0;
        const tPrice = Number(it.total_price) || 0;
        const wt = Number(it.weight) || 0;
        const pcs = Number(it.pieces) || 1;

        saleCogs += cPrice;
        sWeight += wt;
        sPieces += pcs;
        if (it.particulars) partsList.push(it.particulars);

        const part = (it.particulars || "Gemstone").split("(")[0].trim() || "Gemstone";
        if (!particularMap[part]) {
          particularMap[part] = { sold: 0, in_stock: 0, carats: 0, rev: 0, cogs: 0, profit: 0 };
        }
        particularMap[part].sold += 1;
        particularMap[part].carats += wt;
        particularMap[part].rev += tPrice;
        particularMap[part].cogs += cPrice;
        particularMap[part].profit += tPrice - cPrice;
      }
    }
    directSalesCogs += saleCogs;

    const m = (s.date || "").slice(0, 7);
    const dateObj = new Date(s.date || Date.now());
    const w = !isNaN(dateObj.getTime()) ? getWeekNumber(dateObj) : "";
    if (m) {
      if (!monthMap[m]) monthMap[m] = { rev: 0, cogs: 0, brk: 0, exp: 0, purBrk: 0 };
      monthMap[m].rev += sTotal;
      monthMap[m].cogs += saleCogs;
    }
    if (w) {
      if (!weekMap[w]) weekMap[w] = { rev: 0, cogs: 0, brk: 0, exp: 0, purBrk: 0 };
      weekMap[w].rev += sTotal;
      weekMap[w].cogs += saleCogs;
    }

    const bName = s.buyer_name || "Direct Client";
    if (!buyerMap[bName]) buyerMap[bName] = { count: 0, spend: 0, profit: 0 };
    buyerMap[bName].count += 1;
    buyerMap[bName].spend += sTotal;
    buyerMap[bName].profit += sTotal - saleCogs;

    // Add to Sales Ledger
    const paidAmt = Number(s.paid_amount) || 0;
    const balDue = s.balance !== undefined ? Number(s.balance) : Math.max(0, sTotal - paidAmt);
    const profitOnSale = sTotal - saleCogs;
    const marginOnSale = sTotal > 0 ? Math.round((profitOnSale / sTotal) * 1000) / 10 : 0;

    salesLedger.push({
      id: s.id,
      transaction_type: "direct_sale",
      invoice_or_deal_no: s.invoice_no,
      date: s.date,
      company_name: s.company_name || "Shreeji Gems",
      buyer_name: s.buyer_name,
      seller_name: (s.items && s.items[0] && s.items[0].purchased_from) || "Own Vault",
      particulars_summary: partsList.slice(0, 2).join("; ") + (partsList.length > 2 ? ` (+${partsList.length - 2} more)` : "") || "Gemstone Packet(s)",
      weight: Math.round(sWeight * 100) / 100,
      unit: (s.items && s.items[0] && s.items[0].unit) || "cts",
      pieces: sPieces || 1,
      sale_amount: sTotal,
      cogs_amount: saleCogs,
      gross_profit: profitOnSale,
      margin_pct: marginOnSale,
      paid_amount: paidAmt,
      balance_due: balDue,
      payment_status: s.payment_status || (balDue <= 0 ? "cleared" : paidAmt > 0 ? "partial" : "unpaid"),
      payment_mode: s.payment_mode || "Bank Wire / NEFT",
      notes: s.notes || "",
      items_count: (s.items || []).length,
    });
  }

  // 2. Brokerage Deals (CONSIDERED AS SALES!)
  let brokerageDealsRevenue = 0;
  let brokerageDealsCogs = 0;
  let brokerageEarnings = 0;
  let pendingBrokerage = 0;

  for (const b of brokerage) {
    const sellAmt = Number(b.sell_amount) || Number(b.deal_value) || 0;
    const buyAmt = Number(b.buy_amount) || 0;
    const commAmt = Number(b.commission_amount) || Math.max(0, sellAmt - buyAmt);
    const recComm = Number(b.received_amount) || 0;
    const balComm = Number(b.balance_receivable) || Math.max(0, commAmt - recComm);

    brokerageDealsRevenue += sellAmt;
    brokerageDealsCogs += buyAmt;
    brokerageEarnings += recComm;
    pendingBrokerage += balComm;

    const m = (b.date || "").slice(0, 7);
    const dateObj = new Date(b.date || Date.now());
    const w = !isNaN(dateObj.getTime()) ? getWeekNumber(dateObj) : "";
    if (m) {
      if (!monthMap[m]) monthMap[m] = { rev: 0, cogs: 0, brk: 0, exp: 0, purBrk: 0 };
      monthMap[m].rev += sellAmt;
      monthMap[m].cogs += buyAmt;
      monthMap[m].brk += recComm;
    }
    if (w) {
      if (!weekMap[w]) weekMap[w] = { rev: 0, cogs: 0, brk: 0, exp: 0, purBrk: 0 };
      weekMap[w].rev += sellAmt;
      weekMap[w].cogs += buyAmt;
      weekMap[w].brk += recComm;
    }

    const bName = b.buyer_name || "Outside Buyer";
    if (!buyerMap[bName]) buyerMap[bName] = { count: 0, spend: 0, profit: 0 };
    buyerMap[bName].count += 1;
    buyerMap[bName].spend += sellAmt;
    buyerMap[bName].profit += commAmt;

    const part = (b.particulars || "Gemstone").split("(")[0].trim() || "Gemstone";
    if (!particularMap[part]) {
      particularMap[part] = { sold: 0, in_stock: 0, carats: 0, rev: 0, cogs: 0, profit: 0 };
    }
    particularMap[part].sold += 1;
    particularMap[part].carats += Number(b.weight) || 0;
    particularMap[part].rev += sellAmt;
    particularMap[part].cogs += buyAmt;
    particularMap[part].profit += commAmt;

    // Buyer settlement & balance due for the deal
    const recvBuyer = Number(b.amount_received_from_buyer) || (b.settlement_status === "received" ? sellAmt : recComm);
    const buyerBalDue = Math.max(0, sellAmt - recvBuyer);
    const dealMargin = sellAmt > 0 ? Math.round((commAmt / sellAmt) * 1000) / 10 : 0;
    const dealPayStatus = buyerBalDue <= 0 ? "cleared" : recvBuyer > 0 ? "partial" : "unpaid";

    salesLedger.push({
      id: b.id,
      transaction_type: "brokerage_deal",
      invoice_or_deal_no: b.deal_no,
      date: b.date,
      company_name: b.company_name || "Shreeji Gems",
      buyer_name: b.buyer_name,
      seller_name: b.seller_name,
      particulars_summary: `${b.particulars} (${b.weight} ${b.unit || "cts"} ${b.shape || ""})`,
      weight: Number(b.weight) || 0,
      unit: b.unit || "cts",
      pieces: Number(b.pieces) || 1,
      sale_amount: sellAmt,
      cogs_amount: buyAmt,
      gross_profit: commAmt,
      margin_pct: dealMargin,
      paid_amount: recvBuyer,
      balance_due: buyerBalDue,
      payment_status: dealPayStatus,
      payment_mode: b.payment_mode || "Bank Wire / NEFT",
      notes: b.notes || (b.brokerage_percent ? `${b.brokerage_percent}% commission deal` : "Brokerage Deal"),
      items_count: 1,
    });
  }

  // Sort sales ledger by date descending
  salesLedger.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Consolidated Sales & COGS
  const totalSalesRevenue = directSalesRevenue + brokerageDealsRevenue;
  const totalCogs = directSalesCogs + brokerageDealsCogs;
  const grossProfit = totalSalesRevenue - totalCogs;
  const grossMarginPct = totalSalesRevenue > 0 ? (grossProfit / totalSalesRevenue) * 100 : 0;

  // 3. Middleman Brokerage on Gemstone Purchases
  let purchaseBrokerageIncurred = 0;
  let purchaseBrokeragePaid = 0;
  let purchaseBrokeragePending = 0;

  for (const p of purchases) {
    if (p.status !== "cancelled") {
      const bAmt = Number(p.brokerage_amount) || 0;
      const bPaid = Number(p.brokerage_paid_amount) || (p.brokerage_paid ? bAmt : 0);
      const bDue = p.brokerage_balance_due !== undefined ? Number(p.brokerage_balance_due) : Math.max(0, bAmt - bPaid);

      purchaseBrokerageIncurred += bAmt;
      purchaseBrokeragePaid += bPaid;
      purchaseBrokeragePending += bDue;

      const m = (p.date || "").slice(0, 7);
      const dateObj = new Date(p.date || Date.now());
      const w = !isNaN(dateObj.getTime()) ? getWeekNumber(dateObj) : "";
      if (m) {
        if (!monthMap[m]) monthMap[m] = { rev: 0, cogs: 0, brk: 0, exp: 0, purBrk: 0 };
        monthMap[m].purBrk += bAmt;
      }
      if (w) {
        if (!weekMap[w]) weekMap[w] = { rev: 0, cogs: 0, brk: 0, exp: 0, purBrk: 0 };
        weekMap[w].purBrk += bAmt;
      }
    }
  }

  // 4. Operating Expenses (Direct Overheads, excluding inventory asset purchases)
  let pettyExpenses = 0;
  let businessExpenses = 0;
  const expCatMap: Record<string, number> = {};

  for (const e of expenses) {
    // Skip synthetic inventory purchases & brokerage seller payouts from operating overheads
    if (e.id.startsWith("pur-exp-") || e.id.startsWith("brk-seller-exp-") || e.id.startsWith("pur-brk-exp-")) {
      continue;
    }

    const amt = Number(e.amount) || 0;
    if (e.expense_type === "petty") {
      pettyExpenses += amt;
    } else {
      businessExpenses += amt;
    }
    expCatMap[e.category] = (expCatMap[e.category] || 0) + amt;

    const m = (e.date || "").slice(0, 7);
    const dateObj = new Date(e.date || Date.now());
    const w = !isNaN(dateObj.getTime()) ? getWeekNumber(dateObj) : "";
    if (m) {
      if (!monthMap[m]) monthMap[m] = { rev: 0, cogs: 0, brk: 0, exp: 0, purBrk: 0 };
      monthMap[m].exp += amt;
    }
    if (w) {
      if (!weekMap[w]) weekMap[w] = { rev: 0, cogs: 0, brk: 0, exp: 0, purBrk: 0 };
      weekMap[w].exp += amt;
    }
  }

  // Include Purchase Brokerage into Expense Breakdown
  if (purchaseBrokerageIncurred > 0) {
    expCatMap["Purchase Brokerage"] = (expCatMap["Purchase Brokerage"] || 0) + purchaseBrokerageIncurred;
  }

  const directOverheads = pettyExpenses + businessExpenses;
  const totalExpenses = directOverheads + purchaseBrokerageIncurred;
  const netExpenses = totalExpenses;

  // 5. Net Business Profit
  const netProfit = grossProfit - totalExpenses;
  const netMarginPct = totalSalesRevenue > 0 ? (netProfit / totalSalesRevenue) * 100 : 0;

  // 6. Vault Inventory Analysis
  let vaultPacketsCount = 0;
  let vaultTotalCarats = 0;
  let vaultCostValuation = 0;
  let vaultAskingValuation = 0;
  let memoPacketsCount = 0;
  let memoCarats = 0;
  let soldPacketsCount = 0;
  const shapeMap: Record<string, { count: number; carats: number; value: number }> = {};

  for (const p of packets) {
    if (p.status === "in_stock" || p.status === "on_memo" || p.status === "on_approval" || p.status === "reserved") {
      vaultPacketsCount++;
      vaultTotalCarats += Number(p.weight) || 0;
      vaultCostValuation += Number(p.purchase_price) || 0;
      vaultAskingValuation += Number(p.sale_price) || 0;

      const sh = p.shape || "Other";
      if (!shapeMap[sh]) shapeMap[sh] = { count: 0, carats: 0, value: 0 };
      shapeMap[sh].count++;
      shapeMap[sh].carats += Number(p.weight) || 0;
      shapeMap[sh].value += Number(p.sale_price) || 0;

      const part = (p.particulars || "Gemstone").split("(")[0].trim() || "Gemstone";
      if (!particularMap[part]) {
        particularMap[part] = { sold: 0, in_stock: 0, carats: 0, rev: 0, cogs: 0, profit: 0 };
      }
      particularMap[part].in_stock += 1;
      particularMap[part].carats += Number(p.weight) || 0;

      if (p.status === "on_memo" || p.status === "on_approval") {
        memoPacketsCount++;
        memoCarats += Number(p.weight) || 0;
      }
    } else if (p.status === "sold") {
      soldPacketsCount++;
    }
  }

  const unrealizedProfit = vaultAskingValuation - vaultCostValuation;

  // 7. Balance Sheet Calculations
  const arDirectSales = sales
    .filter((s) => s.approval_status !== "returned" && (!s.is_approval || s.approval_status === "approved_billed"))
    .reduce((sum, s) => sum + (s.balance !== undefined ? Number(s.balance) : Math.max(0, (Number(s.total) || 0) - (Number(s.paid_amount) || 0))), 0);

  const arBrokerageDeals = brokerage.reduce((sum, b) => {
    const sAmt = Number(b.sell_amount) || Number(b.deal_value) || 0;
    const rAmt = Number(b.amount_received_from_buyer) || (b.settlement_status === "received" ? sAmt : Number(b.received_amount) || 0);
    return sum + Math.max(0, sAmt - rAmt);
  }, 0);

  const totalAR = arDirectSales + arBrokerageDeals + pendingBrokerage;
  const totalCurrentAssets = liquidCash + totalAR + vaultCostValuation;

  const fixedAssetItems = assets.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    valuation: Number(a.valuation) || 0,
  }));
  const totalFixedAssets = fixedAssetItems.reduce((sum, it) => sum + it.valuation, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const apSuppliers = purchases
    .filter((p) => p.status !== "cancelled")
    .reduce((sum, p) => sum + (p.balance_payable !== undefined ? Number(p.balance_payable) : Math.max(0, (Number(p.total_cost) || 0) - (Number(p.paid_amount) || 0))), 0);

  const apDealSellers = brokerage.reduce((sum, b) => {
    const bAmt = Number(b.buy_amount) || 0;
    const pAmt = Number(b.amount_paid_to_seller) || 0;
    return sum + Math.max(0, bAmt - pAmt);
  }, 0);

  const totalCurrentLiabilities = apSuppliers + purchaseBrokeragePending + apDealSellers;
  const totalLiabilities = totalCurrentLiabilities;
  const netWorth = totalAssets - totalLiabilities;
  const workingCapital = totalCurrentAssets - totalCurrentLiabilities;
  const currentRatio = totalCurrentLiabilities > 0 ? Math.round((totalCurrentAssets / totalCurrentLiabilities) * 100) / 100 : totalCurrentAssets > 0 ? 999 : 1;

  const balanceSheet: BalanceSheetData = {
    as_of_date: new Date().toISOString().slice(0, 10),
    assets: {
      current_assets: {
        liquid_cash: liquidCash,
        accounts_receivable_direct_sales: Math.round(arDirectSales),
        accounts_receivable_brokerage_deals: Math.round(arBrokerageDeals),
        pending_brokerage_commissions: Math.round(pendingBrokerage),
        total_accounts_receivable: Math.round(totalAR),
        inventory_at_cost: Math.round(vaultCostValuation),
        total_current_assets: Math.round(totalCurrentAssets),
      },
      fixed_assets: {
        items: fixedAssetItems,
        total_fixed_assets: Math.round(totalFixedAssets),
      },
      inventory_at_market: Math.round(vaultAskingValuation),
      unrealized_inventory_appreciation: Math.round(unrealizedProfit),
      total_assets: Math.round(totalAssets),
    },
    liabilities: {
      current_liabilities: {
        accounts_payable_suppliers: Math.round(apSuppliers),
        brokerage_payable_purchase_brokers: Math.round(purchaseBrokeragePending),
        brokerage_payable_deal_sellers: Math.round(apDealSellers),
        total_current_liabilities: Math.round(totalCurrentLiabilities),
      },
      total_liabilities: Math.round(totalLiabilities),
    },
    equity: {
      net_worth: Math.round(netWorth),
      working_capital: Math.round(workingCapital),
      current_ratio: currentRatio,
    },
  };

  // Format breakdowns
  const particularsBreakdown = Object.entries(particularMap)
    .map(([particular, data]) => ({
      particular,
      sold_count: data.sold,
      in_stock_count: data.in_stock,
      carats: Math.round(data.carats * 100) / 100,
      revenue: data.rev,
      cogs: data.cogs,
      gross_profit: data.profit,
      margin_pct: data.rev > 0 ? Math.round((data.profit / data.rev) * 100) : 0,
    }))
    .sort((a, b) => b.gross_profit - a.gross_profit);

  const shapeBreakdown = Object.entries(shapeMap)
    .map(([shape, d]) => ({
      shape,
      count: d.count,
      carats: Math.round(d.carats * 100) / 100,
      value: d.value,
    }))
    .sort((a, b) => b.value - a.value);

  const topBuyers = Object.entries(buyerMap)
    .map(([name, d]) => ({
      name,
      deals_count: d.count,
      total_spend: d.spend,
      gross_profit_generated: d.profit,
    }))
    .sort((a, b) => b.total_spend - a.total_spend);

  const expenseCategories = Object.entries(expCatMap)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      pct: totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const monthlyPnl = Object.entries(monthMap)
    .map(([month, d]) => {
      const gp = d.rev - d.cogs;
      const totalPeriodExp = d.exp + (d.purBrk || 0);
      return {
        period: month,
        revenue: d.rev,
        cogs: d.cogs,
        gross_profit: gp,
        brokerage: d.brk,
        purchase_brokerage: d.purBrk || 0,
        expenses: totalPeriodExp,
        net_profit: gp - totalPeriodExp,
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  const weeklyPnl = Object.entries(weekMap)
    .map(([week, d]) => {
      const gp = d.rev - d.cogs;
      const totalPeriodExp = d.exp + (d.purBrk || 0);
      return {
        period: week,
        revenue: d.rev,
        cogs: d.cogs,
        gross_profit: gp,
        brokerage: d.brk,
        purchase_brokerage: d.purBrk || 0,
        expenses: totalPeriodExp,
        net_profit: gp - totalPeriodExp,
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  // Multi-Company Breakdown
  const allCompanies = [
    "Shreeji Gems",
    "Shree Lakshmi Gems",
    "Shree Krishna Gems",
    "Tirth Enterprise",
    "Mokshil Traders",
  ];

  const rawSales = getStoredSales();
  const rawExpenses = getStoredExpenses();
  const rawPackets = getStoredPackets();
  const rawPurchases = getStoredPurchases();
  const rawBrokerage = getStoredBrokerage();

  const companyBreakdown = allCompanies.map((comp) => {
    const compSales = rawSales.filter((s) => s.company_name === comp && (!s.is_approval || s.approval_status === "approved_billed"));
    const compBrk = rawBrokerage.filter((b) => b.company_name === comp);
    const compExp = rawExpenses.filter((e) => e.company_name === comp && !e.id.startsWith("pur-exp-") && !e.id.startsWith("brk-seller-exp-") && !e.id.startsWith("pur-brk-exp-"));
    const compPkts = rawPackets.filter((p) => p.company_name === comp);
    const compPur = rawPurchases.filter((p) => p.company_name === comp && p.status !== "cancelled");

    const sRev = compSales.reduce((sum, s) => sum + s.total, 0) + compBrk.reduce((sum, b) => sum + (b.sell_amount || b.deal_value || 0), 0);
    const cogs = compSales.reduce(
      (sum, s) => sum + (s.items?.reduce((isum, it) => isum + (it.cost_price || 0), 0) || 0),
      0
    ) + compBrk.reduce((sum, b) => sum + (b.buy_amount || 0), 0);
    const gp = sRev - cogs;
    const purBrk = compPur.reduce((sum, p) => sum + (p.brokerage_amount || 0), 0);
    const exp = compExp.reduce((sum, e) => sum + e.amount, 0) + purBrk;
    return {
      company: comp,
      sales_revenue: sRev,
      gross_profit: gp,
      expenses: exp,
      net_profit: gp - exp,
      packets_count: compPkts.length,
    };
  });

  const grossSales = directSalesRevenue + brokerageDealsRevenue + totalDiscounts;
  const netSales = totalSalesRevenue;

  return {
    total_sales_revenue: totalSalesRevenue,
    direct_sales_revenue: directSalesRevenue,
    direct_sales_cogs: directSalesCogs,
    direct_sales_gross_profit: directSalesRevenue - directSalesCogs,
    brokerage_deals_revenue: brokerageDealsRevenue,
    brokerage_deals_cogs: brokerageDealsCogs,
    brokerage_deals_gross_profit: brokerageDealsRevenue - brokerageDealsCogs,

    gross_sales: grossSales,
    sales_returns_discount: totalDiscounts,
    net_sales: netSales,
    total_cogs: totalCogs,
    gross_profit: grossProfit,
    gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
    brokerage_earnings: brokerageEarnings,
    brokerage_paid_out: purchaseBrokerageIncurred,
    pending_brokerage: pendingBrokerage,

    purchase_brokerage_incurred: purchaseBrokerageIncurred,
    purchase_brokerage_paid: purchaseBrokeragePaid,
    purchase_brokerage_pending: purchaseBrokeragePending,

    total_expenses: totalExpenses,
    net_expenses: netExpenses,
    petty_expenses: pettyExpenses,
    business_expenses: businessExpenses,
    direct_overheads: directOverheads,
    net_profit: netProfit,
    net_margin_pct: Math.round(netMarginPct * 10) / 10,

    vault_packets_count: vaultPacketsCount,
    vault_total_carats: Math.round(vaultTotalCarats * 100) / 100,
    vault_cost_valuation: vaultCostValuation,
    vault_asking_valuation: vaultAskingValuation,
    unrealized_profit: unrealizedProfit,
    memo_packets_count: memoPacketsCount,
    memo_carats: Math.round(memoCarats * 100) / 100,
    sold_packets_count: soldPacketsCount,

    particulars_breakdown: particularsBreakdown,
    shape_breakdown: shapeBreakdown,
    top_buyers: topBuyers,
    expense_categories: expenseCategories,
    monthly_pnl: monthlyPnl,
    weekly_pnl: weeklyPnl,
    company_breakdown: companyBreakdown,

    sales_ledger: salesLedger,
    balance_sheet: balanceSheet,
  };
}

// -------------------------------------------------------------
// Backup and Restore (100% Local JSON)
// -------------------------------------------------------------
export function exportLocalBackup(): string {
  const rawDirect = getLocal<GemExpense[]>("expenses", DEFAULT_EXPENSES);
  const directExpenses = (rawDirect || []).filter(
    (e) => !e.id.startsWith("pur-exp-") && !e.id.startsWith("brk-seller-exp-") && !e.id.startsWith("pur-brk-exp-")
  );
  const data = {
    app: "Shreeji Gems CRM",
    exported_at: new Date().toISOString(),
    version: "3.0.0",
    boxes: getStoredBoxes(),
    packets: memoryCache['packets'] || [],
    sales: getStoredSales(),
    brokerage: getStoredBrokerage(),
    purchases: getStoredPurchases(),
    expenses: directExpenses,
    assets: getStoredAssets(),
    liquid_cash: getLiquidCash(),
    buyers: getStoredBuyers(),
    suppliers: getStoredSuppliers(),
    brokers: getStoredBrokers(),
    custom_particulars: getStoredParticulars(),
    custom_labs: getStoredLabs(),
  };
  return JSON.stringify(data, null, 2);
}

export function importLocalBackup(jsonStr: string): { success: boolean; message: string; counts?: any } {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== "object") {
      throw new Error("Invalid backup format");
    }

    if (Array.isArray(data.boxes)) setLocal("boxes", data.boxes);
    if (Array.isArray(data.packets)) setLocal("packets", data.packets);
    if (Array.isArray(data.sales)) setLocal("sales", data.sales);
    if (Array.isArray(data.brokerage)) setLocal("brokerage", data.brokerage);
    if (Array.isArray(data.purchases)) setLocal("purchases", data.purchases);
    if (Array.isArray(data.expenses)) {
      const directOnly = data.expenses.filter(
        (e: any) => e && e.id && !e.id.startsWith("pur-exp-") && !e.id.startsWith("brk-seller-exp-") && !e.id.startsWith("pur-brk-exp-")
      );
      setLocal("expenses", directOnly);
    }
    if (Array.isArray(data.assets)) setLocal("assets", data.assets);
    if (typeof data.liquid_cash === "number") setLiquidCash(data.liquid_cash);
    if (Array.isArray(data.buyers)) setLocal("buyers", data.buyers);
    if (Array.isArray(data.suppliers)) setLocal("gemvault_suppliers", data.suppliers);
    if (Array.isArray(data.brokers)) setLocal("gemvault_brokers", data.brokers);
    if (Array.isArray(data.custom_particulars)) setLocal("custom_particulars", data.custom_particulars);
    if (Array.isArray(data.custom_labs)) setLocal("custom_labs", data.custom_labs);

    return {
      success: true,
      message: "Database successfully restored locally!",
      counts: {
        boxes: (data.boxes || []).length,
        packets: (data.packets || []).length,
        sales: (data.sales || []).length,
        brokerage: (data.brokerage || []).length,
        purchases: (data.purchases || []).length,
        expenses: (data.expenses || []).length,
        assets: (data.assets || []).length,
      },
    };
  } catch (err: any) {
    return { success: false, message: "Backup restore failed: " + (err?.message || "Invalid JSON") };
  }
}

export function resetToGemstoneSeed(): void {
  setLocal("boxes", DEFAULT_BOXES);
  setLocal("packets", []);
  setLocal("sales", []);
  setLocal("brokerage", []);
  setLocal("purchases", []);
  setLocal("expenses", []);
  setLocal("assets", []);
  setLocal("liquid_cash", 0);
  setLocal("buyers", []);
  setLocal("gemvault_suppliers", []);
  setLocal("gemvault_brokers", []);
  setLocal("custom_box_tags", []);
  setLocal("custom_particulars", DEFAULT_PARTICULARS);
  setLocal("custom_labs", DEFAULT_CERT_LABS);
  try {
    localStorage.removeItem("gemvault_backup_history_records");
    localStorage.removeItem("gemvault_last_weekly_backup_timestamp");
  } catch {}
}

export const BARE_SHELL_VERSION_KEY = "gemvault_bare_shell_v5_clean_client_delivery";

export function ensureBareShellCleanState(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const current = localStorage.getItem(BARE_SHELL_VERSION_KEY);
      if (!current) {
        resetToGemstoneSeed();
        idbClear().catch(() => {});
        localStorage.setItem(BARE_SHELL_VERSION_KEY, "true");
      }
    }
  } catch {}
}

// Ensure clean state runs immediately when module is loaded
ensureBareShellCleanState();

