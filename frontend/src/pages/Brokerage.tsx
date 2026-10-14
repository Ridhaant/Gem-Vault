import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import { Spinner, EmptyState } from "../ui";
import { formatINR, shortDate } from "../format";
import type { GemBrokerage, GemBuyer } from "../types/gemstone";
import { DEFAULT_COMPANIES } from "../types/gemstone";
import { useToast } from "../toast";

export default function Brokerage() {
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Partial<GemBrokerage> | null>(null);

  const { data: deals = [], isLoading } = useQuery<GemBrokerage[]>({
    queryKey: ["brokerage"],
    queryFn: () => apiGet("/brokerage"),
  });

  const { data: buyers = [] } = useQuery<GemBuyer[]>({
    queryKey: ["buyers"],
    queryFn: () => apiGet("/buyers"),
  });

  const updateDealWithRates = (
    current: Partial<GemBrokerage>,
    changes: Partial<GemBrokerage>
  ): Partial<GemBrokerage> => {
    const next = { ...current, ...changes };
    const wt = Number(next.weight) || 1;
    const buyRate = Number(next.buy_rate_per_unit) || 0;
    const sellRate = Number(next.sell_rate_per_unit) || 0;

    const buyAmt = Math.round(buyRate * wt);
    const sellAmt = Math.round(sellRate * wt);
    const comm = Math.max(0, sellAmt - buyAmt);
    const rec = Number(next.received_amount) || 0;
    const bal = Math.max(0, comm - rec);
    const status = bal === 0 && comm > 0 ? "received" : rec > 0 ? "partial" : "pending";

    return {
      ...next,
      buy_amount: buyAmt,
      sell_amount: sellAmt,
      deal_value: sellAmt,
      commission_amount: comm,
      balance_receivable: bal,
      settlement_status: status,
    };
  };

  const saveDealMutation = useMutation({
    mutationFn: (deal: any) =>
      deal.id ? apiPut(`/brokerage/${deal.id}`, deal) : apiPost("/brokerage", deal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokerage"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      setModalOpen(false);
      setEditingDeal(null);
      show("Brokerage deal saved & reflected in outside stock sales!", "success");
    },
    onError: (err: any) => show("Error saving deal: " + err.message, "error"),
  });

  const deleteDealMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/brokerage/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokerage"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Brokerage deal deleted", "info");
    },
    onError: (err: any) => show("Error deleting deal: " + err.message, "error"),
  });

  const totalPendingCommissions = deals.reduce((sum, d) => sum + (d.balance_receivable || 0), 0);
  const pendingDealsCount = deals.filter((d) => d.settlement_status !== "received").length;

  const filteredDeals = useMemo(() => {
    let result = [...deals];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.deal_no.toLowerCase().includes(q) ||
          d.seller_name.toLowerCase().includes(q) ||
          d.buyer_name.toLowerCase().includes(q) ||
          d.particulars.toLowerCase().includes(q) ||
          d.company_name?.toLowerCase().includes(q) ||
          d.notes?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((d) => d.settlement_status === statusFilter);
    }
    if (companyFilter !== "all") {
      result = result.filter((d) => d.company_name === companyFilter);
    }
    if (dateFilter) {
      result = result.filter((d) => d.date === dateFilter);
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [deals, searchTerm, statusFilter, companyFilter, dateFilter]);

  const handleAddNew = () => {
    const nextDealNo = `BRK-${new Date().getFullYear()}-${String(deals.length + 1).padStart(2, "0")}`;
    const initialWeight = 1.0;
    const initialBuyRate = 45000;
    const initialSellRate = 50000;
    setEditingDeal({
      deal_no: nextDealNo,
      date: new Date().toISOString().slice(0, 10),
      company_name: "Shreeji Gems",
      seller_name: "",
      buyer_name: "",
      particulars: "",
      shape: "Cushion",
      weight: initialWeight,
      unit: "cts",
      pieces: 1,
      buy_rate_per_unit: initialBuyRate,
      sell_rate_per_unit: initialSellRate,
      buy_amount: initialBuyRate * initialWeight,
      sell_amount: initialSellRate * initialWeight,
      deal_value: initialSellRate * initialWeight,
      brokerage_percent: 2.0,
      commission_amount: (initialSellRate - initialBuyRate) * initialWeight,
      settlement_status: "pending",
      received_amount: 0,
      balance_receivable: (initialSellRate - initialBuyRate) * initialWeight,
      payment_mode: "Bank Wire / NEFT",
      reflect_in_sales: true,
      notes: "",
    });
    setModalOpen(true);
  };

  const handleEdit = (d: GemBrokerage) => {
    const wt = d.weight > 0 ? d.weight : 1;
    const buyRate = d.buy_rate_per_unit || (d.buy_amount ? Math.round(d.buy_amount / wt) : 0);
    const sellRate = d.sell_rate_per_unit || (d.sell_amount ? Math.round(d.sell_amount / wt) : 0);
    setEditingDeal({
      ...d,
      buy_rate_per_unit: buyRate,
      sell_rate_per_unit: sellRate,
    });
    setModalOpen(true);
  };

  const handleMarkSettled = (d: GemBrokerage) => {
    saveDealMutation.mutate({
      ...d,
      settlement_status: "received",
      received_amount: d.commission_amount,
      balance_receivable: 0,
      settlement_date: new Date().toISOString().slice(0, 10),
    });
  };

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
            <span>🤝</span> Third-Party Brokerage (Outside Deals)
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 13 }}>
            Facilitated gemstone deals between external sellers & buyers with respective buy and sell amounts, reflected in sales as Outside Stock.
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleAddNew}>
          + Log Brokerage Deal
        </button>
      </div>

      {/* KPI Cards (Requirement: ONLY Pending Commissions kept) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {/* Pending Commissions Card */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Pending Commissions (Receivable)
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#f59e0b", marginTop: 4 }}>
            {formatINR(totalPendingCommissions)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Uncollected brokerage commissions from parties
          </div>
        </div>

        {/* Pending Deals Count */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #3b82f6" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Active Brokerage Settlements
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "var(--foreground)", marginTop: 4 }}>
            {pendingDealsCount} Pending Deals
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Total {deals.length} brokerage deals logged across all companies
          </div>
        </div>
      </div>

      {/* Filter Bar */}
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
            placeholder="Search deal #, seller, buyer, particulars..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Status:</label>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Settlements</option>
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="partial">Partial</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Company:</label>
          <select
            className="select"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="all">All Companies</option>
            {DEFAULT_COMPANIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>📅 Date:</label>
          <input
            type="date"
            className="input"
            style={{
              padding: "6px 10px",
              fontSize: 13,
              width: "auto",
              cursor: "pointer",
            }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            title="Filter deals conducted on a specific date"
          />
          {dateFilter && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              style={{ color: "#ef4444", fontWeight: 700, padding: "4px 8px" }}
              onClick={() => setDateFilter("")}
              title="Clear date filter"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Brokerage Table */}
      {isLoading ? (
        <Spinner />
      ) : filteredDeals.length === 0 ? (
        <EmptyState
          icon="🤝"
          title="No Brokerage Deals Found"
          description="Facilitate deals without holding inventory. Record seller, buyer, buy & sell amounts."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Deal # & Tag</th>
                  <th>Date</th>
                  <th>Company</th>
                  <th>Parties (Seller ➔ Buyer)</th>
                  <th>Particulars</th>
                  <th style={{ textAlign: "right" }}>Weight</th>
                  <th style={{ textAlign: "right" }}>Buy Amount (Seller)</th>
                  <th style={{ textAlign: "right" }}>Sell Amount (Buyer)</th>
                  <th style={{ textAlign: "right" }}>Commission Spread</th>
                  <th style={{ textAlign: "right" }}>Balance Receivable</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((d) => (
                  <tr key={d.id}>
                    {/* Deal # & Outside Tag */}
                    <td>
                      <div style={{ fontWeight: 800, color: "var(--primary)" }}>{d.deal_no}</div>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: "1px 4px",
                          borderRadius: 3,
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "#d97706",
                        }}
                      >
                        OUTSIDE STOCK
                      </span>
                    </td>

                    {/* Date */}
                    <td>{shortDate(d.date)}</td>

                    {/* Company */}
                    <td>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {d.company_name || "Shreeji Gems"}
                      </span>
                    </td>

                    {/* Parties */}
                    <td>
                      <div>
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>From: </span>
                        <strong>{d.seller_name}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>To: </span>
                        <strong>{d.buyer_name}</strong>
                      </div>
                    </td>

                    {/* Particulars */}
                    <td>
                      <div style={{ fontWeight: 600 }}>{d.particulars}</div>
                      {d.cert_lab && (
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>Lab: {d.cert_lab}</div>
                      )}
                    </td>

                    {/* Weight */}
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {d.weight} {d.unit || "cts"}
                    </td>

                    {/* Buy Amount */}
                    <td style={{ textAlign: "right", color: "var(--muted)" }}>
                      <div>{formatINR(d.buy_amount || 0)}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>
                        ₹{d.buy_rate_per_unit || (d.weight ? Math.round((d.buy_amount || 0) / d.weight) : 0)}/{d.unit || "ct"}
                      </div>
                    </td>

                    {/* Sell Amount */}
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      <div>{formatINR(d.sell_amount || d.deal_value || 0)}</div>
                      <div style={{ fontSize: 10, color: "var(--primary)" }}>
                        ₹{d.sell_rate_per_unit || (d.weight ? Math.round((d.sell_amount || d.deal_value || 0) / d.weight) : 0)}/{d.unit || "ct"}
                      </div>
                    </td>

                    {/* Commission Spread */}
                    <td style={{ textAlign: "right", fontWeight: 800, color: "#10b981" }}>
                      +{formatINR(d.commission_amount || 0)}
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>
                        ₹{(d.sell_rate_per_unit || 0) && (d.buy_rate_per_unit || 0) ? (d.sell_rate_per_unit! - d.buy_rate_per_unit!) : (d.weight ? Math.round((d.commission_amount || 0) / d.weight) : 0)}/{d.unit || "ct"} spread
                      </div>
                    </td>

                    {/* Balance Receivable */}
                    <td style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontWeight: 800,
                          color: d.balance_receivable > 0 ? "#ef4444" : "#10b981",
                        }}
                      >
                        {formatINR(d.balance_receivable)}
                      </span>
                    </td>

                    {/* Settlement Status */}
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={`badge ${
                          d.settlement_status === "received"
                            ? "badge-success"
                            : d.settlement_status === "partial"
                            ? "badge-warning"
                            : "badge-default"
                        }`}
                        style={{ fontSize: 10, textTransform: "uppercase" }}
                      >
                        {d.settlement_status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                        {d.settlement_status !== "received" && (
                          <button
                            className="btn btn-outline btn-xs"
                            style={{ color: "#10b981", fontSize: 10 }}
                            title="Mark commission fully settled"
                            onClick={() => handleMarkSettled(d)}
                          >
                            ✓ Clear
                          </button>
                        )}
                        <button className="btn btn-ghost btn-xs" onClick={() => handleEdit(d)} title="Edit deal">
                          ✏️
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ color: "#ef4444" }}
                          onClick={() => {
                            if (window.confirm(`Delete deal ${d.deal_no}?`)) {
                              deleteDealMutation.mutate(d.id);
                            }
                          }}
                          title="Delete deal"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Brokerage Deal (Requirement: enter buy and sell with amounts respectively) */}
      {modalOpen && editingDeal && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🤝</span> {editingDeal.id ? `Edit Deal: ${editingDeal.deal_no}` : "Log Third-Party Brokerage Deal"}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveDealMutation.mutate(editingDeal);
              }}
              style={{ padding: 20 }}
            >
              {/* Row 1: Deal No, Date, Company */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">Deal Reference #:</label>
                  <input
                    type="text"
                    className="input"
                    value={editingDeal.deal_no || ""}
                    onChange={(e) => setEditingDeal({ ...editingDeal, deal_no: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Deal Date:</label>
                  <input
                    type="date"
                    className="input"
                    value={editingDeal.date || ""}
                    onChange={(e) => setEditingDeal({ ...editingDeal, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Company (1 of 5):</label>
                  <select
                    className="select"
                    value={editingDeal.company_name || "Shreeji Gems"}
                    onChange={(e) => setEditingDeal({ ...editingDeal, company_name: e.target.value })}
                  >
                    {DEFAULT_COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Seller & Buyer with Saved Party Pickers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="label" style={{ margin: 0 }}>Seller (Party A / Supplier):*</label>
                    {buyers.length > 0 && (
                      <select
                        className="select"
                        style={{ fontSize: 10, padding: "1px 6px", height: 22, background: "var(--surface-sunken)" }}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setEditingDeal({ ...editingDeal, seller_name: e.target.value });
                          }
                        }}
                      >
                        <option value="">⚡ Quick Pick Seller...</option>
                        {buyers.map((b) => (
                          <option key={"s-" + b.id} value={b.name}>
                            {b.name} {b.city ? `• ${b.city}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Jaipur Royal Gems, Sri Lanka Exporters"
                    list="deal-sellers"
                    value={editingDeal.seller_name || ""}
                    onChange={(e) => setEditingDeal({ ...editingDeal, seller_name: e.target.value })}
                    required
                  />
                  <datalist id="deal-sellers">
                    {buyers.map((b) => (
                      <option key={"ds-" + b.id} value={b.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="label" style={{ margin: 0 }}>Buyer (Party B / Client):*</label>
                    {buyers.length > 0 && (
                      <select
                        className="select"
                        style={{ fontSize: 10, padding: "1px 6px", height: 22, background: "var(--surface-sunken)" }}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setEditingDeal({ ...editingDeal, buyer_name: e.target.value });
                          }
                        }}
                      >
                        <option value="">⚡ Quick Pick Buyer...</option>
                        {buyers.map((b) => (
                          <option key={"b-" + b.id} value={b.name}>
                            {b.name} {b.city ? `• ${b.city}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Kalyan Jewellers, Poddar Heritage"
                    list="deal-buyers"
                    value={editingDeal.buyer_name || ""}
                    onChange={(e) => setEditingDeal({ ...editingDeal, buyer_name: e.target.value })}
                    required
                  />
                  <datalist id="deal-buyers">
                    {buyers.map((b) => (
                      <option key={"db-" + b.id} value={b.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Row 3: Particulars & Lab */}
              <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">Stone / Parcel Particulars:*</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 8.50 ct Zambian Emerald Cushion (No Oil GRS)"
                    value={editingDeal.particulars || ""}
                    onChange={(e) => setEditingDeal({ ...editingDeal, particulars: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Certification Lab:</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. GRS, GIA, IGI"
                    value={editingDeal.cert_lab || ""}
                    onChange={(e) => setEditingDeal({ ...editingDeal, cert_lab: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 4: Weight, Unit, Shape, Pieces */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="label">Weight:*</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input"
                    value={editingDeal.weight || 1}
                    onChange={(e) => {
                      const wt = Math.max(0.01, Number(e.target.value) || 0.01);
                      setEditingDeal(updateDealWithRates(editingDeal, { weight: wt }));
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="label">Unit:</label>
                  <select
                    className="select"
                    value={editingDeal.unit || "cts"}
                    onChange={(e) => setEditingDeal({ ...editingDeal, unit: e.target.value as any })}
                  >
                    <option value="cts">Carats (cts)</option>
                    <option value="g">Grams (g)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Shape:</label>
                  <input
                    type="text"
                    className="input"
                    value={editingDeal.shape || "Cushion"}
                    onChange={(e) => setEditingDeal({ ...editingDeal, shape: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Pieces (pcs):</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={editingDeal.pieces || 1}
                    onChange={(e) => setEditingDeal({ ...editingDeal, pieces: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
              </div>

              {/* Row 5: Per-Carat Buy & Sell Rates (Requirement: entered ONLY per carat, all totals & commission calculate automatically!) */}
              <div
                style={{
                  background: "var(--surface)",
                  padding: 16,
                  borderRadius: 8,
                  border: "1.5px solid var(--primary)",
                  marginBottom: 16,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, color: "var(--primary)" }}>
                    <span>⚡</span> RATES ENTERED PER CARAT (Amounts & Commission Calculate Automatically)
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    Weight: <strong>{editingDeal.weight || 1} {editingDeal.unit || "cts"}</strong>
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
                  {/* Buy Rate per Carat Input */}
                  <div style={{ padding: 12, background: "var(--surface-sunken)", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <label className="label" style={{ margin: "0 0 4px", fontWeight: 700 }}>
                      Buy Rate (from Seller ₹/{editingDeal.unit || "ct"}):*
                    </label>
                    <input
                      type="number"
                      className="input"
                      style={{ fontSize: 14, fontWeight: 700 }}
                      placeholder="e.g. 40000"
                      value={editingDeal.buy_rate_per_unit ?? ""}
                      onChange={(e) => {
                        const rate = Number(e.target.value) || 0;
                        setEditingDeal(updateDealWithRates(editingDeal, { buy_rate_per_unit: rate }));
                      }}
                      required
                    />
                    <div style={{ marginTop: 6, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Total Buy Amount:</span>
                      <strong style={{ color: "var(--foreground)" }}>{formatINR(editingDeal.buy_amount || 0)}</strong>
                    </div>
                  </div>

                  {/* Sell Rate per Carat Input */}
                  <div style={{ padding: 12, background: "var(--surface-sunken)", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <label className="label" style={{ margin: "0 0 4px", fontWeight: 700 }}>
                      Sell Rate (to Buyer ₹/{editingDeal.unit || "ct"}):*
                    </label>
                    <input
                      type="number"
                      className="input"
                      style={{ fontSize: 14, fontWeight: 700 }}
                      placeholder="e.g. 45000"
                      value={editingDeal.sell_rate_per_unit ?? ""}
                      onChange={(e) => {
                        const rate = Number(e.target.value) || 0;
                        setEditingDeal(updateDealWithRates(editingDeal, { sell_rate_per_unit: rate }));
                      }}
                      required
                    />
                    <div style={{ marginTop: 6, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Total Deal Value:</span>
                      <strong style={{ color: "var(--primary)" }}>{formatINR(editingDeal.sell_amount || 0)}</strong>
                    </div>
                  </div>
                </div>

                {/* Live Auto-Calculated Margin and Commission Ribbon */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr 1.2fr",
                    gap: 10,
                    padding: 10,
                    background: "rgba(16, 185, 129, 0.08)",
                    borderRadius: 6,
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Per-Carat Margin</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>
                      ₹{Math.max(0, (editingDeal.sell_rate_per_unit || 0) - (editingDeal.buy_rate_per_unit || 0))}/{editingDeal.unit || "ct"}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Total Deal Value</div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>
                      {formatINR(editingDeal.deal_value || 0)}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Auto-Calculated Commission</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#059669" }}>
                      +{formatINR(editingDeal.commission_amount || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 6: Received Amount & Commission Settlement */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="label">Commission Collected (₹):</label>
                  <input
                    type="number"
                    className="input"
                    value={editingDeal.received_amount || 0}
                    onChange={(e) => {
                      const rec = Number(e.target.value) || 0;
                      const comm = editingDeal.commission_amount || 0;
                      setEditingDeal({
                        ...editingDeal,
                        received_amount: rec,
                        balance_receivable: Math.max(0, comm - rec),
                        settlement_status: rec >= comm ? "received" : rec > 0 ? "partial" : "pending",
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="label">Payment Mode:</label>
                  <select
                    className="select"
                    value={editingDeal.payment_mode || "Bank Wire / NEFT"}
                    onChange={(e) => setEditingDeal({ ...editingDeal, payment_mode: e.target.value })}
                  >
                    <option value="Bank Wire / NEFT">Bank Wire / NEFT</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Angadia">Angadia</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
              </div>

              {/* Checkbox: Reflect in normal sale tagged as outside stock */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={editingDeal.reflect_in_sales !== false}
                    onChange={(e) => setEditingDeal({ ...editingDeal, reflect_in_sales: e.target.checked })}
                  />
                  <span>
                    <strong>Reflect in Normal Sales list with Tag as [Outside Stock]</strong> (Tracks deal alongside vault sales)
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDeal.id ? "Update Deal" : "Save Brokerage Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
