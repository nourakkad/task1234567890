import { redirect } from "next/navigation";

/** Prefer the static offline workbench (works without Next.js JS chunks). */
export default function OfflinePage() {
  redirect("/offline.html");
}
