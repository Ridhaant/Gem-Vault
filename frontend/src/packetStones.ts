import type { GemPacket, GemSale, GemSaleItem } from "./types/gemstone";

export type StoneStatus = "in_stock" | "sold" | "on_approval" | "in_invoice";

export interface StoneStatusDetail {
  id: string;
  variety: string;
  shape: string;
  weight: number;
  mm_size?: string;
  notes?: string;
  status: StoneStatus;
  originalIndex: number;
  stoneNumber: number;
  saleRef?: {
    invoice_no: string;
    buyer_name: string;
    date: string;
    is_approval?: boolean;
    approval_status?: string;
    pieces?: number;
    weight?: number;
    rate_per_unit?: number;
    total_price?: number;
  };
}

/**
 * Checks if a variety string is generic/empty (e.g., "Mixed", "Gemstone", "Stone", or equals the packet's generic particulars).
 */
export function isGenericVariety(variety?: string, packetParticulars?: string): boolean {
  if (!variety || !variety.trim()) return true;
  const v = variety.trim().toLowerCase();
  const p = (packetParticulars || "").trim().toLowerCase();
  if (v === "mixed" || v === "gemstone" || v === "stone" || v === "gems") return true;
  if (p === "mixed" && v === p) return true;
  if (p.startsWith("mixed") && v === p) return true;
  return false;
}

/**
 * Parses variety and shape from item particulars description string.
 * Examples:
 * - "Ruby (Oval)" -> variety: "Ruby", shape: "Oval"
 * - "Ruby (Burmese Pigeon Blood) (Oval)" -> variety: "Ruby (Burmese Pigeon Blood)", shape: "Oval"
 * - "Blue Sapphire (Ceylon)" -> variety: "Blue Sapphire (Ceylon)", shape: fallbackShape
 */
export function parseParticularsVariety(
  particulars?: string,
  fallbackShape = "Oval"
): { variety: string; shape: string } {
  if (!particulars || !particulars.trim()) {
    return { variety: "", shape: fallbackShape };
  }
  const clean = particulars.trim();

  // Pattern: "Ruby (Burmese Pigeon Blood) (Oval)" or "Ruby (Oval)"
  const shapeMatch = clean.match(
    /^(.*?)(?:\s*\((Round|Oval|Cushion|Emerald Cut|Pear|Marquise|Princess|Heart|Trilliant|Baguette|Asscher|Radiant|Cabochon|Mixed Shapes|Mixed|Calibrated)\))?$/i
  );
  if (shapeMatch && shapeMatch[2]) {
    const rawVar = shapeMatch[1].trim();
    return {
      variety: rawVar || clean,
      shape: shapeMatch[2].trim(),
    };
  }

  // General parenthesis at the end: e.g. "Pink Sapphire (Heart)"
  const genMatch = clean.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (genMatch) {
    return {
      variety: genMatch[1].trim() || clean,
      shape: genMatch[2].trim() || fallbackShape,
    };
  }

  return { variety: clean, shape: fallbackShape };
}

/**
 * Resolves the inventory/sales status for each individual stone in packet.stone_details (or stone_weights).
 * Accurately tracks which stones are in stock vs sold / on approval in past transactions,
 * or currently allocated in the active invoice form.
 *
 * Restores and protects actual stone varieties (e.g. Ruby, Blue Sapphire, Yellow Sapphire)
 * instead of falling back to generic "Mixed".
 */
export function resolvePacketStoneStatuses(
  packet: GemPacket | null | undefined,
  allSales: GemSale[],
  currentFormItems: GemSaleItem[] = [],
  excludeSaleId?: string
): StoneStatusDetail[] {
  if (!packet) return [];

  const details = Array.isArray(packet.stone_details) ? packet.stone_details : [];
  const weights = Array.isArray(packet.stone_weights) ? packet.stone_weights : [];

  let rawStones: any[] = [];
  if (details.length >= weights.length && details.length > 0) {
    rawStones = details.map((d, i) => ({ ...d, id: d.id || `st-${i + 1}` }));
  } else if (weights.length > 0) {
    // If weights array has more items than details (e.g. details was previously truncated),
    // retain known details and synthesize the remainder from weights
    rawStones = weights.map((wt, i) => {
      if (details[i]) {
        return {
          id: details[i].id || `st-${i + 1}`,
          variety: details[i].variety || packet.particulars,
          shape: details[i].shape || packet.shape || "Oval",
          weight: details[i].weight ?? wt,
          mm_size: details[i].mm_size || packet.mm_size || "",
          notes: details[i].notes || "",
        };
      }
      return {
        id: `st-${i + 1}`,
        variety: packet.particulars,
        shape: packet.shape || "Oval",
        weight: Number(wt) || 0,
        mm_size: packet.mm_size || "",
        notes: "",
      };
    });
  } else if (details.length > 0) {
    rawStones = details.map((d, i) => ({ ...d, id: d.id || `st-${i + 1}` }));
  } else if (typeof packet.pieces === "number" && packet.pieces > 0) {
    const singleWt = packet.stone_weight || (packet.weight ? Number((packet.weight / packet.pieces).toFixed(2)) : 0);
    rawStones = Array.from({ length: packet.pieces }, (_, i) => ({
      id: `st-${i + 1}`,
      variety: packet.particulars,
      shape: packet.shape || "Oval",
      weight: singleWt,
      mm_size: packet.mm_size || "",
      notes: "",
    }));
  }

  if (rawStones.length === 0) return [];

  const results: StoneStatusDetail[] = rawStones.map((st, idx) => ({
    id: st.id || `stone-${idx + 1}`,
    variety: st.variety || packet.particulars || "Gemstone",
    shape: st.shape || packet.shape || "Oval",
    weight: Number(st.weight) || 0,
    mm_size: st.mm_size || packet.mm_size || "",
    notes: st.notes || "",
    status: "in_stock" as StoneStatus,
    originalIndex: idx,
    stoneNumber: idx + 1,
    saleRef: undefined,
  }));

  // Check if packet particulars has a list of varieties like "Mixed (Mixed: Ruby, Ruby (Burmese Pigeon Blood), Blue Sapphire...)"
  const mixMatch = (packet.particulars || "").match(/Mixed(?:\s*\((?:Mixed:\s*)?|\s*:\s*)([^)]+)\)?/i);
  if (mixMatch && mixMatch[1]) {
    const parts = mixMatch[1].split(",").map((s) => s.replace(/\.\.\.$/, "").trim()).filter(Boolean);
    parts.forEach((pVar, idx) => {
      if (results[idx] && isGenericVariety(results[idx].variety, packet.particulars)) {
        results[idx].variety = pVar;
      }
    });
  }

  // Collect sales entries for this packet
  const matchingSaleEntries: Array<{
    sale: GemSale;
    item: GemSaleItem;
    used: boolean;
  }> = [];

  if (Array.isArray(allSales)) {
    for (const sale of allSales) {
      if (excludeSaleId && (sale.id === excludeSaleId || sale.invoice_no === excludeSaleId)) {
        continue;
      }
      // If approval was returned, stones are returned to inventory
      if (sale.approval_status === "returned") {
        continue;
      }
      if (!Array.isArray(sale.items)) continue;
      for (const it of sale.items) {
        if (it.is_returned || (Number(it.pieces) === 0 && Number(it.weight) === 0)) continue;
        if (
          (it.packet_id && it.packet_id === packet.id) ||
          (it.packet_number && it.packet_number.toLowerCase() === packet.packet_number.toLowerCase())
        ) {
          matchingSaleEntries.push({ sale, item: it, used: false });
        }
      }
    }
  }

  // Collect form entries for active invoice
  const matchingFormEntries: Array<{
    item: GemSaleItem;
    used: boolean;
  }> = [];

  if (Array.isArray(currentFormItems)) {
    for (const it of currentFormItems) {
      if (
        (it.packet_id && it.packet_id === packet.id) ||
        (it.packet_number && it.packet_number.toLowerCase() === packet.packet_number.toLowerCase())
      ) {
        matchingFormEntries.push({ item: it, used: false });
      }
    }
  }

  // Pass 1: exact stone_id match in form
  for (const fe of matchingFormEntries) {
    if (fe.used) continue;
    if (fe.item.stone_id) {
      const match = results.find((r) => r.status === "in_stock" && r.id === fe.item.stone_id);
      if (match) {
        match.status = "in_invoice";
        if (isGenericVariety(match.variety, packet.particulars) && fe.item.particulars) {
          const parsed = parseParticularsVariety(fe.item.particulars, fe.item.shape || packet.shape);
          if (!isGenericVariety(parsed.variety, packet.particulars)) {
            match.variety = parsed.variety;
            match.shape = parsed.shape || match.shape;
          }
        }
        fe.used = true;
      }
    }
  }

  // Pass 2: exact stone_id match in past sales
  for (const se of matchingSaleEntries) {
    if (se.used) continue;
    if (se.item.stone_id) {
      const match = results.find((r) => r.status === "in_stock" && r.id === se.item.stone_id);
      if (match) {
        const isAppr = se.sale.is_approval && se.sale.approval_status !== "approved_billed";
        match.status = isAppr ? "on_approval" : "sold";
        match.saleRef = {
          invoice_no: se.sale.invoice_no,
          buyer_name: se.sale.buyer_name,
          date: se.sale.date,
          is_approval: se.sale.is_approval,
          approval_status: se.sale.approval_status,
          pieces: se.item.pieces,
          weight: se.item.weight,
          rate_per_unit: se.item.rate_per_unit,
          total_price: se.item.total_price,
        };
        if (isGenericVariety(match.variety, packet.particulars) && se.item.particulars) {
          const parsed = parseParticularsVariety(se.item.particulars, se.item.shape || packet.shape);
          if (!isGenericVariety(parsed.variety, packet.particulars)) {
            match.variety = parsed.variety;
            match.shape = parsed.shape || match.shape;
          }
        }
        se.used = true;
      }
    }
  }

  // Pass 3: description match in form
  for (const fe of matchingFormEntries) {
    if (fe.used) continue;
    const desc = (fe.item.particulars || "").trim().toLowerCase();
    const parsedDesc = parseParticularsVariety(fe.item.particulars, fe.item.shape || packet.shape);
    const parsedVarLower = parsedDesc.variety.toLowerCase();

    const match = results.find((r) => {
      if (r.status !== "in_stock") return false;
      const rVar = (r.variety || "").trim().toLowerCase();
      if (!isGenericVariety(rVar, packet.particulars)) {
        const full = `${rVar} (${(r.shape || packet.shape).toLowerCase()})`.trim();
        return desc === full || desc === rVar || desc.includes(rVar) || (parsedVarLower && parsedVarLower === rVar);
      }
      return false;
    });

    if (match) {
      match.status = "in_invoice";
      if (isGenericVariety(match.variety, packet.particulars) && !isGenericVariety(parsedDesc.variety, packet.particulars)) {
        match.variety = parsedDesc.variety;
        match.shape = parsedDesc.shape || match.shape;
      }
      fe.used = true;
    }
  }

  // Pass 4: description match in past sales
  for (const se of matchingSaleEntries) {
    if (se.used) continue;
    const desc = (se.item.particulars || "").trim().toLowerCase();
    const parsedDesc = parseParticularsVariety(se.item.particulars, se.item.shape || packet.shape);
    const parsedVarLower = parsedDesc.variety.toLowerCase();

    const match = results.find((r) => {
      if (r.status !== "in_stock") return false;
      const rVar = (r.variety || "").trim().toLowerCase();
      if (!isGenericVariety(rVar, packet.particulars)) {
        const full = `${rVar} (${(r.shape || packet.shape).toLowerCase()})`.trim();
        return desc === full || desc === rVar || desc.includes(rVar) || (parsedVarLower && parsedVarLower === rVar);
      }
      return false;
    });

    if (match) {
      const isAppr = se.sale.is_approval && se.sale.approval_status !== "approved_billed";
      match.status = isAppr ? "on_approval" : "sold";
      match.saleRef = {
        invoice_no: se.sale.invoice_no,
        buyer_name: se.sale.buyer_name,
        date: se.sale.date,
        is_approval: se.sale.is_approval,
        approval_status: se.sale.approval_status,
        pieces: se.item.pieces,
        weight: se.item.weight,
        rate_per_unit: se.item.rate_per_unit,
        total_price: se.item.total_price,
      };
      if (isGenericVariety(match.variety, packet.particulars) && !isGenericVariety(parsedDesc.variety, packet.particulars)) {
        match.variety = parsedDesc.variety;
        match.shape = parsedDesc.shape || match.shape;
      }
      se.used = true;
    }
  }

  // Pass 5: allocate remaining unused sold items by pieces count and heal stone varieties
  for (const se of matchingSaleEntries) {
    if (se.used) continue;
    const pcs = Number(se.item.pieces) || 1;
    let count = 0;
    const parsedDesc = parseParticularsVariety(se.item.particulars, se.item.shape || packet.shape);

    for (const r of results) {
      if (r.status === "in_stock") {
        const isAppr = se.sale.is_approval && se.sale.approval_status !== "approved_billed";
        r.status = isAppr ? "on_approval" : "sold";
        r.saleRef = {
          invoice_no: se.sale.invoice_no,
          buyer_name: se.sale.buyer_name,
          date: se.sale.date,
          is_approval: se.sale.is_approval,
          approval_status: se.sale.approval_status,
          pieces: 1,
          weight: r.weight,
          rate_per_unit: se.item.rate_per_unit,
          total_price: Math.round((Number(se.item.rate_per_unit) || 0) * (r.weight || 0)),
        };
        // Auto-heal stone variety from sale record if currently generic
        if (isGenericVariety(r.variety, packet.particulars) && !isGenericVariety(parsedDesc.variety, packet.particulars)) {
          r.variety = parsedDesc.variety;
          r.shape = parsedDesc.shape || r.shape;
        }
        count++;
        if (count >= pcs) break;
      }
    }
    se.used = true;
  }

  // Pass 6: allocate remaining unused form items by pieces count
  for (const fe of matchingFormEntries) {
    if (fe.used) continue;
    const pcs = Number(fe.item.pieces) || 1;
    let count = 0;
    const parsedDesc = parseParticularsVariety(fe.item.particulars, fe.item.shape || packet.shape);

    for (const r of results) {
      if (r.status === "in_stock") {
        r.status = "in_invoice";
        if (isGenericVariety(r.variety, packet.particulars) && !isGenericVariety(parsedDesc.variety, packet.particulars)) {
          r.variety = parsedDesc.variety;
          r.shape = parsedDesc.shape || r.shape;
        }
        count++;
        if (count >= pcs) break;
      }
    }
    fe.used = true;
  }

  // Pass 7: Consistency clamp with packet.status and packet.pieces
  if (packet.status === "sold" || (packet.pieces !== undefined && packet.pieces <= 0)) {
    for (const r of results) {
      if (r.status === "in_stock") {
        r.status = "sold";
        if (!r.saleRef && packet.buyer_name) {
          r.saleRef = {
            invoice_no: packet.sale_invoice_id || "SOLD",
            buyer_name: packet.buyer_name,
            date: packet.sale_date || "",
          };
        }
      }
    }
  } else if (packet.status === "on_approval") {
    for (const r of results) {
      if (r.status === "in_stock") {
        r.status = "on_approval";
        if (!r.saleRef && packet.memo_party) {
          r.saleRef = {
            invoice_no: "MEMO",
            buyer_name: packet.memo_party,
            date: packet.memo_date || "",
            is_approval: true,
          };
        }
      }
    }
  } else if (typeof packet.pieces === "number" && packet.pieces >= 0) {
    // If the packet has remaining stock pieces specified and there are more in_stock stones than pieces,
    // clamp excess stones so the count of in_stock stones strictly equals packet.pieces
    const inStockList = results.filter((r) => r.status === "in_stock");
    let excessCount = inStockList.length - packet.pieces;
    if (excessCount > 0) {
      for (const r of results) {
        if (r.status === "in_stock" && excessCount > 0) {
          r.status = "sold";
          r.saleRef = r.saleRef || {
            invoice_no: "Past Sale",
            buyer_name: "Previous Buyer",
            date: "",
          };
          excessCount--;
        }
      }
    }
  }

  return results;
}

/**
 * Resolves inventory/sales status for sub_gems
 */
export function resolvePacketSubGemStatuses(
  packet: GemPacket | null | undefined,
  allSales: GemSale[],
  currentFormItems: GemSaleItem[] = [],
  excludeSaleId?: string
): StoneStatusDetail[] {
  if (!packet || !Array.isArray(packet.sub_gems) || packet.sub_gems.length === 0) {
    return [];
  }

  const virtualPacket: GemPacket = {
    ...packet,
    stone_details: packet.sub_gems.map((s, idx) => ({
      id: s.id || `sub-${idx + 1}`,
      variety: s.variety,
      shape: s.shape,
      weight: s.weight,
      mm_size: s.mm_size,
      notes: s.notes,
    })),
  };

  return resolvePacketStoneStatuses(virtualPacket, allSales, currentFormItems, excludeSaleId);
}

/**
 * Enhanced past sales history that pairs each sold item with its specific stone information.
 * Eliminates duplicate stone assignments across rows and displays the true stone name/variety.
 */
export function getPacketSalesHistoryWithStones(
  packet: GemPacket | null | undefined,
  allSales: GemSale[]
): Array<{
  date: string;
  invoice_no: string;
  buyer_name: string;
  pieces: number;
  weight: number;
  rate_per_unit: number;
  total_price: number;
  is_approval?: boolean;
  approval_status?: string;
  particulars: string;
  shape: string;
  stone_id?: string;
  stone_display?: string;
  stone_variety?: string;
  stone_number?: number;
}> {
  if (!packet) return [];

  const stoneStatuses = resolvePacketStoneStatuses(packet, allSales);
  const usedStoneIds = new Set<string>();

  const history: Array<{
    date: string;
    invoice_no: string;
    buyer_name: string;
    pieces: number;
    weight: number;
    rate_per_unit: number;
    total_price: number;
    is_approval?: boolean;
    approval_status?: string;
    particulars: string;
    shape: string;
    stone_id?: string;
    stone_display?: string;
    stone_variety?: string;
    stone_number?: number;
  }> = [];

  for (const sale of allSales) {
    if (sale.approval_status === "returned") continue;
    if (!Array.isArray(sale.items)) continue;
    for (const item of sale.items) {
      if (item.is_returned || (Number(item.pieces) === 0 && Number(item.weight) === 0)) continue;
      if (
        (item.packet_id && item.packet_id === packet.id) ||
        (item.packet_number && item.packet_number.toLowerCase() === packet.packet_number.toLowerCase())
      ) {
        // Priority 1: Match by exact stone_id / sub_gem_id
        let matchedStone = stoneStatuses.find(
          (st) =>
            !usedStoneIds.has(st.id) &&
            ((item.stone_id && st.id === item.stone_id) || (item.sub_gem_id && st.id === item.sub_gem_id))
        );

        // Priority 2: Match by invoice number AND variety/description
        if (!matchedStone) {
          const itemPart = (item.particulars || "").trim().toLowerCase();
          const parsed = parseParticularsVariety(item.particulars, item.shape || packet.shape);
          const parsedVar = parsed.variety.trim().toLowerCase();

          matchedStone = stoneStatuses.find(
            (st) =>
              !usedStoneIds.has(st.id) &&
              st.saleRef?.invoice_no === sale.invoice_no &&
              !isGenericVariety(st.variety, packet.particulars) &&
              (st.variety.toLowerCase() === itemPart ||
                st.variety.toLowerCase() === parsedVar ||
                itemPart.includes(st.variety.toLowerCase()) ||
                st.variety.toLowerCase().includes(itemPart))
          );
        }

        // Priority 3: Match by invoice number (next unused stone allocated to this sale)
        if (!matchedStone) {
          matchedStone = stoneStatuses.find(
            (st) => !usedStoneIds.has(st.id) && st.saleRef?.invoice_no === sale.invoice_no
          );
        }

        // Priority 4: Match by any unused non-in-stock stone
        if (!matchedStone) {
          matchedStone = stoneStatuses.find(
            (st) => !usedStoneIds.has(st.id) && st.status !== "in_stock"
          );
        }

        if (matchedStone) {
          usedStoneIds.add(matchedStone.id);
        }

        // Determine specific variety & shape
        let variety = matchedStone?.variety || "";
        let shape = matchedStone?.shape || item.shape || packet.shape || "Oval";
        const weight = matchedStone?.weight || Number(item.weight) || 0;
        const stoneNum = matchedStone?.stoneNumber;

        if (isGenericVariety(variety, packet.particulars) && item.particulars) {
          const parsed = parseParticularsVariety(item.particulars, shape);
          if (!isGenericVariety(parsed.variety, packet.particulars)) {
            variety = parsed.variety;
            shape = parsed.shape || shape;
          }
        }

        let stoneDisplay = "";
        if (stoneNum && variety && !isGenericVariety(variety, packet.particulars)) {
          stoneDisplay = `Stone #${stoneNum}: ${variety} (${shape}) - ${weight} cts`;
        } else if (stoneNum) {
          stoneDisplay = `Stone #${stoneNum}: ${item.particulars || packet.particulars} (${shape}) - ${weight} cts`;
        } else if (item.particulars && !isGenericVariety(item.particulars, packet.particulars)) {
          stoneDisplay = `${item.particulars} (${shape}) - ${weight} cts`;
        } else {
          stoneDisplay = `${item.pieces || 1} pc (${weight} ${item.unit || packet.unit || "cts"}) • ${variety || packet.particulars}`;
        }

        history.push({
          date: sale.date,
          invoice_no: sale.invoice_no,
          buyer_name: sale.buyer_name,
          pieces: Number(item.pieces) || 1,
          weight: Number(item.weight) || 0,
          rate_per_unit:
            Number(item.rate_per_unit) || (item.weight ? Math.round(item.total_price / item.weight) : 0),
          total_price: Number(item.total_price) || 0,
          is_approval: sale.is_approval,
          approval_status: sale.approval_status,
          particulars: variety || item.particulars || packet.particulars,
          shape: shape,
          stone_id: matchedStone?.id || item.stone_id,
          stone_display: stoneDisplay,
          stone_variety: variety,
          stone_number: stoneNum,
        });
      }
    }
  }

  return history;
}
