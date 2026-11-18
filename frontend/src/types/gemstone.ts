// Gemstones CRM & Inventory Master — Domain Types

export type WeightUnit = "cts" | "g";

export type GemstoneStatus = "in_stock" | "on_memo" | "on_approval" | "reserved" | "sold";

export const DEFAULT_COMPANIES = [
  "Shreeji Gems",
  "Shree Lakshmi Gems",
  "Shree Krishna Gems",
  "Tirth Enterprise",
  "Mokshil Traders",
] as const;

export type CompanyName = (typeof DEFAULT_COMPANIES)[number] | string;

export const DEFAULT_SHAPES = [
  "Oval",
  "Cushion",
  "Round",
  "Emerald Cut",
  "Radiant",
  "Pear",
  "Marquise",
  "Princess",
  "Heart",
  "Trilliant",
  "Baguette",
  "Asscher",
  "Cabochon",
  "Drop / Briolette",
  "Sugarloaf",
  "Rough / Uncut",
] as const;

export type GemShape = (typeof DEFAULT_SHAPES)[number] | string;

export const DEFAULT_VARIETIES = [
  "Emerald",
  "Emerald (Zambian)",
  "Emerald (Colombian)",
  "Emerald (Panjshir / Afghan)",
  "Emerald (Russian / Ural)",
  "Emerald (Brazilian)",
  "Emerald (Ethiopian)",
  "Emerald Cat's Eye",
  "Trapiche Emerald",
  "Ruby",
  "Ruby (Burmese Pigeon Blood)",
  "Ruby (Mozambique)",
  "Ruby (Madagascar)",
  "Ruby (Thai / Siamese)",
  "Ruby (Ceylon / Sri Lanka)",
  "Star Ruby (Natural Unheated)",
  "Blue Sapphire",
  "Blue Sapphire (Ceylon Royal Blue)",
  "Blue Sapphire (Ceylon Cornflower)",
  "Blue Sapphire (Kashmir Velvet)",
  "Blue Sapphire (Burmese)",
  "Blue Sapphire (Madagascar)",
  "Yellow Sapphire",
  "Yellow Sapphire (Ceylon Pukhraj)",
  "Yellow Sapphire (Bangkok)",
  "Pink Sapphire",
  "Pink Sapphire (Ceylon)",
  "Pink Sapphire (Madagascar)",
  "White Sapphire",
  "Padparadscha Sapphire (Natural Lotus)",
  "Green Sapphire",
  "Purple / Violet Sapphire",
  "Star Sapphire (Natural Asterism)",
  "Color-Change Sapphire",
  "Diamond",
  "Diamond Solitaire",
  "Diamond Melee Parcel",
  "Diamond (Fancy Yellow)",
  "Diamond (Fancy Pink)",
  "Diamond (Fancy Blue)",
  "Tanzanite",
  "Tanzanite (Merelani AAA Royal Blue)",
  "Aquamarine",
  "Aquamarine (Santa Maria Deep Blue)",
  "Morganite (Peach / Pink Beryl)",
  "Heliodor (Golden Beryl)",
  "Bixbite (Red Beryl)",
  "Goshenite (White Beryl)",
  "Spinel",
  "Red Spinel (Burmese / Mahenge)",
  "Hot Pink / Neon Spinel (Mahenge)",
  "Cobalt Blue Spinel (Luc Yen)",
  "Purple / Violet Spinel",
  "Black Spinel",
  "Tourmaline",
  "Paraiba Tourmaline (Neon Blue)",
  "Rubellite (Pigeon Blood / Raspberry)",
  "Indicolite (Blue Tourmaline)",
  "Chrome Tourmaline (Vivid Green)",
  "Bi-Color / Watermelon Tourmaline",
  "Yellow / Canary Tourmaline",
  "Garnet / Tsavorite",
  "Tsavorite Garnet (Vivid Green)",
  "Demantoid Garnet (Russian Horsetail)",
  "Spessartite / Mandarin Garnet",
  "Rhodolite Garnet (Purplish Red)",
  "Hessonite Garnet (Ceylon Gomedh)",
  "Alexandrite",
  "Alexandrite (Color Change)",
  "Chrysoberyl Cat's Eye (Lehsunia)",
  "Opal",
  "Opal (Australian Black)",
  "Opal (Australian White / Crystal)",
  "Opal (Australian Boulder)",
  "Fire Opal (Mexican Sun Color)",
  "Opal (Ethiopian Welo Hydrophane)",
  "Topaz",
  "Imperial Topaz (Natural Golden Sherry)",
  "Swiss Blue Topaz",
  "London Blue Topaz",
  "Peridot",
  "Peridot (Burmese / Pakistani Suppat)",
  "Zircon (Blue Cambodian Ratanakiri)",
  "Zircon (Natural White Starlite)",
  "Amethyst",
  "Citrine",
  "Ametrine",
  "Rose Quartz",
  "Smoky Quartz",
  "Rutilated Quartz",
  "Pearl",
  "Natural Basra Pearl",
  "South Sea Pearl (Golden / White)",
  "Tahitian Black Pearl",
  "Cultured Pearl (Japanese Akoya)",
  "Red Coral (Italian Moonga)",
  "Turquoise (Persian Neyshabur)",
  "Lapis Lazuli (Badakhshan Afghan Royal)",
  "Natural Baltic Amber",
  "Imperial Jadeite (Type A Jade)",
  "Moonstone (Rainbow / Ceylon Blue Sheen)",
  "Sunstone (Oregon Schiller)",
  "Iolite (Neeli - Water Sapphire)",
  "Kunzite (Spodumene)",
] as const;

export type GemVariety = (typeof DEFAULT_VARIETIES)[number] | string;

export interface GemBox {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
  packet_count?: number;
  total_pcs?: number;
  total_weight?: number;
  initial_pcs?: number;
  initial_weight?: number;
  cost_valuation?: number;
  asking_valuation?: number;
  in_stock_count?: number;
}

export interface GemStoneDetail {
  id?: string;
  variety?: string; // e.g. "Emerald", "Ruby", "Diamond"
  shape?: string; // e.g. "Oval", "Round", "Cushion"
  weight: number; // Carats
  mm_size?: string; // e.g. "8.2 x 6.4 mm"
  notes?: string;
  status?: "in_stock" | "sold" | "on_approval";
}

export interface GemSubItem {
  id: string;
  variety: string; // e.g. "Emerald", "Ruby", "Diamond Melee"
  shape: string; // e.g. "Oval", "Round", "Baguette"
  weight: number; // Carats or grams
  unit?: WeightUnit;
  pieces: number; // Pieces
  mm_size: string; // Dimensions
  notes?: string;
}

export interface GemPacket {
  id: string;
  packet_number: string; // e.g., "ex/1", "ex/2", "EM-101", "RUB-204"
  box_name?: string; // Box containing the packet, e.g. "Box 1 - Emerald Vault"
  particulars: string; // e.g., "Emerald (Zambian)", "Ruby (Burmese Pigeon Blood)", customizable
  shape: string; // "Oval", "Cushion", "Emerald Cut", etc.
  weight: number; // Carats (cts) or Grams (g)
  unit: WeightUnit; // "cts" | "g"
  pieces: number; // Number of pieces (pcs)
  initial_weight?: number; // Original intake weight prior to partial sales
  initial_pieces?: number; // Original intake pieces prior to partial sales
  is_uncountable?: boolean; // Packets with multiple pieces that are uncountable (weight-based only)
  stone_category?: "bulk" | "no_individual_weight" | "individual_weight_added"; // Explicit 3-tier categorization
  stone_weight?: number; // Weight per stone for grouping (e.g. 0.50 cts each)
  stone_weights?: number[]; // Individual distribution of weight per stone (e.g. [0.55, 0.48, 0.60])
  stone_details?: GemStoneDetail[]; // Individual rich stone customization: variety, shape, weight, mm_size, notes
  mm_size: string; // Dimensions (e.g. "8.2 x 6.4 x 4.1 mm", "5.0 mm calibrated")
  
  // Purchase particulars
  purchase_price: number; // Total purchase cost (Aggregate)
  purchase_rate_per_unit: number; // Cost per carat or per gram
  purchase_rate_per_ct?: number; // Legacy alias for backward compatibility
  purchase_date: string; // YYYY-MM-DD
  supplier_name?: string; // Vendor / Mine / Dealer
  
  // Asking / Target sale particulars
  sale_price: number; // Asking / target total price (Aggregate)
  sale_rate_per_unit: number; // Target price per carat or per gram
  sale_rate_per_ct?: number; // Legacy alias for backward compatibility
  min_sale_price?: number; // Floor price
  
  // Status and actual sale / buyer info
  status: GemstoneStatus;
  company_name?: string; // Which of the 5 companies
  buyer_name?: string; // Buyer name when sold or reserved
  sale_date?: string; // Date of sale
  sold_price?: number; // Actual sale price
  sold_rate_per_unit?: number; // Actual sale rate per ct/g
  sale_invoice_id?: string;
  
  // Memo / Approval particulars (when given for inspection)
  memo_party?: string;
  memo_date?: string;
  memo_notes?: string;
  is_approval?: boolean;
  approval_status?: "pending" | "approved_billed" | "returned";

  // Gemological specifics
  origin?: string;
  treatment?: string;
  cert_lab?: string; // Customizable: "GIA", "GRS", "IGI", or any custom lab
  cert_no?: string;
  color_grade?: string;
  clarity?: string;
  notes?: string;

  // Statutory GST & HSN
  hsn_code?: string; // Predefined HSN: e.g. 7103, 7102, 7113
  gst_rate?: number; // e.g. 0.25%, 3%

  // Jewellery & Diamond specifics (for Tirth Entp & Mokshil Traders)
  making_charges?: number;
  diamond_weight?: number; // cts
  diamond_pieces?: number;
  diamond_value?: number;
  metal_weight?: number; // grams
  metal_purity?: string; // 18K, 22K, Platinum
  gemstone_weight?: number;

  // Multi-stone parcel / mixed box itemized breakdown
  sub_gems?: GemSubItem[];

  // Concurrency & Domain
  version_id?: number;
  ownership_type?: string;
  treatment_status?: string;

  created_at: string;
  updated_at: string;
}

export interface GemSaleItem {
  packet_id: string;
  packet_number: string;
  particulars: string;
  shape: string;
  weight: number;
  unit: WeightUnit;
  pieces: number;
  is_uncountable?: boolean;
  stone_weight?: number;
  stone_weights?: number[]; // Individual distribution of weight per stone
  stone_details?: GemStoneDetail[]; // Individual rich stone customization
  stone_id?: string; // Specific individual stone ID if allocated from stone_details or sub_gems
  sub_gem_id?: string;
  mm_size: string;
  cost_price: number; // Total cost price
  rate_per_unit: number; // Selling rate per ct/g
  rate_per_ct?: number; // Legacy alias for backward compatibility
  total_price: number; // Aggregate total price before GST
  hsn_code?: string;
  gst_rate?: number;
  gst_amount?: number;

  // Memo / Approval settlement history
  original_weight?: number;
  original_pieces?: number;
  weight_returned?: number;
  pieces_returned?: number;
  weight_taken?: number;
  pieces_taken?: number;
  is_returned?: boolean;
  slip_no?: number | string;

  // Outside stock sourcing details
  purchased_from?: string;
  purchased_from_phone?: string;
  purchased_from_notes?: string;

  // Jewellery specifics if applicable
  making_charges?: number;
  diamond_weight?: number;
  metal_weight?: number;
  gemstone_weight?: number;
}

export interface GemSalePayment {
  id: string;
  date: string;
  amount: number;
  mode: "Cash" | "Bank Wire / NEFT" | "Cheque" | "Angadia" | "UPI" | "Other";
  note?: string;
}

export interface GemSale {
  id: string;
  invoice_no: string; // e.g. "GEM-2026-001"
  date: string;
  company_name: string; // One of the 5 companies
  sell_type: "own_stock" | "outside_stock"; // Own Vault vs Outside Brokerage Stock
  is_approval?: boolean; // True if on approval/memo
  approval_status?: "pending" | "approved_billed" | "returned";
  approval_billed_date?: string;
  buyer_name: string;
  buyer_phone?: string;
  buyer_city?: string;
  buyer_address?: string;
  items: GemSaleItem[];
  returned_items?: GemSaleItem[];
  subtotal: number;
  discount: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  tax_amount: number; // Total GST
  total: number; // Subtotal + GST - discount
  paid_amount: number;
  balance: number;
  payment_status: "cleared" | "partial" | "unpaid";
  payment_mode?: string;
  payments: GemSalePayment[];
  credit_days?: number;
  due_date?: string;
  notes?: string;
  created_at: string;
}

export interface GemBrokerage {
  id: string;
  deal_no: string; // e.g. "BRK-2026-01"
  date: string;
  company_name: string; // Which company executed the brokerage
  seller_name: string;
  buyer_name: string;
  particulars: string;
  shape: string;
  weight: number;
  unit: WeightUnit;
  pieces: number;
  mm_size?: string;
  cert_lab?: string;
  
  // Buy and Sell amounts entered respectively (calculated from per-unit rate)
  buy_rate_per_unit?: number; // Cost rate per ct/g from seller
  sell_rate_per_unit?: number; // Sold rate per ct/g to buyer
  buy_amount: number; // Total cost from seller
  sell_amount: number; // Total sold to buyer
  deal_value: number; // Total transaction value
  brokerage_percent: number; // Commission %
  commission_amount: number; // Total commission spread (Sell - Buy or % based)
  commission_from?: "buyer" | "seller" | "both";
  
  settlement_status: "received" | "pending" | "partial";
  deal_settlement_status?: "pending_both" | "paid_seller_pending_buyer" | "paid_buyer_pending_seller" | "fully_settled" | "partial_settled";
  amount_paid_to_seller?: number;
  date_paid_to_seller?: string;
  mode_paid_to_seller?: string;
  note_paid_to_seller?: string;
  amount_received_from_buyer?: number;
  date_received_from_buyer?: string;
  mode_received_from_buyer?: string;
  note_received_from_buyer?: string;
  seller_payments?: GemSalePayment[];
  buyer_payments?: GemSalePayment[];
  commission_payments?: GemSalePayment[];
  received_amount: number;
  balance_receivable: number; // Pending commission
  settlement_date?: string;
  payment_mode?: string;
  reflect_in_sales?: boolean; // Reflected on sales list as outside stock
  notes?: string;
  created_at: string;
}

export interface GemPurchaseItem {
  packet_number: string;
  particulars: string;
  shape: string;
  weight: number;
  unit: WeightUnit;
  pieces: number;
  is_uncountable?: boolean;
  stone_category?: "bulk" | "no_individual_weight" | "individual_weight_added";
  stone_weight?: number;
  stone_weights?: number[]; // Individual distribution of weight per stone
  stone_details?: GemStoneDetail[]; // Individual rich stone customization
  mm_size: string;
  purchase_rate_per_unit: number;
  cost_price: number;
  sale_rate_per_unit: number;
  target_sale_price: number;
  box_name?: string;
  origin?: string;
  treatment?: string;
  cert_lab?: string;
  hsn_code?: string;
  sub_gems?: GemSubItem[];
  making_charges?: number;
  diamond_weight?: number;
  metal_weight?: number;
}

export interface GemPurchase {
  id: string;
  purchase_no: string;
  date: string;
  company_name: string; // Which company bought
  supplier_name: string;
  supplier_phone?: string;
  supplier_city?: string;
  lot_ref?: string;
  items: GemPurchaseItem[];
  total_cost: number;
  paid_amount: number;
  balance_payable: number;
  payment_status: "cleared" | "partial" | "unpaid";
  payment_mode?: string;
  credit_days?: number;
  due_date?: string;
  payments?: GemSalePayment[];
  broker_name?: string;
  broker_phone?: string;
  brokerage_type?: "percent" | "manual";
  brokerage_rate?: number;
  brokerage_amount?: number;
  brokerage_paid?: boolean;
  brokerage_paid_amount?: number;
  brokerage_balance_due?: number;
  broker_payments?: GemSalePayment[];
  status?: "active" | "cancelled";
  cancelled_date?: string;
  cancelled_reason?: string;
  notes?: string;
  created_at: string;
}

export interface GemExpense {
  id: string;
  date: string;
  expense_type: "petty" | "business"; // 2 clear sections: Petty vs Business
  company_name?: string;
  category: string;
  amount: number;
  payee: string;
  packet_ref?: string;
  payment_mode?: string;
  note?: string;
  created_at: string;
}

export interface GemAsset {
  id: string;
  name: string; // e.g. "Office Locker / Safe", "Jaipur Diamond Scales", "BKC Vault Deposit"
  category: string;
  valuation: number;
  purchase_date?: string;
  company_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface GemBuyer {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

export interface GstSettings {
  default_rate: number; // e.g. 0.25 or 3.0
  available_rates: number[]; // e.g. [0, 0.25, 1.5, 3.0, 5.0, 12.0, 18.0]
  gemstone_hsn: string; // e.g. "7103"
  diamond_hsn: string; // e.g. "7102"
  jewellery_hsn: string; // e.g. "7113"
  enable_gst_by_default: boolean;
}

export interface SaleLedgerItem {
  id: string;
  transaction_type: "direct_sale" | "brokerage_deal";
  invoice_or_deal_no: string;
  date: string;
  company_name: string;
  buyer_name: string;
  seller_name?: string;
  particulars_summary: string;
  weight: number;
  unit: WeightUnit | string;
  pieces: number;
  sale_amount: number; // Invoiced total or Deal value
  cogs_amount: number; // Purchase cost or Sourced price
  gross_profit: number; // Sale amount - COGS
  margin_pct: number;
  paid_amount: number; // Received from buyer
  balance_due: number; // Accounts Receivable from buyer
  payment_status: "cleared" | "partial" | "unpaid";
  payment_mode?: string;
  notes?: string;
  items_count: number;
}

export interface BalanceSheetData {
  as_of_date: string;
  assets: {
    current_assets: {
      liquid_cash: number;
      accounts_receivable_direct_sales: number;
      accounts_receivable_brokerage_deals: number;
      pending_brokerage_commissions: number;
      total_accounts_receivable: number;
      inventory_at_cost: number;
      total_current_assets: number;
    };
    fixed_assets: {
      items: Array<{ id: string; name: string; category: string; valuation: number }>;
      total_fixed_assets: number;
    };
    inventory_at_market: number;
    unrealized_inventory_appreciation: number;
    total_assets: number;
  };
  liabilities: {
    current_liabilities: {
      accounts_payable_suppliers: number;
      brokerage_payable_purchase_brokers: number;
      brokerage_payable_deal_sellers: number;
      total_current_liabilities: number;
    };
    total_liabilities: number;
  };
  equity: {
    net_worth: number; // Total Assets - Total Liabilities
    working_capital: number; // Current Assets - Current Liabilities
    current_ratio: number;
  };
}

