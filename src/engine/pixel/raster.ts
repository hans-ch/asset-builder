import { PixelBuffer } from './PixelBuffer.js';
import { parseColor } from './color.js';

export type DitherPatternName = 'bayer4' | 'checker' | 'dots';

const BAYER4: number[][] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const CHECKER: number[][] = [
  [0, 1],
  [1, 0],
];

const DOTS: number[][] = [
  [0, 0],
  [1, 0],
];

/** Matriz de dithering ordenada (valores de 0 a 15). */
export function ditherPattern(name: DitherPatternName = 'bayer4'): number[][] {
  if (name === 'checker') return CHECKER;
  if (name === 'dots') return DOTS;
  return BAYER4;
}

/**
 * Preenche um poligono na grade usando o centro de cada celula (regra even-odd).
 * O resultado e sempre "crisp": nao existe antialias.
 */
export function fillPolygon(buffer: PixelBuffer, points: [number, number][], color: string): void {
  if (points.length < 3) return;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const yStart = Math.max(0, Math.floor(minY));
  const yEnd = Math.min(buffer.rows - 1, Math.ceil(maxY));

  for (let y = yStart; y <= yEnd; y++) {
    const centerY = y + 0.5;
    const crossings: number[] = [];

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > centerY !== yj > centerY) {
        crossings.push(xi + ((centerY - yi) / (yj - yi)) * (xj - xi));
      }
    }

    crossings.sort((a, b) => a - b);

    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const xStart = Math.max(0, Math.ceil(crossings[k] - 0.5));
      const xEnd = Math.min(buffer.cols - 1, Math.floor(crossings[k + 1] - 0.5));
      for (let x = xStart; x <= xEnd; x++) {
        buffer.set(x, y, color);
      }
    }
  }
}

/** Traca uma polilinha na grade (Bresenham), com espessura em celulas. */
export function strokePolyline(
  buffer: PixelBuffer,
  points: [number, number][],
  color: string,
  thickness = 1
): void {
  if (points.length === 0) return;
  const size = Math.max(1, Math.round(thickness));

  if (points.length === 1) {
    plot(buffer, points[0][0], points[0][1], color, size);
    return;
  }

  for (let i = 0; i + 1 < points.length; i++) {
    drawLine(buffer, points[i], points[i + 1], color, size);
  }
}

function drawLine(
  buffer: PixelBuffer,
  from: [number, number],
  to: [number, number],
  color: string,
  thickness: number
): void {
  let x = Math.round(from[0]);
  let y = Math.round(from[1]);
  const endX = Math.round(to[0]);
  const endY = Math.round(to[1]);

  const dx = Math.abs(endX - x);
  const dy = Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = dx - dy;

  while (true) {
    plot(buffer, x, y, color, thickness);
    if (x === endX && y === endY) break;
    const doubled = 2 * error;
    if (doubled > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubled < dx) {
      error += dx;
      y += stepY;
    }
  }
}

function plot(buffer: PixelBuffer, x: number, y: number, color: string, thickness: number): void {
  if (thickness <= 1) {
    buffer.set(x, y, color);
    return;
  }

  const radius = Math.floor((thickness - 1) / 2);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      buffer.set(x + dx, y + dy, color);
    }
  }
}

/** Preenche uma elipse (teste de distancia por centro de celula). */
export function fillEllipse(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string
): void {
  if (rx <= 0 || ry <= 0) return;

  const xStart = Math.max(0, Math.floor(cx - rx));
  const xEnd = Math.min(buffer.cols - 1, Math.ceil(cx + rx));
  const yStart = Math.max(0, Math.floor(cy - ry));
  const yEnd = Math.min(buffer.rows - 1, Math.ceil(cy + ry));

  for (let y = yStart; y <= yEnd; y++) {
    for (let x = xStart; x <= xEnd; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) buffer.set(x, y, color);
    }
  }
}

/** Preenche um setor circular (usado por drawArc). */
export function fillSector(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: string
): void {
  if (radius <= 0) return;

  const start = (startAngle * Math.PI) / 180;
  const end = (endAngle * Math.PI) / 180;
  const sweep = end - start;
  const full = Math.abs(sweep) >= Math.PI * 2;

  const xStart = Math.max(0, Math.floor(cx - radius));
  const xEnd = Math.min(buffer.cols - 1, Math.ceil(cx + radius));
  const yStart = Math.max(0, Math.floor(cy - radius));
  const yEnd = Math.min(buffer.rows - 1, Math.ceil(cy + radius));

  for (let y = yStart; y <= yEnd; y++) {
    for (let x = xStart; x <= xEnd; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > radius * radius) continue;

      if (full) {
        buffer.set(x, y, color);
        continue;
      }

      let angle = Math.atan2(dy, dx) - start;
      if (sweep < 0) angle += Math.PI * 2;
      angle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (angle <= Math.abs(sweep)) buffer.set(x, y, color);
    }
  }
}

/** Preenche uma estrela (teste radial). */
export function fillStar(
  buffer: PixelBuffer,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
  color: string
): void {
  const count = Math.max(2, Math.floor(points));
  const step = Math.PI / count;

  const xStart = Math.max(0, Math.floor(cx - outerR));
  const xEnd = Math.min(buffer.cols - 1, Math.ceil(cx + outerR));
  const yStart = Math.max(0, Math.floor(cy - outerR));
  const yEnd = Math.min(buffer.rows - 1, Math.ceil(cy + outerR));

  for (let y = yStart; y <= yEnd; y++) {
    for (let x = xStart; x <= xEnd; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const distance = Math.hypot(dx, dy);
      if (distance > outerR) continue;

      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      angle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const index = Math.floor(angle / step);
      const radius = index % 2 === 0 ? outerR : innerR;
      if (distance <= radius) buffer.set(x, y, color);
    }
  }
}

/**
 * Desenha um contorno de 1 px em volta dos pixels opacos.
 * O teste usa o estado original do buffer (o contorno nao se auto-contorna).
 */
export function outlinePixels(
  buffer: PixelBuffer,
  color: string,
  options?: { diagonal?: boolean }
): void {
  const diagonal = options?.diagonal ?? false;
  const snapshot = buffer.clone();

  const neighbors: [number, number][] = diagonal
    ? [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1],
      ]
    : [
        [1, 0], [-1, 0], [0, 1], [0, -1],
      ];

  for (let y = 0; y < buffer.rows; y++) {
    for (let x = 0; x < buffer.cols; x++) {
      if (snapshot.get(x, y)) continue;
      for (const [dx, dy] of neighbors) {
        if (snapshot.get(x + dx, y + dy)) {
          buffer.set(x, y, color);
          break;
        }
      }
    }
  }
}

/** Aplica dithering ordenado em uma regiao retangular. */
export function ditherRect(
  buffer: PixelBuffer,
  x: number,
  y: number,
  width: number,
  height: number,
  colorA: string,
  colorB: string,
  pattern: DitherPatternName = 'bayer4'
): void {
  const matrix = ditherPattern(pattern);
  const size = matrix.length;
  const threshold = (size * size) / 2;

  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      const value = matrix[((row % size) + size) % size][((col % size) + size) % size];
      buffer.set(col, row, value < threshold ? colorA : colorB);
    }
  }
}

/** Espelha o conteudo da grade em torno do eixo central. */
export function mirrorBuffer(buffer: PixelBuffer, axis: 'x' | 'y'): void {
  const snapshot = buffer.clone();

  if (axis === 'x') {
    for (let y = 0; y < buffer.rows; y++) {
      for (let x = 0; x < Math.floor(buffer.cols / 2); x++) {
        const source = snapshot.get(x, y);
        const target = buffer.cols - 1 - x;
        if (source) buffer.set(target, y, source);
        else buffer.set(target, y, 'transparent');
      }
    }
    return;
  }

  for (let x = 0; x < buffer.cols; x++) {
    for (let y = 0; y < Math.floor(buffer.rows / 2); y++) {
      const source = snapshot.get(x, y);
      const target = buffer.rows - 1 - y;
      if (source) buffer.set(x, target, source);
      else buffer.set(x, target, 'transparent');
    }
  }
}

export interface GridRegion {
  color: string;
  cells: number[];
  area: number;
}

/**
 * Divide a grade em regioes conexas (mesma cor, vizinhanca 4).
 * Usado pelo contorno interno: a regiao e a unidade que ganha ou perde pixels.
 */
export function findRegions(buffer: PixelBuffer): GridRegion[] {
  const seen = new Uint8Array(buffer.cols * buffer.rows);
  const regions: GridRegion[] = [];

  for (let y = 0; y < buffer.rows; y++) {
    for (let x = 0; x < buffer.cols; x++) {
      const index = y * buffer.cols + x;
      if (seen[index]) continue;

      const color = buffer.get(x, y);
      if (!color) {
        seen[index] = 1;
        continue;
      }

      const cells: number[] = [];
      const stack = [index];
      seen[index] = 1;

      while (stack.length > 0) {
        const current = stack.pop() as number;
        cells.push(current);

        const cx = current % buffer.cols;
        const cy = (current - cx) / buffer.cols;

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= buffer.cols || ny >= buffer.rows) continue;
          const nIndex = ny * buffer.cols + nx;
          if (seen[nIndex]) continue;
          if (buffer.get(nx, ny) !== color) continue;
          seen[nIndex] = 1;
          stack.push(nIndex);
        }
      }

      regions.push({ color, cells, area: cells.length });
    }
  }

  return regions;
}

/**
 * Contorno interno: insere a cor `ink` entre regioes de cores diferentes.
 *
 * A linha e "carvada" da regiao MAIOR (a que tem mais pixels), entao detalhes
 * pequenos (olhos, listras, emblemas) preservam a forma e ganham um anel escuro
 * desenhado no vizinho maior.
 *
 * Seguranca: uma regiao que perderia mais de `maxLoss` (30% por padrao) dos
 * seus pixels nao e corroida — evita furar formas finas (alcas, straps, faixas).
 */
export function separatePixels(
  buffer: PixelBuffer,
  ink: string,
  options?: { includeDiagonal?: boolean; maxLoss?: number }
): void {
  const snapshot = buffer.clone();
  const regions = findRegions(snapshot);

  const regionOf = new Int32Array(buffer.cols * buffer.rows).fill(-1);
  regions.forEach((region, index) => {
    for (const cell of region.cells) regionOf[cell] = index;
  });

  const offsets: [number, number][] = options?.includeDiagonal
    ? [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1],
      ]
    : [
        [1, 0], [-1, 0], [0, 1], [0, -1],
      ];

  const candidates = new Map<number, number>(); // celula -> regiao que a perde
  const lossPerRegion = new Map<number, number>();

  for (let y = 0; y < buffer.rows; y++) {
    for (let x = 0; x < buffer.cols; x++) {
      const index = y * buffer.cols + x;
      const color = snapshot.get(x, y);
      if (!color || color === ink) continue;

      const regionIndex = regionOf[index];

      for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= buffer.cols || ny >= buffer.rows) continue;

        const nIndex = ny * buffer.cols + nx;
        const nColor = snapshot.get(nx, ny);
        if (!nColor || nColor === color || nColor === ink) continue;

        const nRegionIndex = regionOf[nIndex];
        if (nRegionIndex === regionIndex) continue;

        const area = regions[regionIndex].area;
        const nArea = regions[nRegionIndex].area;

        let victim: number;
        if (nArea > area) victim = nRegionIndex;
        else if (area > nArea) victim = regionIndex;
        else {
          // empate: carva da regiao mais escura
          victim =
            luminanceOf(nColor) < luminanceOf(color) ? nRegionIndex : regionIndex;
        }

        const target = victim === regionIndex ? index : nIndex;
        if (!candidates.has(target)) {
          candidates.set(target, victim);
          lossPerRegion.set(victim, (lossPerRegion.get(victim) ?? 0) + 1);
        }
      }
    }
  }

  const maxLoss = options?.maxLoss ?? 0.3;

  for (const [cell, victim] of candidates) {
    const area = regions[victim].area;
    const loss = lossPerRegion.get(victim) ?? 0;
    if (loss > area * maxLoss) continue;
    const x = cell % buffer.cols;
    const y = (cell - x) / buffer.cols;
    buffer.set(x, y, ink);
  }
}

function luminanceOf(color: string): number {
  const rgba = parseColor(color);
  return 0.2126 * rgba.r + 0.7152 * rgba.g + 0.0722 * rgba.b;
}
