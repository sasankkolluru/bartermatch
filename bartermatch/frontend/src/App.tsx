import React, { Suspense, lazy, useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import CampaignWizard from "./pages/CampaignWizard";
import AIMatchingPage from "./pages/AIMatchingPage";
import InventoryPage from "./pages/InventoryPage";
import LogisticsPage from "./pages/LogisticsPage";
import CreatorDashboard from "./pages/CreatorDashboard";
import ProofReviewPage from "./pages/ProofReviewPage";
import { api } from "./services/api";

const BrandDashboard = lazy(() => import("./pages/BrandDashboard"));

export default function App() {
  const [page, setPage] = useState("Overview");
  const [data, setData] = useState<any>({});
  const [user, setUser] = useState<any | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      const cached = window.localStorage.getItem("bartermatch-user");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [email, setEmail] = useState("brand@example.com");
  const [role, setRole] = useState("brand");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (user) {
      window.localStorage.setItem("bartermatch-user", JSON.stringify(user));
    } else {
      window.localStorage.removeItem("bartermatch-user");
    }
  }, [user]);

  const load = () =>
    api("/analytics")
      .then(setData)
      .catch(() => setData({}));

  useEffect(() => {
    if (user) {
      load();
      setPage(user.role === "creator" ? "Opportunities" : "Overview");
    }
  }, [user?.role]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setAuthError("");

    try {
      const result = await api<any>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const signedInUser = result.user || { email, role };
      setUser(signedInUser);
      setPage(signedInUser.role === "creator" ? "Opportunities" : "Overview");
    } catch (error: any) {
      setAuthError(error.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="auth-shell">
        <section className="auth-story">
          <div className="brand-lockup"><img className="brand-logo brand-logo-large" src="/bartermatch-mark.svg" alt="" /><div><span>BARTERMATCH</span><small className="brand-tagline">Exchange. Connect. Thru-Trade.</small></div></div>
          <span className="eyebrow">Creator commerce, connected</span>
          <h1>Turn products into partnerships.</h1>
          <p>AI-powered product gifting that matches brands with reliable creators, tracks every shipment, and turns collaborations into measurable UGC.</p>
          <div className="demo-flow" aria-label="Brand to creator to shipment to content">
            <span>BRAND</span><i>→</i><span>AI MATCH</span><i>→</i><span>CREATOR</span><i>→</i><span>DELIVERY</span><i>→</i><span>UGC</span>
          </div>
          <small>Demo workspace · synthetic sample data · mock courier and proof review</small>
        </section>
        <div className="auth-card">
          <span className="eyebrow">Start demo</span>
          <h2>Open your workspace</h2>
          <p>Choose a role to explore the complete demo flow.</p>

          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="brand@example.com"
              />
            </label>

            <label>
              Workspace role
              <select value={role} onChange={(e) => {
                  const selectedRole = e.target.value;
                  setRole(selectedRole);
                  setEmail(selectedRole === "creator" ? "asha@example.com" : "brand@example.com");
                }}>
                <option value="brand">Brand team</option>
                <option value="creator">Creator</option>
              </select>
            </label>

            {authError ? <div className="auth-error">{authError}</div> : null}

            <button type="submit" disabled={busy}>
              {busy ? "Opening workspace..." : "Start demo"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar page={page} setPage={setPage} role={user.role || role} />
      <main>
        <div className="top-user-row">
          <span className="badge success">Logged in as {user.email || user.name || role}</span>
          <button className="secondary" onClick={() => setUser(null)}>Log out</button>
        </div>

        {user.role === "creator" ? (
          <CreatorDashboard creator={{ ...user, id: user.creator_id || 1 }} view={page} />
        ) : page === "Overview" ? (
          <Suspense fallback={<div className="panel">Loading overview...</div>}>
            <BrandDashboard onNavigate={setPage} refreshToken={data} />
          </Suspense>
        ) : page === "Campaigns" ? (
          <CampaignWizard refresh={load} />
        ) : page === "AI Matching" ? (
          <AIMatchingPage />
        ) : page === "Inventory" ? (
          <InventoryPage />
        ) : page === "Proof Review" ? (
          <ProofReviewPage reviewer={user} />
        ) : (
          <LogisticsPage />
        )}

        {demoMessage && <p role="status" className="demo-notice">{demoMessage}</p>}

        <footer>
          BarterMatch · API status {" "}
          {user.role !== "creator" && <button
            className="secondary"
            onClick={async () => {
              try {
                const d = await api<any>("/live-demo", { method: "POST" });
                setDemoMessage(d.message);
                setData(d.analytics);
                setPage("Overview");
              } catch (e: any) {
                setDemoMessage(e.message || "The live demo could not be completed.");
              }
            }}
          >
            Run live demo
          </button>}
        </footer>
      </main>
    </>
  );
}
