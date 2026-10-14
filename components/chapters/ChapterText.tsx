"use client";

/** PLACEHOLDER shared chapter text block (DOM module will replace with the real design). */
export function ChapterText({ eyebrow, title, body, dark = false }: { eyebrow: string; title: string; body?: string; dark?: boolean }) {
  return (
    <div style={{ position: "sticky", top: 0, height: "100svh", display: "flex", alignItems: "flex-end", padding: "0 var(--gutter) 12vh" }}>
      <div style={{ maxWidth: 520, color: dark ? "var(--text-on-dark)" : "var(--text)" }}>
        <p style={{ letterSpacing: "0.32em", textTransform: "lowercase", fontSize: 12, margin: "0 0 18px" }}>{eyebrow}</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(40px, 5vw, 76px)", lineHeight: 1.02, margin: "0 0 18px" }}>{title}</h2>
        {body && <p style={{ margin: 0, color: dark ? "var(--text-on-dark)" : "var(--text-soft)", maxWidth: 440 }}>{body}</p>}
      </div>
    </div>
  );
}
