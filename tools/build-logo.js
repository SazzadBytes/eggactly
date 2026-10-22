// Builds assets/logo.svg: "Eggxactly" in Anton (as paths) with two code-drawn eggs over the g's.
// Usage: npm i opentype.js && node tools/build-logo.js assets/logo.svg path/to/Anton-Regular.ttf
// Font: https://github.com/google/fonts/tree/main/ofl/anton (SIL Open Font License)
const o = require("opentype.js");
const fs = require("fs");
const font = o.loadSync(process.argv[3] || "Anton-Regular.ttf");
const SIZE = 200, BASE = 200, TRACK = -3;
const out = process.argv[2];

let x = 6, d = "", gs = [];
// extra room before/after each g so the eggs breathe
const EXTRA = { 1: 10, 2: 12, 3: 10 };
const chars = [..."Eggxactly"];
chars.forEach((ch, i) => {
  x += EXTRA[i] || 0;
  const g = font.charToGlyph(ch);
  const p = g.getPath(x, BASE, SIZE);
  if (ch === "g") { const b = p.getBoundingBox(); gs.push((b.x1 + b.x2) / 2); }
  d += p.toPathData(1);
  x += (g.advanceWidth * SIZE) / font.unitsPerEm + TRACK;
});
const W = Math.ceil(x + 6);

// Egg outline in a 100-unit box (x 8..92, y 4..116).
const EGG = "M50 4c25 0 42 44 42 70 0 26-19 42-42 42S8 100 8 74C8 48 25 4 50 4z";
const EGG_W = 90, TOP = 54;
const s = EGG_W / 84;
const place = (cx) => `translate(${(cx - 50 * s).toFixed(1)} ${(TOP - 4 * s).toFixed(1)}) scale(${s.toFixed(4)})`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 18 ${W} 222" width="${W}" height="222" role="img" aria-labelledby="t">
  <title id="t">Eggactly</title>
  <defs>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FDB12A"/><stop offset="1" stop-color="#F79E05"/>
    </linearGradient>
    <radialGradient id="white" cx="38%" cy="35%" r="75%">
      <stop offset="0" stop-color="#FBF8F2"/><stop offset=".7" stop-color="#F1EBE0"/><stop offset="1" stop-color="#DCD3C4"/>
    </radialGradient>
    <radialGradient id="yolk" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#FFC23D"/><stop offset=".75" stop-color="#F8A71C"/><stop offset="1" stop-color="#EE8A12"/>
    </radialGradient>
    <radialGradient id="shell" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#F7B48E"/><stop offset=".6" stop-color="#F09E6F"/><stop offset="1" stop-color="#D9805A"/>
    </radialGradient>
    <filter id="drop" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#7A4A00" flood-opacity=".28"/>
    </filter>
    <clipPath id="eggClip"><path d="${EGG}"/></clipPath>
  </defs>
  <style>
    .egg { transform-box: fill-box; transform-origin: 50% 100%; animation: wob 3.2s ease-in-out infinite; }
    .egg.two { animation-delay: -1.6s; }
    .shine { animation: shine 3.2s ease-in-out infinite; }
    @keyframes wob { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
    @keyframes shine { 0%,100% { opacity: .55; } 50% { opacity: .95; } }
    @media (prefers-reduced-motion: reduce) { .egg, .shine { animation: none; } }
  </style>

  <path d="${d}" fill="url(#ink)"/>

  <!-- cut egg (soft-boiled, yolk showing) -->
  <g class="egg" filter="url(#drop)">
    <g transform="${place(gs[0])}">
      <path d="${EGG}" fill="url(#white)"/>
      <g clip-path="url(#eggClip)"><path d="M92 40c4 30 0 70-30 78h40z" fill="#000" opacity=".06"/></g>
      <circle cx="51" cy="76" r="22" fill="#EE8A12"/>
      <circle cx="49.5" cy="74" r="20.5" fill="url(#yolk)"/>
      <ellipse class="shine" cx="42" cy="65" rx="6.5" ry="3.6" transform="rotate(-30 42 65)" fill="#fff"/>
    </g>
  </g>

  <!-- whole brown egg -->
  <g class="egg two" filter="url(#drop)">
    <g transform="${place(gs[1])}">
      <path d="${EGG}" fill="url(#shell)"/>
      <g clip-path="url(#eggClip)"><path d="M8 70c6 30 30 40 58 36s26-30 26-30v44H8z" fill="#C96F48" opacity=".22"/></g>
      <path class="shine" d="M30 46c4-14 12-24 18-27" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/>
    </g>
  </g>
</svg>
`;
fs.writeFileSync(out, svg);
console.log("width", W, "g centers", gs.map((v) => v.toFixed(1)), "bytes", svg.length);
