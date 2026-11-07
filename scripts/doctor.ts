import { createCanvas } from '@napi-rs/canvas';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { transform } from 'sucrase';
import { VectorEngine } from '../src/engine/VectorEngine.js';
import { runAsset } from '../src/engine/runner.js';
import { getStyle } from '../src/styles/registry.js';
import { flagBoolean, parseArgs } from './lib/cliArgs.js';

interface Analysis {
  width: number;
  height: number;
  /** Cor por pixel (null = transparente). */
  pixels: (string | null)[];
  opaque: number;
  colors: string[];
  bbox: { x: number; y: number; w: number; h: number } | null;
  symmetry: number;
  /** Trocas de cor entre vizinhos sem pixel de contorno entre eles. */
  changes: number;
  changesWithoutSeparator: number;
  /** Pixels opacos na borda da silhueta / pixels na borda. */
  edgePixels: number;
  edgeWithInk: number;
  dominantRatio: number;
  ink: string;
  /** Salto medio da borda da silhueta entre linhas (0 = retangular e liso). */
  jaggedness: number;
  /** Fracao de linhas com salto maior que 1 px. */
  jaggedRatio: number;
}

const SET_STYLE_RE = /setStyle\(\s*['"]([^'"]+)['"]\s*\)/;
const SET_PALETTE_RE = /setPalette\(\s*\[([\s\S]*?)\]/;

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function analyzePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  expectedInk?: string | null,
  cellSize = 1
): Analysis {
  const pixels: (string | null)[] = new Array(width * height).fill(null);
  const counts = new Map<string, number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 10) continue;
      const color = hex(data[index], data[index + 1], data[index + 2]);
      pixels[y * width + x] = color;
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }

  let opaque = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!pixels[y * width + x]) continue;
      opaque++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const bbox = maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };

  // Trocas de cor entre vizinhos.
  let changes = 0;
  let changesWithoutSeparator = 0;
  let edgePixels = 0;
  let edgeWithInk = 0;

  const sortedColors = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const dominant = sortedColors[0]?.[0] ?? '#000000';
  const ink = (expectedInk && analysis_has(expectedInk, counts) ? expectedInk : guessInk(sortedColors));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = pixels[y * width + x];
      if (!color) continue;

      const right = x + 1 < width ? pixels[y * width + x + 1] : undefined;
      const bottom = y + 1 < height ? pixels[(y + 1) * width + x] : undefined;

      for (const neighbor of [right, bottom]) {
        if (neighbor === undefined) continue;
        if (neighbor === color) continue;

        changes++;
        if (neighbor !== ink && color !== ink) changesWithoutSeparator++;

        if (neighbor === null) {
          edgePixels++;
          if (color === ink) edgeWithInk++;
        }
      }
    }
  }

  // Simetria (metade esquerda vs direita espelhada).
  let symmetry = 1;
  if (bbox && bbox.w > 1) {
    let match = 0;
    let total = 0;
    for (let y = bbox.y; y < bbox.y + bbox.h; y++) {
      for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
        const mirror = bbox.x + bbox.w - 1 - (x - bbox.x);
        const a = pixels[y * width + x];
        const b = pixels[y * width + mirror];
        total++;
        if (a === b) match++;
      }
    }
    symmetry = total > 0 ? match / total : 1;
  }

  const dominantCount = counts.get(dominant) ?? 0;

  // Irregularidade da silhueta: quanto a borda esquerda/direita "salta" entre
  // linhas. Silhueta lisa tem few transicoes; mapa ralo (padEnd) salta toda linha.
  let jaggedness = 0;
  let jaggedRows = 0;
  let rows = 0;
  if (bbox) {
    let previousLeft: number | null = null;
    let previousRight: number | null = null;
    for (let y = bbox.y; y < bbox.y + bbox.h; y++) {
      let left = -1;
      let right = -1;
      for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
        if (!pixels[y * width + x]) continue;
        if (left === -1) left = x;
        right = x;
      }
      if (left === -1) continue;
      rows++;
      if (previousLeft !== null && previousRight !== null) {
        const jumpCells =
          (Math.abs(left - previousLeft) + Math.abs(right - previousRight)) / cellSize;
        jaggedness += jumpCells;
        if (jumpCells > 1) jaggedRows++;
      }
      previousLeft = left;
      previousRight = right;
    }
    jaggedness = rows > 1 ? jaggedness / (rows - 1) : 0;
  }
  const jaggedRatio = rows > 1 ? jaggedRows / (rows - 1) : 0;

  return {
    width,
    height,
    pixels,
    opaque,
    colors: Array.from(counts.keys()),
    bbox,
    symmetry,
    changes,
    changesWithoutSeparator,
    edgePixels,
    edgeWithInk,
    dominantRatio: opaque > 0 ? dominantCount / opaque : 0,
    ink,
    jaggedness,
    jaggedRatio,
  };
}

function analysis_has(color: string, counts: Map<string, number>): boolean {
  return counts.has(color.toUpperCase());
}

/** A cor de contorno e a mais escura presente no asset. */
function guessInk(sortedColors: [string, number][]): string {
  let darkest = sortedColors[0]?.[0] ?? '#000000';
  let lowest = Infinity;
  for (const [color] of sortedColors) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (value < lowest) {
      lowest = value;
      darkest = color;
    }
  }
  return darkest;
}

/** Extrai as linhas do mapa de uma chamada drawPixelMap no fonte. */
function extractMapRows(source: string): string[][] {
  const maps: string[][] = [];
  let searchFrom = 0;

  while (true) {
    const index = source.indexOf('drawPixelMap(', searchFrom);
    if (index === -1) break;
    searchFrom = index + 1;

    const open = source.indexOf('[', index);
    if (open === -1) break;

    let depth = 0;
    let close = -1;
    for (let i = open; i < source.length; i++) {
      const char = source[i];
      if (char === '[') depth++;
      else if (char === ']') {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) break;

    const slice = source.slice(open, close);
    const rows = [...slice.matchAll(/'([^']*)'/g)].map((match) => match[1]);
    if (rows.length > 0) maps.push(rows);
  }

  return maps;
}

async function loadAssetPixels(
  sourcePath: string,
  expectedInk?: string | null,
  gridCols = 0
): Promise<Analysis> {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  const source = readFileSync(sourcePath, 'utf-8');

  const compiled = transform(source, { transforms: ['typescript'] }).code;
  const executableCode = compiled
    .replace(/export\s+function\s+generateAsset/, 'return function')
    .replace(/function\s+generateAsset/, 'return function');

  const builder = new Function(executableCode)();
  if (typeof builder !== 'function') {
    throw new Error('O arquivo precisa exportar generateAsset(ctx: VectorContext).');
  }

  const engine = new VectorEngine(ctx as unknown as CanvasRenderingContext2D);
  runAsset(engine, builder);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const scale = gridCols > 0 ? canvas.width / gridCols : 1;
  return analyzePixels(image.data, canvas.width, canvas.height, expectedInk, scale);
}

function loadPngPixels(
  pngPath: string,
  expectedInk?: string | null,
  gridCols = 0
): Promise<Analysis> {
  return (async () => {
    const { loadImage } = await import('@napi-rs/canvas');
    const image = await loadImage(pngPath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, image.width, image.height).data;
    const scale = gridCols > 0 ? image.width / gridCols : 1;
    return analyzePixels(data, image.width, image.height, expectedInk, scale);
  })();
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const target = positional[0];

  if (!target) {
    console.error('Uso: npm run doctor <asset.ts | preview.png> [--strict]');
    process.exit(1);
  }

  const filePath = path.resolve(target);
  if (!existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  const isPng = filePath.toLowerCase().endsWith('.png');
  const source = isPng ? '' : readFileSync(filePath, 'utf-8');

  const styleId = source ? (source.match(SET_STYLE_RE)?.[1] ?? null) : null;
  const style = styleId ? getStyle(styleId) : undefined;
  const paletteMatch = source.match(SET_PALETTE_RE);
  const activePalette = paletteMatch
    ? [...paletteMatch[1].matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toUpperCase())
    : null;

  const palette = activePalette ?? (style && style.family === 'pixel' ? style.palette : null);
  const expectedInk = style && style.family === 'pixel' ? style.outlineColor : null;

  const gridCols = style && style.family === 'pixel' ? style.cols : 0;

  let analysis: Analysis;
  try {
    analysis = isPng
      ? await loadPngPixels(filePath, expectedInk, gridCols)
      : await loadAssetPixels(filePath, expectedInk, gridCols);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(path.relative(process.cwd(), filePath));
    console.log(`  estilo: ${styleId ?? '(não detectado)'}`);
    console.log('');
    console.log(`  ✗ o asset não renderiza: ${message}`);
    console.log('');
    console.log('  1 falha(s). Corrija e rode de novo.');
    process.exit(1);
  }

  const failures: string[] = [];
  const warnings: string[] = [];

  console.log(path.relative(process.cwd(), filePath));
  console.log(
    `  estilo: ${styleId ?? '(não detectado)'}${activePalette ? '  |  paleta ativa: setPalette' : ''}`
  );
  console.log(`  tamanho: ${analysis.width}x${analysis.height}`);
  console.log('');

  // 1) Mapa irregular (estatico).
  if (!isPng) {
    const maps = extractMapRows(source);
    maps.forEach((rows, mapIndex) => {
      const widths = rows.map((row) => row.length);
      const expected = widths[0];
      const invalid = widths
        .map((width, index) => ({ width, index }))
        .filter((entry) => entry.width !== expected);
      if (invalid.length > 0) {
        const detail = invalid
          .map((entry) => `linha ${entry.index + 1} tem ${entry.width}`)
          .join(', ');
        failures.push(
          `mapa irregular (mapa ${mapIndex + 1}): todas as linhas precisam ter ${expected} colunas — ${detail}`
        );
      }
    });
  }

  // 2) Cores fora da paleta ativa.
  if (palette && palette.length > 0) {
    const outside = analysis.colors.filter((color) => !palette.includes(color));
    if (outside.length > 0) {
      failures.push(
        `paleta: ${outside.length} cor(es) fora da paleta ativa (${outside.join(', ')})`
      );
    }
  }

  // 3) Contorno externo.
  if (analysis.edgePixels > 0) {
    const ratio = analysis.edgeWithInk / analysis.edgePixels;
    if (ratio < 0.6) {
      failures.push(
        `contorno externo: só ${Math.round(ratio * 100)}% da borda usa a cor de contorno`
      );
    }
  }

  // 4) Separacao interna.
  if (analysis.changes > 0) {
    const ratio = analysis.changesWithoutSeparator / analysis.changes;
    if (ratio > 0.5) {
      warnings.push(
        `separação interna: ${analysis.changesWithoutSeparator} de ${analysis.changes} trocas de cor sem pixel de contorno (use ctx.separatePixels)`
      );
    }
  }

  // 5) Irregularidade da silhueta (mapa ralo com padding).
  if (analysis.jaggedRatio > 0.35) {
    failures.push(
      `silhueta irregular: ${Math.round(analysis.jaggedRatio * 100)}% das linhas mudam a borda em mais de 1 px (mapa com linhas de tamanhos diferentes)`
    );
  }

  // 6) Informativos.
  const symmetry = analysis.symmetry;
  if (symmetry < 0.6) {
    warnings.push(`simetria: ${symmetry.toFixed(2)} (sprite assimétrico)`);
  }

  const density = 1 - analysis.dominantRatio;
  const maxColors = style && style.family === 'pixel' ? style.maxColors : 0;

  console.log(
    `  ✓ ${analysis.colors.length} cores distintas${maxColors ? ` (limite do preset: ${maxColors})` : ''}`
  );
  if (maxColors && analysis.colors.length > maxColors) {
    failures.push(
      `cores: ${analysis.colors.length} cores distintas (limite do preset: ${maxColors})`
    );
  }
  console.log(
    `  ${symmetry >= 0.6 ? '✓' : '⚠'} simetria: ${symmetry.toFixed(2)}`
  );
  if (analysis.bbox) {
    console.log(
      `  ✓ sprite: ${analysis.bbox.w}x${analysis.bbox.h} px (bbox), ${analysis.opaque} px opacos`
    );
  }
  console.log(`  ✓ detalhes: ${Math.round(density * 100)}% dos pixels`);
  console.log(
    `  ✓ silhueta: ${Math.round(analysis.jaggedRatio * 100)}% das linhas com salto (salto medio ${analysis.jaggedness.toFixed(2)} px)`
  );

  for (const warning of warnings) console.log(`  ⚠ ${warning}`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);

  console.log('');
  if (failures.length > 0) {
    console.log(`  ${failures.length} falha(s). Corrija e rode de novo.`);
  } else {
    console.log('  Tudo certo.');
  }

  if (failures.length > 0 || (flagBoolean(flags, 'strict') && warnings.length > 0)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
