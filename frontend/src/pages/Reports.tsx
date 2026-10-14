import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api";
import { Spinner } from "../ui";
import { formatINR, formatINRCompact } from "../format";
import type { OverallAnalytics } from "../gemstoneStorage";
import { DEFAULT_COMPANIES } from "../types/gemstone";
import { verifyAnalyticsPassword, getAnalyticsPassword } from "../gemstoneStorage";
import { useToast } from "../toast";

export default function Reports() {
  const { show } = useToast();

  // Password Lock State (Requirement: password for profit analytics, password: 2014)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem("gemvault_analytics_unlocked") === "true";
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Timeframe Base Toggle (Requirement: option to change base from weekly to monthly and vice a versa)
  const [timeBase, setTimeBase] = useState<"monthly" | "weekly">("monthly");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"pnl" | "companies" | "varieties" | "vault" | "expenses">("pnl");

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
            Enter your 4-digit master security PIN to view executive profit waterfall, margins, and valuation.
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
              💎 SHREEJI GEMS &amp; ASSOCIATES — PROFIT &amp; BUSINESS ANALYTICS
            </h2>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              Entity Scope: <strong>{selectedCompany === "all" ? "All 5 Companies (Consolidated)" : selectedCompany}</strong> • Timeline Base: <strong>{timeBase === "monthly" ? "Monthly" : "Weekly"}</strong>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: "#64748b" }}>
            <div>Date: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>Executive P&amp;L Summary (1-Page)</div>
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
            <span>📈</span> Executive Profit & Business Analytics
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 13 }}>
            Full executive evaluation of Sales, COGS, Brokerage, Operating Expenses, and Vault Valuation across 5 companies.
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

      {/* Primary KPI Ribbon (Requirement: add Total Sales and Expenses) */}
      <div
        className="report-kpi-ribbon"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {/* 1. Total Sales */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #2563eb" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Total Sales Revenue
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#2563eb", marginTop: 4 }}>
            {formatINR(data.total_sales_revenue)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            COGS: {formatINR(data.total_cogs)}
          </div>
        </div>

        {/* 2. Total Expenses */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #ef4444" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Total Deductible Expenses
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#dc2626", marginTop: 4 }}>
            -{formatINR(data.total_expenses)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Petty: {formatINR(data.petty_expenses)} • Business: {formatINR(data.business_expenses)}
          </div>
        </div>

        {/* 3. Gross Trading Profit */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Gross Trading Profit
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "var(--success)", marginTop: 4 }}>
            {formatINR(data.gross_profit)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {data.gross_margin_pct}% trading margin
          </div>
        </div>

        {/* 4. NET Business Profit */}
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
              fontSize: 28,
              fontWeight: 900,
              color: data.net_profit >= 0 ? "#065f46" : "#ef4444",
              marginTop: 4,
            }}
          >
            {formatINR(data.net_profit)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            (Gross + Brokerage ₹{formatINRCompact(data.brokerage_earnings)}) − Expenses
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="hide-print" style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8, flexWrap: "wrap" }}>
        <button
          className={`btn btn-sm ${activeTab === "pnl" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("pnl")}
        >
          📅 P&L Timeline Analysis
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
          💳 Expense Categories
        </button>
      </div>

      {/* TAB 1: P&L Timeline with Weekly / Monthly Switcher (Requirement!) */}
      {activeTab === "pnl" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  Profit & Loss Breakdown ({timeBase === "monthly" ? "Monthly" : "Weekly"})
                </h3>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Track revenue trends, procurement costs, brokerage earnings, expenses, and net profit over time.
                </div>
              </div>

              {/* Requirement: option to change base from weekly to monthly and vice a versa */}
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
                      <th style={{ textAlign: "right" }}>Brokerage Earnings</th>
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

      {/* TAB 2: 5 Companies Breakdown */}
      {activeTab === "companies" && (
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>
            Business-Wise Performance (All 5 Companies)
          </h3>
          <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 16px" }}>
            Comparative evaluation across all 5 firms under the unified inventory umbrella.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Company Entity</th>
                  <th style={{ textAlign: "right" }}>Sales Revenue (₹)</th>
                  <th style={{ textAlign: "right" }}>Gross Trading Profit (₹)</th>
                  <th style={{ textAlign: "right" }}>Operating Expenses (₹)</th>
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

      {/* TAB 3: Gemstone Varieties */}
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

      {/* TAB 4: Vault Valuation */}
      {activeTab === "vault" && (
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>
            Vault Capital & Valuation Breakdown
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

      {/* TAB 5: Expense Categories */}
      {activeTab === "expenses" && (
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>
            Operating Deductions by Category
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Expense Category</th>
                  <th style={{ textAlign: "right" }}>Amount (₹)</th>
                  <th style={{ textAlign: "right" }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {data.expense_categories.map((c, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700 }}>{c.category}</td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: "#ef4444" }}>
                      -{formatINR(c.amount)}
                    </td>
                    <td style={{ textAlign: "right" }}>{c.pct}%</td>
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
          <span>Confidential Financial Statement • Generated from GemVault ERP</span>
          <span>Printed Page 1 of 1 (Strict Single Page Fit)</span>
        </div>
      </div>
    </div>
  );
}
