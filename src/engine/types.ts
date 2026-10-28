export type Color = string;

export interface Point {
  x: number;
  y: number;
}

export interface VectorContext {
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

  // Canvas
  setCanvasSize(width: number, height?: number): void;
  clear(color?: Color): void;
  setBackground(color: Color): void;

  // Utilitários procedural
  random(min?: number, max?: number): number;
  randomInt(min?: number, max?: number): number;
  randomColor(): Color;
  pick<T>(items: T[]): T;
}
