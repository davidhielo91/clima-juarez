#!/usr/bin/env node
/**
 * Comprobación de contraste de los tokens de color.
 *
 * Lee los valores REALES de `src/app/globals.css` en lugar de repetirlos aquí: si
 * alguien cambia un color, esta comprobación lo detecta. Aplica la fórmula de
 * luminancia relativa de WCAG 2.1 y exige 4.5:1, que es el mínimo para texto
 * normal — y casi todo el texto de este panel es pequeño (10 a 13 px), así que no
 * vale acogerse a la excepción de texto grande.
 *
 * Uso:  node scripts/check-contrast.mjs
 * Sale con código 1 si algún color de texto no alcanza el mínimo.
 */

import { readFile } from "node:fs/promises";

const CSS = new URL("../src/app/globals.css", import.meta.url);
const MIN_RATIO = 4.5;
/** Superficies sobre las que se pinta texto. */
const SURFACES = ["night-950", "night-900", "night-800"];
/** Colores que se usan como color de texto en la interfaz. */
const TEXT_TOKENS = [
  "ink",
  "ink-soft",
  "ink-dim",
  "amber",
  "cold",
  "tone-good",
  "tone-info",
  "tone-caution",
  "tone-warn",
  "tone-danger",
  "tone-extreme",
];

function parseTokens(css) {
  const tokens = {};
  const pattern = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
  let match;
  while ((match = pattern.exec(css)) !== null) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

function toRgb(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/** Luminancia relativa según WCAG 2.1. */
function luminance(hex) {
  const channels = toRgb(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const css = await readFile(CSS, "utf8");
const tokens = parseTokens(css);

const missing = [...SURFACES, ...TEXT_TOKENS].filter((name) => !tokens[name]);
if (missing.length > 0) {
  console.error(`No se encontraron estos tokens en globals.css: ${missing.join(", ")}`);
  process.exit(1);
}

const failures = [];
console.log(`Mínimo exigido: ${MIN_RATIO}:1 (texto normal, WCAG 2.1 AA)\n`);
console.log(
  `${"color".padEnd(14)}${SURFACES.map((s) => s.padStart(12)).join("")}`,
);

for (const token of TEXT_TOKENS) {
  const cells = SURFACES.map((surface) => {
    const ratio = contrast(tokens[token], tokens[surface]);
    return { surface, ratio };
  });

  console.log(
    `${token.padEnd(14)}${cells
      .map((cell) => `${cell.ratio.toFixed(2)}:1`.padStart(12))
      .join("")}`,
  );

  // night-800 solo se usa como fondo de pista y de esqueletos, no detrás de
  // texto corrido; se informa pero no se exige.
  for (const cell of cells) {
    if (cell.surface === "night-800") continue;
    if (cell.ratio < MIN_RATIO) {
      failures.push(
        `${token} sobre ${cell.surface}: ${cell.ratio.toFixed(2)}:1 < ${MIN_RATIO}:1`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`\nFallan ${failures.length} combinaciones:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(
  "\nTodos los colores de texto alcanzan el mínimo sobre las superficies donde se usan.",
);
