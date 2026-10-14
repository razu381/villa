/**
 * A sticky stage inside a chapter section. The pin itself has no height, so it
 * stays stuck for the whole section (t ∈ [i, i+1)); its frame is one viewport tall.
 */
export function Pin({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="vl-pin">
      <div className={`vl-frame ${className}`}>{children}</div>
    </div>
  );
}
