import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../api";
import { Spinner, EmptyState, PayBadge } from "../ui";
import type { GemBuyer, GemSale, GemPurchase, GemBrokerage } from "../types/gemstone";
import { formatINR } from "../format";
import { useToast } from "../toast";

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
                    <tr key={party.id}>
                      {/* Name & Company */}
                      <td>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>{party.name}</div>
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
                        <span style={{ fontWeight: 700 }}>{party.transactionCount} transactions</span>
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
    </div>
  );
}
