/** Original artwork, optimized for display without recoloring or stretching. */
export default function Brand({ compact = false, tone = "auto", className = "" }) {
  const asset = compact ? "mark" : "wordmark";
  return <span className={`brand official-brand brand-${tone} ${compact ? "brand-compact" : ""} ${className}`}>
    <img className="brand-color-art" src={`/brand/${asset}-color.webp`} alt="IntelliRide" width={compact ? 40 : 182} height={compact ? 40 : 47} />
    <img className="brand-white-art" src={`/brand/${asset}-white.webp`} alt="IntelliRide" width={compact ? 40 : 182} height={compact ? 40 : 47} />
  </span>;
}
