import type { Color, VectorContext } from './types.js';
import { pick, random, randomColor, randomInt, toRadians } from './utils.js';

export class VectorEngine implements VectorContext {
  private ctx: CanvasRenderingContext2D;
  private scaleFactor: number;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.scaleFactor = 1;
  }

  private s(value: number): number {
    return value * this.scaleFactor;
  }

  setCanvasSize(width: number, height?: number) {
    const h = height ?? width;
    this.scaleFactor = width / 100;
    this.ctx.canvas.width = width;
    this.ctx.canvas.height = h;
  }

  // ---- Formas básicas ----

  drawRect(x: number, y: number, w: number, h: number, color: Color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.s(x), this.s(y), this.s(w), this.s(h));
  }

  drawRoundedRect(x: number, y: number, w: number, h: number, radius: number, color: Color) {
    const sr = Math.min(this.s(radius), this.s(w) / 2, this.s(h) / 2);
    this.ctx.beginPath();
    this.ctx.roundRect(this.s(x), this.s(y), this.s(w), this.s(h), sr);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawCircle(cx: number, cy: number, r: number, color: Color) {
    this.ctx.beginPath();
    this.ctx.arc(this.s(cx), this.s(cy), Math.max(0, this.s(r)), 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawEllipse(cx: number, cy: number, rx: number, ry: number, color: Color) {
    this.ctx.beginPath();
    this.ctx.ellipse(this.s(cx), this.s(cy), Math.max(0, this.s(rx)), Math.max(0, this.s(ry)), 0, 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color) {
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
    this.ctx.beginPath();
    this.ctx.moveTo(this.s(x1), this.s(y1));
    this.ctx.quadraticCurveTo(this.s(cpx), this.s(cpy), this.s(x2), this.s(y2));
    this.ctx.lineWidth = Math.max(0.1, this.s(thickness));
    this.ctx.strokeStyle = color;
    this.ctx.stroke();
  }

  drawPolygon(points: [number, number][], color: Color) {
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
    this.drawPolygon(path, color);
  }

  drawArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, color: Color) {
    this.ctx.beginPath();
    this.ctx.moveTo(this.s(cx), this.s(cy));
    this.ctx.arc(this.s(cx), this.s(cy), Math.max(0, this.s(r)), toRadians(startAngle), toRadians(endAngle));
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  // ---- Grupos e transformações ----

  startGroup(_: string) {
    this.ctx.save();
  }

  endGroup() {
    this.ctx.restore();
  }

  withGroup<T>(_: string, fn: () => T): T {
    this.ctx.save();
    try {
      return fn();
    } finally {
      this.ctx.restore();
    }
  }

  translate(x: number, y: number) {
    this.ctx.translate(this.s(x), this.s(y));
  }

  rotate(angleDegrees: number) {
    this.ctx.rotate(toRadians(angleDegrees));
  }

  scale(x: number, y?: number) {
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
}
