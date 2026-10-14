import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import { Spinner, EmptyState } from "../ui";
import { formatINR, shortDate } from "../format";
import type { GemAsset } from "../types/gemstone";
import { DEFAULT_COMPANIES } from "../types/gemstone";
import { useToast } from "../toast";
import { verifyAnalyticsPassword } from "../gemstoneStorage";

const ASSET_CATEGORIES = [
  "Vault & Safe",
  "Equipment & Tools",
  "Deposit",
  "Fixed Asset",
  "Vehicle",
  "Other",
] as const;

export default function Assets() {
  const queryClient = useQueryClient();
  const { show } = useToast();

  // Master PIN Security Lock (Requirement: password 2014 on assets & liquid cash)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem("gemvault_assets_unlocked") === "true";
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Partial<GemAsset> | null>(null);

  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [newCashAmount, setNewCashAmount] = useState<number>(0);
  const [cashNote, setCashNote] = useState("");

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [customCatInput, setCustomCatInput] = useState("");

  // Queries (Only fetched when unlocked)
  const { data: assets = [], isLoading: assetsLoading } = useQuery<GemAsset[]>({
    queryKey: ["assets"],
    queryFn: () => apiGet("/assets"),
    enabled: isUnlocked,
  });

  const { data: cashData = { amount: 0 }, isLoading: cashLoading } = useQuery<{ amount: number }>({
    queryKey: ["liquid_cash"],
    queryFn: () => apiGet("/liquid-cash"),
    enabled: isUnlocked,
  });

  const { data: assetCategories = [...ASSET_CATEGORIES] } = useQuery<string[]>({
    queryKey: ["asset_categories"],
    queryFn: () => apiGet("/asset-categories"),
    enabled: isUnlocked,
  });

  const liquidCash = cashData.amount || 0;

  const addAssetCatMutation = useMutation({
    mutationFn: (cat: string) => apiPost("/asset-categories", { name: cat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset_categories"] });
      setCustomCatInput("");
      show("Asset category saved!", "success");
    },
    onError: (err: any) => show("Error adding category: " + err.message, "error"),
  });

  const deleteAssetCatMutation = useMutation({
    mutationFn: (cat: string) => apiDelete(`/asset-categories/${encodeURIComponent(cat)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset_categories"] });
      show("Asset category deleted", "info");
    },
    onError: (err: any) => show("Error deleting category: " + err.message, "error"),
  });

  // Mutations
  const saveAssetMutation = useMutation({
    mutationFn: (asset: any) =>
      asset.id ? apiPut(`/assets/${asset.id}`, asset) : apiPost("/assets", asset),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setAssetModalOpen(false);
      setEditingAsset(null);
      show("Asset saved successfully!", "success");
    },
    onError: (err: any) => show("Error saving asset: " + err.message, "error"),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      show("Asset deleted", "info");
    },
    onError: (err: any) => show("Error deleting asset: " + err.message, "error"),
  });

  const updateCashMutation = useMutation({
    mutationFn: (amount: number) => apiPost("/liquid-cash", { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liquid_cash"] });
      setCashModalOpen(false);
      show("Liquid cash balance updated!", "success");
    },
    onError: (err: any) => show("Error updating cash: " + err.message, "error"),
  });

  // Calculations
  const totalAssetValuation = useMemo(() => {
    return assets.reduce((sum, a) => sum + (a.valuation || 0), 0);
  }, [assets]);

  const filteredAssets = useMemo(() => {
    let result = [...assets];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          (a.notes && a.notes.toLowerCase().includes(q))
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter((a) => a.category === categoryFilter);
    }
    if (companyFilter !== "all") {
      result = result.filter((a) => a.company_name === companyFilter);
    }
    return result;
  }, [assets, searchTerm, categoryFilter, companyFilter]);

  const handleOpenNewAsset = () => {
    setEditingAsset({
      name: "",
      category: "Vault & Safe",
      valuation: 0,
      purchase_date: new Date().toISOString().slice(0, 10),
      company_name: "Shreeji Gems",
      notes: "",
    });
    setAssetModalOpen(true);
  };

  const handleOpenEditAsset = (a: GemAsset) => {
    setEditingAsset({ ...a });
    setAssetModalOpen(true);
  };

  const handleOpenCashModal = () => {
    setNewCashAmount(liquidCash);
    setCashNote("");
    setCashModalOpen(true);
  };

  const handleSaveCash = (e: React.FormEvent) => {
    e.preventDefault();
    updateCashMutation.mutate(Number(newCashAmount) || 0);
  };

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset || !editingAsset.name?.trim()) {
      show("Please enter asset name", "warning");
      return;
    }
    saveAssetMutation.mutate(editingAsset);
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAnalyticsPassword(passwordInput)) {
      setIsUnlocked(true);
      sessionStorage.setItem("gemvault_assets_unlocked", "true");
      setPasswordError(false);
      setPasswordInput("");
      show("Assets & Liquid Cash unlocked", "success");
    } else {
      setPasswordError(true);
      show("Incorrect PIN. Access denied.", "error");
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem("gemvault_assets_unlocked");
    setPasswordInput("");
    show("Assets & Liquid Cash locked", "info");
  };

  // Render Password Lock Screen if not unlocked
  if (!isUnlocked) {
    return (
      <div
        className="page-body"
        style={{
          minHeight: "75vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: 420,
            width: "100%",
            padding: 32,
            textAlign: "center",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            border: "1.5px solid var(--border)",
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 16px",
            }}
          >
            🔒
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 6px" }}>
            Assets &amp; Liquid Cash Protected
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 20px" }}>
            Enter your 4-digit Master Security PIN to view and manage company assets, vaults, and liquid cash reserves.
          </p>

          <form onSubmit={handleUnlock}>
            <div style={{ marginBottom: 16 }}>
              <input
                type="password"
                className="input"
                style={{
                  fontSize: 22,
                  textAlign: "center",
                  letterSpacing: 6,
                  fontWeight: 900,
                  borderColor: passwordError ? "#ef4444" : undefined,
                }}
                placeholder="••••"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                autoFocus
                maxLength={10}
              />
              {passwordError && (
                <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                  ⚠️ Incorrect PIN. Access denied.
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "10px" }}>
              🔓 Unlock Assets &amp; Liquid Cash
            </button>
          </form>

          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 16 }}>
            Privacy guaranteed • 100% offline &amp; stored locally
          </div>
        </div>
      </div>
    );
  }

  if (assetsLoading || cashLoading) {
    return (
      <div className="page-body">
        <Spinner />
      </div>
    );
  }

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
          <h1
            style={{
              fontSize: 24,
              fontWeight: 900,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>🏦</span> Assets &amp; Liquid Cash Management
          </h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 13 }}>
            Track physical vault lockers, gemological equipment, security deposits, and live liquid cash on hand.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleLock}
            title="Lock Assets & Liquid Cash Section"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>🔒</span> Lock Section
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setCatModalOpen(true)}
            title="Customize Asset Categories"
          >
            ⚙️ Asset Categories
          </button>
          <button className="btn btn-outline" onClick={handleOpenCashModal}>
            💵 Adjust Liquid Cash
          </button>
          <button className="btn btn-primary" onClick={handleOpenNewAsset}>
            + Add New Asset
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {/* Liquid Cash Card (Feature Highlight) */}
        <div
          className="card"
          style={{
            padding: "18px 20px",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.15) 100%)",
            border: "1.5px solid rgba(16, 185, 129, 0.35)",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#047857", textTransform: "uppercase", letterSpacing: 0.5 }}>
              💵 Liquid Cash Present (Vault)
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, padding: "2px 8px", color: "#047857" }}
              onClick={handleOpenCashModal}
              title="Edit cash on hand"
            >
              ✏️ Edit Cash
            </button>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#065f46", marginTop: 8 }}>
            {formatINR(liquidCash)}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Available physical cash on hand in office safe & strongroom
          </div>
        </div>

        {/* Physical Assets Valuation */}
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            🏛️ Physical & Business Assets
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--foreground)", marginTop: 8 }}>
            {formatINR(totalAssetValuation)}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {assets.length} registered assets across {DEFAULT_COMPANIES.length} companies
          </div>
        </div>

        {/* Total Capital Holding */}
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            💎 Total Liquid & Asset Capital
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--primary)", marginTop: 8 }}>
            {formatINR(liquidCash + totalAssetValuation)}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Liquid Cash + Registered Physical Equipment & Deposits
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
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
            placeholder="Search assets by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Category:</label>
          <select
            className="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {assetCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Company:</label>
          <select
            className="select"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="all">All 5 Companies</option>
            {DEFAULT_COMPANIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Assets Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filteredAssets.length === 0 ? (
          <EmptyState
            icon="🏦"
            title="No assets found"
            description="Add office safes, carat balances, machinery, or security deposits."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", margin: 0 }}>
              <thead>
                <tr>
                  <th>Asset Name</th>
                  <th>Category</th>
                  <th>Company</th>
                  <th>Purchase Date</th>
                  <th>Valuation (₹)</th>
                  <th>Notes</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{asset.name}</div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "var(--surface)",
                          fontWeight: 600,
                        }}
                      >
                        {asset.category}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {asset.company_name || "Shreeji Gems"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12 }}>
                        {asset.purchase_date ? shortDate(asset.purchase_date) : "—"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, color: "var(--primary)" }}>
                        {formatINR(asset.valuation)}
                      </span>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {asset.notes || "—"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleOpenEditAsset(asset)}
                          title="Edit asset"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: "#ef4444" }}
                          onClick={() => {
                            if (window.confirm(`Delete asset "${asset.name}"?`)) {
                              deleteAssetMutation.mutate(asset.id);
                            }
                          }}
                          title="Delete asset"
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
        )}
      </div>

      {/* Modal: Edit Liquid Cash Present */}
      {cashModalOpen && (
        <div className="modal-backdrop" onClick={() => setCashModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>💵</span> Adjust Liquid Cash Present
              </h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCashModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveCash} style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Current Liquid Cash on Hand (₹):</label>
                <input
                  type="number"
                  className="input"
                  style={{ fontSize: 18, fontWeight: 700 }}
                  value={newCashAmount}
                  onChange={(e) => setNewCashAmount(Number(e.target.value) || 0)}
                  required
                  min={0}
                />
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  Display format: {formatINR(newCashAmount)}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="label">Adjustment Reason / Notes:</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Received from bank withdrawal / safe balance verification"
                  value={cashNote}
                  onChange={(e) => setCashNote(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCashModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Cash Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Asset */}
      {assetModalOpen && editingAsset && (
        <div className="modal-backdrop" onClick={() => setAssetModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{editingAsset.id ? "✏️" : "🏛️"}</span>
                {editingAsset.id ? "Edit Asset" : "Add New Asset"}
              </h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setAssetModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveAsset} style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label className="label">Asset Name / Description:</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Godrej Defender Vault, Carat Balance, BDB Locker"
                  value={editingAsset.name || ""}
                  onChange={(e) =>
                    setEditingAsset({ ...editingAsset, name: e.target.value })
                  }
                  required
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <label className="label">Category:</label>
                  <select
                    className="select"
                    value={editingAsset.category || "Vault & Safe"}
                    onChange={(e) =>
                      setEditingAsset({
                        ...editingAsset,
                        category: e.target.value as any,
                      })
                    }
                  >
                    {assetCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Company:</label>
                  <select
                    className="select"
                    value={editingAsset.company_name || "Shreeji Gems"}
                    onChange={(e) =>
                      setEditingAsset({
                        ...editingAsset,
                        company_name: e.target.value,
                      })
                    }
                  >
                    {DEFAULT_COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <label className="label">Valuation Amount (₹):</label>
                  <input
                    type="number"
                    className="input"
                    value={editingAsset.valuation || 0}
                    onChange={(e) =>
                      setEditingAsset({
                        ...editingAsset,
                        valuation: Number(e.target.value) || 0,
                      })
                    }
                    required
                    min={0}
                  />
                </div>

                <div>
                  <label className="label">Purchase / Deposit Date:</label>
                  <input
                    type="date"
                    className="input"
                    value={editingAsset.purchase_date || ""}
                    onChange={(e) =>
                      setEditingAsset({
                        ...editingAsset,
                        purchase_date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="label">Notes / Location specifics:</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Location, warranty, specifications or receipt reference..."
                  value={editingAsset.notes || ""}
                  onChange={(e) =>
                    setEditingAsset({ ...editingAsset, notes: e.target.value })
                  }
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setAssetModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAsset.id ? "Update Asset" : "Save Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Customize Asset Categories */}
      {catModalOpen && (
        <div className="modal-backdrop" onClick={() => setCatModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>⚙️ Customize Asset Categories</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setCatModalOpen(false)}>
                ✕
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
                Add or remove custom categories for tangible vault lockers, tools, and company assets.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!customCatInput.trim()) return;
                  addAssetCatMutation.mutate(customCatInput.trim());
                }}
                style={{ display: "flex", gap: 8, marginBottom: 18 }}
              >
                <input
                  type="text"
                  className="input"
                  placeholder="New asset category name..."
                  value={customCatInput}
                  onChange={(e) => setCustomCatInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={!customCatInput.trim()}>
                  + Add
                </button>
              </form>

              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: "var(--surface-hover)", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                  Active Asset Categories ({assetCategories.length})
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {assetCategories.map((cat) => (
                    <div
                      key={cat}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>🏛️ {cat}</span>
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ color: "#ef4444" }}
                        onClick={() => {
                          if (assetCategories.length <= 1) {
                            show("Cannot remove the last category", "warning");
                            return;
                          }
                          if (window.confirm(`Delete category "${cat}"?`)) {
                            deleteAssetCatMutation.mutate(cat);
                          }
                        }}
                        title="Delete Category"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => setCatModalOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
