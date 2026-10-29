import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("TC Admin failed to render:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: "100vh", background: "#0a0a0b", color: "#f5f5f6", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", padding: "24px" }}>
          <section style={{ width: "min(100%, 560px)", border: "1px solid #633737", background: "#171113", borderRadius: "12px", padding: "24px" }}>
            <p style={{ color: "#ffb6b6", fontSize: "11px", letterSpacing: "2px", fontWeight: 700 }}>TC ADMIN ERROR</p>
            <h1 style={{ fontSize: "25px", margin: "0 0 12px" }}>TC Admin couldn't load</h1>
            <p style={{ color: "#c6bfc1", lineHeight: 1.6 }}>The page encountered a rendering error instead of showing a blank screen. Refresh the page once; if it continues, send this error detail to support.</p>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "#ffb6b6", background: "#0e0d0e", borderRadius: "8px", padding: "12px", fontSize: "12px" }}>{String(this.state.error?.message || this.state.error)}</pre>
            <button onClick={() => window.location.reload()} style={{ border: 0, borderRadius: "8px", background: "#f4f4f5", color: "#111114", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Reload TC Admin</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);