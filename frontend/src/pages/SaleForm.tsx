import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import { Spinner } from "../ui";
import { formatINR } from "../format";
import type { GemPacket, GemBuyer, GemSale, GemSaleItem, WeightUnit, GstSettings, GemBox } from "../types/gemstone";
import { DEFAULT_COMPANIES } from "../types/gemstone";
import { GstSettingsModal } from "../GstSettingsModal";
import { normalizeBoxName } from "../gemstoneStorage";
import { useToast } from "../toast";
import { resolvePacketStoneStatuses, resolvePacketSubGemStatuses, isGenericVariety, hasGenuineIndividualWeights } from "../packetStones";

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

  const isMemoParam = searchParams.get("memo") === "true" || searchParams.get("is_memo") === "true";
  const preselectedPktNum = searchParams.get("packet");

  // Load existing sale if in edit mode
  const { data: existingSale, isLoading: saleLoading } = useQuery<GemSale>({
    queryKey: ["sale", id],
    queryFn: () => apiGet(`/sales/${id}`),
    enabled: isEdit,
  });

  // Load in-stock packets and buyers (targeted on-demand fetch to eliminate 70MB transfer & UI freeze)
  const [selectedBoxFilter, setSelectedBoxFilter] = useState<string>("all");
  const [searchStoneQuery, setSearchStoneQuery] = useState<string>("");

  const { data: packets = [], isLoading: packetsLoading } = useQuery<GemPacket[]>({
    queryKey: ["sale_form_packets", selectedBoxFilter, searchStoneQuery, isEdit, id, preselectedPktNum],
    queryFn: async () => {
      let url = "/packets?status=in_stock";
      if (selectedBoxFilter !== "all") {
        url += `&box_name=${encodeURIComponent(selectedBoxFilter)}`;
      }
      if (searchStoneQuery.trim()) {
        url += `&search=${encodeURIComponent(searchStoneQuery.trim())}`;
      }
      url += "&limit=250";
      const fetched: GemPacket[] = await apiGet(url);

      if (preselectedPktNum && !fetched.some((p) => p.packet_number.toLowerCase() === preselectedPktNum.toLowerCase())) {
        const p = await apiGet<GemPacket>(`/packets/${encodeURIComponent(preselectedPktNum)}`).catch(() => null);
        if (p) fetched.unshift(p);
      }

      // If in edit mode, ensure packets from existing sale are also loaded even if marked sold
      if (isEdit && existingSale?.items && existingSale.items.length > 0) {
        const fetchedMap = new Map(fetched.map((p) => [p.packet_number.toLowerCase(), p]));
        const missingNums = existingSale.items
          .map((it) => it.packet_number)
          .filter((num) => num && !fetchedMap.has(num.toLowerCase()));
        
        if (missingNums.length > 0) {
          const editPkts = await Promise.all(
            missingNums.slice(0, 25).map((num) => apiGet<GemPacket>(`/packets/${encodeURIComponent(num)}`).catch(() => null))
          );
          editPkts.forEach((p) => {
            if (p && !fetchedMap.has(p.packet_number.toLowerCase())) {
              fetched.unshift(p);
            }
          });
        }
      }
      return fetched;
    },
  });

  const { data: buyers = [] } = useQuery<GemBuyer[]>({
    queryKey: ["buyers"],
    queryFn: () => apiGet("/buyers"),
  });

  const clearBuyersMutation = useMutation({
    mutationFn: () => apiDelete("/buyers"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      show("Client suggestions cleared!", "success");
    },
    onError: (err: any) => show("Error clearing clients: " + err.message, "error"),
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
    queryKey: ["sales", "form_context"],
    queryFn: () => apiGet("/sales?limit=50"),
  });

  // Vault Gemstone Picker State (Box -> Packet -> Stone/Whole Packet)
  const [selectedPacketId, setSelectedPacketId] = useState<string>("");
  const [allocPieces, setAllocPieces] = useState<number>(0);
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
    pieces: 0,
    rate_per_unit: 45000,
    cost_price: 35000,
    purchased_from: "",
    purchased_from_phone: "",
    purchased_from_notes: "",
    making_charges: 0,
    diamond_weight: 0,
    metal_weight: 0,
  });

  // Helper to compute quantities already in this sale when editing an existing sale/approval
  const existingSaleAllocations = useMemo(() => {
    if (!isEdit || !existingSale?.items) {
      return new Map<string, { pcs: number; wt: number; stoneIds: Set<string>; subGemIds: Set<string> }>();
    }
    const map = new Map<string, { pcs: number; wt: number; stoneIds: Set<string>; subGemIds: Set<string> }>();
    for (const it of existingSale.items) {
      if (it.is_returned || (Number(it.pieces) === 0 && Number(it.weight) === 0)) continue;
      const keyId = (it.packet_id || "").toLowerCase();
      const keyNum = (it.packet_number || "").toLowerCase();
      for (const k of [keyId, keyNum]) {
        if (!k) continue;
        const entry = map.get(k) || { pcs: 0, wt: 0, stoneIds: new Set<string>(), subGemIds: new Set<string>() };
        entry.pcs += Number(it.pieces) || 0;
        entry.wt = Number((entry.wt + (Number(it.weight) || 0)).toFixed(2));
        if (it.stone_id) entry.stoneIds.add(it.stone_id);
        if (it.sub_gem_id) entry.subGemIds.add(it.sub_gem_id);
        map.set(k, entry);
      }
    }
    return map;
  }, [isEdit, existingSale]);

  const getPacketExistingSaleAllocation = (pkt: GemPacket) => {
    if (!isEdit || !existingSaleAllocations.size) {
      return { pcs: 0, wt: 0, stoneIds: new Set<string>(), subGemIds: new Set<string>() };
    }
    const byId = pkt.id ? existingSaleAllocations.get(pkt.id.toLowerCase()) : undefined;
    const byNum = pkt.packet_number ? existingSaleAllocations.get(pkt.packet_number.toLowerCase()) : undefined;
    return byId || byNum || { pcs: 0, wt: 0, stoneIds: new Set<string>(), subGemIds: new Set<string>() };
  };

  // Helper to compute remaining available stock for a packet after subtracting items already added to the current sale
  const getPacketRemainingStock = (pkt: GemPacket) => {
    const isUncountable = Boolean(pkt.is_uncountable);
    const existingAlloc = getPacketExistingSaleAllocation(pkt);
    let basePcs = Number(pkt.pieces) || 0;
    let baseWt = Number(pkt.weight) || 0;

    let physicalPcs = basePcs + existingAlloc.pcs;
    let physicalWt = Number((baseWt + existingAlloc.wt).toFixed(2));

    // If packet has genuine individual stone weights, derive base stock from stone details.
    // Note: resolvePacketStoneStatuses already excludes this edit sale, so inStock already includes restored stones.
    // Therefore, we do NOT double-add existingAlloc to physical stock.
    if (!isUncountable && hasGenuineIndividualWeights(pkt) && Array.isArray(pkt.stone_details) && pkt.stone_details.length > 0) {
      const stoneStatuses = resolvePacketStoneStatuses(pkt, allSales, [], isEdit ? (id || existingSale?.id || existingSale?.invoice_no) : undefined);
      const inStock = stoneStatuses.filter((s) => s.status === "in_stock");
      if (inStock.length > 0) {
        physicalWt = Number(inStock.reduce((sum, s) => sum + (Number(s.weight) || 0), 0).toFixed(2));
        physicalPcs = inStock.length;
      }
    } else if (!isUncountable && hasGenuineIndividualWeights(pkt) && Array.isArray(pkt.sub_gems) && pkt.sub_gems.length > 0) {
      const subStatuses = resolvePacketSubGemStatuses(pkt, allSales, [], isEdit ? (id || existingSale?.id || existingSale?.invoice_no) : undefined);
      const inStock = subStatuses.filter((s) => s.status === "in_stock");
      if (inStock.length > 0) {
        physicalWt = Number(inStock.reduce((sum, s) => sum + (Number(s.weight) || 0), 0).toFixed(2));
        physicalPcs = inStock.length;
      }
    }

    const allocatedInSale = items.filter(
      (it) =>
        (it.packet_id && it.packet_id === pkt.id) ||
        (!it.packet_id?.startsWith("outside-") &&
          it.packet_number &&
          it.packet_number.toLowerCase() === pkt.packet_number.toLowerCase())
    );
    const allocatedPcs = allocatedInSale.reduce((sum, it) => sum + (Number(it.pieces) || 0), 0);
    const allocatedWt = Number(allocatedInSale.reduce((sum, it) => sum + (Number(it.weight) || 0), 0).toFixed(2));
    const remainingPcs = isUncountable ? 0 : Math.max(0, physicalPcs - allocatedPcs);
    const remainingWt = Math.max(0, Number((physicalWt - allocatedWt).toFixed(2)));
    return {
      physicalPcs,
      physicalWt,
      allocatedPcs,
      allocatedWt,
      remainingPcs,
      remainingWt,
      isFullyAllocated: isUncountable ? remainingWt <= 0 : (remainingPcs <= 0 || remainingWt <= 0),
    };
  };

  const availablePackets = useMemo(() => {
    return packets.filter((p) => {
      const existingAlloc = getPacketExistingSaleAllocation(p);
      const isPartOfThisInvoice = isEdit && (existingAlloc.pcs > 0 || existingAlloc.wt > 0);
      const inStock = p.status === "in_stock" || !p.status || isPartOfThisInvoice;
      if (!inStock) return false;
      const { isFullyAllocated } = getPacketRemainingStock(p);
      return !isFullyAllocated || isPartOfThisInvoice;
    });
  }, [packets, items, isEdit, existingSaleAllocations]);

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
    if (!hasGenuineIndividualWeights(selectedPacket)) return [];
    const statuses = resolvePacketStoneStatuses(
      selectedPacket,
      allSales,
      items,
      isEdit ? (id || existingSale?.id || existingSale?.invoice_no) : undefined
    );
    return statuses.filter((s) => s.status === "in_stock");
  }, [selectedPacket, allSales, items, isEdit, id, existingSale]);

  // List of sub_gems that are in-stock and have NOT been allocated in past sales or in current invoice items
  const unallocatedSubGems = useMemo(() => {
    if (!selectedPacket) return [];
    if (!hasGenuineIndividualWeights(selectedPacket)) return [];
    const statuses = resolvePacketSubGemStatuses(
      selectedPacket,
      allSales,
      items,
      isEdit ? (id || existingSale?.id || existingSale?.invoice_no) : undefined
    );
    return statuses.filter((s) => s.status === "in_stock");
  }, [selectedPacket, allSales, items, isEdit, id, existingSale]);

  const selectedPacketStock = useMemo(() => {
    if (!selectedPacket) return { remainingPcs: 0, remainingWt: 0, allocatedPcs: 0, allocatedWt: 0, singleStoneWeight: 0 };
    const stock = getPacketRemainingStock(selectedPacket);
    let singleStoneWeight = 0;
    if (selectedPacket.is_uncountable) {
      singleStoneWeight = stock.remainingWt;
    } else if (selectedPacket.stone_details && selectedPacket.stone_details.length > 0) {
      if (unallocatedStoneDetails.length > 0) {
        singleStoneWeight = unallocatedStoneDetails[0].weight || stock.remainingWt;
      } else {
        singleStoneWeight = stock.remainingWt;
      }
    } else if (selectedPacket.sub_gems && selectedPacket.sub_gems.length > 0) {
      if (unallocatedSubGems.length > 0) {
        singleStoneWeight = unallocatedSubGems[0].weight || stock.remainingWt;
      } else {
        singleStoneWeight = stock.remainingWt;
      }
    } else if (Array.isArray(selectedPacket.stone_weights) && selectedPacket.stone_weights.length > 0) {
      const unallocatedIdx = Math.min(stock.allocatedPcs, selectedPacket.stone_weights.length - 1);
      singleStoneWeight = selectedPacket.stone_weights[unallocatedIdx] || stock.remainingWt;
    } else {
      // For generic packets where individual stone weights are NOT specified:
      // Do not compute an average or assume that for each stone. Let it be free up to remainingWt.
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
      const isUncountable = Boolean(selectedPacket.is_uncountable);
      if ((isUncountable || remainingPcs > 0) && remainingWt > 0) {
        setAllocPieces(isUncountable ? 0 : 1);
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
          const isBulk = isUncountable || (!unallocatedStoneDetails.length && !unallocatedSubGems.length && remainingPcs > 1);
          const targetAllocChoice = isBulk ? "custom_partial" : "whole"; // allocStoneChoice = isBulk ? "custom_partial" : "whole"
          setAllocStoneChoice(targetAllocChoice);
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
          setAllocPieces(1);
        }
      } else if (unallocatedSubGems.length > 0) {
        const stillValid = unallocatedSubGems.some((s) => s.id === allocStoneChoice);
        if (!stillValid && allocStoneChoice !== "whole" && allocStoneChoice !== "custom_partial") {
          const nextSub = unallocatedSubGems[0];
          setAllocStoneChoice(nextSub.id || "single");
          setAllocWeight(nextSub.weight || selectedPacketStock.singleStoneWeight);
          setAllocPieces(1);
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
              stone_id: it.stone_id,
              sub_gem_id: it.sub_gem_id,
              stone_weights: it.stone_weights,
              is_uncountable: Boolean(it.is_uncountable),
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
    const isUncountable = Boolean(pkt.is_uncountable);
    const stock = getPacketRemainingStock(pkt);
    if ((!isUncountable && stock.remainingPcs <= 0) || stock.remainingWt <= 0) {
      show(`All stock from packet ${pkt.packet_number} is already allocated in this transaction`, "warning");
      return;
    }

    const rate = pkt.sale_rate_per_unit || (pkt.weight ? Math.round(pkt.sale_price / pkt.weight) : 0);
    const tot = Math.round(rate * stock.remainingWt);
    const hsnInfo = getDefaultHsnAndGst(pkt.particulars);
    const hsn = pkt.hsn_code || hsnInfo.hsn;
    const gstRate = pkt.gst_rate ?? hsnInfo.gst;
    const gstAmt = Math.round(tot * (gstRate / 100) * 100) / 100;

    const singleStoneId = (!isUncountable && stock.remainingPcs === 1 && Array.isArray(pkt.stone_details))
      ? pkt.stone_details.find((st) => st.status === "in_stock")?.id
      : undefined;

    const newItem: GemSaleItem = {
      packet_id: pkt.id,
      packet_number: pkt.packet_number,
      particulars: pkt.particulars,
      shape: pkt.shape,
      weight: stock.remainingWt,
      unit: pkt.unit || "cts",
      pieces: isUncountable ? 0 : stock.remainingPcs,
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
      stone_id: singleStoneId,
      is_uncountable: isUncountable,
    };
    setItems((prev) => [...prev, newItem]);
    show(
      isUncountable
        ? `Allocated ${stock.remainingWt} ${pkt.unit || "cts"} (Bulk parcel) from packet ${pkt.packet_number}`
        : `Allocated ${stock.remainingPcs} pcs (${stock.remainingWt} ${pkt.unit || "cts"}) from packet ${pkt.packet_number}`,
      "success"
    );
  };

  const handleAddSelectedStone = () => {
    if (!selectedPacket) return;
    const isUncountable = Boolean(selectedPacket.is_uncountable);
    const maxPcs = selectedPacketStock.remainingPcs;
    const maxWt = selectedPacketStock.remainingWt;
    if ((!isUncountable && maxPcs <= 0) || maxWt <= 0) {
      show("All stock from this packet is already allocated in this transaction", "warning");
      return;
    }

    let chosenStoneId: string | undefined = undefined;
    let chosenSubGemId: string | undefined = undefined;
    let partDesc = selectedPacket.particulars;
    let stoneWeight = 0;

    const hasIndividualStones = unallocatedStoneDetails.length > 0 || unallocatedSubGems.length > 0;

    if (!isUncountable) {
      if (unallocatedStoneDetails.length > 0) {
        if (allocStoneChoice === "whole") {
          stoneWeight = selectedPacketStock.remainingWt;
        } else if (allocStoneChoice && allocStoneChoice !== "custom_partial" && allocStoneChoice !== "single") {
          let st = unallocatedStoneDetails.find((s) => s.id === allocStoneChoice) || selectedPacket.stone_details?.find((s) => s.id === allocStoneChoice);
          if (st) {
            const isAlreadyAllocated = !unallocatedStoneDetails.some((u) => u.id === st!.id);
            if (isAlreadyAllocated) {
              show(`Stone ${st.variety || "stone"} is not available in stock or has already been added to this sale!`, "warning");
              return;
            }
            partDesc = `${st.variety || selectedPacket.particulars} (${st.shape || selectedPacket.shape})`;
            chosenStoneId = st.id;
            // Predefined individual stone weight is strictly locked to inventory value
            stoneWeight = Number(st.weight) || 0;
          }
        } else if (allocStoneChoice === "single") {
          const firstSt = unallocatedStoneDetails[0];
          if (firstSt) {
            chosenStoneId = firstSt.id;
            partDesc = `${firstSt.variety || selectedPacket.particulars} (${firstSt.shape || selectedPacket.shape})`;
            stoneWeight = Number(firstSt.weight) || 0;
          }
        } else {
          // "custom_partial"
          if (allocPieces === 1 && unallocatedStoneDetails.length > 0) {
            const matchingSt = unallocatedStoneDetails.find(
              (s) => Math.abs((s.weight || 0) - allocWeight) <= 0.005
            ) || unallocatedStoneDetails[0];
            if (matchingSt) {
              chosenStoneId = matchingSt.id;
              partDesc = `${matchingSt.variety || selectedPacket.particulars} (${matchingSt.shape || selectedPacket.shape})`;
              stoneWeight = Number(matchingSt.weight) > 0 ? Number(matchingSt.weight) : (allocWeight > 0 ? allocWeight : selectedPacketStock.remainingWt);
            }
          } else {
            stoneWeight = allocWeight > 0 ? allocWeight : selectedPacketStock.remainingWt;
          }
        }
      } else if (unallocatedSubGems.length > 0) {
        if (allocStoneChoice === "whole") {
          stoneWeight = selectedPacketStock.remainingWt;
        } else if (allocStoneChoice && allocStoneChoice !== "custom_partial" && allocStoneChoice !== "single") {
          let sub = unallocatedSubGems.find((s) => s.id === allocStoneChoice) || selectedPacket.sub_gems?.find((s) => s.id === allocStoneChoice);
          if (sub) {
            const isAlreadyAllocated = !unallocatedSubGems.some((u) => u.id === sub!.id);
            if (isAlreadyAllocated) {
              show(`Stone ${sub.variety} is not available in stock or has already been added to this sale!`, "warning");
              return;
            }
            partDesc = `${selectedPacket.particulars} (${sub.variety} - ${sub.shape})`;
            chosenSubGemId = sub.id;
            chosenStoneId = sub.id;
            // Predefined individual sub-gem weight is strictly locked to inventory value
            stoneWeight = Number(sub.weight) || 0;
          }
        } else if (allocStoneChoice === "single") {
          const firstSub = unallocatedSubGems[0];
          if (firstSub) {
            chosenSubGemId = firstSub.id;
            chosenStoneId = firstSub.id;
            partDesc = `${selectedPacket.particulars} (${firstSub.variety} - ${firstSub.shape})`;
            stoneWeight = Number(firstSub.weight) || 0;
          }
        } else {
          if (allocPieces === 1 && unallocatedSubGems.length > 0) {
            const matchingSub = unallocatedSubGems.find(
              (s) => Math.abs((s.weight || 0) - allocWeight) <= 0.005
            ) || unallocatedSubGems[0];
            if (matchingSub) {
              chosenSubGemId = matchingSub.id;
              chosenStoneId = matchingSub.id;
              partDesc = `${selectedPacket.particulars} (${matchingSub.variety} - ${matchingSub.shape})`;
              stoneWeight = Number(matchingSub.weight) || 0;
            }
          } else {
            stoneWeight = allocWeight > 0 ? allocWeight : selectedPacketStock.remainingWt;
          }
        }
      } else if (Array.isArray(selectedPacket.stone_weights) && selectedPacket.stone_weights.length > 0) {
        if (allocPieces === 1) {
          const unallocIdx = Math.min(selectedPacketStock.allocatedPcs, selectedPacket.stone_weights.length - 1);
          stoneWeight = selectedPacket.stone_weights[unallocIdx] || selectedPacketStock.singleStoneWeight;
        } else if (allocPieces === selectedPacketStock.remainingPcs) {
          stoneWeight = selectedPacketStock.remainingWt;
        } else {
          stoneWeight = allocWeight > 0 ? allocWeight : selectedPacketStock.remainingWt;
        }
      } else if (selectedPacket.pieces === 1 && selectedPacket.weight > 0) {
        stoneWeight = selectedPacket.weight;
      } else {
        stoneWeight = allocWeight > 0 ? allocWeight : selectedPacketStock.remainingWt;
      }
    } else {
      stoneWeight = allocWeight > 0 ? allocWeight : selectedPacketStock.remainingWt;
    }

    const hasSpecificStones = Boolean(
      (unallocatedStoneDetails.length > 0) ||
      (unallocatedSubGems.length > 0) ||
      (hasGenuineIndividualWeights(selectedPacket) && selectedPacket.stone_details && selectedPacket.stone_details.length > 0) ||
      (selectedPacket.pieces === 1 && !isUncountable && hasGenuineIndividualWeights(selectedPacket))
    );

    const isExplicitSingle = Boolean(
      chosenStoneId ||
      chosenSubGemId ||
      (allocStoneChoice === "single" && hasSpecificStones) ||
      (selectedPacket.pieces === 1 && !isUncountable && hasGenuineIndividualWeights(selectedPacket))
    );

    const piecesToAdd = isUncountable
      ? 0
      : (isExplicitSingle
          ? 1
          : (allocStoneChoice === "whole"
              ? maxPcs
              : Math.max(1, Math.min(allocPieces || 1, maxPcs || 1))));

    const weightToAdd = isUncountable
      ? Math.max(0.001, Math.min(allocWeight || maxWt, maxWt))
      : (isExplicitSingle
          ? (stoneWeight > 0 ? stoneWeight : Math.max(0.001, Math.min(allocWeight || maxWt, maxWt)))
          : (allocStoneChoice === "whole" ? maxWt : Math.max(0.001, Math.min(stoneWeight || allocWeight || maxWt, maxWt))));

    const rate = allocRate > 0
      ? allocRate
      : (selectedPacket.sale_rate_per_unit || (selectedPacket.weight ? Math.round(selectedPacket.sale_price / selectedPacket.weight) : 0));
    const tot = Math.round(rate * weightToAdd);
    const hsnInfo = getDefaultHsnAndGst(selectedPacket.particulars);
    const hsn = selectedPacket.hsn_code || hsnInfo.hsn;
    const gstRate = selectedPacket.gst_rate ?? hsnInfo.gst;
    const gstAmt = Math.round(tot * (gstRate / 100) * 100) / 100;

    let finalStoneId = chosenStoneId;
    if (!finalStoneId && !isUncountable && piecesToAdd === 1 && hasGenuineIndividualWeights(selectedPacket) && Array.isArray(selectedPacket.stone_details)) {
      const allocatedStoneIds = new Set(items.filter((it) => it.packet_id === selectedPacket.id && it.stone_id).map((it) => it.stone_id));
      const avail = selectedPacket.stone_details.find((st) => st.status === "in_stock" && !allocatedStoneIds.has(st.id));
      if (avail && avail.id) {
        finalStoneId = avail.id;
      }
    }

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
      stone_id: finalStoneId,
      sub_gem_id: chosenSubGemId,
      is_uncountable: isUncountable,
      stone_weights: (hasGenuineIndividualWeights(selectedPacket) && piecesToAdd === 1) ? [weightToAdd] : undefined,
    };

    setItems((prev) => [...prev, newItem]);
    const remPcsAfter = maxPcs - piecesToAdd;
    const remWtAfter = maxWt - weightToAdd;
    if (isUncountable ? remWtAfter <= 0.001 : (remPcsAfter <= 0 || remWtAfter <= 0.001)) {
      setSelectedPacketId("");
    }
    show(
      isUncountable
        ? `Allocated ${weightToAdd} ${selectedPacket.unit || "cts"} (Bulk parcel) from packet ${selectedPacket.packet_number}`
        : `Allocated ${piecesToAdd} pc (${weightToAdd} ${selectedPacket.unit || "cts"}) from packet ${selectedPacket.packet_number}`,
      "success"
    );
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

      const isPredefinedIndividualStone = Boolean(
        targetPkt &&
        hasGenuineIndividualWeights(targetPkt) &&
        (
          it.stone_id ||
          it.sub_gem_id ||
          (it.stone_weights && it.stone_weights.length === 1 && !it.is_uncountable) ||
          ((targetPkt.stone_details?.length || targetPkt.sub_gems?.length || targetPkt.stone_weights?.length) && !it.is_uncountable && it.pieces === 1) ||
          (targetPkt.pieces === 1 && !targetPkt.is_uncountable)
        )
      );
      if (isPredefinedIndividualStone) {
        return prev;
      }

      let maxPcs = 999999;
      if (targetPkt) {
        const stock = getPacketRemainingStock(targetPkt);
        maxPcs = Math.max(pcs, stock.remainingPcs + (Number(it.pieces) || 0));
      }
      const clampedPcs = Math.max(0, Math.min(pcs, maxPcs));
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

      const isPredefinedIndividualStone = Boolean(
        targetPkt &&
        hasGenuineIndividualWeights(targetPkt) &&
        (
          it.stone_id ||
          it.sub_gem_id ||
          (it.stone_weights && it.stone_weights.length === 1 && !it.is_uncountable) ||
          ((targetPkt.stone_details?.length || targetPkt.sub_gems?.length || targetPkt.stone_weights?.length) && !it.is_uncountable && it.pieces === 1) ||
          (targetPkt.pieces === 1 && !targetPkt.is_uncountable)
        )
      );
      if (isPredefinedIndividualStone) {
        // Predefined individual stone weights cannot be altered in sale/approval
        return prev;
      }

      let maxWt = 999999;
      if (targetPkt) {
        const stock = getPacketRemainingStock(targetPkt);
        maxWt = Math.max(wt, Number((stock.remainingWt + (Number(it.weight) || 0)).toFixed(2)));
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
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
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
        const totalPcs = allocated.reduce((s, it) => s + (Number(it.pieces) || 0), 0);
        const totalWt = allocated.reduce((s, it) => s + (Number(it.weight) || 0), 0);
        const existingAlloc = getPacketExistingSaleAllocation(pkt);
        const maxPcs = (Number(pkt.pieces) || 0) + existingAlloc.pcs;
        const maxWt = Number(((Number(pkt.weight) || 0) + existingAlloc.wt).toFixed(2));
        if (!pkt.is_uncountable && maxPcs > 0 && totalPcs > maxPcs) {
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

      <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
                      <option value="">⚡ Quick Pick ({buyers.length} saved)...</option>
                      {buyers.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name} {b.company ? `(${b.company})` : ""} {b.city ? `• ${b.city}` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{ fontSize: 9, padding: "1px 5px", height: 22, color: "var(--muted)" }}
                      title="Clear saved client suggestions list"
                      onClick={() => {
                        if (window.confirm("Clear all current saved client suggestions? You can always type fresh client names.")) {
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
                placeholder="Type or select client name..."
                list="buyers-list"
                autoComplete="off"
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
                          const isPredefinedIndividualStone = Boolean(
                            targetPkt &&
                            hasGenuineIndividualWeights(targetPkt) &&
                            (
                              it.stone_id ||
                              it.sub_gem_id ||
                              (it.stone_weights && it.stone_weights.length === 1 && !it.is_uncountable) ||
                              ((targetPkt.stone_details?.length || targetPkt.sub_gems?.length || targetPkt.stone_weights?.length) && !it.is_uncountable && it.pieces === 1) ||
                              (targetPkt.pieces === 1 && !targetPkt.is_uncountable)
                            )
                          );

                          if (isPredefinedIndividualStone) {
                            return (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "2px 5px",
                                    background: "var(--surface-sunken)",
                                    borderRadius: 4,
                                    cursor: "not-allowed",
                                  }}
                                  title="Individual stone is 1 single piece and cannot be split"
                                >
                                  1
                                </span>
                                <span style={{ fontSize: 10, color: "var(--muted)" }}>pc</span>
                                <span style={{ fontSize: 10, color: "#d97706" }}>🔒</span>
                              </div>
                            );
                          }

                          const isBulk = Boolean(it.is_uncountable || targetPkt?.is_uncountable);
                          if (isBulk) {
                            return (
                              <div style={{ textAlign: "center", color: "var(--muted)", fontWeight: 700 }}>
                                —
                              </div>
                            );
                          }
                          const stock = targetPkt ? getPacketRemainingStock(targetPkt) : null;
                          const rowMaxPcs = stock
                            ? Math.max(Number(it.pieces) || 0, stock.remainingPcs + (Number(it.pieces) || 0))
                            : 9999;
                          return (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                              <input
                                type="number"
                                name="pieces"
                                min="0"
                                max={rowMaxPcs}
                                title={targetPkt ? `Max available in packet: ${rowMaxPcs} pcs` : undefined}
                                className="input pieces-input"
                                style={{ width: 55, textAlign: "right", padding: "2px 4px", fontSize: 11 }}
                                value={it.pieces !== undefined ? it.pieces : 1}
                                onChange={(e) => handleUpdateItemPieces(idx, Math.max(0, Number(e.target.value) || 0))}
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
                          const isPredefinedIndividualStone = Boolean(
                            targetPkt &&
                            hasGenuineIndividualWeights(targetPkt) &&
                            (
                              it.stone_id ||
                              it.sub_gem_id ||
                              (it.stone_weights && it.stone_weights.length === 1 && !it.is_uncountable) ||
                              ((targetPkt.stone_details?.length || targetPkt.sub_gems?.length || targetPkt.stone_weights?.length) && !it.is_uncountable && it.pieces === 1) ||
                              (targetPkt.pieces === 1 && !targetPkt.is_uncountable)
                            )
                          );

                          if (isPredefinedIndividualStone) {
                            return (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "var(--foreground)",
                                    padding: "2px 6px",
                                    background: "var(--surface-sunken)",
                                    borderRadius: 4,
                                    border: "1px dashed var(--border)",
                                    cursor: "not-allowed",
                                  }}
                                  title="Individual stone weight is predefined and locked against alterations in sales or approvals"
                                >
                                  {it.weight}
                                </span>
                                <span style={{ fontSize: 10, color: "var(--muted)" }}>{it.unit || "cts"}</span>
                                <span
                                  title="Predefined stone weight locked"
                                  style={{ fontSize: 11, color: "#d97706", cursor: "not-allowed" }}
                                >
                                  🔒
                                </span>
                              </div>
                            );
                          }

                          const stock = targetPkt ? getPacketRemainingStock(targetPkt) : null;
                          const rowMaxWt = stock
                            ? Math.max(Number(it.weight) || 0.01, Number((stock.remainingWt + (Number(it.weight) || 0)).toFixed(2)))
                            : 99999;
                          return (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                              <input
                                type="number"
                                step="any"
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
                  <option value="all">📦 All Vault Boxes</option>
                  {boxes.map((b) => {
                    const count = (b as any).in_stock_count ?? (b as any).packet_count ?? 0;
                    return (
                      <option key={b.id} value={b.name}>
                        📦 {b.name} {count > 0 ? `(${count} pkts)` : ""}
                      </option>
                    );
                  })}
                  <option value="unassigned">
                    📦 General Vault / Unassigned
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
                        {p.packet_number} • {p.particulars} [{p.box_name || "Vault"}] — {p.is_uncountable ? `${stock.remainingWt} ${p.unit || "cts"} (Bulk)` : `${stock.remainingPcs} ${stock.remainingPcs === 1 ? "pc" : "pcs"} | ${stock.remainingWt} ${p.unit || "cts"}`} available (₹{p.sale_rate_per_unit || Math.round(p.sale_price / (p.weight || 1))}/ct)
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
                      Available: {selectedPacket.is_uncountable ? (
                        <strong style={{ color: "var(--primary)" }}>{selectedPacketStock.remainingWt} {selectedPacket.unit || "cts"} (Bulk / Uncountable)</strong>
                      ) : (
                        <>
                          <strong style={{ color: "var(--primary)" }}>{selectedPacketStock.remainingPcs} {selectedPacketStock.remainingPcs === 1 ? "pc" : "pcs"}</strong> & <strong style={{ color: "var(--primary)" }}>{selectedPacketStock.remainingWt} {selectedPacket.unit || "cts"}</strong>
                        </>
                      )}
                      {(selectedPacketStock.allocatedPcs > 0 || selectedPacketStock.allocatedWt > 0) && (
                        <span style={{ color: "#d97706", marginLeft: 8, fontWeight: 700 }}>
                          ({selectedPacket.is_uncountable ? `${selectedPacketStock.allocatedWt} ${selectedPacket.unit || "cts"}` : `${selectedPacketStock.allocatedPcs} ${selectedPacketStock.allocatedPcs === 1 ? "pc" : "pcs"} & ${selectedPacketStock.allocatedWt} ${selectedPacket.unit || "cts"}`} already in this invoice)
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

                {(selectedPacket.is_uncountable ? selectedPacketStock.remainingWt <= 0 : (selectedPacketStock.remainingPcs <= 0 || selectedPacketStock.remainingWt <= 0)) ? (
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
                    <span>⚠️</span> All {selectedPacket.is_uncountable ? `${selectedPacket.weight} cts` : `${selectedPacket.pieces !== undefined ? selectedPacket.pieces : 1} ${(selectedPacket.pieces ?? 1) === 1 ? "stone" : "stones"}`} from packet {selectedPacket.packet_number} have already been allocated to this invoice table above.
                  </div>
                ) : (
                  <>
                    {/* Render different allocation controls based on whether packet has individual stones or is bulk/uncountable */}
                    {unallocatedStoneDetails.length > 0 || unallocatedSubGems.length > 0 ? (
                      /* Packets with individual stones: show stone dropdown and stone controls */
                      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 1fr 1.2fr auto", gap: 10, alignItems: "flex-end" }}>
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
                              } else if (unallocatedStoneDetails.length > 0) {
                                const st = unallocatedStoneDetails.find((s) => s.id === val);
                                if (st) {
                                  setAllocPieces(1);
                                  setAllocWeight(st.weight || selectedPacketStock.singleStoneWeight);
                                }
                              } else if (unallocatedSubGems.length > 0) {
                                const sub = unallocatedSubGems.find((s) => s.id === val);
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
                              <optgroup label={`In-Stock Individual Stones (${unallocatedStoneDetails.length})`}>
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
                              <optgroup label={`In-Stock Sub-Gems (${unallocatedSubGems.length})`}>
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

                        {(() => {
                          const selectedStoneDetail = unallocatedStoneDetails.find((s) => s.id === allocStoneChoice);
                          const selectedSubGem = unallocatedSubGems.find((s) => s.id === allocStoneChoice);

                          // Single-stone packet whose weight is known and entered
                          const isSingleStonePacket = Boolean(
                            selectedPacket.pieces === 1 && !selectedPacket.is_uncountable && selectedPacket.weight > 0
                          );

                          // Predefined stone whose individual weight is entered in inventory
                          const isSelectedStoneWithWeight = Boolean(
                            (selectedStoneDetail && Number(selectedStoneDetail.weight) > 0) ||
                            (selectedSubGem && Number(selectedSubGem.weight) > 0) ||
                            (allocStoneChoice === "single" && (Number(unallocatedStoneDetails[0]?.weight) > 0 || Number(unallocatedSubGems[0]?.weight) > 0))
                          );
                          const isLockedWhole = allocStoneChoice === "whole";

                          // Lock weight section ONLY for stones whose individual stone weight is entered (or whole packet)
                          const isWeightLocked = isLockedWhole || isSingleStonePacket || isSelectedStoneWithWeight;
                          const isPiecesLocked = isLockedWhole || isSingleStonePacket || isSelectedStoneWithWeight;
                          return (
                            <>
                              <div>
                                <label className="label" style={{ fontSize: 11, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
                                  <span>Pieces:*</span>
                                  {isPiecesLocked && (
                                    <span style={{ color: "#d97706", fontSize: 10, fontWeight: 700 }}>
                                      🔒 {allocPieces} {allocPieces === 1 ? "pc" : "pcs"}
                                    </span>
                                  )}
                                </label>
                                <input
                                  type="number"
                                  name="pieces"
                                  min="0"
                                  max={selectedPacketStock.remainingPcs}
                                  readOnly={isPiecesLocked}
                                  className="input pieces-input"
                                  style={{
                                    fontSize: 12,
                                    background: isPiecesLocked ? "var(--surface-sunken)" : undefined,
                                    cursor: isPiecesLocked ? "not-allowed" : undefined,
                                    fontWeight: isPiecesLocked ? 800 : undefined,
                                  }}
                                  value={allocPieces}
                                  onChange={(e) => {
                                    if (isPiecesLocked) return;
                                    const raw = Number(e.target.value) || 0;
                                    const newPcs = Math.min(selectedPacketStock.remainingPcs, Math.max(0, raw));
                                    setAllocPieces(newPcs);
                                    if (newPcs === 1 && isSelectedStoneWithWeight) {
                                      const firstRemaining = unallocatedStoneDetails[0] || unallocatedSubGems[0];
                                      if (firstRemaining && Number(firstRemaining.weight) > 0) {
                                        setAllocWeight(firstRemaining.weight);
                                      }
                                    }
                                  }}
                                />
                              </div>

                              <div>
                                <label className="label" style={{ fontSize: 11, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
                                  <span>Weight ({selectedPacket.unit || "cts"}):*</span>
                                  {isWeightLocked && (
                                    <span style={{ color: "#d97706", fontSize: 10, fontWeight: 700 }} title="Predefined stone weight is locked and cannot be changed">
                                      🔒 Locked
                                    </span>
                                  )}
                                </label>
                                <div style={{ position: "relative" }}>
                                  <input
                                    type="number"
                                    step={selectedPacket.unit === "g" ? "0.001" : "any"}
                                    min="0.001"
                                    max={selectedPacketStock.remainingWt}
                                    readOnly={isWeightLocked}
                                    className="input"
                                    style={{
                                      fontSize: 12,
                                      background: isWeightLocked ? "var(--surface-sunken)" : undefined,
                                      cursor: isWeightLocked ? "not-allowed" : undefined,
                                      fontWeight: isWeightLocked ? 800 : undefined,
                                      paddingRight: isWeightLocked ? 24 : undefined,
                                    }}
                                    value={allocWeight}
                                    onChange={(e) => {
                                      if (isWeightLocked) return;
                                      setAllocWeight(Math.min(selectedPacketStock.remainingWt, Math.max(0.001, Number(e.target.value) || 0)));
                                    }}
                                    title={isWeightLocked ? "Predefined stone weight from packet inventory cannot be changed in a sale/approval" : undefined}
                                    required
                                  />
                                  {isWeightLocked && (
                                    <span
                                      style={{
                                        position: "absolute",
                                        right: 8,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        fontSize: 11,
                                        color: "#d97706",
                                        pointerEvents: "none",
                                      }}
                                      title="Locked stone weight"
                                    >
                                      🔒
                                    </span>
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        })()}

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
                    ) : selectedPacket.is_uncountable ? (
                      /* Bulk / Uncountable Packet: weight-wise sale only */
                      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1.5fr auto", gap: 12, alignItems: "flex-end" }}>
                        <div>
                          <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                            Weight to Sell ({selectedPacket.unit || "cts"} - max {selectedPacketStock.remainingWt}):*
                          </label>
                          <input
                            type="number"
                            step={selectedPacket.unit === "g" ? "0.001" : "any"}
                            min="0.001"
                            max={selectedPacketStock.remainingWt}
                            className="input"
                            style={{ fontSize: 12 }}
                            value={allocWeight}
                            onChange={(e) => setAllocWeight(Math.min(selectedPacketStock.remainingWt, Math.max(0.001, Number(e.target.value) || 0)))}
                            required
                          />
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                            Uncountable / Bulk Parcel (Operating strictly weight-wise)
                          </div>
                        </div>

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

                        <div>
                          <label className="label" style={{ fontSize: 11, margin: "0 0 4px" }}>
                            Subtotal Amount (₹):
                          </label>
                          <div style={{ height: 38, display: "flex", alignItems: "center", fontWeight: 800, fontSize: 14, color: "var(--foreground)" }}>
                            {formatINR(Math.round(allocRate * allocWeight))}
                          </div>
                        </div>

                        <div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ height: 38, padding: "0 16px", fontWeight: 700 }}
                            onClick={handleAddSelectedStone}
                          >
                            ➕ Add Weight
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standard Packet without individual stone details: direct weight & pieces entry */
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr auto", gap: 10, alignItems: "flex-end" }}>
                        {(() => {
                          const isSinglePiecePacket = selectedPacket.pieces === 1 && !selectedPacket.is_uncountable;
                          const isStoneWeightsPacket = hasGenuineIndividualWeights(selectedPacket) && Array.isArray(selectedPacket.stone_weights) && selectedPacket.stone_weights.length > 0;
                          const isStandardPredefined = Boolean(
                            (isSinglePiecePacket && allocPieces === 1) ||
                            (isStoneWeightsPacket && allocPieces === 1)
                          );
                          return (
                            <>
                              <div>
                                <label className="label" style={{ fontSize: 11, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
                                  <span>Pieces (max {selectedPacketStock.remainingPcs}):*</span>
                                  {isSinglePiecePacket && (
                                    <span style={{ color: "#d97706", fontSize: 10, fontWeight: 700 }}>
                                      🔒 {allocPieces} {allocPieces === 1 ? "pc" : "pcs"}
                                    </span>
                                  )}
                                </label>
                                <input
                                  type="number"
                                  name="pieces"
                                  min="0"
                                  max={selectedPacketStock.remainingPcs}
                                  readOnly={isSinglePiecePacket}
                                  className="input pieces-input"
                                  style={{
                                    fontSize: 12,
                                    background: isSinglePiecePacket ? "var(--surface-sunken)" : undefined,
                                    cursor: isSinglePiecePacket ? "not-allowed" : undefined,
                                    fontWeight: isSinglePiecePacket ? 800 : undefined,
                                  }}
                                  value={allocPieces}
                                  onChange={(e) => {
                                    if (isSinglePiecePacket) return;
                                    const raw = Number(e.target.value) || 0;
                                    const newPcs = Math.min(selectedPacketStock.remainingPcs, Math.max(0, raw));
                                    setAllocPieces(newPcs);
                                    if (newPcs === selectedPacketStock.remainingPcs && newPcs > 0) {
                                      setAllocWeight(selectedPacketStock.remainingWt);
                                    } else if (isStoneWeightsPacket && newPcs === 1) {
                                      const unallocIdx = Math.min(selectedPacketStock.allocatedPcs, selectedPacket.stone_weights!.length - 1);
                                      setAllocWeight(selectedPacket.stone_weights![unallocIdx] || selectedPacketStock.singleStoneWeight);
                                    }
                                  }}
                                />
                              </div>

                              <div>
                                <label className="label" style={{ fontSize: 11, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
                                  <span>Weight ({selectedPacket.unit || "cts"}):*</span>
                                  {isStandardPredefined && (
                                    <span style={{ color: "#d97706", fontSize: 10, fontWeight: 700 }} title="Predefined stone weight is locked and cannot be changed">
                                      🔒 Locked
                                    </span>
                                  )}
                                </label>
                                <div style={{ position: "relative" }}>
                                  <input
                                    type="number"
                                    step={selectedPacket.unit === "g" ? "0.001" : "0.01"}
                                    min="0.001"
                                    max={selectedPacketStock.remainingWt}
                                    readOnly={isStandardPredefined}
                                    className="input"
                                    style={{
                                      fontSize: 12,
                                      background: isStandardPredefined ? "var(--surface-sunken)" : undefined,
                                      cursor: isStandardPredefined ? "not-allowed" : undefined,
                                      fontWeight: isStandardPredefined ? 800 : undefined,
                                      paddingRight: isStandardPredefined ? 24 : undefined,
                                    }}
                                    value={allocWeight}
                                    onChange={(e) => {
                                      if (isStandardPredefined) return;
                                      setAllocWeight(Math.min(selectedPacketStock.remainingWt, Math.max(0.001, Number(e.target.value) || 0.001)));
                                    }}
                                    title={isStandardPredefined ? "Predefined stone weight from packet inventory cannot be changed in a sale/approval" : undefined}
                                    required
                                  />
                                  {isStandardPredefined && (
                                    <span
                                      style={{
                                        position: "absolute",
                                        right: 8,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        fontSize: 11,
                                        color: "#d97706",
                                        pointerEvents: "none",
                                      }}
                                      title="Locked stone weight"
                                    >
                                      🔒
                                    </span>
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        })()}

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

                        <div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ height: 38, padding: "0 16px", fontWeight: 700 }}
                            onClick={handleAddSelectedStone}
                          >
                            ➕ Add to Voucher
                          </button>
                        </div>
                      </div>
                    )}

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
                    min="0"
                    className="input"
                    value={outsideItem.pieces ?? 0}
                    onChange={(e) => setOutsideItem({ ...outsideItem, pieces: Math.max(0, Number(e.target.value) || 0) })}
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
