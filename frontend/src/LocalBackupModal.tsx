import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, setCostToken } from "./api";
import {
  createAndDownloadBackupNow,
  downloadMasterWordBackup,
  downloadJsonBackup,
  getLocalBackupHistory,
  checkAndRunAutomatedWeeklyBackup,
  type BackupHistoryItem,
} from "./backupEngine";
import {
  resetToGemstoneSeed,
  verifyAnalyticsPassword,
} from "./gemstoneStorage";
import { useToast } from "./toast";
import { formatINR } from "./format";
import { idbGet } from "./offlineDb";

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
  initialTab?: "backup" | "restore" | "archive";
}) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [activeTab, setActiveTab] = useState<"backup" | "restore" | "archive">(
    initialTab === ("report" as any) ? "backup" : initialTab
  );
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
      setActiveTab(initialTab === ("report" as any) ? "backup" : initialTab);
      setHistory(getLocalBackupHistory());
      const res = checkAndRunAutomatedWeeklyBackup();
      setWeeklyStatus(res.message);
      setIsPinUnlocked(sessionStorage.getItem("gemvault_master_admin_unlocked") === "true");
      setPinInput("");
      setPinError(false);
    }
  }, [open, initialTab]);

  const handleUnlockPin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost("/cost-price-password/verify", { password: pinInput });
      if (res?.valid) {
        if (res?.token) {
          setCostToken(res.token);
        }
        setIsPinUnlocked(true);
        sessionStorage.setItem("gemvault_master_admin_unlocked", "true");
        setPinError(false);
        setPinInput("");
        show("✓ Master PIN verified. Backup Center unlocked.", "success");
        return;
      }
    } catch {}

    if (verifyAnalyticsPassword(pinInput)) {
      setIsPinUnlocked(true);
      sessionStorage.setItem("gemvault_master_admin_unlocked", "true");
      setPinError(false);
      setPinInput("");
      show("✓ Master PIN verified. Backup Center unlocked.", "success");
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

  // 2. Separate Action: Restore Backup
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      show("Uploading and restoring database snapshot...", "info");
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("gemvault_token");
      const costToken = localStorage.getItem("gemvault_cost_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (costToken) headers["X-Cost-Token"] = costToken;

      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Server error: " + res.status);
      }

      const result = await res.json();
      queryClient.invalidateQueries();
      show(`✓ Shreeji Gems database restored successfully! (${result.counts?.packets || 0} packets restored)`, "success");
      onClose();
    } catch (err: any) {
      show("Failed to restore backup: " + err.message, "error");
    } finally {
      setImporting(false);
      if (e.target) e.target.value = "";
    }
  };

  // Restore from historical archive item
  const handleRestoreFromHistory = async (item: BackupHistoryItem) => {
    if (!window.confirm(`Restore database to snapshot from ${item.dateFormatted}? Any unsaved newer data will be overwritten.`)) {
      return;
    }
    setImporting(true);
    try {
      let payload = item.jsonPayload;
      if (!payload) {
        payload = (await idbGet<string>("backup_payload_" + item.id)) || "";
      }
      if (!payload) {
        throw new Error("No backup snapshot payload found in archive.");
      }
      show("Restoring database to archived snapshot...", "info");
      const res = await apiPost("/backup/restore", JSON.parse(payload));
      queryClient.invalidateQueries();
      show(`✓ Restored to backup snapshot (${item.dateFormatted})!`, "success");
      onClose();
    } catch (err: any) {
      show("Failed to restore backup: " + err.message, "error");
    } finally {
      setImporting(false);
    }
  };

  const handleResetToDemo = () => {
    resetToGemstoneSeed();
    queryClient.invalidateQueries();
    setShowConfirmReset(false);
    show("Database reset to clean empty vault!", "success");
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
                Shreeji Gems Local Backup & Restore Center
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
            gridTemplateColumns: "1fr 1fr 1fr",
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

              {/* Security & Backup Status */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                <div style={{ background: "var(--surface-sunken)", padding: "10px", borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Storage Mode</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)", marginTop: 2 }}>🔒 100% Offline SQLite</div>
                </div>
                <div style={{ background: "var(--surface-sunken)", padding: "10px", borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Auto Weekly Backup</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#10b981", marginTop: 2 }}>✓ Active & Guarded</div>
                </div>
                <div style={{ background: "var(--surface-sunken)", padding: "10px", borderRadius: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Snapshot Format</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b", marginTop: 2 }}>Word (.doc) + JSON</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RESTORE BACKUP */}
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

                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
                  <label
                    className="btn btn-primary"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 24px",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    <span>📂 Select Backup File (.json) to Restore</span>
                    <input
                      type="file"
                      accept=".json"
                      style={{ display: "none" }}
                      onChange={handleFileUpload}
                      disabled={importing}
                    />
                  </label>
                </div>
                {importing && <div style={{ marginTop: 8, fontSize: 12, color: "var(--primary)" }}>Restoring database... Please wait...</div>}
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
                Reset Vault to Client-Ready Clean Slate
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                Clear all test transactions, packets, test parties & suppliers for client handover
              </div>
            </div>
            {!showConfirmReset ? (
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setShowConfirmReset(true)}
              >
                Reset Database
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
