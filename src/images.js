// Erzeugt alle Bilder der Karte (Stempel-Streifen, Icon, Logo) als PNG.
// Eigene Bilder: lege assets/logo.png (am besten 320x100, transparent) und/oder
// assets/icon.png (quadratisch) ab – dann werden diese statt der generierten verwendet.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const config = require("./config");

const ASSETS = path.join(__dirname, "..", "assets");
const C = config.cafe.colors;
const cache = new Map();

function cupGlyph(color, opacity = 1) {
  // Kaffeetasse in einer 100x100-Box
  return `
  <g fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" opacity="${opacity}">
    <path d="M40 18 q-5 7 0 14" /><path d="M52 14 q-5 9 0 18" /><path d="M64 18 q-5 7 0 14" />
    <circle cx="74" cy="52" r="9" />
  </g>
  <path d="M26 40 h46 v16 a23 23 0 0 1 -23 23 a23 23 0 0 1 -23 -23 z" fill="${color}" opacity="${opacity}" />
  <rect x="18" y="82" width="62" height="6" rx="3" fill="${color}" opacity="${opacity}" />`;
}

function stampGridSvg(filled, total, width, height, bg) {
  const rows = total <= 5 ? 1 : 2;
  const cols = Math.ceil(total / rows);
  const cellW = width / cols;
  const cellH = height / rows;
  const d = Math.min(cellW, cellH) * 0.78; // Durchmesser eines Stempels
  let out = "";
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = r === rows - 1 ? total - cols * (rows - 1) : cols;
    const offsetX = (width - inRow * cellW) / 2; // letzte Reihe zentrieren
    const cx = offsetX + c * cellW + cellW / 2;
    const cy = r * cellH + cellH / 2;
    const isOn = i < filled;
    const s = d / 100;
    out += `<g transform="translate(${cx - d / 2},${cy - d / 2}) scale(${s})">`;
    if (isOn) {
      out += `<circle cx="50" cy="50" r="48" fill="${C.stamp}" />`;
      out += `<g transform="translate(18,16) scale(0.64)">${cupGlyph(bg)}</g>`;
    } else {
      out += `<circle cx="50" cy="50" r="46" fill="none" stroke="${C.stamp}" stroke-width="3" stroke-dasharray="6 6" opacity="0.55" />`;
      out += `<g transform="translate(18,16) scale(0.64)">${cupGlyph(C.stamp, 0.25)}</g>`;
    }
    out += `</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${bg}" />${out}</svg>`;
}

async function render(key, svgFn) {
  if (cache.has(key)) return cache.get(key);
  const buf = await sharp(Buffer.from(svgFn())).png().toBuffer();
  cache.set(key, buf);
  return buf;
}

// Apple-Streifen hinter den Feldern einer Stempelkarte: 375x123 Punkte
function appleStrip(filled, scale) {
  const total = config.cafe.stampsRequired;
  filled = Math.min(filled, total);
  const w = 375 * scale, h = 123 * scale;
  const padX = 18 * scale, padY = 10 * scale;
  return render(`strip-${filled}-${scale}`, () =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="100%" height="100%" fill="${C.background}" />
      <g transform="translate(${padX},${padY})">${stampGridSvg(filled, total, w - 2 * padX, h - 2 * padY, C.background).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
    </svg>`);
}

// Google-"Hero"-Bild: 1032x336
function googleHero(filled) {
  const total = config.cafe.stampsRequired;
  filled = Math.min(filled, total);
  return render(`hero-${filled}`, () =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="1032" height="336">
      <rect width="100%" height="100%" fill="${C.background}" />
      <g transform="translate(40,24)">${stampGridSvg(filled, total, 952, 288, C.background).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
    </svg>`);
}

function custom(file) {
  const p = path.join(ASSETS, file);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

// Quadratisches Icon (Benachrichtigungen, Google-Logo)
async function icon(size) {
  const own = custom("icon.png");
  if (own) return sharp(own).resize(size, size, { fit: "contain", background: C.background }).png().toBuffer();
  return render(`icon-${size}`, () =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${C.background}" />
      <g transform="translate(14,12) scale(0.72)">${cupGlyph(C.stamp)}</g></svg>`);
}

// Logo oben links auf der Apple-Karte (max. 160x50 Punkte)
async function appleLogo(scale) {
  const own = custom("logo.png");
  if (own) return sharp(own).resize(160 * scale, 50 * scale, { fit: "inside" }).png().toBuffer();
  const s = 50 * scale;
  return render(`logo-${scale}`, () =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100">
      <g transform="translate(6,4) scale(0.88)">${cupGlyph(C.stamp)}</g></svg>`);
}

module.exports = { appleStrip, googleHero, icon, appleLogo };
