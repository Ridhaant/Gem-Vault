import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../api";
import { Spinner } from "../ui";
import { formatINR } from "../format";
import type { GemPacket, GemBuyer, GemSale, GemSaleItem, WeightUnit, GstSettings, GemBox } from "../types/gemstone";
import { DEFAULT_COMPANIES } from "../types/gemstone";
import { GstSettingsModal } from "../GstSettingsModal";
import { normalizeBoxName } from "../gemstoneStorage";
import { useToast } from "../toast";
import { resolvePacketStoneStatuses, resolvePacketSubGemStatuses, isGenericVariety } from "../packetStones";

function getDefaultHsnAndGst(particulars: string): { hsn: string; gst: number } {
  const p = (particulars || "").toLowerCase();
  if (p.includes("diamond")) {
    return { hsn: "7102", gst: 0.25 };
  }
  if (p.includes("jewel") || p.includes("ring") || p.includes("necklace") || p.includes("gold") || p.includes("ornament")) {
    return { hsn: "7113", gst: 3.0 };
  }
  // Default loose precious and semi-precious stones
  return { hsn: "7103", gst: 0.25 };
}

export default function SaleForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const isMemoParam = searchParams.get("memo") === "true";
  const preselectedPktNum = searchParams.get("packet");

  // Load existing sale if in edit mode
  const { data: existingSale, isLoading: saleLoading } = useQuery<GemSale>({
    queryKey: ["sale", id],
    queryFn: () => apiGet(`/sales/${id}`),
    enabled: isEdit,
  });

  // Load in-stock packets and buyers
  const { data: packets = [], isLoading: packetsLoading } = useQuery<GemPacket[]>({
    queryKey: ["packets"],
    queryFn: () => apiGet("/packets"),
  });

  const { data: buyers = [] } = useQuery<GemBuyer[]>({
    queryKey: ["buyers"],
    queryFn: () => apiGet("/buyers"),
  });

  const { data: boxes = [] } = useQuery<GemBox[]>({
    queryKey: ["boxes"],
    queryFn: () => apiGet("/boxes"),
  });

  const { data: gstSettings } = useQuery<GstSettings>({
    queryKey: ["gst_settings"],
    queryFn: () => apiGet("/gst-settings"),
  });
  const [showGstModal, setShowGstModal] = useState(false);

  const { data: allSales = [] } = useQuery<GemSale[]>({
    queryKey: ["sales"],
    queryFn: () => apiGet("/sales"),
  });

  // Vault Gemstone Picker State (Box -> Packet -> Stone/Whole Packet)
  const [selectedBoxFilter, setSelectedBoxFilter] = useState<string>("all");
  const [searchStoneQuery, setSearchStoneQuery] = useState<string>("");
  const [selectedPacketId, setSelectedPacketId] = useState<string>("");
  const [allocPieces, setAllocPieces] = useState<number>(1);
  const [allocWeight, setAllocWeight] = useState<number>(1);
  const [allocRate, setAllocRate] = useState<number>(0);
  const [allocStoneChoice, setAllocStoneChoice] = useState<string>("whole");

  // Transaction configuration
  const [companyName, setCompanyName] = useState<string>("Shreeji Gems");
  const [sellType, setSellType] = useState<"own_stock" | "outside_stock">("own_stock");
  const [isApproval, setIsApproval] = useState<boolean>(isMemoParam);
  const [taxMode, setTaxMode] = useState<"intra_state" | "inter_state">("intra_state");

  const handleApplyGstToAll = (rate: number) => {
    setItems((prev) =>
      prev.map((it) => {
        const gstAmt = Math.round(it.total_price * (rate / 100) * 100) / 100;
        return {
          ...it,
          gst_rate: rate,
          gst_amount: gstAmt,
        };
      })
    );
    show(`Applied ${rate}% GST to all items`, "info");
  };

  // Line items state
  const [items, setItems] = useState<GemSaleItem[]>([]);
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>("Bank Wire / NEFT");

  // Invoice identifiers & particulars
  const [invoiceNo, setInvoiceNo] = useState(
    isMemoParam
      ? `APPR-${Date.now().toString().slice(-4)}`
      : `GEM-INV-${Date.now().toString().slice(-4)}`
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerCity, setBuyerCity] = useState("Mumbai");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [creditDays, setCreditDays] = useState(0);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // Custom outside stock stone input
  const [outsideModalOpen, setOutsideModalOpen] = useState(false);
  const [outsideItem, setOutsideItem] = useState<{
    particulars: string;
    shape: string;
    weight: number;
    unit: WeightUnit;
    pieces: number;
    rate_per_unit: number;
    cost_price: number;
    purchased_from: string;
    purchased_from_phone: string;
    purchased_from_notes: string;
    making_charges: number;
    diamond_weight: number;
    metal_weight: number;
  }>({
    particulars: "Emerald (Zambian)",
    shape: "Oval",
    weight: 2.5,
    unit: "cts",
    pieces: 1,
    rate_per_unit: 45000,
    cost_price: 35000,
    purchased_from: "",
    purchased_from_phone: "",
    purchased_from_notes: "",
    making_charges: 0,
    diamond_weight: 0,
    metal_weight: 0,
  });

  // Helper to compute remaining available stock for a packet after subtracting items already added to the current sale
  const getPacketRemainingStock = (pkt: GemPacket) => {
    const allocatedInSale = items.filter(
      (it) =>
        (it.packet_id && it.packet_id === pkt.id) ||
        (!it.packet_id?.startsWith("outside-") &&
          it.packet_number &&
          it.packet_number.toLowerCase() === pkt.packet_number.toLowerCase())
    );
    const allocatedPcs = allocatedInSale.reduce((sum, it) => sum + (Number(it.pieces) || 1), 0);
    const allocatedWt = allocatedInSale.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
    const remainingPcs = Math.max(0, (Number(pkt.pieces) || 1) - allocatedPcs);
    const remainingWt = Math.max(0, Number(((Number(pkt.weight) || 0) - allocatedWt).toFixed(2)));
    return {
      allocatedPcs,
      allocatedWt,
      remainingPcs,
      remainingWt,
      isFullyAllocated: remainingPcs <= 0 || remainingWt <= 0,
    };
  };

  const availablePackets = useMemo(() => {
    return packets.filter((p) => {
      const inStock = p.status === "in_stock" || !p.status;
      if (!inStock) return false;
      const { isFullyAllocated } = getPacketRemainingStock(p);
      return !isFullyAllocated;
    });
  }, [packets, items]);

  const filteredVaultPackets = useMemo(() => {
    let result = availablePackets;
    if (selectedBoxFilter !== "all") {
      if (selectedBoxFilter === "unassigned") {
        result = result.filter((p) => !p.box_name || normalizeBoxName(p.box_name).includes("unassigned"));
      } else {
        result = result.filter(
          (p) => normalizeBoxName(p.box_name) === normalizeBoxName(selectedBoxFilter)
        );
      }
    }
    if (searchStoneQuery.trim()) {
      const q = searchStoneQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.packet_number.toLowerCase().includes(q) ||
          p.particulars.toLowerCase().includes(q) ||
          p.shape.toLowerCase().includes(q) ||
          (p.box_name && p.box_name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [availablePackets, selectedBoxFilter, searchStoneQuery]);

  const selectedBoxStoneBreakdown = useMemo(() => {
    if (selectedBoxFilter === "all") return [];
    const boxPkts = availablePackets.filter((p) => {
      if (selectedBoxFilter === "unassigned") return !p.box_name || normalizeBoxName(p.box_name).includes("unassigned");
      return normalizeBoxName(p.box_name) === normalizeBoxName(selectedBoxFilter);
    });
    const map: Record<string, { type: string; pcs: number; weight: number; count: number }> = {};
    for (const p of boxPkts) {
      const type = (p.particulars || "Gemstone").trim();
      const stock = getPacketRemainingStock(p);
      if (!map[type]) map[type] = { type, pcs: 0, weight: 0, count: 0 };
      map[type].pcs += stock.remainingPcs;
      map[type].weight = Math.round((map[type].weight + stock.remainingWt) * 100) / 100;
      map[type].count += 1;
    }
    return Object.values(map).sort((a, b) => b.weight - a.weight);
  }, [selectedBoxFilter, availablePackets, items]);

  const selectedPacket = useMemo(() => {
    return packets.find((p) => p.id === selectedPacketId) || null;
  }, [packets, selectedPacketId]);

  // List of stone_details that are in-stock and have NOT been allocated in past sales or in current invoice items
  const unallocatedStoneDetails = useMemo(() => {
    if (!selectedPacket) return [];
    const statuses = resolvePacketStoneStatuses(
      selectedPacket,
      allSales,
      items,
      isEdit ? id : undefined
    );
    return statuses.filter((s) => s.status === "in_stock");
  }, [selectedPacket, allSales, items, isEdit, id]);

  // List of sub_gems that are in-stock and have NOT been allocated in past sales or in current invoice items
  const unallocatedSubGems = useMemo(() => {
    if (!selectedPacket) return [];
    const statuses = resolvePacketSubGemStatuses(
      selectedPacket,
      allSales,
      items,
      isEdit ? id : undefined
    );
    return statuses.filter((s) => s.status === "in_stock");
  }, [selectedPacket, allSales, items, isEdit, id]);

  const selectedPacketStock = useMemo(() => {
    if (!selectedPacket) return { remainingPcs: 0, remainingWt: 0, allocatedPcs: 0, allocatedWt: 0, singleStoneWeight: 0 };
    const stock = getPacketRemainingStock(selectedPacket);
    let singleStoneWeight = 0;
    if (selectedPacket.stone_details && selectedPacket.stone_details.length > 0) {
      if (unallocatedStoneDetails.length > 0) {
        singleStoneWeight = unallocatedStoneDetails[0].weight || (stock.remainingPcs > 0 ? Number((stock.remainingWt / stock.remainingPcs).toFixed(2)) : stock.remainingWt);
      } else {
        singleStoneWeight = stock.remainingWt;
      }
    } else if (selectedPacket.sub_gems && selectedPacket.sub_gems.length > 0) {
      if (unallocatedSubGems.length > 0) {
        singleStoneWeight = unallocatedSubGems[0].weight || (stock.remainingPcs > 0 ? Number((stock.remainingWt / stock.remainingPcs).toFixed(2)) : stock.remainingWt);
      } else {
        singleStoneWeight = stock.remainingWt;
      }
    } else if (selectedPacket.stone_weight && selectedPacket.stone_weight > 0) {
      singleStoneWeight = selectedPacket.stone_weight;
    } else if (Array.isArray(selectedPacket.stone_weights) && selectedPacket.stone_weights.length > 0) {
      const unallocatedIdx = Math.min(stock.allocatedPcs, selectedPacket.stone_weights.length - 1);
      singleStoneWeight = selectedPacket.stone_weights[unallocatedIdx] || (stock.remainingPcs > 0 ? Number((stock.remainingWt / stock.remainingPcs).toFixed(2)) : stock.remainingWt);
    } else if (stock.remainingPcs > 0) {
      singleStoneWeight = Number((stock.remainingWt / stock.remainingPcs).toFixed(2));
    } else {
      singleStoneWeight = stock.remainingWt;
    }
    return {
      ...stock,
      singleStoneWeight: Math.min(stock.remainingWt, Math.max(0.01, Number(singleStoneWeight.toFixed(2)))),
    };
  }, [selectedPacket, items, unallocatedStoneDetails, unallocatedSubGems]);

  const getPacketVarietyDisplay = (p: GemPacket) => {
    const statuses = resolvePacketStoneStatuses(p, allSales);
    if (statuses && statuses.length > 1) {
      const unique = Array.from(
        new Set(statuses.map((s) => (s.variety || "").trim()).filter((v) => !isGenericVariety(v, p.particulars)))
      );
      if (unique.length > 1) {
        return `${p.particulars} (Mixed: ${unique.slice(0, 3).join(", ")}${unique.length > 3 ? "..." : ""})`;
      }
    }
    if (p.stone_details && p.stone_details.length > 1) {
      const unique = Array.from(
        new Set(p.stone_details.map((s) => (s.variety || "").trim()).filter((v) => !isGenericVariety(v, p.particulars)))
      );
      if (unique.length > 1) {
        return `${p.particulars} (Mixed: ${unique.slice(0, 3).join(", ")}${unique.length > 3 ? "..." : ""})`;
      }
    }
    return p.particulars;
  };

  useEffect(() => {
    if (selectedPacket) {
      const { remainingPcs, remainingWt, singleStoneWeight } = selectedPacketStock;
      if (remainingPcs > 0 && remainingWt > 0) {
        setAllocPieces(1);
        const defaultRate =
          selectedPacket.sale_rate_per_unit ||
          (selectedPacket.weight ? Math.round(selectedPacket.sale_price / selectedPacket.weight) : 0);
        setAllocRate(defaultRate);

        if (unallocatedStoneDetails.length > 0) {
          const firstSt = unallocatedStoneDetails[0];
          setAllocStoneChoice(firstSt.id || "single");
          setAllocWeight(firstSt.weight || singleStoneWeight);
        } else if (unallocatedSubGems.length > 0) {
          const firstSub = unallocatedSubGems[0];
          setAllocStoneChoice(firstSub.id || "single");
          setAllocWeight(firstSub.weight || singleStoneWeight);
        } else {
          setAllocWeight(singleStoneWeight);
          setAllocStoneChoice(remainingPcs === 1 ? "whole" : "single");
        }
      }
    }
  }, [selectedPacketId]);

  // If items change and the currently selected stone was just allocated, automatically advance to next available stone
  useEffect(() => {
    if (selectedPacket) {
      if (unallocatedStoneDetails.length > 0) {
        const stillValid = unallocatedStoneDetails.some((s) => s.id === allocStoneChoice);
        if (!stillValid && allocStoneChoice !== "whole" && allocStoneChoice !== "custom_partial") {
          const nextSt = unallocatedStoneDetails[0];
          setAllocStoneChoice(nextSt.id || "single");
          setAllocWeight(nextSt.weight || selectedPacketStock.singleStoneWeight);
        }
      } else if (unallocatedSubGems.length > 0) {
        const stillValid = unallocatedSubGems.some((s) => s.id === allocStoneChoice);
        if (!stillValid && allocStoneChoice !== "whole" && allocStoneChoice !== "custom_partial") {
          const nextSub = unallocatedSubGems[0];
          setAllocStoneChoice(nextSub.id || "single");
          setAllocWeight(nextSub.weight || selectedPacketStock.singleStoneWeight);
        }
      }
    }
  }, [items, unallocatedStoneDetails, unallocatedSubGems]);

  // Pre-fill state when editing an existing invoice
  useEffect(() => {
    if (existingSale) {
      setInvoiceNo(existingSale.invoice_no);
      setDate(existingSale.date);
      setCompanyName(existingSale.company_name || "Shreeji Gems");
      setSellType(existingSale.sell_type || "own_stock");
      setIsApproval(!!existingSale.is_approval);
      setBuyerName(existingSale.buyer_name);
      setBuyerPhone(existingSale.buyer_phone || "");
      setBuyerCity(existingSale.buyer_city || "Mumbai");
      setBuyerAddress(existingSale.buyer_address || "");
      setCreditDays(existingSale.credit_days || 0);
      setDiscount(existingSale.discount || 0);
      setNotes(existingSale.notes || "");
      setInitialPayment(existingSale.paid_amount || 0);
      setPaymentMode(existingSale.payment_mode || "Bank Wire / NEFT");
      if (existingSale.items && existingSale.items.length > 0) {
        setItems(
          existingSale.items.map((it) => {
            const hsnInfo = getDefaultHsnAndGst(it.particulars);
            const rate = it.rate_per_unit || 0;
            const tot = it.total_price !== undefined ? it.total_price : Math.round(rate * it.weight);
            const gstR = it.gst_rate ?? hsnInfo.gst;
            return {
              packet_id: it.packet_id || "",
              packet_number: it.packet_number,
              particulars: it.particulars,
              shape: it.shape,
              weight: it.weight,
              unit: it.unit || "cts",
              pieces: it.pieces,
              mm_size: it.mm_size || "",
              cost_price: it.cost_price,
              rate_per_unit: rate,
              total_price: tot,
              hsn_code: it.hsn_code || hsnInfo.hsn,
              gst_rate: gstR,
              gst_amount: Math.round(tot * (gstR / 100) * 100) / 100,
              making_charges: it.making_charges || 0,
              diamond_weight: it.diamond_weight || 0,
              metal_weight: it.metal_weight || 0,
            };
          })
        );
      }
    }
  }, [existingSale]);

  // Pre-fill if navigated with a packet param
  useEffect(() => {
    if (!isEdit && preselectedPktNum && availablePackets.length > 0 && items.length === 0) {
      const match = availablePackets.find(
        (p) => p.packet_number.toLowerCase() === preselectedPktNum.toLowerCase()
      );
      if (match) {
        handleAddItem(match);
      }
    }
  }, [isEdit, preselectedPktNum, availablePackets]);

  const handleAddItem = (pkt: GemPacket) => {
    const stock = getPacketRemainingStock(pkt);
    if (stock.remainingPcs <= 0 || stock.remainingWt <= 0) {
      show(`All pieces from packet ${pkt.packet_number} are already allocated in this transaction`, "warning");
      return;
    }

    const rate = pkt.sale_rate_per_unit || (pkt.weight ? Math.round(pkt.sale_price / pkt.weight) : 0);
    const tot = Math.round(rate * stock.remainingWt);
    const hsnInfo = getDefaultHsnAndGst(pkt.particulars);
    const hsn = pkt.hsn_code || hsnInfo.hsn;
    const gstRate = pkt.gst_rate ?? hsnInfo.gst;
    const gstAmt = Math.round(tot * (gstRate / 100) * 100) / 100;

    const newItem: GemSaleItem = {
      packet_id: pkt.id,
      packet_number: pkt.packet_number,
      particulars: pkt.particulars,
      shape: pkt.shape,
      weight: stock.remainingWt,
      unit: pkt.unit || "cts",
      pieces: stock.remainingPcs,
      mm_size: pkt.mm_size || "",
      cost_price: Math.round(
        (pkt.purchase_rate_per_unit || (pkt.purchase_price / (pkt.weight || 1))) * stock.remainingWt
      ),
      rate_per_unit: rate,
      total_price: tot,
      hsn_code: hsn,
      gst_rate: gstRate,
      gst_amount: gstAmt,
      making_charges: pkt.making_charges || 0,
      diamond_weight: pkt.diamond_weight || 0,
      metal_weight: pkt.metal_weight || 0,
    };
    setItems((prev) => [...prev, newItem]);
    show(`Allocated ${stock.remainingPcs} pcs (${stock.remainingWt} ${pkt.unit || "cts"}) from packet ${pkt.packet_number}`, "success");
  };

  const handleAddSelectedStone = () => {
    if (!selectedPacket) return;
    const maxPcs = selectedPacketStock.remainingPcs;
    const maxWt = selectedPacketStock.remainingWt;
    if (maxPcs <= 0 || maxWt <= 0) {
      show("All pieces from this packet are already allocated in this transaction", "warning");
      return;
    }

    let chosenStoneId: string | undefined = undefined;
    let chosenSubGemId: string | undefined = undefined;
    let partDesc = selectedPacket.particulars;
    let stoneWeight = allocWeight;

    if (allocStoneChoice !== "whole" && allocStoneChoice !== "custom_partial") {
      if (unallocatedStoneDetails.length > 0 || (selectedPacket.stone_details && selectedPacket.stone_details.length > 0) || (selectedPacket.stone_weights && selectedPacket.stone_weights.length > 0)) {
        let st = unallocatedStoneDetails.find((s) => s.id === allocStoneChoice) || selectedPacket.stone_details?.find((s) => s.id === allocStoneChoice);
        if (!st && (allocStoneChoice === "single" || !allocStoneChoice) && unallocatedStoneDetails.length > 0) {
          st = unallocatedStoneDetails[0];
        }
        if (st) {
          const isAlreadyAllocated = !unallocatedStoneDetails.some((u) => u.id === st!.id);
          if (isAlreadyAllocated) {
            show(`Stone ${st.variety || "stone"} is not available in stock or has already been added to this sale!`, "warning");
            return;
          }
          partDesc = `${st.variety || selectedPacket.particulars} (${st.shape || selectedPacket.shape})`;
          chosenStoneId = st.id;
          stoneWeight = st.weight || allocWeight;
        }
      } else if (unallocatedSubGems.length > 0 || (selectedPacket.sub_gems && selectedPacket.sub_gems.length > 0)) {
        let sub = unallocatedSubGems.find((s) => s.id === allocStoneChoice) || selectedPacket.sub_gems?.find((s) => s.id === allocStoneChoice);
        if (!sub && (allocStoneChoice === "single" || !allocStoneChoice) && unallocatedSubGems.length > 0) {
          sub = unallocatedSubGems[0];
        }
        if (sub) {
          const isAlreadyAllocated = !unallocatedSubGems.some((u) => u.id === sub!.id);
          if (isAlreadyAllocated) {
            show(`Stone ${sub.variety} is not available in stock or has already been added to this sale!`, "warning");
            return;
          }
          partDesc = `${selectedPacket.particulars} (${sub.variety} - ${sub.shape})`;
          chosenSubGemId = sub.id;
          chosenStoneId = sub.id;
          stoneWeight = sub.weight || allocWeight;
        }
      }
    }

    const piecesToAdd = Math.max(1, Math.min(allocPieces, maxPcs));
    const weightToAdd = Math.max(0.01, Math.min(stoneWeight, maxWt));
    const rate = allocRate > 0
      ? allocRate
      : (selectedPacket.sale_rate_per_unit || (selectedPacket.weight ? Math.round(selectedPacket.sale_price / selectedPacket.weight) : 0));
    const tot = Math.round(rate * weightToAdd);
    const hsnInfo = getDefaultHsnAndGst(selectedPacket.particulars);
    const hsn = selectedPacket.hsn_code || hsnInfo.hsn;
    const gstRate = selectedPacket.gst_rate ?? hsnInfo.gst;
    const gstAmt = Math.round(tot * (gstRate / 100) * 100) / 100;

    const newItem: GemSaleItem = {
      packet_id: selectedPacket.id,
      packet_number: selectedPacket.packet_number,
      particulars: partDesc,
      shape: selectedPacket.shape,
      weight: weightToAdd,
      unit: selectedPacket.unit || "cts",
      pieces: piecesToAdd,
      mm_size: selectedPacket.mm_size || "",
      cost_price: Math.round(
        (selectedPacket.purchase_rate_per_unit || (selectedPacket.purchase_price / (selectedPacket.weight || 1))) *
          weightToAdd
      ),
      rate_per_unit: rate,
      total_price: tot,
      hsn_code: hsn,
      gst_rate: gstRate,
      gst_amount: gstAmt,
      making_charges: selectedPacket.making_charges || 0,
      diamond_weight: selectedPacket.diamond_weight || 0,
      metal_weight: selectedPacket.metal_weight || 0,
      stone_id: chosenStoneId,
      sub_gem_id: chosenSubGemId,
    };

    setItems((prev) => [...prev, newItem]);
    if (maxPcs - piecesToAdd <= 0) {
      setSelectedPacketId("");
    }
    show(`Allocated ${piecesToAdd} pc (${weightToAdd} ${selectedPacket.unit || "cts"}) from packet ${selectedPacket.packet_number}`, "success");
  };

  const handleAddOutsideItem = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = Number(outsideItem.rate_per_unit) || 0;
    const wt = Number(outsideItem.weight) || 1;
    const pcs = Number(outsideItem.pieces) || 1;
    const tot = Math.round(rate * wt);
    const hsnInfo = getDefaultHsnAndGst(outsideItem.particulars);
    const gstAmt = Math.round(tot * (hsnInfo.gst / 100) * 100) / 100;

    const newItem: GemSaleItem = {
      packet_id: "outside-" + Math.random().toString(36).substring(2, 8),
      packet_number: `OUT-${items.length + 1}`,
      particulars: outsideItem.particulars,
      shape: outsideItem.shape,
      weight: wt,
      unit: outsideItem.unit,
      pieces: pcs,
      mm_size: "",
      cost_price: Number(outsideItem.cost_price) || 0,
      rate_per_unit: rate,
      total_price: tot,
      hsn_code: hsnInfo.hsn,
      gst_rate: hsnInfo.gst,
      gst_amount: gstAmt,
      purchased_from: outsideItem.purchased_from?.trim() || "",
      purchased_from_phone: outsideItem.purchased_from_phone?.trim() || "",
      purchased_from_notes: outsideItem.purchased_from_notes?.trim() || "",
      making_charges: Number(outsideItem.making_charges) || 0,
      diamond_weight: Number(outsideItem.diamond_weight) || 0,
      metal_weight: Number(outsideItem.metal_weight) || 0,
    };

    setItems((prev) => [...prev, newItem]);
    setSellType("outside_stock");
    setOutsideModalOpen(false);
    show(`Added outside stock stone (${pcs} pcs / ${wt} ${outsideItem.unit}) to invoice`, "success");
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateItemPieces = (idx: number, pcs: number) => {
    setItems((prev) => {
      const it = prev[idx];
      if (!it) return prev;
      const targetPkt = !it.packet_id?.startsWith("outside-")
        ? packets.find(
            (p) =>
              (it.packet_id && p.id === it.packet_id) ||
              p.packet_number.toLowerCase() === it.packet_number.toLowerCase()
          )
        : null;
      let maxPcs = 999999;
      if (targetPkt) {
        const otherAllocPcs = prev
          .filter(
            (other, i) =>
              i !== idx &&
              ((it.packet_id && other.packet_id === it.packet_id) ||
                (!other.packet_id?.startsWith("outside-") &&
                  other.packet_number.toLowerCase() === it.packet_number.toLowerCase()))
          )
          .reduce((sum, o) => sum + (Number(o.pieces) || 1), 0);
        maxPcs = Math.max(1, (Number(targetPkt.pieces) || 1) - otherAllocPcs);
      }
      const clampedPcs = Math.max(1, Math.min(pcs, maxPcs));
      return prev.map((item, i) => (i === idx ? { ...item, pieces: clampedPcs } : item));
    });
  };

  const handleUpdateItemWeight = (idx: number, wt: number) => {
    setItems((prev) => {
      const it = prev[idx];
      if (!it) return prev;
      const targetPkt = !it.packet_id?.startsWith("outside-")
        ? packets.find(
            (p) =>
              (it.packet_id && p.id === it.packet_id) ||
              p.packet_number.toLowerCase() === it.packet_number.toLowerCase()
          )
        : null;
      let maxWt = 999999;
      if (targetPkt) {
        const otherAllocWt = prev
          .filter(
            (other, i) =>
              i !== idx &&
              ((it.packet_id && other.packet_id === it.packet_id) ||
                (!other.packet_id?.startsWith("outside-") &&
                  other.packet_number.toLowerCase() === it.packet_number.toLowerCase()))
          )
          .reduce((sum, o) => sum + (Number(o.weight) || 0), 0);
        maxWt = Math.max(0.01, Number(((Number(targetPkt.weight) || 0) - otherAllocWt).toFixed(2)));
      }
      const clampedWt = Math.max(0.01, Math.min(wt, maxWt));
      const tot = Math.round((it.rate_per_unit || 0) * clampedWt);
      const gstR = it.gst_rate ?? 0.25;
      const gstAmt = Math.round(tot * (gstR / 100) * 100) / 100;
      return prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              weight: clampedWt,
              total_price: tot,
              gst_amount: gstAmt,
            }
          : item
      );
    });
  };

  const handleUpdateItemRate = (idx: number, rate: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const tot = Math.round(rate * it.weight);
        const gstR = it.gst_rate ?? 0.25;
        const gstAmt = Math.round(tot * (gstR / 100) * 100) / 100;
        return {
          ...it,
          rate_per_unit: rate,
          total_price: tot,
          gst_amount: gstAmt,
        };
      })
    );
  };

  const handleUpdateItemGst = (idx: number, gstRate: number, hsnCode: string) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const gstAmt = Math.round(it.total_price * (gstRate / 100) * 100) / 100;
        return {
          ...it,
          hsn_code: hsnCode,
          gst_rate: gstRate,
          gst_amount: gstAmt,
        };
      })
    );
  };

  // Tax calculations
  const subtotal = items.reduce((sum, it) => sum + it.total_price, 0);
  const totalGst = items.reduce((sum, it) => sum + (it.gst_amount || 0), 0);
  const totalCost = items.reduce((sum, it) => sum + it.cost_price, 0);
  const grandTotal = Math.max(0, subtotal + totalGst - discount);
  const projectedGrossProfit = subtotal - totalCost;

  // Split CGST and SGST or IGST
  const cgstAmount = taxMode === "intra_state" ? Math.round((totalGst / 2) * 100) / 100 : 0;
  const sgstAmount = taxMode === "intra_state" ? Math.round((totalGst / 2) * 100) / 100 : 0;
  const igstAmount = taxMode === "inter_state" ? totalGst : 0;

  const saveSaleMutation = useMutation({
    mutationFn: (salePayload: any) => {
      if (isEdit) {
        return apiPut(`/sales/${id}`, { ...salePayload, id });
      }
      return apiPost("/sales", salePayload);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale", id] });
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      show(
        isApproval
          ? "Approval Voucher generated and packets marked On-Approval!"
          : "Sales invoice created and inventory updated!",
        "success"
      );
      navigate(`/sales/${data?.id || id}`);
    },
    onError: (err: any) => show("Error saving sale: " + err.message, "error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      show("Please select at least one gemstone packet to sell or issue on memo", "warning");
      return;
    }
    if (!buyerName.trim()) {
      show("Please enter buyer or client name", "warning");
      return;
    }

    // Enforce that total allocated pieces and weight for any packet do not exceed physical stock
    for (const pkt of packets) {
      const allocated = items.filter(
        (it) =>
          (it.packet_id && it.packet_id === pkt.id) ||
          (!it.packet_id?.startsWith("outside-") &&
            it.packet_number &&
            it.packet_number.toLowerCase() === pkt.packet_number.toLowerCase())
      );
      if (allocated.length > 0) {
        const totalPcs = allocated.reduce((s, it) => s + (Number(it.pieces) || 1), 0);
        const totalWt = allocated.reduce((s, it) => s + (Number(it.weight) || 0), 0);
        const maxPcs = Number(pkt.pieces) || 1;
        const maxWt = Number(pkt.weight) || 0;
        if (totalPcs > maxPcs) {
          show(
            `Cannot proceed: You have allocated ${totalPcs} pcs of packet ${pkt.packet_number}, but only ${maxPcs} pcs exist in stock.`,
            "warning"
          );
          return;
        }
        if (totalWt > maxWt + 0.05) {
          show(
            `Cannot proceed: You have allocated ${totalWt.toFixed(2)} cts of packet ${pkt.packet_number}, but only ${maxWt.toFixed(2)} cts exist in stock.`,
            "warning"
          );
          return;
        }
      }
    }

    const payload = {
      invoice_no: invoiceNo,
      date,
      company_name: companyName,
      sell_type: sellType,
      is_approval: isApproval,
      approval_status: isApproval ? "pending" : undefined,
      buyer_name: buyerName.trim(),
      buyer_phone: buyerPhone.trim(),
      buyer_city: buyerCity.trim(),
      buyer_address: buyerAddress.trim(),
      items,
      subtotal,
      discount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      tax_amount: totalGst,
      total: grandTotal,
      initial_payment: initialPayment,
      payment_mode: paymentMode,
      credit_days: creditDays,
      due_date: creditDays > 0 ? new Date(Date.now() + creditDays * 86400000).toISOString().slice(0, 10) : undefined,
      notes,
    };

    saveSaleMutation.mutate(payload);
  };

  const isJewelleryCompany = companyName.includes("Tirth") || companyName.includes("Mokshil");

  if (packetsLoading || saleLoading) return <Spinner />;

  return (
    <div className="page-body" style={{ maxWidth: 1020, margin: "0 auto", gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/sales")}>
            ← Back to Sales
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: "8px 0 0" }}>
            {isEdit
              ? `Edit Invoice: ${existingSale?.invoice_no}`
              : isApproval
              ? "New Approval Voucher"
              : "Generate Commercial Sales Invoice"}
          </h1>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className={`btn btn-sm ${isApproval ? "btn-primary" : "btn-outline"}`}
            style={{
              background: isApproval ? "#3b82f6" : undefined,
              borderColor: isApproval ? "#3b82f6" : undefined,
            }}
            onClick={() => {
              setIsApproval(!isApproval);
              if (!isApproval && invoiceNo.startsWith("GEM-INV-")) {
                setInvoiceNo(`APPR-${Date.now().toString().slice(-4)}`);
              } else if (isApproval && invoiceNo.startsWith("APPR-")) {
                setInvoiceNo(`GEM-INV-${Date.now().toString().slice(-4)}`);
              }
            }}
          >
            📋 {isApproval ? "Mode: Approval Voucher" : "Make Approval Voucher"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Company & Deal Classification Card */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span>🏢</span> Company & Deal Classification
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 14 }}>
            {/* 1 of 5 Companies */}
            <div>
              <label className="label">Billing Company (1 of 5):</label>
              <select
                className="select"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              >
                {DEFAULT_COMPANIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Sell Tag (Own Stock vs Outside Stock) */}
            <div>
              <label className="label">Stock Tag:</label>
              <select
                className="select"
                value={sellType}
                onChange={(e) => setSellType(e.target.value as any)}
              >
                <option value="own_stock">Own Stock (Vault)</option>
                <option value="outside_stock">Outside Stock (Third Party)</option>
              </select>
            </div>

            {/* Reference Number */}
            <div>
              <label className="label">{isApproval ? "Approval / Jangi Ref #" : "Invoice #"}:</label>
              <input
                type="text"
                className="input"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                required
              />
            </div>

            {/* Date */}
            <div>
              <label className="label">Issue Date:</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Buyer Particulars */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span>👤</span> Buyer / Inspection Party Particulars
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 14, marginBottom: 12 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="label" style={{ margin: 0 }}>Buyer / Client Name:*</label>
                {buyers.length > 0 && (
                  <select
                    className="select"
                    style={{ fontSize: 11, padding: "2px 8px", height: 26, background: "var(--surface-sunken)" }}
                    value=""
                    onChange={(e) => {
                      const match = buyers.find((b) => b.name === e.target.value);
                      if (match) {
                        setBuyerName(match.name);
                        if (match.phone) setBuyerPhone(match.phone);
                        if (match.city) setBuyerCity(match.city);
                        if (match.address) setBuyerAddress(match.address);
                      }
                    }}
                  >
                    <option value="">⚡ Select from {buyers.length} saved buyers...</option>
                    {buyers.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name} {b.company ? `(${b.company})` : ""} {b.city ? `• ${b.city}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <input
                type="text"
                className="input"
                placeholder="Type or select client name..."
                list="buyers-list"
                value={buyerName}
                onChange={(e) => {
                  setBuyerName(e.target.value);
                  const match = buyers.find((b) => b.name.toLowerCase() === e.target.value.toLowerCase());
                  if (match) {
                    if (match.phone) setBuyerPhone(match.phone);
                    if (match.city) setBuyerCity(match.city);
                    if (match.address) setBuyerAddress(match.address);
                  }
                }}
                required
              />
              <datalist id="buyers-list">
                {buyers.map((b) => (
                  <option key={b.id} value={b.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="label">Phone / WhatsApp:</label>
              <input
                type="text"
                className="input"
                placeholder="+91 98200 00000"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="label">City / Bourse Hub:</label>
              <input
                type="text"
                className="input"
                value={buyerCity}
                onChange={(e) => setBuyerCity(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Billing / Courier Delivery Address:</label>
            <input
              type="text"
              className="input"
              placeholder="Shop number, building, market, city, pincode..."
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
            />
          </div>
        </div>

        {/* Selected Packets / Stones Table */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span>💎</span> Allocated Gemstones & Jewellery Items ({items.length})
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setShowGstModal(true)}
                title="Configure standard GST rates & HSN codes"
              >
                ⚙️ Tax Settings
              </button>
              {items.length > 0 && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleApplyGstToAll(0.25)}
                    title="Set all stones to standard gemstone 0.25% GST"
                  >
                    All 0.25%
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleApplyGstToAll(3.0)}
                    title="Set all stones to standard jewellery 3% GST"
                  >
                    All 3%
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleApplyGstToAll(0)}
                    title="Set all items to 0% Tax Exempt / SEZ"
                  >
                    0% Exempt
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setOutsideModalOpen(true)}
              >
                + Add Outside Stock Item
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                background: "var(--surface)",
                borderRadius: 6,
                border: "1.5px dashed var(--border)",
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>💎</div>
              <div style={{ fontWeight: 700 }}>No Gemstone Packets Selected Yet</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                Select available packets from the vault pool below to allocate to this invoice.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Pkt #</th>
                    <th>Particulars</th>
                    <th>Shape</th>
                    <th style={{ textAlign: "right" }}>Pieces</th>
                    <th style={{ textAlign: "right" }}>Weight</th>
                    <th>HSN</th>
                    <th style={{ textAlign: "right" }}>Selling Rate</th>
                    <th style={{ textAlign: "right" }}>Taxable Total (₹)</th>
                    <th style={{ textAlign: "right" }}>GST Rate (%)</th>
                    <th style={{ textAlign: "right" }}>GST Amt (₹)</th>
                    <th style={{ width: 40, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 800, color: "var(--primary)" }}>{it.packet_number}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{it.particulars}</div>
                        {it.purchased_from && (
                          <div style={{ fontSize: 10, color: "#d97706", fontWeight: 700, marginTop: 2 }}>
                            📦 Purchased From: {it.purchased_from} {it.purchased_from_phone ? `(${it.purchased_from_phone})` : ""}
                            {it.purchased_from_notes ? ` • ${it.purchased_from_notes}` : ""}
                          </div>
                        )}
                        {isJewelleryCompany && (it.making_charges || it.diamond_weight || it.metal_weight) && (
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>
                            Making: ₹{it.making_charges || 0} • Dia: {it.diamond_weight || 0}ct • Metal: {it.metal_weight || 0}g
                          </div>
                        )}
                      </td>
                      <td>{it.shape}</td>
                      {/* Pieces */}
                      <td style={{ textAlign: "right" }}>
                        {(() => {
                          const targetPkt = !it.packet_id?.startsWith("outside-")
                            ? packets.find(
                                (p) =>
                                  (it.packet_id && p.id === it.packet_id) ||
                                  p.packet_number.toLowerCase() === it.packet_number.toLowerCase()
                              )
                            : null;
                          const otherAllocPcs = targetPkt
                            ? items
                                .filter(
                                  (o, i) =>
                                    i !== idx &&
                                    ((it.packet_id && o.packet_id === it.packet_id) ||
                                      (!o.packet_id?.startsWith("outside-") &&
                                        o.packet_number.toLowerCase() === it.packet_number.toLowerCase()))
                                )
                                .reduce((s, o) => s + (Number(o.pieces) || 1), 0)
                            : 0;
                          const rowMaxPcs = targetPkt
                            ? Math.max(1, (Number(targetPkt.pieces) || 1) - otherAllocPcs)
                            : 9999;
                          return (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                              <input
                                type="number"
                                min="1"
                                max={rowMaxPcs}
                                title={targetPkt ? `Max available in packet: ${rowMaxPcs} pcs` : undefined}
                                className="input"
                                style={{ width: 55, textAlign: "right", padding: "2px 4px", fontSize: 11 }}
                                value={it.pieces || 1}
                                onChange={(e) => handleUpdateItemPieces(idx, Number(e.target.value) || 1)}
                              />
                              <span style={{ fontSize: 10, color: "var(--muted)" }}>pcs</span>
                            </div>
                          );
                        })()}
                      </td>
                      {/* Weight */}
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {(() => {
                          const targetPkt = !it.packet_id?.startsWith("outside-")
                            ? packets.find(
                                (p) =>
                                  (it.packet_id && p.id === it.packet_id) ||
                                  p.packet_number.toLowerCase() === it.packet_number.toLowerCase()
                              )
                            : null;
                          const otherAllocWt = targetPkt
                            ? items
                                .filter(
                                  (o, i) =>
                                    i !== idx &&
                                    ((it.packet_id && o.packet_id === it.packet_id) ||
                                      (!o.packet_id?.startsWith("outside-") &&
                                        o.packet_number.toLowerCase() === it.packet_number.toLowerCase()))
                                )
                                .reduce((s, o) => s + (Number(o.weight) || 0), 0)
                            : 0;
                          const rowMaxWt = targetPkt
                            ? Math.max(0.01, Number(((Number(targetPkt.weight) || 0) - otherAllocWt).toFixed(2)))
                            : 99999;
                          return (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={rowMaxWt}
                                title={targetPkt ? `Max available in packet: ${rowMaxWt} ${it.unit || "cts"}` : undefined}
                                className="input"
                                style={{ width: 65, textAlign: "right", padding: "2px 4px", fontSize: 11 }}
                                value={it.weight}
                                onChange={(e) => handleUpdateItemWeight(idx, Number(e.target.value) || 0)}
                              />
                              <span style={{ fontSize: 10, color: "var(--muted)" }}>{it.unit || "cts"}</span>
                            </div>
                          );
                        })()}
                      </td>
                      {/* Statutory Predefined HSN */}
                      <td>
                        <input
                          type="text"
                          className="input"
                          style={{ width: 70, padding: "2px 6px", fontSize: 11 }}
                          value={it.hsn_code || "7103"}
                          onChange={(e) => handleUpdateItemGst(idx, it.gst_rate ?? 0.25, e.target.value)}
                        />
                      </td>
                      {/* Selling Rate per ct/g */}
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="number"
                          className="input"
                          style={{ width: 100, textAlign: "right", padding: "2px 6px" }}
                          value={it.rate_per_unit}
                          onChange={(e) => handleUpdateItemRate(idx, Number(e.target.value) || 0)}
                        />
                      </td>
                      {/* Total Taxable */}
                      <td style={{ textAlign: "right", fontWeight: 800 }}>
                        {formatINR(it.total_price)}
                      </td>
                      {/* GST Rate (Editable custom input with presets) */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            style={{ width: 58, textAlign: "right", padding: "2px 4px", fontSize: 11 }}
                            value={it.gst_rate ?? 0.25}
                            onChange={(e) => handleUpdateItemGst(idx, parseFloat(e.target.value) || 0, it.hsn_code || "7103")}
                          />
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>%</span>
                        </div>
                      </td>
                      {/* GST Amount (Direct editable override) */}
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="number"
                          className="input"
                          style={{ width: 85, textAlign: "right", padding: "2px 4px", fontSize: 11 }}
                          value={it.gst_amount ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setItems((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, gst_amount: val } : item))
                            );
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          style={{ color: "#ef4444" }}
                          onClick={() => handleRemoveItem(idx)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Hierarchical Search & Gemstone Vault Selection (Box -> Packet -> Stone/Whole Packet) */}
          <div
            style={{
              marginTop: 18,
              padding: 16,
              background: "var(--surface-sunken)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🔍</span> Search & Allocate Gemstone from Vault
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {filteredVaultPackets.length} in-stock packets available
              </span>
            </div>

            {/* Step 1 & 2: Box Filter, Search Term & Packet Dropdown */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 2fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                  1. Choose Box:
                </label>
                <select
                  className="select"
                  style={{ fontSize: 12, width: "100%" }}
                  value={selectedBoxFilter}
                  onChange={(e) => {
                    setSelectedBoxFilter(e.target.value);
                    setSelectedPacketId("");
                  }}
                >
                  <option value="all">📦 All Vault Boxes ({availablePackets.length} pkts available)</option>
                  {boxes.map((b) => {
                    const count = availablePackets.filter(
                      (p) => normalizeBoxName(p.box_name) === normalizeBoxName(b.name)
                    ).length;
                    return (
                      <option key={b.id} value={b.name}>
                        📦 {b.name} ({count} pkts)
                      </option>
                    );
                  })}
                  <option value="unassigned">
                    📦 General Vault / Unassigned ({availablePackets.filter((p) => !p.box_name || normalizeBoxName(p.box_name).includes("unassigned")).length} pkts)
                  </option>
                </select>
              </div>

              <div>
                <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                  Search Gemstone / Packet:
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ fontSize: 12, width: "100%" }}
                  placeholder="Filter by stone, pkt #, shape..."
                  value={searchStoneQuery}
                  onChange={(e) => setSearchStoneQuery(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                  2. Select Packet:*
                </label>
                <select
                  className="select"
                  style={{ fontSize: 12, width: "100%", fontWeight: selectedPacketId ? 700 : 400 }}
                  value={selectedPacketId}
                  onChange={(e) => setSelectedPacketId(e.target.value)}
                >
                  <option value="">
                    -- Choose Packet ({filteredVaultPackets.length} available{selectedBoxFilter !== "all" ? ` in ${selectedBoxFilter}` : ""}) --
                  </option>
                  {filteredVaultPackets.map((p) => {
                    const stock = getPacketRemainingStock(p);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.packet_number} • {p.particulars} [{p.box_name || "Vault"}] — {stock.remainingPcs} pcs | {stock.remainingWt} {p.unit || "cts"} available (₹{p.sale_rate_per_unit || Math.round(p.sale_price / (p.weight || 1))}/ct)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Live Stone Breakdown by Stone Type in Chosen Box */}
            {selectedBoxFilter !== "all" && selectedBoxStoneBreakdown.length > 0 && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "8px 12px",
                  background: "var(--surface)",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>
                  💎 Available Stock by Stone Type in {selectedBoxFilter}:
                </span>
                {selectedBoxStoneBreakdown.map((st) => (
                  <span
                    key={st.type}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "rgba(16, 185, 129, 0.1)",
                      color: "#059669",
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                    }}
                  >
                    {st.type}: <strong>{st.pcs} pcs</strong> ({st.weight.toFixed(2)} cts) • {st.count} {st.count === 1 ? "pkt" : "pkts"}
                  </span>
                ))}
              </div>
            )}

            {/* Step 3: Stone Allocation & Quantity Sub-panel */}
            {selectedPacket && (
              <div
                style={{
                  padding: 14,
                  background: "var(--surface)",
                  borderRadius: 6,
                  border: "1.5px solid var(--primary)",
                  marginTop: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 900, color: "var(--primary)", fontSize: 14 }}>
                      {selectedPacket.packet_number}
                    </span>
                    <span style={{ marginLeft: 8, fontWeight: 700 }}>{getPacketVarietyDisplay(selectedPacket)}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>
                      ({selectedPacket.shape} • {selectedPacket.unit || "cts"})
                    </span>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      Box: <strong style={{ color: "var(--foreground)" }}>{selectedPacket.box_name || "Unassigned"}</strong> •
                      Available: <strong style={{ color: "var(--primary)" }}>{selectedPacketStock.remainingPcs} pcs</strong> & <strong style={{ color: "var(--primary)" }}>{selectedPacketStock.remainingWt} {selectedPacket.unit || "cts"}</strong>
                      {selectedPacketStock.allocatedPcs > 0 && (
                        <span style={{ color: "#d97706", marginLeft: 8, fontWeight: 700 }}>
                          ({selectedPacketStock.allocatedPcs} pcs already in this invoice)
                        </span>
                      )}
                    </div>
                    {unallocatedStoneDetails.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>
                          💎 In-Stock Stones ({unallocatedStoneDetails.length}):
                        </span>
                        {unallocatedStoneDetails.map((st) => {
                          const isSelected = allocStoneChoice === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              className={`btn btn-xs ${isSelected ? "btn-primary" : "btn-outline"}`}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 4,
                              }}
                              onClick={() => {
                                setAllocStoneChoice(st.id);
                                setAllocPieces(1);
                                setAllocWeight(st.weight || selectedPacketStock.singleStoneWeight);
                              }}
                            >
                              #{st.stoneNumber} {st.variety} ({st.weight} ct)
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Original Cost: ₹{selectedPacket.purchase_rate_per_unit || Math.round(selectedPacket.purchase_price / (selectedPacket.weight || 1))}/ct</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)" }}>
                      Suggested Rate: ₹{selectedPacket.sale_rate_per_unit || Math.round(selectedPacket.sale_price / (selectedPacket.weight || 1))}/ct
                    </div>
                  </div>
                </div>

                {selectedPacketStock.remainingPcs <= 0 ? (
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: 6,
                      color: "#b45309",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>⚠️</span> All {selectedPacket.pieces || 1} stones ({selectedPacket.weight} {selectedPacket.unit || "cts"}) from packet {selectedPacket.packet_number} have already been allocated to this invoice table above.
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1.2fr auto", gap: 10, alignItems: "flex-end" }}>
                      {/* Allocation Mode / Stone Choice */}
                      <div>
                        <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                          Stone Selection:
                        </label>
                        <select
                          className="select"
                          style={{ fontSize: 12 }}
                          value={allocStoneChoice}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAllocStoneChoice(val);
                            if (val === "whole") {
                              setAllocPieces(selectedPacketStock.remainingPcs);
                              setAllocWeight(selectedPacketStock.remainingWt);
                            } else if (val === "single") {
                              setAllocPieces(1);
                              const firstRemaining = unallocatedStoneDetails[0] || unallocatedSubGems[0];
                              setAllocWeight(firstRemaining?.weight || selectedPacketStock.singleStoneWeight);
                            } else if (selectedPacket.stone_details || selectedPacket.stone_weights) {
                              const st = unallocatedStoneDetails.find((s) => s.id === val) || selectedPacket.stone_details?.find((s) => s.id === val);
                              if (st) {
                                setAllocPieces(1);
                                setAllocWeight(st.weight || selectedPacketStock.singleStoneWeight);
                              }
                            } else if (selectedPacket.sub_gems) {
                              const sub = unallocatedSubGems.find((s) => s.id === val) || selectedPacket.sub_gems?.find((s) => s.id === val);
                              if (sub) {
                                setAllocPieces(1);
                                setAllocWeight(sub.weight || selectedPacketStock.singleStoneWeight);
                              }
                            } else if (val === "custom_partial") {
                              setAllocPieces(1);
                              setAllocWeight(selectedPacketStock.singleStoneWeight);
                            }
                          }}
                        >
                          <option value="single">
                            {unallocatedStoneDetails.length > 0
                              ? `Single Stone: #${unallocatedStoneDetails[0].stoneNumber} ${unallocatedStoneDetails[0].variety} (${unallocatedStoneDetails[0].shape}) - ${unallocatedStoneDetails[0].weight} cts`
                              : `Single Stone (1 pc • ${selectedPacketStock.singleStoneWeight} ${selectedPacket.unit || "cts"})`}
                          </option>
                          {selectedPacketStock.remainingPcs > 1 && (
                            <option value="whole">Whole Remaining Packet ({selectedPacketStock.remainingPcs} pcs • {selectedPacketStock.remainingWt} {selectedPacket.unit || "cts"})</option>
                          )}
                          {unallocatedStoneDetails.length > 0 ? (
                            <optgroup label={`Individual Stones (${unallocatedStoneDetails.length} available in stock)`}>
                              {unallocatedStoneDetails.map((s, sIdx) => {
                                const stoneNum = s.stoneNumber || sIdx + 1;
                                return (
                                  <option key={s.id || sIdx} value={s.id}>
                                    Stone #{stoneNum}: {s.variety || selectedPacket.particulars} ({s.shape || selectedPacket.shape}) - {s.weight} cts
                                  </option>
                                );
                              })}
                            </optgroup>
                          ) : unallocatedSubGems.length > 0 ? (
                            <optgroup label={`Individual Sub-Gems (${unallocatedSubGems.length} available in stock)`}>
                              {unallocatedSubGems.map((s, sIdx) => {
                                const stoneNum = s.stoneNumber || sIdx + 1;
                                return (
                                  <option key={s.id || sIdx} value={s.id}>
                                    Stone #{stoneNum}: {s.variety} ({s.shape}) - {s.weight} cts
                                  </option>
                                );
                              })}
                            </optgroup>
                          ) : null}
                          <option value="custom_partial">Custom Quantity / Pieces</option>
                        </select>
                      </div>

                      {/* Pieces to allocate */}
                      <div>
                        <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                          Pieces (max {selectedPacketStock.remainingPcs}):*
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={selectedPacketStock.remainingPcs}
                          className="input"
                          style={{ fontSize: 12 }}
                          value={allocPieces}
                          onChange={(e) => {
                            const raw = Number(e.target.value) || 1;
                            const newPcs = Math.min(selectedPacketStock.remainingPcs, Math.max(1, raw));
                            setAllocPieces(newPcs);
                            let newWeight = 0;
                            if (newPcs === selectedPacketStock.remainingPcs) {
                              newWeight = selectedPacketStock.remainingWt;
                            } else if (Array.isArray(selectedPacket.stone_weights) && selectedPacket.stone_weights.length > 0) {
                              const startIdx = selectedPacketStock.allocatedPcs;
                              const slice = selectedPacket.stone_weights.slice(startIdx, startIdx + newPcs);
                              newWeight = slice.reduce((sum, w) => sum + w, 0);
                              if (newWeight <= 0) {
                                newWeight = Number((selectedPacketStock.singleStoneWeight * newPcs).toFixed(2));
                              }
                            } else {
                              newWeight = Number((selectedPacketStock.singleStoneWeight * newPcs).toFixed(2));
                            }
                            setAllocWeight(Math.min(selectedPacketStock.remainingWt, Math.max(0.01, Number(newWeight.toFixed(2)))));
                          }}
                          required
                        />
                      </div>

                      {/* Weight to allocate */}
                      <div>
                        <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                          Weight ({selectedPacket.unit || "cts"} - max {selectedPacketStock.remainingWt}):*
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={selectedPacketStock.remainingWt}
                          className="input"
                          style={{ fontSize: 12 }}
                          value={allocWeight}
                          onChange={(e) => setAllocWeight(Math.min(selectedPacketStock.remainingWt, Math.max(0.01, Number(e.target.value) || 0.01)))}
                          required
                        />
                      </div>

                      {/* Selling Rate per unit */}
                      <div>
                        <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                          Rate (₹/{selectedPacket.unit || "ct"}):*
                        </label>
                        <input
                          type="number"
                          className="input"
                          style={{ fontSize: 12 }}
                          value={allocRate}
                          onChange={(e) => setAllocRate(Number(e.target.value) || 0)}
                          required
                        />
                      </div>

                      {/* Add Button */}
                      <div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ height: 38, padding: "0 16px", fontWeight: 700 }}
                          onClick={handleAddSelectedStone}
                        >
                          ➕ Add Stone
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
                      <span>
                        Subtotal for item: <strong style={{ color: "var(--foreground)" }}>{formatINR(Math.round(allocRate * allocWeight))}</strong>
                      </span>
                      {allocPieces < selectedPacketStock.remainingPcs && (
                        <span style={{ color: "var(--primary)" }}>
                          ℹ️ Packet will retain { selectedPacketStock.remainingPcs - allocPieces } pcs ({(selectedPacketStock.remainingWt - allocWeight).toFixed(2)} {selectedPacket.unit || "cts"}) in stock after sale.
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Statutory Indian GST & Tax Calculation Section */}
        <div className="card" style={{ padding: 18, background: "rgba(16, 185, 129, 0.02)" }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚖️</span> Statutory Indian GST & HSN Breakdown
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Tax Destination:</label>
              <select
                className="select"
                style={{ fontSize: 12, padding: "2px 8px" }}
                value={taxMode}
                onChange={(e) => setTaxMode(e.target.value as any)}
              >
                <option value="intra_state">Intra-State (CGST + SGST)</option>
                <option value="inter_state">Inter-State (IGST)</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 14,
              padding: "12px",
              background: "var(--surface)",
              borderRadius: 6,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Taxable Subtotal</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{formatINR(subtotal)}</div>
            </div>

            {taxMode === "intra_state" ? (
              <>
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>CGST (Center)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0284c7" }}>{formatINR(cgstAmount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>SGST (State)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0284c7" }}>{formatINR(sgstAmount)}</div>
                </div>
              </>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>IGST (Integrated)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0284c7" }}>{formatINR(igstAmount)}</div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Total Statutory GST</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#047857" }}>{formatINR(totalGst)}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Invoice Grand Total</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--primary)" }}>{formatINR(grandTotal)}</div>
            </div>
          </div>
        </div>

        {/* Payments, Credit Days & Notes */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>
            💳 Settlements, Credit Term & Notes
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 12 }}>
            <div>
              <label className="label">Initial Token / Advance Received (₹):</label>
              <input
                type="number"
                className="input"
                value={initialPayment}
                onChange={(e) => setInitialPayment(Number(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="label">Payment Mode:</label>
              <select
                className="select"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="Bank Wire / NEFT">Bank Wire / NEFT / RTGS</option>
                <option value="Cash">Vault Liquid Cash</option>
                <option value="Cheque">Post-Dated Cheque</option>
                <option value="Angadia">Angadia Courier</option>
                <option value="UPI">UPI</option>
              </select>
            </div>

            <div>
              <label className="label">Credit Term (Long Credit / Udhaari):</label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                {[
                  { label: "0d (Cash)", days: 0 },
                  { label: "30d (1 mo)", days: 30 },
                  { label: "60d (2 mo)", days: 60 },
                  { label: "90d (3 mo)", days: 90 },
                  { label: "120d (4 mo)", days: 120 },
                  { label: "180d (6 mo)", days: 180 },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    className={`btn btn-xs ${creditDays === preset.days ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setCreditDays(preset.days)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  className="input"
                  style={{ width: 90 }}
                  value={creditDays}
                  onChange={(e) => setCreditDays(Number(e.target.value) || 0)}
                  placeholder="Days"
                />
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {creditDays > 0 ? (
                    <>Due Date: <strong style={{ color: "var(--primary)" }}>{new Date(Date.now() + creditDays * 86400000).toISOString().slice(0, 10)}</strong> ({Math.round(creditDays / 30)} mo)</>
                  ) : (
                    "Immediate / Cash"
                  )}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Special Commercial Terms / Approval Notes:</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Post-dated cheque references, inspection dates, return terms..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/sales")}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ minWidth: 200 }}>
            {isApproval ? "📋 Issue Approval Voucher" : "✓ Finalize Sales Invoice"}
          </button>
        </div>
      </form>

      {/* Modal: Add Outside Stock Item */}
      {outsideModalOpen && (
        <div className="modal-backdrop" onClick={() => setOutsideModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Add Outside Stock Item</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setOutsideModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAddOutsideItem} style={{ padding: 20 }}>
              {/* Sourcing Details */}
              <div
                style={{
                  background: "var(--surface-sunken)",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  marginBottom: 14,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", marginBottom: 8, textTransform: "uppercase" }}>
                  📦 Whom Was This Stock Purchased From?
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                    Purchased From (Party / Vendor / Broker Name):*
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={outsideItem.purchased_from}
                    onChange={(e) => setOutsideItem({ ...outsideItem, purchased_from: e.target.value })}
                    placeholder="e.g. Gemstones International / Ramesh Dalal"
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                      Vendor / Broker Contact / Phone:
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={outsideItem.purchased_from_phone}
                      onChange={(e) => setOutsideItem({ ...outsideItem, purchased_from_phone: e.target.value })}
                      placeholder="+91 98200 00000"
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                      Purchase Memo Ref / Bill Notes:
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={outsideItem.purchased_from_notes}
                      onChange={(e) => setOutsideItem({ ...outsideItem, purchased_from_notes: e.target.value })}
                      placeholder="Lot # / memo note"
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="label">Particulars (Stone / Jewellery):*</label>
                <input
                  type="text"
                  className="input"
                  value={outsideItem.particulars}
                  onChange={(e) => setOutsideItem({ ...outsideItem, particulars: e.target.value })}
                  placeholder="e.g. Colombian Emerald, Star Ruby..."
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label className="label">Shape:</label>
                  <input
                    type="text"
                    className="input"
                    value={outsideItem.shape}
                    onChange={(e) => setOutsideItem({ ...outsideItem, shape: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Pieces (pcs):*</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={outsideItem.pieces}
                    onChange={(e) => setOutsideItem({ ...outsideItem, pieces: Number(e.target.value) || 1 })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Weight:*</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input"
                    value={outsideItem.weight}
                    onChange={(e) => setOutsideItem({ ...outsideItem, weight: Number(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Unit:</label>
                  <select
                    className="select"
                    value={outsideItem.unit}
                    onChange={(e) => setOutsideItem({ ...outsideItem, unit: e.target.value as WeightUnit })}
                  >
                    <option value="cts">Carats (cts)</option>
                    <option value="g">Grams (g)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label className="label">Cost / Buy Price (₹):</label>
                  <input
                    type="number"
                    className="input"
                    value={outsideItem.cost_price}
                    onChange={(e) => setOutsideItem({ ...outsideItem, cost_price: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Selling Rate (₹/unit):</label>
                  <input
                    type="number"
                    className="input"
                    value={outsideItem.rate_per_unit}
                    onChange={(e) => setOutsideItem({ ...outsideItem, rate_per_unit: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setOutsideModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add to Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customizable GST & HSN Configuration Modal */}
      <GstSettingsModal
        open={showGstModal}
        onClose={() => setShowGstModal(false)}
      />
    </div>
  );
}
