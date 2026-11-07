import { parseColor, rgbaToHex } from './color.js';

/**
 * Grade de pixels RGBA usada pelo modo pixel art.
 * Cada celula guarda uma cor solida (ou transparente).
 */
export class PixelBuffer {
  readonly cols: number;
  readonly rows: number;
  private data: Uint8ClampedArray;

  constructor(cols: number, rows: number) {
    this.cols = Math.max(1, Math.floor(cols));
    this.rows = Math.max(1, Math.floor(rows));
    this.data = new Uint8ClampedArray(this.cols * this.rows * 4);
  }

  index(x: number, y: number): number {
    return (y * this.cols + x) * 4;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  /** Cor da celula ou null quando a celula esta transparente. */
  get(x: number, y: number): string | null {
    if (!this.inside(x, y)) return null;
    const i = this.index(x, y);
    if (this.data[i + 3] === 0) return null;
    return rgbaToHex({
      r: this.data[i],
      g: this.data[i + 1],
      b: this.data[i + 2],
      a: this.data[i + 3] / 255,
    });
  }

  /** Escreve uma cor na celula. 'transparent' limpa a celula. */
  set(x: number, y: number, color: string, blend = false): void {
    if (!this.inside(x, y)) return;

    const rgba = parseColor(color);
    const i = this.index(x, y);

    if (rgba.a === 0) {
      this.data[i] = 0;
      this.data[i + 1] = 0;
      this.data[i + 2] = 0;
      this.data[i + 3] = 0;
      return;
    }

    if (blend && this.data[i + 3] > 0) {
      const alpha = rgba.a;
      const inverse = 1 - alpha;
      this.data[i] = rgba.r * alpha + this.data[i] * inverse;
      this.data[i + 1] = rgba.g * alpha + this.data[i + 1] * inverse;
      this.data[i + 2] = rgba.b * alpha + this.data[i + 2] * inverse;
      this.data[i + 3] = Math.max(this.data[i + 3], alpha * 255);
      return;
    }

    this.data[i] = rgba.r;
    this.data[i + 1] = rgba.g;
    this.data[i + 2] = rgba.b;
    this.data[i + 3] = rgba.a * 255;
  }

  /** Preenche toda a grade com uma cor (ou limpa se nao houver cor). */
  clear(color?: string): void {
    if (!color) {
      this.data.fill(0);
      return;
    }
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.set(x, y, color);
      }
    }
  }

  forEach(callback: (x: number, y: number, color: string | null) => void): void {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        callback(x, y, this.get(x, y));
      }
    }
  }

  /** Copia do buffer (usada por contorno e espelhamento). */
  clone(): PixelBuffer {
    const copy = new PixelBuffer(this.cols, this.rows);
    copy.data.set(this.data);
    return copy;
  }

  /** Substitui todas as celulas de uma cor por outra. */
  replace(from: string, to: string): number {
    const source = parseColor(from);
    const target = parseColor(to);
    let changed = 0;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = this.index(x, y);
        if (this.data[i + 3] === 0) continue;
        if (this.data[i] !== source.r || this.data[i + 1] !== source.g || this.data[i + 2] !== source.b) continue;
        this.data[i] = target.r;
        this.data[i + 1] = target.g;
        this.data[i + 2] = target.b;
        this.data[i + 3] = target.a * 255;
        changed++;
      }
    }

    return changed;
  }

  /** Conta as celulas opacas (ou apenas as de uma cor especifica). */
  count(color?: string): number {
    let total = 0;
    const target = color ? parseColor(color) : null;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = this.index(x, y);
        if (this.data[i + 3] === 0) continue;
        if (target) {
          if (this.data[i] !== target.r || this.data[i + 1] !== target.g || this.data[i + 2] !== target.b) continue;
        }
        total++;
      }
    }

    return total;
  }
}
