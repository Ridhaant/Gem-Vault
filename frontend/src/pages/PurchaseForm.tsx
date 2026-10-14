import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../api";
import { Spinner } from "../ui";
import { formatINR } from "../format";
import type { GemPacket, GemPurchaseItem, GemPurchase, GemBuyer, GemBox } from "../types/gemstone";
import { DEFAULT_SHAPES } from "../types/gemstone";
import { normalizeBoxName } from "../gemstoneStorage";
import { useToast } from "../toast";

const GEM_VARIETIES = [
  "Emerald",
  "Ruby",
  "Blue Sapphire",
  "Yellow Sapphire",
  "Tanzanite",
  "Diamond",
  "Alexandrite",
  "Tsavorite Garnet",
  "Aquamarine",
  "Tourmaline",
  "Spinel",
  "Morganite",
  "Opal",
  "Peridot",
];

const CREDIT_PRESETS = [
  { days: 0, label: "0d (Cash / Immediate)" },
  { days: 30, label: "30d (1 Month)" },
  { days: 60, label: "60d (2 Months)" },
  { days: 90, label: "90d (3 Months)" },
  { days: 120, label: "120d (4 Months)" },
  { days: 180, label: "180d (6 Months)" },
];

export default function PurchaseForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const queryClient = useQueryClient();
  const { show } = useToast();

  const { data: existingPurchase, isLoading: purchaseLoading } = useQuery<GemPurchase>({
    queryKey: ["purchase", id],
    queryFn: () => apiGet(`/purchases/${id}`),
    enabled: isEdit,
  });

  const { data: existingPackets = [] } = useQuery<GemPacket[]>({
    queryKey: ["packets"],
    queryFn: () => apiGet("/packets"),
  });

  const { data: savedParties = [] } = useQuery<GemBuyer[]>({
    queryKey: ["buyers"],
    queryFn: () => apiGet("/buyers"),
  });

  const { data: boxes = [] } = useQuery<GemBox[]>({
    queryKey: ["boxes"],
    queryFn: () => apiGet("/boxes"),
  });

  const { data: customShapes = [] } = useQuery<string[]>({
    queryKey: ["custom_shapes"],
    queryFn: () => apiGet("/shapes"),
  });

  const allShapes = useMemo(() => {
    const list = Array.isArray(customShapes) ? customShapes : [];
    const set = new Set([...DEFAULT_SHAPES, ...list]);
    return Array.from(set);
  }, [customShapes]);

  const defaultBoxName = useMemo(() => {
    return boxes && boxes[0]?.name ? boxes[0].name : "Box 1 — Emerald Vault";
  }, [boxes]);

  // Calculate starting packet index safely
  const nextPktIndex = useMemo(() => {
    let max = 0;
    (existingPackets || []).forEach((p) => {
      if (p?.packet_number && typeof p.packet_number === "string") {
        const match = p.packet_number.match(/^ex\/(\d+)$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > max) max = val;
        }
      }
    });
    return max + 1;
  }, [existingPackets]);

  // Form State
  const [purchaseNo, setPurchaseNo] = useState(`GEM-PUR-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierCity, setSupplierCity] = useState("");
  const [lotRef, setLotRef] = useState("");
  const [paymentMode, setPaymentMode] = useState("Bank Wire");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [creditDays, setCreditDays] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // Middleman Brokerage State
  const [brokerName, setBrokerName] = useState("");
  const [brokerPhone, setBrokerPhone] = useState("");
  const [brokerageType, setBrokerageType] = useState<"percent" | "manual">("percent");
  const [brokerageRate, setBrokerageRate] = useState<number>(1);
  const [brokerageManualAmount, setBrokerageManualAmount] = useState<number>(0);
  const [brokeragePaid, setBrokeragePaid] = useState<boolean>(false);

const safePieces = (p: any): number => {
  const n = parseInt(String(p), 10);
  if (isNaN(n) || n < 1) return 1;
  return Math.min(n, 500);
};

  // Intake Packets
  const [items, setItems] = useState<GemPurchaseItem[]>([
    {
      packet_number: `ex/${nextPktIndex || 1}`,
      box_name: defaultBoxName,
      particulars: "",
      shape: "Oval",
      weight: 0,
      unit: "cts",
      pieces: 1,
      stone_weight: 0,
      mm_size: "",
      purchase_rate_per_unit: 0,
      cost_price: 0,
      sale_rate_per_unit: 0,
      target_sale_price: 0,
      treatment: "",
      cert_lab: "",
      origin: "",
      stone_weights: [],
    },
  ]);
  const [expandedWeightsIdx, setExpandedWeightsIdx] = useState<number | null>(null);

  // Sync default box once boxes load
  useEffect(() => {
    if (defaultBoxName && items.length > 0 && !items[0].box_name) {
      setItems((prev) => prev.map((it) => ({ ...it, box_name: it.box_name || defaultBoxName })));
    }
  }, [defaultBoxName]);

  // Keep packet number synchronized with nextPktIndex if newly created and untouched
  useEffect(() => {
    if (nextPktIndex && items.length === 1 && items[0].packet_number === "ex/1" && nextPktIndex !== 1 && !isEdit) {
      setItems([{ ...items[0], packet_number: `ex/${nextPktIndex}` }]);
    }
  }, [nextPktIndex, isEdit]);

  // Pre-fill state when editing
  useEffect(() => {
    if (existingPurchase) {
      setPurchaseNo(existingPurchase.purchase_no);
      setDate(existingPurchase.date);
      setSupplierName(existingPurchase.supplier_name);
      setSupplierPhone(existingPurchase.supplier_phone || "");
      setSupplierCity(existingPurchase.supplier_city || "");
      setLotRef(existingPurchase.lot_ref || "");
      setPaymentMode(existingPurchase.payment_mode || "Bank Wire");
      setPaidAmount(existingPurchase.paid_amount || 0);
      setCreditDays(existingPurchase.credit_days || 0);
      setBrokerName(existingPurchase.broker_name || "");
      setBrokerPhone(existingPurchase.broker_phone || "");
      setBrokerageType(existingPurchase.brokerage_type || "percent");
      setBrokerageRate(existingPurchase.brokerage_rate ?? 1);
      setBrokerageManualAmount(existingPurchase.brokerage_amount || 0);
      setBrokeragePaid(!!existingPurchase.brokerage_paid);
      setNotes(existingPurchase.notes || "");
      if (existingPurchase.items && existingPurchase.items.length > 0) {
        setItems(existingPurchase.items);
      }
    }
  }, [existingPurchase]);

  const totalCost = items.reduce((sum, it) => sum + (it.cost_price || 0), 0);

  // Calculated Due Date
  const calculatedDueDate = useMemo(() => {
    if (!creditDays || creditDays <= 0) return date;
    const d = new Date(date || new Date().toISOString().slice(0, 10));
    d.setDate(d.getDate() + Number(creditDays));
    return d.toISOString().slice(0, 10);
  }, [date, creditDays]);

  // Calculated Middleman Brokerage Amount
  const calculatedBrokerageAmount = useMemo(() => {
    if (brokerageType === "percent") {
      return Math.round(totalCost * ((Number(brokerageRate) || 0) / 100));
    }
    return Number(brokerageManualAmount) || 0;
  }, [brokerageType, totalCost, brokerageRate, brokerageManualAmount]);

  const handleAddItem = () => {
    const nextIdx = nextPktIndex + items.length;
    setItems((prev) => [
      ...prev,
      {
        packet_number: `ex/${nextIdx}`,
        box_name: defaultBoxName,
        particulars: "",
        shape: "Oval",
        weight: 0,
        unit: "cts",
        pieces: 1,
        stone_weight: 0,
        mm_size: "",
        purchase_rate_per_unit: 0,
        cost_price: 0,
        sale_rate_per_unit: 0,
        target_sale_price: 0,
        treatment: "",
        cert_lab: "",
        origin: "",
        stone_weights: [],
      },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) {
      show("At least one packet must be entered", "warning");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateItem = (idx: number, field: keyof GemPurchaseItem, value: any) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: value };

        // Handle calibrated stones calculation & stone weights distribution
        if (field === "pieces") {
          const pcs = safePieces(value);
          updated.pieces = pcs;
          if (updated.stone_weights && updated.stone_weights.length > 0) {
            const resized = [...updated.stone_weights];
            while (resized.length < pcs && resized.length < 500) {
              const fallback = updated.stone_weight || (updated.weight > 0 ? Number((updated.weight / pcs).toFixed(3)) : 0);
              resized.push(fallback);
            }
            updated.stone_weights = resized.slice(0, pcs);
            const sum = Number(updated.stone_weights.reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));
            if (sum > 0) updated.weight = sum;
          } else if (updated.stone_weight && updated.stone_weight > 0) {
            updated.weight = Number((pcs * updated.stone_weight).toFixed(2));
          } else if (updated.weight > 0 && pcs > 0) {
            updated.stone_weight = Number((updated.weight / pcs).toFixed(3));
          }
        } else if (field === "stone_weight") {
          const sw = parseFloat(value) || 0;
          updated.stone_weight = sw;
          if (sw > 0 && updated.pieces > 0) {
            updated.weight = Number((updated.pieces * sw).toFixed(2));
          }
        } else if (field === "weight") {
          const w = parseFloat(value) || 0;
          updated.weight = w;
          if (w > 0 && updated.pieces > 0) {
            updated.stone_weight = Number((w / updated.pieces).toFixed(3));
          }
        } else if (field === "stone_weights") {
          updated.stone_weights = value;
          const sum = Number(value.reduce((s: number, x: number) => s + (Number(x) || 0), 0).toFixed(2));
          if (sum > 0) {
            updated.weight = sum;
          }
          if (updated.pieces > 0 && updated.weight > 0) {
            updated.stone_weight = Number((updated.weight / updated.pieces).toFixed(3));
          }
        }

        const w = updated.weight > 0 ? updated.weight : 1;
        if (field === "cost_price" || field === "weight" || field === "stone_weight" || field === "pieces" || field === "stone_weights") {
          updated.purchase_rate_per_unit = Math.round(updated.cost_price / w);
        }
        if (field === "target_sale_price" || field === "weight" || field === "stone_weight" || field === "pieces" || field === "stone_weights") {
          updated.sale_rate_per_unit = Math.round(updated.target_sale_price / w);
        }
        return updated;
      })
    );
  };

  const handleBatchAssignBox = (boxName: string) => {
    if (!boxName) return;
    setItems((prev) => prev.map((it) => ({ ...it, box_name: boxName })));
    show(`Assigned all ${items.length} packets to "${boxName}"`, "info");
  };

  const savePurchaseMutation = useMutation({
    mutationFn: (payload: any) => {
      if (isEdit) {
        return apiPut(`/purchases/${id}`, { ...payload, id });
      }
      return apiPost("/purchases", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show(
        isEdit
          ? "Purchase record and packet inventory updated successfully!"
          : "Purchase intake recorded & new packets created in inventory!",
        "success"
      );
      navigate("/purchases");
    },
    onError: (err: any) => show("Error recording purchase: " + err.message, "error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      show("Please enter supplier name", "warning");
      return;
    }

    // 1. Enforce packet number uniqueness WITHIN the same box among newly entered items
    const seenMap = new Map<string, string>(); // key: normBox:pktNum -> boxName
    for (const it of items) {
      const pktTrim = (it.packet_number || "").trim().toLowerCase();
      if (!pktTrim) {
        show("Packet number cannot be empty", "warning");
        return;
      }
      const bName = it.box_name || defaultBoxName;
      const key = `${normalizeBoxName(bName)}::${pktTrim}`;
      if (seenMap.has(key)) {
        show(
          `Duplicate packet # "${it.packet_number}" detected in box "${bName}". Packet numbers must be unique within the same box.`,
          "warning"
        );
        return;
      }
      seenMap.set(key, bName);
    }

    // 2. Enforce packet number uniqueness WITHIN the same box against existing inventory
    for (const it of items) {
      const bName = it.box_name || defaultBoxName;
      const pktTrim = (it.packet_number || "").trim().toLowerCase();
      const conflict = existingPackets.find((p) => {
        // If editing existing purchase, ignore conflict if packet was already part of this purchase
        if (isEdit && existingPurchase?.items?.some((oldIt) => oldIt.packet_number.toLowerCase() === pktTrim)) {
          return false;
        }
        return (
          normalizeBoxName(p.box_name) === normalizeBoxName(bName) &&
          p.packet_number.trim().toLowerCase() === pktTrim
        );
      });

      if (conflict) {
        show(
          `Packet # "${it.packet_number}" already exists in "${conflict.box_name || bName}". Packet numbers must be unique within the same box.`,
          "warning"
        );
        return;
      }
    }

    const payload = {
      purchase_no: purchaseNo,
      date,
      supplier_name: supplierName.trim(),
      supplier_phone: supplierPhone.trim(),
      supplier_city: supplierCity.trim(),
      lot_ref: lotRef.trim(),
      items: items.map((it) => ({
        ...it,
        box_name: it.box_name || defaultBoxName,
      })),
      total_cost: totalCost,
      paid_amount: paidAmount > 0 ? paidAmount : 0,
      payment_mode: paymentMode,
      credit_days: Number(creditDays) || 0,
      due_date: calculatedDueDate,
      broker_name: brokerName.trim(),
      broker_phone: brokerPhone.trim(),
      brokerage_type: brokerageType,
      brokerage_rate: Number(brokerageRate) || 0,
      brokerage_amount: calculatedBrokerageAmount,
      brokerage_paid: brokeragePaid,
      notes,
    };

    savePurchaseMutation.mutate(payload);
  };

  if (purchaseLoading) {
    return (
      <div className="page-body">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="page-body" style={{ maxWidth: 1100, margin: "0 auto", gap: 20 }}>
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/purchases")}>
          ← Back to Purchases
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: "6px 0 0" }}>
          {isEdit ? "✏️ Edit Gemstone Procurement & Packet Intake" : "Intake New Gemstone Packets & Purchase Lot"}
        </h1>
        <p style={{ color: "var(--muted)", margin: "2px 0 0", fontSize: 13 }}>
          {isEdit
            ? `Update voucher ${purchaseNo} details and synchronize with packet inventory.`
            : "Creates new packets (ex/1, ex/2...) directly into your vault inventory with scannable QR tags and box assignment."}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Supplier & Voucher Info */}
        <div className="card" style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label className="label">Voucher / Purchase Order #*</label>
            <input
              type="text"
              required
              className="input"
              value={purchaseNo}
              onChange={(e) => setPurchaseNo(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Intake Date*</label>
            <input
              type="date"
              required
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label className="label" style={{ margin: 0 }}>Supplier / Dealer / Importer Name*</label>
              {savedParties.length > 0 && (
                <select
                  className="select"
                  style={{ fontSize: 11, padding: "2px 8px", height: 26, background: "var(--surface-sunken)" }}
                  value=""
                  onChange={(e) => {
                    const match = savedParties.find((b) => b.name === e.target.value);
                    if (match) {
                      setSupplierName(match.name);
                      if (match.phone) setSupplierPhone(match.phone);
                      if (match.city) setSupplierCity(match.city);
                    }
                  }}
                >
                  <option value="">⚡ Select from {savedParties.length} saved parties/dealers...</option>
                  {savedParties.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} {p.company ? `(${p.company})` : ""} {p.city ? `• ${p.city}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <input
              type="text"
              required
              placeholder="e.g. Kagem Mining Ltd / Mogok Rough Traders"
              className="input"
              list="dealers-list"
              value={supplierName}
              onChange={(e) => {
                setSupplierName(e.target.value);
                const match = savedParties.find((b) => b.name.toLowerCase() === e.target.value.toLowerCase());
                if (match) {
                  if (match.phone) setSupplierPhone(match.phone);
                  if (match.city) setSupplierCity(match.city);
                }
              }}
            />
            <datalist id="dealers-list">
              {savedParties.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label">Rough / Procurement Lot Ref</label>
            <input
              type="text"
              placeholder="e.g. LOT-ZAM-881"
              className="input"
              value={lotRef}
              onChange={(e) => setLotRef(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Supplier Phone</label>
            <input
              type="text"
              placeholder="+91..."
              className="input"
              value={supplierPhone}
              onChange={(e) => setSupplierPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Supplier City / Country</label>
            <input
              type="text"
              placeholder="Jaipur / Bangkok / Colombo"
              className="input"
              value={supplierCity}
              onChange={(e) => setSupplierCity(e.target.value)}
            />
          </div>
        </div>

        {/* Middleman Brokerage & Long Credit Terms */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Middleman Brokerage */}
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🤝</span> Middleman / Broker Details
              </h3>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Optional procurement broker</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="label" style={{ fontSize: 11 }}>Broker Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Bhai Broker"
                  className="input"
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: 11 }}>Broker Phone</label>
                <input
                  type="text"
                  placeholder="+91..."
                  className="input"
                  value={brokerPhone}
                  onChange={(e) => setBrokerPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Brokerage Calculation: % vs ₹ Manual */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <div style={{ display: "flex", gap: 4, background: "var(--surface-sunken)", padding: 3, borderRadius: 6 }}>
                <button
                  type="button"
                  className={`btn btn-xs ${brokerageType === "percent" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setBrokerageType("percent")}
                >
                  % Percentage
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${brokerageType === "manual" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setBrokerageType("manual")}
                >
                  ₹ Manual Amount
                </button>
              </div>

              {brokerageType === "percent" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="input"
                    style={{ width: 80 }}
                    value={brokerageRate}
                    onChange={(e) => setBrokerageRate(parseFloat(e.target.value) || 0)}
                  />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>% of Total Lot</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    placeholder="Enter fixed amount"
                    value={brokerageManualAmount || ""}
                    onChange={(e) => setBrokerageManualAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}
            </div>

            {/* Live Brokerage Preview & Paid Checkbox */}
            <div
              style={{
                background: "var(--surface-sunken)",
                padding: "8px 12px",
                borderRadius: 6,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
              }}
            >
              <div>
                <span>Calculated Brokerage: </span>
                <strong style={{ color: "var(--primary)", fontSize: 14 }}>
                  {formatINR(calculatedBrokerageAmount)}
                </strong>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", margin: 0 }}>
                <input
                  type="checkbox"
                  checked={brokeragePaid}
                  onChange={(e) => setBrokeragePaid(e.target.checked)}
                />
                <span style={{ fontWeight: 600, color: brokeragePaid ? "var(--success)" : "var(--muted)" }}>
                  {brokeragePaid ? "✓ Commission Paid" : "Commission Unpaid"}
                </span>
              </label>
            </div>
          </div>

          {/* Long Credit Terms & Payment Due */}
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📅</span> Credit Terms & Payment Schedule
              </h3>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Multi-month supplier terms</span>
            </div>

            <div>
              <label className="label" style={{ fontSize: 11, marginBottom: 6 }}>Credit Duration Presets</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CREDIT_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    className={`btn btn-xs ${creditDays === preset.days ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setCreditDays(preset.days)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="label" style={{ fontSize: 11 }}>Custom Days</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={creditDays}
                  onChange={(e) => setCreditDays(parseInt(e.target.value, 10) || 0)}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: 11 }}>Calculated Due Date</label>
                <div
                  className="input"
                  style={{
                    background: "var(--surface-sunken)",
                    display: "flex",
                    alignItems: "center",
                    fontWeight: 700,
                    color: creditDays > 0 ? "var(--primary)" : "var(--muted)",
                  }}
                >
                  {calculatedDueDate}
                  {creditDays > 0 && <span style={{ fontSize: 10, marginLeft: 6 }}>({creditDays} days)</span>}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {creditDays === 0
                ? "Immediate cash or same-day settlement."
                : `Payment will be tracked as outstanding until ${calculatedDueDate}.`}
            </div>
          </div>
        </div>

        {/* New Packets Grid */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                💎 Packets Being Created ({items.length} Packets)
              </h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Each item is created in Inventory with calibrated stone weight (ct/pc) and assigned to a vault box.
              </span>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {boxes.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Batch assign box:</span>
                  <select
                    className="select"
                    style={{ fontSize: 11, padding: "2px 8px", height: 28 }}
                    value=""
                    onChange={(e) => handleBatchAssignBox(e.target.value)}
                  >
                    <option value="">Choose Box to apply all...</option>
                    {boxes.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button type="button" className="btn btn-outline btn-sm" onClick={handleAddItem}>
                + Add Another Packet
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {items.map((it, idx) => {
              const isExpanded = expandedWeightsIdx === idx;
              const curWeights = it.stone_weights || [];
              const weightsSum = Number(curWeights.reduce((s, x) => s + (Number(x) || 0), 0).toFixed(2));

              return (
                <div
                  key={idx}
                  style={{
                    background: "var(--surface-sunken)",
                    border: isExpanded ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.1fr 1.4fr 1.3fr 1.2fr 0.8fr 1fr 1fr 1.2fr 1.2fr 36px",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    {/* Packet Number */}
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Packet #*</label>
                      <input
                        type="text"
                        required
                        className="input"
                        value={it.packet_number}
                        onChange={(e) => handleUpdateItem(idx, "packet_number", e.target.value)}
                      />
                    </div>

                    {/* Box Name */}
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Vault Box*</label>
                      <select
                        className="select"
                        value={it.box_name || defaultBoxName}
                        onChange={(e) => handleUpdateItem(idx, "box_name", e.target.value)}
                      >
                        {boxes.map((b) => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                        {boxes.length === 0 && <option value="Box 1 — Emerald Vault">Box 1 — Emerald Vault</option>}
                      </select>
                    </div>

                    {/* Particulars */}
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Particulars</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Emerald"
                        className="input"
                        list={`variety-list-${idx}`}
                        value={it.particulars}
                        onChange={(e) => handleUpdateItem(idx, "particulars", e.target.value)}
                      />
                      <datalist id={`variety-list-${idx}`}>
                        {GEM_VARIETIES.map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    </div>

                    {/* Shape */}
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Shape</label>
                      <select
                        className="select"
                        value={it.shape}
                        onChange={(e) => handleUpdateItem(idx, "shape", e.target.value)}
                      >
                        {allShapes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Pieces */}
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Pcs</label>
                      <input
                        type="number"
                        required
                        min="1"
                        className="input"
                        value={it.pieces}
                        onChange={(e) => handleUpdateItem(idx, "pieces", parseInt(e.target.value, 10) || 1)}
                      />
                    </div>

                    {/* Weight per Piece (Calibrated) */}
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Wt / Pc (cts)</label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="Calibrated"
                        className="input"
                        value={it.stone_weight ?? ""}
                        onChange={(e) => handleUpdateItem(idx, "stone_weight", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Total Weight */}
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Total (cts)*</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="input"
                        value={it.weight}
                        onChange={(e) => handleUpdateItem(idx, "weight", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Cost Price */}
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Cost Price (₹)*</label>
                      <input
                        type="number"
                        required
                        className="input"
                        value={it.cost_price}
                        onChange={(e) => {
                          const cost = parseFloat(e.target.value) || 0;
                          handleUpdateItem(idx, "cost_price", cost);
                          handleUpdateItem(idx, "target_sale_price", Math.round(cost * 1.5));
                        }}
                      />
                    </div>

                    {/* Ask Price */}
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>Ask Price (₹)*</label>
                      <input
                        type="number"
                        required
                        className="input"
                        value={it.target_sale_price}
                        onChange={(e) => handleUpdateItem(idx, "target_sale_price", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Remove */}
                    <div style={{ textAlign: "center", paddingTop: 18 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        style={{ color: "var(--danger)" }}
                        onClick={() => handleRemoveItem(idx)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Individual Stone Weight Distribution Toolbar & Summary */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed var(--border)", paddingTop: 8, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        className={`btn btn-xs ${isExpanded ? "btn-primary" : "btn-outline"}`}
                        style={{ fontSize: 11, padding: "3px 10px", fontWeight: 700 }}
                        onClick={() => setExpandedWeightsIdx(isExpanded ? null : idx)}
                        title="Toggle individual stone weights editor"
                      >
                        ⚖️ {curWeights.length ? `Stone Weights (${curWeights.length} stones)` : `Stone Weights (None added)`} {isExpanded ? "▲" : "▼"}
                      </button>

                      {curWeights.length > 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                          {curWeights.slice(0, 4).map((w, sIdx) => (
                            <span key={sIdx} style={{ fontSize: 10, background: "var(--surface)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3 }}>
                              #{sIdx + 1}: <strong>{Number(w).toFixed(2)}</strong>ct
                            </span>
                          ))}
                          {curWeights.length > 4 && (
                            <span style={{ fontSize: 10, color: "var(--muted)" }}>+{curWeights.length - 4} more</span>
                          )}
                          <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700, marginLeft: 4 }}>
                            (Sum: {weightsSum} cts)
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                          No individual stone weight added (Default)
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      Cost Rate: <strong>₹{it.purchase_rate_per_unit || 0}</strong>/ct · Ask Rate: <strong>₹{it.sale_rate_per_unit || 0}</strong>/ct
                    </div>
                  </div>

                  {/* Expandable Stone Weights Panel */}
                  {isExpanded && (
                    <div
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {curWeights.length === 0 ? (
                        <div
                          style={{
                            padding: "10px 14px",
                            background: "var(--surface-sunken)",
                            borderRadius: 6,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--on-surface)" }}>
                              ⚖️ No individual stone weight added (Default)
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              Total weight ({it.weight || 0} cts) is tracked collectively across {safePieces(it.pieces)} piece(s).
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            onClick={() => {
                              const pcs = safePieces(it.pieces);
                              const avg = Number(((it.weight || 0) / pcs).toFixed(3));
                              handleUpdateItem(idx, "stone_weights", Array(pcs).fill(avg));
                            }}
                          >
                            + Add Individual Stone Weights ({safePieces(it.pieces)} pcs)
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)" }}>
                                ⚖️ Stones Distribution ({curWeights.length} Stone{curWeights.length > 1 ? "s" : ""}):
                              </span>
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                onClick={() => {
                                  const cur = [...curWeights];
                                  const newPcs = cur.length + 1;
                                  cur.push(it.stone_weight || 0);
                                  handleUpdateItem(idx, "pieces", newPcs);
                                  handleUpdateItem(idx, "stone_weights", cur);
                                  const sum = Number(cur.reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));
                                  if (sum > 0) handleUpdateItem(idx, "weight", sum);
                                }}
                                title="Add a single stone to this packet"
                              >
                                + Add Stone
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() => {
                                  const cur = [...curWeights];
                                  const newPcs = cur.length + 3;
                                  cur.push(it.stone_weight || 0, it.stone_weight || 0, it.stone_weight || 0);
                                  handleUpdateItem(idx, "pieces", newPcs);
                                  handleUpdateItem(idx, "stone_weights", cur);
                                  const sum = Number(cur.reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));
                                  if (sum > 0) handleUpdateItem(idx, "weight", sum);
                                }}
                                title="Add 3 stones to this packet"
                              >
                                +3 Stones
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() => {
                                  const cur = [...curWeights];
                                  const newPcs = cur.length + 5;
                                  for (let k = 0; k < 5; k++) cur.push(it.stone_weight || 0);
                                  handleUpdateItem(idx, "pieces", newPcs);
                                  handleUpdateItem(idx, "stone_weights", cur);
                                  const sum = Number(cur.reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));
                                  if (sum > 0) handleUpdateItem(idx, "weight", sum);
                                }}
                                title="Add 5 stones to this packet"
                              >
                                +5 Stones
                              </button>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() => {
                                  const pcs = curWeights.length || safePieces(it.pieces);
                                  const avg = Number(((it.weight || 0) / pcs).toFixed(3));
                                  handleUpdateItem(idx, "stone_weights", Array(pcs).fill(avg));
                                }}
                                title="Distribute total weight equally across all pieces"
                              >
                                Even Split ({(Number(it.weight || 0) / (curWeights.length || 1)).toFixed(3)} ct each)
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() => {
                                  if (weightsSum > 0) {
                                    handleUpdateItem(idx, "weight", weightsSum);
                                  }
                                }}
                                title="Set total weight to the exact sum of all stone weights"
                              >
                                Apply Sum ({weightsSum} cts)
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                style={{ color: "var(--danger)", fontSize: 11 }}
                                onClick={() => handleUpdateItem(idx, "stone_weights", [])}
                                title="Remove individual stone weights and use total packet weight only"
                              >
                                ✕ Clear Individual Weights
                              </button>
                            </div>
                          </div>

                          {/* Quick CSV input */}
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <label style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", fontWeight: 700 }}>
                              Quick paste weights:
                            </label>
                            <input
                              type="text"
                              className="input"
                              style={{ fontSize: 11, padding: "4px 8px", flex: 1 }}
                              placeholder="e.g. 0.55, 0.48, 0.60, 0.52 (comma or space separated)"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const target = e.target as HTMLInputElement;
                                  const parsed = target.value
                                    .split(/[\s,]+/)
                                    .map((v) => parseFloat(v))
                                    .filter((v) => !isNaN(v) && v > 0);
                                  if (parsed.length > 0) {
                                    handleUpdateItem(idx, "pieces", parsed.length);
                                    handleUpdateItem(idx, "stone_weights", parsed);
                                    target.value = "";
                                  }
                                }
                              }}
                            />
                            <span style={{ fontSize: 10, color: "var(--muted)" }}>Press Enter</span>
                          </div>

                          {/* Individual stone inputs */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 130, overflowY: "auto", padding: "4px 0" }}>
                            {curWeights.map((wVal, stIdx) => {
                              return (
                                <div
                                  key={stIdx}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    background: "var(--surface-sunken)",
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    border: "1px solid var(--border)",
                                  }}
                                >
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>#{stIdx + 1}:</span>
                                  <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    style={{ width: 66, padding: "2px 4px", fontSize: 11, fontWeight: 700 }}
                                    className="input"
                                    value={wVal}
                                    placeholder="ct"
                                    onChange={(e) => {
                                      const stoneVal = parseFloat(e.target.value) || 0;
                                      const updated = [...curWeights];
                                      updated[stIdx] = stoneVal;
                                      handleUpdateItem(idx, "stone_weights", updated);
                                    }}
                                  />
                                  {curWeights.length > 1 && (
                                    <button
                                      type="button"
                                      style={{
                                        background: "none",
                                        border: "none",
                                        color: "#ef4444",
                                        cursor: "pointer",
                                        padding: "0 2px",
                                        fontSize: 11,
                                        lineHeight: 1,
                                        fontWeight: 900,
                                      }}
                                      title={`Remove stone #${stIdx + 1}`}
                                      onClick={() => {
                                        const updated = [...curWeights];
                                        updated.splice(stIdx, 1);
                                        const newPcs = Math.max(1, updated.length);
                                        handleUpdateItem(idx, "pieces", newPcs);
                                        handleUpdateItem(idx, "stone_weights", updated);
                                        const sum = Number(updated.reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));
                                        if (sum > 0) handleUpdateItem(idx, "weight", sum);
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment & Settlement Summary */}
        <div className="card" style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>
              Payment to Supplier
            </h3>

            <div>
              <label className="label">Amount Paid Right Now</label>
              <input
                type="number"
                placeholder={`0 or up to ${formatINR(totalCost)}`}
                className="input"
                value={paidAmount || ""}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
              />
              <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, display: "block" }}>
                Leave 0 if full amount is on credit terms.
              </span>
            </div>

            <div>
              <label className="label">Payment Mode</label>
              <select
                className="select"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="Bank Wire">Bank Wire / SWIFT / RTGS</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Angadia">Angadia</option>
              </select>
            </div>

            <div>
              <label className="label">Procurement Notes</label>
              <textarea
                className="textarea"
                rows={2}
                placeholder="e.g. Origin certificate attached, imported rough"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              background: "var(--surface-sunken)",
              padding: 16,
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>Total Packets to be Added:</span>
                <strong>{items.length} Packets</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>Total Pieces:</span>
                <strong>{items.reduce((sum, it) => sum + (it.pieces || 1), 0)} pcs</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>Total Carats:</span>
                <strong>
                  {items.reduce((sum, it) => sum + (it.weight || 0), 0).toFixed(2)} cts
                </strong>
              </div>

              {brokerName && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
                  <span>Brokerage to {brokerName}:</span>
                  <strong>{formatINR(calculatedBrokerageAmount)}</strong>
                </div>
              )}

              <div
                style={{
                  borderTop: "2px solid var(--border)",
                  paddingTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                <span>Total Lot Procurement Cost:</span>
                <span style={{ color: "var(--primary)" }}>{formatINR(totalCost)}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--success)" }}>Paid Now:</span>
                <strong style={{ color: "var(--success)" }}>{formatINR(paidAmount)}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
                <span style={{ color: totalCost - paidAmount > 0 ? "var(--danger)" : "var(--muted)" }}>
                  Balance Due:
                </span>
                <span style={{ color: totalCost - paidAmount > 0 ? "var(--danger)" : "var(--muted)" }}>
                  {formatINR(Math.max(0, totalCost - paidAmount))}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate("/purchases")}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={savePurchaseMutation.isPending}
              >
                {savePurchaseMutation.isPending
                  ? "Saving..."
                  : isEdit
                  ? "💾 Update Purchase & Inventory"
                  : "Confirm Intake & Create Packets"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
