import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import { Spinner, EmptyState } from "../ui";
import { formatINR, shortDate } from "../format";
import type { GemExpense } from "../types/gemstone";
import { DEFAULT_COMPANIES } from "../types/gemstone";
import { useToast } from "../toast";

const PETTY_CATEGORIES = [
  "Petty Cash / Refreshments",
  "Local Conveyance & Postage",
  "Office Supplies",
  "Miscellaneous",
];

const BUSINESS_CATEGORIES = [
  "Certification",
  "Cutting & Polishing",
  "Vault & Safe Deposit",
  "Armored Shipping",
  "Travel & Gem Shows",
  "Staff Salaries",
  "Miscellaneous",
];

export default function Expenses() {
  const queryClient = useQueryClient();
  const { show } = useToast();

  // Requirement: 2 sections in expenses one for petty other for business
  const [activeTab, setActiveTab] = useState<"petty" | "business" | "all">("petty");
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [customCatInput, setCustomCatInput] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newExp, setNewExp] = useState<Partial<GemExpense>>({
    date: new Date().toISOString().slice(0, 10),
    expense_type: "petty",
    category: "Petty Cash / Refreshments",
    amount: 1500,
    company_name: "Shreeji Gems",
    payee: "",
    packet_ref: "",
    payment_mode: "Cash",
    note: "",
  });

  const { data: expenses = [], isLoading } = useQuery<GemExpense[]>({
    queryKey: ["expenses"],
    queryFn: () => apiGet("/expenses"),
  });

  const { data: pettyCategories = PETTY_CATEGORIES } = useQuery<string[]>({
    queryKey: ["petty_categories"],
    queryFn: () => apiGet("/petty-categories"),
  });

  const addPettyCatMutation = useMutation({
    mutationFn: (cat: string) => apiPost("/petty-categories", { name: cat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["petty_categories"] });
      setCustomCatInput("");
      show("Petty expense category saved!", "success");
    },
    onError: (err: any) => show("Error adding category: " + err.message, "error"),
  });

  const deletePettyCatMutation = useMutation({
    mutationFn: (cat: string) => apiDelete(`/petty-categories/${encodeURIComponent(cat)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["petty_categories"] });
      show("Petty expense category deleted", "info");
    },
    onError: (err: any) => show("Error deleting category: " + err.message, "error"),
  });

  const handleOpenCreate = (type: "petty" | "business") => {
    setEditingId(null);
    setNewExp({
      date: new Date().toISOString().slice(0, 10),
      expense_type: type,
      category: type === "petty" ? "Petty Cash / Refreshments" : "Certification",
      amount: type === "petty" ? 1500 : 25000,
      company_name: "Shreeji Gems",
      payee: "",
      packet_ref: "",
      payment_mode: type === "petty" ? "Cash" : "Bank Wire / NEFT",
      note: "",
    });
    setModalOpen(true);
  };

  const handleEditExpense = (e: GemExpense) => {
    setEditingId(e.id);
    setNewExp({
      id: e.id,
      date: e.date,
      expense_type: e.expense_type || "business",
      category: e.category,
      amount: e.amount,
      company_name: e.company_name || "Shreeji Gems",
      payee: e.payee,
      packet_ref: e.packet_ref || "",
      payment_mode: e.payment_mode || "Bank Wire / NEFT",
      note: e.note || "",
    });
    setModalOpen(true);
  };

  const saveExpenseMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editingId) {
        return apiPut(`/expenses/${editingId}`, { ...payload, id: editingId });
      }
      return apiPost("/expenses", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      setModalOpen(false);
      setEditingId(null);
      show(editingId ? "Expense updated successfully!" : "Expense recorded successfully!", "success");
    },
    onError: (err: any) => show("Error saving expense: " + err.message, "error"),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Expense deleted", "info");
    },
    onError: (err: any) => show("Error deleting expense: " + err.message, "error"),
  });

  // Calculate totals
  const totalPetty = useMemo(() => {
    return expenses.filter((e) => e.expense_type === "petty").reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const totalBusiness = useMemo(() => {
    return expenses.filter((e) => e.expense_type !== "petty").reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const totalAll = totalPetty + totalBusiness;

  const filteredExpenses = useMemo(() => {
    let result = [...expenses];

    if (activeTab === "petty") {
      result = result.filter((e) => e.expense_type === "petty");
    } else if (activeTab === "business") {
      result = result.filter((e) => e.expense_type !== "petty");
    }

    if (companyFilter !== "all") {
      result = result.filter((e) => e.company_name === companyFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((e) => e.category === categoryFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.payee.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.packet_ref?.toLowerCase().includes(q) ||
          e.note?.toLowerCase().includes(q) ||
          e.company_name?.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, activeTab, companyFilter, categoryFilter, searchTerm]);

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
            <span>💳</span> Operating Expenses
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 13 }}>
            Two distinct expense ledgers: Petty Cash Expenses and Core Business Operating Expenses.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline" onClick={() => setCatModalOpen(true)} title="Customize Petty Expense Categories">
            ⚙️ Petty Categories
          </button>
          <button className="btn btn-outline" onClick={() => handleOpenCreate("petty")}>
            ☕ + Add Petty Expense
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenCreate("business")}>
            🏢 + Add Business Expense
          </button>
        </div>
      </div>

      {/* KPI Cards for Petty vs Business */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {/* Petty Expenses Card */}
        <div
          className="gem-kpi-card"
          style={{
            borderTop: "3px solid #f59e0b",
            background: activeTab === "petty" ? "rgba(245, 158, 11, 0.05)" : undefined,
            cursor: "pointer",
          }}
          onClick={() => setActiveTab("petty")}
        >
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            ☕ Petty Cash Expenses
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#d97706", marginTop: 4 }}>
            {formatINR(totalPetty)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Daily hospitality, office tea, snacks & local couriers
          </div>
        </div>

        {/* Business Expenses Card */}
        <div
          className="gem-kpi-card"
          style={{
            borderTop: "3px solid #3b82f6",
            background: activeTab === "business" ? "rgba(59, 130, 246, 0.05)" : undefined,
            cursor: "pointer",
          }}
          onClick={() => setActiveTab("business")}
        >
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            🏢 Business Operating Expenses
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#2563eb", marginTop: 4 }}>
            {formatINR(totalBusiness)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Lab testing, lapidary cutting, safe vaults & salaries
          </div>
        </div>

        {/* Combined Total Expenses */}
        <div
          className="gem-kpi-card"
          style={{
            borderTop: "3px solid #ef4444",
            background: activeTab === "all" ? "rgba(239, 68, 68, 0.05)" : undefined,
            cursor: "pointer",
          }}
          onClick={() => setActiveTab("all")}
        >
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            📊 Combined Total Expenses
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--foreground)", marginTop: 4 }}>
            {formatINR(totalAll)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Total deductible business expenses across all 5 firms
          </div>
        </div>
      </div>

      {/* 2 Clear Sections Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        <button
          className={`btn btn-sm ${activeTab === "petty" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("petty")}
        >
          ☕ Petty Expenses Section ({expenses.filter((e) => e.expense_type === "petty").length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === "business" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("business")}
        >
          🏢 Business Expenses Section ({expenses.filter((e) => e.expense_type !== "petty").length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === "all" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveTab("all")}
        >
          All Expenses Combined ({expenses.length})
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
            placeholder="Search payee, packet ref, note, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Category:</label>
          <select
            className="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {(activeTab === "petty" ? pettyCategories : BUSINESS_CATEGORIES).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      {isLoading ? (
        <Spinner />
      ) : filteredExpenses.length === 0 ? (
        <EmptyState
          icon="💳"
          title={`No ${activeTab === "petty" ? "Petty" : "Business"} Expenses Recorded`}
          description="Log a new expense to track financial deductions and accurate profit metrics."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Section Tag</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Company</th>
                  <th>Payee / Vendor</th>
                  <th style={{ textAlign: "right" }}>Amount (₹)</th>
                  <th>Packet Ref</th>
                  <th>Payment Mode</th>
                  <th>Notes</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp) => {
                  const isPetty = exp.expense_type === "petty";
                  return (
                    <tr key={exp.id}>
                      <td>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                            background: isPetty ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.15)",
                            color: isPetty ? "#d97706" : "#2563eb",
                          }}
                        >
                          {isPetty ? "☕ PETTY" : "🏢 BUSINESS"}
                        </span>
                      </td>
                      <td>{shortDate(exp.date)}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{exp.category}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {exp.company_name || "Shreeji Gems"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700 }}>{exp.payee}</span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#ef4444" }}>
                        -{formatINR(exp.amount)}
                      </td>
                      <td>
                        {exp.packet_ref ? (
                          <span style={{ fontWeight: 700, color: "var(--primary)" }}>{exp.packet_ref}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{exp.payment_mode}</span>
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{exp.note || "—"}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleEditExpense(exp)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{ color: "#ef4444" }}
                            onClick={() => {
                              if (window.confirm(`Delete expense for "${exp.payee}"?`)) {
                                deleteExpenseMutation.mutate(exp.id);
                              }
                            }}
                            title="Delete"
                          >
                            🗑️
                          </button>
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

      {/* Modal: Add / Edit Expense */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>
                {editingId ? "Edit Expense" : `Record ${newExp.expense_type === "petty" ? "Petty" : "Business"} Expense`}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveExpenseMutation.mutate(newExp);
              }}
              style={{ padding: 20 }}
            >
              {/* Section selection */}
              <div style={{ marginBottom: 12 }}>
                <label className="label">Expense Section:</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="expense_type"
                      checked={newExp.expense_type === "petty"}
                      onChange={() =>
                        setNewExp({
                          ...newExp,
                          expense_type: "petty",
                          category: "Petty Cash / Refreshments",
                          payment_mode: "Cash",
                        })
                      }
                    />
                    <span>☕ Petty Expense (Daily Cash / Hospitality)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="expense_type"
                      checked={newExp.expense_type === "business"}
                      onChange={() =>
                        setNewExp({
                          ...newExp,
                          expense_type: "business",
                          category: "Certification",
                          payment_mode: "Bank Wire / NEFT",
                        })
                      }
                    />
                    <span>🏢 Business Operating Expense</span>
                  </label>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">Date:</label>
                  <input
                    type="date"
                    className="input"
                    value={newExp.date || ""}
                    onChange={(e) => setNewExp({ ...newExp, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Company (1 of 5):</label>
                  <select
                    className="select"
                    value={newExp.company_name || "Shreeji Gems"}
                    onChange={(e) => setNewExp({ ...newExp, company_name: e.target.value })}
                  >
                    {DEFAULT_COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">Category:</label>
                  <select
                    className="select"
                    value={newExp.category}
                    onChange={(e) => setNewExp({ ...newExp, category: e.target.value as any })}
                  >
                    {(newExp.expense_type === "petty" ? pettyCategories : BUSINESS_CATEGORIES).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Amount (₹):</label>
                  <input
                    type="number"
                    className="input"
                    value={newExp.amount || 0}
                    onChange={(e) => setNewExp({ ...newExp, amount: Number(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="label">Payee / Vendor / Purpose:</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. GRS Lab, Safe Vault, Courier, Staff Tea..."
                  value={newExp.payee || ""}
                  onChange={(e) => setNewExp({ ...newExp, payee: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">Associated Packet Ref (Optional):</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. ex/1, ex/4"
                    value={newExp.packet_ref || ""}
                    onChange={(e) => setNewExp({ ...newExp, packet_ref: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Payment Mode:</label>
                  <select
                    className="select"
                    value={newExp.payment_mode || "Bank Wire / NEFT"}
                    onChange={(e) => setNewExp({ ...newExp, payment_mode: e.target.value })}
                  >
                    <option value="Cash">Cash (Vault / Petty)</option>
                    <option value="Bank Wire / NEFT">Bank Wire / NEFT</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label">Notes / Receipt Ref:</label>
                <textarea
                  className="input"
                  rows={2}
                  value={newExp.note || ""}
                  onChange={(e) => setNewExp({ ...newExp, note: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? "Update Expense" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Customize Petty Expense Categories */}
      {catModalOpen && (
        <div className="modal-backdrop" onClick={() => setCatModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>⚙️ Customize Petty Expense Categories</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setCatModalOpen(false)}>
                ✕
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
                Add or remove custom categories for daily petty cash & hospitality tracking.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!customCatInput.trim()) return;
                  addPettyCatMutation.mutate(customCatInput.trim());
                }}
                style={{ display: "flex", gap: 8, marginBottom: 18 }}
              >
                <input
                  type="text"
                  className="input"
                  placeholder="New petty category name..."
                  value={customCatInput}
                  onChange={(e) => setCustomCatInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={!customCatInput.trim()}>
                  + Add
                </button>
              </form>

              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: "var(--surface-hover)", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                  Active Petty Categories ({pettyCategories.length})
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {pettyCategories.map((cat) => (
                    <div
                      key={cat}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>☕ {cat}</span>
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ color: "#ef4444" }}
                        onClick={() => {
                          if (pettyCategories.length <= 1) {
                            show("Cannot remove the last category", "warning");
                            return;
                          }
                          if (window.confirm(`Delete category "${cat}"?`)) {
                            deletePettyCatMutation.mutate(cat);
                          }
                        }}
                        title="Delete Category"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => setCatModalOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
