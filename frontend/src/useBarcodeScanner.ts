// Shreeji Gems Physical Barcode Scanner & QR Gun Listener Hook
// Intercepts rapid hardware scanner keystrokes (USB/Bluetooth HID) anywhere in the application
// Automatically resolves packet number and opens the complete packet dossier page / modal!

import { useEffect, useRef } from "react";
import { getPacketByNumber } from "./gemstoneStorage";
import type { GemPacket } from "./types/gemstone";

interface UseBarcodeScannerOptions {
  onPacketScanned: (packet: GemPacket) => void;
  onScanError?: (scannedText: string) => void;
  maxInterKeyMs?: number; // Maximum ms between keystrokes to qualify as hardware scanner (default: 60ms)
}

/**
 * Plays a clean, subtle audio confirmation chime using Web Audio API (100% offline)
 */
export function playScannerSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First high tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1760, ctx.currentTime); // A6
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.08);

    // Second higher tone (cheerful confirmation)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(2637, ctx.currentTime + 0.08); // E7
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.2);
  } catch {
    // Audio context not allowed until user gesture or audio disabled
  }
}

export function useBarcodeScanner({
  onPacketScanned,
  onScanError,
  maxInterKeyMs = 60,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const isScannerStreamRef = useRef<boolean>(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore functional modifier keys
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") {
        return;
      }

      const now = performance.now();
      const timeDelta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key marks end of barcode sequence
      if (e.key === "Enter") {
        const rawText = bufferRef.current.trim();
        bufferRef.current = "";

        // Only process if buffer has substantial content and was typed rapidly or matches a packet pattern
        const isRapid = isScannerStreamRef.current;
        isScannerStreamRef.current = false;

        if (rawText.length >= 2) {
          const packet = getPacketByNumber(rawText);
          if (packet) {
            // Intercept Enter so form doesn't submit unexpectedly
            e.preventDefault();
            e.stopPropagation();
            playScannerSuccessChime();
            onPacketScanned(packet);
            return;
          } else if (isRapid && onScanError) {
            onScanError(rawText);
          }
        }
        return;
      }

      // Check speed: hardware scanners emit characters with < 50ms gaps
      if (timeDelta <= maxInterKeyMs) {
        isScannerStreamRef.current = true;
      } else if (timeDelta > 200) {
        // Human pause: clear buffer if pause was long
        bufferRef.current = "";
        isScannerStreamRef.current = false;
      }

      // Append printable single character
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onPacketScanned, onScanError, maxInterKeyMs]);
}
