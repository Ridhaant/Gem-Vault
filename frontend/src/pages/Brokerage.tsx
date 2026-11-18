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
  const [partySettlementFilter, setPartySettlementFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Partial<GemBrokerage> | null>(null);

  // Counterparty Settlement Modal state
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [settlementDeal, setSettlementDeal] = useState<GemBrokerage | null>(null);
  const [settlementActionType, setSettlementActionType] = useState<
    "paid_seller" | "received_buyer" | "none" | "complete"
  >("paid_seller");

  // Counterparty payment fields
  const [sellerPayAmount, setSellerPayAmount] = useState<number>(0);
  const [sellerPayDate, setSellerPayDate] = useState<string>("");
  const [sellerPayMode, setSellerPayMode] = useState<string>("Bank Wire / NEFT");
  const [sellerPayNote, setSellerPayNote] = useState<string>("");

  const [buyerRecvAmount, setBuyerRecvAmount] = useState<number>(0);
  const [buyerRecvDate, setBuyerRecvDate] = useState<string>("");
  const [buyerRecvMode, setBuyerRecvMode] = useState<string>("Bank Wire / NEFT");
  const [buyerRecvNote, setBuyerRecvNote] = useState<string>("");

  // Payment History Viewer state
  const [paymentHistoryDeal, setPaymentHistoryDeal] = useState<GemBrokerage | null>(null);
  const [historyTab, setHistoryTab] = useState<"all" | "seller" | "buyer" | "commission">("all");
  const [newPayTarget, setNewPayTarget] = useState<"seller" | "buyer" | "commission">("seller");
  const [newPayAmount, setNewPayAmount] = useState<number>(0);
  const [newPayDate, setNewPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newPayMode, setNewPayMode] = useState<string>("Bank Wire / NEFT");
  const [newPayNote, setNewPayNote] = useState<string>("");

  // Pagination for high-volume brokerage datasets
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

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
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      setModalOpen(false);
      setEditingDeal(null);
      show("Brokerage deal saved & reflected in outside stock sales and expenses!", "success");
    },
    onError: (err: any) => show("Error saving deal: " + err.message, "error"),
  });

  const deleteDealMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/brokerage/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokerage"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Brokerage deal deleted", "info");
    },
    onError: (err: any) => show("Error deleting deal: " + err.message, "error"),
  });

  const clearBuyersMutation = useMutation({
    mutationFn: () => apiDelete("/buyers"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      show("Saved counterparty suggestions cleared", "success");
    },
    onError: (err: any) => show("Error clearing suggestions: " + err.message, "error"),
  });

  const addBrokeragePaymentMutation = useMutation({
    mutationFn: async ({
      dealId,
      type,
      payment,
    }: {
      dealId: string;
      type: "seller" | "buyer" | "commission";
      payment: { amount: number; mode: string; date: string; note: string };
    }) => {
      const endpoint =
        type === "seller"
          ? `/brokerage/${dealId}/seller-payment`
          : type === "buyer"
          ? `/brokerage/${dealId}/buyer-payment`
          : `/brokerage/${dealId}/commission-payment`;
      return apiPost(endpoint, payment);
    },
    onSuccess: (updatedDeal: GemBrokerage) => {
      queryClient.invalidateQueries({ queryKey: ["brokerage"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      setPaymentHistoryDeal(updatedDeal);
      setNewPayAmount(0);
      setNewPayNote("");
      show("Payment recorded successfully & balances updated!", "success");
    },
    onError: (err: any) => show("Error recording payment: " + err.message, "error"),
  });

  const totalPendingCommissions = deals.reduce((sum, d) => sum + (d.balance_receivable || 0), 0);
  const pendingDealsCount = deals.filter((d) => d.settlement_status !== "received").length;

  const paidSellerPendingBuyerDeals = deals.filter(
    (d) => (d.deal_settlement_status || "paid_seller_pending_buyer") === "paid_seller_pending_buyer"
  );
  const totalPaidSellerPendingBuyerAmount = paidSellerPendingBuyerDeals.reduce(
    (sum, d) => sum + (d.sell_amount || d.deal_value || 0),
    0
  );

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
    if (partySettlementFilter !== "all") {
      result = result.filter((d) => (d.deal_settlement_status || "paid_seller_pending_buyer") === partySettlementFilter);
    }
    if (companyFilter !== "all") {
      result = result.filter((d) => d.company_name === companyFilter);
    }
    if (dateFilter) {
      result = result.filter((d) => d.date === dateFilter);
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [deals, searchTerm, statusFilter, partySettlementFilter, companyFilter, dateFilter]);

  const totalPages = Math.ceil(filteredDeals.length / pageSize) || 1;
  const paginatedDeals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDeals.slice(start, start + pageSize);
  }, [filteredDeals, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, partySettlementFilter, companyFilter, dateFilter]);

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
      pieces: 0,
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
      deal_settlement_status: "paid_seller_pending_buyer",
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

  const handleOpenSettlement = (
    deal: GemBrokerage,
    action: "paid_seller" | "received_buyer" | "none" | "complete"
  ) => {
    setSettlementDeal(deal);
    setSettlementActionType(action);
    const today = new Date().toISOString().slice(0, 10);

    const buyAmt = Number(deal.buy_amount) || 0;
    const sellAmt = Number(deal.sell_amount || deal.deal_value) || 0;
    const prevPaidSeller = (deal.seller_payments && deal.seller_payments.length > 0)
      ? deal.seller_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      : Number(deal.amount_paid_to_seller) || 0;
    const prevRecvBuyer = (deal.buyer_payments && deal.buyer_payments.length > 0)
      ? deal.buyer_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      : Number(deal.amount_received_from_buyer) || 0;

    const remainingSeller = Math.max(0, buyAmt - prevPaidSeller);
    const remainingBuyer = Math.max(0, sellAmt - prevRecvBuyer);

    if (action === "paid_seller") {
      setSellerPayAmount(remainingSeller);
      setSellerPayDate(today);
      setSellerPayMode(deal.mode_paid_to_seller || deal.payment_mode || "Bank Wire / NEFT");
      setSellerPayNote("");

      setBuyerRecvAmount(0);
      setBuyerRecvDate("");
      setBuyerRecvMode(deal.mode_received_from_buyer || deal.payment_mode || "Bank Wire / NEFT");
      setBuyerRecvNote("");
    } else if (action === "received_buyer") {
      setSellerPayAmount(0);
      setSellerPayDate("");
      setSellerPayMode(deal.mode_paid_to_seller || "Bank Wire / NEFT");
      setSellerPayNote("");

      setBuyerRecvAmount(remainingBuyer);
      setBuyerRecvDate(today);
      setBuyerRecvMode(deal.mode_received_from_buyer || deal.payment_mode || "Bank Wire / NEFT");
      setBuyerRecvNote("");
    } else if (action === "none") {
      setSellerPayAmount(0);
      setSellerPayDate("");
      setSellerPayMode("Bank Wire / NEFT");
      setSellerPayNote("");

      setBuyerRecvAmount(0);
      setBuyerRecvDate("");
      setBuyerRecvMode("Bank Wire / NEFT");
      setBuyerRecvNote("");
    } else if (action === "complete") {
      setSellerPayAmount(remainingSeller);
      setSellerPayDate(today);
      setSellerPayMode(deal.mode_paid_to_seller || deal.payment_mode || "Bank Wire / NEFT");
      setSellerPayNote("");

      setBuyerRecvAmount(remainingBuyer);
      setBuyerRecvDate(today);
      setBuyerRecvMode(deal.mode_received_from_buyer || deal.payment_mode || "Bank Wire / NEFT");
      setBuyerRecvNote("");
    }

    setSettlementModalOpen(true);
  };

  const handleSaveSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementDeal) return;

    const buyAmt = Number(settlementDeal.buy_amount) || 0;
    const sellAmt = Number(settlementDeal.sell_amount || settlementDeal.deal_value) || 0;

    const prevPaidSeller = (settlementDeal.seller_payments && settlementDeal.seller_payments.length > 0)
      ? settlementDeal.seller_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      : Number(settlementDeal.amount_paid_to_seller) || 0;

    const prevRecvBuyer = (settlementDeal.buyer_payments && settlementDeal.buyer_payments.length > 0)
      ? settlementDeal.buyer_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      : Number(settlementDeal.amount_received_from_buyer) || 0;

    const remainingSeller = Math.max(0, buyAmt - prevPaidSeller);
    const remainingBuyer = Math.max(0, sellAmt - prevRecvBuyer);

    const newPaySeller = Number(sellerPayAmount) || 0;
    const newRecvBuyer = Number(buyerRecvAmount) || 0;

    if (remainingSeller > 0 && newPaySeller > remainingSeller) {
      show(`Payment to seller (${formatINR(newPaySeller)}) cannot exceed remaining balance due of ${formatINR(remainingSeller)}`, "error");
      return;
    }
    if (remainingBuyer > 0 && newRecvBuyer > remainingBuyer) {
      show(`Payment received from buyer (${formatINR(newRecvBuyer)}) cannot exceed remaining balance receivable of ${formatINR(remainingBuyer)}`, "error");
      return;
    }

    let updatedSellerPayments = [...(settlementDeal.seller_payments || [])];
    if (newPaySeller > 0) {
      updatedSellerPayments.push({
        id: "sp-" + Math.random().toString(36).substring(2, 9),
        date: sellerPayDate || new Date().toISOString().slice(0, 10),
        amount: newPaySeller,
        mode: (sellerPayMode || "Bank Wire / NEFT") as any,
        note: sellerPayNote ? sellerPayNote.trim() : "Settlement installment to seller",
      });
    }

    let updatedBuyerPayments = [...(settlementDeal.buyer_payments || [])];
    if (newRecvBuyer > 0) {
      updatedBuyerPayments.push({
        id: "bp-" + Math.random().toString(36).substring(2, 9),
        date: buyerRecvDate || new Date().toISOString().slice(0, 10),
        amount: newRecvBuyer,
        mode: (buyerRecvMode || "Bank Wire / NEFT") as any,
        note: buyerRecvNote ? buyerRecvNote.trim() : "Settlement installment from buyer",
      });
    }

    const totalPaidSeller = prevPaidSeller + newPaySeller;
    const totalRecvBuyer = prevRecvBuyer + newRecvBuyer;

    const isSellerFullyPaid = buyAmt > 0 ? totalPaidSeller >= buyAmt : totalPaidSeller > 0;
    const isBuyerFullyRecv = sellAmt > 0 ? totalRecvBuyer >= sellAmt : totalRecvBuyer > 0;

    let nextStatus: GemBrokerage["deal_settlement_status"] = "pending_both";
    if (isSellerFullyPaid && isBuyerFullyRecv) {
      nextStatus = "fully_settled";
    } else if (isSellerFullyPaid && !isBuyerFullyRecv) {
      nextStatus = "paid_seller_pending_buyer";
    } else if (!isSellerFullyPaid && isBuyerFullyRecv) {
      nextStatus = "paid_buyer_pending_seller";
    } else if (totalPaidSeller > 0 || totalRecvBuyer > 0) {
      nextStatus = "partial_settled";
    } else {
      nextStatus = "pending_both";
    }

    const updated: GemBrokerage = {
      ...settlementDeal,
      deal_settlement_status: nextStatus,
      seller_payments: updatedSellerPayments,
      buyer_payments: updatedBuyerPayments,
      amount_paid_to_seller: totalPaidSeller,
      date_paid_to_seller: newPaySeller > 0 ? sellerPayDate : settlementDeal.date_paid_to_seller,
      mode_paid_to_seller: newPaySeller > 0 ? sellerPayMode : settlementDeal.mode_paid_to_seller,
      note_paid_to_seller: newPaySeller > 0 ? sellerPayNote : settlementDeal.note_paid_to_seller,
      amount_received_from_buyer: totalRecvBuyer,
      date_received_from_buyer: newRecvBuyer > 0 ? buyerRecvDate : settlementDeal.date_received_from_buyer,
      mode_received_from_buyer: newRecvBuyer > 0 ? buyerRecvMode : settlementDeal.mode_received_from_buyer,
      note_received_from_buyer: newRecvBuyer > 0 ? buyerRecvNote : settlementDeal.note_received_from_buyer,
    };

    saveDealMutation.mutate(updated);
    setSettlementModalOpen(false);
    setSettlementDeal(null);
    show("Settlement installment recorded and added to history log successfully!", "success");
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

      {/* KPI Cards */}
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

        {/* Paid to Seller, Pending from Buyer Card */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #ec4899" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Paid to Seller, Pending Buyer
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#ec4899", marginTop: 4 }}>
            {paidSellerPendingBuyerDeals.length} Deals
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Valued at {formatINR(totalPaidSellerPendingBuyerAmount)} (Funds deployed to seller)
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
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Party Status:</label>
          <select
            className="select"
            value={partySettlementFilter}
            onChange={(e) => setPartySettlementFilter(e.target.value)}
          >
            <option value="all">All Counterparties</option>
            <option value="paid_seller_pending_buyer">⚠️ Paid Seller, Pending Buyer</option>
            <option value="pending_both">⏳ Pending Both</option>
            <option value="paid_buyer_pending_seller">🔄 Paid Buyer, Pending Seller</option>
            <option value="partial_settled">🔶 Partial Settlement</option>
            <option value="fully_settled">✅ Fully Settled</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Commission:</label>
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
                  <th style={{ textAlign: "center" }}>Party Settlement</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDeals.map((d) => (
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

                    {/* Party Settlement Status & Action Buttons */}
                    <td style={{ textAlign: "center", minWidth: 200, padding: "8px 6px" }}>
                      {(() => {
                        const buyAmt = d.buy_amount || 0;
                        const sellAmt = d.sell_amount || d.deal_value || 0;
                        const paidSeller = Number(d.amount_paid_to_seller) || 0;
                        const recvBuyer = Number(d.amount_received_from_buyer) || 0;
                        const leftSeller = Math.max(0, buyAmt - paidSeller);
                        const leftBuyer = Math.max(0, sellAmt - recvBuyer);
                        const isSellerDone = buyAmt > 0 ? paidSeller >= buyAmt : paidSeller > 0;
                        const isBuyerDone = sellAmt > 0 ? recvBuyer >= sellAmt : recvBuyer > 0;

                        let badge;
                        if (isSellerDone && isBuyerDone) {
                          badge = (
                            <span
                              className="badge"
                              style={{
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#10b981",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              ✅ Fully Settled
                            </span>
                          );
                        } else if (isSellerDone && !isBuyerDone) {
                          badge = (
                            <span
                              className="badge"
                              style={{
                                background: "rgba(236, 72, 153, 0.15)",
                                color: "#db2777",
                                border: "1px solid rgba(236, 72, 153, 0.3)",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              ⚠️ Paid Seller, Pending Buyer
                            </span>
                          );
                        } else if (!isSellerDone && isBuyerDone) {
                          badge = (
                            <span
                              className="badge"
                              style={{
                                background: "rgba(59, 130, 246, 0.15)",
                                color: "#3b82f6",
                                border: "1px solid rgba(59, 130, 246, 0.3)",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              🔄 Paid Buyer, Pending Seller
                            </span>
                          );
                        } else if (paidSeller > 0 || recvBuyer > 0) {
                          badge = (
                            <span
                              className="badge"
                              style={{
                                background: "rgba(245, 158, 11, 0.15)",
                                color: "#d97706",
                                border: "1px solid rgba(245, 158, 11, 0.3)",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              🔶 Partial Settlement
                            </span>
                          );
                        } else {
                          badge = (
                            <span
                              className="badge"
                              style={{
                                background: "rgba(107, 114, 128, 0.15)",
                                color: "#9ca3af",
                                border: "1px solid rgba(107, 114, 128, 0.3)",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              ⏳ Pending Both
                            </span>
                          );
                        }

                        return (
                          <div>
                            <div>{badge}</div>
                            <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 3, fontSize: 10, textAlign: "left" }}>
                              <div style={{ background: "rgba(236, 72, 153, 0.08)", padding: "3px 6px", borderRadius: 4, color: "#be185d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span>Seller:</span>
                                <span>
                                  {isSellerDone && buyAmt > 0 ? (
                                    <strong style={{ color: "#059669" }}>✓ Cleared ({formatINR(paidSeller)})</strong>
                                  ) : (
                                    <span>Paid: {formatINR(paidSeller)} | <strong style={{ color: leftSeller > 0 ? "#dc2626" : "inherit" }}>Left: {formatINR(leftSeller)}</strong></span>
                                  )}
                                </span>
                              </div>
                              <div style={{ background: "rgba(59, 130, 246, 0.08)", padding: "3px 6px", borderRadius: 4, color: "#1d4ed8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span>Buyer:</span>
                                <span>
                                  {isBuyerDone && sellAmt > 0 ? (
                                    <strong style={{ color: "#059669" }}>✓ Cleared ({formatINR(recvBuyer)})</strong>
                                  ) : (
                                    <span>Recv: {formatINR(recvBuyer)} | <strong style={{ color: leftBuyer > 0 ? "#d97706" : "inherit" }}>Left: {formatINR(leftBuyer)}</strong></span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 4 Counterparty Settlement Action Buttons */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 3,
                          marginTop: 6,
                        }}
                      >
                        <button
                          type="button"
                          className={`btn btn-xs ${
                            (d.deal_settlement_status || "paid_seller_pending_buyer") === "paid_seller_pending_buyer"
                              ? "btn-primary"
                              : "btn-outline"
                          }`}
                          style={{ fontSize: 9, padding: "2px 4px", whiteSpace: "nowrap" }}
                          onClick={() => handleOpenSettlement(d, "paid_seller")}
                          title="Paid to Seller (Record payment to seller & auto-add to Business Expenses)"
                        >
                          💸 Paid to Seller
                        </button>

                        <button
                          type="button"
                          className={`btn btn-xs ${
                            d.deal_settlement_status === "paid_buyer_pending_seller"
                              ? "btn-primary"
                              : "btn-outline"
                          }`}
                          style={{ fontSize: 9, padding: "2px 4px", whiteSpace: "nowrap" }}
                          onClick={() => handleOpenSettlement(d, "received_buyer")}
                          title="Received from Buyer (Record collection from buyer)"
                        >
                          📥 Recv from Buyer
                        </button>

                        <button
                          type="button"
                          className={`btn btn-xs ${
                            d.deal_settlement_status === "pending_both"
                              ? "btn-primary"
                              : "btn-outline"
                          }`}
                          style={{ fontSize: 9, padding: "2px 4px", whiteSpace: "nowrap" }}
                          onClick={() => handleOpenSettlement(d, "none")}
                          title="None (Pending both parties)"
                        >
                          ⚪ None
                        </button>

                        <button
                          type="button"
                          className={`btn btn-xs ${
                            d.deal_settlement_status === "fully_settled"
                              ? "btn-primary"
                              : "btn-outline"
                          }`}
                          style={{ fontSize: 9, padding: "2px 4px", whiteSpace: "nowrap" }}
                          onClick={() => handleOpenSettlement(d, "complete")}
                          title="Transaction Complete (Both counterparties settled)"
                        >
                          ✅ Complete
                        </button>
                      </div>
                    </td>

                    {/* Commission Status */}
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
                        <button
                          className="btn btn-outline btn-xs"
                          style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3, color: "var(--primary)" }}
                          title="View Past Payment History & Logs"
                          onClick={() => {
                            setPaymentHistoryDeal(d);
                            setHistoryTab("all");
                            setNewPayTarget("seller");
                            setNewPayAmount(0);
                            setNewPayDate(new Date().toISOString().slice(0, 10));
                            setNewPayNote("");
                          }}
                        >
                          📜 Payments
                        </button>
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
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 16px",
                borderTop: "1px solid var(--border)",
                background: "var(--surface)",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredDeals.length)} of {filteredDeals.length} deals
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: 12, fontWeight: 800 }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
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
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          style={{ fontSize: 9, padding: "1px 5px", height: 22, color: "var(--muted)" }}
                          title="Clear current saved party suggestions list"
                          onClick={() => {
                            if (window.confirm("Clear all current saved party suggestions? You can always add fresh names anytime.")) {
                              clearBuyersMutation.mutate();
                            }
                          }}
                        >
                          ✕ Clear
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Jaipur Royal Gems, Sri Lanka Exporters"
                    list="deal-sellers"
                    autoComplete="off"
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
                    autoComplete="off"
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
                    min="0"
                    className="input"
                    value={editingDeal.pieces ?? 0}
                    onChange={(e) => setEditingDeal({ ...editingDeal, pieces: Math.max(0, Number(e.target.value) || 0) })}
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

              {/* Counterparty Settlement Status */}
              <div style={{ marginBottom: 14 }}>
                <label className="label">Deal Principal Settlement (Counterparties):</label>
                <select
                  className="select"
                  value={editingDeal.deal_settlement_status || "paid_seller_pending_buyer"}
                  onChange={(e) =>
                    setEditingDeal({
                      ...editingDeal,
                      deal_settlement_status: e.target.value as any,
                    })
                  }
                >
                  <option value="paid_seller_pending_buyer">
                    ⚠️ Paid to Seller, Pending from Buyer (Seller paid, waiting for buyer payment)
                  </option>
                  <option value="pending_both">
                    ⏳ Pending from Both (Neither party has paid)
                  </option>
                  <option value="paid_buyer_pending_seller">
                    🔄 Paid by Buyer, Pending to Seller (Buyer paid, pending disbursement to seller)
                  </option>
                  <option value="partial_settled">
                    🔶 Partial Settlement (Partial payments recorded for parties)
                  </option>
                  <option value="fully_settled">
                    ✅ Fully Settled (Both buyer and seller settlements complete)
                  </option>
                </select>
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

      {/* Interactive Modal: Counterparty Settlement (Paid to Seller / Recv from Buyer / None / Complete) */}
      {settlementModalOpen && settlementDeal && (() => {
        const curBuyAmt = Number(settlementDeal.buy_amount) || 0;
        const curSellAmt = Number(settlementDeal.sell_amount || settlementDeal.deal_value) || 0;
        const curPrevPaidSeller = (settlementDeal.seller_payments && settlementDeal.seller_payments.length > 0)
          ? settlementDeal.seller_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
          : Number(settlementDeal.amount_paid_to_seller) || 0;
        const curPrevRecvBuyer = (settlementDeal.buyer_payments && settlementDeal.buyer_payments.length > 0)
          ? settlementDeal.buyer_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
          : Number(settlementDeal.amount_received_from_buyer) || 0;

        const curRemSeller = Math.max(0, curBuyAmt - curPrevPaidSeller);
        const curRemBuyer = Math.max(0, curSellAmt - curPrevRecvBuyer);

        return (
          <div className="modal-backdrop" onClick={() => setSettlementModalOpen(false)}>
            <div className="modal-content" style={{ maxWidth: 660, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>💼</span> Counterparty Settlement: {settlementDeal.deal_no}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--primary)" }}
                    onClick={() => {
                      setPaymentHistoryDeal(settlementDeal);
                      setHistoryTab("all");
                      setNewPayTarget("seller");
                      setNewPayAmount(0);
                      setNewPayDate(new Date().toISOString().slice(0, 10));
                      setNewPayNote("");
                      setSettlementModalOpen(false);
                    }}
                  >
                    📜 Past Payments History
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSettlementModalOpen(false)}>
                    ✕
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveSettlement} style={{ padding: 20, overflowY: "auto", flex: 1 }}>
                {/* Deal Summary Bar */}
                <div
                  style={{
                    background: "var(--surface-sunken)",
                    padding: "10px 14px",
                    borderRadius: 6,
                    marginBottom: 16,
                    border: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>PARTICULARS & WEIGHT</div>
                    <div style={{ fontWeight: 800 }}>
                      {settlementDeal.particulars} ({settlementDeal.weight} {settlementDeal.unit || "cts"})
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>SELLER (BUY AMOUNT)</div>
                    <div style={{ fontWeight: 800, color: "#ec4899" }}>
                      {settlementDeal.seller_name}: {formatINR(curBuyAmt)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>BUYER (SELL AMOUNT)</div>
                    <div style={{ fontWeight: 800, color: "#3b82f6" }}>
                      {settlementDeal.buyer_name}: {formatINR(curSellAmt)}
                    </div>
                  </div>
                </div>

                {/* 4 Action Status Selector */}
                <div style={{ marginBottom: 16 }}>
                  <label className="label" style={{ fontWeight: 800, marginBottom: 6 }}>
                    Select Settlement Action / Target Status:
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${settlementActionType === "paid_seller" ? "btn-primary" : "btn-outline"}`}
                      style={{ fontSize: 11, fontWeight: 700 }}
                      onClick={() => {
                        setSettlementActionType("paid_seller");
                        setSellerPayAmount(curRemSeller);
                        if (!sellerPayDate) setSellerPayDate(new Date().toISOString().slice(0, 10));
                        setBuyerRecvAmount(0);
                      }}
                    >
                      💸 Paid to Seller
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${settlementActionType === "received_buyer" ? "btn-primary" : "btn-outline"}`}
                      style={{ fontSize: 11, fontWeight: 700 }}
                      onClick={() => {
                        setSettlementActionType("received_buyer");
                        setBuyerRecvAmount(curRemBuyer);
                        if (!buyerRecvDate) setBuyerRecvDate(new Date().toISOString().slice(0, 10));
                        setSellerPayAmount(0);
                      }}
                    >
                      📥 Recv from Buyer
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${settlementActionType === "none" ? "btn-primary" : "btn-outline"}`}
                      style={{ fontSize: 11, fontWeight: 700 }}
                      onClick={() => {
                        setSettlementActionType("none");
                        setSellerPayAmount(0);
                        setBuyerRecvAmount(0);
                      }}
                    >
                      ⚪ None
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${settlementActionType === "complete" ? "btn-primary" : "btn-outline"}`}
                      style={{ fontSize: 11, fontWeight: 700 }}
                      onClick={() => {
                        setSettlementActionType("complete");
                        setSellerPayAmount(curRemSeller);
                        if (!sellerPayDate) setSellerPayDate(new Date().toISOString().slice(0, 10));
                        setBuyerRecvAmount(curRemBuyer);
                        if (!buyerRecvDate) setBuyerRecvDate(new Date().toISOString().slice(0, 10));
                      }}
                    >
                      ✅ Complete
                    </button>
                  </div>
                </div>

                {/* Section 1: Payment to Seller */}
                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border:
                      settlementActionType === "paid_seller" || settlementActionType === "complete" || sellerPayAmount > 0
                        ? "1.5px solid #ec4899"
                        : "1px solid var(--border)",
                    background: "var(--surface)",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#ec4899", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>💸</span> Payment to Seller ({settlementDeal.seller_name})
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span>Buy Cost: <strong>{formatINR(curBuyAmt)}</strong></span>
                      <span>Paid in History: <strong style={{ color: "#059669" }}>{formatINR(curPrevPaidSeller)}</strong></span>
                      <span>
                        Due Left:{" "}
                        <strong style={{ color: curRemSeller > 0 ? "#dc2626" : "#059669" }}>
                          {curRemSeller > 0 ? formatINR(curRemSeller) : "✓ Paid"}
                        </strong>
                      </span>
                      {curRemSeller > 0 && (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          style={{ fontSize: 10, padding: "1px 6px" }}
                          onClick={() => setSellerPayAmount(curRemSeller)}
                          title="Fill full remaining balance due"
                        >
                          Fill Due
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Overpayment Warning for Seller */}
                  {curRemSeller > 0 && sellerPayAmount > curRemSeller && (
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
                      ⚠️ Error: Entered payment ({formatINR(sellerPayAmount)}) cannot exceed remaining balance due of {formatINR(curRemSeller)}!
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
                    <div>
                      <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                        New Amount to Pay Seller (₹):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={curRemSeller > 0 ? curRemSeller : 0}
                        className="input"
                        style={{ fontWeight: 700 }}
                        placeholder={curRemSeller > 0 ? `Max: ${formatINR(curRemSeller)}` : "Fully Settled"}
                        disabled={curRemSeller <= 0}
                        value={sellerPayAmount || ""}
                        onChange={(e) => setSellerPayAmount(Math.max(0, Number(e.target.value) || 0))}
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                        Date Paid:
                      </label>
                      <input
                        type="date"
                        className="input"
                        value={sellerPayDate}
                        onChange={(e) => setSellerPayDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                        Payment Mode:
                      </label>
                      <select
                        className="select"
                        value={sellerPayMode}
                        onChange={(e) => setSellerPayMode(e.target.value)}
                      >
                        <option value="Bank Wire / NEFT">Bank Wire / NEFT</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Angadia">Angadia</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Payment reference, bank UTR, or notes..."
                      value={sellerPayNote}
                      onChange={(e) => setSellerPayNote(e.target.value)}
                    />
                  </div>

                  {/* Automatic Business Expense Banner */}
                  {sellerPayAmount > 0 && sellerPayAmount <= curRemSeller && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        borderRadius: 6,
                        color: "#059669",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 6,
                      }}
                    >
                      <span>💼</span>
                      <span>
                        <strong>Adds to Past Payments & Business Expenses:</strong> +₹{formatINR(sellerPayAmount)} under{" "}
                        <em>"Brokerage Payout"</em> (Payee: {settlementDeal.seller_name}).
                      </span>
                    </div>
                  )}
                </div>

                {/* Section 2: Payment Received from Buyer */}
                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border:
                      settlementActionType === "received_buyer" || settlementActionType === "complete" || buyerRecvAmount > 0
                        ? "1.5px solid #3b82f6"
                        : "1px solid var(--border)",
                    background: "var(--surface)",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#3b82f6", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>📥</span> Payment Received from Buyer ({settlementDeal.buyer_name})
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span>Deal Value: <strong>{formatINR(curSellAmt)}</strong></span>
                      <span>Recv'd in History: <strong style={{ color: "#059669" }}>{formatINR(curPrevRecvBuyer)}</strong></span>
                      <span>
                        Due Left:{" "}
                        <strong style={{ color: curRemBuyer > 0 ? "#d97706" : "#059669" }}>
                          {curRemBuyer > 0 ? formatINR(curRemBuyer) : "✓ Received"}
                        </strong>
                      </span>
                      {curRemBuyer > 0 && (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          style={{ fontSize: 10, padding: "1px 6px" }}
                          onClick={() => setBuyerRecvAmount(curRemBuyer)}
                          title="Fill full remaining balance due"
                        >
                          Fill Due
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Overpayment Warning for Buyer */}
                  {curRemBuyer > 0 && buyerRecvAmount > curRemBuyer && (
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
                      ⚠️ Error: Entered receipt ({formatINR(buyerRecvAmount)}) cannot exceed remaining balance receivable of {formatINR(curRemBuyer)}!
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
                    <div>
                      <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                        New Amount Received from Buyer (₹):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={curRemBuyer > 0 ? curRemBuyer : 0}
                        className="input"
                        style={{ fontWeight: 700 }}
                        placeholder={curRemBuyer > 0 ? `Max: ${formatINR(curRemBuyer)}` : "Fully Received"}
                        disabled={curRemBuyer <= 0}
                        value={buyerRecvAmount || ""}
                        onChange={(e) => setBuyerRecvAmount(Math.max(0, Number(e.target.value) || 0))}
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                        Date Received:
                      </label>
                      <input
                        type="date"
                        className="input"
                        value={buyerRecvDate}
                        onChange={(e) => setBuyerRecvDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                        Receipt Mode:
                      </label>
                      <select
                        className="select"
                        value={buyerRecvMode}
                        onChange={(e) => setBuyerRecvMode(e.target.value)}
                      >
                        <option value="Bank Wire / NEFT">Bank Wire / NEFT</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Angadia">Angadia</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      className="input"
                      placeholder="Receipt reference, deposit bank, or notes..."
                      value={buyerRecvNote}
                      onChange={(e) => setBuyerRecvNote(e.target.value)}
                    />
                  </div>

                  {/* Automatic Collection Banner */}
                  {buyerRecvAmount > 0 && buyerRecvAmount <= curRemBuyer && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "rgba(59, 130, 246, 0.1)",
                        border: "1px solid rgba(59, 130, 246, 0.3)",
                        borderRadius: 6,
                        color: "#2563eb",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 6,
                      }}
                    >
                      <span>📥</span>
                      <span>
                        <strong>Adds to Past Payment Records:</strong> +₹{formatINR(buyerRecvAmount)} collection from {settlementDeal.buyer_name}.
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setSettlementModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ fontWeight: 800 }}
                    disabled={
                      saveDealMutation.isPending ||
                      (curRemSeller > 0 && sellerPayAmount > curRemSeller) ||
                      (curRemBuyer > 0 && buyerRecvAmount > curRemBuyer)
                    }
                  >
                    Record & Update Settlement
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal: View Past Payments History & Installments for Brokerage Deals */}
      {paymentHistoryDeal && (() => {
        const buyAmt = Number(paymentHistoryDeal.buy_amount) || 0;
        const paidSeller = (paymentHistoryDeal.seller_payments && paymentHistoryDeal.seller_payments.length > 0)
          ? paymentHistoryDeal.seller_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
          : Number(paymentHistoryDeal.amount_paid_to_seller) || 0;
        const balSeller = Math.max(0, buyAmt - paidSeller);

        const sellAmt = Number(paymentHistoryDeal.sell_amount || paymentHistoryDeal.deal_value) || 0;
        const recvBuyer = (paymentHistoryDeal.buyer_payments && paymentHistoryDeal.buyer_payments.length > 0)
          ? paymentHistoryDeal.buyer_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
          : Number(paymentHistoryDeal.amount_received_from_buyer) || 0;
        const balBuyer = Math.max(0, sellAmt - recvBuyer);

        const commAmt = Number(paymentHistoryDeal.commission_amount) || 0;
        const recComm = (paymentHistoryDeal.commission_payments && paymentHistoryDeal.commission_payments.length > 0)
          ? paymentHistoryDeal.commission_payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
          : Number(paymentHistoryDeal.received_amount) || 0;
        const balComm = Math.max(0, commAmt - recComm);

        const sellerLogs = (paymentHistoryDeal.seller_payments && paymentHistoryDeal.seller_payments.length > 0)
          ? paymentHistoryDeal.seller_payments.map((p) => ({
              id: p.id,
              date: p.date,
              amount: p.amount,
              mode: p.mode,
              note: p.note,
              type: "seller" as const,
              party: paymentHistoryDeal.seller_name,
              label: "Seller Disbursement",
              badgeColor: "#ec4899",
            }))
          : paidSeller > 0
          ? [
              {
                id: "init-seller",
                date: paymentHistoryDeal.date_paid_to_seller || paymentHistoryDeal.date,
                amount: paidSeller,
                mode: paymentHistoryDeal.mode_paid_to_seller || "Bank Wire / NEFT",
                note: paymentHistoryDeal.note_paid_to_seller || "Payout recorded to seller",
                type: "seller" as const,
                party: paymentHistoryDeal.seller_name,
                label: "Seller Disbursement",
                badgeColor: "#ec4899",
              },
            ]
          : [];

        const buyerLogs = (paymentHistoryDeal.buyer_payments && paymentHistoryDeal.buyer_payments.length > 0)
          ? paymentHistoryDeal.buyer_payments.map((p) => ({
              id: p.id,
              date: p.date,
              amount: p.amount,
              mode: p.mode,
              note: p.note,
              type: "buyer" as const,
              party: paymentHistoryDeal.buyer_name,
              label: "Buyer Collection",
              badgeColor: "#3b82f6",
            }))
          : recvBuyer > 0
          ? [
              {
                id: "init-buyer",
                date: paymentHistoryDeal.date_received_from_buyer || paymentHistoryDeal.date,
                amount: recvBuyer,
                mode: paymentHistoryDeal.mode_received_from_buyer || "Bank Wire / NEFT",
                note: paymentHistoryDeal.note_received_from_buyer || "Payment collected from buyer",
                type: "buyer" as const,
                party: paymentHistoryDeal.buyer_name,
                label: "Buyer Collection",
                badgeColor: "#3b82f6",
              },
            ]
          : [];

        const commLogs = (paymentHistoryDeal.commission_payments && paymentHistoryDeal.commission_payments.length > 0)
          ? paymentHistoryDeal.commission_payments.map((p) => ({
              id: p.id,
              date: p.date,
              amount: p.amount,
              mode: p.mode,
              note: p.note,
              type: "commission" as const,
              party: "Our Firm",
              label: "Commission Settlement",
              badgeColor: "#10b981",
            }))
          : recComm > 0
          ? [
              {
                id: "init-comm",
                date: paymentHistoryDeal.settlement_date || paymentHistoryDeal.date,
                amount: recComm,
                mode: paymentHistoryDeal.payment_mode || "Bank Wire / NEFT",
                note: "Commission collection settlement",
                type: "commission" as const,
                party: "Our Firm",
                label: "Commission Settlement",
                badgeColor: "#10b981",
              },
            ]
          : [];

        const allLogs = [...sellerLogs, ...buyerLogs, ...commLogs].sort((a, b) =>
          (b.date || "").localeCompare(a.date || "")
        );

        const displayedLogs =
          historyTab === "seller"
            ? sellerLogs
            : historyTab === "buyer"
            ? buyerLogs
            : historyTab === "commission"
            ? commLogs
            : allLogs;

        const maxAllowedForNewPay =
          newPayTarget === "seller"
            ? balSeller
            : newPayTarget === "buyer"
            ? balBuyer
            : balComm;

        const isNewPayOverpaid = newPayAmount > maxAllowedForNewPay;

        return (
          <div className="modal-backdrop" onClick={() => setPaymentHistoryDeal(null)}>
            <div className="modal-content" style={{ maxWidth: 880, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📜</span> Past Payment Records: {paymentHistoryDeal.deal_no}
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    {paymentHistoryDeal.particulars} ({paymentHistoryDeal.weight} {paymentHistoryDeal.unit || "cts"}) • Company: <strong>{paymentHistoryDeal.company_name}</strong>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setPaymentHistoryDeal(null)}>
                  ✕
                </button>
              </div>

              <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
                {/* 3 Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                  {/* Seller Card */}
                  <div
                    style={{
                      background: "rgba(236, 72, 153, 0.05)",
                      border: "1px solid rgba(236, 72, 153, 0.2)",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ec4899", textTransform: "uppercase" }}>
                      💸 Seller: {paymentHistoryDeal.seller_name}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Buy Cost:</span>
                      <strong>{formatINR(buyAmt)}</strong>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Paid:</span>
                      <strong style={{ color: "#059669" }}>{formatINR(paidSeller)}</strong>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2, display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(236, 72, 153, 0.2)", paddingTop: 4 }}>
                      <span style={{ color: "var(--muted)" }}>Due Left:</span>
                      <strong style={{ color: balSeller > 0 ? "#dc2626" : "#059669" }}>
                        {balSeller > 0 ? formatINR(balSeller) : "✓ Settled"}
                      </strong>
                    </div>
                  </div>

                  {/* Buyer Card */}
                  <div
                    style={{
                      background: "rgba(59, 130, 246, 0.05)",
                      border: "1px solid rgba(59, 130, 246, 0.2)",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase" }}>
                      📥 Buyer: {paymentHistoryDeal.buyer_name}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Deal Value:</span>
                      <strong>{formatINR(sellAmt)}</strong>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Recv'd:</span>
                      <strong style={{ color: "#059669" }}>{formatINR(recvBuyer)}</strong>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2, display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(59, 130, 246, 0.2)", paddingTop: 4 }}>
                      <span style={{ color: "var(--muted)" }}>Due Left:</span>
                      <strong style={{ color: balBuyer > 0 ? "#d97706" : "#059669" }}>
                        {balBuyer > 0 ? formatINR(balBuyer) : "✓ Recv'd"}
                      </strong>
                    </div>
                  </div>

                  {/* Commission Card */}
                  <div
                    style={{
                      background: "rgba(16, 185, 129, 0.05)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>
                      💰 Firm Commission Spread
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Commission:</span>
                      <strong>{formatINR(commAmt)}</strong>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Collected:</span>
                      <strong style={{ color: "#059669" }}>{formatINR(recComm)}</strong>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2, display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(16, 185, 129, 0.2)", paddingTop: 4 }}>
                      <span style={{ color: "var(--muted)" }}>Pending:</span>
                      <strong style={{ color: balComm > 0 ? "#dc2626" : "#059669" }}>
                        {balComm > 0 ? formatINR(balComm) : "✓ Cleared"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className={`btn btn-xs ${historyTab === "all" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setHistoryTab("all")}
                    >
                      All Records ({allLogs.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${historyTab === "seller" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setHistoryTab("seller")}
                    >
                      💸 Seller ({sellerLogs.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${historyTab === "buyer" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setHistoryTab("buyer")}
                    >
                      📥 Buyer ({buyerLogs.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${historyTab === "commission" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setHistoryTab("commission")}
                    >
                      💰 Commission ({commLogs.length})
                    </button>
                  </div>
                </div>

                {/* Payment History Table with scroll navigations */}
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    overflowX: "auto",
                    overflowY: "auto",
                    maxHeight: 280,
                    marginBottom: 20,
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <table className="table" style={{ margin: 0, width: "100%", minWidth: 720, fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                      <tr style={{ background: "var(--surface-sunken)" }}>
                        <th style={{ minWidth: 95, width: 95 }}>Date</th>
                        <th style={{ minWidth: 160 }}>Transaction Category</th>
                        <th style={{ minWidth: 130 }}>Counterparty / Party</th>
                        <th style={{ minWidth: 130 }}>Payment Mode</th>
                        <th style={{ minWidth: 180 }}>Reference / Note</th>
                        <th style={{ textAlign: "right", minWidth: 130, width: 130 }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                            No payment transactions recorded in this category yet.
                          </td>
                        </tr>
                      ) : (
                        displayedLogs.map((log) => (
                          <tr key={log.id}>
                            <td style={{ fontWeight: 600 }}>{shortDate(log.date)}</td>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: log.badgeColor,
                                  background: `${log.badgeColor}15`,
                                  border: `1px solid ${log.badgeColor}30`,
                                }}
                              >
                                {log.label}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{log.party}</td>
                            <td>{log.mode}</td>
                            <td style={{ color: log.note ? "var(--foreground)" : "var(--muted)" }}>
                              {log.note || "—"}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 800, color: log.badgeColor, minWidth: 130, whiteSpace: "nowrap" }}>
                              {formatINR(log.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Record New Payment / Installment Section */}
                <div
                  style={{
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>➕</span> Record New Payment / Installment for this Deal
                  </h4>

                  {/* Overpayment Error Banner */}
                  {isNewPayOverpaid && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "#fef2f2",
                        border: "1px solid #f87171",
                        borderRadius: 6,
                        color: "#b91c1c",
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 12,
                      }}
                    >
                      ⚠️ Error: Entered amount ({formatINR(newPayAmount)}) cannot exceed remaining balance due of {formatINR(maxAllowedForNewPay)} for this target!
                    </div>
                  )}

                  {maxAllowedForNewPay <= 0 && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        borderRadius: 6,
                        color: "#065f46",
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 12,
                      }}
                    >
                      ✓ Selected target is already fully settled (₹0 balance due).
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newPayAmount <= 0) {
                        show("Please enter a valid amount greater than 0", "error");
                        return;
                      }
                      if (newPayAmount > maxAllowedForNewPay) {
                        show(`Amount cannot exceed remaining balance due of ${formatINR(maxAllowedForNewPay)}`, "error");
                        return;
                      }
                      addBrokeragePaymentMutation.mutate({
                        dealId: paymentHistoryDeal.id,
                        type: newPayTarget,
                        payment: {
                          amount: Number(newPayAmount),
                          mode: newPayMode,
                          date: newPayDate || new Date().toISOString().slice(0, 10),
                          note: newPayNote.trim(),
                        },
                      });
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                          Payment Target:*
                        </label>
                        <select
                          className="select"
                          value={newPayTarget}
                          onChange={(e) => {
                            const val = e.target.value as "seller" | "buyer" | "commission";
                            setNewPayTarget(val);
                            const rem = val === "seller" ? balSeller : val === "buyer" ? balBuyer : balComm;
                            setNewPayAmount(rem);
                          }}
                        >
                          <option value="seller">💸 Seller: {paymentHistoryDeal.seller_name} (Due: {formatINR(balSeller)})</option>
                          <option value="buyer">📥 Buyer: {paymentHistoryDeal.buyer_name} (Due: {formatINR(balBuyer)})</option>
                          <option value="commission">💰 Our Commission (Due: {formatINR(balComm)})</option>
                        </select>
                      </div>

                      <div>
                        <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                          Amount (₹):* (Max: {formatINR(maxAllowedForNewPay)})
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max={maxAllowedForNewPay}
                          disabled={maxAllowedForNewPay <= 0}
                          className="input"
                          style={{ fontWeight: 800 }}
                          value={newPayAmount || ""}
                          onChange={(e) => setNewPayAmount(parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                          Payment Date:
                        </label>
                        <input
                          type="date"
                          required
                          className="input"
                          value={newPayDate}
                          onChange={(e) => setNewPayDate(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                          Payment Mode:
                        </label>
                        <select
                          className="select"
                          value={newPayMode}
                          onChange={(e) => setNewPayMode(e.target.value)}
                        >
                          <option value="Bank Wire / NEFT">Bank Wire / NEFT</option>
                          <option value="Cash">Cash</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Angadia">Angadia</option>
                          <option value="UPI">UPI</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Reference / UTR / Remarks..."
                        className="input"
                        style={{ flex: 1 }}
                        value={newPayNote}
                        onChange={(e) => setNewPayNote(e.target.value)}
                      />

                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ whiteSpace: "nowrap", fontWeight: 800 }}
                        disabled={
                          addBrokeragePaymentMutation.isPending ||
                          maxAllowedForNewPay <= 0 ||
                          newPayAmount <= 0 ||
                          newPayAmount > maxAllowedForNewPay
                        }
                      >
                        {addBrokeragePaymentMutation.isPending ? "Recording..." : "Record & Update Log"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
