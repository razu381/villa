/**
 * The architect's grid: four columns of hairlines behind the light sections
 * (photos and solid bands cover them). They draw down once, on load.
 */
export function GridLines() {
  return (
    <div className="vc-grid" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ "--i": i } as React.CSSProperties} />
      ))}
    </div>
  );
}
