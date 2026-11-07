import { createCanvas, loadImage } from '@napi-rs/canvas';
import { luminance, parseColor } from '../../src/engine/pixel/color.js';

/** Regiao conexa (mesma cor) dentro da grade. */
export interface GridRegion {
  color: string;
  char: string;
  /** Posicao relativa em % do canvas (0-100), util para o esqueleto vetorial. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Area em celulas. */
  area: number;
}

export interface ExtractedGrid {
  /** Dimensoes da grade ja recortada (em celulas). */
  cols: number;
  rows: number;
  /** Tamanho da celula em pixels da imagem de origem. */
  cell: number;
  /** Dimensoes da imagem de origem. */
  imageWidth: number;
  imageHeight: number;
  /** Bbox do sprite recortado (em celulas, coordenadas da grade cheia). */
  bbox: { x: number; y: number; w: number; h: number };
  /** Mapa ASCII (linhas do recorte). */
  map: string[];
  /** char -> hex. */
  palette: Record<string, string>;
  /** char -> papel sugerido. */
  roles: Record<string, string>;
  /** Cores distintas (ordem de papel). */
  colors: string[];
  /** Regioes conexas (para o esqueleto vetorial). */
  regions: GridRegion[];
}

const CHAR_POOL = 'cefgijkmnpqrstuv';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function readImage(path: string) {
  return loadImage(path);
}

async function toImageData(path: string) {
  const image = await readImage(path);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, image.width, image.height).data;
  return { width: image.width, height: image.height, data };
}

function pixelAt(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number
): Rgba {
  const index = (y * width + x) * 4;
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3],
  };
}

function isTransparent(pixel: Rgba): boolean {
  return pixel.a < 10;
}

function sameColor(a: Rgba, b: Rgba): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

/**
 * Detecta o tamanho da celula (upscale) da imagem.
 *
 * Criterio: o maior `c` para o qual (a) as fronteiras de cor caem em multiplos de `c`
 * e (b) todos os blocos nao transparentes sao monocromaticos.
 * Funciona tanto para sprite nativo (c = 1) quanto para upscale (ex.: 448/56 = 8).
 */
export function detectCellSize(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number {
  const maxCell = Math.min(64, Math.floor(Math.min(width, height) / 2));
  if (maxCell < 2) return 1;

  // Fronteiras de cor (posicao onde a cor muda).
  const edges: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const current = pixelAt(data, width, x, y);
      if (isTransparent(current)) continue;

      const right = x + 1 < width ? pixelAt(data, width, x + 1, y) : null;
      if (!right || isTransparent(right) || !sameColor(current, right)) {
        edges.push(x + 1);
      }

      const bottom = y + 1 < height ? pixelAt(data, width, x, y + 1) : null;
      if (!bottom || isTransparent(bottom) || !sameColor(current, bottom)) {
        edges.push(y + 1);
      }
    }
  }

  if (edges.length < 8) return 1;

  for (let cell = maxCell; cell >= 2; cell--) {
    const aligned = edges.filter((position) => position % cell === 0).length;
    const alignment = aligned / edges.length;
    if (alignment < 0.98) continue;

    let occupied = 0;
    let monochrome = 0;

    for (let cy = 0; cy + cell <= height; cy += cell) {
      for (let cx = 0; cx + cell <= width; cx += cell) {
        const first = pixelAt(data, width, cx, cy);
        if (isTransparent(first)) continue;
        occupied++;

        let solid = true;
        for (let y = cy; y < cy + cell && solid; y++) {
          for (let x = cx; x < cx + cell; x++) {
            const pixel = pixelAt(data, width, x, y);
            if (isTransparent(pixel) || !sameColor(first, pixel)) {
              solid = false;
              break;
            }
          }
        }
        if (solid) monochrome++;
      }
    }

    if (occupied === 0) continue;
    if (monochrome / occupied >= 0.98) return cell;
  }

  return 1;
}

function toHex(pixel: Rgba): string {
  const hex = (value: number) => value.toString(16).padStart(2, '0').toUpperCase();
  return `#${hex(pixel.r)}${hex(pixel.g)}${hex(pixel.b)}`;
}

export interface ExtractOptions {
  /** Forca o tamanho da celula (em px da imagem de origem). */
  cell?: number;
  /** Recorta a moldura vazia (padrao: true). */
  trim?: boolean;
}

/**
 * Extrai a grade (matriz de cores) de uma imagem pixel art.
 */
export async function extractGrid(
  pngPath: string,
  options: ExtractOptions = {}
): Promise<ExtractedGrid> {
  const { width, height, data } = await toImageData(pngPath);
  const cell = options.cell ?? detectCellSize(data, width, height);

  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);

  // 1) Uma cor por celula (a mais comum do bloco).
  const grid: (string | null)[][] = [];
  for (let cy = 0; cy < rows; cy++) {
    const row: (string | null)[] = [];
    for (let cx = 0; cx < cols; cx++) {
      const counts = new Map<string, number>();
      for (let y = cy * cell; y < (cy + 1) * cell; y++) {
        for (let x = cx * cell; x < (cx + 1) * cell; x++) {
          const pixel = pixelAt(data, width, x, y);
          if (isTransparent(pixel)) continue;
          const hex = toHex(pixel);
          counts.set(hex, (counts.get(hex) ?? 0) + 1);
        }
      }
      if (counts.size === 0) {
        row.push(null);
        continue;
      }
      let best = '';
      let bestCount = -1;
      for (const [hex, count] of counts) {
        if (count > bestCount) {
          best = hex;
          bestCount = count;
        }
      }
      row.push(best);
    }
    grid.push(row);
  }

  // 2) Recorte da moldura vazia.
  let minX = cols;
  let minY = rows;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!grid[y][x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const empty = maxX < 0;
  const bbox = empty
    ? { x: 0, y: 0, w: 0, h: 0 }
    : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };

  const trimmed: (string | null)[][] = [];
  for (let y = 0; y < bbox.h; y++) {
    trimmed.push(grid[bbox.y + y].slice(bbox.x, bbox.x + bbox.w));
  }

  // 3) Cores -> caracteres.
  const areas = new Map<string, number>();
  for (const row of trimmed) {
    for (const color of row) {
      if (!color) continue;
      areas.set(color, (areas.get(color) ?? 0) + 1);
    }
  }

  const colors = Array.from(areas.keys()).sort((a, b) => {
    const la = luminance(parseColor(a));
    const lb = luminance(parseColor(b));
    if (la !== lb) return la - lb;
    return (areas.get(b) ?? 0) - (areas.get(a) ?? 0);
  });

  const palette: Record<string, string> = {};
  const roles: Record<string, string> = {};
  const pool = CHAR_POOL.split('');
  let poolIndex = 0;

  const darkest = colors[0];
  const lightest = colors[colors.length - 1];

  if (darkest) {
    const isOutline = luminance(parseColor(darkest)) < 45;
    const char = isOutline ? 'o' : 'd';
    palette[char] = darkest;
    roles[char] = isOutline ? 'contorno' : 'sombra';
  }

  if (lightest && lightest !== darkest) {
    const isBright = luminance(parseColor(lightest)) > 195;
    const char = isBright ? 'w' : pool[poolIndex++];
    palette[char] = lightest;
    roles[char] = isBright ? 'brilho' : 'cor clara';
  }

  // A cor mais frequente vira a base; as demais seguem por luminancia.
  const remaining = colors.filter((color) => !Object.values(palette).includes(color));
  const base = remaining
    .slice()
    .sort((a, b) => (areas.get(b) ?? 0) - (areas.get(a) ?? 0))[0];

  if (base) {
    palette['b'] = base;
    roles['b'] = 'base';
  }

  for (const color of remaining) {
    if (color === base) continue;
    const char = pool[poolIndex++] ?? 'z';
    palette[char] = color;
    roles[char] = 'cor';
  }
  // 4) Mapa ASCII (recorte).
  const map: string[] = trimmed.map((row) =>
    row.map((color) => {
      if (!color) return '.';
      const entry = Object.entries(palette).find(([, hex]) => hex === color);
      return entry ? entry[0] : '.';
    }).join('')
  );

  // 5) Regioes conexas (base do esqueleto vetorial).
  const regions = findGridRegions(trimmed, palette, cols, rows, bbox);

  return {
    cols: bbox.w,
    rows: bbox.h,
    cell,
    imageWidth: width,
    imageHeight: height,
    bbox,
    map,
    palette,
    roles,
    colors: Object.values(palette),
    regions,
  };
}

function findGridRegions(
  grid: (string | null)[][],
  palette: Record<string, string>,
  fullCols: number,
  fullRows: number,
  bbox: { x: number; y: number; w: number; h: number }
): GridRegion[] {
  const seen = new Set<string>();
  const regions: GridRegion[] = [];

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const color = grid[y][x];
      if (!color) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;

      const cells: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen.add(key);

      while (stack.length > 0) {
        const [cx, cy] = stack.pop() as [number, number];
        cells.push([cx, cy]);
        const neighbors: [number, number][] = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= grid.length || ny >= grid[0].length) continue;
          if (grid[ny][nx] !== color) continue;
          const nKey = `${nx},${ny}`;
          if (seen.has(nKey)) continue;
          seen.add(nKey);
          stack.push([nx, ny]);
        }
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [cx, cy] of cells) {
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
      }

      const char = Object.entries(palette).find(([, hex]) => hex === color)?.[0] ?? '?';

      regions.push({
        color,
        char,
        x: round2(((bbox.x + minX) / fullCols) * 100),
        y: round2(((bbox.y + minY) / fullRows) * 100),
        w: round2(((maxX - minX + 1) / fullCols) * 100),
        h: round2(((maxY - minY + 1) / fullRows) * 100),
        area: cells.length,
      });
    }
  }

  return regions.sort((a, b) => b.area - a.area);
}

function round2(value: number): number {
  return Math.round(value * 10) / 10;
}
