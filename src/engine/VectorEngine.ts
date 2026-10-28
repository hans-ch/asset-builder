import type { Color, VectorContext } from './types.js';
import { pick, random, randomColor, randomInt, toRadians } from './utils.js';

export class VectorEngine implements VectorContext {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  // ---- Formas básicas ----

  drawRect(x: number, y: number, w: number, h: number, color: Color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  drawRoundedRect(x: number, y: number, w: number, h: number, radius: number, color: Color) {
    const r = Math.min(radius, w / 2, h / 2);
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawCircle(cx: number, cy: number, r: number, color: Color) {
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, Math.max(0, r), 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawEllipse(cx: number, cy: number, rx: number, ry: number, color: Color) {
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineWidth = Math.max(0.1, thickness);
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
    this.ctx.moveTo(x1, y1);
    this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    this.ctx.lineWidth = Math.max(0.1, thickness);
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
    this.ctx.moveTo(x1, y1);
    this.ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    this.ctx.lineWidth = Math.max(0.1, thickness);
    this.ctx.strokeStyle = color;
    this.ctx.stroke();
  }

  drawPolygon(points: [number, number][], color: Color) {
    if (points.length < 3) return;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i][0], points[i][1]);
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
    this.ctx.moveTo(cx, cy);
    this.ctx.arc(cx, cy, Math.max(0, r), toRadians(startAngle), toRadians(endAngle));
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
    this.ctx.translate(x, y);
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
    this.ctx.lineWidth = Math.max(0.1, thickness);
  }

  setShadow(color: Color, blur: number, offsetX = 0, offsetY = 0) {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = blur;
    this.ctx.shadowOffsetX = offsetX;
    this.ctx.shadowOffsetY = offsetY;
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
