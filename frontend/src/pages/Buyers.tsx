import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../api";
import { Spinner, EmptyState, PayBadge } from "../ui";
import type { GemBuyer, GemSale, GemPurchase, GemBrokerage } from "../types/gemstone";
import { formatINR } from "../format";
import { useToast } from "../toast";
import { printBuyerWiseLedgerReport, printSupplierPurchaseStatement } from "../statementPrint";

interface AggregatedParty {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  partyType: "buyer" | "seller" | "broker";
  totalTransacted: number;
  totalPaid: number;
  pendingBalance: number;
  paymentStatus: "cleared" | "partial" | "unpaid";
  transactionCount: number;
}

export default function Buyers() {
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [activeTab, setActiveTab] = useState<"all" | "buyers" | "sellers">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<AggregatedParty | null>(null);
  const [newBuyer, setNewBuyer] = useState<Partial<GemBuyer>>({
    name: "",
    company: "",
    phone: "",
    whatsapp: "",
    city: "Mumbai",
    address: "",
    notes: "",
  });

  // Queries
  const { data: buyers = [], isLoading: buyersLoading } = useQuery<GemBuyer[]>({
    queryKey: ["buyers"],
    queryFn: () => apiGet("/buyers"),
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery<GemSale[]>({
    queryKey: ["sales"],
    queryFn: () => apiGet("/sales"),
  });

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<GemPurchase[]>({
    queryKey: ["purchases"],
    queryFn: () => apiGet("/purchases"),
  });

  const { data: brokerage = [] } = useQuery<GemBrokerage[]>({
    queryKey: ["brokerage"],
    queryFn: () => apiGet("/brokerage"),
  });

  // Requirement: aggregate pending payments and payment status of buyer and sellers based on name
  const aggregatedParties = useMemo<AggregatedParty[]>(() => {
    const map: Record<string, AggregatedParty> = {};

    // 1. Aggregate Buyers from Sales
    sales.forEach((s) => {
      const name = s.buyer_name?.trim();
      if (!name) return;
      const key = `b_${name.toLowerCase()}`;
      if (!map[key]) {
        const buyerObj = buyers.find((b) => b.name.toLowerCase() === name.toLowerCase());
        map[key] = {
          id: key,
          name,
          company: buyerObj?.company,
          phone: s.buyer_phone || buyerObj?.phone,
          whatsapp: buyerObj?.whatsapp || s.buyer_phone,
          city: s.buyer_city || buyerObj?.city || "Mumbai",
          partyType: "buyer",
          totalTransacted: 0,
          totalPaid: 0,
          pendingBalance: 0,
          paymentStatus: "cleared",
          transactionCount: 0,
        };
      }
      map[key].totalTransacted += s.total || 0;
      map[key].totalPaid += s.paid_amount || 0;
      map[key].pendingBalance += s.balance || 0;
      map[key].transactionCount += 1;
    });

    // 2. Aggregate Sellers / Suppliers from Purchases
    purchases.forEach((p) => {
      const name = p.supplier_name?.trim();
      if (!name) return;
      const key = `s_${name.toLowerCase()}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          name,
          company: p.supplier_name,
          phone: p.supplier_phone,
          city: p.supplier_city || "Mine / Trade Center",
          partyType: "seller",
          totalTransacted: 0,
          totalPaid: 0,
          pendingBalance: 0,
          paymentStatus: "cleared",
          transactionCount: 0,
        };
      }
      map[key].totalTransacted += p.total_cost || 0;
      map[key].totalPaid += p.paid_amount || 0;
      map[key].pendingBalance += p.balance_payable || 0;
      map[key].transactionCount += 1;
    });

    // Determine aggregate payment status based on pending balance
    Object.values(map).forEach((party) => {
      if (party.pendingBalance <= 0) {
        party.paymentStatus = "cleared";
      } else if (party.totalPaid > 0) {
        party.paymentStatus = "partial";
      } else {
        party.paymentStatus = "unpaid";
      }
    });

    return Object.values(map);
  }, [sales, purchases, buyers]);

  const saveBuyerMutation = useMutation({
    mutationFn: (b: any) => apiPost("/buyers", b),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      setModalOpen(false);
      setNewBuyer({
        name: "",
        company: "",
        phone: "",
        whatsapp: "",
        city: "Mumbai",
        address: "",
        notes: "",
      });
      show("Client / Party saved successfully!", "success");
    },
    onError: (err: any) => show("Error saving client: " + err.message, "error"),
  });

  const filteredParties = useMemo(() => {
    let result = [...aggregatedParties];

    if (activeTab === "buyers") {
      result = result.filter((p) => p.partyType === "buyer");
    } else if (activeTab === "sellers") {
      result = result.filter((p) => p.partyType === "seller");
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => p.paymentStatus === statusFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.company?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.phone?.includes(q)
      );
    }

    return result.sort((a, b) => b.pendingBalance - a.pendingBalance);
  }, [aggregatedParties, activeTab, statusFilter, searchTerm]);

  // Aggregate stats
  const totalBuyerReceivables = useMemo(() => {
    return aggregatedParties
      .filter((p) => p.partyType === "buyer")
      .reduce((sum, p) => sum + p.pendingBalance, 0);
  }, [aggregatedParties]);

  const totalSellerPayables = useMemo(() => {
    return aggregatedParties
      .filter((p) => p.partyType === "seller")
      .reduce((sum, p) => sum + p.pendingBalance, 0);
  }, [aggregatedParties]);

  // Past Transactions for Selected Party Modal
  const selectedPartySales = useMemo(() => {
    if (!selectedParty || selectedParty.partyType !== "buyer") return [];
    const clean = selectedParty.name.trim().toLowerCase();
    return sales
      .filter((s) => (s.buyer_name || "").trim().toLowerCase() === clean)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [selectedParty, sales]);

  const selectedPartyPurchases = useMemo(() => {
    if (!selectedParty || selectedParty.partyType !== "seller") return [];
    const clean = selectedParty.name.trim().toLowerCase();
    return purchases
      .filter((p) => (p.supplier_name || "").trim().toLowerCase() === clean)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [selectedParty, purchases]);

  const selectedPartyBrokerage = useMemo(() => {
    if (!selectedParty) return [];
    const clean = selectedParty.name.trim().toLowerCase();
    return brokerage
      .filter(
        (b) =>
          (b.buyer_name || "").trim().toLowerCase() === clean ||
          (b.seller_name || "").trim().toLowerCase() === clean
      )
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [selectedParty, brokerage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuyer.name?.trim()) {
      show("Please enter party name", "warning");
      return;
    }
    saveBuyerMutation.mutate(newBuyer);
  };

  if (buyersLoading || salesLoading || purchasesLoading) return <Spinner />;

  return (
    <div className="page-body" style={{ gap: 20 }}>
      {/* Header */}
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
            <span>👥</span> Buyers & Sellers Financial Ledger
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 13 }}>
            Aggregated pending payments and payment settlement statuses of buyers (receivables) and sellers (payables) grouped by name.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          + Add New Client / Party
        </button>
      </div>

      {/* Aggregate KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {/* Buyer Receivables */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Total Buyer Receivables (Pending)
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#059669", marginTop: 4 }}>
            {formatINR(totalBuyerReceivables)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Unsettled payments owed to you by gemstone buyers
          </div>
        </div>

        {/* Seller Payables */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #ef4444" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Total Supplier Payables (Pending)
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#dc2626", marginTop: 4 }}>
            {formatINR(totalSellerPayables)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Outstanding balances payable to gem rough & cut suppliers
          </div>
        </div>

        {/* Net Settlement Balance */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #3b82f6" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Net Trade Credit Spread
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: totalBuyerReceivables >= totalSellerPayables ? "#10b981" : "#ef4444",
              marginTop: 4,
            }}
          >
            {formatINR(totalBuyerReceivables - totalSellerPayables)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Receivables minus payables across network
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        <button
          className={`btn btn-sm ${activeTab === "all" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("all")}
        >
          All Parties ({aggregatedParties.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === "buyers" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("buyers")}
        >
          🏪 Buyers & Clients ({aggregatedParties.filter((p) => p.partyType === "buyer").length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === "sellers" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("sellers")}
        >
          📥 Sellers & Suppliers ({aggregatedParties.filter((p) => p.partyType === "seller").length})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: "12px 16px",
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", flexGrow: 1, minWidth: 200 }}>
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
            }}
          >
            🔍
          </span>
          <input
            type="text"
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Search party name, company, city, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Payment Status:</label>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="unpaid">Unpaid / Pending</option>
            <option value="partial">Partial Payment</option>
            <option value="cleared">Fully Cleared</option>
          </select>
        </div>
      </div>

      {/* Aggregated Table */}
      {filteredParties.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No Matching Parties Found"
          description="Try adjusting your filters or record sales and purchases to populate party balances."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Party Name & Company</th>
                  <th>Type</th>
                  <th>Hub / City</th>
                  <th>Deals / Bills</th>
                  <th style={{ textAlign: "right" }}>Total Transacted (₹)</th>
                  <th style={{ textAlign: "right" }}>Total Cleared (₹)</th>
                  {/* Aggregated Pending Payments */}
                  <th style={{ textAlign: "right", background: "rgba(0,0,0,0.03)", fontWeight: 800 }}>
                    Pending Balance (₹)
                  </th>
                  {/* Aggregated Payment Status */}
                  <th style={{ textAlign: "center" }}>Payment Status</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {filteredParties.map((party) => {
                  const isBuyer = party.partyType === "buyer";
                  return (
                    <tr
                      key={party.id}
                      className="clickable"
                      onClick={() => setSelectedParty(party)}
                      style={{ cursor: "pointer" }}
                      title={`Click to view full transaction ledger for ${party.name}`}
                    >
                      {/* Name & Company */}
                      <td>
                        <div style={{ fontWeight: 800, fontSize: 13, color: "var(--primary)" }}>{party.name}</div>
                        {party.company && party.company !== party.name && (
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{party.company}</div>
                        )}
                      </td>

                      {/* Party Type Badge */}
                      <td>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                            background: isBuyer ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                            color: isBuyer ? "#059669" : "#dc2626",
                          }}
                        >
                          {isBuyer ? "BUYER / CLIENT" : "SELLER / SUPPLIER"}
                        </span>
                      </td>

                      {/* City */}
                      <td>
                        <span style={{ fontSize: 11 }}>{party.city || "Mumbai"}</span>
                      </td>

                      {/* Transaction Count */}
                      <td>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          style={{
                            fontWeight: 800,
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedParty(party);
                          }}
                          title="Click to view all past transactions"
                        >
                          👁️ {party.transactionCount} transactions
                        </button>
                      </td>

                      {/* Total Transacted */}
                      <td style={{ textAlign: "right" }}>{formatINR(party.totalTransacted)}</td>

                      {/* Total Cleared */}
                      <td style={{ textAlign: "right", color: "var(--muted)" }}>
                        {formatINR(party.totalPaid)}
                      </td>

                      {/* Pending Balance (Requirement!) */}
                      <td style={{ textAlign: "right", background: "rgba(0,0,0,0.03)" }}>
                        <span
                          style={{
                            fontWeight: 900,
                            fontSize: 13,
                            color:
                              party.pendingBalance > 0
                                ? isBuyer
                                  ? "#d97706"
                                  : "#dc2626"
                                : "#059669",
                          }}
                        >
                          {party.pendingBalance > 0 ? (
                            isBuyer ? (
                              <span>Due: {formatINR(party.pendingBalance)}</span>
                            ) : (
                              <span>Payable: {formatINR(party.pendingBalance)}</span>
                            )
                          ) : (
                            "₹0 (Settled)"
                          )}
                        </span>
                      </td>

                      {/* Payment Status Badge (Requirement!) */}
                      <td style={{ textAlign: "center" }}>
                        <PayBadge status={party.paymentStatus} />
                      </td>

                      {/* Contact */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11 }}>{party.phone || "—"}</span>
                          {party.whatsapp && (
                            <a
                              href={`https://wa.me/${party.whatsapp.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Chat on WhatsApp"
                              style={{ textDecoration: "none" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              💬
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add New Client / Party */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Add Client / Party to Directory</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label className="label">Full Name:</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Ramesh Bhai Zaveri, Poddar Jewels"
                  value={newBuyer.name || ""}
                  onChange={(e) => setNewBuyer({ ...newBuyer, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label className="label">Company / Firm Name:</label>
                  <input
                    type="text"
                    className="input"
                    value={newBuyer.company || ""}
                    onChange={(e) => setNewBuyer({ ...newBuyer, company: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">City / Trade Center:</label>
                  <input
                    type="text"
                    className="input"
                    value={newBuyer.city || "Mumbai"}
                    onChange={(e) => setNewBuyer({ ...newBuyer, city: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label className="label">Phone Number:</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="+91 98200 00000"
                    value={newBuyer.phone || ""}
                    onChange={(e) => setNewBuyer({ ...newBuyer, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">WhatsApp Number:</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="+91 98200 00000"
                    value={newBuyer.whatsapp || ""}
                    onChange={(e) => setNewBuyer({ ...newBuyer, whatsapp: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label">Notes / Preferences:</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Loose sapphire preferences, credit term history..."
                  value={newBuyer.notes || ""}
                  onChange={(e) => setNewBuyer({ ...newBuyer, notes: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Full Past Transaction Dossier for Selected Party */}
      {selectedParty && (
        <div className="modal-backdrop" onClick={() => setSelectedParty(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: 880, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 26 }}>
                  {selectedParty.partyType === "buyer" ? "👤" : "🏢"}
                </span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{selectedParty.name}</h3>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: 4,
                        textTransform: "uppercase",
                        background:
                          selectedParty.partyType === "buyer"
                            ? "rgba(16, 185, 129, 0.12)"
                            : "rgba(239, 68, 68, 0.12)",
                        color: selectedParty.partyType === "buyer" ? "#059669" : "#dc2626",
                      }}
                    >
                      {selectedParty.partyType === "buyer" ? "BUYER / CLIENT" : "SELLER / SUPPLIER"}
                    </span>
                    <PayBadge status={selectedParty.paymentStatus} />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 2,
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {selectedParty.company && selectedParty.company !== selectedParty.name && (
                      <span>🏢 {selectedParty.company}</span>
                    )}
                    <span>📍 {selectedParty.city || "Mumbai"}</span>
                    {selectedParty.phone && <span>📞 {selectedParty.phone}</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {selectedParty.partyType === "buyer" ? (
                  <button
                    type="button"
                    className="btn btn-xs btn-primary"
                    style={{ fontWeight: 800 }}
                    onClick={() => printBuyerWiseLedgerReport(sales, selectedParty.name)}
                    title="Print full statement"
                  >
                    🖨️ Print Statement
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-xs btn-primary"
                    style={{ fontWeight: 800 }}
                    onClick={() => printSupplierPurchaseStatement(selectedPartyPurchases)}
                    title="Print supplier purchase statement"
                  >
                    🖨️ Print Statement
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedParty(null)}>
                  ✕
                </button>
              </div>
            </div>

            <div
              style={{
                padding: "16px 20px",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Financial KPI Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    padding: 12,
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Total Transacted</div>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 4 }}>
                    {formatINR(selectedParty.totalTransacted)}
                  </div>
                </div>
                <div
                  style={{
                    padding: 12,
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Total Cleared</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#10b981", marginTop: 4 }}>
                    {formatINR(selectedParty.totalPaid)}
                  </div>
                </div>
                <div
                  style={{
                    padding: 12,
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
                    {selectedParty.partyType === "buyer" ? "Pending Receivable" : "Pending Payable"}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 900,
                      color:
                        selectedParty.pendingBalance > 0
                          ? selectedParty.partyType === "buyer"
                            ? "#d97706"
                            : "#dc2626"
                          : "#10b981",
                      marginTop: 4,
                    }}
                  >
                    {formatINR(selectedParty.pendingBalance)}
                  </div>
                </div>
                <div
                  style={{
                    padding: 12,
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Total Deals / Bills</div>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 4 }}>
                    {selectedParty.transactionCount} Record{selectedParty.transactionCount > 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Transactions Table for Buyer */}
              {selectedParty.partyType === "buyer" && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 8px 0", color: "var(--on-surface)" }}>
                    📜 Past Sales & Approval Memo Transactions ({selectedPartySales.length})
                  </h4>
                  {selectedPartySales.length === 0 ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign: "center",
                        color: "var(--muted)",
                        border: "1px dashed var(--border)",
                        borderRadius: 8,
                      }}
                    >
                      No sales or approval records found for this buyer.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                      <table className="table" style={{ width: "100%", fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ background: "var(--surface-sunken)" }}>
                            <th>Date</th>
                            <th>Invoice / Ref #</th>
                            <th>Type</th>
                            <th>Stones & Items</th>
                            <th style={{ textAlign: "right" }}>Pcs</th>
                            <th style={{ textAlign: "right" }}>Weight</th>
                            <th style={{ textAlign: "right" }}>Total (₹)</th>
                            <th style={{ textAlign: "right" }}>Paid (₹)</th>
                            <th style={{ textAlign: "right" }}>Balance (₹)</th>
                            <th style={{ textAlign: "center" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPartySales.map((sale) => {
                            const isMemo = sale.is_approval && sale.approval_status !== "approved_billed";
                            const isSettledMemo = sale.approval_status === "approved_billed";
                            const isReturned = sale.approval_status === "returned";
                            const itemsText = (sale.items || [])
                              .map((it) => `${it.packet_number || "pkt"}: ${it.particulars || "Gemstone"}`)
                              .join("; ");
                            const totalPcs = (sale.items || []).reduce(
                              (sum, it) => sum + (it.pieces_taken !== undefined ? it.pieces_taken : (it.pieces || 0)),
                              0
                            );
                            const totalWt = (sale.items || []).reduce(
                              (sum, it) => sum + (it.weight_taken || it.weight || 0),
                              0
                            );

                            return (
                              <tr key={sale.id || sale.invoice_no}>
                                <td style={{ whiteSpace: "nowrap" }}>{sale.date || "—"}</td>
                                <td style={{ fontWeight: 800, color: "var(--brand)" }}>{sale.invoice_no}</td>
                                <td>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 800,
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      background: isMemo
                                        ? "rgba(245, 158, 11, 0.15)"
                                        : isReturned
                                        ? "rgba(192, 38, 211, 0.15)"
                                        : "rgba(16, 185, 129, 0.15)",
                                      color: isMemo ? "#d97706" : isReturned ? "#c026d3" : "#059669",
                                    }}
                                  >
                                    {isMemo ? "MEMO" : isSettledMemo ? "SETTLED MEMO" : isReturned ? "RETURNED" : "SALE"}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    maxWidth: 220,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={itemsText}
                                >
                                  {itemsText || "—"}
                                </td>
                                <td style={{ textAlign: "right" }}>{totalPcs > 0 ? totalPcs : "—"}</td>
                                <td style={{ textAlign: "right" }}>{totalWt > 0 ? `${totalWt.toFixed(2)} ct` : "—"}</td>
                                <td style={{ textAlign: "right", fontWeight: 700 }}>{formatINR(sale.total || 0)}</td>
                                <td style={{ textAlign: "right", color: "#10b981" }}>{formatINR(sale.paid_amount || 0)}</td>
                                <td
                                  style={{
                                    textAlign: "right",
                                    fontWeight: 800,
                                    color: (sale.balance || 0) > 0 ? "#d97706" : "var(--muted)",
                                  }}
                                >
                                  {formatINR(sale.balance || 0)}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <PayBadge
                                    status={sale.payment_status || (sale.balance === 0 ? "cleared" : "unpaid")}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Transactions Table for Seller */}
              {selectedParty.partyType === "seller" && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 8px 0", color: "var(--on-surface)" }}>
                    📦 Purchase Vouchers & Lots Received ({selectedPartyPurchases.length})
                  </h4>
                  {selectedPartyPurchases.length === 0 ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign: "center",
                        color: "var(--muted)",
                        border: "1px dashed var(--border)",
                        borderRadius: 8,
                      }}
                    >
                      No purchase vouchers found for this supplier.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                      <table className="table" style={{ width: "100%", fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ background: "var(--surface-sunken)" }}>
                            <th>Date</th>
                            <th>Voucher #</th>
                            <th>Lot Ref</th>
                            <th>Packets / Stones</th>
                            <th style={{ textAlign: "right" }}>Total Cost (₹)</th>
                            <th style={{ textAlign: "right" }}>Paid (₹)</th>
                            <th style={{ textAlign: "right" }}>Payable Balance (₹)</th>
                            <th>Payment Terms</th>
                            <th style={{ textAlign: "center" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPartyPurchases.map((pur) => {
                            const pktsText = (pur.items || [])
                              .map(
                                (it) =>
                                  `${it.packet_number || "pkt"} (${it.weight || 0}ct ${it.particulars || ""})`
                              )
                              .join("; ");
                            const isPaid = (pur.balance_payable || 0) <= 0;
                            return (
                              <tr key={pur.id || pur.purchase_no}>
                                <td style={{ whiteSpace: "nowrap" }}>{pur.date || "—"}</td>
                                <td style={{ fontWeight: 800, color: "var(--brand)" }}>{pur.purchase_no}</td>
                                <td>{pur.lot_ref || "—"}</td>
                                <td
                                  style={{
                                    maxWidth: 220,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={pktsText}
                                >
                                  {pktsText || "—"}
                                </td>
                                <td style={{ textAlign: "right", fontWeight: 700 }}>{formatINR(pur.total_cost || 0)}</td>
                                <td style={{ textAlign: "right", color: "#10b981" }}>{formatINR(pur.paid_amount || 0)}</td>
                                <td
                                  style={{
                                    textAlign: "right",
                                    fontWeight: 800,
                                    color: (pur.balance_payable || 0) > 0 ? "#dc2626" : "var(--muted)",
                                  }}
                                >
                                  {formatINR(pur.balance_payable || 0)}
                                </td>
                                <td>{pur.credit_days ? `${pur.credit_days} days credit` : "Cash / Immediate"}</td>
                                <td style={{ textAlign: "center" }}>
                                  <PayBadge
                                    status={
                                      isPaid ? "cleared" : (pur.paid_amount || 0) > 0 ? "partial" : "unpaid"
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Brokerage Deals Section if applicable */}
              {selectedPartyBrokerage.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 8px 0", color: "var(--on-surface)" }}>
                    🤝 Third-Party Brokerage Deals ({selectedPartyBrokerage.length})
                  </h4>
                  <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <table className="table" style={{ width: "100%", fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: "var(--surface-sunken)" }}>
                          <th>Date</th>
                          <th>Deal #</th>
                          <th>Counterparty</th>
                          <th>Particulars</th>
                          <th style={{ textAlign: "right" }}>Deal Value (₹)</th>
                          <th style={{ textAlign: "right" }}>Commission (₹)</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPartyBrokerage.map((deal) => {
                          const otherParty =
                            selectedParty.partyType === "buyer" ? deal.seller_name : deal.buyer_name;
                          return (
                            <tr key={deal.id || deal.deal_no}>
                              <td>{deal.date || "—"}</td>
                              <td style={{ fontWeight: 800 }}>{deal.deal_no}</td>
                              <td>{otherParty || "—"}</td>
                              <td>
                                {deal.particulars} ({deal.weight} {deal.unit})
                              </td>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>
                                {formatINR(deal.deal_value || 0)}
                              </td>
                              <td style={{ textAlign: "right", color: "#10b981" }}>
                                {formatINR(deal.commission_amount || 0)}
                              </td>
                              <td>{deal.settlement_status || "pending"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div
              className="modal-footer"
              style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end" }}
            >
              <button type="button" className="btn btn-outline" onClick={() => setSelectedParty(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
