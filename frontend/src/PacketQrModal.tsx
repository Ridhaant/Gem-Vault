import React, { useRef, useState } from "react";
import type { GemPacket } from "./types/gemstone";
import { QREncoder, formatPacketPayload, type QrPayloadMode } from "./qrCode";
import { formatINR } from "./format";
import { useNavigate } from "react-router-dom";
import { useToast } from "./toast";

export function PacketQrModal({
  packet,
  open,
  onClose,
}: {
  packet: GemPacket | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { show } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  
  // Default to clean document format which works universally on phone cameras without error
  const [qrMode, setQrMode] = useState<QrPayloadMode>("document");
  const [lanHost, setLanHost] = useState(
    typeof window !== "undefined" && window.location?.hostname !== "localhost" && window.location?.hostname !== "127.0.0.1"
      ? window.location.host
      : "192.168.0.103:5173"
  );

  if (!open || !packet) return null;

  // Generate payload based on mode
  const qrPayload = formatPacketPayload(packet, qrMode, lanHost);
  const isMultiStone = (packet.pieces || 1) > 1 || (packet.stone_details && packet.stone_details.length > 1) || (packet.sub_gems && packet.sub_gems.length > 0);
  const avgCarats = isMultiStone ? (packet.weight / packet.pieces).toFixed(2) : packet.weight.toFixed(2);

  // ISO/IEC 18004 Standard QR with 4-module quiet zone
  const qrSvg = QREncoder.toSVG(qrPayload, 180, 4);
  const qrPrintSvg = QREncoder.toSVG(qrPayload, 125, 4);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const subGemsHtml = packet.stone_details && packet.stone_details.length > 0
      ? `<div style="margin-top: 4px; padding-top: 3px; border-top: 1px dashed #94a3b8; font-size: 8px;">
          <strong style="color: #0369a1;">INDIVIDUAL STONES:</strong>
          ${packet.stone_details.map((s, i) => `<div>${i + 1}. ${s.variety || packet.particulars} (${s.shape || packet.shape}) • ${s.weight} cts ${s.mm_size ? `• ${s.mm_size}` : ''}</div>`).join('')}
        </div>`
      : packet.sub_gems && packet.sub_gems.length > 0
      ? `<div style="margin-top: 4px; padding-top: 3px; border-top: 1px dashed #94a3b8; font-size: 8px;">
          <strong style="color: #0369a1;">BOX ITEMS:</strong>
          ${packet.sub_gems.map((g, i) => `<div>${i + 1}. ${g.variety} (${g.shape}) • ${g.weight} cts (${g.pieces} pc) ${g.mm_size ? `• ${g.mm_size}` : ''}</div>`).join('')}
        </div>`
      : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Packet Label — ${packet.packet_number}</title>
          <style>
            @page {
              size: 80mm 55mm;
              margin: 2mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 3mm;
              background: #fff;
              color: #000;
            }
            .gem-tag {
              border: 1.5px solid #000;
              border-radius: 4px;
              padding: 5px 8px;
              display: flex;
              gap: 8px;
              align-items: center;
              box-sizing: border-box;
              height: 100%;
            }
            .qr-col {
              flex-shrink: 0;
              text-align: center;
            }
            .info-col {
              flex-grow: 1;
              line-height: 1.25;
            }
            .pkt-num {
              font-size: 16px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 1.5px solid #000;
              padding-bottom: 2px;
              margin-bottom: 3px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .pkt-num .status {
              font-size: 8px;
              font-weight: 700;
              background: #000;
              color: #fff;
              padding: 1px 4px;
              border-radius: 2px;
            }
            .gem-title {
              font-size: 11px;
              font-weight: 800;
              margin-bottom: 2px;
            }
            .specs-grid {
              font-size: 9.5px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 2px 4px;
            }
            .spec-row {
              display: flex;
              justify-content: space-between;
            }
            .spec-label {
              font-weight: 600;
              color: #333;
            }
            .spec-val {
              font-weight: 800;
            }
            .price-row {
              margin-top: 3px;
              font-size: 10.5px;
              font-weight: 900;
              border-top: 1px dashed #666;
              padding-top: 2px;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="gem-tag">
            <div class="qr-col">
              ${qrPrintSvg}
              <div style="font-size: 7.5px; font-weight: 800; margin-top: 2px; letter-spacing: 0.5px;">ISO 18004 STANDARD</div>
            </div>
            <div class="info-col">
              <div class="pkt-num">
                <span>${packet.packet_number}</span>
                <span class="status">${packet.status.toUpperCase()}</span>
              </div>
              <div class="gem-title">${packet.particulars}</div>
              ${isMultiStone ? `<div style="font-size: 8px; font-weight: 900; background: #e0f2fe; color: #0369a1; padding: 1px 4px; border-radius: 2px; margin-bottom: 2px; display: inline-block;">PARCEL LOT (${packet.pieces} STONES)</div>` : ""}
              <div class="specs-grid">
                <div class="spec-row"><span class="spec-label">Weight:</span> <span class="spec-val">${packet.weight} cts</span></div>
                <div class="spec-row"><span class="spec-label">Pieces:</span> <span class="spec-val">${packet.pieces} pcs</span></div>
                <div class="spec-row"><span class="spec-label">Shape:</span> <span class="spec-val">${packet.shape}</span></div>
                <div class="spec-row"><span class="spec-label">Size:</span> <span class="spec-val">${packet.mm_size || "—"}</span></div>
              </div>
              ${subGemsHtml}
              <div class="price-row">
                <span>NATURAL GEMSTONE</span>
                ${packet.cert_lab && packet.cert_lab !== "Self / None" ? `<span>LAB: ${packet.cert_lab}</span>` : `<span>VAULT VERIFIED</span>`}
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `packet_${packet.packet_number.replace(/\//g, "-")}_qr.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(qrPayload);
    show("Payload copied to clipboard!", "success");
  };

  const handleOpenPage = () => {
    onClose();
    navigate(`/packet/${encodeURIComponent(packet.packet_number)}`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 580 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🏷️</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Packet QR & Identification Label
              </h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Packet: <strong>{packet.packet_number}</strong> • {packet.particulars}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ gap: 14 }}>
          {/* QR Encoding Mode Selector */}
          <div>
            <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>
              Select QR Scanning Mode:
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1.2fr 1fr 0.8fr",
                gap: 6,
                background: "var(--surface-sunken)",
                padding: 4,
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                className={`btn btn-sm ${qrMode === "document" ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: 11, padding: "5px 6px" }}
                onClick={() => setQrMode("document")}
                title="Phone camera shows full formatted document card without errors"
              >
                📱 Phone Document
              </button>
              <button
                className={`btn btn-sm ${qrMode === "url" ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: 11, padding: "5px 6px" }}
                onClick={() => setQrMode("url")}
                title="Phone camera taps to open offline webpage directly"
              >
                🌐 Offline Web Link
              </button>
              <button
                className={`btn btn-sm ${qrMode === "scanner" ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: 11, padding: "5px 6px" }}
                onClick={() => setQrMode("scanner")}
                title="Ultra-fast code for physical warehouse 2D laser barcode guns"
              >
                ⚡ Barcode Reader
              </button>
              <button
                className={`btn btn-sm ${qrMode === "json" ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: 11, padding: "5px 6px" }}
                onClick={() => setQrMode("json")}
                title="Raw JSON structure"
              >
                📋 JSON
              </button>
            </div>

            {/* Custom host helper when URL mode is chosen */}
            {qrMode === "url" && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  background: "#f0fdf4",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #bbf7d0",
                }}
              >
                <span style={{ fontWeight: 700, color: "#166534" }}>LAN Host/IP:</span>
                <input
                  type="text"
                  className="input"
                  style={{ fontSize: 11, padding: "2px 6px", height: 26, width: 160 }}
                  value={lanHost}
                  onChange={(e) => setLanHost(e.target.value)}
                  placeholder="e.g. 192.168.0.103:5173"
                />
                <span style={{ color: "var(--muted)", fontSize: 10 }}>
                  (Connect phone to same Wi-Fi)
                </span>
              </div>
            )}
          </div>

          {/* Multi-Stone Parcel Alert Banner */}
          {isMultiStone && (
            <div
              style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>📦</span>
              <div>
                <strong>Multi-Stone Parcel Box:</strong> Contains <strong>{packet.pieces} gemstones</strong> ({packet.weight} cts total • avg <strong>{avgCarats} cts/stone</strong>)
                {packet.stone_details && packet.stone_details.length > 0 ? (
                  <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "#047857" }}>
                    ✓ Individual stone details: {packet.stone_details.slice(0, 4).map((s) => `${s.variety || packet.particulars} (${Number(s.weight).toFixed(2)}ct)`).join(", ")}{packet.stone_details.length > 4 ? ` +${packet.stone_details.length - 4} more` : ""}
                  </span>
                ) : packet.stone_weights && packet.stone_weights.length > 0 ? (
                  <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "#047857" }}>
                    ✓ Individual stone weights: {packet.stone_weights.slice(0, 6).map((w) => `${Number(w).toFixed(2)}ct`).join(", ")}{packet.stone_weights.length > 6 ? ` +${packet.stone_weights.length - 6} more` : ""}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {/* Printable Tag Preview */}
          <div
            ref={printRef}
            style={{
              background: "#ffffff",
              color: "#0f172a",
              border: "2px solid #0f172a",
              borderRadius: 8,
              padding: 14,
              display: "flex",
              gap: 14,
              alignItems: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            {/* QR Code Container */}
            <div
              style={{
                flexShrink: 0,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                style={{
                  background: "#fff",
                  padding: 2,
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  display: "inline-block",
                }}
              />
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: "#475569",
                  marginTop: 3,
                  letterSpacing: 0.5,
                }}
              >
                {qrMode === "scanner" ? "BARCODE GUN" : qrMode === "url" ? "WEB LINK" : "PHONE READY"}
              </div>
            </div>

            {/* Packet Info Container */}
            <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "2px solid #0f172a",
                  paddingBottom: 3,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase" }}>
                  {packet.packet_number}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: 4,
                    background:
                      packet.status === "in_stock"
                        ? "#10b981"
                        : packet.status === "sold"
                        ? "#ef4444"
                        : "#f59e0b",
                    color: "#fff",
                  }}
                >
                  {packet.status.replace("_", " ")}
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                {packet.particulars}
              </div>

              {isMultiStone && (
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: "#0284c7",
                    background: "#f0f9ff",
                    padding: "1px 6px",
                    borderRadius: 4,
                    display: "inline-block",
                    width: "fit-content",
                  }}
                >
                  Parcel Lot: {packet.pieces} stones
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "2px 8px",
                  fontSize: 11,
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>Weight: </span>
                  <strong style={{ color: "#0f172a" }}>{packet.weight} cts</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Pieces: </span>
                  <strong style={{ color: "#0f172a" }}>{packet.pieces} pcs</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Shape: </span>
                  <strong style={{ color: "#0f172a" }}>{packet.shape}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>MM Size: </span>
                  <strong style={{ color: "#0f172a" }}>{packet.mm_size || "—"}</strong>
                </div>
              </div>

              {/* Stone details or sub-gems preview if present */}
              {packet.stone_details && packet.stone_details.length > 0 ? (
                <div style={{ fontSize: 9.5, color: "#334155", background: "#f8fafc", padding: "3px 6px", borderRadius: 4 }}>
                  <strong>Stones: </strong>
                  {packet.stone_details.map((s) => `${s.variety || packet.particulars} ${s.shape || packet.shape} (${Number(s.weight).toFixed(2)}ct)`).join(" • ")}
                </div>
              ) : packet.sub_gems && packet.sub_gems.length > 0 ? (
                <div style={{ fontSize: 9.5, color: "#334155", background: "#f8fafc", padding: "3px 6px", borderRadius: 4 }}>
                  <strong>Box Contents: </strong>
                  {packet.sub_gems.map((g) => `${g.pieces}x ${g.variety} (${g.weight} ct)`).join(" • ")}
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 4,
                  paddingTop: 4,
                  borderTop: "1px dashed #cbd5e1",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                <span style={{ color: "#047857" }}>
                  NATURAL GEMSTONE
                </span>
                {packet.cert_lab && packet.cert_lab !== "Self / None" ? (
                  <span style={{ color: "#2563eb", fontSize: 10 }}>
                    {packet.cert_lab} Cert
                  </span>
                ) : (
                  <span style={{ color: "#64748b", fontSize: 10 }}>
                    VAULT VERIFIED
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Scanner Output Preview */}
          <div
            style={{
              background: "var(--surface-sunken)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 11,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
              <span style={{ color: "var(--muted)", fontWeight: 700 }}>
                What Phone Cameras & Physical Scanners See:
              </span>
              <button className="btn btn-ghost btn-xs" onClick={handleCopyText} style={{ fontSize: 10 }}>
                📋 Copy
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                fontSize: 11,
                lineHeight: 1.4,
                color: "var(--on-surface)",
                maxHeight: 70,
                overflowY: "auto",
              }}
            >
              {qrPayload}
            </pre>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={handleDownloadSvg}>
              ⬇️ Save SVG
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleOpenPage} title="Open standalone offline document page">
              🌐 View Page
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              🖨️ Print Packet Tag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
