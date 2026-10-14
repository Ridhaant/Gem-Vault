import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "./auth";
import { useToast } from "./toast";
import { LocalVaultBadge, LocalBackupModal } from "./LocalBackupModal";
import { GstSettingsModal } from "./GstSettingsModal";
import {
  checkAndRunAutomatedWeeklyBackup,
  createAndDownloadBackupNow,
  printBusinessEvaluationReport,
} from "./backupEngine";
import { verifyAnalyticsPassword } from "./gemstoneStorage";

const TOP_NAV = [
  { to: "/inventory", icon: "📦", label: "Boxes & Packets", end: true },
  { to: "/sales", icon: "🧾", label: "Sales & Approvals" },
  { to: "/purchases", icon: "📥", label: "Purchases & Intake" },
  { to: "/brokerage", icon: "🤝", label: "Brokerage" },
  { to: "/expenses", icon: "💳", label: "Expenses" },
  { to: "/assets", icon: "🔒", label: "Assets & Cash" },
  { to: "/buyers", icon: "👥", label: "Ledger" },
  { to: "/reports", icon: "🔒", label: "Profit & Reports" },
];

const NAV = [
  { label: "VAULT & TRADING", group: "VAULT" },
  { to: "/inventory", icon: "💎", label: "Boxes & Packets", end: true },
  { to: "/purchases", icon: "📥", label: "Purchases & Intake" },
  { to: "/sales", icon: "🧾", label: "Sales & Invoicing" },
  { to: "/brokerage", icon: "🤝", label: "Brokerage Deals" },
  { to: "/expenses", icon: "💳", label: "Expenses (Petty & Business)" },
  { to: "/assets", icon: "🔒", label: "Assets & Liquid Cash" },

  { label: "EVALUATION & CLIENTS", group: "INSIGHTS" },
  { to: "/reports", icon: "🔒", label: "Profit & Analytics" },
  { to: "/buyers", icon: "👥", label: "Buyers & Sellers Ledger" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupModalTab, setBackupModalTab] = useState<"backup" | "report" | "restore" | "archive">("backup");
  const [showGstModal, setShowGstModal] = useState(false);

  // Master Security PIN Protection (Password: 2014)
  const [securityPinAction, setSecurityPinAction] = useState<"backup" | "report" | "restore" | null>(null);
  const [securityPinInput, setSecurityPinInput] = useState<string>("");
  const [securityPinError, setSecurityPinError] = useState<boolean>(false);

  React.useEffect(() => {
    document.title = "Shreeji Gems | Gemstones CRM & Multi-Company Vault";
    const backupCheck = checkAndRunAutomatedWeeklyBackup();
    if (backupCheck.triggered) {
      show(`📅 ${backupCheck.message}`, "info");
    }
  }, []);

  function doLogout() {
    logout();
    sessionStorage.removeItem("gemvault_master_admin_unlocked");
    sessionStorage.removeItem("gemvault_analytics_unlocked");
    sessionStorage.removeItem("gemvault_assets_unlocked");
    show("Vault locked", "info");
    navigate("/login");
  }

  const isMasterUnlocked = () => {
    return sessionStorage.getItem("gemvault_master_admin_unlocked") === "true";
  };

  const runQuickBackup = () => {
    try {
      const res = createAndDownloadBackupNow(false);
      show(`💾 Dual Backup downloaded (Word .doc & JSON .json) successfully!`, "success");
    } catch (err: any) {
      show("Failed to create backup: " + err.message, "error");
    }
  };

  const runQuickReport = () => {
    try {
      printBusinessEvaluationReport();
      show("📊 Opening Business Evaluation Report for printing...", "info");
    } catch (err: any) {
      show("Failed to generate report: " + err.message, "error");
    }
  };

  const runRestore = () => {
    setBackupModalTab("restore");
    setShowBackupModal(true);
  };

  const handleQuickBackup = () => {
    if (isMasterUnlocked()) {
      runQuickBackup();
    } else {
      setSecurityPinAction("backup");
      setSecurityPinInput("");
      setSecurityPinError(false);
    }
  };

  const handleQuickReport = () => {
    if (isMasterUnlocked()) {
      runQuickReport();
    } else {
      setSecurityPinAction("report");
      setSecurityPinInput("");
      setSecurityPinError(false);
    }
  };

  const handleOpenRestore = () => {
    if (isMasterUnlocked()) {
      runRestore();
    } else {
      setSecurityPinAction("restore");
      setSecurityPinInput("");
      setSecurityPinError(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAnalyticsPassword(securityPinInput)) {
      sessionStorage.setItem("gemvault_master_admin_unlocked", "true");
      setSecurityPinError(false);
      const action = securityPinAction;
      setSecurityPinAction(null);
      setSecurityPinInput("");
      show("✓ Master PIN verified.", "success");
      if (action === "backup") runQuickBackup();
      else if (action === "report") runQuickReport();
      else if (action === "restore") runRestore();
    } else {
      setSecurityPinError(true);
      show("Incorrect PIN. Access denied.", "error");
    }
  };

  const initials = "SG";

  const SidebarContent = () => (
    <>
      <div className="sidebar-logo">
        <div
          className="sidebar-logo-mark"
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
            color: "#fff",
            fontWeight: 900,
          }}
        >
          💎
        </div>
        <div style={{ flex: 1 }}>
          <div className="sidebar-logo-text" style={{ letterSpacing: "0.5px" }}>
            SHREEJI GEMS
          </div>
          <div className="sidebar-logo-sub" style={{ color: "var(--primary)" }}>
            Multi-Company CRM
          </div>
        </div>
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          title="Close navigation"
        >
          ✕
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item, i) => {
          if ("group" in item && "label" in item && !("to" in item)) {
            return (
              <div key={i} className="nav-group-label">
                {item.label}
              </div>
            );
          }
          if ("to" in item) {
            return (
              <NavLink
                key={item.to}
                to={item.to as string}
                end={"end" in item ? item.end : false}
                className={({ isActive }) =>
                  `nav-item${isActive ? " active" : ""}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          }
          return null;
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ padding: "0 4px 10px", display: "flex", justifyContent: "center" }}>
          <LocalVaultBadge
            onOpenModal={() => {
              setBackupModalTab("backup");
              setShowBackupModal(true);
            }}
          />
        </div>
        <div className="user-chip" onClick={doLogout} title="Click to lock vault">
          <div className="avatar" style={{ fontSize: 13, background: "var(--primary)", color: "#fff" }}>
            {initials}
          </div>
          <div className="user-chip-info">
            <div className="user-chip-name">{user?.name || "Gem Vault Master"}</div>
            <div className="user-chip-role" style={{ color: "#10b981" }}>
              5 Companies Merged
            </div>
          </div>
          <span className="logout-btn" title="Lock vault">
            🔒
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      {/* Mobile Drawer Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Unified Responsive Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="main-area">
        <header className="topbar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            ☰
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>💎</span>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>
              SHREEJI GEMS CRM
            </span>
            <span
              style={{
                fontSize: 11,
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                padding: "2px 8px",
                borderRadius: 12,
                fontWeight: 600,
              }}
              className="hide-mobile"
            >
              5 Companies Merged
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Action Cluster */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Create Backup Now */}
            <button
              className="btn btn-outline btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={handleQuickBackup}
              title="Instantly download master Word document backup (.doc) containing all software sections to computer"
            >
              <span>💾</span>
              <span className="hide-mobile">Backup Now</span>
            </button>

            {/* Generate & Print Business Report */}
            <button
              className="btn btn-outline btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={handleQuickReport}
              title="Generate and print comprehensive business evaluation report"
            >
              <span>📊</span>
              <span className="hide-mobile">Business Report</span>
            </button>

            {/* Restore Backup */}
            <button
              className="btn btn-outline btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={handleOpenRestore}
              title="Restore database from a past backup file"
            >
              <span>🔄</span>
              <span className="hide-mobile">Restore</span>
            </button>

            {/* Local Data Badge */}
            <LocalVaultBadge
              onOpenModal={() => {
                setBackupModalTab("backup");
                setShowBackupModal(true);
              }}
            />

            {/* New Packet Quick Intake */}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate("/purchases/new")}
              title="Intake new gemstone packet"
            >
              + New Packet
            </button>
          </div>
        </header>

        {/* Prominent Top Navigation Bar for Non-Tech Staff */}
        <nav className="top-navbar-strip">
          <div className="top-nav-tabs">
            {TOP_NAV.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => `top-nav-tab ${isActive ? "active" : ""}`}
              >
                <span className="top-nav-icon">{tab.icon}</span>
                <span className="top-nav-label">{tab.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              className="top-nav-tab top-nav-action-tab"
              onClick={() => setShowGstModal(true)}
              title="Customize and edit GST rates & statutory HSN codes"
            >
              <span className="top-nav-icon">⚙️</span>
              <span className="top-nav-label">GST Settings</span>
            </button>
          </div>
        </nav>

        <main className="content-area">
          <Outlet />
        </main>
      </div>

      {/* Master Security PIN Modal for Header Actions */}
      {securityPinAction && (
        <div className="modal-overlay" onClick={() => setSecurityPinAction(null)}>
          <div
            className="modal"
            style={{ maxWidth: 420, width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🔒</span>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>
                    Master PIN Verification
                  </h2>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    Admin Password Protected
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSecurityPinAction(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: "center", padding: "22px 20px" }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#10b981",
                  fontSize: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                🛡️
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: "0 0 6px" }}>
                {securityPinAction === "backup"
                  ? "Master Backup Download Protected"
                  : securityPinAction === "report"
                  ? "Business Evaluation Report Protected"
                  : "Database Restore Protected"}
              </h3>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px", lineHeight: 1.5 }}>
                Enter the 4-digit Master Security PIN to authorize{" "}
                {securityPinAction === "backup"
                  ? "dual Word & JSON database backup download"
                  : securityPinAction === "report"
                  ? "generating and viewing company business report"
                  : "restoring database from backup file"}
                .
              </p>
              <form onSubmit={handlePinSubmit}>
                <input
                  type="password"
                  autoFocus
                  maxLength={8}
                  className="input"
                  style={{
                    fontSize: 24,
                    textAlign: "center",
                    letterSpacing: 8,
                    fontWeight: 900,
                    width: 180,
                    margin: "0 auto 12px",
                    display: "block",
                    borderColor: securityPinError ? "#ef4444" : undefined,
                  }}
                  placeholder="••••"
                  value={securityPinInput}
                  onChange={(e) => {
                    setSecurityPinInput(e.target.value);
                    setSecurityPinError(false);
                  }}
                />
                {securityPinError && (
                  <div
                    style={{
                      color: "#ef4444",
                      fontSize: 12.5,
                      fontWeight: 700,
                      marginBottom: 12,
                    }}
                  >
                    ⚠️ Incorrect PIN. Access denied.
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setSecurityPinAction(null)}
                  >
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
                    Unlock &amp; Proceed
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Backup, Report & Restore Center Modal */}
      <LocalBackupModal
        open={showBackupModal}
        initialTab={backupModalTab}
        onClose={() => setShowBackupModal(false)}
      />

      {/* GST Customization & HSN Configuration Modal */}
      <GstSettingsModal
        open={showGstModal}
        onClose={() => setShowGstModal(false)}
      />
    </div>
  );
}
