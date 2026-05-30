/**
 * industryColors.js
 *
 * Single source of truth for industry colors.
 * Uses a fast string hash so the same industry name ALWAYS maps to the
 * same color slot — regardless of order, page, or component.
 *
 * Each slot exposes:
 *   • bg / text / border  — Tailwind classes for HTML badges/tags
 *   • hex                 — solid color for SVG charts (Recharts, etc.)
 *   • hexLight            — tinted fill for chart backgrounds
 */

// Vivid, fully-saturated palette — interleaved warm/cool so adjacent slots
// are hue-distant (no two similar shades side-by-side in a pie).
// Inspired by Flat UI Colors v2 — well-known to look great on screens.
const PALETTE = [
  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    hex: '#3498DB', hexLight: '#dbeafe' },  // 0  Peter River blue
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  hex: '#E67E22', hexLight: '#ffedd5' },  // 1  Carrot orange
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hex: '#2ECC71', hexLight: '#d1fae5' },  // 2  Emerald green
  { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     hex: '#E74C3C', hexLight: '#fee2e2' },  // 3  Alizarin red
  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  hex: '#9B59B6', hexLight: '#f3e8ff' },  // 4  Amethyst purple
  { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    hex: '#1ABC9C', hexLight: '#ccfbf1' },  // 5  Turquoise
  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   hex: '#F39C12', hexLight: '#fef3c7' },  // 6  Sunflower amber
  { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    hex: '#E91E8C', hexLight: '#fce7f3' },  // 7  Vibrant pink
  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  hex: '#5C6BC0', hexLight: '#e0e7ff' },  // 8  Indigo
  { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    hex: '#00BCD4', hexLight: '#cffafe' },  // 9  Cyan
  { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    hex: '#C0392B', hexLight: '#ffe4e6' },  // 10 Pomegranate
  { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     hex: '#0288D1', hexLight: '#e0f2fe' },  // 11 Sky blue
  { bg: 'bg-lime-50',    text: 'text-lime-700',    border: 'border-lime-200',    hex: '#8BC34A', hexLight: '#ecfccb' },  // 12 Lime green
  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  hex: '#8E44AD', hexLight: '#ede9fe' },  // 13 Wisteria violet
  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200',  hex: '#F1C40F', hexLight: '#fef9c3' },  // 14 Sunflower yellow
  { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   hex: '#16A085', hexLight: '#dcfce7' },  // 15 Green Sea teal
];

/** Fast djb2-style hash — always returns the same index for the same string */
function hashIndex(str) {
  if (!str) return 0;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h % PALETTE.length;
}

/**
 * Returns the full color slot for an industry name.
 * @param {string} industry
 * @returns {{ bg, text, border, hex, hexLight }}
 */
export function getIndustryColor(industry) {
  return PALETTE[hashIndex(industry || 'Unknown')];
}

/**
 * Returns the Tailwind class string for an industry badge.
 * Usage: <span className={industryBadgeClass(industry)}>…</span>
 */
export function industryBadgeClass(industry) {
  const c = getIndustryColor(industry);
  return `${c.bg} ${c.text} ${c.border}`;
}

/**
 * Returns the hex color for chart fills (Recharts Cell, etc.)
 */
export function industryHex(industry) {
  return getIndustryColor(industry).hex;
}
