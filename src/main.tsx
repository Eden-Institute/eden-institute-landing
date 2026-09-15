import { createRoot } from "react-dom/client";
// Snapshots index.html meta defaults before any route mutates <head>.
import "@/lib/useDocumentMeta";
import App from "./App.tsx";
import "./index.css";

// After a deploy, an open tab can request a lazy route chunk whose old hashed
// file no longer exists. Reload once per tab session to pick up the new build;
// if it fails again, the app error boundary's Refresh fallback takes over.
window.addEventListener("vite:preloadError", (event) => {
  try {
    if (sessionStorage.getItem("eden.chunk_reload")) return;
    sessionStorage.setItem("eden.chunk_reload", "1");
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
