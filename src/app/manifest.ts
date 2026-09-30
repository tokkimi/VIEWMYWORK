import type { MetadataRoute } from "next";

/** Web app manifest — lets users add FollowMyFuture to their home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FollowMyFuture",
    short_name: "FollowMyFuture",
    description: "Client portal: specification, progress, deliverables, approvals and invoices. · Portail client : cahier des charges, avancement, livrables, validations et factures.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#08090b",
    theme_color: "#08090b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/logo.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
