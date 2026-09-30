"use client";

import { useState } from "react";

const rooms = [
  { initials: "AO", name: "Atelier Orme", project: "Brand refresh", status: "Feedback requested", tone: "violet", files: 12 },
  { initials: "MN", name: "Maison Noma", project: "Spring campaign", status: "In review", tone: "ink", files: 8 },
  { initials: "ST", name: "Studio TERRA", project: "Website direction", status: "Shared today", tone: "sand", files: 24 }
];

export default function Home() {
  const [notice, setNotice] = useState("");
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState(0);

  async function connectGoogle() {
    try {
      const res = await fetch("/api/integrations/google/connect");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setNotice(data.message || "Add Google OAuth credentials to enable connection.");
    } catch { setConnected(true); setNotice("Google Drive connected in preview mode."); }
  }

  async function invite() {
    const email = window.prompt("Client email address");
    if (!email) return;
    const res = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, room: rooms[active].name }) });
    const data = await res.json();
    setNotice(data.message || `Invitation prepared for ${email}.`);
  }

  return <main>
    <nav>
      <a className="brand" href="#top"><span className="brand-orb"/> VIEWMYWORK</a>
      <div className="nav-center"><a href="#spaces">Spaces</a><a href="#files">Library</a><a href="#activity">Activity</a></div>
      <div className="nav-right"><button className="new-space">＋ New space</button><button className="avatar" aria-label="Open account menu">TK</button></div>
    </nav>

    <section className="hero" id="top">
      <div className="hero-copy"><p className="eyebrow">CREATIVE CLIENT PORTAL</p><h1>A better home<br/>for <i>the work.</i></h1><p className="lede">Share only what matters. Keep the rest beautifully out of sight.</p><div className="hero-actions"><button className="primary" onClick={invite}>Invite a client <span>→</span></button><button className="quiet">Explore spaces</button></div></div>
      <div className="hero-object" aria-hidden="true"><div className="orbital one"/><div className="orbital two"/><div className="black-card"><span>NOW VIEWING</span><b>{rooms[active].name}</b><small>{rooms[active].project}</small><div className="card-pulse"><i/><i/><i/></div></div><div className="float-file">↗ <span>12 selected files</span></div></div>
    </section>

    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}

    <section className="summary"><div><span>Active spaces</span><strong>03</strong><small>+1 this month</small></div><div><span>Awaiting feedback</span><strong>07</strong><small>Across 2 client spaces</small></div><div><span>Shared this week</span><strong>44</strong><small>Files & deliverables</small></div><p>Everything your clients need, nothing they don’t.</p></section>

    <section className="section" id="spaces"><div className="section-head"><div><p className="eyebrow">CLIENT SPACES</p><h2>In motion</h2></div><button className="text-button">View all <span>→</span></button></div><div className="rooms">{rooms.map((room, index) => <button className={`room ${active === index ? "selected" : ""}`} onClick={() => setActive(index)} key={room.name}><div className={`room-mark ${room.tone}`}>{room.initials}</div><div className="room-main"><strong>{room.name}</strong><span>{room.project}</span></div><div className="room-meta"><span className="status"><b/> {room.status}</span><small>{room.files} files</small></div><span className="arrow">→</span></button>)}</div></section>

    <section className="bottom-grid" id="files"><div className="drive card"><div className="card-top"><div><p className="eyebrow">YOUR LIBRARY</p><h2>Connected sources</h2></div><span className="signal">● Live</span></div><div className="integration"><div className="google-icon">G</div><div><strong>Google Drive</strong><span>{connected ? "Connected · choose folders to share" : "Connect your Drive, retain control"}</span></div><button className={connected ? "connected" : "secondary"} onClick={connectGoogle}>{connected ? "Connected" : "Connect"}</button></div><p className="helper">Clients can only see folders you explicitly add to their space. Your full Drive remains private.</p></div>
    <div className="activity card" id="activity"><p className="eyebrow">RECENT ACTIVITY</p><h2>Quietly moving forward</h2><ul><li><b>AO</b><span><strong>Atelier Orme</strong> viewed <em>Brand system v2</em><small>12 min ago</small></span></li><li><b>MN</b><span><strong>Maison Noma</strong> left feedback on <em>Campaign selects</em><small>Yesterday</small></span></li></ul></div></section>

    <footer><span>© 2026 VIEWMYWORK</span><span>Private by default · Built for considered work</span></footer>
  </main>;
}
