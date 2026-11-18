import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import { Spinner, PayBadge, EmptyState } from "../ui";
import { formatINR, shortDate } from "../format";
import type { GemSale, GemBrokerage, GemPacket } from "../types/gemstone";
import { DEFAULT_COMPANIES } from "../types/gemstone";
import { useToast } from "../toast";
import {
  printFilteredSalesReport,
  printBuyerApprovalStatement,
  printBuyerWiseLedgerReport,
} from "../statementPrint";
import { hasGenuineIndividualWeights } from "../packetStones";

export default function Sales() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [searchParams] = useSearchParams();

  // Section view filter: All vs Direct Sales vs Approvals & Returns vs Brokerage Deals
  const initialView = searchParams.get("tab") === "approvals" ? "approvals" : searchParams.get("tab") === "brokerage" ? "brokerage" : "all";
  const [viewSection, setViewSection] = useState<"all" | "sales" | "approvals" | "brokerage">(initialView);
  const [approvalSubFilter, setApprovalSubFilter] = useState<"all" | "left" | "taken">("all");

  // Filters & Date Search
  const [searchTerm, setSearchTerm] = useState("");
  const [buyerFilter, setBuyerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [stockTypeFilter, setStockTypeFilter] = useState("all"); // own_stock vs outside_stock
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Approval Settlement Modal State (Partial Stone Take / Return)
  const [settlingSale, setSettlingSale] = useState<GemSale | null>(null);
  const [settlementRows, setSettlementRows] = useState<
    Array<{
      item_index?: number;
      item_id?: string;
      stone_id?: string;
      packet_id?: string;
      packet_number: string;
      particulars: string;
      shape: string;
      is_uncountable?: boolean;
      original_pieces: number;
      original_weight: number;
      rate_per_unit: number;
      pieces_taken: number;
      weight_taken: number;
      pieces_returned: number;
      weight_returned: number;
      stone_weights?: number[];
      selected_stones?: boolean[];
      has_individual_weights?: boolean;
    }>
  >([]);
  const [settlementNotes, setSettlementNotes] = useState("");

  // Modal State for Printing Approvals Taken as Sale Filtered by Buyer
  const [printTakenModalOpen, setPrintTakenModalOpen] = useState(false);
  const [printTakenBuyer, setPrintTakenBuyer] = useState("all");
  const [printTakenCompany, setPrintTakenCompany] = useState("all");

  // Partial Payment Modal State
  const [partialPaySale, setPartialPaySale] = useState<GemSale | null>(null);
  const [partialPayAmount, setPartialPayAmount] = useState<number>(0);
  const [partialPayDate, setPartialPayDate] = useState<string>("");
  const [partialPayMode, setPartialPayMode] = useState<string>("Bank Wire / NEFT");
  const [partialPayNote, setPartialPayNote] = useState<string>("");

  // Pagination for high-volume sales datasets
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const { data: sales = [], isLoading } = useQuery<GemSale[]>({
    queryKey: ["sales"],
    queryFn: () => apiGet("/sales"),
  });

  const { data: packets = [] } = useQuery<GemPacket[]>({
    queryKey: ["packets"],
    queryFn: () => apiGet("/packets?limit=200"),
    enabled: Boolean(settlingSale),
  });

  const uniqueBuyers = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (s.buyer_name && s.buyer_name.trim()) {
        set.add(s.buyer_name.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sales]);

  // Buyers who have approvals taken as sale (approved/billed)
  const takenSalesBuyers = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if ((s.approval_status === "approved_billed" || Boolean(s.approval_billed_date)) && s.buyer_name) {
        set.add(s.buyer_name.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sales]);

  const { data: brokerages = [] } = useQuery<GemBrokerage[]>({
    queryKey: ["brokerage"],
    queryFn: () => apiGet("/brokerage"),
  });

  const markFullPaymentMutation = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode?: string }) =>
      apiPost(`/sales/${id}/full-payment`, { payment_mode: mode || "Bank Wire / NEFT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Full payment received and balance marked cleared!", "success");
    },
    onError: (err: any) => show("Error marking full payment: " + err.message, "error"),
  });

  const addPartialPaymentMutation = useMutation({
    mutationFn: (payload: { id: string; amount: number; mode: string; date?: string; note?: string }) =>
      apiPost(`/sales/${payload.id}/payments`, {
        amount: payload.amount,
        mode: payload.mode,
        date: payload.date,
        note: payload.note,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Payment recorded successfully and balance updated!", "success");
      setPartialPaySale(null);
    },
    onError: (err: any) => show("Error recording payment: " + err.message, "error"),
  });

  const deleteSaleMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/sales/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Transaction deleted and associated packets restored to vault!", "info");
    },
    onError: (err: any) => show("Error deleting transaction: " + err.message, "error"),
  });

  // Action mutation: Settle Approval Memo with exact pieces/carats taken vs returned
  const settleApprovalMutation = useMutation({
    mutationFn: (payload: { saleId: string; items: any[]; notes?: string }) =>
      apiPost(`/sales/${payload.saleId}/settle-approval`, {
        items: payload.items,
        options: { notes: payload.notes },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show(
        "Approval memo settled! Taken stones converted to confirmed sale, and returned stones restored to vault inventory.",
        "success"
      );
      setSettlingSale(null);
    },
    onError: (err: any) => show("Error settling approval memo: " + err.message, "error"),
  });

  // Action mutation: Convert Commercial Sale to Active Approval Memo
  const convertSaleMutation = useMutation({
    mutationFn: (payload: { saleId: string; notes?: string }) =>
      apiPost(`/sales/${payload.saleId}/convert-to-approval`, {
        options: { notes: payload.notes },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show("Commercial sale converted to approval memo! Associated packets restored to 'on_approval' status.", "success");
    },
    onError: (err: any) => show("Error converting sale to approval memo: " + err.message, "error"),
  });

  const openSettlementDialog = (sale: GemSale, initialMode: "approve" | "return") => {
    setSettlingSale(sale);
    const rows = (sale.items || []).map((it, itIdx) => {
      const pkt = packets.find(
        (p) =>
          (it.packet_id && p.id === it.packet_id) ||
          p.packet_number.toLowerCase() === (it.packet_number || "").toLowerCase()
      );
      const isUnc = Boolean(it.is_uncountable || pkt?.is_uncountable);
      const origPcs = isUnc ? 0 : (it.pieces !== undefined ? it.pieces : 0);
      const origWt = it.original_weight !== undefined && it.original_weight > 0 ? it.original_weight : (it.weight || 0);
      const isApprove = initialMode === "approve";

      // Detect genuine individual stone weights:
      let sWeights: number[] = [];
      let rowHasIndividualWeights = false;

      if (!isUnc && origPcs > 1) {
        if (
          Array.isArray(it.stone_weights) &&
          it.stone_weights.length === origPcs &&
          Math.abs(it.stone_weights.reduce((a, b) => a + b, 0) - origWt) <= 0.05
        ) {
          sWeights = [...it.stone_weights];
          rowHasIndividualWeights = true;
        } else if (pkt && hasGenuineIndividualWeights(pkt) && Array.isArray(pkt.stone_details) && pkt.stone_details.length >= origPcs) {
          const withWts = pkt.stone_details.filter((sd) => sd.weight && sd.weight > 0);
          if (withWts.length >= origPcs) {
            sWeights = withWts.slice(0, origPcs).map((sd) => sd.weight!);
            rowHasIndividualWeights = true;
          }
        }
      } else if (!isUnc && origPcs === 1) {
        sWeights = [origWt];
        rowHasIndividualWeights = false;
      }

      // Selected stones array: true = taken for sale (billed), false = returned to vault
      const selectedStones = isUnc || (!rowHasIndividualWeights && origPcs > 1)
        ? []
        : Array(origPcs).fill(isApprove);

      const initWeightTaken = isApprove ? origWt : 0;
      const initWeightReturned = isApprove ? 0 : origWt;

      return {
        item_index: itIdx,
        item_id: (it as any).id || it.stone_id || `item-${itIdx}`,
        stone_id: it.stone_id,
        packet_id: it.packet_id,
        packet_number: it.packet_number,
        particulars: it.particulars,
        shape: it.shape,
        is_uncountable: isUnc,
        original_pieces: origPcs,
        original_weight: origWt,
        rate_per_unit: it.rate_per_unit || (origWt ? Math.round(it.total_price / origWt) : 0),
        pieces_taken: isUnc ? 0 : (isApprove ? origPcs : 0),
        weight_taken: initWeightTaken,
        pieces_returned: isUnc ? 0 : (isApprove ? 0 : origPcs),
        weight_returned: initWeightReturned,
        stone_weights: sWeights,
        selected_stones: selectedStones,
        has_individual_weights: rowHasIndividualWeights,
      };
    });
    setSettlementRows(rows);
    setSettlementNotes(
      initialMode === "approve"
        ? "Client took and confirmed gemstone packet(s)"
        : "Client returned stones back to vault"
    );
  };

  const handleToggleSingleStone = (rowIdx: number) => {
    setSettlementRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        const currentlyTaken = row.pieces_taken > 0;
        const newTaken = !currentlyTaken;
        return {
          ...row,
          pieces_taken: newTaken ? 1 : 0,
          weight_taken: newTaken ? row.original_weight : 0,
          pieces_returned: newTaken ? 0 : 1,
          weight_returned: newTaken ? 0 : row.original_weight,
          selected_stones: [newTaken],
        };
      })
    );
  };

  const handleToggleStoneSelection = (rowIdx: number, stIdx: number) => {
    setSettlementRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        const currentSel = row.selected_stones ? [...row.selected_stones] : [];
        while (currentSel.length < row.original_pieces) {
          currentSel.push(true);
        }
        currentSel[stIdx] = !currentSel[stIdx];

        const sWeights = row.stone_weights || [];
        let pTaken = 0;
        let wTaken = 0;
        let pRet = 0;
        let wRet = 0;

        for (let k = 0; k < row.original_pieces; k++) {
          const w = (sWeights[k] !== undefined && sWeights[k] > 0) ? sWeights[k] : (row.original_pieces > 0 ? row.original_weight / row.original_pieces : 0);
          if (currentSel[k]) {
            pTaken++;
            wTaken += w;
          } else {
            pRet++;
            wRet += w;
          }
        }

        wTaken = Number(wTaken.toFixed(2));
        wRet = Number(wRet.toFixed(2));

        return {
          ...row,
          selected_stones: currentSel,
          pieces_taken: pTaken,
          weight_taken: wTaken,
          pieces_returned: pRet,
          weight_returned: wRet,
        };
      })
    );
  };

  const handleUpdateSettlementRow = (
    idx: number,
    field: "pieces_taken" | "weight_taken" | "pieces_returned" | "weight_returned",
    val: number
  ) => {
    setSettlementRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;

        // Single piece stone: strictly binary whole stone taken or returned.
        // No partial carats can be taken or returned without a piece.
        if (!row.is_uncountable && row.original_pieces === 1) {
          if (field === "pieces_taken") {
            const pt = val > 0 ? 1 : 0;
            return {
              ...row,
              pieces_taken: pt,
              weight_taken: pt === 1 ? row.original_weight : 0,
              pieces_returned: pt === 1 ? 0 : 1,
              weight_returned: pt === 1 ? 0 : row.original_weight,
              selected_stones: [pt === 1],
            };
          } else if (field === "pieces_returned") {
            const pr = val > 0 ? 1 : 0;
            return {
              ...row,
              pieces_returned: pr,
              weight_returned: pr === 1 ? row.original_weight : 0,
              pieces_taken: pr === 1 ? 0 : 1,
              weight_taken: pr === 1 ? 0 : row.original_weight,
              selected_stones: [pr === 0],
            };
          }
          return row;
        }

        const updated = { ...row };

        // Bulk parcel (uncountable lot): pieces are not tracked, carats freely balanced.
        if (row.is_uncountable) {
          if (field === "weight_taken") {
            const wt = Math.min(row.original_weight, Math.max(0, val));
            updated.weight_taken = Number(wt.toFixed(2));
            updated.weight_returned = Number(Math.max(0, row.original_weight - wt).toFixed(2));
          } else if (field === "weight_returned") {
            const wr = Math.min(row.original_weight, Math.max(0, val));
            updated.weight_returned = Number(wr.toFixed(2));
            updated.weight_taken = Number(Math.max(0, row.original_weight - wr).toFixed(2));
          }
          updated.pieces_taken = 0;
          updated.pieces_returned = 0;
          return updated;
        }

        // Multi-piece unweighted lot (row.original_pieces > 1)
        if (field === "pieces_taken") {
          const pt = Math.min(row.original_pieces, Math.max(0, val));
          updated.pieces_taken = pt;
          const pr = row.original_pieces - pt;
          updated.pieces_returned = pr;
          if (pt === 0) {
            updated.weight_taken = 0;
            updated.weight_returned = row.original_weight;
          } else if (pt === row.original_pieces) {
            updated.weight_taken = row.original_weight;
            updated.weight_returned = 0;
          } else {
            const propWt = Number(((row.original_weight / row.original_pieces) * pt).toFixed(2));
            updated.weight_taken = propWt;
            updated.weight_returned = Number((row.original_weight - propWt).toFixed(2));
          }
        } else if (field === "pieces_returned") {
          const pr = Math.min(row.original_pieces, Math.max(0, val));
          updated.pieces_returned = pr;
          const pt = row.original_pieces - pr;
          updated.pieces_taken = pt;
          if (pr === 0) {
            updated.weight_returned = 0;
            updated.weight_taken = row.original_weight;
          } else if (pr === row.original_pieces) {
            updated.weight_returned = row.original_weight;
            updated.weight_taken = 0;
          } else {
            const propWt = Number(((row.original_weight / row.original_pieces) * pr).toFixed(2));
            updated.weight_returned = propWt;
            updated.weight_taken = Number((row.original_weight - propWt).toFixed(2));
          }
        } else if (field === "weight_taken") {
          if (row.pieces_taken === 0) {
            updated.weight_taken = 0;
            updated.weight_returned = row.original_weight;
          } else if (row.pieces_returned === 0) {
            updated.weight_taken = row.original_weight;
            updated.weight_returned = 0;
          } else {
            const wt = Math.min(row.original_weight - 0.01, Math.max(0.01, val));
            updated.weight_taken = Number(wt.toFixed(2));
            updated.weight_returned = Number((row.original_weight - wt).toFixed(2));
          }
        } else if (field === "weight_returned") {
          if (row.pieces_returned === 0) {
            // Cannot return carats without a piece!
            updated.weight_returned = 0;
            updated.weight_taken = row.original_weight;
          } else if (row.pieces_taken === 0) {
            updated.weight_returned = row.original_weight;
            updated.weight_taken = 0;
          } else {
            const wr = Math.min(row.original_weight - 0.01, Math.max(0.01, val));
            updated.weight_returned = Number(wr.toFixed(2));
            updated.weight_taken = Number((row.original_weight - wr).toFixed(2));
          }
        }

        return updated;
      })
    );
  };

  const handleSetRowQuickAll = (rowIdx: number, mode: "take_all" | "return_all") => {
    setSettlementRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        const isUnc = Boolean(r.is_uncountable);
        return {
          ...r,
          pieces_taken: isUnc ? 0 : (mode === "take_all" ? r.original_pieces : 0),
          weight_taken: mode === "take_all" ? r.original_weight : 0,
          pieces_returned: isUnc ? 0 : (mode === "take_all" ? 0 : r.original_pieces),
          weight_returned: mode === "take_all" ? 0 : r.original_weight,
          selected_stones: isUnc ? [] : Array(r.original_pieces).fill(mode === "take_all"),
        };
      })
    );
  };

  const handleSetAllSettlement = (mode: "take_all" | "return_all") => {
    setSettlementRows((prev) =>
      prev.map((r) => {
        const isUnc = Boolean(r.is_uncountable);
        return {
          ...r,
          pieces_taken: isUnc ? 0 : (mode === "take_all" ? r.original_pieces : 0),
          weight_taken: mode === "take_all" ? r.original_weight : 0,
          pieces_returned: isUnc ? 0 : (mode === "take_all" ? 0 : r.original_pieces),
          weight_returned: mode === "take_all" ? 0 : r.original_weight,
          selected_stones: isUnc ? [] : Array(r.original_pieces).fill(mode === "take_all"),
        };
      })
    );
  };

  const filteredSales = useMemo(() => {
    let result = [...sales];

    // Section view filter
    if (viewSection === "sales") {
      result = result.filter((s) => (!s.is_approval && s.approval_status !== "pending") || s.approval_status === "approved_billed");
    } else if (viewSection === "approvals") {
      if (approvalSubFilter === "left") {
        result = result.filter((s) => (s.is_approval || s.approval_status === "pending") && s.approval_status !== "approved_billed" && s.approval_status !== "returned");
      } else if (approvalSubFilter === "taken") {
        result = result.filter((s) => s.approval_status === "approved_billed" || Boolean(s.approval_billed_date));
      } else {
        result = result.filter((s) => s.is_approval || s.approval_status === "pending" || s.approval_status === "approved_billed");
      }
    }

    // Text search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.invoice_no.toLowerCase().includes(q) ||
          s.buyer_name.toLowerCase().includes(q) ||
          s.company_name?.toLowerCase().includes(q) ||
          s.items?.some(
            (it) =>
              it.packet_number.toLowerCase().includes(q) ||
              it.particulars.toLowerCase().includes(q)
          )
      );
    }

    // Buyer filter
    if (buyerFilter !== "all") {
      result = result.filter(
        (s) => (s.buyer_name || "").trim().toLowerCase() === buyerFilter.toLowerCase()
      );
    }

    // Company filter
    if (companyFilter !== "all") {
      result = result.filter((s) => s.company_name === companyFilter);
    }

    // Sell Tag filter (Own Stock vs Outside Stock)
    if (stockTypeFilter !== "all") {
      result = result.filter((s) => s.sell_type === stockTypeFilter);
    }

    // Payment status filter
    if (statusFilter !== "all") {
      result = result.filter((s) => s.payment_status === statusFilter);
    }

    // Date range search
    if (startDate) {
      result = result.filter((s) => s.date >= startDate);
    }
    if (endDate) {
      result = result.filter((s) => s.date <= endDate);
    }

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, viewSection, approvalSubFilter, searchTerm, buyerFilter, companyFilter, stockTypeFilter, statusFilter, startDate, endDate]);

  const totalPages = Math.ceil(filteredSales.length / pageSize) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, buyerFilter, companyFilter, stockTypeFilter, statusFilter, startDate, endDate, viewSection, approvalSubFilter]);

  const filteredBrokerages = useMemo(() => {
    let result = [...brokerages];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.deal_no.toLowerCase().includes(q) ||
          d.seller_name.toLowerCase().includes(q) ||
          d.buyer_name.toLowerCase().includes(q) ||
          d.particulars.toLowerCase().includes(q) ||
          d.company_name?.toLowerCase().includes(q)
      );
    }
    if (companyFilter !== "all") {
      result = result.filter((d) => d.company_name === companyFilter);
    }
    if (startDate) {
      result = result.filter((d) => d.date >= startDate);
    }
    if (endDate) {
      result = result.filter((d) => d.date <= endDate);
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [brokerages, searchTerm, companyFilter, startDate, endDate]);

  // Outstanding receivables and approvals KPI counts
  const totalReceivables = useMemo(() => {
    return sales
      .filter((s) => !s.is_approval || s.approval_status === "approved_billed")
      .reduce((sum, s) => sum + s.balance, 0);
  }, [sales]);

  const pendingApprovalsCount = useMemo(() => {
    return sales.filter((s) => (s.is_approval || s.approval_status === "pending") && s.approval_status !== "approved_billed" && s.approval_status !== "returned").length;
  }, [sales]);

  const confirmedSalesCount = useMemo(() => {
    return sales.filter((s) => (!s.is_approval && s.approval_status !== "pending") || s.approval_status === "approved_billed").length;
  }, [sales]);

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
            <span>🧾</span> Sales, Invoicing & Approvals
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 13 }}>
            Manage Own Vault & Outside Stock deals, approvals/returns with partial take billing, and printable statements.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn btn-outline"
            onClick={() =>
              printFilteredSalesReport(filteredSales, {
                viewSection:
                  viewSection === "all"
                    ? "All Commercial Sales"
                    : viewSection === "sales"
                    ? "Confirmed Sales"
                    : "Approvals & Returns",
                company: companyFilter !== "all" ? companyFilter : undefined,
                dateRange: startDate || endDate ? `${startDate || "Start"} to ${endDate || "Present"}` : undefined,
                status: statusFilter !== "all" ? statusFilter : undefined,
              })
            }
            title="Print currently filtered sales & approvals with totals"
          >
            🖨️ Print Filtered Report
          </button>
          <button
            className="btn btn-outline"
            onClick={() =>
              printBuyerWiseLedgerReport(
                sales,
                buyerFilter !== "all" ? buyerFilter : undefined,
                companyFilter !== "all" ? companyFilter : undefined
              )
            }
            title="Print 10-column trade ledger report matching traditional gemstone accounting ledger format"
          >
            📋 Print Buyer Ledger {buyerFilter !== "all" ? `(${buyerFilter})` : ""}
          </button>
          <button
            className="btn btn-outline"
            onClick={() =>
              printBuyerApprovalStatement(sales, {
                company: companyFilter !== "all" ? companyFilter : undefined,
                filterMode: "left",
              })
            }
            title="Print buyer-grouped active memos (what approvals are left with clients)"
          >
            👥 Approvals Left Statement {companyFilter !== "all" ? `(${companyFilter})` : ""}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => {
              setPrintTakenBuyer(buyerFilter !== "all" ? buyerFilter : "all");
              setPrintTakenCompany(companyFilter !== "all" ? companyFilter : "all");
              setPrintTakenModalOpen(true);
            }}
            title="Filter by buyer and print approvals taken and counted as commercial sales"
          >
            ✅ Approvals Taken as Sale {buyerFilter !== "all" ? `(${buyerFilter})` : companyFilter !== "all" ? `(${companyFilter})` : ""}
          </button>
          <button className="btn btn-outline" onClick={() => navigate("/brokerage")}>
            🤝 + Log Brokerage Deal
          </button>
          <button className="btn btn-outline" onClick={() => navigate("/sales/new?memo=true")}>
            📋 + Issue Approval Voucher
          </button>
          <button className="btn btn-primary" onClick={() => navigate("/sales/new")}>
            + Create Sales Invoice
          </button>
        </div>
      </div>

      {/* KPI mini-cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {/* Outstanding Receivables */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Outstanding Receivables
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#f59e0b", marginTop: 4 }}>
            {formatINR(totalReceivables)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Unsettled balances from buyers across all companies
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #3b82f6" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Pending Approvals (On Inspection)
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#3b82f6", marginTop: 4 }}>
            {pendingApprovalsCount} Approvals
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Gemstones given to clients/brokers awaiting purchase decision
          </div>
        </div>

        {/* Confirmed Invoices Count */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Confirmed Sales
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--foreground)", marginTop: 4 }}>
            {confirmedSalesCount} Invoices
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Billed & finalized transactions (Own Stock & Outside Stock)
          </div>
        </div>

        {/* Brokerage Deals Count */}
        <div className="gem-kpi-card" style={{ borderTop: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Brokerage Deals
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#8b5cf6", marginTop: 4 }}>
            {brokerages.length} Deals
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Third-party outside transactions facilitated
          </div>
        </div>
      </div>

      {/* Section View Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8, flexWrap: "wrap" }}>
        <button
          className={`btn btn-sm ${viewSection === "all" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setViewSection("all")}
        >
          All Commercial Sales ({sales.length})
        </button>
        <button
          className={`btn btn-sm ${viewSection === "sales" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setViewSection("sales")}
        >
          Confirmed Invoices ({confirmedSalesCount})
        </button>
        <button
          className={`btn btn-sm ${viewSection === "approvals" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setViewSection("approvals")}
        >
          📋 Approvals & Returns ({pendingApprovalsCount})
        </button>
        <button
          className={`btn btn-sm ${viewSection === "brokerage" ? "btn-primary" : "btn-outline"}`}
          style={{
            background: viewSection === "brokerage" ? "#8b5cf6" : undefined,
            borderColor: viewSection === "brokerage" ? "#8b5cf6" : undefined,
            color: viewSection === "brokerage" ? "#fff" : undefined,
          }}
          onClick={() => setViewSection("brokerage")}
        >
          🤝 Brokerage Deals ({brokerages.length})
        </button>
      </div>

      {/* Filter and Date Search Bar */}
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
        {/* Search */}
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
            placeholder="Search party name, packet, particulars..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Buyer Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Buyer:</label>
          <select
            className="select"
            value={buyerFilter}
            onChange={(e) => setBuyerFilter(e.target.value)}
          >
            <option value="all">All Buyers ({uniqueBuyers.length})</option>
            {uniqueBuyers.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          {buyerFilter !== "all" && (
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setBuyerFilter("all")}
              title="Clear buyer filter"
            >
              ✕
            </button>
          )}
        </div>

        {/* Approval Memo State Sub-Filter (shown when on Approvals tab) */}
        {viewSection === "approvals" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Memo State:</label>
            <select
              className="select"
              value={approvalSubFilter}
              onChange={(e) => setApprovalSubFilter(e.target.value as any)}
            >
              <option value="all">All Approvals</option>
              <option value="left">Left with Buyer (Pending)</option>
              <option value="taken">Taken as Sale (Approved/Billed)</option>
            </select>
          </div>
        )}

        {/* Sell Tag Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Stock Tag:</label>
          <select
            className="select"
            value={stockTypeFilter}
            onChange={(e) => setStockTypeFilter(e.target.value)}
          >
            <option value="all">All Tags</option>
            <option value="own_stock">Own Stock</option>
            <option value="outside_stock">Outside Stock</option>
          </select>
        </div>

        {/* Company Filter */}
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

        {/* Payment Status Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Payment:</label>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="cleared">Cleared</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        {/* Date Search (From - To) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>From:</label>
          <input
            type="date"
            className="input"
            style={{ width: 130 }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <label style={{ fontSize: 12, color: "var(--muted)" }}>To:</label>
          <input
            type="date"
            className="input"
            style={{ width: 130 }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {(startDate || endDate) && (
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              title="Clear date filter"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {viewSection === "brokerage" ? (
        filteredBrokerages.length === 0 ? (
          <EmptyState
            icon="🤝"
            title="No Brokerage Deals Found"
            subtitle="Record deals facilitated between outside parties where you earned commission."
            action="+ Log Brokerage Deal"
            onAction={() => navigate("/brokerage")}
          />
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Deal #</th>
                    <th>Date</th>
                    <th>Company</th>
                    <th>Seller</th>
                    <th>Buyer</th>
                    <th>Gem Particulars</th>
                    <th style={{ textAlign: "right" }}>Deal Value</th>
                    <th style={{ textAlign: "right" }}>Commission Rate</th>
                    <th style={{ textAlign: "right" }}>Commission Total</th>
                    <th style={{ textAlign: "right" }}>Receivable</th>
                    <th style={{ textAlign: "center" }}>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBrokerages.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span style={{ fontWeight: 800, color: "#8b5cf6" }}>{d.deal_no}</span>
                      </td>
                      <td>{shortDate(d.date)}</td>
                      <td>{d.company_name || "—"}</td>
                      <td><strong>{d.seller_name}</strong></td>
                      <td><strong>{d.buyer_name}</strong></td>
                      <td>{d.particulars} ({d.weight} {d.unit || "cts"})</td>
                      <td style={{ textAlign: "right" }}>{formatINR(d.deal_value)}</td>
                      <td style={{ textAlign: "right", color: "var(--muted)" }}>{d.brokerage_percent}%</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                        {formatINR(d.commission_amount)}
                      </td>
                      <td style={{ textAlign: "right", color: d.balance_receivable > 0 ? "#ef4444" : "var(--muted)", fontWeight: 700 }}>
                        {formatINR(d.balance_receivable)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`badge ${d.settlement_status === "received" ? "badge-success" : "badge-warning"}`}
                          style={{ fontSize: 10, textTransform: "uppercase" }}
                        >
                          {d.settlement_status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ color: "#8b5cf6", fontWeight: 700 }}
                          onClick={() => navigate("/brokerage")}
                        >
                          Console ➔
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <>
          {isLoading ? (
            <Spinner />
          ) : filteredSales.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="No Sales or Approvals Found"
              subtitle="Create a sales invoice or issue an approval voucher to get started."
              action="+ Create Sales Invoice"
              onAction={() => navigate("/sales/new")}
            />
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Sell Tag & Reference</th>
                      <th>Date</th>
                      <th>Company</th>
                      <th>Buyer / Inspection Party</th>
                      <th>Items / Stones</th>
                      <th style={{ textAlign: "right" }}>Taxable Total</th>
                      <th style={{ textAlign: "right" }}>GST (Tax)</th>
                      <th style={{ textAlign: "right" }}>Grand Total (₹)</th>
                      <th style={{ textAlign: "right" }}>Balance Due</th>
                      <th style={{ textAlign: "center" }}>Type / Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSales.map((sale) => {
                      const isOutsideStock = sale.sell_type === "outside_stock";
                      const isApproval = sale.is_approval && sale.approval_status !== "approved_billed";
                      const isApprovedBilled = sale.approval_status === "approved_billed";

                      return (
                        <tr
                          key={sale.id}
                          style={{
                            background: isApproval ? "rgba(59, 130, 246, 0.03)" : undefined,
                          }}
                        >
                          {/* Sell Tag & Ref */}
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 900,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  textTransform: "uppercase",
                                  background: isOutsideStock
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "rgba(16, 185, 129, 0.15)",
                                  color: isOutsideStock ? "#d97706" : "#059669",
                                  border: `1px solid ${isOutsideStock ? "rgba(245, 158, 11, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
                                }}
                              >
                                {isOutsideStock ? "Outside Stock" : "Own Stock"}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              {sale.invoice_no}
                            </div>
                          </td>

                          {/* Date */}
                          <td>
                            <div style={{ fontWeight: 600 }}>{shortDate(sale.date)}</div>
                          </td>

                          {/* Company Name */}
                          <td>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                              {sale.company_name || "Shreeji Gems"}
                            </span>
                          </td>

                          {/* Buyer / Party Name */}
                          <td>
                            <div style={{ fontWeight: 700 }}>{sale.buyer_name}</div>
                            {sale.buyer_city && (
                              <div style={{ fontSize: 10, color: "var(--muted)" }}>{sale.buyer_city}</div>
                            )}
                          </td>

                          {/* Items / Stones */}
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {(sale.items || []).slice(0, 2).map((it, idx) => (
                                <div key={idx} style={{ fontSize: 11 }}>
                                  <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                                    {it.packet_number}
                                  </span>{" "}
                                  • {it.particulars} ({it.weight} {it.unit || "cts"})
                                </div>
                              ))}
                              {(sale.items || []).length > 2 && (
                                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                                  +{(sale.items || []).length - 2} more packets
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Taxable Total */}
                          <td style={{ textAlign: "right" }}>{formatINR(sale.subtotal)}</td>

                          {/* GST (Tax) */}
                          <td style={{ textAlign: "right", color: "var(--muted)" }}>
                            {formatINR(sale.tax_amount || 0)}
                          </td>

                          {/* Grand Total */}
                          <td style={{ textAlign: "right", fontWeight: 800 }}>
                            {formatINR(sale.total)}
                          </td>

                          {/* Balance Due */}
                          <td style={{ textAlign: "right" }}>
                            {sale.balance > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                                <span
                                  style={{
                                    fontWeight: 800,
                                    color: "#ef4444",
                                  }}
                                >
                                  {formatINR(sale.balance)}
                                </span>
                                {(sale.paid_amount || 0) > 0 && (
                                  <span style={{ fontSize: 10, color: "#d97706", fontWeight: 700 }}>
                                    Recv: {formatINR(sale.paid_amount)}
                                  </span>
                                )}
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    style={{
                                      fontSize: 10,
                                      padding: "2px 6px",
                                      height: 20,
                                      color: "#2563eb",
                                      background: "rgba(37, 99, 235, 0.12)",
                                      border: "1px solid rgba(37, 99, 235, 0.3)",
                                      borderRadius: 4,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      whiteSpace: "nowrap",
                                    }}
                                    title="Record partial payment received"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPartialPaySale(sale);
                                      setPartialPayAmount(sale.balance);
                                      setPartialPayDate(new Date().toISOString().slice(0, 10));
                                      setPartialPayMode(sale.payment_mode || "Bank Wire / NEFT");
                                      setPartialPayNote("");
                                    }}
                                  >
                                    + Partial Pay
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    style={{
                                      fontSize: 10,
                                      padding: "2px 6px",
                                      height: 20,
                                      color: "#059669",
                                      background: "rgba(16, 185, 129, 0.12)",
                                      border: "1px solid rgba(16, 185, 129, 0.3)",
                                      borderRadius: 4,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      whiteSpace: "nowrap",
                                    }}
                                    title="Select to mark full payment received"
                                    disabled={markFullPaymentMutation.isPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        window.confirm(
                                          `Mark full payment of ${formatINR(sale.balance)} received for invoice ${sale.invoice_no}?`
                                        )
                                      ) {
                                        markFullPaymentMutation.mutate({ id: sale.id });
                                      }
                                    }}
                                  >
                                    ✓ Full Received
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                                  <span style={{ fontWeight: 800, color: "#10b981" }}>{formatINR(0)}</span>
                                  <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700 }}>✓ Paid</span>
                                </div>
                                {(sale.payments || []).length > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    style={{ fontSize: 9, padding: "1px 4px", color: "var(--muted)" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPartialPaySale(sale);
                                      setPartialPayAmount(0);
                                      setPartialPayDate(new Date().toISOString().slice(0, 10));
                                      setPartialPayMode("Bank Wire / NEFT");
                                      setPartialPayNote("");
                                    }}
                                    title="View payment receipt history"
                                  >
                                    Payments ({sale.payments?.length})
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Type / Approval Status */}
                          <td style={{ textAlign: "center" }}>
                            {isApproval ? (
                              <span
                                className="badge badge-warning"
                                style={{ fontSize: 10, fontWeight: 700 }}
                              >
                                ON APPROVAL
                              </span>
                            ) : isApprovedBilled ? (
                              <span
                                className="badge badge-success"
                                style={{ fontSize: 10, fontWeight: 700 }}
                              >
                                APPROVED & BILLED
                              </span>
                            ) : (
                              <PayBadge status={sale.payment_status} />
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                              {isApproval && (
                                <>
                                  <button
                                    className="btn btn-primary btn-xs"
                                    style={{
                                      background: "#10b981",
                                      borderColor: "#10b981",
                                      fontSize: 10,
                                      fontWeight: 800,
                                    }}
                                    title="Select exact stones taken (billed) vs returned to vault"
                                    onClick={() => openSettlementDialog(sale, "approve")}
                                  >
                                    ✓ Approved & Billed
                                  </button>

                                  <button
                                    className="btn btn-outline btn-xs"
                                    style={{ fontSize: 10, color: "#f59e0b" }}
                                    title="Select stones returned to vault"
                                    onClick={() => openSettlementDialog(sale, "return")}
                                  >
                                    ↩ Return
                                  </button>
                                </>
                              )}

                              {!isApproval && (
                                <button
                                  className="btn btn-outline btn-xs"
                                  style={{
                                    fontSize: 10,
                                    color: "#2563eb",
                                    borderColor: "rgba(37, 99, 235, 0.4)",
                                    background: "rgba(37, 99, 235, 0.06)",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                  }}
                                  title="Convert this commercial sale into an active approval memo"
                                  disabled={convertSaleMutation.isPending}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Convert invoice ${sale.invoice_no} (${sale.buyer_name}) into an active approval memo?\n\nAssociated gemstone packets will be restored to 'on_approval' status.`
                                      )
                                    ) {
                                      convertSaleMutation.mutate({ saleId: sale.id });
                                    }
                                  }}
                                >
                                  📋 To Memo
                                </button>
                              )}

                              <button
                                className="btn btn-ghost btn-xs"
                                title="View Invoice / Approval Voucher"
                                onClick={() => navigate(`/sales/${sale.id}`)}
                              >
                                👁️
                              </button>

                              <button
                                className="btn btn-ghost btn-xs"
                                title="Edit Invoice"
                                onClick={() => navigate(`/sales/${sale.id}/edit`)}
                              >
                                ✏️
                              </button>

                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: "#ef4444" }}
                                title="Delete"
                                onClick={() => {
                                  if (window.confirm(`Delete transaction ${sale.invoice_no}?`)) {
                                    deleteSaleMutation.mutate(sale.id);
                                  }
                                }}
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
                    Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredSales.length)} of {filteredSales.length} invoices
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

          {/* Also in All view: Show outside brokerage deals section */}
          {viewSection === "all" && filteredBrokerages.length > 0 && (
            <div
              className="card"
              style={{
                padding: 16,
                marginTop: 14,
                background: "rgba(139, 92, 246, 0.03)",
                border: "1px solid rgba(139, 92, 246, 0.2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#7c3aed",
                  }}
                >
                  <span>🤝</span> Facilitated Outside Stock Brokerage Deals ({filteredBrokerages.length})
                </div>
                <button
                  className="btn btn-ghost btn-xs"
                  style={{ color: "#7c3aed", fontWeight: 700 }}
                  onClick={() => setViewSection("brokerage")}
                >
                  View Tabulated Deals ({filteredBrokerages.length}) ➔
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {filteredBrokerages.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    style={{
                      padding: 10,
                      background: "var(--surface)",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      fontSize: 11,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, color: "#8b5cf6" }}>{d.deal_no}</span>
                      <span style={{ color: "var(--muted)" }}>{shortDate(d.date)}</span>
                    </div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>
                      {d.particulars} ({d.weight} {d.unit || "cts"})
                    </div>
                    <div style={{ color: "var(--muted)", marginBottom: 4 }}>
                      From: <strong>{d.seller_name}</strong> ➔ To: <strong>{d.buyer_name}</strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        borderTop: "1px solid var(--border)",
                        paddingTop: 4,
                        marginTop: 4,
                      }}
                    >
                      <span>
                        Deal: <strong>{formatINR(d.deal_value || 0)}</strong>
                      </span>
                      <span style={{ color: "#10b981", fontWeight: 800 }}>
                        Comm: +{formatINR(d.commission_amount || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Approval Settlement Modal (Handling partial pieces/carats taken vs returned) */}
      {settlingSale && (
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
          onClick={() => setSettlingSale(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 860,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              padding: 24,
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⚖️</span> Settle Approval Memo — Stones Taken vs Returned
                </h2>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Voucher: <strong>{settlingSale.invoice_no}</strong> • Buyer: <strong>{settlingSale.buyer_name}</strong>
                </div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setSettlingSale(null)}>
                ✕
              </button>
            </div>

            {/* Quick Presets */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--surface-sunken)",
                padding: "8px 12px",
                borderRadius: 6,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Specify how many stones from this inspection memo the buyer takes (to be billed as sale) and how many return to vault inventory:
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ color: "var(--success)" }}
                  onClick={() => handleSetAllSettlement("take_all")}
                >
                  ✓ Take All (Full Approval)
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ color: "#f59e0b" }}
                  onClick={() => handleSetAllSettlement("return_all")}
                >
                  ↩ Return All (Full Return)
                </button>
              </div>
            </div>

            {/* Items Table with horizontal scroll support */}
            <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflowX: "auto", maxWidth: "100%" }}>
              <table className="table" style={{ width: "100%", minWidth: 840, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Packet # & Variety</th>
                    <th>Memo Total</th>
                    <th style={{ width: 110 }}>Pcs Taken (Sale)</th>
                    <th style={{ width: 120 }}>Carats Taken</th>
                    <th style={{ width: 110 }}>Pcs Returned</th>
                    <th style={{ width: 120 }}>Carats Returned</th>
                    <th style={{ textAlign: "right" }}>Billed (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementRows.map((row, idx) => {
                    const billedAmount = Math.round(row.weight_taken * row.rate_per_unit);
                    const isSingle = !row.is_uncountable && row.original_pieces === 1;
                    const hasMultiStonesWithWeights = !row.is_uncountable && row.original_pieces > 1 && Boolean(row.has_individual_weights);
                    const isMultiUnweighted = !row.is_uncountable && row.original_pieces > 1 && !row.has_individual_weights;

                    return (
                      <React.Fragment key={idx}>
                        <tr>
                          <td>
                            <strong>{row.packet_number}</strong>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              {row.particulars} {row.shape ? `• ${row.shape}` : ""}
                            </div>
                            {isSingle && (
                              <div style={{ fontSize: 10, color: "var(--primary)", fontWeight: 700, marginTop: 2 }}>
                                🏷️ Single Piece Stone
                              </div>
                            )}
                            {hasMultiStonesWithWeights && (
                              <div style={{ fontSize: 10, color: "var(--primary)", fontWeight: 700, marginTop: 2 }}>
                                💎 {row.original_pieces} Individual Stones below
                              </div>
                            )}
                            {isMultiUnweighted && (
                              <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700, marginTop: 2 }}>
                                📦 Multi-piece Parcel ({row.original_pieces} pcs unweighted)
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 700 }}>
                              {row.is_uncountable ? "Bulk Parcel" : `${row.original_pieces} pcs`}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              {row.original_weight.toFixed(2)} cts @ ₹{row.rate_per_unit}/ct
                            </div>
                          </td>

                          {/* Pcs Taken (Sale) */}
                          <td>
                            {row.is_uncountable ? (
                              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>— (Bulk)</span>
                            ) : isSingle ? (
                              <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => handleToggleSingleStone(idx)}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "3px 8px",
                                  borderRadius: 5,
                                  cursor: "pointer",
                                  border: `1.5px solid ${row.pieces_taken === 1 ? "#059669" : "var(--border)"}`,
                                  background: row.pieces_taken === 1 ? "rgba(16, 185, 129, 0.15)" : "transparent",
                                  color: row.pieces_taken === 1 ? "#059669" : "var(--muted)",
                                }}
                              >
                                {row.pieces_taken === 1 ? "✓ 1 pc Taken" : "○ 0 pcs"}
                              </button>
                            ) : hasMultiStonesWithWeights ? (
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{row.pieces_taken} pcs</span>
                            ) : (
                              <input
                                type="number"
                                name="pieces"
                                min="0"
                                max={row.original_pieces}
                                className="input pieces-input"
                                style={{ height: 30, fontSize: 12, padding: "2px 8px", width: 70 }}
                                value={row.pieces_taken}
                                onChange={(e) =>
                                  handleUpdateSettlementRow(idx, "pieces_taken", parseInt(e.target.value, 10) || 0)
                                }
                              />
                            )}
                          </td>

                          {/* Carats Taken */}
                          <td>
                            {isSingle || hasMultiStonesWithWeights ? (
                              <div style={{ fontSize: 12, fontWeight: 800, color: row.pieces_taken > 0 ? "var(--success)" : "var(--muted)" }}>
                                {row.weight_taken > 0 ? `${row.weight_taken.toFixed(2)} cts` : "0.00 cts"}
                              </div>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={row.original_weight}
                                className="input"
                                style={{ height: 30, fontSize: 12, padding: "2px 8px", width: 85 }}
                                value={row.weight_taken}
                                onChange={(e) =>
                                  handleUpdateSettlementRow(idx, "weight_taken", parseFloat(e.target.value) || 0)
                                }
                              />
                            )}
                          </td>

                          {/* Pcs Returned */}
                          <td>
                            {row.is_uncountable ? (
                              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>— (Bulk)</span>
                            ) : isSingle ? (
                              <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => handleToggleSingleStone(idx)}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "3px 8px",
                                  borderRadius: 5,
                                  cursor: "pointer",
                                  border: `1.5px solid ${row.pieces_returned === 1 ? "#f59e0b" : "var(--border)"}`,
                                  background: row.pieces_returned === 1 ? "rgba(245, 158, 11, 0.15)" : "transparent",
                                  color: row.pieces_returned === 1 ? "#b45309" : "var(--muted)",
                                }}
                              >
                                {row.pieces_returned === 1 ? "↩ 1 pc Ret." : "—"}
                              </button>
                            ) : hasMultiStonesWithWeights ? (
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{row.pieces_returned} pcs</span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max={row.original_pieces}
                                className="input"
                                style={{ height: 30, fontSize: 12, padding: "2px 8px", width: 70 }}
                                value={row.pieces_returned}
                                onChange={(e) =>
                                  handleUpdateSettlementRow(idx, "pieces_returned", parseInt(e.target.value, 10) || 0)
                                }
                              />
                            )}
                          </td>

                          {/* Carats Returned (Only shown as editable input for bulk orders and unweighted multi-piece stones) */}
                          <td>
                            {isSingle || hasMultiStonesWithWeights ? (
                              <div style={{ fontSize: 12, fontWeight: 800, color: row.pieces_returned > 0 ? "#b45309" : "var(--muted)" }}>
                                {row.weight_returned > 0 ? `${row.weight_returned.toFixed(2)} cts` : "—"}
                              </div>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={row.original_weight}
                                className="input"
                                style={{ height: 30, fontSize: 12, padding: "2px 8px", width: 85 }}
                                value={row.weight_returned}
                                onChange={(e) =>
                                  handleUpdateSettlementRow(idx, "weight_returned", parseFloat(e.target.value) || 0)
                                }
                              />
                            )}
                          </td>

                          {/* Line Billed */}
                          <td style={{ textAlign: "right", fontWeight: 800, color: "var(--primary)" }}>
                            {formatINR(billedAmount)}
                          </td>
                        </tr>

                        {/* Interactive Stone Selection Drawer: ONLY for packets with genuine individual stone weights and pieces > 1 */}
                        {hasMultiStonesWithWeights && (
                          <tr style={{ background: "var(--surface-sunken)" }}>
                            <td colSpan={7} style={{ padding: "8px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>
                                    💎 Individual Stones:
                                  </span>
                                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                    (Click a stone to toggle between Billed & Returned)
                                  </span>
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    type="button"
                                    className="btn btn-xs"
                                    style={{ fontSize: 10, padding: "2px 6px", background: "rgba(16, 185, 129, 0.12)", color: "#065f46", border: "1px solid #059669" }}
                                    onClick={() => handleSetRowQuickAll(idx, "take_all")}
                                  >
                                    ✓ Keep All Pieces
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-xs"
                                    style={{ fontSize: 10, padding: "2px 6px", background: "rgba(245, 158, 11, 0.12)", color: "#b45309", border: "1px solid #f59e0b" }}
                                    onClick={() => handleSetRowQuickAll(idx, "return_all")}
                                  >
                                    ↩ Return All Pieces
                                  </button>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, maxHeight: 180, overflowY: "auto", padding: "2px 0" }}>
                                {Array.from({ length: Math.min(row.original_pieces, 100) }).map((_, stIdx) => {
                                  const isTaken = row.selected_stones ? row.selected_stones[stIdx] : true;
                                  const stWt = row.stone_weights && row.stone_weights[stIdx] !== undefined
                                    ? row.stone_weights[stIdx]
                                    : (row.original_weight / row.original_pieces);

                                  return (
                                    <button
                                      key={stIdx}
                                      type="button"
                                      onClick={() => handleToggleStoneSelection(idx, stIdx)}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 5,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        padding: "4px 9px",
                                        borderRadius: 5,
                                        border: `1.5px solid ${isTaken ? "#059669" : "#f59e0b"}`,
                                        background: isTaken ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                                        color: isTaken ? "#065f46" : "#b45309",
                                        cursor: "pointer",
                                      }}
                                      title={`Click to toggle Stone #${stIdx + 1} (${Number(stWt).toFixed(2)}ct)`}
                                    >
                                      <span>{isTaken ? "✓ Billed:" : "↩ Returned:"}</span>
                                      <span>Stone #{stIdx + 1} ({Number(stWt).toFixed(2)}ct)</span>
                                    </button>
                                  );
                                })}
                                {row.original_pieces > 100 && (
                                  <span style={{ fontSize: 11, color: "var(--muted)", padding: "4px 8px", fontStyle: "italic", alignSelf: "center" }}>
                                    ... and {row.original_pieces - 100} more stones in lot (use Pieces Taken / Returned fields above for bulk lots)
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Settlement Totals Card */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                background: "var(--surface-sunken)",
                padding: 14,
                borderRadius: 8,
              }}
            >
              <div style={{ borderRight: "1px solid var(--border)", paddingRight: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--success)", textTransform: "uppercase" }}>
                  ✓ To Be Billed as Confirmed Sale:
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, marginTop: 4 }}>
                  {settlementRows.some((r) => !r.is_uncountable)
                    ? `${settlementRows.reduce((s, r) => s + r.pieces_taken, 0)} Stones (`
                    : ""}
                  {settlementRows.reduce((s, r) => s + r.weight_taken, 0).toFixed(2)} cts
                  {settlementRows.some((r) => !r.is_uncountable) ? ")" : ""}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)", marginTop: 2 }}>
                  Subtotal: {formatINR(settlementRows.reduce((s, r) => s + Math.round(r.weight_taken * r.rate_per_unit), 0))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", textTransform: "uppercase" }}>
                  ↩ Restoring to Vault In-Stock Inventory:
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, marginTop: 4 }}>
                  {settlementRows.some((r) => !r.is_uncountable)
                    ? `${settlementRows.reduce((s, r) => s + r.pieces_returned, 0)} Stones (`
                    : ""}
                  {settlementRows.reduce((s, r) => s + r.weight_returned, 0).toFixed(2)} cts
                  {settlementRows.some((r) => !r.is_uncountable) ? ")" : ""}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Packets in vault will be updated with returned pieces & remaining weight.
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label" style={{ fontSize: 11 }}>Settlement Notes / Remarks</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Buyer kept 1 large stone, returned 2 smaller pieces"
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSettlingSale(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={settleApprovalMutation.isPending}
                onClick={() => {
                  settleApprovalMutation.mutate({
                    saleId: settlingSale.id,
                    items: settlementRows.map((r, rowIdx) => {
                      const sWeights = r.stone_weights || [];
                      const takenWts: number[] = [];
                      const returnedWts: number[] = [];
                      if (!r.is_uncountable && r.original_pieces > 0) {
                        for (let k = 0; k < r.original_pieces; k++) {
                          const w = sWeights[k] !== undefined ? sWeights[k] : 0;
                          const isTaken = r.selected_stones ? r.selected_stones[k] : k < r.pieces_taken;
                          if (isTaken) takenWts.push(w);
                          else returnedWts.push(w);
                        }
                      }
                      return {
                        item_index: r.item_index !== undefined ? r.item_index : rowIdx,
                        item_id: r.item_id,
                        stone_id: r.stone_id,
                        packet_id: r.packet_id,
                        packet_number: r.packet_number,
                        particulars: r.particulars,
                        shape: r.shape,
                        pieces_taken: r.pieces_taken,
                        weight_taken: r.weight_taken,
                        pieces_returned: r.pieces_returned,
                        weight_returned: r.weight_returned,
                        rate_per_unit: r.rate_per_unit,
                        stone_weights: sWeights,
                        taken_stone_weights: takenWts,
                        returned_stone_weights: returnedWts,
                      };
                    }),
                    notes: settlementNotes.trim(),
                  });
                }}
              >
                {settleApprovalMutation.isPending ? "Updating Records..." : "Confirm & Settle Approval Memo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Filter & Print Approvals Taken as Sale by Buyer */}
      {printTakenModalOpen && (
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
          onClick={() => setPrintTakenModalOpen(false)}
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
                  <span>✅</span> Print Approvals Taken as Sale
                </h2>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  Filter by buyer name to print only that buyer's confirmed approval sales.
                </div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setPrintTakenModalOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label" style={{ fontWeight: 700 }}>
                  Select Buyer:
                </label>
                <select
                  className="select"
                  style={{ width: "100%" }}
                  value={printTakenBuyer}
                  onChange={(e) => setPrintTakenBuyer(e.target.value)}
                >
                  <option value="all">👥 All Buyers ({takenSalesBuyers.length} buyers with taken sales)</option>
                  {takenSalesBuyers.map((b) => {
                    const count = sales.filter(
                      (s) =>
                        (s.approval_status === "approved_billed" || Boolean(s.approval_billed_date)) &&
                        (s.buyer_name || "").trim().toLowerCase() === b.toLowerCase()
                    ).length;
                    return (
                      <option key={b} value={b}>
                        👤 {b} ({count} sale{count > 1 ? "s" : ""})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="label" style={{ fontWeight: 700 }}>
                  Filter by Company:
                </label>
                <select
                  className="select"
                  style={{ width: "100%" }}
                  value={printTakenCompany}
                  onChange={(e) => setPrintTakenCompany(e.target.value)}
                >
                  <option value="all">🏢 All Companies</option>
                  {DEFAULT_COMPANIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Matching summary preview */}
              <div
                style={{
                  background: "var(--surface-sunken)",
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                {(() => {
                  let filtered = sales.filter((s) => s.approval_status === "approved_billed" || Boolean(s.approval_billed_date));
                  if (printTakenBuyer !== "all") {
                    filtered = filtered.filter((s) => (s.buyer_name || "").trim().toLowerCase() === printTakenBuyer.toLowerCase());
                  }
                  if (printTakenCompany !== "all") {
                    filtered = filtered.filter((s) => s.company_name === printTakenCompany);
                  }
                  const totalPcs = filtered.reduce((sum, s) => sum + (s.items || []).reduce((is, it) => is + (it.is_uncountable ? 0 : (it.pieces || 0)), 0), 0);
                  const totalCarats = filtered.reduce((sum, s) => sum + (s.items || []).reduce((is, it) => is + (it.weight || 0), 0), 0);
                  const totalRev = filtered.reduce((sum, s) => sum + (s.total || 0), 0);

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontWeight: 800, color: "var(--primary)" }}>
                        {printTakenBuyer === "all" ? "All Buyers" : printTakenBuyer} — Summary Preview:
                      </div>
                      <div>
                        Matching Vouchers: <strong>{filtered.length}</strong> · Stones: <strong>{totalPcs} pcs</strong> ({totalCarats.toFixed(2)} cts)
                      </div>
                      <div>
                        Total Confirmed Sales Revenue: <strong>{formatINR(totalRev)}</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setPrintTakenModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setPrintTakenModalOpen(false);
                  printBuyerApprovalStatement(sales, {
                    company: printTakenCompany !== "all" ? printTakenCompany : undefined,
                    buyer: printTakenBuyer !== "all" ? printTakenBuyer : undefined,
                    filterMode: "taken_as_sale",
                  });
                }}
              >
                🖨️ Print Statement for {printTakenBuyer === "all" ? "All Buyers" : printTakenBuyer}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial / Flexible Payment Receipt Modal */}
      {partialPaySale && (
        <div className="modal-backdrop" onClick={() => setPartialPaySale(null)}>
          <div
            className="modal"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
                <span>💳</span> Record Payment Received ({partialPaySale.invoice_no})
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setPartialPaySale(null)}
              >
                ✕
              </button>
            </div>

            {/* Invoice Financial Summary Card */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 16,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
                fontSize: 12,
              }}
            >
              <div>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>Party / Buyer:</span>
                <div style={{ fontWeight: 800 }}>{partialPaySale.buyer_name}</div>
              </div>
              <div>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>Total Invoice Value:</span>
                <div style={{ fontWeight: 800 }}>{formatINR(partialPaySale.total)}</div>
              </div>
              <div>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>Previously Paid:</span>
                <div style={{ fontWeight: 800, color: "#059669" }}>
                  {formatINR(partialPaySale.paid_amount || 0)}
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!partialPaySale) return;
                if (partialPayAmount <= 0) {
                  show("Please enter a payment amount greater than 0", "error");
                  return;
                }
                if (partialPayAmount > partialPaySale.balance) {
                  show(`Payment amount (${formatINR(partialPayAmount)}) cannot exceed remaining balance due of ${formatINR(partialPaySale.balance)}`, "error");
                  return;
                }
                addPartialPaymentMutation.mutate({
                  id: partialPaySale.id,
                  amount: Number(partialPayAmount) || 0,
                  mode: partialPayMode,
                  date: partialPayDate || new Date().toISOString().slice(0, 10),
                  note: partialPayNote,
                });
              }}
            >
              {partialPaySale.balance <= 0 && (
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
                  ✓ Invoice is Already Fully Cleared (₹0 Remaining Due)
                </div>
              )}

              {partialPayAmount > partialPaySale.balance && (
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
                  ⚠️ Error: Payment amount ({formatINR(partialPayAmount)}) cannot exceed remaining invoice balance due of {formatINR(partialPaySale.balance)}!
                </div>
              )}

              <div
                style={{
                  background: "rgba(37, 99, 235, 0.05)",
                  border: "1px solid rgba(37, 99, 235, 0.2)",
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label className="label" style={{ margin: 0, fontWeight: 800, fontSize: 12 }}>
                    Payment Amount to Receive (₹):*
                  </label>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    Current Due: <strong style={{ color: "#ef4444" }}>{formatINR(partialPaySale.balance)}</strong>
                  </span>
                </div>

                <input
                  type="number"
                  min="1"
                  max={partialPaySale.balance}
                  disabled={partialPaySale.balance <= 0}
                  step="any"
                  className="input"
                  style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)", marginBottom: 8 }}
                  value={partialPayAmount || ""}
                  onChange={(e) => setPartialPayAmount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="Enter payment amount in ₹"
                  required
                />

                {/* Quick Presets */}
                {partialPaySale.balance > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    <button
                      type="button"
                      className="btn btn-xs btn-outline"
                      onClick={() => setPartialPayAmount(partialPaySale.balance)}
                    >
                      Full Balance ({formatINR(partialPaySale.balance)})
                    </button>
                    {partialPaySale.balance > 1000 && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => setPartialPayAmount(Math.round(partialPaySale.balance / 2))}
                      >
                        50% ({formatINR(Math.round(partialPaySale.balance / 2))})
                      </button>
                    )}
                    {partialPaySale.balance > 2000 && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => setPartialPayAmount(Math.round(partialPaySale.balance / 4))}
                      >
                        25% ({formatINR(Math.round(partialPaySale.balance / 4))})
                      </button>
                    )}
                  </div>
                )}

                {/* Real-time remaining balance calculation */}
                <div
                  style={{
                    fontSize: 11,
                    padding: "6px 10px",
                    background: "var(--surface)",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>New Balance Due After This Payment:</span>
                  <strong
                    style={{
                      color:
                        Math.max(0, partialPaySale.balance - partialPayAmount) === 0
                          ? "#059669"
                          : "#ef4444",
                    }}
                  >
                    {Math.max(0, partialPaySale.balance - partialPayAmount) === 0
                      ? "✓ Fully Cleared (₹0)"
                      : formatINR(Math.max(0, partialPaySale.balance - partialPayAmount))}
                  </strong>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                    Receipt Date:
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={partialPayDate}
                    onChange={(e) => setPartialPayDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                    Payment Mode:
                  </label>
                  <select
                    className="select"
                    value={partialPayMode}
                    onChange={(e) => setPartialPayMode(e.target.value)}
                  >
                    <option value="Bank Wire / NEFT">Bank Wire / NEFT</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Angadia">Angadia</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                  Payment Notes / UTR / Reference:
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Bank Ref #, Cheque #, or Angadia receipt..."
                  value={partialPayNote}
                  onChange={(e) => setPartialPayNote(e.target.value)}
                />
              </div>

              {/* Previously Logged Payments History */}
              {(partialPaySale.payments || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                    Payment History ({partialPaySale.payments?.length} receipts logged):
                  </div>
                  <div
                    style={{
                      maxHeight: 120,
                      overflowY: "auto",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                  >
                    <table className="table" style={{ width: "100%", margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Mode</th>
                          <th>Note</th>
                          <th style={{ textAlign: "right" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partialPaySale.payments?.map((pm, idx) => (
                          <tr key={pm.id || idx}>
                            <td>{shortDate(pm.date)}</td>
                            <td>{pm.mode}</td>
                            <td>{pm.note || "—"}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "#059669" }}>
                              {formatINR(pm.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setPartialPaySale(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 800 }}
                  disabled={
                    addPartialPaymentMutation.isPending ||
                    partialPaySale.balance <= 0 ||
                    partialPayAmount > partialPaySale.balance
                  }
                >
                  {addPartialPaymentMutation.isPending ? "Recording..." : "Record Payment & Recalculate Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
