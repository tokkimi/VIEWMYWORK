"use client";

import { useAutoRecover } from "@/components/recover-error";

/** Last-resort boundary (renders its own <html>). Bilingual because the i18n context may be unavailable here. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useAutoRecover(error);
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#08090b", color: "#f5f7fa", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>La page n&apos;a pas pu se charger · This page couldn&apos;t load</p>
          <p style={{ color: "#9aa3b2", fontSize: 14 }}>Une nouvelle version est peut-être disponible. · A new version may be available.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 12, background: "#4d7cfe", color: "#fff", border: 0, borderRadius: 10, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}>Recharger · Reload</button>
        </div>
      </body>
    </html>
  );
}
