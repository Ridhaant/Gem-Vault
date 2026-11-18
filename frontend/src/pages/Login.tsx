import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useToast } from "../toast";
import { Gemstone3D, type GemstoneTheme } from "../Gemstone3D";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [email, setEmail] = useState("admin@shreejigems.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeGem, setActiveGem] = useState<GemstoneTheme>("emerald");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      show("Vault unlocked successfully", "success");
      navigate("/", { replace: true });
    } catch (err: any) {
      show(err?.message || "Unlock failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div
        className="login-left"
        style={{
          background: "linear-gradient(135deg, #064e3b 0%, #022c22 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: "12px", position: "relative" }}>
          <Gemstone3D
            size={130}
            theme={activeGem}
            interactive={true}
            autoRotateSpeed={0.015}
            showSparkles={true}
          />
        </div>

        {/* 3D Gemstone Cut Switcher for Interactive Showcase */}
        <div
          style={{
            display: "inline-flex",
            gap: "6px",
            background: "rgba(0, 0, 0, 0.35)",
            padding: "4px 8px",
            borderRadius: "20px",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            marginBottom: "16px",
          }}
        >
          {(
            [
              ["emerald", "Emerald 🟢"],
              ["diamond", "Diamond 💎"],
              ["ruby", "Ruby 🔴"],
              ["sapphire", "Sapphire 🔷"],
            ] as const
          ).map(([themeKey, label]) => (
            <button
              key={themeKey}
              type="button"
              onClick={() => setActiveGem(themeKey)}
              style={{
                background: activeGem === themeKey ? "rgba(16, 185, 129, 0.3)" : "transparent",
                color: activeGem === themeKey ? "#34d399" : "#94a3b8",
                border: activeGem === themeKey ? "1px solid #10b981" : "1px solid transparent",
                borderRadius: "14px",
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 8px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <h1 style={{ letterSpacing: "1.5px", margin: "0 0 6px 0", fontSize: "28px" }}>SHREEJI GEMS</h1>
        <p style={{ color: "#a7f3d0", fontSize: "14px", margin: "0 0 20px 0" }}>
          Gemstones CRM, Packet Inventory &amp; Business Intelligence Master
        </p>

        <div className="login-features" style={{ width: "100%", textAlign: "left" }}>
          {[
            ["📦", "Packet Inventory (ex/1, ex/2... with Carats, Pcs, MM size)"],
            ["🏷️", "QR Code Generation & Print Labels for Each Packet"],
            ["🧾", "Full Sales & Invoicing with Auto-Allocations"],
            ["🤝", "Third-Party Brokerage Section (Not in inventory)"],
            ["📥", "Purchases & Direct New Packet Procurement Intake"],
            ["💳", "Laboratory Certifications, Lapidary & Vault Expenses"],
            ["📈", "Overall Profit Waterfall & Business Evaluation"],
            ["🔒", "100% Local & Offline Guarantee (Zero Cloud Uploads)"],
          ].map(([icon, label]) => (
            <div key={label} className="login-feature">
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="login-right">
        <form className="login-form-box" onSubmit={submit}>
          <h2>Unlock Vault 💎</h2>
          <p className="sub">Private Local Access — Everything stored locally</p>
          <div className="form-fields">
            <div className="field">
              <label>Master Vault Identifier</label>
              <input
                className="input"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@shreejigems.com"
              />
            </div>
            <div className="field">
              <label>Passcode / Key</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter vault passcode"
                autoFocus
                required
              />
            </div>
            <button
              className="btn btn-primary w-full"
              type="submit"
              disabled={loading}
              style={{
                marginTop: "var(--s2)",
                padding: "12px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              }}
            >
              {loading ? "Unlocking…" : "Unlock Local Vault →"}
            </button>
          </div>
          <div
            className="login-hint"
            style={{
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              color: "var(--text)",
            }}
          >
            <strong>Air-Gapped Local Vault:</strong> All gemstone data is stored 100% locally on this machine. Enter your vault passcode to continue.
          </div>
        </form>
      </div>
    </div>
  );
}
