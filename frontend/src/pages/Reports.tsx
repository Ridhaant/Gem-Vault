import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api";
import { Spinner } from "../ui";
import { formatINR, formatINRCompact, shortDate } from "../format";
import type { OverallAnalytics } from "../gemstoneStorage";
import { DEFAULT_COMPANIES } from "../types/gemstone";
import type { SaleLedgerItem } from "../types/gemstone";
import { verifyAnalyticsPassword } from "../gemstoneStorage";
import { useToast } from "../toast";

export default function Reports() {
  const { show } = useToast();

  // Password Lock State (Requirement: password for profit analytics, password: 2014)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem("gemvault_analytics_unlocked") === "true";
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Timeframe Base Toggle (Requirement: option to change base from weekly to monthly and vice versa)
  const [timeBase, setTimeBase] = useState<"monthly" | "weekly">("monthly");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<
    "pnl" | "sales_ledger" | "balance_sheet" | "companies" | "varieties" | "vault" | "expenses" | "buyers"
  >("sales_ledger");

  // Filter state for Itemized Sales Ledger
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<"all" | "direct_sale" | "brokerage_deal">("all");
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<"all" | "cleared" | "partial" | "unpaid">("all");
  const [ledgerSort, setLedgerSort] = useState<"date_desc" | "date_asc" | "amount_desc" | "profit_desc" | "balance_desc">("date_desc");

  const { data, isLoading, isError, refetch } = useQuery<OverallAnalytics>({
    queryKey: ["analytics_overview", selectedCompany],
    queryFn: () => apiGet(`/analytics?company=${encodeURIComponent(selectedCompany)}`),
    enabled: isUnlocked,
  });

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAnalyticsPassword(passwordInput)) {
      setIsUnlocked(true);
      sessionStorage.setItem("gemvault_analytics_unlocked", "true");
      setPasswordError(false);
      setPasswordInput("");
      show("Profit Analytics unlocked", "success");
    } else {
      setPasswordError(true);
      show("Incorrect password. Please try again.", "error");
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem("gemvault_analytics_unlocked");
    setPasswordInput("");
    show("Profit Analytics locked", "info");
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered & Sorted Sales Ledger
  const filteredLedger = useMemo(() => {
    if (!data?.sales_ledger) return [];
    let list = [...data.sales_ledger];
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      list = list.filter(
        (it) =>
          it.invoice_or_deal_no.toLowerCase().includes(q) ||
          it.buyer_name.toLowerCase().includes(q) ||
          (it.seller_name && it.seller_name.toLowerCase().includes(q)) ||
          it.particulars_summary.toLowerCase().includes(q) ||
          it.company_name.toLowerCase().includes(q)
      );
    }
    if (ledgerTypeFilter !== "all") {
      list = list.filter((it) => it.transaction_type === ledgerTypeFilter);
    }
    if (ledgerStatusFilter !== "all") {
      list = list.filter((it) => it.payment_status === ledgerStatusFilter);
    }
    if (ledgerSort === "date_asc") {
      list.sort((a, b) => a.date.localeCompare(b.date));
    } else if (ledgerSort === "amount_desc") {
      list.sort((a, b) => b.sale_amount - a.sale_amount);
    } else if (ledgerSort === "profit_desc") {
      list.sort((a, b) => b.gross_profit - a.gross_profit);
    } else if (ledgerSort === "balance_desc") {
      list.sort((a, b) => b.balance_due - a.balance_due);
    } else {
      list.sort((a, b) => b.date.localeCompare(a.date));
    }
    return list;
  }, [data?.sales_ledger, ledgerSearch, ledgerTypeFilter, ledgerStatusFilter, ledgerSort]);

  // Aggregated Ledger Summary
  const ledgerTotals = useMemo(() => {
    const list = filteredLedger;
    return {
      count: list.length,
      saleAmount: list.reduce((s, it) => s + it.sale_amount, 0),
      cogsAmount: list.reduce((s, it) => s + it.cogs_amount, 0),
      grossProfit: list.reduce((s, it) => s + it.gross_profit, 0),
      paidAmount: list.reduce((s, it) => s + it.paid_amount, 0),
      balanceDue: list.reduce((s, it) => s + it.balance_due, 0),
    };
  }, [filteredLedger]);

  // Render Password Lock Screen if not unlocked
  if (!isUnlocked) {
    return (
      <div
        className="page-body"
        style={{
          minHeight: "75vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: 420,
            width: "100%",
            padding: 32,
            textAlign: "center",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            border: "1.5px solid var(--border)",
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 16px",
            }}
          >
            🔒
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 6px" }}>
            Profit & Analytics Protected
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 20px" }}>
            Enter your 4-digit master security PIN to view executive profit waterfall, margins, sale balance sheets, and valuation.
          </p>

          <form onSubmit={handleUnlock}>
            <div style={{ marginBottom: 16 }}>
              <input
                type="password"
                className="input"
                style={{
                  fontSize: 22,
                  textAlign: "center",
                  letterSpacing: 6,
                  fontWeight: 900,
                  borderColor: passwordError ? "#ef4444" : undefined,
                }}
                placeholder="••••"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                autoFocus
                maxLength={10}
              />
              {passwordError && (
                <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                  ⚠️ Invalid PIN. Please re-enter.
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "10px" }}>
              🔓 Unlock Financial Statements
            </button>
          </form>

          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 16 }}>
            Privacy guaranteed • 100% offline & stored locally
          </div>
        </div>
      </div>
    );
  }

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
          <h3>Failed to load analytics</h3>
          <button className="btn btn-primary btn-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const activePnlList = timeBase === "monthly" ? data.monthly_pnl : data.weekly_pnl;

  return (
    <div className="page-body report-print-container" style={{ gap: 20 }}>
      {/* Print-Only Header */}
      <div className="print-only report-print-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #0f172a", paddingBottom: 6, marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, color: "#0f172a" }}>
              💎 SHREEJI GEMS &amp; ASSOCIATES — PROFIT, SALES &amp; BALANCE SHEET
            </h2>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              Entity Scope: <strong>{selectedCompany === "all" ? "All 5 Companies (Consolidated)" : selectedCompany}</strong> • Timeline Base: <strong>{timeBase === "monthly" ? "Monthly" : "Weekly"}</strong>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: "#64748b" }}>
            <div>Date: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>Executive Financial Evaluation</div>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div
        className="hide-print"
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
            <span>📈</span> Executive Profit, Sales Ledger &amp; Balance Sheet
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 13 }}>
            Full in-depth evaluation: Itemized Sales with Receivables, Brokerage as Sales, Purchase Brokerage in Expenses &amp; Balance Sheet.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Company Filter Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Company:</label>
            <select
              className="select"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              <option value="all">All 5 Companies (Consolidated)</option>
              {DEFAULT_COMPANIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button className="btn btn-outline btn-sm hide-print" onClick={handlePrint}>
            🖨️ Print Report
          </button>

          <button className="btn btn-ghost btn-sm" onClick={handleLock} title="Lock this section immediately">
            🔒 Lock
          </button>
        </div>
      </div>

      {/* Primary KPI Ribbon */}
      <div
        className="report-kpi-ribbon"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
        }}
      >
        {/* 1. Net Sales Revenue (Consolidated Direct + Brokerage) */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #2563eb" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Net Sales Revenue
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#2563eb", marginTop: 4 }}>
            {formatINR(data.total_sales_revenue)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Direct: {formatINR(data.direct_sales_revenue || 0)} • Brokerage Deals: {formatINR(data.brokerage_deals_revenue || 0)}
          </div>
        </div>

        {/* 2. Gross Trading Profit */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Gross Trading Profit
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--success)", marginTop: 4 }}>
            {formatINR(data.gross_profit)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            COGS: {formatINR(data.total_cogs)} • {data.gross_margin_pct}% Margin
          </div>
        </div>

        {/* 3. Middleman Purchase Brokerage */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Purchase Brokerage
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#8b5cf6", marginTop: 4 }}>
            -{formatINR(data.purchase_brokerage_incurred || 0)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Paid: {formatINR(data.purchase_brokerage_paid || 0)} • Due: {formatINR(data.purchase_brokerage_pending || 0)}
          </div>
        </div>

        {/* 4. Total Operating Expenses */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #ef4444" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Total Operating Expenses
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#dc2626", marginTop: 4 }}>
            -{formatINR(data.total_expenses)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Overheads: {formatINR(data.direct_overheads || 0)} • Pur Brokerage: {formatINR(data.purchase_brokerage_incurred || 0)}
          </div>
        </div>

        {/* 5. NET Business Profit */}
        <div
          className="gem-kpi-card"
          style={{
            borderTop: "3px solid #059669",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.1) 100%)",
          }}
        >
          <div style={{ fontSize: 11, color: "#047857", textTransform: "uppercase", fontWeight: 800 }}>
            ★ NET BUSINESS PROFIT
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: data.net_profit >= 0 ? "#065f46" : "#ef4444",
              marginTop: 4,
            }}
          >
            {formatINR(data.net_profit)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Net Margin: {data.net_margin_pct}% after all operations
          </div>
        </div>

        {/* 6. Net Business Worth (Balance Sheet) */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Net Business Worth
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#d97706", marginTop: 4 }}>
            {formatINR(data.balance_sheet?.equity?.net_worth || 0)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Assets: {formatINR(data.balance_sheet?.assets?.total_assets || 0)} • Liab: -{formatINR(data.balance_sheet?.liabilities?.total_liabilities || 0)}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="hide-print" style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8, flexWrap: "wrap" }}>
        <button
          className={`btn btn-sm ${activeTab === "sales_ledger" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("sales_ledger")}
        >
          📑 Itemized Sales &amp; Balance Ledger ({data.sales_ledger?.length || 0})
        </button>
        <button
          className={`btn btn-sm ${activeTab === "balance_sheet" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("balance_sheet")}
        >
          ⚖️ Detailed Balance Sheet
        </button>
        <button
          className={`btn btn-sm ${activeTab === "pnl" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("pnl")}
        >
          📅 P&amp;L Financial Statement &amp; Timeline
        </button>
        <button
          className={`btn btn-sm ${activeTab === "companies" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("companies")}
        >
          🏢 5 Companies Breakdown
        </button>
        <button
          className={`btn btn-sm ${activeTab === "varieties" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("varieties")}
        >
          💎 Gemstone Varieties
        </button>
        <button
          className={`btn btn-sm ${activeTab === "vault" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("vault")}
        >
          📦 Vault Valuation
        </button>
        <button
          className={`btn btn-sm ${activeTab === "expenses" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("expenses")}
        >
          💳 Operating Expenses &amp; Purchase Brokerage
        </button>
        <button
          className={`btn btn-sm ${activeTab === "buyers" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("buyers")}
        >
          👥 Top Buyers Leaderboard
        </button>
      </div>

      {/* TAB 1: Itemized Sales & Balance Sheet Ledger (SHOW EACH SALE WITH BALANCE SHEET IN DETAIL) */}
      {activeTab === "sales_ledger" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📑</span> Itemized Sales &amp; Balance Sheet Position Ledger
                </h3>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Every confirmed direct vault sale and outside brokerage deal listed with cost, profit margin, amount received, and outstanding accounts receivable.
                </div>
              </div>

              {/* Filters & Search */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="text"
                  className="input input-sm"
                  style={{ width: 190 }}
                  placeholder="🔍 Search buyer, ref, item..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                />

                <select
                  className="select select-sm"
                  value={ledgerTypeFilter}
                  onChange={(e) => setLedgerTypeFilter(e.target.value as any)}
                >
                  <option value="all">All Deals &amp; Sales</option>
                  <option value="direct_sale">Own Vault Sales Only</option>
                  <option value="brokerage_deal">Brokerage Deals Only</option>
                </select>

                <select
                  className="select select-sm"
                  value={ledgerStatusFilter}
                  onChange={(e) => setLedgerStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Payment Status</option>
                  <option value="cleared">Cleared (Fully Paid)</option>
                  <option value="partial">Partial Payment</option>
                  <option value="unpaid">Unpaid (Full Debt)</option>
                </select>

                <select
                  className="select select-sm"
                  value={ledgerSort}
                  onChange={(e) => setLedgerSort(e.target.value as any)}
                >
                  <option value="date_desc">Latest Date First</option>
                  <option value="date_asc">Oldest Date First</option>
                  <option value="amount_desc">Highest Sale Value</option>
                  <option value="profit_desc">Highest Gross Profit</option>
                  <option value="balance_desc">Highest Balance Due</option>
                </select>
              </div>
            </div>

            {/* Ledger Metric Summary Bar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                background: "var(--surface-sunken)",
                padding: 12,
                borderRadius: 8,
                border: "1px solid var(--border)",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Filtered Transactions</div>
                <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2 }}>{ledgerTotals.count} Deals</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Total Sale Value</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#2563eb", marginTop: 2 }}>{formatINR(ledgerTotals.saleAmount)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Procurement COGS</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#64748b", marginTop: 2 }}>{formatINR(ledgerTotals.cogsAmount)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Gross Profit Generated</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#10b981", marginTop: 2 }}>{formatINR(ledgerTotals.grossProfit)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Cash / Payments Received</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#059669", marginTop: 2 }}>{formatINR(ledgerTotals.paidAmount)}</div>
              </div>
              <div style={{ background: ledgerTotals.balanceDue > 0 ? "rgba(239, 68, 68, 0.08)" : undefined, padding: "2px 8px", borderRadius: 4 }}>
                <div style={{ fontSize: 11, color: ledgerTotals.balanceDue > 0 ? "#dc2626" : "var(--muted)", fontWeight: 700 }}>
                  Balance Due (Receivable)
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: ledgerTotals.balanceDue > 0 ? "#ef4444" : "#10b981", marginTop: 2 }}>
                  {formatINR(ledgerTotals.balanceDue)}
                </div>
              </div>
            </div>

            {/* Ledger Table */}
            {filteredLedger.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                No sale or brokerage transactions match the selected filters.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Date &amp; Ref #</th>
                      <th>Type</th>
                      <th>Company &amp; Counterparty</th>
                      <th>Gemstone Particulars</th>
                      <th style={{ textAlign: "right" }}>Weight / Pcs</th>
                      <th style={{ textAlign: "right" }}>Sale Revenue (₹)</th>
                      <th style={{ textAlign: "right" }}>Cost (COGS) (₹)</th>
                      <th style={{ textAlign: "right" }}>Gross Profit (₹)</th>
                      <th style={{ textAlign: "right" }}>Collected (₹)</th>
                      <th style={{ textAlign: "right", fontWeight: 800 }}>Balance Due (Debt) (₹)</th>
                      <th style={{ textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((row) => {
                      const isBrokerage = row.transaction_type === "brokerage_deal";
                      return (
                        <tr key={row.id}>
                          <td>
                            <div style={{ fontWeight: 800 }}>{row.invoice_or_deal_no}</div>
                            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{row.date}</div>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: isBrokerage ? "rgba(139, 92, 246, 0.12)" : "rgba(37, 99, 235, 0.12)",
                                color: isBrokerage ? "#7c3aed" : "#1d4ed8",
                                border: `1px solid ${isBrokerage ? "rgba(139, 92, 246, 0.3)" : "rgba(37, 99, 235, 0.3)"}`,
                              }}
                            >
                              {isBrokerage ? "Brokerage Deal" : "Vault Sale"}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{row.buyer_name}</div>
                            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                              {row.company_name} {isBrokerage && row.seller_name ? `• Seller: ${row.seller_name}` : ""}
                            </div>
                          </td>
                          <td style={{ maxWidth: 220 }}>
                            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.particulars_summary}>
                              {row.particulars_summary}
                            </div>
                            {row.notes && (
                              <div style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>
                                {row.notes}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div>{row.weight} {row.unit}</div>
                            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{row.pieces} pcs</div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#2563eb" }}>
                            {formatINR(row.sale_amount)}
                          </td>
                          <td style={{ textAlign: "right", color: "var(--muted)" }}>
                            {formatINR(row.cogs_amount)}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800, color: row.gross_profit >= 0 ? "#10b981" : "#ef4444" }}>
                            <div>{formatINR(row.gross_profit)}</div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)" }}>{row.margin_pct}%</div>
                          </td>
                          <td style={{ textAlign: "right", color: "#059669", fontWeight: 600 }}>
                            {formatINR(row.paid_amount)}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 900 }}>
                            <span style={{ color: row.balance_due > 0 ? "#ef4444" : "#10b981" }}>
                              {formatINR(row.balance_due)}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                textTransform: "uppercase",
                                padding: "2px 8px",
                                borderRadius: 12,
                                background:
                                  row.payment_status === "cleared"
                                    ? "rgba(16, 185, 129, 0.12)"
                                    : row.payment_status === "partial"
                                    ? "rgba(245, 158, 11, 0.12)"
                                    : "rgba(239, 68, 68, 0.12)",
                                color:
                                  row.payment_status === "cleared"
                                    ? "#059669"
                                    : row.payment_status === "partial"
                                    ? "#d97706"
                                    : "#dc2626",
                                border: `1px solid ${
                                  row.payment_status === "cleared"
                                    ? "rgba(16, 185, 129, 0.3)"
                                    : row.payment_status === "partial"
                                    ? "rgba(245, 158, 11, 0.3)"
                                    : "rgba(239, 68, 68, 0.3)"
                                }`,
                              }}
                            >
                              {row.payment_status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Detailed Balance Sheet (ASSETS vs LIABILITIES & NET WORTH) */}
      {activeTab === "balance_sheet" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Executive Header Banner */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⚖️</span> Official Business Balance Sheet Statement
                </h3>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Comprehensive double-entry financial position as of {data.balance_sheet?.as_of_date || new Date().toISOString().slice(0, 10)} for {selectedCompany === "all" ? "All 5 Companies (Consolidated)" : selectedCompany}.
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Working Capital Ratio</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#2563eb" }}>
                    {data.balance_sheet?.equity?.current_ratio || 0} : 1
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Net Working Capital</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#10b981" }}>
                    {formatINR(data.balance_sheet?.equity?.working_capital || 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Two-Column Double-Entry Balance Sheet Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
              {/* LEFT COLUMN: ASSETS */}
              <div style={{ background: "var(--surface-sunken)", padding: 18, borderRadius: 8, border: "1.5px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2563eb", paddingBottom: 8, marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#2563eb", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    1. BUSINESS ASSETS (What You Own)
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#2563eb" }}>
                    {formatINR(data.balance_sheet?.assets?.total_assets || 0)}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
                  {/* Current Assets Section */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--foreground)", textTransform: "uppercase", marginBottom: 6 }}>
                      A. Current Assets &amp; Liquid Resources
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>• Liquid Cash in Vault / Bank:</span>
                        <strong style={{ color: "#059669" }}>{formatINR(data.balance_sheet?.assets?.current_assets?.liquid_cash || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>• Accounts Receivable (Direct Vault Sales):</span>
                        <strong>{formatINR(data.balance_sheet?.assets?.current_assets?.accounts_receivable_direct_sales || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>• Accounts Receivable (Brokerage Deal Buyers):</span>
                        <strong>{formatINR(data.balance_sheet?.assets?.current_assets?.accounts_receivable_brokerage_deals || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>• Pending Brokerage Commission Earnings:</span>
                        <strong style={{ color: "#8b5cf6" }}>+{formatINR(data.balance_sheet?.assets?.current_assets?.pending_brokerage_commissions || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: 4 }}>
                        <span style={{ fontWeight: 700 }}>Total Trade Accounts Receivable:</span>
                        <strong style={{ color: "#2563eb" }}>{formatINR(data.balance_sheet?.assets?.current_assets?.total_accounts_receivable || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>• Vault Inventory Closing Stock (Cost Basis):</span>
                        <strong style={{ color: "#d97706" }}>{formatINR(data.balance_sheet?.assets?.current_assets?.inventory_at_cost || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 4 }}>
                        <span style={{ fontWeight: 800 }}>Subtotal Current Assets:</span>
                        <strong style={{ color: "var(--foreground)", fontSize: 13 }}>{formatINR(data.balance_sheet?.assets?.current_assets?.total_current_assets || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Fixed / Physical Assets Section */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--foreground)", textTransform: "uppercase", marginBottom: 6 }}>
                      B. Fixed &amp; Physical Business Assets
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 8 }}>
                      {data.balance_sheet?.assets?.fixed_assets?.items?.length ? (
                        data.balance_sheet.assets.fixed_assets.items.map((ast) => (
                          <div key={ast.id} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--muted)" }}>• {ast.name} ({ast.category}):</span>
                            <strong>{formatINR(ast.valuation)}</strong>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 11 }}>
                          No standalone physical assets logged in Assets Master.
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: 4 }}>
                        <span style={{ fontWeight: 700 }}>Subtotal Fixed Assets:</span>
                        <strong>{formatINR(data.balance_sheet?.assets?.fixed_assets?.total_fixed_assets || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Memorandum Valuation Note */}
                  <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 10, background: "rgba(245, 158, 11, 0.06)", padding: 8, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#d97706", textTransform: "uppercase" }}>
                      Memorandum: Inventory Market Valuation
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ color: "var(--muted)" }}>Target Asking Market Value:</span>
                      <strong>{formatINR(data.balance_sheet?.assets?.inventory_at_market || 0)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Unrealized Capital Appreciation:</span>
                      <strong style={{ color: "#10b981" }}>+{formatINR(data.balance_sheet?.assets?.unrealized_inventory_appreciation || 0)}</strong>
                    </div>
                  </div>

                  {/* TOTAL ASSETS FOOTER */}
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #2563eb", paddingTop: 8, background: "rgba(37, 99, 235, 0.08)", padding: 8, borderRadius: 6 }}>
                    <span style={{ fontWeight: 900, color: "#1d4ed8", fontSize: 13 }}>TOTAL BUSINESS ASSETS:</span>
                    <strong style={{ color: "#1d4ed8", fontSize: 15 }}>{formatINR(data.balance_sheet?.assets?.total_assets || 0)}</strong>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: LIABILITIES & EQUITY */}
              <div style={{ background: "var(--surface-sunken)", padding: 18, borderRadius: 8, border: "1.5px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #dc2626", paddingBottom: 8, marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#dc2626", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    2. LIABILITIES &amp; EQUITY (What You Owe &amp; Net Worth)
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#dc2626" }}>
                    {formatINR(data.balance_sheet?.liabilities?.total_liabilities || 0)}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
                  {/* Current Liabilities Section */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--foreground)", textTransform: "uppercase", marginBottom: 6 }}>
                      A. Current Business Liabilities (Accounts Payable)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>• Payables to Gemstone Suppliers (Purchases):</span>
                        <strong style={{ color: "#ef4444" }}>-{formatINR(data.balance_sheet?.liabilities?.current_liabilities?.accounts_payable_suppliers || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>• Middleman Brokerage Payable (Purchase Brokers):</span>
                        <strong style={{ color: "#8b5cf6" }}>-{formatINR(data.balance_sheet?.liabilities?.current_liabilities?.brokerage_payable_purchase_brokers || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>• Payouts Due to Sellers on Brokerage Deals:</span>
                        <strong style={{ color: "#ef4444" }}>-{formatINR(data.balance_sheet?.liabilities?.current_liabilities?.brokerage_payable_deal_sellers || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: 4 }}>
                        <span style={{ fontWeight: 800 }}>Total Current Liabilities:</span>
                        <strong style={{ color: "#dc2626", fontSize: 13 }}>-{formatINR(data.balance_sheet?.liabilities?.total_liabilities || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Solvency & Liquidity Position */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--foreground)", textTransform: "uppercase", marginBottom: 6 }}>
                      B. Liquidity &amp; Financial Solvency Health
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>• Net Working Capital (Current Assets − Current Liab):</span>
                        <strong style={{ color: "#10b981" }}>{formatINR(data.balance_sheet?.equity?.working_capital || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>• Current Ratio (Current Assets / Current Liab):</span>
                        <strong style={{ color: "#2563eb" }}>{data.balance_sheet?.equity?.current_ratio || 0} : 1</strong>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                        A current ratio &gt; 1.5 indicates healthy liquidity to comfortably settle trade suppliers and brokers.
                      </div>
                    </div>
                  </div>

                  {/* Owner Equity / Net Worth */}
                  <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 10, background: "rgba(16, 185, 129, 0.08)", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#047857", textTransform: "uppercase" }}>
                      ★ OWNER&apos;S EQUITY &amp; NET BUSINESS WORTH
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>NET ENTERPRISE WORTH:</span>
                      <strong style={{ fontSize: 18, fontWeight: 900, color: (data.balance_sheet?.equity?.net_worth || 0) >= 0 ? "#047857" : "#ef4444" }}>
                        {formatINR(data.balance_sheet?.equity?.net_worth || 0)}
                      </strong>
                    </div>
                    <div style={{ fontSize: 11, color: "#047857", marginTop: 4 }}>
                      Calculated as: Total Assets ({formatINR(data.balance_sheet?.assets?.total_assets || 0)}) − Total Liabilities ({formatINR(data.balance_sheet?.liabilities?.total_liabilities || 0)}).
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Comprehensive P&L Statement & Timeline */}
      {activeTab === "pnl" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Executive P&L Financial Statement Card */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📑</span> Comprehensive Profit &amp; Loss Statement (Income &amp; Expenditure)
                </h3>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Consolidated financial breakdown across Direct Sales, Brokerage Deals, Purchase Brokerage, Operating Overheads, and Net Margin.
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {/* Box 1: Sales & Trading Operations */}
              <div style={{ background: "var(--surface-sunken)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", marginBottom: 10 }}>
                  1. Sales &amp; Trading Operations
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Direct Vault Sales:</span>
                    <strong>{formatINR(data.direct_sales_revenue || 0)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Brokerage Deals Value (As Sales):</span>
                    <strong style={{ color: "#8b5cf6" }}>+{formatINR(data.brokerage_deals_revenue || 0)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: 4 }}>
                    <span style={{ fontWeight: 700 }}>Total Consolidated Sales:</span>
                    <strong style={{ color: "#2563eb" }}>{formatINR(data.total_sales_revenue)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Less: Direct Vault COGS:</span>
                    <strong style={{ color: "#dc2626" }}>-{formatINR(data.direct_sales_cogs || 0)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Less: Brokerage Deal Cost (Seller):</span>
                    <strong style={{ color: "#dc2626" }}>-{formatINR(data.brokerage_deals_cogs || 0)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1.5px solid var(--border)", paddingTop: 6 }}>
                    <span style={{ fontWeight: 800, color: "var(--foreground)" }}>Gross Trading Profit:</span>
                    <strong style={{ color: "#10b981", fontSize: 13 }}>{formatINR(data.gross_profit)} ({data.gross_margin_pct}%)</strong>
                  </div>
                </div>
              </div>

              {/* Box 2: Middleman Purchase Brokerage & Commissions */}
              <div style={{ background: "var(--surface-sunken)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#8b5cf6", textTransform: "uppercase", marginBottom: 10 }}>
                  2. Purchase Brokerage &amp; Commissions
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Purchase Brokerage Incurred:</span>
                    <strong style={{ color: "#ef4444" }}>-{formatINR(data.purchase_brokerage_incurred || 0)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>• Paid to Purchase Brokers:</span>
                    <strong style={{ color: "#059669" }}>{formatINR(data.purchase_brokerage_paid || 0)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>• Outstanding Payable to Brokers:</span>
                    <strong style={{ color: "#dc2626" }}>{formatINR(data.purchase_brokerage_pending || 0)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: 4 }}>
                    <span style={{ color: "var(--muted)" }}>Outside Deals Commission Earned:</span>
                    <strong style={{ color: "#10b981" }}>+{formatINR(data.brokerage_earnings || 0)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1.5px solid var(--border)", paddingTop: 6 }}>
                    <span style={{ fontWeight: 800 }}>Net Brokerage Impact:</span>
                    <strong style={{ color: "#8b5cf6", fontSize: 13 }}>
                      {formatINR((data.brokerage_earnings || 0) - (data.purchase_brokerage_incurred || 0))}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Box 3: Operating Overheads & Net Profit */}
              <div style={{ background: "var(--surface-sunken)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#059669", textTransform: "uppercase", marginBottom: 10 }}>
                  3. Overheads &amp; Net Business Profit
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Business &amp; Commercial Overheads:</span>
                    <strong style={{ color: "#ef4444" }}>-{formatINR(data.business_expenses)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Office &amp; Petty Cash Expenses:</span>
                    <strong style={{ color: "#ef4444" }}>-{formatINR(data.petty_expenses)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Middleman Purchase Brokerage:</span>
                    <strong style={{ color: "#ef4444" }}>-{formatINR(data.purchase_brokerage_incurred || 0)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border)", paddingTop: 4 }}>
                    <span style={{ fontWeight: 700 }}>Total Net Operating Expenses:</span>
                    <strong style={{ color: "#dc2626" }}>-{formatINR(data.total_expenses)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1.5px solid var(--border)", paddingTop: 6, background: "rgba(16, 185, 129, 0.08)", padding: 6, borderRadius: 4 }}>
                    <span style={{ fontWeight: 900, color: "#047857" }}>★ FINAL NET BUSINESS PROFIT:</span>
                    <strong style={{ color: data.net_profit >= 0 ? "#065f46" : "#ef4444", fontSize: 14 }}>
                      {formatINR(data.net_profit)} ({data.net_margin_pct}%)
                    </strong>
                  </div>
                </div>
              </div>

              {/* Box 4: Vault Inventory Asset Valuation */}
              <div style={{ background: "var(--surface-sunken)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#d97706", textTransform: "uppercase", marginBottom: 10 }}>
                  4. Vault Inventory Assets Valuation
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Active Vault Holdings:</span>
                    <strong>{data.vault_packets_count} packets ({data.vault_total_carats} cts/g)</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Invested Cost Basis Capital:</span>
                    <strong style={{ color: "var(--foreground)" }}>{formatINR(data.vault_cost_valuation)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Target Asking Market Valuation:</span>
                    <strong style={{ color: "var(--primary)" }}>{formatINR(data.vault_asking_valuation)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1.5px solid var(--border)", paddingTop: 6 }}>
                    <span style={{ fontWeight: 800 }}>Unrealized Asset Appreciation:</span>
                    <strong style={{ color: "#10b981", fontSize: 13 }}>+{formatINR(data.unrealized_profit)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  Profit &amp; Loss Breakdown ({timeBase === "monthly" ? "Monthly" : "Weekly"})
                </h3>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Track revenue trends, procurement costs, purchase brokerage, expenses, and net profit over time.
                </div>
              </div>

              {/* Time Base Switcher */}
              <div
                className="hide-print"
                style={{
                  display: "inline-flex",
                  borderRadius: 6,
                  border: "1.5px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: timeBase === "monthly" ? "var(--primary)" : "var(--surface)",
                    color: timeBase === "monthly" ? "#fff" : "var(--foreground)",
                  }}
                  onClick={() => setTimeBase("monthly")}
                >
                  📅 Monthly Base
                </button>
                <button
                  type="button"
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: timeBase === "weekly" ? "var(--primary)" : "var(--surface)",
                    color: timeBase === "weekly" ? "#fff" : "var(--foreground)",
                  }}
                  onClick={() => setTimeBase("weekly")}
                >
                  📆 Weekly Base
                </button>
              </div>
            </div>

            {activePnlList.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                No transaction data available for this timeframe.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Period ({timeBase === "monthly" ? "Month" : "Week"})</th>
                      <th style={{ textAlign: "right" }}>Sales Revenue</th>
                      <th style={{ textAlign: "right" }}>COGS (Cost)</th>
                      <th style={{ textAlign: "right" }}>Gross Profit</th>
                      <th style={{ textAlign: "right" }}>Brokerage Deals</th>
                      <th style={{ textAlign: "right" }}>Purchase Brokerage</th>
                      <th style={{ textAlign: "right" }}>Total Expenses</th>
                      <th style={{ textAlign: "right", fontWeight: 800 }}>Net Business Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePnlList.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 800 }}>{row.period}</td>
                        <td style={{ textAlign: "right", color: "#2563eb", fontWeight: 700 }}>
                          {formatINR(row.revenue)}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--muted)" }}>
                          {formatINR(row.cogs)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatINR(row.gross_profit)}
                        </td>
                        <td style={{ textAlign: "right", color: "#8b5cf6" }}>
                          +{formatINR(row.brokerage)}
                        </td>
                        <td style={{ textAlign: "right", color: "#dc2626" }}>
                          -{formatINR((row as any).purchase_brokerage || 0)}
                        </td>
                        <td style={{ textAlign: "right", color: "#ef4444" }}>
                          -{formatINR(row.expenses)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 900,
                            color: row.net_profit >= 0 ? "#10b981" : "#ef4444",
                          }}
                        >
                          {formatINR(row.net_profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: 5 Companies Breakdown */}
      {activeTab === "companies" && (
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>
            Business-Wise Performance (All 5 Companies)
          </h3>
          <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 16px" }}>
            Comparative evaluation across all 5 firms including Direct Sales, Brokerage Deals, and Purchase Brokerage.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Company Entity</th>
                  <th style={{ textAlign: "right" }}>Sales Revenue (₹)</th>
                  <th style={{ textAlign: "right" }}>Gross Trading Profit (₹)</th>
                  <th style={{ textAlign: "right" }}>Operating Expenses &amp; Brokerage (₹)</th>
                  <th style={{ textAlign: "right", fontWeight: 800 }}>Net Profit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {data.company_breakdown.map((comp, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 800 }}>{comp.company}</div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#2563eb" }}>
                      {formatINR(comp.sales_revenue)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {formatINR(comp.gross_profit)}
                    </td>
                    <td style={{ textAlign: "right", color: "#ef4444" }}>
                      -{formatINR(comp.expenses)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 900,
                        color: comp.net_profit >= 0 ? "#10b981" : "#ef4444",
                      }}
                    >
                      {formatINR(comp.net_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Gemstone Varieties */}
      {activeTab === "varieties" && (
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>
            Profit by Gemstone Variety
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Gemstone Variety</th>
                  <th style={{ textAlign: "center" }}>Sold Pkts</th>
                  <th style={{ textAlign: "center" }}>In-Stock Pkts</th>
                  <th style={{ textAlign: "right" }}>Total Carats</th>
                  <th style={{ textAlign: "right" }}>Sales Revenue</th>
                  <th style={{ textAlign: "right" }}>Gross Profit</th>
                  <th style={{ textAlign: "right" }}>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {data.particulars_breakdown.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700 }}>{row.particular}</td>
                    <td style={{ textAlign: "center" }}>{row.sold_count}</td>
                    <td style={{ textAlign: "center" }}>{row.in_stock_count}</td>
                    <td style={{ textAlign: "right" }}>{row.carats} cts</td>
                    <td style={{ textAlign: "right" }}>{formatINR(row.revenue)}</td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: "#10b981" }}>
                      {formatINR(row.gross_profit)}
                    </td>
                    <td style={{ textAlign: "right" }}>{row.margin_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: Vault Valuation */}
      {activeTab === "vault" && (
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>
            Vault Capital &amp; Valuation Breakdown
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
            <div style={{ padding: 14, background: "var(--surface)", borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Active Vault Packets</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{data.vault_packets_count} packets</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{data.vault_total_carats} total cts/g</div>
            </div>
            <div style={{ padding: 14, background: "var(--surface)", borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Invested Cost Capital</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{formatINR(data.vault_cost_valuation)}</div>
            </div>
            <div style={{ padding: 14, background: "var(--surface)", borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Target Asking Valuation</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)", marginTop: 4 }}>{formatINR(data.vault_asking_valuation)}</div>
            </div>
            <div style={{ padding: 14, background: "var(--surface)", borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Unrealized Vault Profit</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981", marginTop: 4 }}>+{formatINR(data.unrealized_profit)}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Expense Categories Breakdown (including Purchase Brokerage) */}
      {activeTab === "expenses" && (
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>
            Operating Deductions by Category (Including Middleman Purchase Brokerage)
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Expense Category</th>
                  <th style={{ textAlign: "right" }}>Amount (₹)</th>
                  <th style={{ textAlign: "right" }}>% of Total Overheads</th>
                </tr>
              </thead>
              <tbody>
                {data.expense_categories.map((c, idx) => {
                  const isPurchaseBrk = c.category === "Purchase Brokerage";
                  return (
                    <tr key={idx} style={{ background: isPurchaseBrk ? "rgba(139, 92, 246, 0.05)" : undefined }}>
                      <td>
                        <span style={{ fontWeight: 800, color: isPurchaseBrk ? "#7c3aed" : undefined }}>
                          {isPurchaseBrk ? "★ Purchase Brokerage (Middleman Fees)" : c.category}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: isPurchaseBrk ? "#7c3aed" : "#ef4444" }}>
                        -{formatINR(c.amount)}
                      </td>
                      <td style={{ textAlign: "right" }}>{c.pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: Top Buyers Leaderboard */}
      {activeTab === "buyers" && (
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>
            Top Counterparty Clients &amp; Buyers Leaderboard
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Buyer / Counterparty Name</th>
                  <th style={{ textAlign: "center" }}>Total Transactions</th>
                  <th style={{ textAlign: "right" }}>Total Deal Volume (₹)</th>
                  <th style={{ textAlign: "right", fontWeight: 800 }}>Gross Profit Generated (₹)</th>
                </tr>
              </thead>
              <tbody>
                {data.top_buyers.map((b, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700 }}>{b.name}</td>
                    <td style={{ textAlign: "center" }}>{b.deals_count} deals</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#2563eb" }}>
                      {formatINR(b.total_spend)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: "#10b981" }}>
                      {formatINR(b.gross_profit_generated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print-Only Footer */}
      <div className="print-only report-print-footer">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "#64748b", borderTop: "1px solid #cbd5e1", paddingTop: 4, marginTop: 8 }}>
          <span>Confidential Financial Statement • Generated from Shreeji Gems GemVault ERP</span>
          <span>Printed Page 1 of 1 (Strict Single Page Fit)</span>
        </div>
      </div>
    </div>
  );
}
