// GemVault Standalone Offline Packet Dossier Page
// Accessible by phone cameras (via local network URL) and physical barcode scanners
// Displays all data, documents, and itemized multi-gem parcel breakdowns offline!

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPacketByNumber, savePacket, getStoredSales } from "../gemstoneStorage";
import { resolvePacketStoneStatuses } from "../packetStones";
import type { GemPacket, GemStoneDetail } from "../types/gemstone";
import { DEFAULT_SHAPES, DEFAULT_VARIETIES } from "../types/gemstone";
import { formatINR } from "../format";
import { PacketQrModal } from "../PacketQrModal";
import { useToast } from "../toast";

export default function PacketView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lookup packet with local state so edits immediately reflect
  const [packet, setPacket] = useState<GemPacket | undefined>(() => (id ? getPacketByNumber(id) : undefined));

  useEffect(() => {
    if (id) {
      setPacket(getPacketByNumber(id));
    }
  }, [id]);

  const stoneStatuses = useMemo(() => {
    if (!packet) return [];
    return resolvePacketStoneStatuses(packet, getStoredSales());
  }, [packet]);

  // Stones Management State with Full Customization Support
  const [editStonesModalOpen, setEditStonesModalOpen] = useState(false);
  const [stoneEditMode, setStoneEditMode] = useState<"custom" | "compact">("custom");
  const [workingStoneDetails, setWorkingStoneDetails] = useState<GemStoneDetail[]>([]);
  const [workingStoneWeights, setWorkingStoneWeights] = useState<number[]>([]);
  const [workingPieces, setWorkingPieces] = useState<number>(1);
  const [workingWeight, setWorkingWeight] = useState<number>(0);
  const [batchCount, setBatchCount] = useState<number>(3);

  const handleOpenEditStonesModal = () => {
    if (!packet) return;
    const pieces = Math.max(1, packet.pieces || (packet.stone_weights?.length || 1));
    let initialDetails: GemStoneDetail[] = [];
    if (packet.stone_details && packet.stone_details.length > 0) {
      initialDetails = packet.stone_details.map((s, idx) => ({
        id: s.id || `stone-${idx + 1}-${Date.now()}`,
        variety: s.variety || packet.particulars || "Gemstone",
        shape: s.shape || packet.shape || "Oval",
        weight: Number(s.weight) || 0,
        mm_size: s.mm_size || packet.mm_size || "",
        notes: s.notes || "",
      }));
    } else if (packet.stone_weights && packet.stone_weights.length > 0) {
      initialDetails = packet.stone_weights.map((wt, idx) => ({
        id: `stone-${idx + 1}-${Date.now()}`,
        variety: packet.particulars || "Gemstone",
        shape: packet.shape || "Oval",
        weight: Number(wt) || 0,
        mm_size: packet.mm_size || "",
      }));
    } else {
      const avg = Number(((packet.weight || 0) / pieces).toFixed(3));
      initialDetails = Array(pieces).fill(null).map((_, idx) => ({
        id: `stone-${idx + 1}-${Date.now()}`,
        variety: packet.particulars || "Gemstone",
        shape: packet.shape || "Oval",
        weight: avg,
        mm_size: packet.mm_size || "",
      }));
    }
    setWorkingStoneDetails(initialDetails);
    setWorkingStoneWeights(initialDetails.map((s) => s.weight));
    setWorkingPieces(initialDetails.length);
    setWorkingWeight(packet.weight || 0);
    setEditStonesModalOpen(true);
  };

  const updateStoneDetail = (index: number, field: keyof GemStoneDetail, val: any) => {
    const updated = [...workingStoneDetails];
    if (!updated[index]) return;
    updated[index] = { ...updated[index], [field]: val };
    setWorkingStoneDetails(updated);
    setWorkingStoneWeights(updated.map((s) => s.weight));
    const sum = Number(updated.reduce((acc, s) => acc + (Number(s.weight) || 0), 0).toFixed(2));
    if (sum > 0) setWorkingWeight(sum);
  };

  const addStone = () => {
    const defaultVar = packet?.particulars || "Gemstone";
    const defaultShp = packet?.shape || "Oval";
    const newStone: GemStoneDetail = {
      id: `stone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      variety: defaultVar,
      shape: defaultShp,
      weight: 0,
      mm_size: packet?.mm_size || "",
    };
    const updated = [...workingStoneDetails, newStone];
    setWorkingStoneDetails(updated);
    setWorkingStoneWeights(updated.map((s) => s.weight));
    setWorkingPieces(updated.length);
  };

  const addBatchStones = (count: number) => {
    const defaultVar = packet?.particulars || "Gemstone";
    const defaultShp = packet?.shape || "Oval";
    const newItems: GemStoneDetail[] = [];
    for (let k = 0; k < count; k++) {
      newItems.push({
        id: `stone-${Date.now()}-${k}-${Math.random().toString(36).substring(2, 6)}`,
        variety: defaultVar,
        shape: defaultShp,
        weight: 0,
        mm_size: packet?.mm_size || "",
      });
    }
    const updated = [...workingStoneDetails, ...newItems];
    setWorkingStoneDetails(updated);
    setWorkingStoneWeights(updated.map((s) => s.weight));
    setWorkingPieces(updated.length);
  };

  const removeStone = (index: number) => {
    const updated = [...workingStoneDetails];
    updated.splice(index, 1);
    setWorkingStoneDetails(updated);
    setWorkingStoneWeights(updated.map((s) => s.weight));
    setWorkingPieces(Math.max(1, updated.length));
    const sum = Number(updated.reduce((acc, s) => acc + (Number(s.weight) || 0), 0).toFixed(2));
    if (sum > 0) setWorkingWeight(sum);
  };

  const handleEvenSplit = () => {
    if (!packet) return;
    const pcs = workingStoneDetails.length || 1;
    const sum = Number(workingStoneDetails.reduce((a, b) => a + (Number(b.weight) || 0), 0).toFixed(2)) || workingWeight || packet.weight;
    const avg = Number((sum / pcs).toFixed(3));
    const updated = workingStoneDetails.map((s) => ({ ...s, weight: avg }));
    setWorkingStoneDetails(updated);
    setWorkingStoneWeights(updated.map((s) => s.weight));
    setWorkingWeight(sum);
  };

  const handleSumToTotal = () => {
    const sum = Number(workingStoneDetails.reduce((a, b) => a + (Number(b.weight) || 0), 0).toFixed(2));
    if (sum > 0) setWorkingWeight(sum);
  };

  const handleSaveStones = () => {
    if (!packet) return;
    const details = workingStoneDetails.length > 0 ? workingStoneDetails : [];
    const weights = details.length > 0
      ? details.map((s) => Number(s.weight) || 0)
      : workingStoneWeights;
    const sum = Number(weights.reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));
    const finalWeight = sum > 0 ? sum : workingWeight;
    const finalPcs = weights.length > 0 ? weights.length : workingPieces;
    const updated = savePacket({
      ...packet,
      pieces: finalPcs,
      weight: finalWeight,
      stone_weights: weights,
      stone_details: details,
    });
    setPacket(updated);
    setEditStonesModalOpen(false);
    show("Packet stones updated successfully!", "success");
  };

  const handleCopySpecs = () => {
    if (!packet) return;
    const stoneDetailsText = packet.stone_details?.length
      ? `\nIndividual Stones (${packet.stone_details.length} pcs):\n` +
        packet.stone_details
          .map(
            (s, i) =>
              `${i + 1}. ${s.variety || packet.particulars} (${s.shape || packet.shape}) - ${s.weight} cts ${s.mm_size ? `• ${s.mm_size}` : ""}`
          )
          .join("\n")
      : packet.stone_weights?.length
      ? `\nStone Weights (${packet.stone_weights.length} pcs): ` +
        packet.stone_weights.map((w, i) => `#${i + 1}: ${w} cts`).join(", ")
      : "";

    const text = `💎 SHREEJI GEMS CERTIFICATE
Packet: ${packet.packet_number}
Particulars: ${packet.particulars}
Shape: ${packet.shape}
Weight: ${packet.weight} cts (${packet.pieces} pcs)
Dimensions: ${packet.mm_size || "—"}
Status: ${packet.status.toUpperCase()}${stoneDetailsText}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    show("Packet specifications copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrintDossier = () => {
    window.print();
  };

  if (!packet) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "var(--surface)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 8px" }}>
          Gemstone Packet Not Found
        </h1>
        <p style={{ color: "var(--muted)", maxWidth: 400, margin: "0 0 20px", fontSize: 14 }}>
          Could not locate packet <strong>"{id}"</strong> in your local Shreeji Gems inventory. Please ensure the packet ID is correct or scan again.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            ← Go to Dashboard
          </button>
          <button className="btn btn-outline" onClick={() => navigate("/inventory")}>
            View All Inventory
          </button>
        </div>
      </div>
    );
  }

  const isMultiStone = (packet.pieces || 1) > 1 || (packet.sub_gems && packet.sub_gems.length > 0);
  const avgCarats = packet.pieces > 1 ? (packet.weight / packet.pieces).toFixed(2) : packet.weight.toFixed(2);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface)",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 840, display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Top Bar for Phone / Browser navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>💎</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: 0.5, color: "var(--on-surface)" }}>
                SHREEJI GEMS MASTER DOSSIER
              </div>
              <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700 }}>
                100% Offline Vault Record
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-outline btn-sm"
              style={{ borderColor: "var(--primary)", color: "var(--primary)", fontWeight: 700 }}
              onClick={handleOpenEditStonesModal}
            >
              💎 Manage Stones
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowQrModal(true)}>
              🏷️ QR Tag
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>
              Home
            </button>
          </div>
        </div>

        {/* Main Certificate Card */}
        <div
          className="card"
          style={{
            padding: 24,
            border: "2px solid var(--border)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
            background: "var(--surface-raised)",
          }}
        >
          {/* Header Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "2px solid var(--border)",
              paddingBottom: 16,
              marginBottom: 18,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "var(--primary)",
                  }}
                >
                  {packet.packet_number}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    padding: "4px 10px",
                    borderRadius: 20,
                    background:
                      packet.status === "in_stock"
                        ? "#10b981"
                        : packet.status === "sold"
                        ? "#ef4444"
                        : "#f59e0b",
                    color: "#fff",
                  }}
                >
                  {packet.status === "in_stock"
                    ? "In Stock (Vault)"
                    : packet.status === "on_memo"
                    ? "On Approval"
                    : "Sold"}
                </span>
                {isMultiStone && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      background: "#e0f2fe",
                      color: "#0369a1",
                      padding: "4px 10px",
                      borderRadius: 20,
                    }}
                  >
                    📦 Multi-Stone Parcel Lot
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 900, margin: "6px 0 0", color: "var(--on-surface)" }}>
                {packet.particulars}
              </h1>
              {packet.origin && (
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  Origin: <strong>{packet.origin}</strong> • Treatment: <strong>{packet.treatment || "Natural"}</strong>
                </div>
              )}
            </div>

            {/* Price Badge */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 800 }}>
                Asking / Target Price
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--primary)" }}>
                {formatINR(packet.sale_price)}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Cost: {formatINR(packet.purchase_price)} ({packet.purchase_date})
              </div>
            </div>
          </div>

          {/* Key Specifications Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                background: "var(--surface-sunken)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Total Weight
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--on-surface)", marginTop: 2 }}>
                {packet.weight} <span style={{ fontSize: 13, fontWeight: 600 }}>cts</span>
              </div>
              {isMultiStone && (
                <div style={{ fontSize: 11, color: "#0284c7", marginTop: 2 }}>
                  Avg {avgCarats} cts/stone
                </div>
              )}
            </div>

            <div
              style={{
                background: "var(--surface-sunken)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Total Pieces
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--on-surface)", marginTop: 2 }}>
                {packet.pieces} <span style={{ fontSize: 13, fontWeight: 600 }}>{packet.pieces === 1 ? "pc" : "pcs"}</span>
              </div>
            </div>

            <div
              style={{
                background: "var(--surface-sunken)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Primary Shape
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "var(--on-surface)", marginTop: 2 }}>
                {packet.shape}
              </div>
            </div>

            <div
              style={{
                background: "var(--surface-sunken)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Dimensions (MM)
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--on-surface)", marginTop: 2 }}>
                {packet.mm_size || "Not calibrated"}
              </div>
            </div>
          </div>

          {/* Individual Stone Breakdown (Full Customization Support) */}
          {packet.stone_details && packet.stone_details.length > 0 ? (
            <div
              style={{
                background: "var(--surface-sunken)",
                border: "1.5px solid var(--border)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>💎</span>
                  <span>
                    Individual Stone Breakdown ({stoneStatuses.filter((s) => s.status === "in_stock").length} in stock
                    {stoneStatuses.some((s) => s.status !== "in_stock") ? ` • ${stoneStatuses.filter((s) => s.status !== "in_stock").length} sold / memo` : ""}
                    )
                  </span>
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    Current Stock: {packet.weight} cts ({packet.pieces} pcs)
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={handleOpenEditStonesModal}
                    style={{ fontWeight: 700, color: "var(--primary)", borderColor: "var(--primary)" }}
                  >
                    ✏️ Edit Stones
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
                {stoneStatuses.map((st, i) => {
                  const isInStock = st.status === "in_stock";
                  const isApproval = st.status === "on_approval";
                  const isSold = st.status === "sold";
                  return (
                    <div
                      key={st.id || i}
                      style={{
                        background: isInStock
                          ? "var(--surface)"
                          : isApproval
                          ? "rgba(245, 158, 11, 0.05)"
                          : "var(--surface-sunken)",
                        border: isInStock
                          ? "1.5px solid rgba(16, 185, 129, 0.45)"
                          : isApproval
                          ? "1.5px dashed rgba(245, 158, 11, 0.6)"
                          : "1px solid var(--border)",
                        padding: "8px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        opacity: isSold ? 0.78 : 1,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: isInStock ? "var(--muted)" : isApproval ? "#d97706" : "var(--muted)", fontSize: 10.5, fontWeight: 800 }}>
                          Stone #{st.stoneNumber}
                        </span>
                        <span style={{ color: "var(--primary)", fontWeight: 900, fontSize: 13 }}>
                          {Number(st.weight).toFixed(2)} cts
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                        <span
                          style={{
                            background: "var(--primary-subtle, rgba(16, 185, 129, 0.12))",
                            color: "var(--primary)",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          {st.variety || packet.particulars}
                        </span>
                        <span
                          style={{
                            background: "var(--surface-sunken)",
                            border: "1px solid var(--border)",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontSize: 10.5,
                            color: "var(--on-surface-2)",
                          }}
                        >
                          {st.shape || packet.shape}
                        </span>
                        {st.mm_size ? (
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>• {st.mm_size}</span>
                        ) : null}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                        {isInStock ? (
                          <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "1px 6px", borderRadius: 4, fontWeight: 800, fontSize: 9.5 }}>
                            ● IN STOCK
                          </span>
                        ) : isApproval ? (
                          <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#d97706", padding: "1px 6px", borderRadius: 4, fontWeight: 800, fontSize: 9.5 }} title={st.saleRef ? `Memo #${st.saleRef.invoice_no} (${st.saleRef.buyer_name})` : "On Approval"}>
                            MEMO {st.saleRef?.invoice_no ? `(${st.saleRef.invoice_no})` : ""}
                          </span>
                        ) : (
                          <span style={{ background: "rgba(100, 116, 139, 0.15)", color: "#64748b", padding: "1px 6px", borderRadius: 4, fontWeight: 800, fontSize: 9.5 }} title={st.saleRef ? `Sold: ${st.saleRef.invoice_no} to ${st.saleRef.buyer_name}` : "Sold"}>
                            SOLD {st.saleRef?.invoice_no ? `(${st.saleRef.invoice_no})` : ""}
                          </span>
                        )}

                        {!isInStock && st.saleRef?.buyer_name && (
                          <span style={{ fontSize: 9.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>
                            {st.saleRef.buyer_name}
                          </span>
                        )}
                      </div>

                      {st.notes ? (
                        <div style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>{st.notes}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : packet.stone_weights && packet.stone_weights.length > 0 ? (
            <div
              style={{
                background: "var(--surface-sunken)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⚖️</span>
                  <span>Individual Stone Weights Breakdown ({packet.stone_weights.length} Stones)</span>
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    Total: {packet.weight} cts (Avg: {(packet.weight / packet.stone_weights.length).toFixed(3)} cts/pc)
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={handleOpenEditStonesModal}
                    style={{ fontWeight: 700, color: "var(--primary)", borderColor: "var(--primary)" }}
                  >
                    ✏️ Edit Stones
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {packet.stone_weights.map((wt, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ color: "var(--muted)", fontSize: 10, marginRight: 4 }}>#{i + 1}:</span>
                    <span style={{ color: "var(--primary)" }}>{Number(wt).toFixed(2)}</span> cts
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--surface-sunken)",
                border: "1px dashed var(--border)",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--on-surface)" }}>
                  💎 Manage Individual & Multiple Stones
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Currently recorded as {packet.pieces || 1} {packet.pieces === 1 ? "stone" : "stones"} ({packet.weight} {packet.unit || "cts"}). Click to configure individual stone varieties, shapes, weights, or dimensions.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleOpenEditStonesModal}
                style={{ fontWeight: 700, color: "var(--primary)", borderColor: "var(--primary)" }}
              >
                + Add / Edit Stones
              </button>
            </div>
          )}

          {/* Memo or Sold Specifics */}
          {packet.status === "on_memo" && (
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: 8,
                padding: "12px 16px",
                color: "#92400e",
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                ⚠️ Packet Currently Out On Approval
              </div>
              <div style={{ fontSize: 12 }}>
                Party: <strong>{packet.memo_party}</strong> • Date: <strong>{packet.memo_date}</strong>
                {packet.memo_notes && <div>Terms: {packet.memo_notes}</div>}
              </div>
            </div>
          )}

          {packet.status === "sold" && (
            <div
              style={{
                background: "#fee2e2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "12px 16px",
                color: "#991b1b",
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                ✅ Packet Sold & Invoiced
              </div>
              <div style={{ fontSize: 12 }}>
                Buyer: <strong>{packet.buyer_name}</strong> • Sold Date: <strong>{packet.sale_date}</strong> • Realized Price: <strong>{formatINR(packet.sold_price || packet.sale_price)}</strong>
              </div>
            </div>
          )}

          {/* Lab Certification & Notes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              background: "var(--surface-sunken)",
              padding: 14,
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <strong>Lab Certification:</strong>{" "}
              {packet.cert_lab && packet.cert_lab !== "Self / None" ? (
                <span style={{ color: "#2563eb", fontWeight: 800 }}>
                  {packet.cert_lab} ({packet.cert_no || "Registered"})
                </span>
              ) : (
                "Self Certified / In-House"
              )}
            </div>
            <div>
              <strong>Color Grade:</strong> {packet.color_grade || "Natural / Fancy"}
            </div>
            <div>
              <strong>Clarity:</strong> {packet.clarity || "Eye Clean"}
            </div>
            <div>
              <strong>Supplier:</strong> {packet.supplier_name || "Direct Procurement"}
            </div>
            {packet.notes && (
              <div style={{ gridColumn: "span 2", marginTop: 4, color: "var(--muted)" }}>
                <strong>Gemologist Notes:</strong> {packet.notes}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              borderTop: "1px solid var(--border)",
              paddingTop: 16,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={handleCopySpecs}>
                {copied ? "✓ Specs Copied" : "📋 Copy Specs"}
              </button>
              <button className="btn btn-outline btn-sm" onClick={handlePrintDossier}>
                🖨️ Print Dossier
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowQrModal(true)}>
                🏷️ Open QR Tag
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/inventory")}>
                Vault Inventory →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {showQrModal && (
        <PacketQrModal
          packet={packet}
          open={showQrModal}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* Stones Manager Modal with Full Stone Customization */}
      {editStonesModalOpen && packet && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>💎</span> Manage Packet Stones ({packet.packet_number})
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditStonesModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Mode Toggle & Metrics */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: 6, padding: 2 }}>
                    <button
                      type="button"
                      style={{
                        padding: "4px 12px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        background: workingStoneDetails.length <= 1 ? "var(--primary)" : "transparent",
                        color: workingStoneDetails.length <= 1 ? "#fff" : "var(--on-surface-2)",
                      }}
                      onClick={() => {
                        const w = workingWeight || packet.weight || 1;
                        const single: GemStoneDetail[] = [
                          {
                            id: "st-1",
                            variety: packet.particulars || "Gemstone",
                            shape: packet.shape || "Oval",
                            weight: w,
                            mm_size: packet.mm_size || "",
                          },
                        ];
                        setWorkingStoneDetails(single);
                        setWorkingStoneWeights([w]);
                        setWorkingPieces(1);
                      }}
                    >
                      Single Stone (1 pc)
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "4px 12px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        background: workingStoneDetails.length > 1 ? "var(--primary)" : "transparent",
                        color: workingStoneDetails.length > 1 ? "#fff" : "var(--on-surface-2)",
                      }}
                      onClick={() => {
                        const cur = [...workingStoneDetails];
                        const pcs = Math.max(2, cur.length);
                        const avg = Number(((workingWeight || packet.weight || 1) / pcs).toFixed(3));
                        while (cur.length < pcs) {
                          cur.push({
                            id: `st-${cur.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
                            variety: packet.particulars || "Gemstone",
                            shape: packet.shape || "Oval",
                            weight: avg,
                            mm_size: packet.mm_size || "",
                          });
                        }
                        setWorkingStoneDetails(cur);
                        setWorkingStoneWeights(cur.map((s) => s.weight));
                        setWorkingPieces(pcs);
                      }}
                    >
                      Multiple Stones ({workingStoneDetails.length > 1 ? workingStoneDetails.length : 2}+ pcs)
                    </button>
                  </div>

                  {/* Mode Toggle: Full Customization vs Quick Weights */}
                  <div style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 2 }}>
                    <button
                      type="button"
                      style={{
                        padding: "3px 8px",
                        fontSize: 10.5,
                        fontWeight: 700,
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        background: stoneEditMode === "custom" ? "var(--secondary, #3b82f6)" : "transparent",
                        color: stoneEditMode === "custom" ? "#fff" : "var(--on-surface-2)",
                      }}
                      onClick={() => setStoneEditMode("custom")}
                    >
                      🎨 Customize Stones
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "3px 8px",
                        fontSize: 10.5,
                        fontWeight: 700,
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        background: stoneEditMode === "compact" ? "var(--secondary, #3b82f6)" : "transparent",
                        color: stoneEditMode === "compact" ? "#fff" : "var(--on-surface-2)",
                      }}
                      onClick={() => setStoneEditMode("compact")}
                    >
                      ⚡ Quick Weights
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  Total: <strong>{workingStoneDetails.length} pcs</strong> •{" "}
                  <strong style={{ color: "var(--primary)" }}>
                    {workingStoneDetails.reduce((a, b) => a + (Number(b.weight) || 0), 0).toFixed(2)} {packet.unit || "cts"}
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={addStone}
                  >
                    + Add Individual Stone
                  </button>

                  <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => addBatchStones(batchCount)}
                    >
                      + Add Multiple ({batchCount}) Stones
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      style={{ width: 42, padding: "2px 4px", fontSize: 11, textAlign: "center" }}
                      className="input"
                      value={batchCount}
                      onChange={(e) => setBatchCount(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: 11, color: "var(--primary)" }}
                    onClick={() => {
                      const updated = workingStoneDetails.map((st) => ({
                        ...st,
                        variety: packet.particulars || st.variety,
                        shape: packet.shape || st.shape,
                      }));
                      setWorkingStoneDetails(updated);
                      setWorkingStoneWeights(updated.map((s) => s.weight));
                      show("All stones set to packet defaults!", "info");
                    }}
                    title="Set all stones to packet particulars & shape defaults"
                  >
                    📋 Match Packet Defaults
                  </button>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={handleEvenSplit}
                    title="Split total weight evenly across all stones"
                  >
                    Even Split
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={handleSumToTotal}
                    title="Sum all stone weights and update total weight"
                  >
                    Sum to Total ({workingStoneDetails.reduce((a, b) => a + (Number(b.weight) || 0), 0).toFixed(2)} cts)
                  </button>
                </div>
              </div>

              {/* Quick Paste CSV */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", fontWeight: 700 }}>
                  Quick paste weights:
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ fontSize: 11, padding: "3px 8px", flex: 1 }}
                  placeholder="e.g. 0.55, 0.48, 0.60, 0.52 (comma separated)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const target = e.target as HTMLInputElement;
                      const parsed = target.value
                        .split(/[\s,]+/)
                        .map((v) => parseFloat(v))
                        .filter((v) => !isNaN(v) && v > 0);
                      if (parsed.length > 0) {
                        const newDetails: GemStoneDetail[] = parsed.map((wt, idx) => ({
                          id: workingStoneDetails[idx]?.id || `st-${Date.now()}-${idx}`,
                          variety: workingStoneDetails[idx]?.variety || packet.particulars || "Gemstone",
                          shape: workingStoneDetails[idx]?.shape || packet.shape || "Oval",
                          weight: wt,
                          mm_size: workingStoneDetails[idx]?.mm_size || packet.mm_size || "",
                        }));
                        setWorkingStoneDetails(newDetails);
                        setWorkingStoneWeights(newDetails.map((s) => s.weight));
                        setWorkingPieces(newDetails.length);
                        const sum = Number(parsed.reduce((a, b) => a + b, 0).toFixed(2));
                        if (sum > 0) setWorkingWeight(sum);
                        target.value = "";
                      }
                    }
                  }}
                />
                <span style={{ fontSize: 10, color: "var(--muted)" }}>Press Enter</span>
              </div>

              <datalist id="pv-variety-list">
                {DEFAULT_VARIETIES.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>

              {/* Stone Table: Custom vs Compact */}
              {stoneEditMode === "custom" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 250, overflowY: "auto", padding: "2px 0" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 1.4fr 1.1fr 1fr 1.1fr 28px",
                      gap: 6,
                      padding: "4px 8px",
                      fontSize: 10.5,
                      fontWeight: 800,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span>#</span>
                    <span>Stone Variety / Type</span>
                    <span>Shape / Cut</span>
                    <span>Weight (ct)</span>
                    <span>MM Dimensions</span>
                    <span></span>
                  </div>

                  {workingStoneDetails.map((stItem, stIdx) => (
                    <div
                      key={stItem.id || stIdx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "36px 1.4fr 1.1fr 1fr 1.1fr 28px",
                        gap: 6,
                        alignItems: "center",
                        background: "var(--surface)",
                        padding: "5px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textAlign: "center" }}>
                        #{stIdx + 1}
                      </span>

                      <input
                        type="text"
                        list="pv-variety-list"
                        className="input"
                        style={{ fontSize: 11.5, padding: "3px 6px" }}
                        placeholder="e.g. Ruby, Emerald..."
                        value={stItem.variety || ""}
                        onChange={(e) => updateStoneDetail(stIdx, "variety", e.target.value)}
                      />

                      <select
                        className="select"
                        style={{ fontSize: 11.5, padding: "3px 6px" }}
                        value={stItem.shape || packet.shape || "Oval"}
                        onChange={(e) => updateStoneDetail(stIdx, "shape", e.target.value)}
                      >
                        {DEFAULT_SHAPES.map((sh) => (
                          <option key={sh} value={sh}>
                            {sh}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        className="input"
                        style={{ fontSize: 11.5, padding: "3px 6px", fontWeight: 700 }}
                        placeholder="Weight"
                        value={stItem.weight !== 0 ? stItem.weight : ""}
                        onChange={(e) => updateStoneDetail(stIdx, "weight", parseFloat(e.target.value) || 0)}
                      />

                      <input
                        type="text"
                        className="input"
                        style={{ fontSize: 11.5, padding: "3px 6px" }}
                        placeholder="e.g. 7.2x5.1x3.4"
                        value={stItem.mm_size || ""}
                        onChange={(e) => updateStoneDetail(stIdx, "mm_size", e.target.value)}
                      />

                      {workingStoneDetails.length > 1 ? (
                        <button
                          type="button"
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: 13,
                            fontWeight: 900,
                            textAlign: "center",
                          }}
                          title={`Delete stone #${stIdx + 1}`}
                          onClick={() => removeStone(stIdx)}
                        >
                          ✕
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Compact Quick Weights mode */
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto", padding: "4px 0" }}>
                  {workingStoneDetails.map((stItem, stIdx) => (
                    <div
                      key={stItem.id || stIdx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        background: "var(--surface)",
                        padding: "3px 6px",
                        borderRadius: 5,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)" }}>#{stIdx + 1}:</span>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        style={{ width: 62, padding: "2px 4px", fontSize: 11, fontWeight: 700 }}
                        className="input"
                        value={stItem.weight !== 0 ? stItem.weight : ""}
                        placeholder="ct"
                        onChange={(e) => updateStoneDetail(stIdx, "weight", parseFloat(e.target.value) || 0)}
                      />
                      {workingStoneDetails.length > 1 && (
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
                          onClick={() => removeStone(stIdx)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setEditStonesModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveStones}
              >
                Save Stones Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
