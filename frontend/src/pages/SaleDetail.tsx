import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../api";
import { Spinner, PayBadge } from "../ui";
import { formatINR, shortDate, amountToWords } from "../format";
import type { GemSale } from "../types/gemstone";
import { QREncoder } from "../qrCode";
import { useToast } from "../toast";

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState("Bank Wire / NEFT");
  const [payNote, setPayNote] = useState("");

  const { data: sale, isLoading, isError } = useQuery<GemSale>({
    queryKey: ["sale", id],
    queryFn: () => apiGet(`/sales/${id}`),
    enabled: !!id,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (pmPayload: any) => apiPost(`/sales/${id}/payments`, pmPayload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sale", id] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      setPaymentModalOpen(false);
      setPayAmount(0);
      setPayNote("");
      show("Payment recorded successfully!", "success");
    },
    onError: (err: any) => show("Payment recording failed: " + err.message, "error"),
  });

  if (isLoading) return <div className="page-body"><Spinner /></div>;
  if (isError || !sale) {
    return (
      <div className="page-body">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>Invoice Not Found</h3>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/sales")}>
            Back to Sales
          </button>
        </div>
      </div>
    );
  }

  const qrSvg = QREncoder.toSVG(
    `SHREEJI GEMS INVOICE: ${sale.invoice_no}\nBuyer: ${sale.buyer_name}\nTotal: ${formatINR(sale.total)}\nReceived: ${formatINR(sale.paid_amount)}\nBalance: ${formatINR(sale.balance)}\nDate: ${sale.date}`,
    120,
    4
  );

  const handlePrint = () => {
    window.print();
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) {
      show("Please enter a valid payment amount", "warning");
      return;
    }
    recordPaymentMutation.mutate({
      amount: payAmount,
      mode: payMode,
      note: payNote,
      date: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="page-body" style={{ maxWidth: 880, margin: "0 auto", gap: 20 }}>
      {/* Top Action Bar (hidden on print) */}
      <div
        className="hide-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/sales")}>
          ← Back to Sales
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          {sale.balance > 0 && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setPayAmount(sale.balance);
                setPaymentModalOpen(true);
              }}
            >
              💳 Record Payment
            </button>
          )}
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate(`/sales/${sale.id}/edit`)}
          >
            ✏️ Edit Invoice
          </button>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            🖨️ Print Invoice
          </button>
        </div>
      </div>

      {/* Luxury Printable Invoice Sheet */}
      <div
        className="card"
        style={{
          padding: 36,
          background: "#ffffff",
          color: "#0f172a",
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Header with Letterhead */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "2px solid #0f172a",
            paddingBottom: 20,
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 28 }}>💎</span>
              <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: "1px", color: "#0f172a" }}>
                SHREEJI GEMS
              </h1>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#047857", marginTop: 2 }}>
              PRECIOUS GEMSTONES & HIGH JEWELRY
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
              Bharat Diamond Bourse / Zaveri Bazaar, Mumbai<br />
              Email: contact@shreejigems.com • 100% Secure Local Registry
            </div>
          </div>

          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div dangerouslySetInnerHTML={{ __html: qrSvg }} style={{ marginBottom: 4 }} />
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
              {sale.invoice_no}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Date: <strong>{shortDate(sale.date)}</strong>
            </div>
          </div>
        </div>

        {/* Client & Bill Info Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 24,
            padding: "12px 16px",
            background: "#f8fafc",
            borderRadius: 6,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
              Billed To (Buyer)
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginTop: 2 }}>
              {sale.buyer_name}
            </div>
            {sale.buyer_phone && <div style={{ fontSize: 12, color: "#475569" }}>Tel: {sale.buyer_phone}</div>}
            {sale.buyer_city && <div style={{ fontSize: 12, color: "#475569" }}>City: {sale.buyer_city}</div>}
            {sale.buyer_address && <div style={{ fontSize: 12, color: "#475569" }}>{sale.buyer_address}</div>}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
              Payment Status
            </div>
            <div style={{ marginTop: 4 }}>
              <PayBadge status={sale.payment_status} />
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
              Payment Mode: <strong>{sale.payment_mode || "Bank Wire / NEFT"}</strong>
            </div>
            {sale.due_date && (
              <div style={{ fontSize: 12, color: "#d97706" }}>
                Payment Due: <strong>{shortDate(sale.due_date)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Gemstone Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 13, color: "#0f172a" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #0f172a", background: "#f1f5f9", color: "#0f172a" }}>
              <th style={{ padding: "8px 10px", textAlign: "left", color: "#0f172a", fontWeight: 800 }}>Packet #</th>
              <th style={{ padding: "8px 10px", textAlign: "left", color: "#0f172a", fontWeight: 800 }}>Description / Gemstone</th>
              <th style={{ padding: "8px 10px", textAlign: "left", color: "#0f172a", fontWeight: 800 }}>Shape & Size</th>
              <th style={{ padding: "8px 10px", textAlign: "right", color: "#0f172a", fontWeight: 800 }}>Weight (cts)</th>
              <th style={{ padding: "8px 10px", textAlign: "center", color: "#0f172a", fontWeight: 800 }}>Pcs</th>
              <th style={{ padding: "8px 10px", textAlign: "right", color: "#0f172a", fontWeight: 800 }}>Rate / Ct</th>
              <th style={{ padding: "8px 10px", textAlign: "right", color: "#0f172a", fontWeight: 800 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items && sale.items.length > 0 ? (
              sale.items.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>
                  <td style={{ padding: "10px 10px", fontWeight: 800, color: "#0f172a" }}>{it.packet_number}</td>
                  <td style={{ padding: "10px 10px", color: "#0f172a" }}>
                    <strong style={{ color: "#0f172a" }}>{it.particulars}</strong>
                  </td>
                  <td style={{ padding: "10px 10px", color: "#334155" }}>
                    {it.shape} {it.mm_size && `(${it.mm_size})`}
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                    {it.weight} {it.unit || "cts"}
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: "#0f172a" }}>{it.pieces}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", color: "#0f172a" }}>
                    {formatINR(it.rate_per_unit || it.rate_per_ct || 0)}
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>
                    {formatINR(it.total_price)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#64748b", fontStyle: "italic" }}>
                  All approval memo stones were returned to vault inventory. (₹0 billable balance)
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Total Calculations */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div style={{ maxWidth: 440 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Amount in Words:
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, fontStyle: "italic", marginTop: 2, color: "#0f172a" }}>
              {amountToWords(sale.total)}
            </div>
            {sale.notes && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#475569" }}>
                <strong>Terms / Notes:</strong> {sale.notes}
              </div>
            )}
          </div>

          <div style={{ minWidth: 240, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Subtotal:</span>
              <span>{formatINR(sale.subtotal)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "2px solid #0f172a",
                paddingTop: 6,
                fontSize: 16,
                fontWeight: 900,
                color: "#0f172a",
              }}
            >
              <span>Total Amount:</span>
              <span>{formatINR(sale.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#059669", fontWeight: 700 }}>
              <span>Total Paid:</span>
              <span>{formatINR(sale.paid_amount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: sale.balance > 0 ? "#d97706" : "#64748b", fontWeight: 800 }}>
              <span>Balance Due:</span>
              <span>{formatINR(sale.balance)}</span>
            </div>
          </div>
        </div>

        {/* Payment History */}
        {sale.payments && sale.payments.length > 0 && (
          <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>
              Settlement Records
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {sale.payments.map((pm) => (
                <div
                  key={pm.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    background: "#f8fafc",
                    padding: "6px 10px",
                    borderRadius: 4,
                  }}
                >
                  <span>
                    {shortDate(pm.date)} • <strong>{pm.mode}</strong> {pm.note && `(${pm.note})`}
                  </span>
                  <strong style={{ color: "#059669" }}>{formatINR(pm.amount)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Authenticity Signature footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingTop: 30,
            borderTop: "1px solid #e2e8f0",
            fontSize: 11,
            color: "#64748b",
          }}
        >
          <div>
            1. All gemstones guaranteed natural as represented.<br />
            2. High jewelry vault receipt verified by encrypted local QR.<br />
            3. Subject to Mumbai Jurisdiction.
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 140, borderBottom: "1px solid #0f172a", marginBottom: 4 }} />
            <strong>Authorized Signatory</strong>
            <div style={{ fontSize: 10 }}>Shreeji Gems</div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {paymentModalOpen && (
        <div className="modal-overlay" onClick={() => setPaymentModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                Record Payment for {sale.invoice_no}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setPaymentModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ gap: 12 }}>
                <div style={{ background: "var(--surface-sunken)", padding: "10px 12px", borderRadius: 6, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Total Bill:</span>
                    <strong>{formatINR(sale.total)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#f59e0b" }}>
                    <span>Current Balance Due:</span>
                    <strong>{formatINR(sale.balance)}</strong>
                  </div>
                </div>

                <div>
                  <label className="label">Payment Amount (₹)*</label>
                  <input
                    type="number"
                    required
                    className="input"
                    value={payAmount || ""}
                    onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label className="label">Payment Mode</label>
                  <select
                    className="select"
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                  >
                    <option value="Bank Wire / NEFT">Bank Wire / NEFT / RTGS</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">PDC / Cheque</option>
                    <option value="Angadia">Angadia Courier</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>

                <div>
                  <label className="label">Reference / Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Bank Ref UTR-998201"
                    className="input"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={recordPaymentMutation.isPending}
                >
                  {recordPaymentMutation.isPending ? "Recording..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
