// SVG displacement filter that gives the glass panels their liquid edges
// (referenced as url(#lgDistort) by .lg-distort in globals.css).
export default function GlassFilterDefs() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute" style={{ position: "absolute" }}>
      <defs>
        <filter id="lgDistort" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.009 0.013" numOctaves="2" seed="14" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="1.4" result="noiseB" />
          <feDisplacementMap in="SourceGraphic" in2="noiseB" scale="34" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
