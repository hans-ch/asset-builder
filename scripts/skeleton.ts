import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { nearestInPalette } from '../src/engine/pixel/color.js';
import { getStyle } from '../src/styles/registry.js';
import { flagBoolean, flagNumber, flagString, parseArgs } from './lib/cliArgs.js';
import { buildGuideImage } from './lib/guideImage.js';
import { extractGrid, type ExtractedGrid } from './lib/pngToGrid.js';
import { buildSkeletonDoc } from './lib/skeletonDoc.js';

const ROOT = process.cwd();

function basenameNoExt(file: string): string {
  return path.basename(file).replace(/\.[^.]+$/, '');
}

function toKebab(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateOne(
  pngPath: string,
  options: {
    pose: string;
    name: string;
    styleId?: string;
    cell?: number;
    trim: boolean;
    outDir: string;
    guide: boolean;
    maxColors?: number;
    maxCols?: number;
  }
): Promise<void> {
  const grid: ExtractedGrid = await extractGrid(pngPath, {
    cell: options.cell,
    trim: options.trim,
    maxColors: options.maxColors,
    maxCols: options.maxCols,
  });

  const style = options.styleId ? getStyle(options.styleId) : undefined;
  const presetPalette: Record<string, string> = {};
  if (style && style.family === 'pixel') {
    for (const [char, hex] of Object.entries(grid.palette)) {
      presetPalette[char] = nearestInPalette(hex, style.palette);
    }
  }

  const doc = buildSkeletonDoc({
    id: options.name,
    pose: options.pose,
    source: path.relative(ROOT, pngPath).replace(/\\/g, '/'),
    grid,
    presetPalette,
    presetLabel: style?.label,
    canvas: style && style.family === 'pixel' ? { cols: style.cols, rows: style.rows, label: style.label } : undefined,
  });

  mkdirSync(options.outDir, { recursive: true });

  if (process.env.SKELETON_DEBUG) {
    console.log(
      `  componentes (celulas): ${grid.componentAreas.slice(0, 12).join(', ')}${
        grid.componentAreas.length > 12 ? ' ...' : ''
      }`
    );
  }

  const docPath = path.join(options.outDir, `${options.name}.md`);
  writeFileSync(docPath, doc, 'utf-8');
  console.log(`✓ ${path.relative(ROOT, docPath)} (${grid.cols}x${grid.rows}, célula ${grid.cell}px)`);

  if (options.guide) {
    const guidePath = path.join(options.outDir, `${options.name}-guia.png`);
    await buildGuideImage(pngPath, guidePath, grid);
    console.log(`✓ ${path.relative(ROOT, guidePath)}`);
  }
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const target = positional[0];

  if (!target) {
    console.error(
      'Uso: npm run skeleton <png> [--pose front] [--name x] [--style pixel-pokemon-gba] [--cell n] [--no-trim] [--no-guide]'
    );
    process.exit(1);
  }

  const pngPath = path.resolve(target);
  if (!existsSync(pngPath)) {
    console.error(`Arquivo não encontrado: ${pngPath}`);
    process.exit(1);
  }

  const name = toKebab(flagString(flags, 'name', basenameNoExt(pngPath)));
  const pose = flagString(flags, 'pose', 'frente');
  const styleId = flagString(flags, 'style', '');
  const cell = flagNumber(flags, 'cell');
  const trim = !flagBoolean(flags, 'no-trim');
  const guide = !flagBoolean(flags, 'no-guide');
  const maxColors = flagNumber(flags, 'max-colors');
  const maxCols = flagNumber(flags, 'max-cols');
  const outDir = path.resolve(flagString(flags, 'out-dir', path.join(ROOT, 'styles', 'skeletons')));

  await generateOne(pngPath, {
    pose,
    name,
    styleId: styleId || undefined,
    cell,
    trim,
    outDir,
    guide,
    maxColors,
    maxCols,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
