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
} from "./types/gemstone";
import { DEFAULT_SHAPES } from "./types/gemstone";
import { parseParticularsVariety, isGenericVariety } from "./packetStones";

export function normalizeBoxName(name?: string | null): string {
  if (!name) return "";
  return name.replace(/[—–-]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

const STORAGE_PREFIX = "gemvault_local_";

export const DEFAULT_BOXES: GemBox[] = [
  {
    id: "box-1",
    name: "Box 1 — Emerald Vault",
    description: "Zambian & Colombian certified emerald packets",
    color: "#10b981",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "box-2",
    name: "Box 2 — Ceylon Sapphires",
    description: "Unheated Royal Blue and Yellow Pukhraj Sapphires",
    color: "#3b82f6",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "box-3",
    name: "Box 3 — Burmese Rubies & Spinels",
    description: "Mogok Pigeon Blood Rubies and Red Spinels",
    color: "#ef4444",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "box-4",
    name: "Box 4 — Diamond Locker",
    description: "Certified solitaires, fancy color diamonds & melee",
    color: "#f59e0b",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "box-5",
    name: "Box 5 — Tanzanite & Layouts",
    description: "Merelani Tanzanites, Alexandrites and mixed layouts",
    color: "#8b5cf6",
    created_at: "2026-08-01T10:00:00Z",
  },
];

export const DEFAULT_PARTICULARS: string[] = [
  "Emerald (Zambian)",
  "Emerald (Colombian)",
  "Ruby (Burmese Pigeon Blood)",
  "Ruby (Mozambique)",
  "Blue Sapphire (Ceylon)",
  "Yellow Sapphire (Ceylon Pukhraj)",
  "Tanzanite (Merelani AAA)",
  "Diamond Solitaire",
  "Diamond Melee Parcel",
  "Alexandrite (Color Change)",
  "Tsavorite Garnet",
  "Aquamarine (Santa Maria)",
  "Tourmaline (Paraiba)",
  "Spinel (Burmese Red)",
  "Morganite",
  "Opal (Australian Black)",
  "Padparadscha Sapphire",
  "Peridot",
  "Yellow Beryl / Heliodor",
  "Chrysoberyl Cat's Eye",
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

export const DEFAULT_PACKETS: GemPacket[] = [
  {
    id: "pkt-ex-1",
    packet_number: "ex/1",
    box_name: "Box 1 — Emerald Vault",
    particulars: "Emerald (Zambian Minor Oil)",
    shape: "Oval",
    weight: 4.25,
    unit: "cts",
    pieces: 1,
    mm_size: "11.2 x 8.4 x 5.6 mm",
    purchase_price: 212500,
    purchase_rate_per_unit: 50000,
    purchase_date: "2026-08-15",
    supplier_name: "Kagem Mining Ltd / Lusaka",
    sale_price: 318750,
    sale_rate_per_unit: 75000,
    min_sale_price: 290000,
    status: "in_stock",
    company_name: "Shreeji Gems",
    origin: "Zambia",
    treatment: "Minor Oil",
    cert_lab: "GRS",
    cert_no: "GRS-2026-08412",
    color_grade: "Vivid Green",
    clarity: "Eye Clean",
    hsn_code: "7103",
    gst_rate: 0.25,
    notes: "Top luster, very light silky veil, vibrant saturation",
    created_at: "2026-08-15T10:00:00Z",
    updated_at: "2026-08-15T10:00:00Z",
  },
  {
    id: "pkt-ex-2",
    packet_number: "ex/2",
    box_name: "Box 3 — Burmese Rubies & Spinels",
    particulars: "Ruby (Burmese Pigeon Blood)",
    shape: "Cushion",
    weight: 2.80,
    unit: "cts",
    pieces: 1,
    mm_size: "8.6 x 7.4 x 4.9 mm",
    purchase_price: 420000,
    purchase_rate_per_unit: 150000,
    purchase_date: "2026-08-20",
    supplier_name: "Mogok Gem Corp / Bangkok",
    sale_price: 616000,
    sale_rate_per_unit: 220000,
    min_sale_price: 575000,
    status: "sold",
    company_name: "Shree Lakshmi Gems",
    buyer_name: "Rajesh Jewellers (Zaveri Bazaar)",
    sale_date: "2026-09-02",
    sold_price: 590000,
    sold_rate_per_unit: 210714,
    sale_invoice_id: "inv-2026-001",
    origin: "Burma (Mogok)",
    treatment: "None / Unheated",
    cert_lab: "GIA",
    cert_no: "GIA-642199081",
    color_grade: "Pigeon Blood Red",
    clarity: "VVS",
    hsn_code: "7103",
    gst_rate: 0.25,
    notes: "Outstanding natural red fluorescence, museum grade",
    created_at: "2026-08-20T11:00:00Z",
    updated_at: "2026-09-02T16:30:00Z",
  },
  {
    id: "pkt-ex-3",
    packet_number: "ex/3",
    box_name: "Box 2 — Ceylon Sapphires",
    particulars: "Royal Blue Sapphire (Ceylon)",
    shape: "Cushion",
    weight: 5.50,
    unit: "cts",
    pieces: 1,
    mm_size: "11.8 x 9.2 x 6.1 mm",
    purchase_price: 495000,
    purchase_rate_per_unit: 90000,
    purchase_date: "2026-08-28",
    supplier_name: "Ratnapura Gem House / Colombo",
    sale_price: 715000,
    sale_rate_per_unit: 130000,
    min_sale_price: 660000,
    status: "in_stock",
    company_name: "Shree Krishna Gems",
    origin: "Ceylon (Sri Lanka)",
    treatment: "None / Unheated",
    cert_lab: "GRS",
    cert_no: "GRS-2026-09144",
    color_grade: "Royal Blue",
    clarity: "Eye Clean",
    hsn_code: "7103",
    gst_rate: 0.25,
    notes: "Deep velvety royal blue with extraordinary brilliance",
    created_at: "2026-08-28T09:30:00Z",
    updated_at: "2026-08-28T09:30:00Z",
  },
  {
    id: "pkt-ex-4",
    packet_number: "ex/4",
    box_name: "Box 2 — Ceylon Sapphires",
    particulars: "Yellow Sapphire (Ceylon Pukhraj)",
    shape: "Oval",
    weight: 6.15,
    unit: "cts",
    pieces: 1,
    mm_size: "12.4 x 9.8 x 6.5 mm",
    purchase_price: 184500,
    purchase_rate_per_unit: 30000,
    purchase_date: "2026-09-01",
    supplier_name: "Lanka Gems Consortium",
    sale_price: 276750,
    sale_rate_per_unit: 45000,
    min_sale_price: 245000,
    status: "on_approval",
    company_name: "Shreeji Gems",
    memo_party: "Sanjay Shah (Broker)",
    memo_date: "2026-10-04",
    memo_notes: "Given on approval for client wedding ring",
    is_approval: true,
    approval_status: "pending",
    origin: "Ceylon (Sri Lanka)",
    treatment: "None / Unheated",
    cert_lab: "IGI",
    cert_no: "IGI-5192801",
    color_grade: "Golden Lemon Yellow",
    clarity: "VVS",
    hsn_code: "7103",
    gst_rate: 0.25,
    notes: "Vedic astrology certified, 100% natural unheated",
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-10-04T14:15:00Z",
  },
  {
    id: "pkt-ex-5",
    packet_number: "ex/5",
    box_name: "Box 5 — Tanzanite & Layouts",
    particulars: "Tanzanite (Merelani AAA)",
    shape: "Trilliant",
    weight: 8.40,
    unit: "cts",
    pieces: 1,
    mm_size: "13.5 x 13.5 x 7.8 mm",
    purchase_price: 252000,
    purchase_rate_per_unit: 30000,
    purchase_date: "2026-09-05",
    supplier_name: "Arusha Rough Exporters",
    sale_price: 378000,
    sale_rate_per_unit: 45000,
    min_sale_price: 335000,
    status: "in_stock",
    company_name: "Shreeji Gems",
    origin: "Tanzania (Merelani)",
    treatment: "Gentle Heat",
    cert_lab: "Self / None",
    color_grade: "Intense Blue-Violet (AAA)",
    clarity: "Loupe Clean",
    hsn_code: "7103",
    gst_rate: 0.25,
    notes: "Intense trichroic shifts with rich purple/blue hues",
    created_at: "2026-09-05T14:20:00Z",
    updated_at: "2026-09-05T14:20:00Z",
  },
  {
    id: "pkt-ex-6",
    packet_number: "ex/6",
    box_name: "Box 4 — Diamond Locker",
    particulars: "Diamond Solitaire (D-VVS1)",
    shape: "Round Brilliant",
    weight: 1.52,
    unit: "cts",
    pieces: 1,
    mm_size: "7.35 x 7.38 x 4.52 mm",
    purchase_price: 760000,
    purchase_rate_per_unit: 500000,
    purchase_date: "2026-09-10",
    supplier_name: "Surat Diamond Exporters",
    sale_price: 988000,
    sale_rate_per_unit: 650000,
    min_sale_price: 930000,
    status: "sold",
    company_name: "Tirth Enterprise",
    buyer_name: "Mehta & Sons Jewellers (Bandra)",
    sale_date: "2026-09-22",
    sold_price: 960000,
    sold_rate_per_unit: 631578,
    sale_invoice_id: "inv-2026-002",
    origin: "Botswana / Surat Cut",
    treatment: "None / Natural",
    cert_lab: "GIA",
    cert_no: "GIA-2194881023",
    color_grade: "D (Colorless)",
    clarity: "VVS1",
    hsn_code: "7102",
    gst_rate: 0.25,
    making_charges: 25000,
    notes: "Triple Excellent (Cut, Polish, Symmetry), None fluorescence",
    created_at: "2026-09-10T11:00:00Z",
    updated_at: "2026-09-22T17:00:00Z",
  },
  {
    id: "pkt-ex-7",
    packet_number: "ex/7",
    box_name: "Box 1 — Emerald Vault",
    particulars: "Tsavorite Garnet",
    shape: "Oval",
    weight: 3.10,
    unit: "cts",
    pieces: 1,
    mm_size: "9.4 x 7.2 x 5.1 mm",
    purchase_price: 155000,
    purchase_rate_per_unit: 50000,
    purchase_date: "2026-09-12",
    supplier_name: "East Africa Gem Traders",
    sale_price: 232500,
    sale_rate_per_unit: 75000,
    min_sale_price: 210000,
    status: "in_stock",
    company_name: "Mokshil Traders",
    origin: "Kenya (Tsavo)",
    treatment: "None / Natural",
    cert_lab: "GRS",
    cert_no: "GRS-2026-10022",
    color_grade: "Vivid Emerald Green",
    clarity: "Eye Clean",
    hsn_code: "7103",
    gst_rate: 0.25,
    notes: "Electrifying neon green glow without any heating",
    created_at: "2026-09-12T10:30:00Z",
    updated_at: "2026-09-12T10:30:00Z",
  },
  {
    id: "pkt-ex-8",
    packet_number: "ex/8",
    box_name: "Box 5 — Tanzanite & Layouts",
    particulars: "Alexandrite (Color Change)",
    shape: "Cushion",
    weight: 1.85,
    unit: "cts",
    pieces: 1,
    mm_size: "7.5 x 6.8 x 4.2 mm",
    purchase_price: 555000,
    purchase_rate_per_unit: 300000,
    purchase_date: "2026-09-15",
    supplier_name: "Minas Gerais Gem Vault",
    sale_price: 832500,
    sale_rate_per_unit: 450000,
    min_sale_price: 770000,
    status: "in_stock",
    company_name: "Shreeji Gems",
    origin: "Brazil",
    treatment: "None / Natural",
    cert_lab: "Gübelin",
    cert_no: "GUB-260901",
    color_grade: "Green to Raspberry Red (100% Change)",
    clarity: "VS",
    hsn_code: "7103",
    gst_rate: 0.25,
    notes: "Super rare chrysoberyl with phenomenal 100% color shift",
    created_at: "2026-09-15T15:00:00Z",
    updated_at: "2026-09-15T15:00:00Z",
  },
  {
    id: "pkt-ex-9",
    packet_number: "ex/9",
    box_name: "Box 5 — Tanzanite & Layouts",
    particulars: "Aquamarine (Santa Maria)",
    shape: "Emerald Cut",
    weight: 12.60,
    unit: "cts",
    pieces: 1,
    mm_size: "16.2 x 11.5 x 8.4 mm",
    purchase_price: 189000,
    purchase_rate_per_unit: 15000,
    purchase_date: "2026-09-18",
    supplier_name: "Brazil Rough & Gems",
    sale_price: 277200,
    sale_rate_per_unit: 22000,
    min_sale_price: 250000,
    status: "in_stock",
    company_name: "Shree Lakshmi Gems",
    origin: "Brazil (Santa Maria)",
    treatment: "None / Natural",
    cert_lab: "Self / None",
    color_grade: "Intense Santa Maria Blue",
    clarity: "Eye Clean",
    hsn_code: "7103",
    gst_rate: 0.25,
    notes: "Extraordinary saturated deep ocean blue color",
    created_at: "2026-09-18T10:00:00Z",
    updated_at: "2026-09-18T10:00:00Z",
  },
  {
    id: "pkt-ex-10",
    packet_number: "ex/10",
    box_name: "Box 1 — Emerald Vault",
    particulars: "Emerald Melee Matched Parcel",
    shape: "Round",
    weight: 22.50,
    unit: "cts",
    pieces: 45,
    mm_size: "2.5 mm calibrated",
    purchase_price: 180000,
    purchase_rate_per_unit: 8000,
    purchase_date: "2026-09-20",
    supplier_name: "Jaipur Gem Cutting Works",
    sale_price: 270000,
    sale_rate_per_unit: 12000,
    min_sale_price: 240000,
    status: "in_stock",
    company_name: "Shree Krishna Gems",
    origin: "Zambia",
    treatment: "Standard Oil",
    cert_lab: "Self / None",
    color_grade: "Medium Vivid Green",
    clarity: "VS",
    hsn_code: "7103",
    gst_rate: 0.25,
    notes: "Calibrated 45-piece jewelry layout parcel, perfectly color-matched",
    created_at: "2026-09-20T16:00:00Z",
    updated_at: "2026-09-20T16:00:00Z",
  },
];

export const DEFAULT_SALES: GemSale[] = [
  {
    id: "inv-2026-001",
    invoice_no: "GEM-2026-001",
    date: "2026-09-02",
    company_name: "Shreeji Gems",
    sell_type: "own_stock",
    is_approval: false,
    buyer_name: "Rajesh Jewellers (Zaveri Bazaar)",
    buyer_phone: "+91 98201 23456",
    buyer_city: "Mumbai",
    buyer_address: "Shop 14, Bullion Exchange, Zaveri Bazaar, Mumbai",
    items: [
      {
        packet_id: "pkt-ex-2",
        packet_number: "ex/2",
        particulars: "Ruby (Burmese Pigeon Blood)",
        shape: "Cushion",
        weight: 2.80,
        unit: "cts",
        pieces: 1,
        mm_size: "8.6 x 7.4 x 4.9 mm",
        cost_price: 420000,
        rate_per_unit: 210714,
        total_price: 590000,
        hsn_code: "7103",
        gst_rate: 0.25,
        gst_amount: 1475,
      },
    ],
    subtotal: 590000,
    discount: 0,
    cgst_amount: 737.5,
    sgst_amount: 737.5,
    tax_amount: 1475,
    total: 591475,
    paid_amount: 591475,
    balance: 0,
    payment_status: "cleared",
    payment_mode: "Bank Wire / NEFT",
    payments: [
      {
        id: "pm-1",
        date: "2026-09-02",
        amount: 300000,
        mode: "Bank Wire / NEFT",
        note: "Initial RTGS advance",
      },
      {
        id: "pm-2",
        date: "2026-09-08",
        amount: 291475,
        mode: "Bank Wire / NEFT",
        note: "Final settlement via RTGS",
      },
    ],
    notes: "Payment cleared with full GIA report delivery",
    created_at: "2026-09-02T16:30:00Z",
  },
  {
    id: "inv-2026-002",
    invoice_no: "GEM-2026-002",
    date: "2026-09-22",
    company_name: "Tirth Enterprise",
    sell_type: "own_stock",
    is_approval: false,
    buyer_name: "Mehta & Sons Jewellers (Bandra)",
    buyer_phone: "+91 98211 98765",
    buyer_city: "Mumbai",
    buyer_address: "Waterfield Road, Bandra West, Mumbai",
    items: [
      {
        packet_id: "pkt-ex-6",
        packet_number: "ex/6",
        particulars: "Diamond Solitaire (D-VVS1)",
        shape: "Round Brilliant",
        weight: 1.52,
        unit: "cts",
        pieces: 1,
        mm_size: "7.35 x 7.38 x 4.52 mm",
        cost_price: 760000,
        rate_per_unit: 631578,
        total_price: 960000,
        hsn_code: "7102",
        gst_rate: 0.25,
        gst_amount: 2400,
        making_charges: 25000,
      },
    ],
    subtotal: 960000,
    discount: 0,
    cgst_amount: 1200,
    sgst_amount: 1200,
    tax_amount: 2400,
    total: 962400,
    paid_amount: 500000,
    balance: 462400,
    payment_status: "partial",
    payment_mode: "Bank Wire / NEFT",
    payments: [
      {
        id: "pm-3",
        date: "2026-09-22",
        amount: 500000,
        mode: "Bank Wire / NEFT",
        note: "50% Token advance upon delivery",
      },
    ],
    credit_days: 30,
    due_date: "2026-10-22",
    notes: "Balance 30-day payment term against post-dated cheque",
    created_at: "2026-09-22T17:00:00Z",
  },
  // Approval item demonstration
  {
    id: "appr-2026-001",
    invoice_no: "APPR-2026-001",
    date: "2026-10-04",
    company_name: "Shreeji Gems",
    sell_type: "own_stock",
    is_approval: true,
    approval_status: "pending",
    buyer_name: "Sanjay Shah (Broker)",
    buyer_phone: "+91 98213 44556",
    buyer_city: "Mumbai",
    buyer_address: "Opera House, Mumbai",
    items: [
      {
        packet_id: "pkt-ex-4",
        packet_number: "ex/4",
        particulars: "Yellow Sapphire (Ceylon Pukhraj)",
        shape: "Oval",
        weight: 6.15,
        unit: "cts",
        pieces: 1,
        mm_size: "12.4 x 9.8 x 6.5 mm",
        cost_price: 184500,
        rate_per_unit: 45000,
        total_price: 276750,
        hsn_code: "7103",
        gst_rate: 0.25,
        gst_amount: 692,
      },
    ],
    subtotal: 276750,
    discount: 0,
    cgst_amount: 346,
    sgst_amount: 346,
    tax_amount: 692,
    total: 277442,
    paid_amount: 0,
    balance: 277442,
    payment_status: "unpaid",
    payments: [],
    credit_days: 7,
    due_date: "2026-10-11",
    notes: "Given on approval for client wedding ring. Awaiting decision.",
    created_at: "2026-10-04T14:15:00Z",
  },
];

export const DEFAULT_BROKERAGE: GemBrokerage[] = [
  {
    id: "brk-01",
    deal_no: "BRK-2026-01",
    date: "2026-09-10",
    company_name: "Shreeji Gems",
    seller_name: "Jaipur Royal Gems / Hitesh Bhai",
    buyer_name: "Kalyan Jewellers (Regional Office)",
    particulars: "8.50 ct Zambian Emerald Cushion (No Oil GRS)",
    shape: "Cushion",
    weight: 8.50,
    unit: "cts",
    pieces: 1,
    mm_size: "14.2 x 11.8 x 7.6 mm",
    cert_lab: "GRS No Oil",
    buy_amount: 3750000,
    sell_amount: 3825000,
    deal_value: 3825000,
    brokerage_percent: 2.0,
    commission_amount: 75000,
    commission_from: "both",
    settlement_status: "received",
    received_amount: 75000,
    balance_receivable: 0,
    settlement_date: "2026-09-15",
    payment_mode: "Bank Wire / NEFT",
    reflect_in_sales: true,
    notes: "Brokerage commission cleared via RTGS. Both parties settled.",
    created_at: "2026-09-10T12:00:00Z",
  },
  {
    id: "brk-02",
    deal_no: "BRK-2026-02",
    date: "2026-09-19",
    company_name: "Mokshil Traders",
    seller_name: "Sri Lanka Gem Exporters / Colombo",
    buyer_name: "Poddar Heritage Jewels",
    particulars: "Pair of Ceylon Royal Blue Sapphires 10.40 cts total",
    shape: "Oval",
    weight: 10.40,
    unit: "cts",
    pieces: 2,
    mm_size: "12.0 x 9.5 mm",
    cert_lab: "GRS Minor Oil",
    buy_amount: 1421000,
    sell_amount: 1450000,
    deal_value: 1450000,
    brokerage_percent: 2.0,
    commission_amount: 29000,
    commission_from: "buyer",
    settlement_status: "received",
    received_amount: 29000,
    balance_receivable: 0,
    settlement_date: "2026-09-21",
    payment_mode: "Cheque",
    reflect_in_sales: true,
    notes: "Bridal earring center stones matching pair",
    created_at: "2026-09-19T14:30:00Z",
  },
  {
    id: "brk-03",
    deal_no: "BRK-2026-03",
    date: "2026-10-02",
    company_name: "Tirth Enterprise",
    seller_name: "Antwerp Rough & Cut",
    buyer_name: "Malabar Gold & Diamonds",
    particulars: "3.10 ct Fancy Vivid Yellow Diamond Cushion",
    shape: "Cushion",
    weight: 3.10,
    unit: "cts",
    pieces: 1,
    mm_size: "8.9 x 8.4 x 5.2 mm",
    cert_lab: "GIA Natural Yellow VVS2",
    buy_amount: 2178000,
    sell_amount: 2200000,
    deal_value: 2200000,
    brokerage_percent: 1.0,
    commission_amount: 22000,
    commission_from: "seller",
    settlement_status: "pending",
    received_amount: 0,
    balance_receivable: 22000,
    payment_mode: "Bank Wire / NEFT",
    reflect_in_sales: true,
    notes: "Under 7-day memo inspection clearing on Friday",
    created_at: "2026-10-02T16:00:00Z",
  },
];

export const DEFAULT_PURCHASES: GemPurchase[] = [
  {
    id: "pur-2026-001",
    purchase_no: "GEM-PUR-2026-001",
    date: "2026-08-15",
    company_name: "Shreeji Gems",
    supplier_name: "Kagem Mining Ltd / Lusaka",
    supplier_phone: "+260 212 611000",
    supplier_city: "Lusaka / Zambia",
    lot_ref: "LOT-ZAM-881",
    items: [
      {
        packet_number: "ex/1",
        particulars: "Emerald (Zambian Minor Oil)",
        shape: "Oval",
        weight: 4.25,
        unit: "cts",
        pieces: 1,
        mm_size: "11.2 x 8.4 x 5.6 mm",
        purchase_rate_per_unit: 50000,
        cost_price: 212500,
        sale_rate_per_unit: 75000,
        target_sale_price: 318750,
        box_name: "Box 1 — Emerald Vault",
        origin: "Zambia",
        treatment: "Minor Oil",
        cert_lab: "GRS",
      },
    ],
    total_cost: 212500,
    paid_amount: 212500,
    balance_payable: 0,
    payment_status: "cleared",
    payment_mode: "International Wire / SWIFT",
    notes: "Single rough stone cut & polished in Jaipur",
    created_at: "2026-08-15T10:00:00Z",
  },
  {
    id: "pur-2026-002",
    purchase_no: "GEM-PUR-2026-002",
    date: "2026-08-20",
    company_name: "Shree Lakshmi Gems",
    supplier_name: "Mogok Gem Corp / Bangkok",
    supplier_phone: "+66 2 234 8900",
    supplier_city: "Bangkok / Thailand",
    lot_ref: "MOGOK-BURMA-77",
    items: [
      {
        packet_number: "ex/2",
        particulars: "Ruby (Burmese Pigeon Blood)",
        shape: "Cushion",
        weight: 2.80,
        unit: "cts",
        pieces: 1,
        mm_size: "8.6 x 7.4 x 4.9 mm",
        purchase_rate_per_unit: 150000,
        cost_price: 420000,
        sale_rate_per_unit: 220000,
        target_sale_price: 616000,
        box_name: "Box 3 — Burmese Rubies & Spinels",
        origin: "Burma (Mogok)",
        treatment: "None / Unheated",
        cert_lab: "GIA",
      },
    ],
    total_cost: 420000,
    paid_amount: 420000,
    balance_payable: 0,
    payment_status: "cleared",
    payment_mode: "Bank Wire",
    notes: "Unheated Pigeon Blood Ruby certificate included",
    created_at: "2026-08-20T11:00:00Z",
  },
];

export const DEFAULT_EXPENSES: GemExpense[] = [
  {
    id: "exp-01",
    date: "2026-08-18",
    expense_type: "business",
    company_name: "Shreeji Gems",
    category: "Certification",
    amount: 18500,
    payee: "GRS Gemresearch Swisslab (Mumbai Branch)",
    packet_ref: "ex/1",
    payment_mode: "Bank Wire / NEFT",
    note: "Comprehensive Origin & Treatment report for Zambian Emerald",
    created_at: "2026-08-18T10:00:00Z",
  },
  {
    id: "exp-02",
    date: "2026-08-24",
    expense_type: "business",
    company_name: "Shree Lakshmi Gems",
    category: "Certification",
    amount: 26000,
    payee: "GIA India Laboratory (BKC, Mumbai)",
    packet_ref: "ex/2",
    payment_mode: "Bank Wire / NEFT",
    note: "Pigeon Blood Ruby Identification and Origin Report",
    created_at: "2026-08-24T11:00:00Z",
  },
  {
    id: "exp-03",
    date: "2026-09-01",
    expense_type: "business",
    company_name: "Shreeji Gems",
    category: "Vault & Safe Deposit",
    amount: 45000,
    payee: "BDB Safe Vaults (Bharat Diamond Bourse)",
    payment_mode: "Bank Wire / NEFT",
    note: "Quarterly locker rental and security insurance coverage",
    created_at: "2026-09-01T09:00:00Z",
  },
  {
    id: "exp-04",
    date: "2026-09-15",
    expense_type: "business",
    company_name: "Tirth Enterprise",
    category: "Staff Salaries",
    amount: 65000,
    payee: "Gem Vault Master & Sorter Team",
    payment_mode: "Bank Wire / NEFT",
    note: "Monthly sorting, grading & inventory staff payroll",
    created_at: "2026-09-15T18:00:00Z",
  },
  {
    id: "exp-05",
    date: "2026-09-25",
    expense_type: "petty",
    company_name: "Shreeji Gems",
    category: "Petty Cash / Refreshments",
    amount: 2450,
    payee: "BDB Chai & Hospitality / Guest Refreshments",
    payment_mode: "Cash",
    note: "Broker table tea and refreshments during gem viewing",
    created_at: "2026-09-25T11:00:00Z",
  },
  {
    id: "exp-06",
    date: "2026-10-02",
    expense_type: "petty",
    company_name: "Shree Krishna Gems",
    category: "Local Conveyance & Postage",
    amount: 1800,
    payee: "Angadia Courier / Zaveri Bazaar Local",
    payment_mode: "Cash",
    note: "Local insured hand-delivery parcel docket",
    created_at: "2026-10-02T15:00:00Z",
  },
];

export const DEFAULT_ASSETS: GemAsset[] = [
  {
    id: "ast-1",
    name: "Godrej Defender Prime Vault (Main Strongroom)",
    category: "Vault & Safe",
    valuation: 485000,
    purchase_date: "2024-05-10",
    company_name: "Shreeji Gems",
    notes: "Class C fire & torch resistant gem vault safe in office",
    created_at: "2024-05-10T10:00:00Z",
    updated_at: "2024-05-10T10:00:00Z",
  },
  {
    id: "ast-2",
    name: "Mettler Toledo High-Precision Carat Scale (0.001 ct)",
    category: "Equipment & Tools",
    valuation: 165000,
    purchase_date: "2025-02-14",
    company_name: "Shreeji Gems",
    notes: "Calibrated legal-for-trade carat & gram balance scale",
    created_at: "2025-02-14T10:00:00Z",
    updated_at: "2025-02-14T10:00:00Z",
  },
  {
    id: "ast-3",
    name: "BKC Diamond Bourse Security Deposit Locker",
    category: "Deposit",
    valuation: 1200000,
    purchase_date: "2023-11-01",
    company_name: "Shreeji Gems",
    notes: "BDB Safe Vault Locker permanent deposit",
    created_at: "2023-11-01T10:00:00Z",
    updated_at: "2023-11-01T10:00:00Z",
  },
  {
    id: "ast-4",
    name: "Schneider Gemological Microscope & UV Cabinet",
    category: "Equipment & Tools",
    valuation: 320000,
    purchase_date: "2025-08-20",
    company_name: "Shreeji Gems",
    notes: "Darkfield gemological stone inspection system",
    created_at: "2025-08-20T10:00:00Z",
    updated_at: "2025-08-20T10:00:00Z",
  },
];

export const DEFAULT_BUYERS: GemBuyer[] = [
  {
    id: "buy-1",
    name: "Rajesh Jewellers (Zaveri Bazaar)",
    company: "Rajesh Jewels Pvt Ltd",
    phone: "+91 98201 23456",
    whatsapp: "+91 98201 23456",
    city: "Mumbai",
    address: "Shop 14, Bullion Exchange, Zaveri Bazaar, Mumbai - 400002",
    notes: "Regular high-value buyer for certified Burmese rubies & Ceylon sapphires",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "buy-2",
    name: "Mehta & Sons Jewellers (Bandra)",
    company: "Mehta & Sons Heritage",
    phone: "+91 98211 98765",
    whatsapp: "+91 98211 98765",
    city: "Mumbai",
    address: "Waterfield Road, Bandra West, Mumbai - 400050",
    notes: "Boutique bespoke jeweler, requires GIA triple-ex diamonds & Colombian emeralds",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "buy-3",
    name: "Kalyan Jewellers (Regional Office)",
    company: "Kalyan Jewellers India Ltd",
    phone: "+91 98400 55667",
    whatsapp: "+91 98400 55667",
    city: "Mumbai",
    address: "BDB Complex, BKC, Mumbai - 400051",
    notes: "High volume certified loose gemstones",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "buy-4",
    name: "Tribhovandas Bhimji Zaveri (TBZ)",
    company: "TBZ The Original",
    phone: "+91 98200 11999",
    whatsapp: "+91 98200 11999",
    city: "Mumbai",
    address: "Zaveri Bazaar, Mumbai - 400002",
    notes: "Heritage jewelry brand",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "buy-5",
    name: "Sanjay Shah (Broker)",
    company: "Shah Gem Brokerage",
    phone: "+91 98213 44556",
    whatsapp: "+91 98213 44556",
    city: "Mumbai",
    address: "Panchratna Building, Opera House, Mumbai - 400004",
    notes: "Active broker for unheated Ceylon sapphires and ruby parcels",
    created_at: "2026-08-01T10:00:00Z",
  },
];

// Local Storage Accessors
function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(defaultVal));
      return defaultVal;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return defaultVal;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to localStorage:`, err);
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
// Custom Particulars & Labs
// -------------------------------------------------------------
export function getStoredParticulars(): string[] {
  return getLocal<string[]>("custom_particulars", DEFAULT_PARTICULARS);
}

export function saveCustomParticular(name: string): string[] {
  if (!name || !name.trim()) return getStoredParticulars();
  const list = getStoredParticulars();
  const trimmed = name.trim();
  if (!list.includes(trimmed)) {
    list.push(trimmed);
    setLocal("custom_particulars", list);
  }
  return list;
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
  return getLocal<number>("liquid_cash", 3450000);
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
export function healPacketsWithSales(packets: GemPacket[], sales: GemSale[]): boolean {
  let modified = false;
  for (const pkt of packets) {
    if (!pkt) continue;
    const details = Array.isArray(pkt.stone_details) ? pkt.stone_details : [];
    const weights = Array.isArray(pkt.stone_weights) ? pkt.stone_weights : [];

    // If stone_details is empty or has fewer stones than stone_weights, reconstruct stone_details array
    if (weights.length > details.length) {
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
  }
  return modified;
}

export function getStoredPackets(): GemPacket[] {
  const pkts = getLocal<GemPacket[]>("packets", DEFAULT_PACKETS);
  try {
    const rawSales = typeof window !== "undefined" && window.localStorage
      ? localStorage.getItem(STORAGE_PREFIX + "sales")
      : null;
    const sales: GemSale[] = rawSales ? JSON.parse(rawSales) : DEFAULT_SALES;
    if (Array.isArray(sales) && sales.length > 0 && healPacketsWithSales(pkts, sales)) {
      setLocal("packets", pkts);
    }
  } catch {}
  return pkts;
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

  const targetBox = (packet.box_name || "").trim() || "Box 1 — Emerald Vault";
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

  const pieces = Number(packet.pieces) || 1;
  const stone_weight = packet.stone_weight !== undefined && Number(packet.stone_weight) > 0
    ? Number(packet.stone_weight)
    : (pieces > 0 && weight > 0 ? Math.round((weight / pieces) * 100) / 100 : weight);

  if (packet.id) {
    const idx = packets.findIndex((p) => p.id === packet.id);
    if (idx >= 0) {
      const existing = packets[idx];
      const updated: GemPacket = {
        ...existing,
        ...packet,
        packet_number: cleanPktNum,
        box_name: targetBox,
        weight,
        unit,
        pieces,
        stone_weight,
        stone_weights: packet.stone_weights !== undefined ? packet.stone_weights : existing.stone_weights,
        stone_details: packet.stone_details !== undefined ? packet.stone_details : existing.stone_details,
        sub_gems: packet.sub_gems !== undefined ? packet.sub_gems : existing.sub_gems,
        purchase_rate_per_unit: purchase_rate,
        purchase_price,
        sale_rate_per_unit: sale_rate,
        sale_price,
        hsn_code: hsn,
        gst_rate: gstRate,
        updated_at: now,
      } as GemPacket;
      packets[idx] = updated;
      setLocal("packets", packets);
      return updated;
    }
  }

  // Create new packet
  const newPacket: GemPacket = {
    id: "pkt-" + Math.random().toString(36).substring(2, 9),
    packet_number: cleanPktNum,
    box_name: targetBox,
    particulars: packet.particulars,
    shape: packet.shape,
    weight,
    unit,
    pieces,
    stone_weight,
    stone_weights: packet.stone_weights || (stone_weight ? Array(pieces).fill(stone_weight) : undefined),
    stone_details: packet.stone_details || undefined,
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
          const pIdx = packets.findIndex((p) => p.id === oldIt.packet_id || p.packet_number === oldIt.packet_number);
          if (pIdx >= 0) {
            packets[pIdx].pieces = (packets[pIdx].pieces || 0) + (Number(oldIt.pieces) || 1);
            packets[pIdx].weight = Number(((packets[pIdx].weight || 0) + (Number(oldIt.weight) || 0)).toFixed(2));
            packets[pIdx].status = "in_stock";
            packets[pIdx].buyer_name = "";
            packets[pIdx].sale_date = "";
            packets[pIdx].sold_price = undefined;
            packets[pIdx].sold_rate_per_unit = undefined;
            packets[pIdx].sale_invoice_id = undefined;
            packets[pIdx].is_approval = false;
            packets[pIdx].approval_status = undefined;
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

  // Update Inventory Packets Status based on Sale / Approval / Return
  if (Array.isArray(finalSale.items)) {
    for (const item of finalSale.items) {
      const pIdx = packets.findIndex((p) => p.id === item.packet_id || p.packet_number === item.packet_number);
      if (pIdx >= 0) {
        if (isApproval) {
          if (approvalStatus === "returned") {
            packets[pIdx].status = "in_stock";
            packets[pIdx].memo_party = "";
            packets[pIdx].is_approval = false;
            packets[pIdx].approval_status = "returned";
          } else if (isApprovedBilled) {
            const soldPcs = Number(item.pieces) || 1;
            const soldWt = Number(item.weight) || 0;
            const remainingPcs = Math.max(0, (packets[pIdx].pieces || 0) - soldPcs);
            const remainingWt = Math.max(0, Number(((packets[pIdx].weight || 0) - soldWt).toFixed(2)));

            packets[pIdx].buyer_name = finalSale.buyer_name;
            packets[pIdx].sale_date = finalSale.date;
            packets[pIdx].sold_price = item.total_price;
            packets[pIdx].sold_rate_per_unit = item.rate_per_unit;
            packets[pIdx].sale_invoice_id = finalSale.id;
            packets[pIdx].is_approval = false;
            packets[pIdx].approval_status = "approved_billed";

            if (remainingPcs > 0 && remainingWt > 0) {
              packets[pIdx].pieces = remainingPcs;
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
            const memoPcs = Number(item.pieces) || 1;
            const memoWt = Number(item.weight) || 0;
            const remainingPcs = Math.max(0, (packets[pIdx].pieces || 0) - memoPcs);
            const remainingWt = Math.max(0, Number(((packets[pIdx].weight || 0) - memoWt).toFixed(2)));

            if (remainingPcs > 0 && remainingWt > 0) {
              packets[pIdx].pieces = remainingPcs;
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
          const soldPcs = Number(item.pieces) || 1;
          const soldWt = Number(item.weight) || 0;
          const remainingPcs = Math.max(0, (packets[pIdx].pieces || 0) - soldPcs);
          const remainingWt = Math.max(0, Number(((packets[pIdx].weight || 0) - soldWt).toFixed(2)));

          packets[pIdx].buyer_name = finalSale.buyer_name;
          packets[pIdx].sale_date = finalSale.date;
          packets[pIdx].sold_price = item.total_price;
          packets[pIdx].sold_rate_per_unit = item.rate_per_unit;
          packets[pIdx].sale_invoice_id = finalSale.id;
          packets[pIdx].is_approval = false;

          if (remainingPcs > 0 && remainingWt > 0) {
            packets[pIdx].pieces = remainingPcs;
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
        const pIdx = packets.findIndex((p) => p.id === item.packet_id || p.packet_number === item.packet_number);
        if (pIdx >= 0) {
          packets[pIdx].pieces = (packets[pIdx].pieces || 0) + (Number(item.pieces) || 1);
          packets[pIdx].weight = Number(((packets[pIdx].weight || 0) + (Number(item.weight) || 0)).toFixed(2));
          packets[pIdx].status = "in_stock";
          packets[pIdx].buyer_name = "";
          packets[pIdx].sale_date = "";
          packets[pIdx].sold_price = undefined;
          packets[pIdx].sold_rate_per_unit = undefined;
          packets[pIdx].sale_invoice_id = undefined;
          packets[pIdx].is_approval = false;
          packets[pIdx].approval_status = undefined;
          if (packets[pIdx].purchase_rate_per_unit) {
            packets[pIdx].purchase_price = Math.round(packets[pIdx].purchase_rate_per_unit * packets[pIdx].weight);
          }
          if (packets[pIdx].sale_rate_per_unit) {
            packets[pIdx].sale_price = Math.round(packets[pIdx].sale_rate_per_unit * packets[pIdx].weight);
          }
        }
      }
      setLocal("packets", packets);
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
  const newPayment = {
    id: "pm-" + Math.random().toString(36).substring(2, 9),
    date: payment.date || new Date().toISOString().slice(0, 10),
    amount: Number(payment.amount) || 0,
    mode: payment.mode || "Bank Wire / NEFT",
    note: payment.note || "",
  };

  const payments = [...(sale.payments || []), newPayment];
  const paid_amount = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, sale.total - paid_amount);
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

  const rec = Number(dealData.received_amount) || 0;
  const bal = Math.max(0, commAmt - rec);
  const status = bal <= 0 ? "received" : rec > 0 ? "partial" : "pending";

  let finalDeal: GemBrokerage;

  if (dealData.id) {
    const idx = deals.findIndex((d) => d.id === dealData.id);
    if (idx >= 0) {
      finalDeal = {
        ...deals[idx],
        ...dealData,
        company_name: dealData.company_name || deals[idx].company_name || "Shreeji Gems",
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
        settlement_date: dealData.settlement_date,
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
  return finalDeal;
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
    brokerage_amount: Number(purchaseData.brokerage_amount) || 0,
    brokerage_paid: !!purchaseData.brokerage_paid,
    notes: purchaseData.notes || "",
    created_at: now,
  };

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
          normalizeBoxName(p.box_name) === normalizeBoxName(item.box_name || "Box 1 — Emerald Vault") &&
          p.packet_number.trim().toLowerCase() === item.packet_number.trim().toLowerCase()
      );
      if (!existingPkt) {
        savePacket({
          packet_number: item.packet_number,
          box_name: item.box_name || "Box 1 — Emerald Vault",
          particulars: item.particulars,
          shape: item.shape,
          weight: item.weight,
          unit: item.unit || "cts",
          pieces: item.pieces || 1,
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
        });
      }
    }
  }

  return newPurchase;
}

export function deletePurchase(id: string): boolean {
  const purchases = getStoredPurchases();
  const filtered = purchases.filter((p) => p.id !== id);
  setLocal("purchases", filtered);
  return true;
}

export function addPaymentToPurchase(
  purchaseId: string,
  payment: { amount: number; mode: any; date?: string; note?: string }
): GemPurchase | null {
  const purchases = getStoredPurchases();
  const idx = purchases.findIndex((p) => p.id === purchaseId);
  if (idx < 0) return null;

  const purchase = purchases[idx];
  const newPayment: GemSalePayment = {
    id: "pm-" + Math.random().toString(36).substring(2, 9),
    date: payment.date || new Date().toISOString().slice(0, 10),
    amount: Number(payment.amount) || 0,
    mode: payment.mode || "Bank Wire / NEFT",
    note: payment.note || "",
  };

  const payments = [...(purchase.payments || []), newPayment];
  const paid_amount = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance_payable = Math.max(0, purchase.total_cost - paid_amount);
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

  for (const st of settlementItems) {
    totalPiecesTaken += st.pieces_taken;
    totalPiecesReturned += st.pieces_returned;

    const origItem = sale.items?.find(
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

    const itemRecord: GemSaleItem = {
      ...(origItem || {
        packet_id: st.packet_id || "pkt-" + Date.now(),
        packet_number: st.packet_number,
        particulars: st.particulars || "Gemstone",
        shape: st.shape || "Oval",
        unit: "cts",
        mm_size: "",
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

    if (Array.isArray(origItem?.stone_weights) && origItem.stone_weights.length > 0 && st.pieces_taken > 0) {
      itemRecord.stone_weights = origItem.stone_weights.slice(0, st.pieces_taken);
    }

    if (st.pieces_taken > 0) {
      updatedItems.push(itemRecord);
    } else {
      returnedItems.push(itemRecord);
    }

    if (pIdx >= 0) {
      const curPktPcs = Number(packets[pIdx].pieces) || 0;
      const curPktWt = Number(packets[pIdx].weight) || 0;

      if (st.pieces_taken > 0 && st.pieces_returned === 0) {
        if (curPktPcs > 0) {
          // Packet already has remaining stock in vault from partial allocation
          packets[pIdx].status = "in_stock";
          packets[pIdx].is_approval = false;
          packets[pIdx].approval_status = undefined;
          packets[pIdx].memo_party = "";
        } else {
          packets[pIdx].status = "sold";
          packets[pIdx].buyer_name = sale.buyer_name;
          packets[pIdx].sale_date = now.slice(0, 10);
          packets[pIdx].sold_price = Math.round((st.rate_per_unit || packets[pIdx].sale_rate_per_unit) * st.weight_taken);
          packets[pIdx].is_approval = false;
          packets[pIdx].approval_status = "approved_billed";
          packets[pIdx].pieces = 0;
          packets[pIdx].weight = 0;
        }
      } else if (st.pieces_returned > 0 && st.pieces_taken === 0) {
        packets[pIdx].status = "in_stock";
        packets[pIdx].memo_party = "";
        packets[pIdx].is_approval = false;
        packets[pIdx].approval_status = "returned";
        packets[pIdx].pieces = curPktPcs + st.pieces_returned;
        packets[pIdx].weight = Number((curPktWt + st.weight_returned).toFixed(2));
        if (packets[pIdx].purchase_rate_per_unit) {
          packets[pIdx].purchase_price = Math.round(packets[pIdx].purchase_rate_per_unit * packets[pIdx].weight);
        }
        if (packets[pIdx].sale_rate_per_unit) {
          packets[pIdx].sale_price = Math.round(packets[pIdx].sale_rate_per_unit * packets[pIdx].weight);
        }
      } else if (st.pieces_taken > 0 && st.pieces_returned > 0) {
        packets[pIdx].status = "in_stock";
        packets[pIdx].memo_party = "";
        packets[pIdx].pieces = curPktPcs + st.pieces_returned;
        packets[pIdx].weight = Number((curPktWt + st.weight_returned).toFixed(2));
        packets[pIdx].stone_weight = packets[pIdx].pieces > 0 ? Math.round((packets[pIdx].weight / packets[pIdx].pieces) * 100) / 100 : undefined;
        packets[pIdx].is_approval = false;
        packets[pIdx].approval_status = undefined;
        if (packets[pIdx].purchase_rate_per_unit) {
          packets[pIdx].purchase_price = Math.round(packets[pIdx].purchase_rate_per_unit * packets[pIdx].weight);
        }
        if (packets[pIdx].sale_rate_per_unit) {
          packets[pIdx].sale_price = Math.round(packets[pIdx].sale_rate_per_unit * packets[pIdx].weight);
        }
      }
    }
  }

  setLocal("packets", packets);

  const subtotal = totalPiecesTaken > 0 ? updatedItems.reduce((s, it) => s + it.total_price, 0) : 0;
  const totalTax = totalPiecesTaken > 0 ? updatedItems.reduce((s, it) => s + (it.gst_amount || 0), 0) : 0;
  const discount = Number(sale.discount || 0);
  const grandTotal = totalPiecesTaken > 0 ? Math.max(0, subtotal + totalTax - discount) : 0;
  const paid = Number(sale.paid_amount || 0);
  const balance = totalPiecesTaken > 0 ? Math.max(0, grandTotal - paid) : 0;
  const payStatus = balance <= 0 ? "cleared" : (paid > 0 ? "partial" : "unpaid");

  const finalApprovalStatus = totalPiecesTaken > 0 ? "approved_billed" : "returned";
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
    approval_billed_date: totalPiecesTaken > 0 ? now.slice(0, 10) : undefined,
    notes: (sale.notes ? sale.notes + "\n" : "") + (options?.notes || `Settlement: ${totalPiecesTaken} pcs taken (${updatedItems.reduce((s, it) => s + it.weight, 0).toFixed(2)} cts), ${totalPiecesReturned} pcs returned to vault.`),
  };

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
  return getLocal<GemExpense[]>("expenses", DEFAULT_EXPENSES);
}

export function saveExpense(
  expData: Partial<GemExpense> & { category: any; amount: number; payee: string; expense_type?: "petty" | "business" }
): GemExpense {
  const expenses = getStoredExpenses();
  const now = new Date().toISOString();

  const expType: "petty" | "business" = expData.expense_type === "petty" ? "petty" : "business";

  if (expData.id) {
    const idx = expenses.findIndex((e) => e.id === expData.id);
    if (idx >= 0) {
      const updated: GemExpense = {
        ...expenses[idx],
        ...expData,
        expense_type: expType,
        amount: Number(expData.amount) || 0,
      } as GemExpense;
      expenses[idx] = updated;
      setLocal("expenses", expenses);
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

  expenses.unshift(newExp);
  setLocal("expenses", expenses);
  return newExp;
}

export function deleteExpense(id: string): boolean {
  const expenses = getStoredExpenses();
  const filtered = expenses.filter((e) => e.id !== id);
  setLocal("expenses", filtered);
  return true;
}

// -------------------------------------------------------------
// Buyers & Sellers Directory
// -------------------------------------------------------------
export function getStoredBuyers(): GemBuyer[] {
  return getLocal<GemBuyer[]>("buyers", DEFAULT_BUYERS);
}

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
  total_cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  brokerage_earnings: number;
  pending_brokerage: number;
  total_expenses: number;
  petty_expenses: number;
  business_expenses: number;
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
    expenses: number;
    net_profit: number;
  }>;
  weekly_pnl: Array<{
    period: string; // e.g. "2026-W38"
    revenue: number;
    cogs: number;
    gross_profit: number;
    brokerage: number;
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

  if (filterCompany && filterCompany !== "all") {
    packets = packets.filter((p) => p.company_name === filterCompany);
    sales = sales.filter((s) => s.company_name === filterCompany);
    brokerage = brokerage.filter((b) => b.company_name === filterCompany);
    expenses = expenses.filter((e) => e.company_name === filterCompany);
  }

  // 1. Sales and COGS (Only confirmed sales, exclude pending approvals)
  let totalSalesRevenue = 0;
  let totalCogs = 0;
  const buyerMap: Record<string, { count: number; spend: number; profit: number }> = {};
  const particularMap: Record<string, { sold: number; in_stock: number; carats: number; rev: number; cogs: number; profit: number }> = {};
  const monthMap: Record<string, { rev: number; cogs: number; brk: number; exp: number }> = {};
  const weekMap: Record<string, { rev: number; cogs: number; brk: number; exp: number }> = {};

  for (const s of sales) {
    // Only count if not an unapproved approval or returned memo
    if (s.approval_status === "returned" || (s.is_approval && s.approval_status !== "approved_billed")) {
      continue;
    }

    totalSalesRevenue += s.total;
    const m = (s.date || "").slice(0, 7);
    const dateObj = new Date(s.date || Date.now());
    const w = !isNaN(dateObj.getTime()) ? getWeekNumber(dateObj) : "";

    if (m) {
      if (!monthMap[m]) monthMap[m] = { rev: 0, cogs: 0, brk: 0, exp: 0 };
      monthMap[m].rev += s.total;
    }
    if (w) {
      if (!weekMap[w]) weekMap[w] = { rev: 0, cogs: 0, brk: 0, exp: 0 };
      weekMap[w].rev += s.total;
    }

    let saleCogs = 0;
    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        saleCogs += it.cost_price || 0;
        const part = it.particulars.split("(")[0].trim() || "Gemstone";
        if (!particularMap[part]) {
          particularMap[part] = { sold: 0, in_stock: 0, carats: 0, rev: 0, cogs: 0, profit: 0 };
        }
        particularMap[part].sold += 1;
        particularMap[part].carats += it.weight || 0;
        particularMap[part].rev += it.total_price || 0;
        particularMap[part].cogs += it.cost_price || 0;
        particularMap[part].profit += (it.total_price || 0) - (it.cost_price || 0);
      }
    }
    totalCogs += saleCogs;
    if (m) monthMap[m].cogs += saleCogs;
    if (w) weekMap[w].cogs += saleCogs;

    const bName = s.buyer_name || "Direct Client";
    if (!buyerMap[bName]) buyerMap[bName] = { count: 0, spend: 0, profit: 0 };
    buyerMap[bName].count += 1;
    buyerMap[bName].spend += s.total;
    buyerMap[bName].profit += s.total - saleCogs;
  }

  const grossProfit = totalSalesRevenue - totalCogs;
  const grossMarginPct = totalSalesRevenue > 0 ? (grossProfit / totalSalesRevenue) * 100 : 0;

  // 2. Brokerage (Direct commission earnings)
  let brokerageEarnings = 0;
  let pendingBrokerage = 0;
  for (const b of brokerage) {
    brokerageEarnings += b.received_amount || 0;
    pendingBrokerage += b.balance_receivable || 0;
    const m = (b.date || "").slice(0, 7);
    const dateObj = new Date(b.date || Date.now());
    const w = !isNaN(dateObj.getTime()) ? getWeekNumber(dateObj) : "";
    if (m) {
      if (!monthMap[m]) monthMap[m] = { rev: 0, cogs: 0, brk: 0, exp: 0 };
      monthMap[m].brk += b.received_amount || 0;
    }
    if (w) {
      if (!weekMap[w]) weekMap[w] = { rev: 0, cogs: 0, brk: 0, exp: 0 };
      weekMap[w].brk += b.received_amount || 0;
    }
  }

  // 3. Expenses (Split Petty vs Business)
  let totalExpenses = 0;
  let pettyExpenses = 0;
  let businessExpenses = 0;
  const expCatMap: Record<string, number> = {};
  for (const e of expenses) {
    totalExpenses += e.amount || 0;
    if (e.expense_type === "petty") {
      pettyExpenses += e.amount || 0;
    } else {
      businessExpenses += e.amount || 0;
    }
    expCatMap[e.category] = (expCatMap[e.category] || 0) + (e.amount || 0);
    const m = (e.date || "").slice(0, 7);
    const dateObj = new Date(e.date || Date.now());
    const w = !isNaN(dateObj.getTime()) ? getWeekNumber(dateObj) : "";
    if (m) {
      if (!monthMap[m]) monthMap[m] = { rev: 0, cogs: 0, brk: 0, exp: 0 };
      monthMap[m].exp += e.amount || 0;
    }
    if (w) {
      if (!weekMap[w]) weekMap[w] = { rev: 0, cogs: 0, brk: 0, exp: 0 };
      weekMap[w].exp += e.amount || 0;
    }
  }

  // 4. Net Business Profit
  const netProfit = grossProfit + brokerageEarnings - totalExpenses;
  const totalIncome = totalSalesRevenue + brokerageEarnings;
  const netMarginPct = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // 5. Vault Inventory Analysis
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
      vaultTotalCarats += p.weight || 0;
      vaultCostValuation += p.purchase_price || 0;
      vaultAskingValuation += p.sale_price || 0;

      const sh = p.shape || "Other";
      if (!shapeMap[sh]) shapeMap[sh] = { count: 0, carats: 0, value: 0 };
      shapeMap[sh].count++;
      shapeMap[sh].carats += p.weight || 0;
      shapeMap[sh].value += p.sale_price || 0;

      const part = p.particulars.split("(")[0].trim() || "Gemstone";
      if (!particularMap[part]) {
        particularMap[part] = { sold: 0, in_stock: 0, carats: 0, rev: 0, cogs: 0, profit: 0 };
      }
      particularMap[part].in_stock += 1;
      particularMap[part].carats += p.weight || 0;

      if (p.status === "on_memo" || p.status === "on_approval") {
        memoPacketsCount++;
        memoCarats += p.weight || 0;
      }
    } else if (p.status === "sold") {
      soldPacketsCount++;
    }
  }

  const unrealizedProfit = vaultAskingValuation - vaultCostValuation;

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
      return {
        period: month,
        revenue: d.rev,
        cogs: d.cogs,
        gross_profit: gp,
        brokerage: d.brk,
        expenses: d.exp,
        net_profit: gp + d.brk - d.exp,
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  const weeklyPnl = Object.entries(weekMap)
    .map(([week, d]) => {
      const gp = d.rev - d.cogs;
      return {
        period: week,
        revenue: d.rev,
        cogs: d.cogs,
        gross_profit: gp,
        brokerage: d.brk,
        expenses: d.exp,
        net_profit: gp + d.brk - d.exp,
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

  const companyBreakdown = allCompanies.map((comp) => {
    const compSales = rawSales.filter((s) => s.company_name === comp && (!s.is_approval || s.approval_status === "approved_billed"));
    const compExp = rawExpenses.filter((e) => e.company_name === comp);
    const compPkts = rawPackets.filter((p) => p.company_name === comp);

    const sRev = compSales.reduce((sum, s) => sum + s.total, 0);
    const cogs = compSales.reduce(
      (sum, s) => sum + (s.items?.reduce((isum, it) => isum + (it.cost_price || 0), 0) || 0),
      0
    );
    const gp = sRev - cogs;
    const exp = compExp.reduce((sum, e) => sum + e.amount, 0);
    return {
      company: comp,
      sales_revenue: sRev,
      gross_profit: gp,
      expenses: exp,
      net_profit: gp - exp,
      packets_count: compPkts.length,
    };
  });

  return {
    total_sales_revenue: totalSalesRevenue,
    total_cogs: totalCogs,
    gross_profit: grossProfit,
    gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
    brokerage_earnings: brokerageEarnings,
    pending_brokerage: pendingBrokerage,
    total_expenses: totalExpenses,
    petty_expenses: pettyExpenses,
    business_expenses: businessExpenses,
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
  };
}

// -------------------------------------------------------------
// Backup and Restore (100% Local JSON)
// -------------------------------------------------------------
export function exportLocalBackup(): string {
  const data = {
    app: "Shreeji Gems CRM",
    exported_at: new Date().toISOString(),
    version: "3.0.0",
    boxes: getStoredBoxes(),
    packets: getStoredPackets(),
    sales: getStoredSales(),
    brokerage: getStoredBrokerage(),
    purchases: getStoredPurchases(),
    expenses: getStoredExpenses(),
    assets: getStoredAssets(),
    liquid_cash: getLiquidCash(),
    buyers: getStoredBuyers(),
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
    if (Array.isArray(data.expenses)) setLocal("expenses", data.expenses);
    if (Array.isArray(data.assets)) setLocal("assets", data.assets);
    if (typeof data.liquid_cash === "number") setLiquidCash(data.liquid_cash);
    if (Array.isArray(data.buyers)) setLocal("buyers", data.buyers);
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
  setLocal("packets", DEFAULT_PACKETS);
  setLocal("sales", DEFAULT_SALES);
  setLocal("brokerage", DEFAULT_BROKERAGE);
  setLocal("purchases", DEFAULT_PURCHASES);
  setLocal("expenses", DEFAULT_EXPENSES);
  setLocal("assets", DEFAULT_ASSETS);
  setLocal("liquid_cash", 3450000);
  setLocal("buyers", DEFAULT_BUYERS);
  setLocal("custom_particulars", DEFAULT_PARTICULARS);
  setLocal("custom_labs", DEFAULT_CERT_LABS);
}
