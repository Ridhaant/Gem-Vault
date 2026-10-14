import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createAndDownloadBackupNow,
  downloadMasterWordBackup,
  downloadJsonBackup,
  printBusinessEvaluationReport,
  generateBusinessEvaluationReport,
  getLocalBackupHistory,
  checkAndRunAutomatedWeeklyBackup,
  restoreDatabaseFromJson,
  type BackupHistoryItem,
} from "./backupEngine";
import {
  resetToGemstoneSeed,
  getOverallProfitAndAnalytics,
  verifyAnalyticsPassword,
} from "./gemstoneStorage";
import { useToast } from "./toast";
import { formatINR } from "./format";

export function LocalVaultBadge({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <button
      onClick={onOpenModal}
      className="local-vault-badge"
      title="Click to view Local Storage, Weekly Backups & Reports (PIN Protected)"
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      <span className="local-dot" />
      <span className="local-text">🔒 100% Local (Auto-Backup Weekly)</span>
    </button>
  );
}

export function LocalBackupModal({
  open,
  onClose,
  initialTab = "backup",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: "backup" | "report" | "restore" | "archive";
}) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [activeTab, setActiveTab] = useState<"backup" | "report" | "restore" | "archive">(initialTab);
  const [importing, setImporting] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [history, setHistory] = useState<BackupHistoryItem[]>([]);
  const [weeklyStatus, setWeeklyStatus] = useState<string>("");

  // Master PIN Security (Password: 2014)
  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem("gemvault_master_admin_unlocked") === "true";
  });
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setHistory(getLocalBackupHistory());
      const res = checkAndRunAutomatedWeeklyBackup();
      setWeeklyStatus(res.message);
      setIsPinUnlocked(sessionStorage.getItem("gemvault_master_admin_unlocked") === "true");
      setPinInput("");
      setPinError(false);
    }
  }, [open, initialTab]);

  const handleUnlockPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAnalyticsPassword(pinInput)) {
      setIsPinUnlocked(true);
      sessionStorage.setItem("gemvault_master_admin_unlocked", "true");
      setPinError(false);
      setPinInput("");
      show("✓ Master PIN verified. Backup & Report Center unlocked.", "success");
    } else {
      setPinError(true);
      show("Incorrect PIN. Access denied.", "error");
    }
  };

  if (!open) return null;

  // Master PIN Challenge if locked
  if (!isPinUnlocked) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 440, width: "95%" }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🔒</span>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>Master PIN Security Check</h2>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Password Protected for Company Admin</span>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                fontSize: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}
            >
              🛡️
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 6px" }}>
              Backup &amp; Business Reports Locked
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
              Enter your master security PIN to access company backups, financial evaluations, and restore archives.
            </p>
            <form onSubmit={handleUnlockPin}>
              <input
                type="password"
                className="input"
                autoFocus
                maxLength={8}
                style={{
                  fontSize: 24,
                  textAlign: "center",
                  letterSpacing: 8,
                  fontWeight: 900,
                  width: 190,
                  margin: "0 auto 12px",
                  display: "block",
                  borderColor: pinError ? "#ef4444" : undefined,
                }}
                placeholder="••••"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
              />
              {pinError && (
                <div style={{ color: "#ef4444", fontSize: 12.5, fontWeight: 700, marginBottom: 14 }}>
                  ⚠️ Incorrect PIN. Access denied.
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{
                    padding: "8px 22px",
                    fontWeight: 800,
                    background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
                  }}
                >
                  Unlock Access
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const stats = getOverallProfitAndAnalytics();
  const reportData = generateBusinessEvaluationReport();

  // 1. Separate Action: Create Backup Now (Dual Download: Word .doc + JSON .json)
  const handleCreateBackupNow = () => {
    try {
      const res = createAndDownloadBackupNow(false);
      setHistory(getLocalBackupHistory());
      show(`✓ Dual Backup Downloaded: Word (.doc) and JSON (.json) saved to computer!`, "success");
    } catch (err: any) {
      show("Failed to create backup: " + err.message, "error");
    }
  };

  const handleDownloadWordBackup = () => {
    try {
      const filename = downloadMasterWordBackup();
      show(`✓ Downloaded Microsoft Word Backup (${filename})!`, "success");
    } catch (err: any) {
      show("Failed to download Word backup: " + err.message, "error");
    }
  };

  const handleDownloadJsonBackup = () => {
    try {
      const filename = downloadJsonBackup();
      show(`✓ Downloaded JSON Restore Snapshot (${filename})!`, "success");
    } catch (err: any) {
      show("Failed to download JSON backup: " + err.message, "error");
    }
  };

  // 2. Separate Action: Generate & Print Business Report
  const handlePrintReport = () => {
    try {
      printBusinessEvaluationReport();
      show("Opening printable Business Evaluation Report...", "info");
    } catch (err: any) {
      show("Failed to open report: " + err.message, "error");
    }
  };

  // 3. Separate Action: Restore Backup
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const res = restoreDatabaseFromJson(text);
        if (res.success) {
          queryClient.invalidateQueries();
          show("✓ Shreeji Gems database restored successfully!", "success");
          onClose();
        } else {
          show(res.message, "error");
        }
      } catch (err: any) {
        show("Failed to restore backup: " + err.message, "error");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  // Restore from historical archive item
  const handleRestoreFromHistory = (item: BackupHistoryItem) => {
    if (!window.confirm(`Restore database to snapshot from ${item.dateFormatted}? Any unsaved newer data will be overwritten.`)) {
      return;
    }
    const res = restoreDatabaseFromJson(item.jsonPayload);
    if (res.success) {
      queryClient.invalidateQueries();
      show(`✓ Restored to backup snapshot (${item.dateFormatted})!`, "success");
      onClose();
    } else {
      show(res.message, "error");
    }
  };

  const handleResetToDemo = () => {
    resetToGemstoneSeed();
    queryClient.invalidateQueries();
    setShowConfirmReset(false);
    show("Database reset to luxury gemstone seed catalog!", "success");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 680, width: "95%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26 }}>🔒</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>
                Shreeji Gems Local Backup & Business Report Center
              </h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Automated Weekly Backups • 100% Offline Storage on this Computer
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tab Navigation for Separate Options */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr 1fr 1fr",
            gap: 6,
            background: "var(--surface-sunken)",
            padding: 4,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <button
            className={`btn btn-sm ${activeTab === "backup" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("backup")}
            style={{ fontSize: 12 }}
          >
            💾 Backup Now
          </button>
          <button
            className={`btn btn-sm ${activeTab === "report" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("report")}
            style={{ fontSize: 12 }}
          >
            📊 Business Report
          </button>
          <button
            className={`btn btn-sm ${activeTab === "restore" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("restore")}
            style={{ fontSize: 12 }}
          >
            🔄 Restore Backup
          </button>
          <button
            className={`btn btn-sm ${activeTab === "archive" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("archive")}
            style={{ fontSize: 12 }}
          >
            🗄️ Weekly Archive ({history.length})
          </button>
        </div>

        <div className="modal-body" style={{ gap: 16 }}>
          {/* Automated Weekly Notice */}
          <div
            style={{
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>📅</span>
              <div>
                <strong>Automated Weekly Backup Status:</strong>
                <div style={{ color: "var(--muted)", marginTop: 1 }}>{weeklyStatus}</div>
              </div>
            </div>
            <button
              className="btn btn-outline btn-xs"
              onClick={handleCreateBackupNow}
              title="Save a fresh backup snapshot immediately"
            >
              Run Backup Now
            </button>
          </div>

          {/* TAB 1: CREATE BACKUP NOW */}
          {activeTab === "backup" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  background: "var(--surface-sunken)",
                  border: "1.5px solid var(--border)",
                  borderRadius: 8,
                  padding: 16,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                <h3 style={{ fontSize: 17, fontWeight: 900, margin: "0 0 6px" }}>
                  Manual Master Backup &amp; Safe Transfer
                </h3>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px", maxWidth: 560, marginInline: "auto" }}>
                  Generates and downloads both an official <strong>Microsoft Word Document (.doc)</strong> for human auditing/printing and a <strong>JSON Database Snapshot (.json)</strong> for USB pendrive transfer and instant 1-click system restoration.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <button
                    className="btn btn-primary"
                    style={{
                      padding: "12px 28px",
                      fontSize: 14,
                      fontWeight: 800,
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      boxShadow: "0 4px 16px rgba(5, 150, 105, 0.35)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                    onClick={handleCreateBackupNow}
                    title="Download both Word document (.doc) and JSON database (.json) files together"
                  >
                    <span>📦</span>
                    <span>Download Dual Backup Bundle (Word .doc + JSON .json)</span>
                  </button>

                  <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={handleDownloadWordBackup}
                      title="Download only the Word document (.doc)"
                    >
                      📄 Word Document Only (.doc)
                    </button>
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={handleDownloadJsonBackup}
                      title="Download only the JSON file (.json)"
                    >
                      💾 JSON Snapshot Only (.json)
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                <div style={{ background: "var(--surface-sunken)", padding: "8px 10px", borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Packets in Vault</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)" }}>{stats.vault_packets_count} pkts</div>
                </div>
                <div style={{ background: "var(--surface-sunken)", padding: "8px 10px", borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Total Vault Valuation</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>{formatINR(stats.vault_cost_valuation)}</div>
                </div>
                <div style={{ background: "var(--surface-sunken)", padding: "8px 10px", borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Net Profit Recorded</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--success)" }}>{formatINR(stats.net_profit)}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BUSINESS EVALUATION & WEEKLY REPORT */}
          {activeTab === "report" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  background: "var(--surface-sunken)",
                  border: "1.5px solid var(--border)",
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>
                      📊 Executive Business Evaluation Report
                    </h3>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      Full P&L, inventory velocity & gemstone valuation breakdown
                    </span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handlePrintReport}>
                    🖨️ Print / Save PDF Report
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    fontSize: 12,
                    background: "var(--surface)",
                    padding: 12,
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <strong>Total Vault Cost:</strong> {formatINR(reportData.inventory.costValuation)}
                  </div>
                  <div>
                    <strong>Target Asking Value:</strong> {formatINR(reportData.inventory.askingValuation)}
                  </div>
                  <div>
                    <strong>In-Stock Stones:</strong> {reportData.inventory.inStockPackets} pkts ({reportData.inventory.inStockCarats} cts)
                  </div>
                  <div>
                    <strong>Multi-Gem Boxes:</strong> {reportData.inventory.multiGemBoxesCount} parcel lots
                  </div>
                  <div>
                    <strong>Realized Sales:</strong> {formatINR(reportData.financials.realizedRevenue)}
                  </div>
                  <div style={{ color: "var(--success)" }}>
                    <strong>Net Operating Profit:</strong> {formatINR(reportData.financials.netOperatingProfit)}
                  </div>
                  <div>
                    <strong>Gross Trading Margin:</strong> {reportData.financials.grossMarginPercent}%
                  </div>
                  <div>
                    <strong>Pending Receivables:</strong> {formatINR(reportData.financials.outstandingReceivables)}
                  </div>
                </div>
              </div>

              {/* Gemstone Variety Summary */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 6px" }}>
                  Top Varieties in Vault by Cost Value:
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 130, overflowY: "auto" }}>
                  {reportData.varietyBreakdown.slice(0, 5).map((v) => (
                    <div
                      key={v.variety}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 8px",
                        background: "var(--surface-sunken)",
                        borderRadius: 4,
                        fontSize: 11,
                      }}
                    >
                      <span><strong>{v.variety}</strong> ({v.packetsCount} pkts • {v.carats} cts)</span>
                      <span style={{ fontWeight: 800 }}>{formatINR(v.costValuation)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RESTORE BACKUP */}
          {activeTab === "restore" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  background: "var(--surface-sunken)",
                  border: "2px dashed var(--border)",
                  borderRadius: 8,
                  padding: 20,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                <h3 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 6px" }}>
                  Restore Shreeji Gems Database from File
                </h3>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
                  Select any past backup <code>.json</code> file to restore packets, sales, expenses, and buyer history.
                </p>

                <label
                  className="btn btn-outline"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 20px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  <span>Select Backup File (.json)</span>
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: "none" }}
                    onChange={handleFileUpload}
                    disabled={importing}
                  />
                </label>
                {importing && <div style={{ marginTop: 8, fontSize: 12, color: "var(--primary)" }}>Importing database...</div>}
              </div>

              {/* Safety notice */}
              <div style={{ fontSize: 11, color: "var(--muted)", background: "rgba(239, 68, 68, 0.05)", padding: 8, borderRadius: 6, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                ⚠️ <strong>Note:</strong> Restoring will overwrite the current local database with the contents of the chosen backup file. Always create a backup of your current database first if needed.
              </div>
            </div>
          )}

          {/* TAB 4: WEEKLY ARCHIVE */}
          {activeTab === "archive" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Historical snapshots saved on this computer:
                </span>
                <button className="btn btn-ghost btn-xs" onClick={() => setHistory(getLocalBackupHistory())}>
                  ↻ Refresh List
                </button>
              </div>

              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: 13 }}>
                  No historical backups in archive yet. Click "Backup Now" to create your first archive!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                  {history.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "var(--surface-sunken)",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800 }}>
                          {item.type === "weekly_auto" ? "📅 Weekly Auto-Backup" : "💾 Manual Backup"} • {item.dateFormatted}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {item.totalPackets} packets • {item.totalCarats} cts • Vault: {formatINR(item.inventoryValuation)}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => {
                            const blob = new Blob([item.jsonPayload], { type: "application/json" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `gemvault_archive_${item.id}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                        >
                          ⬇️ Download
                        </button>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => handleRestoreFromHistory(item)}
                        >
                          🔄 Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reset Control */}
          <div
            style={{
              paddingTop: 10,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Reset to Seed Catalog</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                Reload initial catalog of Rubies, Emeralds & Sapphires
              </div>
            </div>
            {!showConfirmReset ? (
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setShowConfirmReset(true)}
              >
                Reset Demo Data
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => setShowConfirmReset(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-xs"
                  onClick={handleResetToDemo}
                >
                  Confirm Reset
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Air-gapped security: Zero external servers or telemetry.
          </div>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
