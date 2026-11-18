import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiDelete } from "../api";
import { Spinner, EmptyState, PayBadge } from "../ui";
import { formatINR, shortDate } from "../format";
import type { GemPurchase } from "../types/gemstone";
import { useToast } from "../toast";
import {
  printPurchaseRegister,
  printSupplierPurchaseStatement,
  printPurchaseVoucher,
} from "../statementPrint";

export default function Purchases() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | "pending" | "cleared">("all");
  const [brokerageFilter, setBrokerageFilter] = useState<"all" | "pending" | "paid">("all");
  const [printRegisterModalOpen, setPrintRegisterModalOpen] = useState(false);
  const [selectedPrintSupplier, setSelectedPrintSupplier] = useState("all");

  // Supplier Payment Recording Modal State
  const [paymentModalPurchase, setPaymentModalPurchase] = useState<GemPurchase | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState("Bank Wire / NEFT");
  const [paymentNote, setPaymentNote] = useState("");

  // Broker Payment Recording Modal State
  const [brokerPaymentPurchase, setBrokerPaymentPurchase] = useState<GemPurchase | null>(null);
  const [brokerPayDate, setBrokerPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [brokerPayAmount, setBrokerPayAmount] = useState<number>(0);
  const [brokerPayMode, setBrokerPayMode] = useState("Bank Wire / NEFT");
  const [brokerPayNote, setBrokerPayNote] = useState("");

  const { data: purchases = [], isLoading } = useQuery<GemPurchase[]>({
    queryKey: ["purchases"],
    queryFn: () => apiGet("/purchases"),
  });

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    purchases.forEach((p) => {
      if (p.supplier_name && p.supplier_name.trim()) {
        set.add(p.supplier_name.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [purchases]);

  const deletePurchaseMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/purchases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Purchase record deleted and vault synchronized", "info");
    },
    onError: (err: any) => show("Error deleting purchase: " + err.message, "error"),
  });

  const cancelPurchaseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiPost(`/purchases/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Purchase cancelled and returned to supplier. Vault inventory synchronized.", "info");
    },
    onError: (err: any) => show("Error cancelling purchase: " + err.message, "error"),
  });

  // Record Supplier Installment Payment Mutation
  const addPaymentMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiPost(`/purchases/${id}/payments`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Supplier payment installment recorded successfully!", "success");
      setPaymentModalPurchase(null);
    },
    onError: (err: any) => show("Error recording payment: " + err.message, "error"),
  });

  // Quick Full Supplier Payment Mutation
  const markFullPaymentMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiPost(`/purchases/${id}/full-payment`, { payment_mode: "Bank Wire / NEFT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Full purchase payment marked settled!", "success");
      setPaymentModalPurchase(null);
    },
    onError: (err: any) => show("Error marking full payment: " + err.message, "error"),
  });

  // Broker Payment Mutations
  const addBrokerPaymentMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiPost(`/purchases/${id}/broker-payments`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Broker payment installment recorded successfully!", "success");
      setBrokerPaymentPurchase(null);
    },
    onError: (err: any) => show("Error recording broker payment: " + err.message, "error"),
  });

  const markBrokerFullPaymentMutation = useMutation({
    mutationFn: ({ id, payment_mode }: { id: string; payment_mode?: string }) =>
      apiPost(`/purchases/${id}/broker-full-payment`, { payment_mode: payment_mode || "Bank Wire / NEFT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Full middleman broker fee marked settled!", "success");
      setBrokerPaymentPurchase(null);
    },
    onError: (err: any) => show("Error clearing broker fee: " + err.message, "error"),
  });

  // Toggle Brokerage Paid Status Mutation
  const toggleBrokeragePaidMutation = useMutation({
    mutationFn: ({ id, paid }: { id: string; paid: boolean }) =>
      apiPost(`/purchases/${id}/brokerage-paid`, { paid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      show("Broker fee payment status updated!", "success");
    },
    onError: (err: any) => show("Error updating broker fee: " + err.message, "error"),
  });

  const filteredPurchases = useMemo(() => {
    let result = [...purchases];
    if (supplierFilter !== "all") {
      result = result.filter(
        (p) => (p.supplier_name || "").trim().toLowerCase() === supplierFilter.toLowerCase()
      );
    }
    if (paymentStatusFilter !== "all") {
      if (paymentStatusFilter === "pending") {
        result = result.filter((p) => (p.balance_payable || 0) > 0 || p.payment_status !== "cleared");
      } else if (paymentStatusFilter === "cleared") {
        result = result.filter((p) => (p.balance_payable || 0) <= 0 || p.payment_status === "cleared");
      }
    }
    if (brokerageFilter !== "all") {
      if (brokerageFilter === "pending") {
        result = result.filter((p) => !p.brokerage_paid && (p.brokerage_amount || 0) > 0);
      } else if (brokerageFilter === "paid") {
        result = result.filter((p) => p.brokerage_paid && (p.brokerage_amount || 0) > 0);
      }
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.purchase_no.toLowerCase().includes(q) ||
          p.supplier_name.toLowerCase().includes(q) ||
          p.lot_ref?.toLowerCase().includes(q) ||
          p.broker_name?.toLowerCase().includes(q) ||
          p.items?.some(
            (it) =>
              it.packet_number.toLowerCase().includes(q) ||
              it.particulars.toLowerCase().includes(q) ||
              it.box_name?.toLowerCase().includes(q)
          )
      );
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [purchases, supplierFilter, paymentStatusFilter, brokerageFilter, searchTerm]);

  const totalProcurementCost = purchases.reduce((sum, p) => sum + (p.total_cost || 0), 0);
  const totalPaid = purchases.reduce((sum, p) => sum + (p.paid_amount || 0), 0);
  const totalPayables = purchases.reduce((sum, p) => sum + (p.balance_payable || 0), 0);

  const totalBrokerage = purchases.reduce((sum, p) => sum + (p.brokerage_amount || 0), 0);
  const paidBrokerage = purchases.reduce((sum, p) => sum + (p.brokerage_paid_amount || (p.brokerage_paid ? (p.brokerage_amount || 0) : 0)), 0);
  const pendingBrokerage = purchases.reduce((sum, p) => sum + (p.brokerage_balance_due !== undefined ? p.brokerage_balance_due : (p.brokerage_paid ? 0 : (p.brokerage_amount || 0))), 0);

  const openPaymentModal = (p: GemPurchase) => {
    setPaymentModalPurchase(p);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentAmount(Math.max(0, p.balance_payable));
    setPaymentMode("Bank Wire / NEFT");
    setPaymentNote(`Installment for ${p.purchase_no}`);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalPurchase) return;
    if (paymentAmount <= 0) {
      show("Please enter a valid payment amount", "warning");
      return;
    }

    const bal = paymentModalPurchase.balance_payable;
    if (paymentAmount > bal) {
      show(`Payment amount (${formatINR(paymentAmount)}) cannot exceed remaining balance payable of ${formatINR(bal)}`, "error");
      return;
    }

    addPaymentMutation.mutate({
      id: paymentModalPurchase.id,
      payload: {
        date: paymentDate,
        amount: paymentAmount,
        mode: paymentMode,
        note: paymentNote.trim(),
      },
    });
  };

  const openBrokerPaymentModal = (p: GemPurchase) => {
    setBrokerPaymentPurchase(p);
    setBrokerPayDate(new Date().toISOString().slice(0, 10));
    const totalBrk = Number(p.brokerage_amount) || 0;
    const paidBrk = (p.broker_payments || []).reduce((sum, bp) => sum + (Number(bp.amount) || 0), 0);
    const balBrk = Math.max(0, totalBrk - paidBrk);
    setBrokerPayAmount(balBrk);
    setBrokerPayMode("Bank Wire / NEFT");
    setBrokerPayNote(`Broker fee installment for ${p.purchase_no}`);
  };

  const handleBrokerPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokerPaymentPurchase) return;
    if (brokerPayAmount <= 0) {
      show("Please enter a valid broker payment amount", "warning");
      return;
    }

    const totalBrk = Number(brokerPaymentPurchase.brokerage_amount) || 0;
    const paidBrk = (brokerPaymentPurchase.broker_payments || []).reduce((sum, bp) => sum + (Number(bp.amount) || 0), 0);
    const balBrk = Math.max(0, totalBrk - paidBrk);

    if (brokerPayAmount > balBrk) {
      show(`Payment amount (${formatINR(brokerPayAmount)}) cannot exceed remaining broker balance due of ${formatINR(balBrk)}`, "error");
      return;
    }

    addBrokerPaymentMutation.mutate({
      id: brokerPaymentPurchase.id,
      payload: {
        date: brokerPayDate,
        amount: brokerPayAmount,
        mode: brokerPayMode,
        note: brokerPayNote.trim(),
      },
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
            <span>📥</span> Gemstone Procurement & Packet Intake
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 13 }}>
            Supplier purchases, intake of new gemstone packets into vault boxes, credit tracking, and printable statements.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn btn-outline"
            onClick={() => {
              setSelectedPrintSupplier(supplierFilter !== "all" ? supplierFilter : "all");
              setPrintRegisterModalOpen(true);
            }}
            title="Print purchase register with option to filter by supplier"
          >
            🖨️ Print Purchase Register {supplierFilter !== "all" ? `(${supplierFilter})` : ""}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => printSupplierPurchaseStatement(purchases)}
            title="Print supplier-grouped purchase statement"
          >
            🏢 Supplier Purchase Statement
          </button>
          <button className="btn btn-primary" onClick={() => navigate("/purchases/new")}>
            + Intake New Packet / Lot
          </button>
        </div>
      </div>

      {/* Mini KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #3b82f6" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>
            Total Procurement
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)" }}>
            {formatINR(totalProcurementCost)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {purchases.length} purchase lots
          </div>
        </div>

        <div className="gem-kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>
            Total Paid to Suppliers
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>
            {formatINR(totalPaid)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Settled via bank wires, cash & drafts
          </div>
        </div>

        <div className="gem-kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>
            Supplier Payables (Outstanding)
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f59e0b" }}>
            {formatINR(totalPayables)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Pending balance payments across suppliers
          </div>
        </div>

        <div className="gem-kpi-card" style={{ borderTop: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>
            Broker Fees ({formatINR(totalBrokerage)})
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, display: "flex", gap: 10, alignItems: "center", marginTop: 2 }}>
            <span style={{ color: "#10b981", fontSize: 15 }}>✓ Paid: {formatINR(paidBrokerage)}</span>
            <span style={{ color: "#ef4444", fontSize: 15 }}>⏳ Pend: {formatINR(pendingBrokerage)}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Middleman broker commission tracking
          </div>
        </div>
      </div>

      {/* Search & Multi-Filters */}
      <div
        className="card"
        style={{
          padding: "12px 16px",
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", minWidth: 260, flex: 1 }}>
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
            placeholder="Search supplier, voucher #, lot ref, broker, packet #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Payment Status Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Payment:</label>
          <select
            className="select"
            style={{ minWidth: 150, fontSize: 12 }}
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
          >
            <option value="all">💳 All Payments</option>
            <option value="pending">⏳ Pending Payment</option>
            <option value="cleared">✓ Complete Payment</option>
          </select>
        </div>

        {/* Broker Fees Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Broker Fees:</label>
          <select
            className="select"
            style={{ minWidth: 150, fontSize: 12 }}
            value={brokerageFilter}
            onChange={(e) => setBrokerageFilter(e.target.value as any)}
          >
            <option value="all">🤝 All Broker Deals</option>
            <option value="pending">⏳ Pending Broker Fees</option>
            <option value="paid">✓ Paid Broker Fees</option>
          </select>
        </div>

        {/* Supplier Filter Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Supplier:</label>
          <select
            className="select"
            style={{ minWidth: 180, fontSize: 12 }}
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="all">🏢 All Suppliers ({purchases.length})</option>
            {uniqueSuppliers.map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>
        </div>

        {(supplierFilter !== "all" || paymentStatusFilter !== "all" || brokerageFilter !== "all") && (
          <button
            className="btn btn-outline btn-xs"
            onClick={() => {
              setSupplierFilter("all");
              setPaymentStatusFilter("all");
              setBrokerageFilter("all");
            }}
            title="Reset all filters"
          >
            ✕ Reset Filters
          </button>
        )}
      </div>

      {/* Purchases Table */}
      {isLoading ? (
        <Spinner />
      ) : filteredPurchases.length === 0 ? (
        <EmptyState
          icon="📥"
          title="No Purchase Records Found"
          subtitle="Record new gemstone rough or cut stone intake into your inventory."
          action="+ Intake New Packet / Lot"
          onAction={() => navigate("/purchases/new")}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Date</th>
                  <th>Supplier / Mine</th>
                  <th>Lot Ref</th>
                  <th>Packets Created</th>
                  <th>Middleman Broker</th>
                  <th>Broker Payment</th>
                  <th>Credit Terms</th>
                  <th style={{ textAlign: "right" }}>Total Cost</th>
                  <th style={{ textAlign: "right" }}>Paid</th>
                  <th style={{ textAlign: "right" }}>Balance Due</th>
                  <th style={{ textAlign: "center" }}>Status & Supplier Pay</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((p) => {
                  const totalBrk = p.brokerage_amount || 0;
                  const paidBrk = p.brokerage_paid_amount || (p.brokerage_paid ? totalBrk : 0) || 0;
                  const balBrk = p.brokerage_balance_due !== undefined ? p.brokerage_balance_due : Math.max(0, totalBrk - paidBrk);
                  const isBrkPaid = balBrk <= 0 && (paidBrk > 0 || p.brokerage_paid);
                  const isBrkPartial = paidBrk > 0 && balBrk > 0;

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 800, color: "var(--primary)" }}>
                            {p.purchase_no}
                          </span>
                          {p.status === "cancelled" && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#ef4444",
                                padding: "1px 5px",
                                borderRadius: 4,
                                width: "fit-content",
                              }}
                            >
                              [RETURNED / CANCELLED]
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{shortDate(p.date)}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{p.supplier_name}</div>
                        {p.supplier_city && (
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            {p.supplier_city}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ color: "var(--muted)" }}>{p.lot_ref || "—"}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 220 }}>
                          {p.items?.map((it, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: "rgba(16, 185, 129, 0.1)",
                                color: "#059669",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                              title={`Box: ${it.box_name || 'Vault'} • ${it.particulars} • ${it.is_uncountable ? 'Bulk' : `${it.pieces !== undefined ? it.pieces : 1} pcs`}`}
                            >
                              {it.packet_number} ({it.weight}ct)
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {(p.broker_name || totalBrk > 0) ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 11 }}>{p.broker_name || "Middleman Broker"}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                              {p.brokerage_type === "percent" ? `${p.brokerage_rate}%` : "Manual"} (₹{totalBrk.toLocaleString("en-IN")})
                            </div>
                            {p.broker_phone && (
                              <div style={{ fontSize: 10, color: "var(--muted)" }}>📞 {p.broker_phone}</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>

                      {/* New Dedicated Column: Broker Payment */}
                      <td style={{ minWidth: 160 }}>
                        {(p.broker_name || totalBrk > 0) ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "space-between" }}>
                              <span
                                className="badge"
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  padding: "1px 5px",
                                  background: isBrkPaid ? "rgba(16, 185, 129, 0.15)" : isBrkPartial ? "rgba(245, 158, 11, 0.15)" : "rgba(107, 114, 128, 0.15)",
                                  color: isBrkPaid ? "#10b981" : isBrkPartial ? "#d97706" : "#6b7280",
                                  border: `1px solid ${isBrkPaid ? "rgba(16, 185, 129, 0.3)" : isBrkPartial ? "rgba(245, 158, 11, 0.3)" : "rgba(107, 114, 128, 0.3)"}`,
                                }}
                              >
                                {isBrkPaid ? "✓ Paid" : isBrkPartial ? "🔶 Partial" : "⏳ Pending"}
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--on-surface)" }}>
                                {formatINR(paidBrk)}
                              </span>
                            </div>

                            {balBrk > 0 && (
                              <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, textAlign: "right" }}>
                                Left: {formatINR(balBrk)}
                              </div>
                            )}

                            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                style={{
                                  fontSize: 9,
                                  padding: "2px 5px",
                                  height: 20,
                                  color: "var(--primary)",
                                  borderColor: "var(--primary)",
                                  fontWeight: 700,
                                }}
                                onClick={() => openBrokerPaymentModal(p)}
                                title="Record partial or full payment to broker"
                              >
                                💳 Pay Broker
                              </button>

                              {!isBrkPaid && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  style={{
                                    fontSize: 9,
                                    padding: "2px 5px",
                                    height: 20,
                                    color: "var(--success)",
                                    fontWeight: 700,
                                    background: "rgba(16, 185, 129, 0.1)",
                                  }}
                                  onClick={() => markBrokerFullPaymentMutation.mutate({ id: p.id })}
                                  title="Mark full broker fee paid in 1-click"
                                >
                                  ✓ Full
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>

                      <td>
                        {p.credit_days && p.credit_days > 0 ? (
                          <div>
                            <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: 11 }}>
                              {p.credit_days} Days
                            </span>
                            {p.due_date && (
                              <div style={{ fontSize: 10, color: "var(--muted)" }}>
                                Due: {shortDate(p.due_date)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>Immediate</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800 }}>
                        {formatINR(p.total_cost)}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--success)", fontWeight: 700 }}>
                        {formatINR(p.paid_amount)}
                      </td>
                      <td style={{ textAlign: "right", color: p.balance_payable > 0 ? "#ef4444" : "var(--muted)", fontWeight: 800 }}>
                        {formatINR(p.balance_payable)}
                      </td>

                      {/* Status Column with Supplier Partial & Full Payment Controls */}
                      <td style={{ textAlign: "center", minWidth: 140 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
                          <PayBadge status={p.payment_status} />
                          {p.balance_payable > 0 ? (
                            <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                style={{
                                  fontSize: 9,
                                  padding: "2px 5px",
                                  height: 20,
                                  color: "#059669",
                                  borderColor: "rgba(16, 185, 129, 0.4)",
                                  fontWeight: 700,
                                }}
                                onClick={() => openPaymentModal(p)}
                                title="Record partial payment to supplier"
                              >
                                💳 Pay Supplier
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                style={{
                                  fontSize: 9,
                                  padding: "2px 5px",
                                  height: 20,
                                  color: "#059669",
                                  fontWeight: 700,
                                  background: "rgba(16, 185, 129, 0.1)",
                                }}
                                onClick={() => {
                                  if (window.confirm(`Mark full balance of ${formatINR(p.balance_payable)} paid for voucher ${p.purchase_no}?`)) {
                                    markFullPaymentMutation.mutate({ id: p.id });
                                  }
                                }}
                                title="Mark full supplier payment cleared"
                              >
                                ✓ Full
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 9, color: "var(--success)", fontWeight: 700 }}>
                              ✓ Cleared
                            </span>
                          )}
                        </div>
                      </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                        {p.balance_payable > 0 && (
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{
                              color: "#059669",
                              background: "rgba(16, 185, 129, 0.1)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                            onClick={() => openPaymentModal(p)}
                            title="Record installment payment to supplier"
                          >
                            💳 Pay
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ color: "#0f4c5c" }}
                          onClick={() => printPurchaseVoucher(p)}
                          title="Print official Purchase Intake Voucher"
                        >
                          🖨️
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ color: "var(--primary)" }}
                          onClick={() => navigate(`/purchases/${p.id}/edit`)}
                          title="Edit Purchase"
                        >
                          ✏️
                        </button>
                        {p.status !== "cancelled" && (
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{ color: "#d97706" }}
                            onClick={() => {
                              const reason = window.prompt(
                                `Cancel & return purchase ${p.purchase_no} to supplier ${p.supplier_name}?\n\nThis will withdraw all associated packets from vault inventory while keeping this purchase record preserved for your cross-reference.\n\nEnter return note (optional):`
                              );
                              if (reason !== null) {
                                cancelPurchaseMutation.mutate({ id: p.id, reason });
                              }
                            }}
                            title="Cancel Purchase & Return to Supplier"
                          >
                            ↩️
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ color: "var(--danger)" }}
                          onClick={() => {
                            if (window.confirm(`Delete purchase record ${p.purchase_no}? This will also delete any packets created by this purchase from vault stock.`)) {
                              deletePurchaseMutation.mutate(p.id);
                            }
                          }}
                          title="Delete Purchase & Remove Stock"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Installment Modal */}
      {paymentModalPurchase && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setPaymentModalPurchase(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 520,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                  💳 Record Supplier Payment Installment
                </h2>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Voucher: <strong>{paymentModalPurchase.purchase_no}</strong> • Supplier: <strong>{paymentModalPurchase.supplier_name}</strong>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setPaymentModalPurchase(null)}
              >
                ✕
              </button>
            </div>

            {/* Financial Status Summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
                background: "var(--surface-sunken)",
                padding: 12,
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Total Cost</div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{formatINR(paymentModalPurchase.total_cost)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Already Paid</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--success)" }}>{formatINR(paymentModalPurchase.paid_amount)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Balance Due</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "var(--danger)" }}>{formatINR(paymentModalPurchase.balance_payable)}</div>
              </div>
            </div>

            {/* Existing Payments History */}
            {paymentModalPurchase.payments && paymentModalPurchase.payments.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
                  Payment History ({paymentModalPurchase.payments.length} installment{paymentModalPurchase.payments.length > 1 ? "s" : ""})
                </div>
                <div style={{ maxHeight: 110, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
                  <table className="table" style={{ width: "100%", fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Mode</th>
                        <th>Note</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentModalPurchase.payments.map((pm) => (
                        <tr key={pm.id}>
                          <td>{shortDate(pm.date)}</td>
                          <td>{pm.mode}</td>
                          <td>{pm.note || "—"}</td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>{formatINR(pm.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Settled / Overpayment Alerts */}
            {paymentModalPurchase.balance_payable <= 0 && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: 6,
                  color: "#065f46",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                ✓ Supplier Account is Fully Settled (₹0 Balance Payable)
              </div>
            )}
            {paymentAmount > paymentModalPurchase.balance_payable && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "#fef2f2",
                  border: "1px solid #f87171",
                  borderRadius: 6,
                  color: "#b91c1c",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                ⚠️ Error: Payment amount ({formatINR(paymentAmount)}) cannot exceed remaining balance payable of {formatINR(paymentModalPurchase.balance_payable)}!
              </div>
            )}

            {/* Form */}
            <form onSubmit={handlePaymentSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label" style={{ fontSize: 11 }}>Payment Date*</label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label" style={{ fontSize: 11 }}>Installment Amount (₹)*</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={paymentModalPurchase.balance_payable}
                    disabled={paymentModalPurchase.balance_payable <= 0}
                    className="input"
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label className="label" style={{ fontSize: 11 }}>Payment Mode</label>
                <select
                  className="select"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  <option value="Bank Wire / NEFT">Bank Wire / NEFT / RTGS</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Angadia">Angadia</option>
                </select>
              </div>

              <div>
                <label className="label" style={{ fontSize: 11 }}>Reference / Note</label>
                <input
                  type="text"
                  placeholder="e.g. UTR / Cheque #99211"
                  className="input"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ color: "var(--success)" }}
                  onClick={() => {
                    if (window.confirm(`Mark full remaining balance of ${formatINR(paymentModalPurchase.balance_payable)} paid for voucher ${paymentModalPurchase.purchase_no}?`)) {
                      markFullPaymentMutation.mutate({ id: paymentModalPurchase.id });
                    }
                  }}
                  disabled={markFullPaymentMutation.isPending || paymentModalPurchase.balance_payable <= 0}
                >
                  ✓ Pay Full Remaining Balance
                </button>

                <div style={{ flex: 1 }} />

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPaymentModalPurchase(null)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={
                    addPaymentMutation.isPending ||
                    paymentModalPurchase.balance_payable <= 0 ||
                    paymentAmount > paymentModalPurchase.balance_payable
                  }
                >
                  {addPaymentMutation.isPending ? "Recording..." : "Save Installment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Broker Payment */}
      {brokerPaymentPurchase && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setBrokerPaymentPurchase(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 500,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🤝</span> Record Middleman Broker Payment
                </h2>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  Voucher: <strong>{brokerPaymentPurchase.purchase_no}</strong> • Broker: <strong>{brokerPaymentPurchase.broker_name || "Middleman Broker"}</strong>
                </div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setBrokerPaymentPurchase(null)}>
                ✕
              </button>
            </div>

            {/* Balances summary */}
            {(() => {
              const totalBrk = Number(brokerPaymentPurchase.brokerage_amount) || 0;
              const paidBrk = (brokerPaymentPurchase.broker_payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
              const balBrk = Math.max(0, totalBrk - paidBrk);
              const isOverpaid = brokerPayAmount > balBrk;
              const isAlreadySettled = balBrk <= 0;

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 8,
                      background: "var(--surface-sunken)",
                      padding: 12,
                      borderRadius: 8,
                      textAlign: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Total Brokerage</div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{formatINR(totalBrk)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Already Paid</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>{formatINR(paidBrk)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Remaining Due</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#ef4444" }}>{formatINR(balBrk)}</div>
                    </div>
                  </div>

                  {isAlreadySettled && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        borderRadius: 6,
                        color: "#065f46",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      ✓ Middleman Brokerage Fee is Already Fully Settled (₹0 Due)
                    </div>
                  )}

                  {isOverpaid && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "#fef2f2",
                        border: "1px solid #f87171",
                        borderRadius: 6,
                        color: "#b91c1c",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      ⚠️ Error: Payment amount ({formatINR(brokerPayAmount)}) cannot exceed remaining broker balance due of {formatINR(balBrk)}!
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Form */}
            <form onSubmit={handleBrokerPaymentSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label" style={{ fontSize: 11 }}>Payment Date*</label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={brokerPayDate}
                    onChange={(e) => setBrokerPayDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label" style={{ fontSize: 11 }}>Payment Amount (₹)*</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={(() => {
                      const totalBrk = Number(brokerPaymentPurchase.brokerage_amount) || 0;
                      const paidBrk = (brokerPaymentPurchase.broker_payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                      return Math.max(0, totalBrk - paidBrk);
                    })()}
                    disabled={(() => {
                      const totalBrk = Number(brokerPaymentPurchase.brokerage_amount) || 0;
                      const paidBrk = (brokerPaymentPurchase.broker_payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                      return Math.max(0, totalBrk - paidBrk) <= 0;
                    })()}
                    className="input"
                    value={brokerPayAmount || ""}
                    onChange={(e) => setBrokerPayAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label className="label" style={{ fontSize: 11 }}>Payment Mode</label>
                <select
                  className="select"
                  value={brokerPayMode}
                  onChange={(e) => setBrokerPayMode(e.target.value)}
                >
                  <option value="Bank Wire / NEFT">Bank Wire / NEFT / RTGS</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="Angadia">Angadia</option>
                </select>
              </div>

              <div>
                <label className="label" style={{ fontSize: 11 }}>Reference / Note</label>
                <input
                  type="text"
                  placeholder="e.g. UTR / Broker payout receipt"
                  className="input"
                  value={brokerPayNote}
                  onChange={(e) => setBrokerPayNote(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ color: "var(--success)" }}
                  onClick={() => {
                    const totalBrk = Number(brokerPaymentPurchase.brokerage_amount) || 0;
                    const paidBrk = (brokerPaymentPurchase.broker_payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                    const balBrk = Math.max(0, totalBrk - paidBrk);
                    if (window.confirm(`Mark full remaining broker fee of ${formatINR(balBrk)} paid for voucher ${brokerPaymentPurchase.purchase_no}?`)) {
                      markBrokerFullPaymentMutation.mutate({ id: brokerPaymentPurchase.id });
                    }
                  }}
                  disabled={
                    markBrokerFullPaymentMutation.isPending ||
                    (() => {
                      const totalBrk = Number(brokerPaymentPurchase.brokerage_amount) || 0;
                      const paidBrk = (brokerPaymentPurchase.broker_payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                      return Math.max(0, totalBrk - paidBrk) <= 0;
                    })()
                  }
                >
                  ✓ Settle Full Broker Fee
                </button>

                <div style={{ flex: 1 }} />

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setBrokerPaymentPurchase(null)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={
                    addBrokerPaymentMutation.isPending ||
                    (() => {
                      const totalBrk = Number(brokerPaymentPurchase.brokerage_amount) || 0;
                      const paidBrk = (brokerPaymentPurchase.broker_payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                      const balBrk = Math.max(0, totalBrk - paidBrk);
                      return balBrk <= 0 || brokerPayAmount > balBrk;
                    })()
                  }
                >
                  {addBrokerPaymentMutation.isPending ? "Recording..." : "Save Broker Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Filter by Supplier & Print Purchase Register */}
      {printRegisterModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setPrintRegisterModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 520,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🖨️</span> Print Purchase Register
                </h2>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  Filter by supplier name to print only that supplier's purchase details and lots.
                </div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setPrintRegisterModalOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label" style={{ fontWeight: 700 }}>
                  Select Supplier:
                </label>
                <select
                  className="select"
                  style={{ width: "100%" }}
                  value={selectedPrintSupplier}
                  onChange={(e) => setSelectedPrintSupplier(e.target.value)}
                >
                  <option value="all">🏢 All Suppliers ({purchases.length} lots)</option>
                  {uniqueSuppliers.map((s) => {
                    const count = purchases.filter(
                      (p) => (p.supplier_name || "").trim().toLowerCase() === s.toLowerCase()
                    ).length;
                    return (
                      <option key={s} value={s}>
                        👤 {s} ({count} lot{count > 1 ? "s" : ""})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Summary preview for selected supplier */}
              <div
                style={{
                  background: "var(--surface-sunken)",
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                {(() => {
                  let filtered = purchases;
                  if (selectedPrintSupplier !== "all") {
                    filtered = filtered.filter(
                      (p) => (p.supplier_name || "").trim().toLowerCase() === selectedPrintSupplier.toLowerCase()
                    );
                  }
                  const totalPkts = filtered.reduce((sum, p) => sum + (p.items?.length || 0), 0);
                  const totalCarats = filtered.reduce((sum, p) => sum + (p.items || []).reduce((is, it) => is + (it.weight || 0), 0), 0);
                  const totalCost = filtered.reduce((sum, p) => sum + (p.total_cost || 0), 0);
                  const totalBal = filtered.reduce((sum, p) => sum + (p.balance_payable || 0), 0);

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontWeight: 800, color: "var(--primary)" }}>
                        {selectedPrintSupplier === "all" ? "All Suppliers" : selectedPrintSupplier} — Preview:
                      </div>
                      <div>
                        Purchases / Lots: <strong>{filtered.length}</strong> · Packets Created: <strong>{totalPkts} pkts</strong> ({totalCarats.toFixed(2)} cts)
                      </div>
                      <div>
                        Total Cost: <strong>{formatINR(totalCost)}</strong> · Balance Payable: <strong style={{ color: totalBal > 0 ? "#ef4444" : "var(--muted)" }}>{formatINR(totalBal)}</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setPrintRegisterModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const sName = selectedPrintSupplier !== "all" ? selectedPrintSupplier : undefined;
                  const label = sName ? `Supplier: ${sName}` : undefined;
                  setPrintRegisterModalOpen(false);
                  printPurchaseRegister(purchases, label, sName);
                }}
              >
                🖨️ Print Purchase Register for {selectedPrintSupplier === "all" ? "All Suppliers" : selectedPrintSupplier}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
