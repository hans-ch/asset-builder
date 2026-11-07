type Color = string;

type DitherPattern = 'bayer4' | 'checker' | 'dots';

interface PixelMapOptions {
  x?: number;
  y?: number;
  align?: 'left' | 'center' | 'right';
  trim?: boolean;
  mirror?: 'x';
  flipX?: boolean;
  transparent?: string[];
}

interface StyleInfo {
  id: string;
  label: string;
  family: 'pixel' | 'vector';
  cols: number;
  rows: number;
  pixelScale: number;
  palette: string[];
  maxColors: number;
  outline: 'none' | 'dark' | 'dark-diagonal';
  outlineColor: string | null;
  shading: 'flat' | 'two-tone' | 'three-tone';
  quantize: boolean;
  background: string | null;
  rules: string[];
  guide: string;
}

interface VectorContext {
  // Formas básicas
  drawRect(x: number, y: number, w: number, h: number, color: Color): void;
  drawRoundedRect(x: number, y: number, w: number, h: number, radius: number, color: Color): void;
  drawCircle(cx: number, cy: number, r: number, color: Color): void;
  drawEllipse(cx: number, cy: number, rx: number, ry: number, color: Color): void;
  drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color): void;
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
  ): void;
  drawQuadratic(
    x1: number,
    y1: number,
    cpx: number,
    cpy: number,
    x2: number,
    y2: number,
    thickness: number,
    color: Color
  ): void;
  drawPolygon(points: [number, number][], color: Color): void;
  drawStar(cx: number, cy: number, outerR: number, innerR: number, points: number, color: Color): void;
  drawArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, color: Color): void;

  // Grupos e transformações
  startGroup(id: string): void;
  endGroup(): void;
  withGroup<T>(id: string, fn: () => T): T;
  translate(x: number, y: number): void;
  rotate(angleDegrees: number): void;
  scale(x: number, y?: number): void;

  // Estilo e efeitos
  setFill(color: Color): void;
  setStroke(color: Color, thickness: number): void;
  setShadow(color: Color, blur: number, offsetX?: number, offsetY?: number): void;
  clearShadow(): void;

  // Canvas e utilitários
  setCanvasSize(width: number, height?: number): void;
  clear(color?: Color): void;
  setBackground(color: Color): void;
  random(min?: number, max?: number): number;
  randomInt(min?: number, max?: number): number;
  randomColor(): string;
  pick<T>(items: T[]): T;

  // Estilo (catálogo)
  setStyle(styleId: string): void;
  getStyle(): StyleInfo | null;
  isPixelMode(): boolean;

  // Primitivas de grade (modo pixel)
  drawPixel(x: number, y: number, color: Color): void;
  drawPixelRect(x: number, y: number, w: number, h: number, color: Color): void;
  drawPixelLine(x1: number, y1: number, x2: number, y2: number, color: Color): void;
  drawPixelCircle(cx: number, cy: number, r: number, color: Color): void;
  drawPixelEllipse(cx: number, cy: number, rx: number, ry: number, color: Color): void;
  drawPixelPolygon(points: [number, number][], color: Color): void;
  drawPixelMap(rows: string[], palette: Record<string, Color>, options?: PixelMapOptions): void;

  // Utilitários de grade (modo pixel)
  outlinePixels(color: Color, options?: { diagonal?: boolean }): void;
  separatePixels(ink: Color, options?: { includeDiagonal?: boolean }): void;
  shadePixels(from: Color, to: Color): void;
  ditherPixels(
    x: number,
    y: number,
    w: number,
    h: number,
    colorA: Color,
    colorB: Color,
    pattern?: DitherPattern
  ): void;
  mirrorPixels(axis: 'x' | 'y'): void;

  // Paleta
  setPalette(colors: Color[]): void;
}
