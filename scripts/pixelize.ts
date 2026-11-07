import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { nearestInPalette } from '../src/engine/pixel/color.js';
import { getStyle } from '../src/styles/registry.js';
import { flagNumber, flagString, parseArgs } from './lib/cliArgs.js';
import { extractGrid } from './lib/pngToGrid.js';

/**
 * Converte uma imagem de referencia em um asset pixel art editavel.
 *
 * O `.ts` gerado contem o mapa ASCII + a paleta: o agente (ou o usuario) so
 * precisa ajustar cores e detalhes, sem redesenhar a grade.
 */
async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const target = positional[0];

  if (!target) {
    console.error(
      'Uso: npm run pixelize <png> [--style pixel-pokemon-gba] [--out asset.ts] [--cell n]'
    );
    process.exit(1);
  }

  const pngPath = path.resolve(target);
  const styleId = flagString(flags, 'style', 'pixel-generic');
  const style = getStyle(styleId);
  if (!style) {
    console.error(`Estilo desconhecido: ${styleId}`);
    process.exit(1);
  }
  if (style.family !== 'pixel') {
    console.error(`O estilo ${styleId} não é de pixel art.`);
    process.exit(1);
  }

  const cell = flagNumber(flags, 'cell');
  const grid = await extractGrid(pngPath, { cell, trim: true });

  // Cores da referencia aproximadas para a paleta do preset.
  const mapped: Record<string, string> = {};
  for (const [char, hex] of Object.entries(grid.palette)) {
    mapped[char] = nearestInPalette(hex, style.palette);
  }

  const paletteValues = Array.from(new Set(Object.values(mapped)));
  const name = path.basename(pngPath).replace(/\.[^.]+$/, '');

  const outPath = path.resolve(
    flagString(flags, 'out', path.join(process.cwd(), 'asset_gen', `pixelizado_${name}_01`, `${name}.ts`))
  );

  const x = Math.floor((style.cols - grid.cols) / 2);
  const y = Math.floor((style.rows - grid.rows) / 2);

  const lines: string[] = [];
  lines.push(`// Prompt: referencia ${path.basename(pngPath)}`);
  lines.push(`// Estilo: ${style.id}`);
  lines.push(`// Asset: ${name}`);
  lines.push(`// Gerado em: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('export function generateAsset(ctx: VectorContext) {');
  lines.push(`  ctx.setStyle('${style.id}');`);
  lines.push(`  ctx.setPalette([${paletteValues.map((c) => `'${c}'`).join(', ')}]);`);
  lines.push('');
  lines.push('  ctx.drawPixelMap(');
  lines.push('    [');
  for (const row of grid.map) lines.push(`      '${row}',`);
  lines.push('    ],');
  lines.push(`    { ${Object.entries(mapped).map(([char, hex]) => `${char}: '${hex}'`).join(', ')} },`);
  lines.push(`    { x: ${x}, y: ${y} }`);
  lines.push('  );');
  lines.push('}');
  lines.push('');

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join('\n'), 'utf-8');

  console.log(`✓ ${path.relative(process.cwd(), outPath)} (${grid.cols}x${grid.rows})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
