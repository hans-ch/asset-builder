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
  /** Areas dos componentes conexos (maior primeiro) — diagnostico. */
  componentAreas: number[];
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
 * Remove o fundo chapado da imagem (IA costuma gerar fundo solido).
 * A comparacao usa tolerancia, porque imagens geradas por IA tem ruido leve.
 */
export function removeBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number
): string | null {
  const border: Rgba[] = [];
  const stepX = Math.max(1, Math.floor(width / 64));
  const stepY = Math.max(1, Math.floor(height / 64));

  for (let x = 0; x < width; x += stepX) {
    border.push(pixelAt(data, width, x, 0));
    border.push(pixelAt(data, width, x, height - 1));
  }
  for (let y = 0; y < height; y += stepY) {
    border.push(pixelAt(data, width, 0, y));
    border.push(pixelAt(data, width, width - 1, y));
  }

  // Cor dominante da borda (quantizada em blocos de 16 para ignorar ruido).
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (const pixel of border) {
    const key = `${pixel.r >> 4},${pixel.g >> 4},${pixel.b >> 4}`;
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count++;
    bucket.r += pixel.r;
    bucket.g += pixel.g;
    bucket.b += pixel.b;
    buckets.set(key, bucket);
  }

  let dominant: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!dominant || bucket.count > dominant.count) dominant = bucket;
  }
  if (!dominant || dominant.count / border.length < 0.55) return null;

  const target = {
    r: dominant.r / dominant.count,
    g: dominant.g / dominant.count,
    b: dominant.b / dominant.count,
  };

  // Tolerancia generosa: so o fundo CONECTADO as bordas e removido, entao o
  // personagem (isolado no centro) sobrevive mesmo com cores proximas.
  const tolerance = 140;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  // Semeia a borda com os pixels parecidos com a cor dominante.
  const isBackgroundish = (pixel: Rgba): boolean =>
    Math.abs(pixel.r - target.r) +
      Math.abs(pixel.g - target.g) +
      Math.abs(pixel.b - target.b) <=
    tolerance;

  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const index = y * width + x;
      if (visited[index]) continue;
      visited[index] = 1;
      if (isBackgroundish(pixelAt(data, width, x, y))) queue.push(index);
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const index = y * width + x;
      if (visited[index]) continue;
      visited[index] = 1;
      if (isBackgroundish(pixelAt(data, width, x, y))) queue.push(index);
    }
  }

  // Flood fill: so remove o fundo conectado as bordas (preserva o personagem).
  let removed = 0;
  while (queue.length > 0) {
    const index = queue.pop() as number;
    const x = index % width;
    const y = (index - x) / width;

    data[index * 4 + 3] = 0;
    removed++;

    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIndex = ny * width + nx;
      if (visited[nIndex]) continue;
      visited[nIndex] = 1;
      if (!isBackgroundish(pixelAt(data, width, nx, ny))) continue;
      queue.push(nIndex);
    }
  }

  if (removed / (width * height) < 0.05) return null;

  return `#${[target.r, target.g, target.b]
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/**
 * Posteriza a grade: reduz as cores distintas para no maximo `maxColors`
 * usando median cut (necessario para pixel art de IA, que tem antialias).
 */
export function posterize(grid: (string | null)[][], maxColors: number): (string | null)[][] {
  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const color of row) {
      if (!color) continue;
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }

  if (counts.size <= maxColors) return grid;

  type Box = { colors: string[]; rMin: number; rMax: number; gMin: number; gMax: number; bMin: number; bMax: number };

  const makeBox = (colors: string[]): Box => {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const color of colors) {
      const rgba = parseColor(color);
      rMin = Math.min(rMin, rgba.r); rMax = Math.max(rMax, rgba.r);
      gMin = Math.min(gMin, rgba.g); gMax = Math.max(gMax, rgba.g);
      bMin = Math.min(bMin, rgba.b); bMax = Math.max(bMax, rgba.b);
    }
    return { colors, rMin, rMax, gMin, gMax, bMin, bMax };
  };

  const boxes: Box[] = [makeBox(Array.from(counts.keys()))];

  while (boxes.length < maxColors) {
    let target = -1;
    let widest = -1;
    let widestChannel: 'r' | 'g' | 'b' = 'r';

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.colors.length < 2) continue;
      const spans = [
        { channel: 'r' as const, size: box.rMax - box.rMin },
        { channel: 'g' as const, size: box.gMax - box.gMin },
        { channel: 'b' as const, size: box.bMax - box.bMin },
      ];
      for (const span of spans) {
        if (span.size > widest) {
          widest = span.size;
          target = i;
          widestChannel = span.channel;
        }
      }
    }

    if (target === -1 || widest <= 0) break;

    const box = boxes[target];
    const sorted = box.colors.slice().sort((a, b) => {
      const ca = parseColor(a);
      const cb = parseColor(b);
      return ca[widestChannel] - cb[widestChannel];
    });
    const middle = Math.floor(sorted.length / 2);
    boxes.splice(
      target,
      1,
      makeBox(sorted.slice(0, middle)),
      makeBox(sorted.slice(middle))
    );
  }

  // Representante de cada box: a cor mais comum (empate pela mais clara).
  const mapping = new Map<string, string>();
  for (const box of boxes) {
    let best = box.colors[0];
    let bestCount = -1;
    for (const color of box.colors) {
      const count = counts.get(color) ?? 0;
      if (count > bestCount) {
        bestCount = count;
        best = color;
      }
    }
    for (const color of box.colors) mapping.set(color, best);
  }

  return grid.map((row) => row.map((color) => (color ? mapping.get(color) ?? color : color)));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Detecta o tamanho da celula pelo GCD dos "runs" de cor.
 * Metodo robusto para pixel art gerado por IA (que tem antialias e bordas suaves).
 */
function detectCellSizeByRuns(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number {
  const mass = new Map<number, number>();

  for (let y = 0; y < height; y++) {
    let run = 1;
    for (let x = 1; x <= width; x++) {
      const same =
        x < width && sameColor(pixelAt(data, width, x, y), pixelAt(data, width, x - 1, y));
      if (same) {
        run++;
        continue;
      }
      if (run >= 2) mass.set(run, (mass.get(run) ?? 0) + run);
      run = 1;
    }
  }

  if (mass.size === 0) return 1;

  const entries = Array.from(mass.entries()).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let accumulated = 0;
  const keep: number[] = [];

  for (const [length, value] of entries) {
    keep.push(length);
    accumulated += value;
    if (accumulated >= total * 0.7) break;
  }

  let result = 0;
  for (const length of keep) result = gcd(result, length);
  return result >= 2 ? result : 1;
}

/** Fracao de blocos nao transparentes que sao monocromaticos. */
function monoRatio(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cell: number
): number {
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

  return occupied === 0 ? 0 : monochrome / occupied;
}

/** Fracao das fronteiras de cor que caem em multiplos de `cell`. */
function edgeAlignment(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cell: number
): number {
  const edges: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const current = pixelAt(data, width, x, y);
      if (isTransparent(current)) continue;

      const right = x + 1 < width ? pixelAt(data, width, x + 1, y) : null;
      if (!right || isTransparent(right) || !sameColor(current, right)) edges.push(x + 1);

      const bottom = y + 1 < height ? pixelAt(data, width, x, y + 1) : null;
      if (!bottom || isTransparent(bottom) || !sameColor(current, bottom)) edges.push(y + 1);
    }
  }

  if (edges.length < 8) return 0;
  const aligned = edges.filter((position) => position % cell === 0).length;
  return aligned / edges.length;
}

/**
 * Detecta o tamanho da celula (upscale) da imagem.
 *
 * Duas estrategias combinadas por score (monoRatio x alignment):
 *  1. GCD dos runs de cor (pixel art gerado por IA, com antialias);
 *  2. alinhamento das fronteiras (sprite nativo ou upscale perfeito).
 */
export function detectCellSize(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number {
  const maxCell = Math.min(128, Math.floor(Math.min(width, height) / 2));
  if (maxCell < 2) return 1;

  const candidates = new Set<number>();

  const byRuns = detectCellSizeByRuns(data, width, height);
  if (byRuns >= 2) {
    candidates.add(byRuns);
    candidates.add(byRuns * 2);
    candidates.add(Math.max(2, Math.round(byRuns / 2)));
  }

  const edges: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const current = pixelAt(data, width, x, y);
      if (isTransparent(current)) continue;
      const right = x + 1 < width ? pixelAt(data, width, x + 1, y) : null;
      if (!right || isTransparent(right) || !sameColor(current, right)) edges.push(x + 1);
      const bottom = y + 1 < height ? pixelAt(data, width, x, y + 1) : null;
      if (!bottom || isTransparent(bottom) || !sameColor(current, bottom)) edges.push(y + 1);
    }
  }
  if (edges.length >= 8) {
    for (let cell = Math.min(maxCell, 64); cell >= 2; cell--) {
      const aligned = edges.filter((position) => position % cell === 0).length;
      if (aligned / edges.length >= 0.98) {
        candidates.add(cell);
        break;
      }
    }
  }

  let best = 1;
  let bestScore = 0;

  for (const cell of candidates) {
    if (cell < 2 || cell > maxCell) continue;
    const score =
      monoRatio(data, width, height, cell) * edgeAlignment(data, width, height, cell);
    if (score > bestScore) {
      bestScore = score;
      best = cell;
    }
  }

  return best;
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
  /** Remove o fundo chapado (padrao: true). */
  removeBackground?: boolean;
  /**
   * Mantem apenas os componentes relevantes (>= 25% do maior).
   * Remove textos e pose extras de folhas de referencia (padrao: true).
   */
  keepMain?: boolean;
  /** Limite de colunas da grade (o tamanho da celula e ajustado). */
  maxCols?: number;
  /** Limite de cores distintas apos posterizacao (padrao: 24). */
  maxColors?: number;
  /** Fracao minima do maior componente a ser mantida (padrao: 0.45). */
  keepRatio?: number;
}

/** Remove componentes pequenos (texto, pose extras) da grade. */
function keepMainComponents(
  grid: (string | null)[][],
  ratio: number
): { grid: (string | null)[][]; areas: number[] } {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const seen = new Uint8Array(cols * rows);
  const components: number[][] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const index = y * cols + x;
      if (seen[index] || !grid[y][x]) continue;

      const cells: number[] = [];
      const stack = [index];
      seen[index] = 1;

      while (stack.length > 0) {
        const current = stack.pop() as number;
        cells.push(current);
        const cx = current % cols;
        const cy = (current - cx) / cols;

        for (const [nx, ny] of [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ]) {
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const nIndex = ny * cols + nx;
          if (seen[nIndex] || !grid[ny][nx]) continue;
          seen[nIndex] = 1;
          stack.push(nIndex);
        }
      }

      components.push(cells);
    }
  }

  if (components.length <= 1) return { grid, areas: components.map((c) => c.length) };

  const largest = Math.max(...components.map((cells) => cells.length));
  const keep = new Set<number>();
  for (const cells of components) {
    if (cells.length >= largest * ratio) {
      for (const cell of cells) keep.add(cell);
    }
  }

  const result = grid.map((row) => row.map(() => null as string | null));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (keep.has(y * cols + x)) result[y][x] = grid[y][x];
    }
  }
  return { grid: result, areas: components.map((cells) => cells.length) };
}

/**
 * Extrai a grade (matriz de cores) de uma imagem pixel art.
 */
export async function extractGrid(
  pngPath: string,
  options: ExtractOptions = {}
): Promise<ExtractedGrid> {
  const { width, height, data } = await toImageData(pngPath);

  if (options.removeBackground !== false) {
    removeBackground(data, width, height);
  }

  const maxCols = options.maxCols ?? 48;
  let cell = options.cell ?? detectCellSize(data, width, height);
  while (Math.floor(width / cell) > maxCols && cell < 512) cell++;

  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);

  // 1) Uma cor por celula (a mais comum do bloco).
  let grid: (string | null)[][] = [];
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

  // 1b) Descarta texto e pose extras (folhas de referencia).
  let componentAreas: number[] = [];
  if (options.keepMain !== false) {
    const kept = keepMainComponents(grid, options.keepRatio ?? 0.45);
    grid = kept.grid;
    componentAreas = kept.areas.sort((a, b) => b - a);
  }

  // 1c) Posteriza: reduz as cores (pixel art de IA tem antialias).
  grid = posterize(grid, options.maxColors ?? 24);

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
    componentAreas,
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
          if (nx < 0 || ny < 0 || nx >= grid[0].length || ny >= grid.length) continue;
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
