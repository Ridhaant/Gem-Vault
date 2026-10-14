// Standard ISO/IEC 18004 QR Code Engine for GemVault
// 100% offline, fully compliant with all phone cameras (iOS/Android) and physical 2D barcode imagers

import { QrCode } from "./qrcodegen.js";
import type { GemPacket } from "./types/gemstone";

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

function getEcc(level: ErrorCorrectionLevel) {
  switch (level) {
    case "L":
      return QrCode.Ecc.LOW;
    case "M":
      return QrCode.Ecc.MEDIUM;
    case "Q":
      return QrCode.Ecc.QUARTILE;
    case "H":
      return QrCode.Ecc.HIGH;
    default:
      return QrCode.Ecc.MEDIUM;
  }
}

export class QREncoder {
  /**
   * Generates a 2D boolean matrix of QR modules
   */
  static encode(text: string, ecLevel: ErrorCorrectionLevel = "M"): boolean[][] {
    const ecc = getEcc(ecLevel);
    const qr = QrCode.encodeText(text, ecc);
    const size = qr.size;
    const matrix: boolean[][] = [];
    for (let y = 0; y < size; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < size; x++) {
        row.push(qr.getModule(x, y));
      }
      matrix.push(row);
    }
    return matrix;
  }

  /**
   * Renders ISO/IEC 18004 QR Code as clean SVG with standard 4-module quiet zone
   */
  static toSVG(text: string, sizePx = 200, margin = 4, ecLevel: ErrorCorrectionLevel = "M"): string {
    const ecc = getEcc(ecLevel);
    const qr = QrCode.encodeText(text, ecc);
    const count = qr.size;
    const quietZone = Math.max(margin, 4); // ISO standard requires minimum 4 modules
    const viewSize = count + quietZone * 2;

    let pathD = "";
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        if (qr.getModule(x, y)) {
          pathD += `M${x + quietZone},${y + quietZone}h1v1h-1z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">
  <rect width="${viewSize}" height="${viewSize}" fill="#ffffff"/>
  <path d="${pathD.trim()}" fill="#000000"/>
</svg>`;
  }

  /**
   * Returns a Data URL for the QR code
   */
  static toDataURL(text: string, sizePx = 200, margin = 4, ecLevel: ErrorCorrectionLevel = "M"): string {
    const svg = QREncoder.toSVG(text, sizePx, margin, ecLevel);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}

export type QrPayloadMode = "document" | "url" | "scanner" | "json" | "phone";

/**
 * Creates scannable payloads optimized for:
 * 1. Phone Cameras (Document Certificate format — no illegal URI colons so Android/iOS display full text without "No usable data")
 * 2. Phone Cameras (Offline Webpage URL Link — taps to open full dossier page on local network/hotspot)
 * 3. Physical 2D Barcode Scanners / Machines (Fast packet identifier)
 * 4. JSON Data
 * 
 * Accurately includes all information and itemized gems, shapes, sizes, and weights for multi-stone boxes/parcels.
 */
export function formatPacketPayload(
  packet: GemPacket,
  mode: QrPayloadMode = "document",
  customHost?: string
): string {
  // 1. Physical 2D Barcode Scanner Gun Mode
  if (mode === "scanner") {
    return packet.packet_number;
  }

  // 2. Offline Webpage URL Link Mode
  if (mode === "url") {
    // Resolve host: either custom LAN IP (e.g. 192.168.0.103:5173), window.location.host, or localhost:5173
    const host =
      customHost?.trim() ||
      (typeof window !== "undefined" && window.location?.host ? window.location.host : "127.0.0.1:5173");
    const protocol = typeof window !== "undefined" && window.location?.protocol ? window.location.protocol : "http:";
    return `${protocol}//${host}/#/packet/${encodeURIComponent(packet.packet_number)}`;
  }

  // 3. Compact JSON Mode
  if (mode === "json") {
    return JSON.stringify({
      pkt: packet.packet_number,
      part: packet.particulars,
      sh: packet.shape,
      wt: packet.weight,
      pcs: packet.pieces,
      mm: packet.mm_size,
      pur: packet.purchase_price,
      p_dt: packet.purchase_date,
      sp: packet.sale_price,
      st: packet.status,
      gems: packet.stone_details && packet.stone_details.length > 0
        ? packet.stone_details.map((s) => ({
            v: s.variety || packet.particulars,
            s: s.shape || packet.shape,
            w: s.weight,
            p: 1,
            mm: s.mm_size || "",
          }))
        : packet.sub_gems?.map((g) => ({
            v: g.variety,
            s: g.shape,
            w: g.weight,
            p: g.pieces,
            mm: g.mm_size,
          })),
    });
  }

  // 4. Document / Phone Camera Format (also default for "phone")
  // CRITICAL: Avoid starting the first line with `<WORD>:` (e.g. "GEMVAULT: ...")
  const buyerInfo =
    packet.buyer_name
      ? `\nBuyer - ${packet.buyer_name}${packet.sale_date ? ` (${packet.sale_date})` : ""}`
      : "";

  const statusLabel =
    packet.status === "in_stock"
      ? "In Stock (Vault)"
      : packet.status === "on_memo"
      ? `On Approval (${packet.memo_party || "Inspection"})`
      : `Sold${packet.sold_price ? ` for Rs ${packet.sold_price.toLocaleString("en-IN")}` : ""}`;

  let multiGemSection = "";
  if (packet.stone_details && packet.stone_details.length > 0) {
    multiGemSection = `\n\nStones Breakdown (${packet.stone_details.length} Stones):\n` +
      packet.stone_details
        .map(
          (s, idx) =>
            `${idx + 1}. ${s.variety || packet.particulars} | ${s.shape || packet.shape} | ${s.weight} cts${s.mm_size ? ` | ${s.mm_size}` : ""}`
        )
        .join("\n");
  } else if (packet.sub_gems && packet.sub_gems.length > 0) {
    multiGemSection = `\n\nBox Gem Breakdown (${packet.sub_gems.length} Varieties):\n` +
      packet.sub_gems
        .map(
          (g, idx) =>
            `${idx + 1}. ${g.variety} | ${g.shape} | ${g.weight} cts (${g.pieces} pc${g.pieces > 1 ? "s" : ""})${g.mm_size ? ` | ${g.mm_size}` : ""}`
        )
        .join("\n");
  }

  const certSection =
    packet.cert_lab && packet.cert_lab !== "Self / None"
      ? `\nLab Certificate - ${packet.cert_lab}${packet.cert_no ? ` (#${packet.cert_no})` : ""}`
      : "";

  return `SHREEJI GEMS GEMSTONE CERTIFICATE
Packet Number - ${packet.packet_number}
Particulars - ${packet.particulars}
Shape - ${packet.shape}
Total Weight - ${packet.weight} cts
Pieces Count - ${packet.pieces} ${packet.pieces === 1 ? "piece" : "pieces"}
Dimensions - ${packet.mm_size || "Not calibrated"}
Purchase Cost - Rs ${packet.purchase_price.toLocaleString("en-IN")} (${packet.purchase_date})
Status - ${statusLabel}${certSection}${buyerInfo}${multiGemSection}`;
}

