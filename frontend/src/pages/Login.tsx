import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useToast } from "../toast";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [email, setEmail] = useState("admin@shreejigems.com");
  const [password, setPassword] = useState("gemstone123");
  const [loading, setLoading] = useState(false);

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
      <div className="login-left" style={{ background: "linear-gradient(135deg, #064e3b 0%, #022c22 100%)" }}>
        <div className="login-brand-mark" style={{ background: "rgba(16, 185, 129, 0.2)", border: "2px solid #10b981", fontSize: 32 }}>
          💎
        </div>
        <h1 style={{ letterSpacing: "1px" }}>SHREEJI GEMS</h1>
        <p style={{ color: "#a7f3d0" }}>
          Gemstones CRM, Packet Inventory &amp; Business Intelligence Master
        </p>
        <div className="login-features">
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
                placeholder="Enter password"
              />
            </div>
            <button
              className="btn btn-primary w-full"
              type="submit"
              disabled={loading}
              style={{ marginTop: "var(--s2)", padding: "12px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
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
            <strong>Air-Gapped Local Mode:</strong> Click "Unlock Local Vault" with any credentials to enter your local database. No cloud accounts needed.
          </div>
        </form>
      </div>
    </div>
  );
}
