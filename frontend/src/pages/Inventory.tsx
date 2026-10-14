import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import { Spinner, EmptyState } from "../ui";
import { formatINR, shortDate } from "../format";
import type { GemPacket, GemstoneStatus, GemBox, WeightUnit, GemSale, GemStoneDetail } from "../types/gemstone";
import type { CustomBoxTag } from "../gemstoneStorage";
import { normalizeBoxName } from "../gemstoneStorage";
import { DEFAULT_COMPANIES, DEFAULT_SHAPES, DEFAULT_VARIETIES } from "../types/gemstone";
import { PacketQrModal } from "../PacketQrModal";
import { QREncoder, formatPacketPayload } from "../qrCode";
import { useToast } from "../toast";
import { resolvePacketStoneStatuses, getPacketSalesHistoryWithStones, isGenericVariety } from "../packetStones";

const GEM_SHAPES = [
  "Oval",
  "Cushion",
  "Emerald Cut",
  "Round Brilliant",
  "Pear",
  "Marquise",
  "Princess",
  "Cabochon",
  "Radiant",
  "Heart",
  "Trilliant",
  "Asscher",
  "Baguette",
];

const BOX_COLOR_PALETTES = [
  { label: "Emerald Green", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" },
  { label: "Sapphire Blue", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)" },
  { label: "Ruby Red", color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)" },
  { label: "Diamond Amber", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)" },
  { label: "Amethyst Purple", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)" },
  { label: "Rose Pink", color: "#ec4899", bg: "rgba(236, 72, 153, 0.12)" },
  { label: "Teal Cyan", color: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)" },
  { label: "Vault Slate", color: "#64748b", bg: "rgba(100, 116, 139, 0.12)" },
];

function getPacketPerStoneWeights(p: GemPacket): number[] {
  if (Array.isArray(p.stone_weights) && p.stone_weights.length > 0) {
    const valid = p.stone_weights.filter((w) => typeof w === "number" && w > 0);
    if (valid.length > 0) return valid;
  }
  if (p.stone_weight && p.stone_weight > 0) {
    return [p.stone_weight];
  }
  const pcs = p.pieces && p.pieces > 0 ? p.pieces : 1;
  if (p.weight && p.weight > 0) {
    return [Math.round((p.weight / pcs) * 100) / 100];
  }
  return [];
}

export default function Inventory() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { show } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation & View Mode: "boxes" (visual cards) vs "all_packets" (master table) vs "calibrated_groups" (grouped stock)
  const [viewMode, setViewMode] = useState<"boxes" | "all_packets" | "calibrated_groups">("boxes");
  const [activeBoxName, setActiveBoxName] = useState<string | null>(searchParams.get("box") || null);
  const [selectedStoneTypeFilter, setSelectedStoneTypeFilter] = useState<string>("all");

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [shapeFilter, setShapeFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("packet_number");

  // Cost Price Password Protection (Default password: 2014)
  const [costPriceUnlocked, setCostPriceUnlocked] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState("");

  // Custom Gemstone Shapes Management
  const [shapeModalOpen, setShapeModalOpen] = useState(false);
  const [newShapeName, setNewShapeName] = useState("");

  // Selection & Modals
  const [selectedForQr, setSelectedForQr] = useState<GemPacket | null>(null);
  const [selectedPackets, setSelectedPackets] = useState<string[]>([]);
  const [editPacketModalOpen, setEditPacketModalOpen] = useState(false);
  const [editingPacket, setEditingPacket] = useState<Partial<GemPacket> | null>(null);
  const [batchAddCount, setBatchAddCount] = useState<number>(3);
  const [stoneEditMode, setStoneEditMode] = useState<"custom" | "compact">("custom");

  // Box Modal (Create & Customize)
  const [boxModalOpen, setBoxModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<GemBox | null>(null);
  const [boxFormName, setBoxFormName] = useState("");
  const [boxFormDesc, setBoxFormDesc] = useState("");
  const [boxFormColor, setBoxFormColor] = useState("#10b981");

  // Packet Details Modal
  const [packetDetailsModalItem, setPacketDetailsModalItem] = useState<GemPacket | null>(null);

  // Move Packet to Box Modal
  const [movePacketItem, setMovePacketItem] = useState<GemPacket | null>(null);
  const [targetMoveBoxName, setTargetMoveBoxName] = useState<string>("");

  // Memo/Approval Modal
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [memoPacket, setMemoPacket] = useState<GemPacket | null>(null);
  const [memoParty, setMemoParty] = useState("");
  const [memoNotes, setMemoNotes] = useState("");

  // Rename Packet Modal State
  const [renameModalPacket, setRenameModalPacket] = useState<GemPacket | null>(null);
  const [renameNewNumber, setRenameNewNumber] = useState<string>("");

  // Custom Gemstone Box Tag Builder State
  const [showCustomTagBuilder, setShowCustomTagBuilder] = useState(false);
  const [newCustomTagName, setNewCustomTagName] = useState("");
  const [newCustomTagColor, setNewCustomTagColor] = useState("#8b5cf6");

  // Data Queries
  const { data: packets = [], isLoading } = useQuery<GemPacket[]>({
    queryKey: ["packets"],
    queryFn: () => apiGet("/packets"),
  });

  const { data: boxes = [] } = useQuery<GemBox[]>({
    queryKey: ["boxes"],
    queryFn: () => apiGet("/boxes"),
  });

  const { data: allSales = [] } = useQuery<GemSale[]>({
    queryKey: ["sales"],
    queryFn: () => apiGet("/sales"),
  });

  const { data: customBoxTags = [] } = useQuery<CustomBoxTag[]>({
    queryKey: ["custom_box_tags"],
    queryFn: () => apiGet("/custom-box-tags"),
  });

  const { data: customParticulars = [] } = useQuery<string[]>({
    queryKey: ["custom_particulars"],
    queryFn: () => apiGet("/custom-particulars"),
  });

  const { data: customLabs = [] } = useQuery<string[]>({
    queryKey: ["custom_labs"],
    queryFn: () => apiGet("/custom-labs"),
  });

  const { data: customShapes = [] } = useQuery<string[]>({
    queryKey: ["custom_shapes"],
    queryFn: () => apiGet("/custom-shapes"),
  });

  // Merged List of Gemstone Shapes (Default + Custom)
  const allShapes = useMemo(() => {
    return Array.from(new Set([...DEFAULT_SHAPES, ...GEM_SHAPES, ...customShapes])).filter(Boolean);
  }, [customShapes]);

  // Cost Price Password Mutations
  const verifyPasswordMutation = useMutation({
    mutationFn: (pw: string) => apiPost("/cost-price-password/verify", { password: pw }),
    onSuccess: (res: any) => {
      if (res?.valid) {
        setCostPriceUnlocked(true);
        setPasswordModalOpen(false);
        setPasswordInput("");
        setPasswordError("");
        show("✓ Cost prices revealed successfully!", "success");
      } else {
        setPasswordError("Incorrect cost price password. Default is 2014.");
      }
    },
    onError: (err: any) => setPasswordError(err.message || "Failed to verify"),
  });

  const updatePasswordMutation = useMutation({
    mutationFn: (newPw: string) => apiPost("/cost-price-password/set", { password: newPw }),
    onSuccess: () => {
      show("✓ Cost price password updated successfully!", "success");
      setChangePasswordModalOpen(false);
      setNewPasswordInput("");
    },
    onError: (err: any) => show("Error updating password: " + err.message, "error"),
  });

  // Custom Shape Mutations
  const saveCustomShapeMutation = useMutation({
    mutationFn: (name: string) => apiPost("/custom-shapes", { name }),
    onSuccess: (name: string) => {
      queryClient.invalidateQueries({ queryKey: ["custom_shapes"] });
      show(`✓ Custom shape "${name}" added successfully!`, "success");
      setShapeModalOpen(false);
      setNewShapeName("");
    },
    onError: (err: any) => show("Error adding shape: " + err.message, "error"),
  });

  const deleteCustomShapeMutation = useMutation({
    mutationFn: (name: string) => apiDelete(`/custom-shapes/${encodeURIComponent(name)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_shapes"] });
      show("Custom shape removed", "info");
    },
  });

  // Custom Gemstone Color Palettes Combined
  const allColorPalettes = useMemo(() => {
    const list = [...BOX_COLOR_PALETTES];
    customBoxTags.forEach((ct) => {
      if (!list.some((p) => p.color.toLowerCase() === ct.color.toLowerCase() && p.label.toLowerCase() === ct.label.toLowerCase())) {
        list.push({
          label: ct.label,
          color: ct.color,
          bg: ct.bg || `${ct.color}20`,
        });
      }
    });
    return list;
  }, [customBoxTags]);

  const handleOpenRenameModal = (pkt: GemPacket) => {
    setRenameModalPacket(pkt);
    setRenameNewNumber(pkt.packet_number);
  };

  // Mutations
  const savePacketMutation = useMutation({
    mutationFn: (pkt: any) => (pkt.id ? apiPut(`/packets/${pkt.id}`, pkt) : apiPost("/packets", pkt)),
    onSuccess: (savedPkt: any) => {
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      queryClient.invalidateQueries({ queryKey: ["custom_particulars"] });
      queryClient.invalidateQueries({ queryKey: ["custom_labs"] });
      setEditPacketModalOpen(false);
      setEditingPacket(null);
      if (packetDetailsModalItem && packetDetailsModalItem.id === savedPkt.id) {
        setPacketDetailsModalItem(savedPkt);
      }
      show(`Packet ${savedPkt.packet_number} saved to ${savedPkt.box_name || "Vault"}!`, "success");
    },
    onError: (err: any) => show("Error saving packet: " + err.message, "error"),
  });

  const deletePacketMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/packets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      setPacketDetailsModalItem(null);
      show("Packet deleted", "info");
    },
    onError: (err: any) => show("Error deleting packet: " + err.message, "error"),
  });

  const saveBoxMutation = useMutation({
    mutationFn: (boxData: any) => (boxData.id ? apiPut(`/boxes/${boxData.id}`, boxData) : apiPost("/boxes", boxData)),
    onSuccess: (savedBox: any) => {
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      setBoxModalOpen(false);
      setEditingBox(null);
      if (activeBoxName && editingBox && editingBox.name === activeBoxName) {
        setActiveBoxName(savedBox.name);
      }
      show(`Vault Box "${savedBox?.name || "Box"}" saved successfully!`, "success");
    },
    onError: (err: any) => show("Error saving box: " + err.message, "error"),
  });

  const deleteBoxMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/boxes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      setActiveBoxName(null);
      setBoxModalOpen(false);
      setEditingBox(null);
      show("Box deleted. Contained packets moved to Unassigned.", "info");
    },
    onError: (err: any) => show("Error deleting box: " + err.message, "error"),
  });

  const saveCustomBoxTagMutation = useMutation({
    mutationFn: ({ label, color }: { label: string; color: string }) =>
      apiPost("/custom-box-tags", { label, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_box_tags"] });
      show("Custom gemstone color tag saved!", "success");
    },
    onError: (err: any) => show("Error saving tag: " + err.message, "error"),
  });

  const deleteCustomBoxTagMutation = useMutation({
    mutationFn: (tagId: string) => apiDelete(`/custom-box-tags/${tagId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_box_tags"] });
      show("Custom gemstone tag removed", "info");
    },
  });

  const renamePacketMutation = useMutation({
    mutationFn: ({ packetId, newPacketNumber }: { packetId: string; newPacketNumber: string }) =>
      apiPost(`/packets/${encodeURIComponent(packetId)}/rename`, { new_packet_number: newPacketNumber }),
    onSuccess: (updatedPkt: any) => {
      queryClient.invalidateQueries({ queryKey: ["packets"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["analytics_overview"] });
      if (packetDetailsModalItem && packetDetailsModalItem.id === updatedPkt.id) {
        setPacketDetailsModalItem(updatedPkt);
      }
      setRenameModalPacket(null);
      setRenameNewNumber("");
      show(`✓ Packet renamed to ${updatedPkt.packet_number} successfully!`, "success");
    },
    onError: (err: any) => show("Error renaming packet: " + err.message, "error"),
  });

  // Next recommended packet number
  const nextPacketNumber = useMemo(() => {
    let maxNum = 0;
    packets.forEach((p) => {
      const match = p.packet_number.match(/^ex\/(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `ex/${maxNum + 1}`;
  }, [packets]);

  // Aggregate Metrics for all Vault Boxes
  const boxSummaryList = useMemo(() => {
    const list = boxes.map((box) => {
      const boxPackets = packets.filter(
        (p) => normalizeBoxName(p.box_name) === normalizeBoxName(box.name)
      );
      const totalPcs = boxPackets.reduce((sum, p) => sum + (p.pieces || 1), 0);
      const totalWeight = Math.round(boxPackets.reduce((sum, p) => sum + (p.weight || 0), 0) * 100) / 100;
      const totalPurchase = boxPackets.reduce((sum, p) => sum + (p.purchase_price || 0), 0);
      const totalSale = boxPackets.reduce((sum, p) => sum + (p.sale_price || 0), 0);
      const inStockCount = boxPackets.filter((p) => p.status === "in_stock").length;

      // Group stones in this box by stone type (variety) with carat ranges
      const stMap: Record<
        string,
        {
          type: string;
          pcs: number;
          weight: number;
          minWeight?: number;
          maxWeight?: number;
          unit?: string;
        }
      > = {};
      boxPackets.forEach((p) => {
        const t = (p.particulars || "Gemstone").trim();
        if (!stMap[t]) stMap[t] = { type: t, pcs: 0, weight: 0, unit: p.unit || "cts" };
        stMap[t].pcs += p.pieces || 1;
        stMap[t].weight = Math.round((stMap[t].weight + (p.weight || 0)) * 100) / 100;

        const weights = getPacketPerStoneWeights(p);
        weights.forEach((w) => {
          if (typeof w === "number" && w > 0) {
            if (stMap[t].minWeight === undefined || w < stMap[t].minWeight!) stMap[t].minWeight = w;
            if (stMap[t].maxWeight === undefined || w > stMap[t].maxWeight!) stMap[t].maxWeight = w;
          }
        });
      });
      const stoneTypeSummary = Object.values(stMap).sort((a, b) => b.weight - a.weight);

      return {
        box,
        packets: boxPackets,
        count: boxPackets.length,
        inStockCount,
        totalPcs,
        totalWeight,
        totalPurchase,
        totalSale,
        margin: totalSale - totalPurchase,
        stoneTypeSummary,
      };
    });

    // Check for packets not in any registered box
    const registeredNames = new Set(boxes.map((b) => normalizeBoxName(b.name)));
    const unassigned = packets.filter((p) => !p.box_name || !registeredNames.has(normalizeBoxName(p.box_name)));
    if (unassigned.length > 0) {
      const totalPcs = unassigned.reduce((sum, p) => sum + (p.pieces || 1), 0);
      const totalWeight = Math.round(unassigned.reduce((sum, p) => sum + (p.weight || 0), 0) * 100) / 100;
      const totalPurchase = unassigned.reduce((sum, p) => sum + (p.purchase_price || 0), 0);
      const totalSale = unassigned.reduce((sum, p) => sum + (p.sale_price || 0), 0);

      const stMap: Record<
        string,
        {
          type: string;
          pcs: number;
          weight: number;
          minWeight?: number;
          maxWeight?: number;
          unit?: string;
        }
      > = {};
      unassigned.forEach((p) => {
        const t = (p.particulars || "Gemstone").trim();
        if (!stMap[t]) stMap[t] = { type: t, pcs: 0, weight: 0, unit: p.unit || "cts" };
        stMap[t].pcs += p.pieces || 1;
        stMap[t].weight = Math.round((stMap[t].weight + (p.weight || 0)) * 100) / 100;

        const weights = getPacketPerStoneWeights(p);
        weights.forEach((w) => {
          if (typeof w === "number" && w > 0) {
            if (stMap[t].minWeight === undefined || w < stMap[t].minWeight!) stMap[t].minWeight = w;
            if (stMap[t].maxWeight === undefined || w > stMap[t].maxWeight!) stMap[t].maxWeight = w;
          }
        });
      });
      const stoneTypeSummary = Object.values(stMap).sort((a, b) => b.weight - a.weight);

      list.push({
        box: {
          id: "box-unassigned",
          name: "General Vault / Unassigned",
          description: "Packets not currently assigned to any named storage box",
          color: "#64748b",
          created_at: "",
        },
        packets: unassigned,
        count: unassigned.length,
        inStockCount: unassigned.filter((p) => p.status === "in_stock").length,
        totalPcs,
        totalWeight,
        totalPurchase,
        totalSale,
        margin: totalSale - totalPurchase,
        stoneTypeSummary,
      });
    }

    return list;
  }, [boxes, packets]);

  // Overall Vault Totals
  const overallTotals = useMemo(() => {
    const totalPackets = packets.length;
    const totalWeight = Math.round(packets.reduce((sum, p) => sum + (p.weight || 0), 0) * 100) / 100;
    const totalCost = packets.reduce((sum, p) => sum + (p.purchase_price || 0), 0);
    const totalAsk = packets.reduce((sum, p) => sum + (p.sale_price || 0), 0);
    return { totalPackets, totalWeight, totalCost, totalAsk, margin: totalAsk - totalCost };
  }, [packets]);

  // Active Box Metrics (if an active box is selected)
  const currentOpenBox = useMemo(() => {
    if (!activeBoxName) return null;
    return (
      boxSummaryList.find(
        (b) => normalizeBoxName(b.box.name) === normalizeBoxName(activeBoxName)
      ) || null
    );
  }, [activeBoxName, boxSummaryList]);

  // Active Box Stone Breakdown by Stone Type (Gem Variety) showing pieces and weight
  const activeBoxStoneBreakdown = useMemo(() => {
    if (!activeBoxName) return [];
    const boxPackets = packets.filter(
      (p) =>
        normalizeBoxName(p.box_name) === normalizeBoxName(activeBoxName) ||
        (!p.box_name && activeBoxName.toLowerCase().includes("unassigned"))
    );

    const typeMap: Record<
      string,
      {
        stoneType: string;
        totalPieces: number;
        totalWeight: number;
        packetCount: number;
        inStockPieces: number;
        inStockWeight: number;
        totalAsk: number;
        totalCost: number;
        minWeight?: number;
        maxWeight?: number;
        unit?: string;
      }
    > = {};

    boxPackets.forEach((p) => {
      const type = (p.particulars || "Gemstone").trim();
      if (!typeMap[type]) {
        typeMap[type] = {
          stoneType: type,
          totalPieces: 0,
          totalWeight: 0,
          packetCount: 0,
          inStockPieces: 0,
          inStockWeight: 0,
          totalAsk: 0,
          totalCost: 0,
          unit: p.unit || "cts",
        };
      }
      const pcs = p.pieces && p.pieces > 0 ? p.pieces : 1;
      const wt = p.weight || 0;
      typeMap[type].totalPieces += pcs;
      typeMap[type].totalWeight = Math.round((typeMap[type].totalWeight + wt) * 100) / 100;
      typeMap[type].packetCount += 1;
      typeMap[type].totalAsk += p.sale_price || 0;
      typeMap[type].totalCost += p.purchase_price || 0;

      const weights = getPacketPerStoneWeights(p);
      weights.forEach((w) => {
        if (typeof w === "number" && w > 0) {
          if (typeMap[type].minWeight === undefined || w < typeMap[type].minWeight!) typeMap[type].minWeight = w;
          if (typeMap[type].maxWeight === undefined || w > typeMap[type].maxWeight!) typeMap[type].maxWeight = w;
        }
      });

      if (p.status === "in_stock" || !p.status) {
        typeMap[type].inStockPieces += pcs;
        typeMap[type].inStockWeight = Math.round((typeMap[type].inStockWeight + wt) * 100) / 100;
      }
    });

    return Object.values(typeMap).sort((a, b) => b.totalWeight - a.totalWeight);
  }, [activeBoxName, packets]);

  // Filtered Packets (scoped to active box if selected, or all, plus stone type filter)
  const filteredPackets = useMemo(() => {
    let result = [...packets];

    if (activeBoxName) {
      result = result.filter(
        (p) =>
          normalizeBoxName(p.box_name) === normalizeBoxName(activeBoxName) ||
          (!p.box_name && activeBoxName.toLowerCase().includes("unassigned"))
      );
    }

    if (activeBoxName && selectedStoneTypeFilter !== "all") {
      result = result.filter(
        (p) => (p.particulars || "Gemstone").trim().toLowerCase() === selectedStoneTypeFilter.toLowerCase()
      );
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.packet_number.toLowerCase().includes(q) ||
          p.particulars.toLowerCase().includes(q) ||
          p.shape.toLowerCase().includes(q) ||
          (p.box_name && p.box_name.toLowerCase().includes(q)) ||
          (p.cert_lab && p.cert_lab.toLowerCase().includes(q)) ||
          (p.cert_no && p.cert_no.toLowerCase().includes(q)) ||
          (p.buyer_name && p.buyer_name.toLowerCase().includes(q)) ||
          (p.memo_party && p.memo_party.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (shapeFilter !== "all") {
      result = result.filter((p) => p.shape === shapeFilter);
    }

    if (companyFilter !== "all") {
      result = result.filter((p) => (p.company_name || "Shreeji Gems") === companyFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "packet_number") {
        return a.packet_number.localeCompare(b.packet_number, undefined, { numeric: true });
      }
      if (sortBy === "weight_desc") return b.weight - a.weight;
      if (sortBy === "cost_desc") return b.purchase_price - a.purchase_price;
      if (sortBy === "sale_desc") return b.sale_price - a.sale_price;
      if (sortBy === "date_desc") return (b.purchase_date || "").localeCompare(a.purchase_date || "");
      return 0;
    });

    return result;
  }, [packets, activeBoxName, selectedStoneTypeFilter, searchTerm, statusFilter, shapeFilter, companyFilter, sortBy]);

  // Grouped Calibrated Stock: Group packets having identical particulars, shape & weight per stone
  const calibratedGroups = useMemo(() => {
    type CalibratedGroup = {
      key: string;
      particulars: string;
      shape: string;
      stone_weight: number;
      unit: string;
      total_packets: number;
      total_pieces: number;
      total_weight: number;
      packets: GemPacket[];
      avg_sale_rate: number;
      total_sale_price: number;
      total_cost_price: number;
    };

    const groupMap: Record<string, CalibratedGroup> = {};

    packets.forEach((p) => {
      if (p.status === "sold") return; // Only count current active stock
      const pcs = p.pieces && p.pieces > 0 ? p.pieces : 1;
      const sWt = p.stone_weight && p.stone_weight > 0
        ? Math.round(p.stone_weight * 100) / 100
        : Math.round((p.weight / pcs) * 100) / 100;

      const partKey = (p.particulars || "Gemstone").trim().toLowerCase();
      const shapeKey = (p.shape || "Oval").trim().toLowerCase();
      const key = `${partKey}__${shapeKey}__${sWt}`;

      if (!groupMap[key]) {
        groupMap[key] = {
          key,
          particulars: p.particulars || "Gemstone",
          shape: p.shape || "Oval",
          stone_weight: sWt,
          unit: p.unit || "cts",
          total_packets: 0,
          total_pieces: 0,
          total_weight: 0,
          packets: [],
          avg_sale_rate: p.sale_rate_per_unit || 0,
          total_sale_price: 0,
          total_cost_price: 0,
        };
      }

      groupMap[key].total_packets += 1;
      groupMap[key].total_pieces += pcs;
      groupMap[key].total_weight = Math.round((groupMap[key].total_weight + (p.weight || 0)) * 100) / 100;
      groupMap[key].packets.push(p);
      groupMap[key].total_sale_price += p.sale_price || 0;
      groupMap[key].total_cost_price += p.purchase_price || 0;
    });

    return Object.values(groupMap).sort((a, b) => b.total_pieces - a.total_pieces);
  }, [packets]);

  const calibratedTotals = useMemo(() => {
    const totalGroups = calibratedGroups.length;
    const totalPcs = calibratedGroups.reduce((sum, g) => sum + g.total_pieces, 0);
    const totalWeight = Math.round(calibratedGroups.reduce((sum, g) => sum + g.total_weight, 0) * 100) / 100;
    const totalAsk = calibratedGroups.reduce((sum, g) => sum + g.total_sale_price, 0);
    const totalCost = calibratedGroups.reduce((sum, g) => sum + g.total_cost_price, 0);
    return { totalGroups, totalPcs, totalWeight, totalAsk, totalCost };
  }, [calibratedGroups]);

  // Past Sales History & Realization for the currently opened packet details modal (with stone mapping)
  const matchingSalesHistory = useMemo(() => {
    if (!packetDetailsModalItem) return [];
    return getPacketSalesHistoryWithStones(packetDetailsModalItem, allSales);
  }, [packetDetailsModalItem, allSales]);

  // Status of all individual stones in the packet (IN STOCK vs SOLD vs ON APPROVAL)
  const modalStoneStatuses = useMemo(() => {
    if (!packetDetailsModalItem) return [];
    return resolvePacketStoneStatuses(packetDetailsModalItem, allSales);
  }, [packetDetailsModalItem, allSales]);

  const totalPcsSold = useMemo(() => {
    return matchingSalesHistory
      .filter((h) => !h.is_approval || h.approval_status === "approved_billed")
      .reduce((sum, h) => sum + h.pieces, 0);
  }, [matchingSalesHistory]);

  const totalCaratsSold = useMemo(() => {
    return matchingSalesHistory
      .filter((h) => !h.is_approval || h.approval_status === "approved_billed")
      .reduce((sum, h) => sum + h.weight, 0);
  }, [matchingSalesHistory]);

  const totalSoldRevenue = useMemo(() => {
    return matchingSalesHistory
      .filter((h) => !h.is_approval || h.approval_status === "approved_billed")
      .reduce((sum, h) => sum + h.total_price, 0);
  }, [matchingSalesHistory]);

  // Handlers for Boxes
  const handleOpenCreateBoxModal = () => {
    setEditingBox(null);
    setBoxFormName(`Box ${boxes.length + 1} — `);
    setBoxFormDesc("");
    setBoxFormColor("#10b981");
    setBoxModalOpen(true);
  };

  const handleOpenEditBoxModal = (box: GemBox, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingBox(box);
    setBoxFormName(box.name);
    setBoxFormDesc(box.description || "");
    setBoxFormColor(box.color || "#10b981");
    setBoxModalOpen(true);
  };

  const handleSaveBoxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boxFormName.trim()) {
      show("Please enter a box name", "warning");
      return;
    }
    saveBoxMutation.mutate({
      id: editingBox?.id,
      name: boxFormName.trim(),
      description: boxFormDesc.trim(),
      color: boxFormColor,
    });
  };

  const handleDeleteBoxConfirm = (box: GemBox, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm(`Delete box "${box.name}"? Packets inside will be moved to General Vault.`)) {
      deleteBoxMutation.mutate(box.id);
    }
  };

  // Stone Configuration Helpers
  const getEditingStoneDetails = (): GemStoneDetail[] => {
    if (!editingPacket) return [];
    if (editingPacket.stone_details && editingPacket.stone_details.length > 0) {
      return editingPacket.stone_details;
    }
    if (editingPacket.stone_weights && editingPacket.stone_weights.length > 0) {
      return editingPacket.stone_weights.map((w, i) => ({
        id: `st-${i + 1}`,
        variety: editingPacket.particulars || "",
        shape: editingPacket.shape || "Oval",
        weight: Number(w) || 0,
        mm_size: editingPacket.mm_size || "",
        notes: "",
      }));
    }
    return [];
  };

  const updateEditingStones = (newStones: GemStoneDetail[]) => {
    if (!editingPacket) return;
    if (newStones.length === 0) {
      setEditingPacket({
        ...editingPacket,
        stone_weights: [],
        stone_details: [],
      });
      return;
    }
    const newWeights = newStones.map((s) => Number(s.weight) || 0);
    const sumWeight = Number(newWeights.reduce((a, b) => a + b, 0).toFixed(3));
    const newPcs = newStones.length;
    const pRate = editingPacket.purchase_rate_per_unit || 0;
    const sRate = editingPacket.sale_rate_per_unit || 0;
    setEditingPacket({
      ...editingPacket,
      pieces: newPcs,
      stone_weights: newWeights,
      stone_details: newStones,
      weight: sumWeight > 0 ? sumWeight : (editingPacket.weight || 0),
      stone_weight: newPcs > 0 && sumWeight > 0 ? Number((sumWeight / newPcs).toFixed(3)) : editingPacket.stone_weight,
      purchase_price: sumWeight > 0 ? Math.round(pRate * sumWeight) : editingPacket.purchase_price,
      sale_price: sumWeight > 0 ? Math.round(sRate * sumWeight) : editingPacket.sale_price,
    });
  };

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

  const getPacketShapeDisplay = (p: GemPacket) => {
    const statuses = resolvePacketStoneStatuses(p, allSales);
    if (statuses && statuses.length > 1) {
      const unique = Array.from(new Set(statuses.map((s) => (s.shape || "").trim()).filter(Boolean)));
      if (unique.length > 1) {
        return `Mixed Shapes (${unique.slice(0, 3).join(", ")}${unique.length > 3 ? "..." : ""})`;
      }
    }
    if (p.stone_details && p.stone_details.length > 1) {
      const unique = Array.from(new Set(p.stone_details.map((s) => (s.shape || "").trim()).filter(Boolean)));
      if (unique.length > 1) {
        return `Mixed Shapes (${unique.slice(0, 3).join(", ")}${unique.length > 3 ? "..." : ""})`;
      }
    }
    return p.shape;
  };

  // Handlers for Packets
  const handleAddNewPacket = (preselectedBox?: string) => {
    const targetBox = preselectedBox || activeBoxName || boxes[0]?.name || "Box 1 — Emerald Vault";
    setEditingPacket({
      packet_number: nextPacketNumber,
      box_name: targetBox,
      particulars: "",
      shape: "Oval",
      weight: 0,
      unit: "cts",
      pieces: 1,
      stone_weight: 0,
      stone_weights: [],
      stone_details: [],
      mm_size: "",
      purchase_rate_per_unit: 0,
      purchase_price: 0,
      purchase_date: new Date().toISOString().slice(0, 10),
      sale_rate_per_unit: 0,
      sale_price: 0,
      min_sale_price: 0,
      company_name: "Shreeji Gems",
      status: "in_stock",
      cert_lab: "",
      hsn_code: "7103",
      gst_rate: 0.25,
      origin: "",
      treatment: "",
      notes: "",
    });
    setStoneEditMode("custom");
    setEditPacketModalOpen(true);
  };

  const handleEditPacket = (pkt: GemPacket, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const pcs = pkt.pieces > 0 ? pkt.pieces : 1;
    const calcStoneWeight = pkt.stone_weight ?? (pkt.weight ? Math.round((pkt.weight / pcs) * 1000) / 1000 : 0);
    const hasExistingWeights = Array.isArray(pkt.stone_weights) && pkt.stone_weights.length > 0;
    const hasExistingDetails = Array.isArray(pkt.stone_details) && pkt.stone_details.length > 0;

    const resolvedWeights = hasExistingWeights ? [...pkt.stone_weights!] : [];
    const resolvedDetails: GemStoneDetail[] = hasExistingDetails
      ? [...pkt.stone_details!]
      : hasExistingWeights
      ? resolvedWeights.map((w, idx) => ({
          id: `st-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
          variety: pkt.particulars || "",
          shape: pkt.shape || "Oval",
          weight: Number(w) || 0,
          mm_size: pkt.mm_size || "",
        }))
      : [];

    setEditingPacket({
      ...pkt,
      stone_weight: calcStoneWeight,
      stone_weights: resolvedWeights,
      stone_details: resolvedDetails,
    });
    setStoneEditMode("custom");
    setEditPacketModalOpen(true);
  };

  const handleOpenMoveModal = (pkt: GemPacket, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMovePacketItem(pkt);
    setTargetMoveBoxName(pkt.box_name || boxes[0]?.name || "");
  };

  const handleConfirmMovePacket = () => {
    if (!movePacketItem || !targetMoveBoxName) return;
    savePacketMutation.mutate({
      ...movePacketItem,
      box_name: targetMoveBoxName,
    });
    setMovePacketItem(null);
  };

  // Batch Print QR (Strict Requirement: ONLY packet number and QR code)
  const handleBatchPrint = () => {
    const toPrint =
      selectedPackets.length > 0
        ? packets.filter((p) => selectedPackets.includes(p.id))
        : filteredPackets.filter((p) => p.status === "in_stock" || p.status === "on_approval" || p.status === "on_memo");

    if (toPrint.length === 0) {
      show("No packets selected or available to print", "warning");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Strictly Packet Number and QR code only
    const cardsHtml = toPrint
      .map((p) => {
        const payload = formatPacketPayload(p, "document");
        const qrSvg = QREncoder.toSVG(payload, 115, 2);
        return `
        <div class="minimal-qr-card">
          <div class="pkt-header">${p.packet_number}</div>
          <div class="qr-wrapper">${qrSvg}</div>
        </div>
      `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Batch QR Labels — ${toPrint.length} Packets</title>
          <style>
            @page { size: A4; margin: 6mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; }
            .grid { 
              display: grid; 
              grid-template-columns: repeat(4, 1fr); 
              gap: 5mm; 
              padding: 4mm;
            }
            .minimal-qr-card {
              border: 1.5px solid #000;
              border-radius: 6px;
              padding: 6px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              page-break-inside: avoid;
              background: #fff;
              min-height: 135px;
            }
            .pkt-header { 
              font-size: 17px; 
              font-weight: 900; 
              letter-spacing: 0.5px;
              text-transform: uppercase;
              border-bottom: 1.5px solid #000;
              padding-bottom: 4px;
              margin-bottom: 6px;
              width: 100%;
            }
            .qr-wrapper {
              display: flex;
              align-items: center;
              justify-content: center;
            }
          </style>
        </head>
        <body>
          <div class="grid">${cardsHtml}</div>
          <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleToggleSelect = (id: string) => {
    setSelectedPackets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleToggleSelectAll = () => {
    if (selectedPackets.length === filteredPackets.length) {
      setSelectedPackets([]);
    } else {
      setSelectedPackets(filteredPackets.map((p) => p.id));
    }
  };

  return (
    <div className="page-body" style={{ gap: 20 }}>
      {/* Top Header & Master Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 24 }}>💎</span>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
              {activeBoxName ? `Storage Box: ${activeBoxName}` : "Boxes & Gemstone Inventory Master"}
            </h1>
          </div>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 13 }}>
            {activeBoxName
              ? "Inspecting packets inside this specific storage box. Click 'Back to All Boxes' to return."
              : "Organized into physical storage boxes. Click any box below to inspect its packets, or toggle to table view."}
          </p>
        </div>

        {/* View Switcher & Action Buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {!activeBoxName && (
            <div
              style={{
                display: "inline-flex",
                background: "var(--surface)",
                padding: 3,
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                className={`btn btn-xs ${viewMode === "boxes" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setViewMode("boxes")}
                style={{ fontWeight: 700 }}
              >
                🗃️ Boxes View
              </button>
              <button
                type="button"
                className={`btn btn-xs ${viewMode === "all_packets" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setViewMode("all_packets")}
                style={{ fontWeight: 700 }}
              >
                📋 All Packets Table
              </button>
              <button
                type="button"
                className={`btn btn-xs ${viewMode === "calibrated_groups" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setViewMode("calibrated_groups")}
                style={{ fontWeight: 700 }}
              >
                ⚖️ Grouped Calibrated Stock ({calibratedGroups.length})
              </button>
            </div>
          )}

          {/* Cost Price Password Protected Toggle (Default: 2014) */}
          {costPriceUnlocked ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ borderColor: "#10b981", color: "#10b981", fontWeight: 800 }}
                onClick={() => setCostPriceUnlocked(false)}
                title="Hide cost prices and lock with password again"
              >
                🔓 Cost Revealed (Click to Lock)
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setNewPasswordInput("");
                  setChangePasswordModalOpen(true);
                }}
                title="Change cost price password"
              >
                ⚙️
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setPasswordInput("");
                setPasswordError("");
                setPasswordModalOpen(true);
              }}
              title="Reveal purchase/cost prices by entering password (default: 2014)"
            >
              🔒 Reveal Cost Price
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShapeModalOpen(true)}
            title="Manage gemstone shapes & add custom cuts"
          >
            ✨ Custom Shapes ({allShapes.length})
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleOpenCreateBoxModal}
            title="Create a new physical storage box container"
          >
            📦 + Create Box
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleBatchPrint}
            title="Batch print minimal labels with Packet Number & QR code only"
          >
            🖨️ Batch Print QR ({selectedPackets.length > 0 ? selectedPackets.length : "In-Stock"})
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleAddNewPacket()}
            title="Add a new gemstone packet and choose which box to place it into"
          >
            + Add New Packet
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation when inside a Box */}
      {activeBoxName && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface)",
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setActiveBoxName(null)}
              style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>←</span> Back to All Vault Boxes
            </button>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: "var(--primary)" }}>
              📦 {activeBoxName}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                background: "rgba(16, 185, 129, 0.12)",
                color: "var(--primary)",
                padding: "2px 8px",
                borderRadius: 12,
                border: "1px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              {filteredPackets.length} {filteredPackets.length === 1 ? "Packet" : "Packets"} in Box
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {currentOpenBox && currentOpenBox.box.id !== "box-unassigned" && (
              <>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={(e) => handleOpenEditBoxModal(currentOpenBox.box, e)}
                >
                  ✏️ Customize This Box
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{ color: "#ef4444" }}
                  onClick={(e) => handleDeleteBoxConfirm(currentOpenBox.box, e)}
                >
                  🗑️ Delete Box
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={() => handleAddNewPacket(activeBoxName)}
            >
              + Add Packet to this Box
            </button>
          </div>
        </div>
      )}

      {/* Stone Pieces & Weight Breakdown by Stone Type inside Opened Box */}
      {activeBoxName && activeBoxStoneBreakdown.length > 0 && (
        <div
          className="card"
          style={{
            padding: "16px 20px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--on-surface)",
                }}
              >
                <span>💎</span> Stones & Carats by Stone Type ({activeBoxStoneBreakdown.length} Varieties in {activeBoxName})
              </h3>
              <span style={{ fontSize: 12, color: "var(--on-surface-2)" }}>
                Showing total pieces and total carats for every stone type in this box. Click any card to filter packets below.
              </span>
            </div>

            {selectedStoneTypeFilter !== "all" && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                style={{ color: "var(--primary)", fontWeight: 700 }}
                onClick={() => setSelectedStoneTypeFilter("all")}
              >
                ✕ Show All Varieties ({activeBoxStoneBreakdown.reduce((s, x) => s + x.totalPieces, 0)} pcs)
              </button>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 10,
            }}
          >
            {activeBoxStoneBreakdown.map((item) => {
              const isSelected = selectedStoneTypeFilter.toLowerCase() === item.stoneType.toLowerCase();
              return (
                <div
                  key={item.stoneType}
                  onClick={() => setSelectedStoneTypeFilter(isSelected ? "all" : item.stoneType)}
                  style={{
                    background: isSelected ? "rgba(16, 185, 129, 0.12)" : "var(--surface-sunken)",
                    border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title={`Click to filter table by ${item.stoneType}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5, color: isSelected ? "var(--primary)" : "var(--on-surface)" }}>
                      💎 {item.stoneType}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        background: "rgba(0,0,0,0.06)",
                        padding: "1px 6px",
                        borderRadius: 10,
                        fontWeight: 700,
                        color: "var(--on-surface-2)",
                      }}
                    >
                      {item.packetCount} {item.packetCount === 1 ? "pkt" : "pkts"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "baseline" }}>
                    <div>
                      <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "var(--on-surface-2)" }}>
                        Pieces
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "var(--on-surface)" }}>
                        {item.totalPieces} pcs
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "var(--on-surface-2)" }}>
                        Total Weight
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "var(--primary)" }}>
                        {item.totalWeight.toFixed(2)} cts
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--on-surface-2)",
                      marginTop: 6,
                      borderTop: "1px dashed var(--border)",
                      paddingTop: 4,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Avg Weight:</span>
                    <strong>{item.totalPieces > 0 ? (item.totalWeight / item.totalPieces).toFixed(2) : "0"} ct/pc</strong>
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--on-surface-2)",
                      marginTop: 4,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Carat Range:</span>
                    <strong style={{ color: "var(--primary)" }}>
                      {item.minWeight !== undefined && item.maxWeight !== undefined
                        ? item.minWeight === item.maxWeight
                          ? `${item.minWeight.toFixed(2)} ${item.unit || "cts"}`
                          : `${item.minWeight.toFixed(2)} – ${item.maxWeight.toFixed(2)} ${item.unit || "cts"}`
                        : "—"}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* =========================================================================
          VIEW 1: VISUAL VAULT BOXES GRID (When viewing all boxes in Boxes View)
          ========================================================================= */}
      {!activeBoxName && viewMode === "boxes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🗃️</span> Physical Storage Boxes ({boxSummaryList.length} Boxes)
            </h2>
            <span style={{ fontSize: 12.5, color: "var(--on-surface-2)", fontWeight: 600 }}>
              Click any box to inspect all individual packets inside it.
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {boxSummaryList.map((item) => {
              const { box, count, totalPcs, totalWeight, totalPurchase, totalSale } = item;
              const boxColor = box.color || "#10b981";

              return (
                <div
                  key={box.id}
                  className="card"
                  onClick={() => setActiveBoxName(box.name)}
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    cursor: "pointer",
                    borderTop: `4px solid ${boxColor}`,
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ padding: "16px 18px", flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            background: `${boxColor}22`,
                            color: boxColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 20,
                            flexShrink: 0,
                          }}
                        >
                          📦
                        </div>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "var(--on-surface)" }}>
                            {box.name}
                          </h3>
                          <span style={{ fontSize: 12.5, color: "var(--on-surface-2)", fontWeight: 600 }}>
                            {count} Packets ({totalPcs} Pcs) • {totalWeight} cts/g
                          </span>
                        </div>
                      </div>

                      {box.id !== "box-unassigned" && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={(e) => handleOpenEditBoxModal(box, e)}
                          title="Customize box name, color & notes"
                          style={{ fontSize: 13, padding: "2px 6px" }}
                        >
                          ✏️
                        </button>
                      )}
                    </div>

                    {box.description && (
                      <p
                        style={{
                          fontSize: 12.5,
                          color: "var(--on-surface-2)",
                          margin: "10px 0 0",
                          lineHeight: 1.45,
                          minHeight: 34,
                        }}
                      >
                        {box.description}
                      </p>
                    )}

                    {/* Stone Types & Weights Breakdown in this Box */}
                    {item.stoneTypeSummary && item.stoneTypeSummary.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {item.stoneTypeSummary.slice(0, 3).map((st) => {
                          let caratText = `${st.weight.toFixed(1)}ct`;
                          if (st.minWeight !== undefined && st.maxWeight !== undefined) {
                            if (st.pcs === 1) {
                              caratText = `${st.minWeight.toFixed(2)}ct`;
                            } else if (Math.abs(st.minWeight - st.maxWeight) < 0.001) {
                              caratText = `${st.weight.toFixed(1)}ct • ${st.minWeight.toFixed(2)} ct/pc`;
                            } else {
                              caratText = `${st.weight.toFixed(1)}ct • ${st.minWeight.toFixed(2)} – ${st.maxWeight.toFixed(2)} cts`;
                            }
                          }

                          return (
                            <span
                              key={st.type}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                background: "rgba(0,0,0,0.04)",
                                padding: "3px 8px",
                                borderRadius: 5,
                                color: "var(--on-surface)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              💎 {st.type}: <strong>{st.pcs} {st.pcs === 1 ? "pc" : "pcs"}</strong> ({caratText})
                            </span>
                          );
                        })}
                        {item.stoneTypeSummary.length > 3 && (
                          <span style={{ fontSize: 10, color: "var(--muted)", alignSelf: "center", fontWeight: 700 }}>
                            +{item.stoneTypeSummary.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: 14,
                        padding: "10px 12px",
                        background: "var(--surface-sunken)",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--on-surface-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Cost Valuation
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "var(--on-surface)" }}>
                          {costPriceUnlocked ? formatINR(totalPurchase) : "🔒 ••••••"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--on-surface-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Asking Valuation
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "var(--primary)" }}>
                          {formatINR(totalSale)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "10px 16px",
                      background: "var(--surface)",
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: boxColor }}>
                      Open Box (View Packets) ➜
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddNewPacket(box.name);
                      }}
                      title="Add a new packet directly to this box"
                      style={{ fontWeight: 700 }}
                    >
                      + Add Stone
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Quick Create Box Card */}
            <div
              className="card"
              onClick={handleOpenCreateBoxModal}
              style={{
                border: "2px dashed var(--border-strong)",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "30px 20px",
                textAlign: "center",
                gap: 10,
                minHeight: 220,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                +
              </div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Create New Vault Box</div>
              <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 220 }}>
                Set up a new storage container, assign a custom color code & description.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: CALIBRATED STONES GROUPING (Identical Weight / Size Stones Grouped)
          ========================================================================= */}
      {!activeBoxName && viewMode === "calibrated_groups" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header Summary KPI */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <div className="gem-kpi-card" style={{ borderTop: "3px solid #10b981" }}>
              <div style={{ fontSize: 11, color: "var(--on-surface-2)", textTransform: "uppercase", fontWeight: 800 }}>
                Calibrated Groups
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)" }}>
                {calibratedTotals.totalGroups}
              </div>
              <div style={{ fontSize: 11, color: "var(--on-surface-2)" }}>
                Distinct cut & stone weight lots
              </div>
            </div>

            <div className="gem-kpi-card" style={{ borderTop: "3px solid #3b82f6" }}>
              <div style={{ fontSize: 11, color: "var(--on-surface-2)", textTransform: "uppercase", fontWeight: 800 }}>
                Total Calibrated Pieces
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#3b82f6" }}>
                {calibratedTotals.totalPcs.toLocaleString("en-IN")} pcs
              </div>
              <div style={{ fontSize: 11, color: "var(--on-surface-2)" }}>
                Individual matching stones
              </div>
            </div>

            <div className="gem-kpi-card" style={{ borderTop: "3px solid #8b5cf6" }}>
              <div style={{ fontSize: 11, color: "var(--on-surface-2)", textTransform: "uppercase", fontWeight: 800 }}>
                Total Calibrated Carats
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#8b5cf6" }}>
                {calibratedTotals.totalWeight.toFixed(2)} cts
              </div>
              <div style={{ fontSize: 11, color: "var(--on-surface-2)" }}>
                Cumulative calibrated weight
              </div>
            </div>

            <div className="gem-kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
              <div style={{ fontSize: 11, color: "var(--on-surface-2)", textTransform: "uppercase", fontWeight: 800 }}>
                Total Asking Valuation
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)" }}>
                {formatINR(calibratedTotals.totalAsk)}
              </div>
              <div style={{ fontSize: 11, color: "var(--on-surface-2)" }}>
                Cost: {costPriceUnlocked ? formatINR(calibratedTotals.totalCost) : "🔒 ••••••"}
              </div>
            </div>
          </div>

          {/* Grouped Table */}
          {calibratedGroups.length === 0 ? (
            <EmptyState
              icon="⚖️"
              title="No Calibrated Groups"
              description="No active stones found in inventory. Add gemstone packets with calibrated pieces and identical stone weights."
            />
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>
                    ⚖️ Grouped Calibrated Gemstones Stock Register
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--on-surface-2)" }}>
                    Packets with identical weight per stone are grouped together showing total stock counts and weights.
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", background: "rgba(16, 185, 129, 0.1)", padding: "4px 10px", borderRadius: 12 }}>
                  Showing {calibratedGroups.length} Calibrated Groups
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: "center" }}>#</th>
                      <th>Stone Particulars (Variety)</th>
                      <th>Shape / Cut</th>
                      <th style={{ textAlign: "right", background: "rgba(16, 185, 129, 0.05)", fontWeight: 800 }}>
                        Weight per Stone (Calibrated Size)
                      </th>
                      <th style={{ textAlign: "center" }}>Packets</th>
                      <th style={{ textAlign: "center", fontWeight: 800 }}>Total Pieces (Pcs)</th>
                      <th style={{ textAlign: "right", fontWeight: 800 }}>Total Carats / Weight</th>
                      <th style={{ textAlign: "right" }}>Avg Ask Rate (₹/unit)</th>
                      <th style={{ textAlign: "right", fontWeight: 900, color: "var(--primary)" }}>
                        Total Asking Valuation
                      </th>
                      <th style={{ textAlign: "right", background: "rgba(0,0,0,0.03)" }}>
                        Total Cost {!costPriceUnlocked && "🔒"}
                      </th>
                      <th>Contained Packets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calibratedGroups.map((g, gIdx) => {
                      const avgRate = g.total_weight > 0 ? Math.round(g.total_sale_price / g.total_weight) : 0;
                      return (
                        <tr key={g.key}>
                          <td style={{ textAlign: "center", color: "var(--muted)", fontWeight: 700 }}>
                            {gIdx + 1}
                          </td>
                          <td style={{ fontWeight: 800 }}>{g.particulars}</td>
                          <td>
                            <span style={{ padding: "2px 8px", borderRadius: 4, background: "var(--surface-sunken)", border: "1px solid var(--border)", fontWeight: 600 }}>
                              {g.shape}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", background: "rgba(16, 185, 129, 0.05)", fontWeight: 800, color: "var(--primary)" }}>
                            {g.stone_weight.toFixed(2)} {g.unit}/stone
                          </td>
                          <td style={{ textAlign: "center", fontWeight: 700 }}>{g.total_packets}</td>
                          <td style={{ textAlign: "center", fontWeight: 800, fontSize: 13 }}>
                            <span style={{ background: "rgba(59, 130, 246, 0.1)", color: "#2563eb", padding: "2px 8px", borderRadius: 12 }}>
                              {g.total_pieces} pcs
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800 }}>
                            {g.total_weight.toFixed(2)} {g.unit}
                          </td>
                          <td style={{ textAlign: "right", color: "var(--muted)" }}>
                            ₹{avgRate.toLocaleString("en-IN")}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 900, color: "var(--primary)" }}>
                            {formatINR(g.total_sale_price)}
                          </td>
                          <td style={{ textAlign: "right", background: "rgba(0,0,0,0.03)", fontWeight: 700 }}>
                            {costPriceUnlocked ? formatINR(g.total_cost_price) : "🔒 ••••••"}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 260 }}>
                              {g.packets.map((pkt) => (
                                <button
                                  key={pkt.id}
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  style={{
                                    fontSize: 10.5,
                                    padding: "1px 6px",
                                    background: "var(--surface-sunken)",
                                    border: "1px solid var(--border)",
                                    fontWeight: 700,
                                  }}
                                  onClick={() => setPacketDetailsModalItem(pkt)}
                                  title={`Inspect packet ${pkt.packet_number} (${pkt.pieces} pcs in ${pkt.box_name || "Vault"})`}
                                >
                                  {pkt.packet_number} ({pkt.pieces}p)
                                </button>
                              ))}
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
        </div>
      )}

      {/* =========================================================================
          VIEW 2: PACKETS TABLE (Inside a specific box OR All Packets master table)
          ========================================================================= */}
      {(activeBoxName || viewMode === "all_packets") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filter & Search Bar */}
          <div
            className="card"
            style={{
              padding: "14px 16px",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* Search */}
            <div style={{ position: "relative", flexGrow: 1, minWidth: 220 }}>
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
                placeholder={
                  activeBoxName
                    ? `Search packets inside ${activeBoxName}...`
                    : "Search packet #, gem, shape, box, cert, party..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Box Selector if in master table mode */}
            {!activeBoxName && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>Box:</label>
                <select
                  className="select"
                  value={activeBoxName || "all"}
                  onChange={(e) => setActiveBoxName(e.target.value === "all" ? null : e.target.value)}
                >
                  <option value="all">All Vault Boxes</option>
                  {boxes.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Company Filter (5 Companies) */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Company:</label>
              <select className="select" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                <option value="all">All Companies</option>
                {DEFAULT_COMPANIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Status:</label>
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="in_stock">In Stock</option>
                <option value="on_approval">On Approval</option>
                <option value="sold">Sold</option>
              </select>
            </div>

            {/* Shape Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Shape:</label>
              <select className="select" value={shapeFilter} onChange={(e) => setShapeFilter(e.target.value)}>
                <option value="all">All Shapes</option>
                {allShapes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Sort:</label>
              <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="packet_number">Packet #</option>
                <option value="weight_desc">Weight (High to Low)</option>
                <option value="cost_desc">Cost Price (High to Low)</option>
                <option value="sale_desc">Asking Price (High to Low)</option>
                <option value="date_desc">Intake Date (Newest)</option>
              </select>
            </div>
          </div>

          {/* Packets Table */}
          {isLoading ? (
            <Spinner />
          ) : filteredPackets.length === 0 ? (
            <EmptyState
              icon="💎"
              title="No Gemstone Packets Found"
              description={
                activeBoxName
                  ? `No packets found inside "${activeBoxName}". Click "+ Add Packet to this Box" to insert one.`
                  : "Try adjusting your search criteria or add a new packet to the vault."
              }
            />
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 35, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedPackets.length > 0 && selectedPackets.length === filteredPackets.length}
                          onChange={handleToggleSelectAll}
                        />
                      </th>
                      <th style={{ width: 45, textAlign: "center" }}>QR</th>
                      <th>S.No & Packet #</th>
                      {!activeBoxName && <th>Box</th>}
                      <th>Particulars (Gem Variety)</th>
                      <th>Shape</th>
                      <th style={{ textAlign: "right" }}>Weight</th>
                      <th style={{ textAlign: "center" }}>Pcs</th>
                      {/* Valuation Columns: Rate per ct/g & Aggregate Total in adjacent column */}
                      <th style={{ textAlign: "right", background: "rgba(0,0,0,0.02)" }}>
                        Buy Rate (₹/unit) {!costPriceUnlocked && "🔒"}
                      </th>
                      <th style={{ textAlign: "right", background: "rgba(0,0,0,0.04)", fontWeight: 800 }}>
                        Total Cost (Aggregate) {!costPriceUnlocked && "🔒"}
                      </th>
                      <th style={{ textAlign: "right", background: "rgba(16, 185, 129, 0.03)" }}>Ask Rate (₹/unit)</th>
                      <th style={{ textAlign: "right", background: "rgba(16, 185, 129, 0.07)", fontWeight: 800 }}>
                        Total Ask (Aggregate)
                      </th>
                      <th>Company</th>
                      <th style={{ textAlign: "center" }}>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPackets.map((pkt, idx) => {
                      const isSelected = selectedPackets.includes(pkt.id);
                      const unitLabel = pkt.unit === "g" ? "g" : "cts";
                      const pRate = pkt.purchase_rate_per_unit || (pkt.weight ? Math.round(pkt.purchase_price / pkt.weight) : 0);
                      const sRate = pkt.sale_rate_per_unit || (pkt.weight ? Math.round(pkt.sale_price / pkt.weight) : 0);

                      return (
                        <tr
                          key={pkt.id}
                          style={{
                            background: isSelected ? "rgba(16, 185, 129, 0.05)" : undefined,
                            cursor: "pointer",
                          }}
                          onClick={() => setPacketDetailsModalItem(pkt)}
                        >
                          {/* Checkbox */}
                          <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(pkt.id)}
                            />
                          </td>

                          {/* QR Thumbnail */}
                          <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn btn-ghost btn-xs"
                              style={{ padding: 2 }}
                              title="Print minimal QR label"
                              onClick={() => setSelectedForQr(pkt)}
                            >
                              <span style={{ fontSize: 16 }}>🏷️</span>
                            </button>
                          </td>

                          {/* Packet Number with Serial Count */}
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  color: "var(--muted)",
                                  background: "var(--surface-sunken)",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  border: "1px solid var(--border)",
                                  fontFamily: "monospace",
                                  whiteSpace: "nowrap",
                                }}
                                title={`Serial #${idx + 1} of ${filteredPackets.length}`}
                              >
                                #{idx + 1}
                              </span>
                              <span style={{ fontWeight: 900, color: "var(--primary)", fontSize: 13, textTransform: "uppercase" }}>
                                {pkt.packet_number}
                              </span>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                style={{ padding: "1px 4px", fontSize: 11, color: "var(--on-surface-2)" }}
                                title={`Rename packet ${pkt.packet_number}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRenameModal(pkt);
                                }}
                              >
                                ✏️
                              </button>
                            </div>
                          </td>

                          {/* Box Name (if in master view) */}
                          {!activeBoxName && (
                            <td onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                style={{
                                  fontSize: 11,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "var(--surface)",
                                  fontWeight: 600,
                                  border: "1px solid var(--border)",
                                }}
                                onClick={() => setActiveBoxName(pkt.box_name || null)}
                                title="Click to view all packets in this box"
                              >
                                📦 {pkt.box_name ? pkt.box_name.split("—")[0].trim() : "Unassigned"}
                              </button>
                            </td>
                          )}

                          {/* Particulars */}
                          <td>
                            <div style={{ fontWeight: 700 }}>{pkt.particulars}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)" }}>
                              {pkt.cert_lab && pkt.cert_lab !== "Self / None" ? `Lab: ${pkt.cert_lab}` : "Natural"}
                              {pkt.origin ? ` • ${pkt.origin}` : ""}
                            </div>
                          </td>

                          {/* Shape */}
                          <td>{pkt.shape}</td>

                          {/* Weight & Unit */}
                          <td style={{ textAlign: "right", fontWeight: 700 }}>
                            {pkt.weight} <span style={{ fontSize: 10, color: "var(--muted)" }}>{unitLabel}</span>
                          </td>

                          {/* Pieces */}
                          <td style={{ textAlign: "center" }}>{pkt.pieces}</td>

                          {/* Purchase Rate per ct/g */}
                          <td style={{ textAlign: "right", color: "var(--muted)", background: "rgba(0,0,0,0.02)" }}>
                            {costPriceUnlocked ? formatINR(pRate) : "🔒 ••••••"}
                          </td>

                          {/* Total Purchase Cost (Aggregate in adjacent column) */}
                          <td style={{ textAlign: "right", fontWeight: 800, background: "rgba(0,0,0,0.04)" }}>
                            {costPriceUnlocked ? formatINR(pkt.purchase_price) : "🔒 ••••••"}
                          </td>

                          {/* Sale Rate per ct/g */}
                          <td style={{ textAlign: "right", color: "var(--muted)", background: "rgba(16, 185, 129, 0.03)" }}>
                            {formatINR(sRate)}
                          </td>

                          {/* Total Asking Price (Aggregate in adjacent column) */}
                          <td style={{ textAlign: "right", fontWeight: 800, color: "var(--primary)", background: "rgba(16, 185, 129, 0.07)" }}>
                            {formatINR(pkt.sale_price)}
                          </td>

                          {/* Company Name */}
                          <td>
                            <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                              {pkt.company_name || "Shreeji Gems"}
                            </span>
                          </td>

                          {/* Status */}
                          <td style={{ textAlign: "center" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: 12,
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background:
                                  pkt.status === "in_stock"
                                    ? "rgba(16, 185, 129, 0.12)"
                                    : pkt.status === "on_approval"
                                    ? "rgba(245, 158, 11, 0.12)"
                                    : "rgba(100, 116, 139, 0.12)",
                                color:
                                  pkt.status === "in_stock"
                                    ? "#10b981"
                                    : pkt.status === "on_approval"
                                    ? "#f59e0b"
                                    : "#64748b",
                              }}
                            >
                              {pkt.status === "on_approval" ? "On Approval" : pkt.status.replace("_", " ")}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "inline-flex", gap: 4 }}>
                              <button
                                className="btn btn-outline btn-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRenameModal(pkt);
                                }}
                                title="Rename packet number within this box"
                              >
                                🏷️ Rename
                              </button>
                              <button
                                className="btn btn-outline btn-xs"
                                onClick={(e) => handleOpenMoveModal(pkt, e)}
                                title="Move packet to another vault box"
                              >
                                📦 Move
                              </button>
                              <button
                                className="btn btn-outline btn-xs"
                                onClick={(e) => handleEditPacket(pkt, e)}
                                title="Edit packet specifications"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: "#ef4444" }}
                                title="Delete packet"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete packet ${pkt.packet_number}?`)) {
                                    deletePacketMutation.mutate(pkt.id);
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
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: CREATE OR CUSTOMIZE VAULT BOX (User-Friendly Box Manager)
          ========================================================================= */}
      {boxModalOpen && (
        <div className="modal-overlay" onClick={() => setBoxModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📦</span> {editingBox ? `Customize Box: ${editingBox.name}` : "Create New Vault Box"}
              </h2>
              <button className="btn-close" onClick={() => setBoxModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBoxSubmit} className="modal-body" style={{ gap: 16 }}>
              <div>
                <label className="label" style={{ fontWeight: 800 }}>
                  Box Name / Vault Label*
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="e.g. Box 1 — Emerald Vault or Safe 2 - Burma Rubies"
                  value={boxFormName}
                  onChange={(e) => setBoxFormName(e.target.value)}
                />
                <span style={{ fontSize: 12, color: "var(--on-surface-2)", marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                  💡 Renaming an existing box will automatically keep all its stones linked!
                </span>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label className="label" style={{ fontWeight: 800, margin: 0 }}>
                    Color Theme Tag (Gemstone Identity)
                  </label>
                  {!showCustomTagBuilder && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setShowCustomTagBuilder(true)}
                      style={{ color: "var(--primary)", fontWeight: 700, padding: "2px 6px" }}
                    >
                      ➕ Add Custom Gem Tag &amp; Color
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {allColorPalettes.map((pal) => {
                    const isSelected = boxFormColor === pal.color;
                    const customTagObj = customBoxTags.find(
                      (ct) => ct.label.toLowerCase() === pal.label.toLowerCase()
                    );

                    return (
                      <div key={pal.label + pal.color} style={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setBoxFormColor(pal.color);
                            // If creating a new box and name is empty, auto-suggest box name
                            if (!editingBox && !boxFormName.trim()) {
                              setBoxFormName(`Box ${boxes.length + 1} — ${pal.label.split(" ")[0]}`);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "7px 14px",
                            borderRadius: 8,
                            border: isSelected ? `2px solid ${pal.color}` : "1.5px solid var(--border-strong)",
                            background: isSelected ? pal.color : "var(--surface-2)",
                            color: isSelected ? "#FFFFFF" : "var(--on-surface)",
                            cursor: "pointer",
                            fontSize: 12.5,
                            fontWeight: 800,
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span
                            style={{
                              width: 13,
                              height: 13,
                              borderRadius: "50%",
                              background: isSelected ? "#FFFFFF" : pal.color,
                              boxShadow: isSelected ? "0 0 6px rgba(255,255,255,0.8)" : undefined,
                            }}
                          />
                          {pal.label}
                        </button>
                        {customTagObj && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            style={{
                              marginLeft: -4,
                              padding: "2px 4px",
                              fontSize: 10,
                              color: "var(--muted)",
                              lineHeight: 1,
                            }}
                            title={`Remove custom tag "${pal.label}"`}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCustomBoxTagMutation.mutate(customTagObj.id);
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Inline Custom Gemstone Tag & Color Builder */}
                {showCustomTagBuilder && (
                  <div
                    style={{
                      background: "var(--surface-sunken)",
                      border: "1.5px solid var(--border-strong)",
                      borderRadius: 8,
                      padding: "12px 14px",
                      marginTop: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800 }}>
                        🎨 Add Custom Gemstone Tag (e.g. Tanzanite, Paraiba Tourmaline, Spinel, Opal)
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => setShowCustomTagBuilder(false)}
                        style={{ padding: "0 4px" }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Tag Name (e.g. Tanzanite Violet, Tourmaline Mint)"
                        style={{ flex: 1, minWidth: 170, fontSize: 13, padding: "7px 10px" }}
                        value={newCustomTagName}
                        onChange={(e) => setNewCustomTagName(e.target.value)}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="color"
                          style={{
                            width: 36,
                            height: 36,
                            padding: 0,
                            border: "1.5px solid var(--border-strong)",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                          value={newCustomTagColor}
                          onChange={(e) => setNewCustomTagColor(e.target.value)}
                          title="Pick custom color"
                        />
                        <input
                          type="text"
                          className="input"
                          style={{ width: 85, fontSize: 12, padding: "7px 8px", textTransform: "uppercase" }}
                          value={newCustomTagColor}
                          onChange={(e) => setNewCustomTagColor(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        style={{ padding: "8px 14px", fontWeight: 800 }}
                        onClick={() => {
                          if (!newCustomTagName.trim()) {
                            show("Please enter a gemstone tag name", "error");
                            return;
                          }
                          saveCustomBoxTagMutation.mutate(
                            { label: newCustomTagName.trim(), color: newCustomTagColor },
                            {
                              onSuccess: () => {
                                setBoxFormColor(newCustomTagColor);
                                if (!editingBox && !boxFormName.trim()) {
                                  setBoxFormName(`Box ${boxes.length + 1} — ${newCustomTagName.trim()}`);
                                }
                                setNewCustomTagName("");
                                setShowCustomTagBuilder(false);
                              },
                            }
                          );
                        }}
                      >
                        Save Gem Tag
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="label" style={{ fontWeight: 800 }}>
                  Box Description & Safe Location
                </label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. Top shelf in main Godrej safe, contains certified Zambian loose emerald parcels"
                  value={boxFormDesc}
                  onChange={(e) => setBoxFormDesc(e.target.value)}
                />
              </div>

              {editingBox && (
                <div className="alert-box">
                  ℹ️ This box currently holds packets. If deleted, packets are moved safely to General Vault.
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: 8 }}>
                {editingBox && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ marginRight: "auto" }}
                    onClick={(e) => handleDeleteBoxConfirm(editingBox, e)}
                  >
                    🗑️ Delete Box
                  </button>
                )}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setBoxModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saveBoxMutation.isPending}>
                  {saveBoxMutation.isPending ? "Saving..." : editingBox ? "Update Box" : "Create Box"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ADD / EDIT PACKET (With Prominent Box Selection & Customization)
          ========================================================================= */}
      {editPacketModalOpen && editingPacket && (
        <div className="modal-overlay" onClick={() => setEditPacketModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{editingPacket.id ? "✏️" : "💎"}</span>
                  {editingPacket.id ? `Edit Packet: ${editingPacket.packet_number}` : "Create & Intake New Gemstone Packet"}
                </h2>
                <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 12 }}>
                  Assign to a storage box and enter stones, weights, and valuations.
                </p>
              </div>
              <button className="btn-close" onClick={() => setEditPacketModalOpen(false)}>
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const targetBox = editingPacket.box_name || boxes[0]?.name || "Box 1 — Emerald Vault";
                const pNum = (editingPacket.packet_number || "").trim();
                const isDuplicate = packets.some(
                  (p) =>
                    p.id !== editingPacket.id &&
                    normalizeBoxName(p.box_name) === normalizeBoxName(targetBox) &&
                    p.packet_number.trim().toLowerCase() === pNum.toLowerCase()
                );
                if (isDuplicate) {
                  show(
                    `Packet #${pNum} already exists in "${targetBox}"! Packet numbers must be unique within the same box. (Identical packet numbers are permitted across different boxes).`,
                    "error"
                  );
                  return;
                }
                savePacketMutation.mutate(editingPacket);
              }}
              className="modal-body"
              style={{ gap: 14 }}
            >
              {/* Box Selection (Feature requirement: select which box they go into) */}
              <div
                style={{
                  background: "var(--surface-sunken)",
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1.5px solid var(--primary)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label className="label" style={{ fontWeight: 800, fontSize: 13, margin: 0 }}>
                    📦 Assigned Storage Box*
                  </label>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={() => {
                      setEditingBox(null);
                      setBoxFormName(`Box ${boxes.length + 1} — `);
                      setBoxFormDesc("");
                      setBoxModalOpen(true);
                    }}
                  >
                    + Create New Box Right Now
                  </button>
                </div>
                <select
                  className="select"
                  style={{ width: "100%", fontWeight: 700, fontSize: 13 }}
                  value={editingPacket.box_name || boxes[0]?.name || "Box 1 — Emerald Vault"}
                  onChange={(e) => setEditingPacket({ ...editingPacket, box_name: e.target.value })}
                  required
                >
                  {boxes.map((b) => (
                    <option key={b.id} value={b.name}>
                      📦 {b.name}
                    </option>
                  ))}
                  <option value="General Vault / Unassigned">General Vault / Unassigned</option>
                </select>
              </div>

              {/* Packet Number & Company */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Packet # (unique within this box):</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={editingPacket.packet_number || ""}
                    onChange={(e) => setEditingPacket({ ...editingPacket, packet_number: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Company (1 of 5 Firms):</label>
                  <select
                    className="select"
                    value={editingPacket.company_name || "Shreeji Gems"}
                    onChange={(e) => setEditingPacket({ ...editingPacket, company_name: e.target.value })}
                  >
                    {DEFAULT_COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Particulars (Customizable) & Shape */}
              <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Particulars (Stone Variety):</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Emerald, Ruby, Blue Sapphire..."
                    list="particulars-datalist"
                    value={editingPacket.particulars || ""}
                    onChange={(e) => setEditingPacket({ ...editingPacket, particulars: e.target.value })}
                  />
                  <datalist id="particulars-datalist">
                    {customParticulars.map((cp, i) => (
                      <option key={i} value={cp} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="label" style={{ margin: 0 }}>Shape / Cut:</label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{ fontSize: 11, padding: "1px 4px", color: "var(--primary)" }}
                      onClick={() => setShapeModalOpen(true)}
                    >
                      + Add Shape
                    </button>
                  </div>
                  <select
                    className="select"
                    value={editingPacket.shape || "Oval"}
                    onChange={(e) => setEditingPacket({ ...editingPacket, shape: e.target.value })}
                  >
                    {allShapes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Weight, Unit Selector (Carats vs Grams), Pieces, Stone Weight & MM Size */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr 1fr 1.2fr", gap: 10 }}>
                <div>
                  <label className="label">Total Weight:</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input"
                    value={editingPacket.weight || 0}
                    onChange={(e) => {
                      const wt = Number(e.target.value) || 0;
                      const pcs = editingPacket.pieces && editingPacket.pieces > 0 ? editingPacket.pieces : 1;
                      const pRate = editingPacket.purchase_rate_per_unit || 0;
                      const sRate = editingPacket.sale_rate_per_unit || 0;
                      setEditingPacket({
                        ...editingPacket,
                        weight: wt,
                        stone_weight: Math.round((wt / pcs) * 1000) / 1000,
                        purchase_price: Math.round(pRate * wt),
                        sale_price: Math.round(sRate * wt),
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="label">Weight Unit:</label>
                  <select
                    className="select"
                    value={editingPacket.unit || "cts"}
                    onChange={(e) => setEditingPacket({ ...editingPacket, unit: e.target.value as WeightUnit })}
                  >
                    <option value="cts">Carats (cts)</option>
                    <option value="g">Grams (g)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Pieces:</label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={editingPacket.pieces || 1}
                    onChange={(e) => {
                      const pcs = Number(e.target.value) || 1;
                      const sWt = editingPacket.stone_weight && editingPacket.stone_weight > 0
                        ? editingPacket.stone_weight
                        : (editingPacket.weight ? editingPacket.weight / pcs : 1);
                      const newTotalWeight = Math.round(pcs * sWt * 100) / 100;
                      const pRate = editingPacket.purchase_rate_per_unit || 0;
                      const sRate = editingPacket.sale_rate_per_unit || 0;
                      setEditingPacket({
                        ...editingPacket,
                        pieces: pcs,
                        weight: newTotalWeight,
                        purchase_price: Math.round(pRate * newTotalWeight),
                        sale_price: Math.round(sRate * newTotalWeight),
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="label" title="Weight per individual stone to group calibrated sizes">
                    Weight/Stone:
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    className="input"
                    placeholder="e.g. 0.25"
                    value={editingPacket.stone_weight ?? ""}
                    onChange={(e) => {
                      const sw = parseFloat(e.target.value) || 0;
                      const pcs = editingPacket.pieces && editingPacket.pieces > 0 ? editingPacket.pieces : 1;
                      const newTotalWeight = Math.round(pcs * sw * 100) / 100;
                      const pRate = editingPacket.purchase_rate_per_unit || 0;
                      const sRate = editingPacket.sale_rate_per_unit || 0;
                      setEditingPacket({
                        ...editingPacket,
                        stone_weight: sw,
                        weight: newTotalWeight,
                        purchase_price: Math.round(pRate * newTotalWeight),
                        sale_price: Math.round(sRate * newTotalWeight),
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="label">MM Size:</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 11.2 x 8.4 mm"
                    value={editingPacket.mm_size || ""}
                    onChange={(e) => setEditingPacket({ ...editingPacket, mm_size: e.target.value })}
                  />
                </div>
              </div>

              {/* Stone Configuration: Individual & Multiple Stones Manager with Full Customization */}
              <div
                style={{
                  background: "var(--surface-sunken)",
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1.5px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Mode Selector & Summary */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)" }}>
                      💎 Stone Configuration:
                    </span>
                    {getEditingStoneDetails().length > 0 && (
                      <div style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 2 }}>
                        <button
                          type="button"
                          style={{
                            padding: "3px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 4,
                            border: "none",
                            cursor: "pointer",
                            background: (editingPacket.pieces || 1) === 1 ? "var(--primary)" : "transparent",
                            color: (editingPacket.pieces || 1) === 1 ? "#fff" : "var(--on-surface-2)",
                            transition: "all 0.15s ease",
                          }}
                          onClick={() => {
                            const w = editingPacket.weight || 0;
                            updateEditingStones([
                              {
                                id: "st-1",
                                variety: editingPacket.particulars || "",
                                shape: editingPacket.shape || "Oval",
                                weight: w,
                                mm_size: editingPacket.mm_size || "",
                              },
                            ]);
                          }}
                        >
                          Single Stone (1 pc)
                        </button>
                        <button
                          type="button"
                          style={{
                            padding: "3px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 4,
                            border: "none",
                            cursor: "pointer",
                            background: (editingPacket.pieces || 1) > 1 ? "var(--primary)" : "transparent",
                            color: (editingPacket.pieces || 1) > 1 ? "#fff" : "var(--on-surface-2)",
                            transition: "all 0.15s ease",
                          }}
                          onClick={() => {
                            const pcs = Math.max(2, editingPacket.pieces || 2);
                            const cur = getEditingStoneDetails();
                            const avg = Number(((editingPacket.weight || 0) / pcs).toFixed(3));
                            const next = [...cur];
                            while (next.length < pcs) {
                              next.push({
                                id: `st-${next.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
                                variety: editingPacket.particulars || "",
                                shape: editingPacket.shape || "Oval",
                                weight: avg,
                                mm_size: editingPacket.mm_size || "",
                              });
                            }
                            updateEditingStones(next.slice(0, pcs));
                          }}
                        >
                          Multiple Stones ({(editingPacket.pieces || 1) > 1 ? editingPacket.pieces : 2}+ pcs)
                        </button>
                      </div>
                    )}

                    {/* View Mode Toggle: Full Customization vs Quick Weights */}
                    {getEditingStoneDetails().length > 0 && (
                      <div style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 2 }}>
                        <button
                          type="button"
                          style={{
                            padding: "3px 8px",
                            fontSize: 10.5,
                            fontWeight: 700,
                            borderRadius: 4,
                            border: "none",
                            cursor: "pointer",
                            background: stoneEditMode === "custom" ? "var(--secondary, #3b82f6)" : "transparent",
                            color: stoneEditMode === "custom" ? "#fff" : "var(--on-surface-2)",
                            transition: "all 0.15s ease",
                          }}
                          onClick={() => setStoneEditMode("custom")}
                          title="Customize Variety, Shape, Weight & Dimensions for each stone"
                        >
                          🎨 Customize Stones
                        </button>
                        <button
                          type="button"
                          style={{
                            padding: "3px 8px",
                            fontSize: 10.5,
                            fontWeight: 700,
                            borderRadius: 4,
                            border: "none",
                            cursor: "pointer",
                            background: stoneEditMode === "compact" ? "var(--secondary, #3b82f6)" : "transparent",
                            color: stoneEditMode === "compact" ? "#fff" : "var(--on-surface-2)",
                            transition: "all 0.15s ease",
                          }}
                          onClick={() => setStoneEditMode("compact")}
                          title="Quick weight numbers only"
                        >
                          ⚡ Quick Weights
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--on-surface-2)" }}>
                    Total: <strong style={{ color: "var(--on-surface)" }}>{editingPacket.pieces || 1} pcs</strong> •{" "}
                    <strong style={{ color: "var(--primary)" }}>{editingPacket.weight || 0} {editingPacket.unit || "cts"}</strong>
                    {(editingPacket.pieces || 1) > 1 && editingPacket.weight ? (
                      <span style={{ color: "var(--muted)" }}>
                        {" "}(avg {((editingPacket.weight || 0) / (editingPacket.pieces || 1)).toFixed(2)} ct/pc)
                      </span>
                    ) : null}
                  </div>
                </div>

                {getEditingStoneDetails().length === 0 ? (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "var(--surface)",
                      border: "1px dashed var(--border)",
                      borderRadius: 6,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--on-surface)" }}>
                        ⚖️ No individual stone weight added (Default)
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                        Total weight ({editingPacket.weight || 0} {editingPacket.unit || "cts"}) is tracked collectively across {editingPacket.pieces || 1} piece(s). Click below if you wish to record individual weights per stone.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      style={{ fontWeight: 700, padding: "5px 12px" }}
                      onClick={() => {
                        const pcs = Math.max(1, editingPacket.pieces || 1);
                        const avg = Number(((editingPacket.weight || 0) / pcs).toFixed(3));
                        const initialDetails = Array.from({ length: pcs }).map((_, i) => ({
                          id: `st-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
                          variety: editingPacket.particulars || "",
                          shape: editingPacket.shape || "Oval",
                          weight: avg,
                          mm_size: editingPacket.mm_size || "",
                        }));
                        updateEditingStones(initialDetails);
                      }}
                    >
                      + Add Individual Stone Weights ({editingPacket.pieces || 1} pcs)
                    </button>
                  </div>
                ) : (
                  <>

                {/* Multi-stone Controls */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, borderTop: "1px dashed var(--border)", paddingTop: 8 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={() => {
                        const cur = getEditingStoneDetails();
                        const defaultWt = editingPacket.stone_weight && editingPacket.stone_weight > 0 ? editingPacket.stone_weight : 0;
                        cur.push({
                          id: `st-${cur.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
                          variety: editingPacket.particulars || "",
                          shape: editingPacket.shape || "Oval",
                          weight: defaultWt,
                          mm_size: editingPacket.mm_size || "",
                        });
                        updateEditingStones(cur);
                      }}
                      title="Add a single new customizable stone to this packet"
                    >
                      + Add Individual Stone
                    </button>

                    <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => {
                          const count = Math.max(1, batchAddCount || 1);
                          const cur = getEditingStoneDetails();
                          const defaultWt = editingPacket.stone_weight && editingPacket.stone_weight > 0 ? editingPacket.stone_weight : 0;
                          for (let i = 0; i < count; i++) {
                            cur.push({
                              id: `st-${cur.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
                              variety: editingPacket.particulars || "",
                              shape: editingPacket.shape || "Oval",
                              weight: defaultWt,
                              mm_size: editingPacket.mm_size || "",
                            });
                          }
                          updateEditingStones(cur);
                        }}
                        title={`Add ${batchAddCount} stones at once`}
                      >
                        + Add Multiple ({batchAddCount}) Stones
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        style={{ width: 44, padding: "2px 4px", fontSize: 11, textAlign: "center" }}
                        className="input"
                        value={batchAddCount}
                        onChange={(e) => setBatchAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                        title="Number of stones to batch add"
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{ fontSize: 11, color: "var(--primary)" }}
                      onClick={() => {
                        const cur = getEditingStoneDetails();
                        const updated = cur.map((st) => ({
                          ...st,
                          variety: editingPacket.particulars || st.variety,
                          shape: editingPacket.shape || st.shape,
                        }));
                        updateEditingStones(updated);
                        show("All stones set to packet variety & shape defaults!", "info");
                      }}
                      title="Set all stones' variety and shape to match the packet's main specifications"
                    >
                      📋 Match Packet Defaults
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => {
                        const cur = getEditingStoneDetails();
                        const pcs = cur.length || 1;
                        const avg = Number(((editingPacket.weight || 0) / pcs).toFixed(3));
                        const updated = cur.map((st) => ({ ...st, weight: avg }));
                        updateEditingStones(updated);
                      }}
                      title="Distribute total weight equally across all pieces"
                    >
                      Even Split
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => {
                        const cur = getEditingStoneDetails();
                        const sum = Number(cur.reduce((a, b) => a + (Number(b.weight) || 0), 0).toFixed(2));
                        if (sum > 0) {
                          const pRate = editingPacket.purchase_rate_per_unit || 0;
                          const sRate = editingPacket.sale_rate_per_unit || 0;
                          setEditingPacket({
                            ...editingPacket,
                            weight: sum,
                            purchase_price: Math.round(pRate * sum),
                            sale_price: Math.round(sRate * sum),
                          });
                        }
                      }}
                      title="Sum all stone weights and update total packet weight"
                    >
                      Sum to Total ({getEditingStoneDetails().reduce((a, b) => a + (Number(b.weight) || 0), 0).toFixed(2)} cts)
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{ color: "var(--danger)", fontSize: 11 }}
                      onClick={() => updateEditingStones([])}
                      title="Clear individual weights and use total packet weight only"
                    >
                      ✕ Clear Individual Weights
                    </button>
                  </div>
                </div>

                {/* Quick paste comma-separated weights */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", fontWeight: 700 }}>
                    Quick paste weights:
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ fontSize: 11, padding: "3px 8px", flex: 1 }}
                    placeholder="e.g. 0.55, 0.48, 0.60, 0.52 (comma separated)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const target = e.target as HTMLInputElement;
                        const parsed = target.value
                          .split(/[\s,]+/)
                          .map((v) => parseFloat(v))
                          .filter((v) => !isNaN(v) && v > 0);
                        if (parsed.length > 0) {
                          const cur = getEditingStoneDetails();
                          const updated: GemStoneDetail[] = parsed.map((wt, idx) => ({
                            id: cur[idx]?.id || `st-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
                            variety: cur[idx]?.variety || editingPacket.particulars || "",
                            shape: cur[idx]?.shape || editingPacket.shape || "Oval",
                            weight: wt,
                            mm_size: cur[idx]?.mm_size || editingPacket.mm_size || "",
                          }));
                          updateEditingStones(updated);
                          target.value = "";
                        }
                      }
                    }}
                  />
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>Press Enter</span>
                </div>

                <datalist id="stone-variety-list">
                  {DEFAULT_VARIETIES.map((v) => (
                    <option key={v} value={v} />
                  ))}
                  {customParticulars.map((cp, i) => (
                    <option key={`cp-${i}`} value={cp} />
                  ))}
                </datalist>

                {/* Stones List / Editor */}
                {stoneEditMode === "custom" ? (
                  /* FULL CUSTOMIZATION: Rich Stones Table */
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto", padding: "2px 0" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "36px 1.4fr 1.1fr 1fr 1.1fr 28px",
                        gap: 6,
                        padding: "4px 8px",
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <span>#</span>
                      <span>Stone Variety / Type</span>
                      <span>Shape / Cut</span>
                      <span>Weight (ct)</span>
                      <span>MM Dimensions</span>
                      <span></span>
                    </div>

                    {getEditingStoneDetails().map((stItem, stIdx) => (
                      <div
                        key={stItem.id || stIdx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "36px 1.4fr 1.1fr 1fr 1.1fr 28px",
                          gap: 6,
                          alignItems: "center",
                          background: "var(--surface)",
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>
                          #{stIdx + 1}
                        </span>

                        <input
                          type="text"
                          className="input"
                          style={{ fontSize: 11, padding: "3px 6px" }}
                          placeholder="Variety (e.g. Ruby)"
                          list="stone-variety-list"
                          value={stItem.variety || ""}
                          onChange={(e) => {
                            const cur = getEditingStoneDetails();
                            cur[stIdx] = { ...cur[stIdx], variety: e.target.value };
                            setEditingPacket({ ...editingPacket, stone_details: cur });
                          }}
                        />

                        <select
                          className="select"
                          style={{ fontSize: 11, padding: "3px 6px" }}
                          value={stItem.shape || "Oval"}
                          onChange={(e) => {
                            const cur = getEditingStoneDetails();
                            cur[stIdx] = { ...cur[stIdx], shape: e.target.value };
                            setEditingPacket({ ...editingPacket, stone_details: cur });
                          }}
                        >
                          {allShapes.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="input"
                          style={{ fontSize: 11, padding: "3px 6px", fontWeight: 700 }}
                          placeholder="ct"
                          value={stItem.weight ?? ""}
                          onChange={(e) => {
                            const cur = getEditingStoneDetails();
                            const val = parseFloat(e.target.value) || 0;
                            cur[stIdx] = { ...cur[stIdx], weight: val };
                            updateEditingStones(cur);
                          }}
                        />

                        <input
                          type="text"
                          className="input"
                          style={{ fontSize: 11, padding: "3px 6px" }}
                          placeholder="e.g. 7.5x5.2 mm"
                          value={stItem.mm_size || ""}
                          onChange={(e) => {
                            const cur = getEditingStoneDetails();
                            cur[stIdx] = { ...cur[stIdx], mm_size: e.target.value };
                            setEditingPacket({ ...editingPacket, stone_details: cur });
                          }}
                        />

                        {getEditingStoneDetails().length > 1 ? (
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              padding: "2px",
                              fontSize: 13,
                              fontWeight: 900,
                              lineHeight: 1,
                            }}
                            title={`Remove stone #${stIdx + 1}`}
                            onClick={() => {
                              const cur = getEditingStoneDetails();
                              cur.splice(stIdx, 1);
                              updateEditingStones(cur);
                            }}
                          >
                            ✕
                          </button>
                        ) : (
                          <span></span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* COMPACT QUICK WEIGHTS MODE */
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 140, overflowY: "auto", padding: "2px 0" }}>
                    {getEditingStoneDetails().map((stItem, stIdx) => {
                      const curWeights = editingPacket.stone_weights || [];
                      const curVal = stItem.weight !== undefined ? stItem.weight : (curWeights[stIdx] ?? "");
                      return (
                        <div
                          key={stItem.id || stIdx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            background: "var(--surface)",
                            padding: "3px 6px",
                            borderRadius: 5,
                            border: "1px solid var(--border)",
                          }}
                        >
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)" }}>#{stIdx + 1}:</span>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            style={{ width: 62, padding: "2px 4px", fontSize: 11, fontWeight: 700 }}
                            className="input"
                            value={curVal}
                            placeholder="ct"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const cur = getEditingStoneDetails();
                              cur[stIdx] = { ...cur[stIdx], weight: val };
                              updateEditingStones(cur);
                            }}
                          />
                          {getEditingStoneDetails().length > 1 && (
                            <button
                              type="button"
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                padding: "0 2px",
                                fontSize: 11,
                                lineHeight: 1,
                                fontWeight: 900,
                              }}
                              title={`Remove stone #${stIdx + 1}`}
                              onClick={() => {
                                const cur = getEditingStoneDetails();
                                cur.splice(stIdx, 1);
                                updateEditingStones(cur);
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

              {/* Purchase Valuation (Password Protected: default 2014) */}
              <div
                style={{
                  background: "var(--surface-sunken)",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                    PURCHASE / COST VALUATION: {!costPriceUnlocked && "🔒 (PROTECTED)"}
                  </div>
                  {!costPriceUnlocked && (
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => {
                        setPasswordInput("");
                        setPasswordError("");
                        setPasswordModalOpen(true);
                      }}
                    >
                      🔓 Enter Password to Edit Cost Price
                    </button>
                  )}
                </div>

                {!costPriceUnlocked ? (
                  <div style={{ fontSize: 12, color: "var(--muted)", padding: "6px 0" }}>
                    🔒 Purchase cost price is password-protected. (Default: 2014). Only asking price is displayed to users.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label className="label" style={{ fontSize: 11 }}>
                        Cost Rate (₹ / {editingPacket.unit === "g" ? "g" : "ct"}):
                      </label>
                      <input
                        type="number"
                        className="input"
                        value={editingPacket.purchase_rate_per_unit || 0}
                        onChange={(e) => {
                          const r = Number(e.target.value) || 0;
                          const wt = editingPacket.weight || 0;
                          setEditingPacket({
                            ...editingPacket,
                            purchase_rate_per_unit: r,
                            purchase_price: Math.round(r * wt),
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label className="label" style={{ fontSize: 11 }}>
                        Total Cost (Aggregate ₹):
                      </label>
                      <input
                        type="number"
                        className="input"
                        style={{ fontWeight: 800 }}
                        value={editingPacket.purchase_price || 0}
                        onChange={(e) => {
                          const tot = Number(e.target.value) || 0;
                          const wt = editingPacket.weight || 0;
                          setEditingPacket({
                            ...editingPacket,
                            purchase_price: tot,
                            purchase_rate_per_unit: wt ? Math.round(tot / wt) : 0,
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label className="label" style={{ fontSize: 11 }}>
                        Purchase Date:
                      </label>
                      <input
                        type="date"
                        className="input"
                        value={editingPacket.purchase_date || ""}
                        onChange={(e) => setEditingPacket({ ...editingPacket, purchase_date: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Asking / Sale Valuation */}
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.04)",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", marginBottom: 6 }}>
                  ASKING / SALE VALUATION:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="label" style={{ fontSize: 11 }}>
                      Asking Rate (₹ / {editingPacket.unit === "g" ? "g" : "ct"}):
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={editingPacket.sale_rate_per_unit || 0}
                      onChange={(e) => {
                        const r = Number(e.target.value) || 0;
                        const wt = editingPacket.weight || 0;
                        setEditingPacket({
                          ...editingPacket,
                          sale_rate_per_unit: r,
                          sale_price: Math.round(r * wt),
                        });
                      }}
                    />
                  </div>

                  <div>
                    <label className="label" style={{ fontSize: 11 }}>
                      Total Asking Price (Aggregate ₹):
                    </label>
                    <input
                      type="number"
                      className="input"
                      style={{ fontWeight: 800, color: "var(--primary)" }}
                      value={editingPacket.sale_price || 0}
                      onChange={(e) => {
                        const tot = Number(e.target.value) || 0;
                        const wt = editingPacket.weight || 0;
                        setEditingPacket({
                          ...editingPacket,
                          sale_price: tot,
                          sale_rate_per_unit: wt ? Math.round(tot / wt) : 0,
                        });
                      }}
                    />
                  </div>

                  <div>
                    <label className="label" style={{ fontSize: 11 }}>
                      Minimum Floor Price (₹):
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={editingPacket.min_sale_price || 0}
                      onChange={(e) => setEditingPacket({ ...editingPacket, min_sale_price: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              {/* Lab, Origin & Treatment */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr", gap: 10 }}>
                <div>
                  <label className="label">Certification Lab:</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. GIA, GRS, IGI..."
                    list="lab-datalist"
                    value={editingPacket.cert_lab || ""}
                    onChange={(e) => setEditingPacket({ ...editingPacket, cert_lab: e.target.value })}
                  />
                  <datalist id="lab-datalist">
                    {customLabs.map((cl, i) => (
                      <option key={i} value={cl} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="label">Lab Report Number:</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. GRS-2026-09144"
                    value={editingPacket.cert_no || ""}
                    onChange={(e) => setEditingPacket({ ...editingPacket, cert_no: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Origin:</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Zambia, Ceylon..."
                    value={editingPacket.origin || ""}
                    onChange={(e) => setEditingPacket({ ...editingPacket, origin: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditPacketModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savePacketMutation.isPending}>
                  {savePacketMutation.isPending ? "Saving..." : editingPacket.id ? "Update Packet" : "Save Packet to Box"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: QUICK MOVE PACKET TO ANOTHER BOX
          ========================================================================= */}
      {movePacketItem && (
        <div className="modal-overlay" onClick={() => setMovePacketItem(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📦</span> Move Packet: {movePacketItem.packet_number}
              </h2>
              <button className="btn-close" onClick={() => setMovePacketItem(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ gap: 14 }}>
              <div style={{ fontSize: 13 }}>
                Currently in: <strong>{movePacketItem.box_name || "General Vault / Unassigned"}</strong>
                <br />
                Stone: <strong>{movePacketItem.particulars} ({movePacketItem.weight} {movePacketItem.unit})</strong>
              </div>

              <div>
                <label className="label" style={{ fontWeight: 700 }}>
                  Select Target Storage Box to Move Stone Into:
                </label>
                <select
                  className="select"
                  style={{ width: "100%", fontWeight: 700 }}
                  value={targetMoveBoxName}
                  onChange={(e) => setTargetMoveBoxName(e.target.value)}
                >
                  {boxes.map((b) => (
                    <option key={b.id} value={b.name}>
                      📦 {b.name}
                    </option>
                  ))}
                  <option value="General Vault / Unassigned">General Vault / Unassigned</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setMovePacketItem(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmMovePacket}
                  disabled={savePacketMutation.isPending}
                >
                  {savePacketMutation.isPending ? "Moving..." : "Confirm Move"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: FULL PACKET DETAILS DOSSIER
          ========================================================================= */}
      {packetDetailsModalItem && (
        <div className="modal-overlay" onClick={() => setPacketDetailsModalItem(null)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>💎</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>
                      Packet #{packetDetailsModalItem.packet_number}
                    </h2>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      style={{ padding: "2px 8px", fontSize: 11, fontWeight: 700 }}
                      onClick={() => handleOpenRenameModal(packetDetailsModalItem)}
                      title="Rename this packet number"
                    >
                      ✏️ Rename
                    </button>
                  </div>
                  <span style={{ fontSize: 13, color: "var(--on-surface-2)", fontWeight: 600 }}>
                    {getPacketVarietyDisplay(packetDetailsModalItem)} • {getPacketShapeDisplay(packetDetailsModalItem)}
                  </span>
                </div>
              </div>
              <button className="btn-close" onClick={() => setPacketDetailsModalItem(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ gap: 16 }}>
              {/* Box Tag & Status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    padding: "6px 12px",
                    background: "var(--surface-sunken)",
                    borderRadius: 6,
                    border: "1.5px solid var(--border)",
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  📦 In Box: {packetDetailsModalItem.box_name || "General Vault / Unassigned"}
                </span>

                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    background:
                      packetDetailsModalItem.status === "in_stock"
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(245, 158, 11, 0.15)",
                    color: packetDetailsModalItem.status === "in_stock" ? "#10b981" : "#f59e0b",
                  }}
                >
                  {packetDetailsModalItem.status.replace("_", " ")}
                </span>
              </div>

              {/* Specification Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  padding: 14,
                  background: "var(--surface-sunken)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--on-surface-2)", fontWeight: 700 }}>Weight & Pieces</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>
                    {packetDetailsModalItem.weight} {packetDetailsModalItem.unit || "cts"} ({packetDetailsModalItem.pieces} pcs)
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, color: "var(--on-surface-2)", fontWeight: 700 }}>Dimensions</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {packetDetailsModalItem.mm_size || "Calibrated"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, color: "var(--on-surface-2)", fontWeight: 700 }}>Origin & Treatment</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {packetDetailsModalItem.origin || "Not specified"} • {packetDetailsModalItem.treatment || "Natural"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, color: "var(--on-surface-2)", fontWeight: 700 }}>Certification Lab</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {packetDetailsModalItem.cert_lab || "Self / None"}{" "}
                    {packetDetailsModalItem.cert_no ? `(#${packetDetailsModalItem.cert_no})` : ""}
                  </div>
                </div>

                {((packetDetailsModalItem.stone_details && packetDetailsModalItem.stone_details.length > 0) ||
                  (packetDetailsModalItem.stone_weights && packetDetailsModalItem.stone_weights.length > 0) ||
                  modalStoneStatuses.length > 0) && (
                  <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
                    <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 800, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <span>
                        💎 Individual Stones Breakdown (
                        <strong style={{ color: "#10b981" }}>
                          {modalStoneStatuses.filter((s) => s.status === "in_stock").length} in stock
                        </strong>
                        {modalStoneStatuses.some((s) => s.status !== "in_stock") && (
                          <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                            {" "}• {modalStoneStatuses.filter((s) => s.status !== "in_stock").length} sold / memo
                          </span>
                        )}
                        ):
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        Current Vault Stock: <strong>{packetDetailsModalItem.weight} {packetDetailsModalItem.unit || "cts"}</strong> ({packetDetailsModalItem.pieces} pcs)
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, maxHeight: 220, overflowY: "auto", padding: "2px" }}>
                      {modalStoneStatuses.map((st, i) => {
                        const isInStock = st.status === "in_stock";
                        const isApproval = st.status === "on_approval";
                        const isSold = st.status === "sold";
                        return (
                          <div
                            key={st.id || i}
                            style={{
                              background: isInStock
                                ? "var(--surface)"
                                : isApproval
                                ? "rgba(245, 158, 11, 0.05)"
                                : "var(--surface-sunken)",
                              border: isInStock
                                ? "1.5px solid rgba(16, 185, 129, 0.45)"
                                : isApproval
                                ? "1.5px dashed rgba(245, 158, 11, 0.6)"
                                : "1px solid var(--border)",
                              borderRadius: 6,
                              padding: "7px 9px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 3,
                              opacity: isSold ? 0.78 : 1,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: 800, fontSize: 11.5, color: isInStock ? "var(--primary)" : isApproval ? "#d97706" : "var(--muted)" }}>
                                #{st.stoneNumber} {st.variety}
                              </span>
                              <span style={{ fontWeight: 800, fontSize: 12, color: "var(--on-surface)" }}>
                                {Number(st.weight || 0).toFixed(2)} ct
                              </span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10.5 }}>
                              <span style={{ background: "var(--surface-sunken)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--border)", color: "var(--on-surface-2)" }}>
                                {st.shape}
                              </span>
                              {isInStock ? (
                                <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "1px 6px", borderRadius: 4, fontWeight: 800, fontSize: 9.5 }}>
                                  ● IN STOCK
                                </span>
                              ) : isApproval ? (
                                <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#d97706", padding: "1px 6px", borderRadius: 4, fontWeight: 800, fontSize: 9.5 }} title={st.saleRef ? `Memo #${st.saleRef.invoice_no} (${st.saleRef.buyer_name})` : "On Approval"}>
                                  MEMO {st.saleRef?.invoice_no ? `(${st.saleRef.invoice_no})` : ""}
                                </span>
                              ) : (
                                <span style={{ background: "rgba(100, 116, 139, 0.15)", color: "#64748b", padding: "1px 6px", borderRadius: 4, fontWeight: 800, fontSize: 9.5 }} title={st.saleRef ? `Sold: ${st.saleRef.invoice_no} to ${st.saleRef.buyer_name}` : "Sold"}>
                                  SOLD {st.saleRef?.invoice_no ? `(${st.saleRef.invoice_no})` : ""}
                                </span>
                              )}
                            </div>

                            {!isInStock && st.saleRef?.buyer_name && (
                              <div style={{ fontSize: 9.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {isApproval ? "Memo to: " : "Sold to: "}
                                <strong style={{ color: "var(--foreground)" }}>{st.saleRef.buyer_name}</strong>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Valuation Details */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--on-surface-2)", fontWeight: 800, textTransform: "uppercase" }}>Purchase Valuation</div>
                    {!costPriceUnlocked && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        style={{ fontSize: 10, padding: "1px 4px", color: "var(--primary)" }}
                        onClick={() => {
                          setPasswordInput("");
                          setPasswordError("");
                          setPasswordModalOpen(true);
                        }}
                      >
                        🔒 Unlock
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "var(--on-surface)" }}>
                    {costPriceUnlocked ? formatINR(packetDetailsModalItem.purchase_price) : "🔒 ••••••"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--on-surface-2)", fontWeight: 600 }}>
                    {costPriceUnlocked
                      ? `₹${Math.round(packetDetailsModalItem.purchase_rate_per_unit || 0)} / ${packetDetailsModalItem.unit || "ct"}`
                      : "Password protected"}
                  </div>
                </div>

                <div style={{ padding: 12, background: "rgba(16, 185, 129, 0.08)", borderRadius: 8, border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                  <div style={{ fontSize: 11, color: "#10b981", fontWeight: 800, textTransform: "uppercase" }}>Asking Valuation</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#10b981" }}>
                    {formatINR(packetDetailsModalItem.sale_price)}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--on-surface-2)", fontWeight: 600 }}>
                    ₹{Math.round(packetDetailsModalItem.sale_rate_per_unit || 0)} / ${packetDetailsModalItem.unit || "ct"}
                  </div>
                </div>
              </div>

              {/* Realization & Past Sales History */}
              <div style={{ marginTop: 4, padding: 14, background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📜</span> Past Sales & Realization History
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: totalPcsSold > 0 ? "rgba(16, 185, 129, 0.15)" : "var(--surface-sunken)",
                        color: totalPcsSold > 0 ? "#10b981" : "var(--muted)",
                      }}
                    >
                      Sold: {totalPcsSold} pcs ({totalCaratsSold.toFixed(2)} cts)
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: "rgba(59, 130, 246, 0.1)",
                        color: "#2563eb",
                      }}
                    >
                      Realized: {formatINR(totalSoldRevenue)}
                    </span>
                  </div>
                </div>

                {matchingSalesHistory.length === 0 ? (
                  <div style={{ padding: "14px 12px", textAlign: "center", color: "var(--muted)", fontSize: 12, background: "var(--surface-sunken)", borderRadius: 6 }}>
                    No stones sold from this packet yet. Full balance ({packetDetailsModalItem.pieces} pcs / {packetDetailsModalItem.weight} {packetDetailsModalItem.unit || "cts"}) is available in vault stock.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", maxHeight: 200, overflowY: "auto" }}>
                    <table className="table" style={{ width: "100%", fontSize: 11.5 }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Invoice / Ref</th>
                          <th>Buyer Name</th>
                          <th>Stone Sold</th>
                          <th style={{ textAlign: "center" }}>Pcs Sold</th>
                          <th style={{ textAlign: "right" }}>Carats Sold</th>
                          <th style={{ textAlign: "right" }}>Rate (₹/unit)</th>
                          <th style={{ textAlign: "right" }}>Total Amount</th>
                          <th style={{ textAlign: "center" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchingSalesHistory.map((sh, sIdx) => (
                          <tr key={sIdx}>
                            <td>{sh.date}</td>
                            <td style={{ fontWeight: 700, color: "var(--primary)" }}>{sh.invoice_no}</td>
                            <td style={{ fontWeight: 600 }}>{sh.buyer_name}</td>
                            <td style={{ fontWeight: 700, color: "var(--foreground)" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span>💎</span>
                                <span>{sh.stone_display || sh.particulars}</span>
                              </span>
                            </td>
                            <td style={{ textAlign: "center", fontWeight: 700 }}>{sh.pieces}</td>
                            <td style={{ textAlign: "right", fontWeight: 700 }}>{sh.weight}</td>
                            <td style={{ textAlign: "right" }}>₹{Math.round(sh.rate_per_unit).toLocaleString("en-IN")}</td>
                            <td style={{ textAlign: "right", fontWeight: 800 }}>{formatINR(sh.total_price)}</td>
                            <td style={{ textAlign: "center" }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: 8,
                                  background:
                                    sh.is_approval && sh.approval_status !== "approved_billed"
                                      ? "rgba(245, 158, 11, 0.15)"
                                      : sh.approval_status === "returned"
                                      ? "rgba(100, 116, 139, 0.15)"
                                      : "rgba(16, 185, 129, 0.15)",
                                  color:
                                    sh.is_approval && sh.approval_status !== "approved_billed"
                                      ? "#f59e0b"
                                      : sh.approval_status === "returned"
                                      ? "#64748b"
                                      : "#10b981",
                                }}
                              >
                                {sh.is_approval && sh.approval_status !== "approved_billed"
                                  ? "APPROVAL"
                                  : sh.approval_status === "returned"
                                  ? "RETURNED"
                                  : "SOLD"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="modal-footer" style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setMovePacketItem(packetDetailsModalItem);
                    setTargetMoveBoxName(packetDetailsModalItem.box_name || "");
                  }}
                >
                  📦 Move to Another Box
                </button>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleOpenRenameModal(packetDetailsModalItem)}
                    title="Rename packet identifier"
                  >
                    🏷️ Rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setSelectedForQr(packetDetailsModalItem);
                    }}
                  >
                    🏷️ Print QR Slip
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ borderColor: "var(--primary)", color: "var(--primary)", fontWeight: 700 }}
                    onClick={() => {
                      const item = packetDetailsModalItem;
                      setPacketDetailsModalItem(null);
                      handleEditPacket(item);
                    }}
                    title="Add, edit or distribute individual & multiple stones"
                  >
                    💎 Manage Stones
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const item = packetDetailsModalItem;
                      setPacketDetailsModalItem(null);
                      handleEditPacket(item);
                    }}
                  >
                    ✏️ Edit Packet
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: RENAME PACKET NUMBER (Safe Cascading Identifier Update)
          ========================================================================= */}
      {renameModalPacket && (
        <div className="modal-overlay" onClick={() => setRenameModalPacket(null)}>
          <div className="modal" style={{ maxWidth: 440, width: "95%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🏷️</span>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>Rename Packet Number</h2>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    In {renameModalPacket.box_name || "General Vault"}
                  </span>
                </div>
              </div>
              <button className="btn-close" onClick={() => setRenameModalPacket(null)}>
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!renameNewNumber.trim()) {
                  show("Packet number cannot be empty", "error");
                  return;
                }
                const targetBox = renameModalPacket.box_name || "General Vault / Unassigned";
                const isDuplicate = packets.some(
                  (p) =>
                    p.id !== renameModalPacket.id &&
                    normalizeBoxName(p.box_name) === normalizeBoxName(targetBox) &&
                    p.packet_number.trim().toLowerCase() === renameNewNumber.trim().toLowerCase()
                );
                if (isDuplicate) {
                  show(
                    `Packet #${renameNewNumber.trim()} already exists in "${targetBox}"! Packet numbers must be unique within the same box.`,
                    "error"
                  );
                  return;
                }
                renamePacketMutation.mutate({
                  packetId: renameModalPacket.id,
                  newPacketNumber: renameNewNumber.trim(),
                });
              }}
            >
              <div className="modal-body" style={{ gap: 14 }}>
                <div
                  style={{
                    background: "var(--surface-sunken)",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 12.5,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div>
                    <strong>Current Identifier:</strong>{" "}
                    <span style={{ color: "var(--primary)", fontWeight: 800 }}>
                      {renameModalPacket.packet_number}
                    </span>
                  </div>
                  <div>
                    <strong>Variety:</strong> {renameModalPacket.particulars} ({renameModalPacket.weight}{" "}
                    {renameModalPacket.unit || "cts"})
                  </div>
                  <div>
                    <strong>Assigned Box:</strong> {renameModalPacket.box_name || "General Vault / Unassigned"}
                  </div>
                </div>

                <div>
                  <label className="label" style={{ fontWeight: 800 }}>
                    New Packet Number / Identifier*
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    className="input"
                    style={{ fontSize: 15, fontWeight: 800 }}
                    placeholder="e.g. EM-101, ex/101, PKT-99, RUB-01"
                    value={renameNewNumber}
                    onChange={(e) => setRenameNewNumber(e.target.value)}
                  />
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "var(--on-surface-2)",
                      marginTop: 6,
                      display: "block",
                      fontWeight: 600,
                    }}
                  >
                    💡 Renaming updates this packet within this box and automatically keeps all sales,
                    invoices, and procurement history seamlessly connected.
                  </span>
                </div>

                <div className="modal-footer" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setRenameModalPacket(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={renamePacketMutation.isPending}
                    style={{ fontWeight: 800 }}
                  >
                    {renamePacketMutation.isPending ? "Renaming..." : "Save New Packet #"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: REVEAL COST PRICE PASSWORD MODAL (Default: 2014)
          ========================================================================= */}
      {passwordModalOpen && (
        <div className="modal-overlay" onClick={() => setPasswordModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>🔒</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Unlock Cost Prices</h3>
                  <span style={{ fontSize: 12, color: "var(--on-surface-2)" }}>Protected Inventory Access</span>
                </div>
              </div>
              <button className="btn-close" onClick={() => setPasswordModalOpen(false)}>
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyPasswordMutation.mutate(passwordInput);
              }}
            >
              <div className="modal-body" style={{ gap: 14 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.45 }}>
                  Enter the cost price password to reveal purchase rates, acquisition totals, and margins. (Default password: <strong>2014</strong>).
                </p>

                <div>
                  <label className="label" style={{ fontWeight: 800 }}>Master Password*</label>
                  <input
                    type="password"
                    autoFocus
                    required
                    className="input"
                    style={{ fontSize: 16, letterSpacing: 2 }}
                    placeholder="Enter cost password..."
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError("");
                    }}
                  />
                  {passwordError && (
                    <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                      ⚠️ {passwordError}
                    </div>
                  )}
                </div>

                <div className="modal-footer" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPasswordModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={verifyPasswordMutation.isPending}
                    style={{ fontWeight: 800 }}
                  >
                    {verifyPasswordMutation.isPending ? "Verifying..." : "🔓 Unlock Cost Prices"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 7: CHANGE COST PRICE PASSWORD MODAL
          ========================================================================= */}
      {changePasswordModalOpen && (
        <div className="modal-overlay" onClick={() => setChangePasswordModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>⚙️</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Change Cost Password</h3>
                  <span style={{ fontSize: 12, color: "var(--on-surface-2)" }}>Update Master Password</span>
                </div>
              </div>
              <button className="btn-close" onClick={() => setChangePasswordModalOpen(false)}>
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPasswordInput.trim()) {
                  show("Please enter a new password", "warning");
                  return;
                }
                updatePasswordMutation.mutate(newPasswordInput.trim());
              }}
            >
              <div className="modal-body" style={{ gap: 14 }}>
                <div>
                  <label className="label" style={{ fontWeight: 800 }}>New Cost Price Password*</label>
                  <input
                    type="password"
                    autoFocus
                    required
                    className="input"
                    style={{ fontSize: 15 }}
                    placeholder="Enter new password (e.g. 2014)"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                  />
                </div>

                <div className="modal-footer" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setChangePasswordModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={updatePasswordMutation.isPending}
                    style={{ fontWeight: 800 }}
                  >
                    {updatePasswordMutation.isPending ? "Saving..." : "Save Password"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 8: CUSTOM GEMSTONE SHAPES MANAGEMENT
          ========================================================================= */}
      {shapeModalOpen && (
        <div className="modal-overlay" onClick={() => setShapeModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>✨</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Gemstone Shapes Catalog</h3>
                  <span style={{ fontSize: 12, color: "var(--on-surface-2)" }}>Customizable Gem Cuts ({allShapes.length} Shapes)</span>
                </div>
              </div>
              <button className="btn-close" onClick={() => setShapeModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ gap: 16 }}>
              {/* Add New Shape */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newShapeName.trim()) {
                    show("Please enter shape name", "warning");
                    return;
                  }
                  saveCustomShapeMutation.mutate(newShapeName.trim());
                }}
                style={{ display: "flex", gap: 8 }}
              >
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Kite, Shield, Hexagon, Octagon, Rose Cut..."
                  value={newShapeName}
                  onChange={(e) => setNewShapeName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saveCustomShapeMutation.isPending}
                  style={{ whiteSpace: "nowrap", fontWeight: 800 }}
                >
                  + Add Shape
                </button>
              </form>

              {/* Shapes List */}
              <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 8, padding: 4 }}>
                {allShapes.map((shape) => {
                  const isCustom = customShapes.includes(shape);
                  return (
                    <span
                      key={shape}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 10px",
                        borderRadius: 6,
                        background: isCustom ? "rgba(139, 92, 246, 0.12)" : "var(--surface-sunken)",
                        border: isCustom ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid var(--border)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: isCustom ? "#8b5cf6" : "var(--foreground)",
                      }}
                    >
                      {shape}
                      {isCustom && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          style={{ padding: "0 2px", fontSize: 11, color: "#ef4444" }}
                          onClick={() => deleteCustomShapeMutation.mutate(shape)}
                          title={`Remove custom shape "${shape}"`}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>

              <div className="modal-footer" style={{ marginTop: 4 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShapeModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Packet QR Modal */}
      {selectedForQr && (
        <PacketQrModal
          packet={selectedForQr}
          open={!!selectedForQr}
          onClose={() => setSelectedForQr(null)}
        />
      )}
    </div>
  );
}
