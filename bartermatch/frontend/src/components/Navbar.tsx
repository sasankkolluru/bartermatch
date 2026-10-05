import React from "react";
import { BadgeCheck, Boxes, Handshake, LayoutDashboard, Megaphone, Sparkles, Truck } from "lucide-react";

export default function Navbar({ page, setPage, role = "brand" }: { page: string; setPage: (p: string) => void; role?: string }) {
  const brandItems = [
    { page: "Overview", label: "Overview", Icon: LayoutDashboard },
    { page: "Campaigns", label: "Campaigns", Icon: Megaphone },
    { page: "AI Matching", label: "AI Matching", Icon: Sparkles },
    { page: "Proof Review", label: "Proof Review", Icon: BadgeCheck },
    { page: "Inventory", label: "Inventory", Icon: Boxes },
    { page: "Logistics", label: "Logistics", Icon: Truck },
  ];
  const creatorItems = [
    { page: "Opportunities", label: "Opportunities", Icon: Sparkles },
    { page: "Collaborations", label: "Collaborations", Icon: Handshake },
    { page: "Proof of Post", label: "Proof of Post", Icon: BadgeCheck },
  ];
  const items = role === "creator" ? creatorItems : brandItems;

  return (
    <header className="topbar">
      <div className="brand-wrap">
        <img className="brand-logo" src="/bartermatch-mark.svg" alt="" />
        <div>
          <div className="brand-name">BARTERMATCH</div>
          <small>Exchange. Connect. Thru-Trade.</small>
        </div>
      </div>

      <nav className="nav-pill" aria-label="Main navigation">
        {items.map(({ page: destination, label, Icon }) => (
          <button key={destination} className={page === destination ? "active" : ""} onClick={() => setPage(destination)}>
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      <div className="profile-pill">
        <span className="dot" />
        {role === "creator" ? "Creator" : "Brand"} workspace
      </div>
    </header>
  );
}

