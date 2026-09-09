import { useRef } from "react";

// Clickable 0.5-5 star picker — matches the Browse page's half-star filter
// granularity and the wireframe's "*****" star controls for Speed/Difficulty,
// instead of a plain numeric slider. Half-fill is done with a clipped
// overlay rather than a half-star glyph, which renders inconsistently
// across fonts.
export default function StarPicker({ label, value, onChange }) {
  const ref = useRef(null);

  function handleClick(e) {
    const rect = ref.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const raw = Math.max(0.5, Math.min(5, pct * 5));
    const rounded = Math.round(raw * 2) / 2; // snap to nearest 0.5
    onChange(rounded);
  }

  const fillPct = Math.max(0, Math.min(100, (value / 5) * 100));

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>{label}: {value} / 5</label>
      <div
        ref={ref}
        onClick={handleClick}
        style={{ position: "relative", display: "inline-block", fontSize: 26, lineHeight: 1, cursor: "pointer" }}
      >
        <div style={{ color: "var(--border)" }}>★★★★★</div>
        <div style={{
          position: "absolute", top: 0, left: 0, overflow: "hidden",
          width: `${fillPct}%`, color: "var(--accent)", whiteSpace: "nowrap",
        }}>★★★★★</div>
      </div>
    </div>
  );
}
