import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import { useToast } from "./toast";
import type { GstSettings } from "./types/gemstone";

export function GstSettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { show } = useToast();

  const { data: gstSettings } = useQuery<GstSettings>({
    queryKey: ["gst_settings"],
    queryFn: () => apiGet("/gst-settings"),
    enabled: open,
  });

  const [defaultRate, setDefaultRate] = useState<number>(0.25);
  const [gemstoneHsn, setGemstoneHsn] = useState("7103");
  const [diamondHsn, setDiamondHsn] = useState("7102");
  const [jewelleryHsn, setJewelleryHsn] = useState("7113");
  const [availableRates, setAvailableRates] = useState<number[]>([
    0, 0.25, 1.5, 3.0, 5.0, 12.0, 18.0,
  ]);
  const [newRateInput, setNewRateInput] = useState("");
  const [enableByDefault, setEnableByDefault] = useState(true);

  useEffect(() => {
    if (gstSettings) {
      setDefaultRate(gstSettings.default_rate ?? 0.25);
      setGemstoneHsn(gstSettings.gemstone_hsn || "7103");
      setDiamondHsn(gstSettings.diamond_hsn || "7102");
      setJewelleryHsn(gstSettings.jewellery_hsn || "7113");
      if (gstSettings.available_rates && gstSettings.available_rates.length > 0) {
        setAvailableRates(gstSettings.available_rates);
      }
      setEnableByDefault(gstSettings.enable_gst_by_default ?? true);
    }
  }, [gstSettings]);

  const saveMutation = useMutation({
    mutationFn: (payload: GstSettings) => apiPost("/gst-settings", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gst_settings"] });
      show("GST & HSN settings saved successfully!", "success");
      onClose();
    },
    onError: (err: any) => {
      show("Failed to save GST settings: " + err.message, "error");
    },
  });

  if (!open) return null;

  const handleAddCustomRate = () => {
    const r = parseFloat(newRateInput);
    if (isNaN(r) || r < 0) {
      show("Please enter a valid positive percentage (e.g. 1.25)", "warning");
      return;
    }
    if (availableRates.includes(r)) {
      show(`Rate ${r}% already exists in list`, "info");
      return;
    }
    const updated = [...availableRates, r].sort((a, b) => a - b);
    setAvailableRates(updated);
    setDefaultRate(r);
    setNewRateInput("");
    show(`Added ${r}% to available GST rates`, "success");
  };

  const handleRemoveRate = (rateToRemove: number) => {
    if (availableRates.length <= 1) {
      show("At least one GST rate must remain", "warning");
      return;
    }
    const updated = availableRates.filter((r) => r !== rateToRemove);
    setAvailableRates(updated);
    if (defaultRate === rateToRemove) {
      setDefaultRate(updated[0]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      default_rate: defaultRate,
      available_rates: availableRates,
      gemstone_hsn: gemstoneHsn.trim() || "7103",
      diamond_hsn: diamondHsn.trim() || "7102",
      jewellery_hsn: jewelleryHsn.trim() || "7113",
      enable_gst_by_default: enableByDefault,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 540 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>
              ⚙️ Customize GST Rates & HSN Codes
            </h2>
            <p style={{ color: "var(--on-surface-2)", margin: "4px 0 0", fontSize: 13, fontWeight: 600 }}>
              Configure tax percentages and statutory HSN codes for gemstone, diamond & jewellery sales.
            </p>
          </div>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body" style={{ gap: 16 }}>
          {/* Default Rate Selector */}
          <div>
            <label className="label" style={{ fontWeight: 800 }}>
              Default Applied GST Rate (%)
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {availableRates.map((r) => (
                <button
                  type="button"
                  key={r}
                  className={`btn btn-sm ${
                    defaultRate === r ? "btn-primary" : "btn-outline"
                  }`}
                  onClick={() => setDefaultRate(r)}
                  style={{ minWidth: 64 }}
                >
                  {r}% {defaultRate === r && "✓"}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: "var(--on-surface-2)", marginTop: 6, display: "block", fontWeight: 600 }}>
              Standard for gemstones in India is <strong>0.25%</strong>, and finished jewellery is <strong>3%</strong>.
            </span>
          </div>

          {/* Add custom rate */}
          <div
            style={{
              background: "var(--surface-sunken)",
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <label className="label" style={{ fontSize: 12 }}>
              Add Another Custom GST Rate (%)
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 1.25 or 6.0"
                className="input"
                style={{ flex: 1 }}
                value={newRateInput}
                onChange={(e) => setNewRateInput(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleAddCustomRate}
              >
                + Add Rate
              </button>
            </div>
            {availableRates.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {availableRates.map((r) => (
                  <span
                    key={r}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "var(--surface)",
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 11,
                      border: "1px solid var(--border)",
                    }}
                  >
                    {r}%
                    <button
                      type="button"
                      onClick={() => handleRemoveRate(r)}
                      style={{ color: "var(--muted)", fontSize: 10, cursor: "pointer" }}
                      title="Remove rate"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Statutory HSN Codes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label className="label" style={{ fontSize: 12 }}>
                Gemstones HSN
              </label>
              <input
                type="text"
                required
                className="input"
                value={gemstoneHsn}
                onChange={(e) => setGemstoneHsn(e.target.value)}
              />
              <span style={{ fontSize: 11, color: "var(--on-surface-2)", fontWeight: 600 }}>Precious Gems 7103</span>
            </div>

            <div>
              <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>
                Diamonds HSN
              </label>
              <input
                type="text"
                required
                className="input"
                value={diamondHsn}
                onChange={(e) => setDiamondHsn(e.target.value)}
              />
              <span style={{ fontSize: 11, color: "var(--on-surface-2)", fontWeight: 600 }}>Cut Diamonds 7102</span>
            </div>

            <div>
              <label className="label" style={{ fontSize: 12, fontWeight: 700 }}>
                Jewellery HSN
              </label>
              <input
                type="text"
                required
                className="input"
                value={jewelleryHsn}
                onChange={(e) => setJewelleryHsn(e.target.value)}
              />
              <span style={{ fontSize: 11, color: "var(--on-surface-2)", fontWeight: 600 }}>Articles 7113</span>
            </div>
          </div>

          {/* Enable GST checkbox */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: "var(--surface-sunken)",
              borderRadius: 8,
            }}
          >
            <input
              type="checkbox"
              id="enable_gst_cb"
              checked={enableByDefault}
              onChange={(e) => setEnableByDefault(e.target.checked)}
              style={{ width: 18, height: 18, cursor: "pointer" }}
            />
            <label
              htmlFor="enable_gst_cb"
              style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Apply GST calculation automatically on new sales & invoices
            </label>
          </div>

          <div className="modal-footer" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save GST Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
