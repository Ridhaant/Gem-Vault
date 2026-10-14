import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api";
import { Spinner, PayBadge } from "../ui";
import { formatINR, formatINRCompact, shortDate } from "../format";
import type { GemPacket, GemSale, GemBrokerage } from "../types/gemstone";
import { PacketQrModal } from "../PacketQrModal";
import { QrScannerModal } from "../QrScannerModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedPacket, setSelectedPacket] = useState<GemPacket | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [filterParticular, setFilterParticular] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics_overview"],
    queryFn: () => apiGet("/analytics"),
  });

  const { data: packetsData } = useQuery<GemPacket[]>({
    queryKey: ["packets"],
    queryFn: () => apiGet("/packets"),
  });

  const { data: salesData } = useQuery<GemSale[]>({
    queryKey: ["sales"],
    queryFn: () => apiGet("/sales"),
  });

  const { data: brokerageData } = useQuery<GemBrokerage[]>({
    queryKey: ["brokerage"],
    queryFn: () => apiGet("/brokerage"),
  });

  if (isLoading) {
    return (
      <div className="page-body">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>Failed to load vault dashboard</h3>
          <button className="btn btn-primary btn-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const allPackets: GemPacket[] = packetsData || [];
  const inStockPackets = allPackets.filter(
    (p) => p.status === "in_stock" || p.status === "on_memo"
  );
  const recentSales: GemSale[] = (salesData || []).slice(0, 5);
  const recentBrokerage: GemBrokerage[] = (brokerageData || []).slice(0, 4);

  const displayedPackets = filterParticular === "all"
    ? inStockPackets.slice(0, 8)
    : inStockPackets.filter(p => p.particulars.toLowerCase().includes(filterParticular.toLowerCase())).slice(0, 8);

  const kpis = [
    {
      label: "Vault Valuation (Cost)",
      value: formatINRCompact(data.vault_cost_valuation),
      subtitle: `${data.vault_packets_count} packets • ${data.vault_total_carats} cts`,
      icon: "💎",
      color: "#10b981",
      borderTop: "#10b981",
    },
    {
      label: "Projected Sale Value",
      value: formatINRCompact(data.vault_asking_valuation),
      subtitle: `+${formatINRCompact(data.unrealized_profit)} potential profit`,
      icon: "🎯",
      color: "#059669",
      borderTop: "#059669",
    },
    {
      label: "Total Sales Revenue",
      value: formatINRCompact(data.total_sales_revenue),
      subtitle: `COGS: ${formatINRCompact(data.total_cogs)}`,
      icon: "📈",
      color: "#2563eb",
      borderTop: "#2563eb",
    },
    {
      label: "Gross Sales Profit",
      value: formatINRCompact(data.gross_profit),
      subtitle: `${data.gross_margin_pct}% gross margin`,
      icon: "💰",
      color: "#10b981",
      borderTop: "#10b981",
    },
    {
      label: "Brokerage Income",
      value: formatINRCompact(data.brokerage_earnings),
      subtitle: `${formatINRCompact(data.pending_brokerage)} pending`,
      icon: "🤝",
      color: "#8b5cf6",
      borderTop: "#8b5cf6",
    },
    {
      label: "Operating Expenses",
      value: formatINRCompact(data.total_expenses),
      subtitle: "Labs, cutting, vault, transit",
      icon: "💳",
      color: "#f59e0b",
      borderTop: "#f59e0b",
    },
    {
      label: "Net Business Profit",
      value: formatINRCompact(data.net_profit),
      subtitle: `${data.net_margin_pct}% net margin`,
      icon: "🏆",
      color: data.net_profit >= 0 ? "#10b981" : "#ef4444",
      borderTop: data.net_profit >= 0 ? "#10b981" : "#ef4444",
    },
  ];

  return (
    <div className="page-body" style={{ gap: 24 }}>
      {/* Top Welcome & Quick Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span>💎</span> Gemstone Vault & Trading Master
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 13 }}>
            High-precision packets, brokered deals, certification, and business evaluation.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-outline"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setShowScannerModal(true)}
          >
            <span>📷</span>
            <span>Scan Packet QR</span>
          </button>

          <button
            className="btn btn-outline"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => navigate("/brokerage")}
          >
            <span>🤝</span>
            <span>Log Brokerage</span>
          </button>

          <button
            className="btn btn-outline"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => navigate("/sales/new")}
          >
            <span>🧾</span>
            <span>New Sale</span>
          </button>

          <button
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => navigate("/purchases/new")}
          >
            <span>+</span>
            <span>Intake New Packet</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          gap: 14,
        }}
      >
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="gem-kpi-card"
            style={{ borderTop: `3px solid ${kpi.borderTop}` }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {kpi.label}
              </span>
              <span style={{ fontSize: 20 }}>{kpi.icon}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: kpi.color, marginTop: 4 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {kpi.subtitle}
            </div>
          </div>
        ))}
      </div>

      {/* Vault Inventory Packets Snapshot */}
      <div className="card" style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>📦</span> Active Vault Packets ({inStockPackets.length} in vault)
            </h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Individual packets with Carat weights, Pieces, MM sizes, and QR identification
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className="select"
              style={{ fontSize: 12, padding: "4px 8px" }}
              value={filterParticular}
              onChange={(e) => setFilterParticular(e.target.value)}
            >
              <option value="all">All Varieties</option>
              <option value="Emerald">Emeralds</option>
              <option value="Ruby">Rubies</option>
              <option value="Sapphire">Sapphires</option>
              <option value="Diamond">Diamonds</option>
              <option value="Tanzanite">Tanzanites</option>
            </select>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigate("/inventory")}
            >
              View All Packets →
            </button>
          </div>
        </div>

        {/* Packets Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {displayedPackets.map((pkt) => (
            <div
              key={pkt.id}
              className="gem-packet-card"
              style={{
                cursor: "pointer",
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
              onClick={() => setSelectedPacket(pkt)}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 900,
                      color: "var(--primary)",
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    {pkt.packet_number}
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>
                    {pkt.particulars}
                  </div>
                </div>
                <span className={`badge badge-${pkt.status}`}>
                  {pkt.status.replace("_", " ")}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  fontSize: 12,
                  background: "var(--surface-sunken)",
                  padding: "8px 10px",
                  borderRadius: 6,
                }}
              >
                <div>
                  <span style={{ color: "var(--muted)" }}>Weight:</span>{" "}
                  <strong>{pkt.weight} cts</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Pieces:</span>{" "}
                  <strong>{pkt.pieces} pcs</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Shape:</span>{" "}
                  <strong>{pkt.shape}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Size:</span>{" "}
                  <strong>{pkt.mm_size || "—"}</strong>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                  borderTop: "1px solid var(--border)",
                  paddingTop: 8,
                }}
              >
                <div>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>Ask: </span>
                  <strong style={{ color: "var(--success)" }}>
                    {formatINR(pkt.sale_price)}
                  </strong>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPacket(pkt);
                    }}
                    title="View QR Label"
                  >
                    🏷️ Label
                  </button>
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/sales/new?packet=${encodeURIComponent(pkt.packet_number)}`);
                    }}
                  >
                    💰 Sell
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-Column: Recent Gemstone Sales & Brokered Deals */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
        }}
      >
        {/* Recent Invoiced Sales */}
        <div className="card" style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                🧾 Recent Gemstone Sales
              </h3>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Latest sales orders & payment clearances
              </span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/sales")}
            >
              All Sales →
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentSales.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: "var(--surface-sunken)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                onClick={() => navigate(`/sales/${s.id}`)}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>
                    {s.buyer_name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {s.invoice_no} • {shortDate(s.date)} • {s.items.length} stone(s)
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "var(--primary)" }}>
                    {formatINR(s.total)}
                  </div>
                  <PayBadge status={s.payment_status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Brokered Transactions (Not in Inventory) */}
        <div className="card" style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                🤝 Third-Party Brokerage Deals
              </h3>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Direct broker commissions (not in stock)
              </span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/brokerage")}
            >
              All Brokerage →
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentBrokerage.map((b) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: "var(--surface-sunken)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                onClick={() => navigate("/brokerage")}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>
                    {b.particulars}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {b.seller_name} ➔ {b.buyer_name} ({b.brokerage_percent}% comm)
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "var(--success)" }}>
                    +{formatINR(b.commission_amount)}
                  </div>
                  <span
                    className={`badge badge-${
                      b.settlement_status === "received" ? "success" : "warning"
                    }`}
                    style={{ fontSize: 10 }}
                  >
                    {b.settlement_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Packet QR & Label Modal */}
      {selectedPacket && (
        <PacketQrModal
          packet={selectedPacket}
          open={!!selectedPacket}
          onClose={() => setSelectedPacket(null)}
        />
      )}

      {/* Scanner Modal */}
      <QrScannerModal
        open={showScannerModal}
        onClose={() => setShowScannerModal(false)}
      />
    </div>
  );
}
