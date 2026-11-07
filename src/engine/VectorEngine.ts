import type { Color, DitherPattern, PixelMapOptions, VectorContext } from './types.js';
import { pick, random, randomColor, randomInt, toRadians } from './utils.js';
import { PixelBuffer } from './pixel/PixelBuffer.js';
import * as raster from './pixel/raster.js';
import { nearestInPalette } from './pixel/color.js';
import { STYLE_IDS, getStyle, toStyleInfo } from '../styles/registry.js';
import type { Style, StyleInfo } from '../styles/types.js';

interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Composicao "n primeiro, depois m" (mesma semantica do ctx.translate/rotate/scale). */
function multiply(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

export class VectorEngine implements VectorContext {
  private ctx: CanvasRenderingContext2D;
  private scaleFactor: number;

  // Modo pixel
  private pixelMode = false;
  private buffer: PixelBuffer | null = null;
  private style: Style | null = null;
  private pixelScale = 1;
  private matrix: Matrix = { ...IDENTITY };
  private matrixStack: Matrix[] = [];
  /** Paleta ativa (setPalette sobrescreve a paleta do preset). */
  private activePalette: string[] | null = null;
  /** Resolução pedida explicitamente pelo script (usada pelo modo pixel como saída). */
  private requestedSize: { width: number; height: number } | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.scaleFactor = 1;
  }

  private s(value: number): number {
    return value * this.scaleFactor;
  }

  // ---- Estilo ----

  setStyle(styleId: string) {
    const style = getStyle(styleId);
    if (!style) {
      throw new Error(
        `Estilo desconhecido: "${styleId}". Disponiveis: ${STYLE_IDS.join(', ')}`
      );
    }

    this.style = style;

    if (style.family === 'pixel') {
      this.pixelMode = true;
      this.buffer = new PixelBuffer(style.cols, style.rows);
      this.pixelScale = style.pixelScale;

      // Se o script ja pediu uma resolucao antes do setStyle, ela e a saida final.
      if (this.requestedSize) {
        const scaleX = Math.floor(this.requestedSize.width / style.cols);
        const scaleY = Math.floor(this.requestedSize.height / style.rows);
        this.pixelScale = Math.max(1, Math.min(scaleX, scaleY));
      }

      this.matrix = { ...IDENTITY };
      this.matrixStack = [];
      if (style.background) this.buffer.clear(style.background);
      this.resizePixelCanvas();
    } else {
      this.pixelMode = false;
      this.buffer = null;
      this.pixelScale = 1;
      this.matrix = { ...IDENTITY };
      this.matrixStack = [];
    }
  }

  getStyle(): StyleInfo | null {
    return this.style ? toStyleInfo(this.style) : null;
  }

  isPixelMode(): boolean {
    return this.pixelMode;
  }

  setCanvasSize(width: number, height?: number) {
    if (this.pixelMode && this.buffer) {
      // No modo pixel o tamanho define a resolucao de saida (escala inteira).
      const h = height ?? width;
      const scaleX = Math.floor(width / this.buffer.cols);
      const scaleY = Math.floor(h / this.buffer.rows);
      this.pixelScale = Math.max(1, Math.min(scaleX, scaleY));
      this.resizePixelCanvas();
      return;
    }

    const h = height ?? width;
    this.requestedSize = { width, height: h };
    this.scaleFactor = width / 100;
    this.ctx.canvas.width = width;
    this.ctx.canvas.height = h;
  }

  private resizePixelCanvas() {
    if (!this.buffer) return;
    this.ctx.canvas.width = this.buffer.cols * this.pixelScale;
    this.ctx.canvas.height = this.buffer.rows * this.pixelScale;
    this.ctx.imageSmoothingEnabled = false;
  }

  // ---- Formas básicas ----

  drawRect(x: number, y: number, w: number, h: number, color: Color) {
    if (this.pixelMode) {
      raster.fillPolygon(
        this.buffer!,
        [
          this.mapPoint(x, y),
          this.mapPoint(x + w, y),
          this.mapPoint(x + w, y + h),
          this.mapPoint(x, y + h),
        ],
        color
      );
      return;
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.s(x), this.s(y), this.s(w), this.s(h));
  }

  drawRoundedRect(x: number, y: number, w: number, h: number, radius: number, color: Color) {
    if (this.pixelMode) {
      raster.fillPolygon(
        this.buffer!,
        this.roundedRectPoints(x, y, w, h, radius).map(([px, py]) => this.mapPoint(px, py)),
        color
      );
      return;
    }

    const sr = Math.min(this.s(radius), this.s(w) / 2, this.s(h) / 2);
    this.ctx.beginPath();
    this.ctx.roundRect(this.s(x), this.s(y), this.s(w), this.s(h), sr);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private roundedRectPoints(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    segments = 4
  ): [number, number][] {
    const r = Math.min(radius, w / 2, h / 2);
    const points: [number, number][] = [];
    const corners: [number, number, number][] = [
      [x + w - r, y + r, -Math.PI / 2],
      [x + w - r, y + h - r, 0],
      [x + r, y + h - r, Math.PI / 2],
      [x + r, y + r, Math.PI],
    ];

    for (const [cx, cy, start] of corners) {
      for (let i = 0; i <= segments; i++) {
        const angle = start + (i / segments) * (Math.PI / 2);
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
    }

    return points;
  }

  drawCircle(cx: number, cy: number, r: number, color: Color) {
    if (this.pixelMode) {
      const scale = this.matrixScale();
      const [gx, gy] = this.mapPoint(cx, cy);
      raster.fillEllipse(
        this.buffer!,
        gx,
        gy,
        this.toGridX(r) * scale,
        this.toGridY(r) * scale,
        color
      );
      return;
    }

    this.ctx.beginPath();
    this.ctx.arc(this.s(cx), this.s(cy), Math.max(0, this.s(r)), 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawEllipse(cx: number, cy: number, rx: number, ry: number, color: Color) {
    if (this.pixelMode) {
      const scale = this.matrixScale();
      const [gx, gy] = this.mapPoint(cx, cy);
      raster.fillEllipse(
        this.buffer!,
        gx,
        gy,
        this.toGridX(rx) * scale,
        this.toGridY(ry) * scale,
        color
      );
      return;
    }

    this.ctx.beginPath();
    this.ctx.ellipse(this.s(cx), this.s(cy), Math.max(0, this.s(rx)), Math.max(0, this.s(ry)), 0, 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color) {
    if (this.pixelMode) {
      const size = Math.max(1, Math.round(this.toGridX(thickness)));
      raster.strokePolyline(
        this.buffer!,
        [this.mapPoint(x1, y1), this.mapPoint(x2, y2)],
        color,
        size
      );
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(this.s(x1), this.s(y1));
    this.ctx.lineTo(this.s(x2), this.s(y2));
    this.ctx.lineWidth = Math.max(0.1, this.s(thickness));
    this.ctx.strokeStyle = color;
    this.ctx.stroke();
  }

  drawBezier(
    x1: number,
    y1: number,
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x2: number,
    y2: number,
    thickness: number,
    color: Color
  ) {
    if (this.pixelMode) {
      const size = Math.max(1, Math.round(this.toGridX(thickness)));
      const points: [number, number][] = [];
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const px =
          mt * mt * mt * x1 +
          3 * mt * mt * t * cp1x +
          3 * mt * t * t * cp2x +
          t * t * t * x2;
        const py =
          mt * mt * mt * y1 +
          3 * mt * mt * t * cp1y +
          3 * mt * t * t * cp2y +
          t * t * t * y2;
        points.push(this.mapPoint(px, py));
      }
      raster.strokePolyline(this.buffer!, points, color, size);
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(this.s(x1), this.s(y1));
    this.ctx.bezierCurveTo(
      this.s(cp1x),
      this.s(cp1y),
      this.s(cp2x),
      this.s(cp2y),
      this.s(x2),
      this.s(y2)
    );
    this.ctx.lineWidth = Math.max(0.1, this.s(thickness));
    this.ctx.strokeStyle = color;
    this.ctx.stroke();
  }

  drawQuadratic(
    x1: number,
    y1: number,
    cpx: number,
    cpy: number,
    x2: number,
    y2: number,
    thickness: number,
    color: Color
  ) {
    if (this.pixelMode) {
      const size = Math.max(1, Math.round(this.toGridX(thickness)));
      const points: [number, number][] = [];
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const px = mt * mt * x1 + 2 * mt * t * cpx + t * t * x2;
        const py = mt * mt * y1 + 2 * mt * t * cpy + t * t * y2;
        points.push(this.mapPoint(px, py));
      }
      raster.strokePolyline(this.buffer!, points, color, size);
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(this.s(x1), this.s(y1));
    this.ctx.quadraticCurveTo(this.s(cpx), this.s(cpy), this.s(x2), this.s(y2));
    this.ctx.lineWidth = Math.max(0.1, this.s(thickness));
    this.ctx.strokeStyle = color;
    this.ctx.stroke();
  }

  drawPolygon(points: [number, number][], color: Color) {
    if (this.pixelMode) {
      raster.fillPolygon(
        this.buffer!,
        points.map(([px, py]) => this.mapPoint(px, py)),
        color
      );
      return;
    }

    if (points.length < 3) return;
    this.ctx.beginPath();
    this.ctx.moveTo(this.s(points[0][0]), this.s(points[0][1]));
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(this.s(points[i][0]), this.s(points[i][1]));
    }
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawStar(cx: number, cy: number, outerR: number, innerR: number, points: number, color: Color) {
    const count = Math.max(2, Math.floor(points));
    const step = Math.PI / count;
    const path: [number, number][] = [];
    for (let i = 0; i < count * 2; i++) {
      const radius = i % 2 === 0 ? outerR : innerR;
      const angle = i * step - Math.PI / 2;
      path.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }

    if (this.pixelMode) {
      raster.fillPolygon(
        this.buffer!,
        path.map(([px, py]) => this.mapPoint(px, py)),
        color
      );
      return;
    }

    this.drawPolygon(path, color);
  }

  drawArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, color: Color) {
    if (this.pixelMode) {
      const scale = this.matrixScale();
      const [gx, gy] = this.mapPoint(cx, cy);
      raster.fillSector(
        this.buffer!,
        gx,
        gy,
        this.toGridX(r) * scale,
        startAngle,
        endAngle,
        color
      );
      return;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(this.s(cx), this.s(cy));
    this.ctx.arc(this.s(cx), this.s(cy), Math.max(0, this.s(r)), toRadians(startAngle), toRadians(endAngle));
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  // ---- Grupos e transformações ----

  startGroup(_: string) {
    if (this.pixelMode) {
      this.matrixStack.push({ ...this.matrix });
      return;
    }
    this.ctx.save();
  }

  endGroup() {
    if (this.pixelMode) {
      const previous = this.matrixStack.pop();
      if (previous) this.matrix = previous;
      return;
    }
    this.ctx.restore();
  }

  withGroup<T>(_: string, fn: () => T): T {
    this.startGroup(_);
    try {
      return fn();
    } finally {
      this.endGroup();
    }
  }

  translate(x: number, y: number) {
    if (this.pixelMode) {
      this.matrix = multiply(this.matrix, {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: this.toGridX(x),
        f: this.toGridY(y),
      });
      return;
    }
    this.ctx.translate(this.s(x), this.s(y));
  }

  rotate(angleDegrees: number) {
    if (this.pixelMode) {
      const radians = toRadians(angleDegrees);
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const cx = (this.buffer?.cols ?? 0) / 2;
      const cy = (this.buffer?.rows ?? 0) / 2;
      this.matrix = multiply(
        multiply(
          multiply(this.matrix, { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy }),
          { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }
        ),
        { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy }
      );
      return;
    }
    this.ctx.rotate(toRadians(angleDegrees));
  }

  scale(x: number, y?: number) {
    if (this.pixelMode) {
      const cx = (this.buffer?.cols ?? 0) / 2;
      const cy = (this.buffer?.rows ?? 0) / 2;
      this.matrix = multiply(
        multiply(
          multiply(this.matrix, { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy }),
          { a: x, b: 0, c: 0, d: y ?? x, e: 0, f: 0 }
        ),
        { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy }
      );
      return;
    }
    this.ctx.scale(x, y ?? x);
  }

  // ---- Estilo e efeitos ----

  setFill(color: Color) {
    this.ctx.fillStyle = color;
  }

  setStroke(color: Color, thickness: number) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = Math.max(0.1, this.s(thickness));
  }

  setShadow(color: Color, blur: number, offsetX = 0, offsetY = 0) {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = this.s(blur);
    this.ctx.shadowOffsetX = this.s(offsetX);
    this.ctx.shadowOffsetY = this.s(offsetY);
  }

  clearShadow() {
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
  }

  // ---- Canvas ----

  clear(color?: Color) {
    if (this.pixelMode && this.buffer) {
      this.buffer.clear(color);
      return;
    }

    const canvas = this.ctx.canvas;
    if (color) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  setBackground(color: Color) {
    this.clear(color);
  }

  // ---- Utilitários procedural ----

  random(min = 0, max = 1): number {
    return random(min, max);
  }

  randomInt(min = 0, max = 100): number {
    return randomInt(min, max);
  }

  randomColor(): Color {
    return randomColor();
  }

  pick<T>(items: T[]): T {
    return pick(items);
  }

  // ---- Primitivas de grade (modo pixel) ----

  drawPixel(x: number, y: number, color: Color) {
    const buffer = this.requirePixelBuffer('drawPixel');
    const [gx, gy] = this.mapGridPoint(x, y);
    buffer.set(Math.round(gx), Math.round(gy), color);
  }

  drawPixelRect(x: number, y: number, w: number, h: number, color: Color) {
    const buffer = this.requirePixelBuffer('drawPixelRect');
    const [x0, y0] = this.mapGridPoint(x, y);
    const [x1, y1] = this.mapGridPoint(x + w, y + h);
    const left = Math.round(Math.min(x0, x1));
    const right = Math.round(Math.max(x0, x1));
    const top = Math.round(Math.min(y0, y1));
    const bottom = Math.round(Math.max(y0, y1));

    for (let py = top; py < bottom; py++) {
      for (let px = left; px < right; px++) {
        buffer.set(px, py, color);
      }
    }
  }

  drawPixelLine(x1: number, y1: number, x2: number, y2: number, color: Color) {
    const buffer = this.requirePixelBuffer('drawPixelLine');
    raster.strokePolyline(
      buffer,
      [this.mapGridPoint(x1, y1), this.mapGridPoint(x2, y2)],
      color,
      1
    );
  }

  drawPixelCircle(cx: number, cy: number, r: number, color: Color) {
    const buffer = this.requirePixelBuffer('drawPixelCircle');
    const [gx, gy] = this.mapGridPoint(cx, cy);
    raster.fillEllipse(buffer, gx, gy, r, r, color);
  }

  drawPixelEllipse(cx: number, cy: number, rx: number, ry: number, color: Color) {
    const buffer = this.requirePixelBuffer('drawPixelEllipse');
    const [gx, gy] = this.mapGridPoint(cx, cy);
    raster.fillEllipse(buffer, gx, gy, rx, ry, color);
  }

  drawPixelPolygon(points: [number, number][], color: Color) {
    const buffer = this.requirePixelBuffer('drawPixelPolygon');
    raster.fillPolygon(
      buffer,
      points.map(([px, py]) => this.mapGridPoint(px, py)),
      color
    );
  }

  drawPixelMap(rows: string[], palette: Record<string, Color>, options?: PixelMapOptions) {
    const buffer = this.requirePixelBuffer('drawPixelMap');
    if (rows.length === 0) return;

    // 1) Mapa irregular: todas as linhas precisam ter a mesma largura.
    const widths = rows.map((row) => row.length);
    const expected = widths[0];
    const invalid = widths
      .map((width, index) => ({ width, index }))
      .filter((entry) => entry.width !== expected);
    if (invalid.length > 0) {
      const detail = invalid
        .map((entry) => `linha ${entry.index + 1} tem ${entry.width}`)
        .join(', ');
      throw new Error(
        `drawPixelMap: mapa irregular — todas as linhas precisam ter ${expected} colunas. ${detail}.`
      );
    }

    const transparent = new Set([' ', '.', ...(options?.transparent ?? [])]);

    // 2) Trim: remove a moldura vazia nas bordas do mapa.
    let map = rows;
    let trimOffsetX = 0;
    let trimOffsetY = 0;
    if (options?.trim) {
      const isBlank = (row: string) =>
        row.split('').every((char) => transparent.has(char));
      let top = 0;
      let bottom = map.length - 1;
      while (top <= bottom && isBlank(map[top])) top++;
      while (bottom >= top && isBlank(map[bottom])) bottom--;
      map = map.slice(top, bottom + 1);

      let left = Number.POSITIVE_INFINITY;
      let right = -1;
      for (const row of map) {
        for (let column = 0; column < row.length; column++) {
          if (transparent.has(row[column])) continue;
          if (column < left) left = column;
          if (column > right) right = column;
        }
      }
      if (right >= left) {
        map = map.map((row) => row.slice(left, right + 1));
        trimOffsetX = left;
        trimOffsetY = top;
      }
    }

    // 3) Mirror: desenha a metade esquerda e espelha (a coluna central e compartilhada).
    let effective = map;
    if (options?.mirror === 'x') {
      effective = map.map((row) => {
        const reversed = row.split('').reverse().join('');
        return row + reversed.slice(1);
      });
    }

    // 4) Posicionamento na grade.
    const mapWidth = effective[0].length;
    const mapHeight = effective.length;
    const align = options?.align ?? 'center';
    const offsetX =
      options?.x !== undefined
        ? options.x + trimOffsetX
        : align === 'left'
          ? 0
          : align === 'right'
            ? buffer.cols - mapWidth
            : Math.floor((buffer.cols - mapWidth) / 2);
    const offsetY =
      options?.y !== undefined
        ? options.y + trimOffsetY
        : Math.floor((buffer.rows - mapHeight) / 2);

    const unknown = new Set<string>();

    for (let row = 0; row < effective.length; row++) {
      const line = effective[row];
      for (let column = 0; column < line.length; column++) {
        const char = line[column];
        if (transparent.has(char)) continue;

        const color = palette[char];
        if (!color) {
          unknown.add(char);
          continue;
        }

        const sourceColumn = options?.flipX ? line.length - 1 - column : column;
        const [gx, gy] = this.mapGridPoint(offsetX + sourceColumn, offsetY + row);
        buffer.set(Math.round(gx), Math.round(gy), color);
      }
    }

    if (unknown.size > 0) {
      throw new Error(
        `drawPixelMap: caracteres sem cor na paleta: ${Array.from(unknown).join(', ')}`
      );
    }
  }

  // ---- Utilitários de grade (modo pixel) ----

  outlinePixels(color: Color, options?: { diagonal?: boolean }) {
    const buffer = this.requirePixelBuffer('outlinePixels');
    raster.outlinePixels(buffer, color, { diagonal: options?.diagonal });
  }

  separatePixels(ink: Color, options?: { includeDiagonal?: boolean }) {
    const buffer = this.requirePixelBuffer('separatePixels');
    raster.separatePixels(buffer, ink, { includeDiagonal: options?.includeDiagonal });
  }

  setPalette(colors: Color[]) {
    this.activePalette = colors.length > 0 ? [...colors] : null;
  }

  shadePixels(from: Color, to: Color) {
    const buffer = this.requirePixelBuffer('shadePixels');
    buffer.replace(from, to);
  }

  ditherPixels(
    x: number,
    y: number,
    w: number,
    h: number,
    colorA: Color,
    colorB: Color,
    pattern: DitherPattern = 'bayer4'
  ) {
    const buffer = this.requirePixelBuffer('ditherPixels');
    raster.ditherRect(buffer, x, y, w, h, colorA, colorB, pattern);
  }

  mirrorPixels(axis: 'x' | 'y') {
    const buffer = this.requirePixelBuffer('mirrorPixels');
    raster.mirrorBuffer(buffer, axis);
  }

  // ---- Finalização (flush da grade no canvas) ----

  /**
   * Desenha o buffer de grade no canvas com upscale nearest-neighbor.
   * Deve ser chamado depois que o script terminar de desenhar.
   */
  finalize(): void {
    const buffer = this.buffer;
    if (!this.pixelMode || !buffer) return;

    const style = this.style;
    if (style && style.family === 'pixel' && style.quantize) {
      const palette = this.activePalette ?? style.palette;
      buffer.forEach((x, y, color) => {
        if (!color) return;
        const nearest = nearestInPalette(color, palette);
        if (nearest !== color) buffer.set(x, y, nearest);
      });
    }

    const scale = this.pixelScale;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    for (let y = 0; y < buffer.rows; y++) {
      for (let x = 0; x < buffer.cols; x++) {
        const color = buffer.get(x, y);
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  // ---- Auxiliares internos ----

  private requirePixelBuffer(method: string): PixelBuffer {
    if (!this.pixelMode || !this.buffer) {
      throw new Error(
        `${method} exige um estilo pixel. Chame ctx.setStyle('pixel-...') antes de desenhar.`
      );
    }
    return this.buffer;
  }

  private toGridX(logical: number): number {
    return (logical / 100) * (this.buffer?.cols ?? 100);
  }

  private toGridY(logical: number): number {
    return (logical / 100) * (this.buffer?.rows ?? 100);
  }

  /** Converte coordenadas logicas (0-100) em coordenadas de grade ja transformadas. */
  private mapPoint(x: number, y: number): [number, number] {
    return applyMatrix(this.matrix, this.toGridX(x), this.toGridY(y));
  }

  /** Aplica apenas a matriz (coordenadas ja em celulas da grade). */
  private mapGridPoint(x: number, y: number): [number, number] {
    return applyMatrix(this.matrix, x, y);
  }

  private matrixScale(): number {
    const determinant = Math.abs(
      this.matrix.a * this.matrix.d - this.matrix.b * this.matrix.c
    );
    return Math.sqrt(determinant) || 1;
  }
}
