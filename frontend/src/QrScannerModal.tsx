import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredPackets, getPacketByNumber } from "./gemstoneStorage";
import type { GemPacket } from "./types/gemstone";
import { formatINR } from "./format";
import { PacketQrModal } from "./PacketQrModal";

export function QrScannerModal({
  open,
  onClose,
  onSelectPacket,
}: {
  open: boolean;
  onClose: () => void;
  onSelectPacket?: (packet: GemPacket) => void;
}) {
  const navigate = useNavigate();
  const [inputVal, setInputVal] = useState("");
  const [matchedPacket, setMatchedPacket] = useState<GemPacket | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  if (!open) return null;

  const packets = getStoredPackets();

  const handleSearch = (query: string) => {
    const q = query.trim();
    if (!q) {
      setMatchedPacket(null);
      setSearchFeedback(null);
      return;
    }

    const found = getPacketByNumber(q);

    if (found) {
      setMatchedPacket(found);
      setSearchFeedback(null);
    } else {
      setMatchedPacket(null);
      setSearchFeedback(`No gemstone packet found matching "${q}"`);
    }
  };

  const handleQuickPick = (p: GemPacket) => {
    setInputVal(p.packet_number);
    setMatchedPacket(p);
    setSearchFeedback(null);
  };

  const handleSell = () => {
    if (!matchedPacket) return;
    onClose();
    navigate(`/sales/new?packet=${encodeURIComponent(matchedPacket.packet_number)}`);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal"
          style={{ maxWidth: 520 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>📷</span>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                  Packet QR Scanner & Instant Lookup
                </h2>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Scan packet label or enter packet number (ex/1, ex/2...)
                </span>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="modal-body" style={{ gap: 16 }}>
            {/* Input Bar */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 16,
                  }}
                >
                  🔍
                </span>
                <input
                  type="text"
                  autoFocus
                  placeholder="Scan QR barcode or enter packet number (e.g. ex/1)..."
                  className="input"
                  style={{ paddingLeft: 38 }}
                  value={inputVal}
                  onChange={(e) => {
                    setInputVal(e.target.value);
                    handleSearch(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch(inputVal);
                  }}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => handleSearch(inputVal)}
              >
                Identify
              </button>
            </div>

            {searchFeedback && (
              <div
                style={{
                  color: "var(--danger)",
                  fontSize: 13,
                  background: "rgba(239, 68, 68, 0.1)",
                  padding: "8px 12px",
                  borderRadius: 6,
                }}
              >
                ⚠️ {searchFeedback}
              </div>
            )}

            {/* Matched Packet Dossier */}
            {matchedPacket && (
              <div
                style={{
                  background: "var(--surface-sunken)",
                  border: "2px solid var(--primary)",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        color: "var(--primary)",
                        textTransform: "uppercase",
                      }}
                    >
                      {matchedPacket.packet_number}
                    </span>
                    <h3 style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 800 }}>
                      {matchedPacket.particulars}
                    </h3>
                    {matchedPacket.pieces > 1 && (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#0284c7",
                          background: "#f0f9ff",
                          border: "1px solid #bae6fd",
                          padding: "2px 8px",
                          borderRadius: 4,
                          display: "inline-block",
                          marginTop: 4,
                        }}
                      >
                        📦 Parcel Lot: {matchedPacket.pieces} stones (Avg {(matchedPacket.weight / matchedPacket.pieces).toFixed(2)} cts/pc)
                      </div>
                    )}
                  </div>
                  <span
                    className={`badge badge-${
                      matchedPacket.status === "in_stock"
                        ? "success"
                        : matchedPacket.status === "sold"
                        ? "error"
                        : "warning"
                    }`}
                  >
                    {matchedPacket.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 8,
                    fontSize: 13,
                    background: "var(--surface)",
                    padding: 12,
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--muted)" }}>Weight:</span>{" "}
                    <strong>{matchedPacket.weight} carats</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Pieces:</span>{" "}
                    <strong>{matchedPacket.pieces} pcs</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Shape:</span>{" "}
                    <strong>{matchedPacket.shape}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>MM Size:</span>{" "}
                    <strong>{matchedPacket.mm_size || "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Cost Price:</span>{" "}
                    <strong>{formatINR(matchedPacket.purchase_price)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Asking Price:</span>{" "}
                    <strong style={{ color: "var(--success)" }}>
                      {formatINR(matchedPacket.sale_price)}
                    </strong>
                  </div>
                  {matchedPacket.cert_lab && matchedPacket.cert_lab !== "Self / None" && (
                    <div style={{ gridColumn: "span 2" }}>
                      <span style={{ color: "var(--muted)" }}>Lab Report:</span>{" "}
                      <strong>
                        {matchedPacket.cert_lab} ({matchedPacket.cert_no || "Verified"})
                      </strong>
                    </div>
                  )}
                  {matchedPacket.status === "sold" && (
                    <div style={{ gridColumn: "span 2", color: "var(--danger)" }}>
                      <span>Sold to <strong>{matchedPacket.buyer_name}</strong> for {formatINR(matchedPacket.sold_price)} on {matchedPacket.sale_date}</span>
                    </div>
                  )}
                  {matchedPacket.status === "on_memo" && (
                    <div style={{ gridColumn: "span 2", color: "#f59e0b" }}>
                      <span>On Approval with <strong>{matchedPacket.memo_party}</strong> since {matchedPacket.memo_date}</span>
                    </div>
                  )}

                  {/* Stone Breakdown or Multi-Gem Box Contents */}
                  {matchedPacket.stone_details && matchedPacket.stone_details.length > 0 ? (
                    <div style={{ gridColumn: "span 2", borderTop: "1px dashed var(--border)", paddingTop: 8 }}>
                      <strong style={{ fontSize: 12, color: "#0369a1" }}>💎 Individual Stones ({matchedPacket.stone_details.length} Stones):</strong>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                        {matchedPacket.stone_details.map((s, i) => (
                          <div key={i} style={{ fontSize: 11, color: "var(--text)" }}>
                            • <strong>{s.variety || matchedPacket.particulars}</strong> ({s.shape || matchedPacket.shape}) — {Number(s.weight).toFixed(2)} cts {s.mm_size ? `| ${s.mm_size}` : ""} {s.notes ? `(${s.notes})` : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : matchedPacket.sub_gems && matchedPacket.sub_gems.length > 0 ? (
                    <div style={{ gridColumn: "span 2", borderTop: "1px dashed var(--border)", paddingTop: 8 }}>
                      <strong style={{ fontSize: 12, color: "#0369a1" }}>📦 Box Contents ({matchedPacket.sub_gems.length} Items):</strong>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                        {matchedPacket.sub_gems.map((g, i) => (
                          <div key={i} style={{ fontSize: 11, color: "var(--text)" }}>
                            • <strong>{g.variety}</strong> ({g.shape}) — {g.weight} cts ({g.pieces} pc) {g.mm_size ? `| ${g.mm_size}` : ""} {g.notes ? `(${g.notes})` : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Quick Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {matchedPacket.status === "in_stock" && (
                    <button className="btn btn-primary btn-sm" onClick={handleSell}>
                      💰 Sell Packet
                    </button>
                  )}
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      onClose();
                      navigate(`/packet/${encodeURIComponent(matchedPacket.packet_number)}`);
                    }}
                    title="Open standalone offline document page"
                  >
                    🌐 Open Dossier
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowQrModal(true)}
                  >
                    🏷️ View & Print Label
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      onClose();
                      navigate(`/inventory?q=${encodeURIComponent(matchedPacket.packet_number)}`);
                    }}
                  >
                    🔍 Inventory
                  </button>
                </div>
              </div>
            )}

            {/* Quick Pick Samples */}
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Quick Identify Recent Vault Packets
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {packets.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    className="btn btn-ghost btn-sm"
                    style={{
                      border: "1px solid var(--border)",
                      fontSize: 12,
                      padding: "4px 8px",
                    }}
                    onClick={() => handleQuickPick(p)}
                  >
                    {p.packet_number} ({p.particulars.split(" ")[0]} {p.weight}ct)
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>

      {showQrModal && matchedPacket && (
        <PacketQrModal
          packet={matchedPacket}
          open={showQrModal}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </>
  );
}
