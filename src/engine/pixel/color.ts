export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX_RE = /^#?([0-9a-f]{3,8})$/i;
const RGB_RE = /^rgba?\(([^)]+)\)$/i;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampByte(value: number): number {
  return clamp(Math.round(value), 0, 255);
}

/**
 * Converte uma cor CSS (hex de 3/4/6/8 digitos, rgb(), rgba() ou 'transparent')
 * em RGBA. Valores invalidos viram preto opaco.
 */
export function parseColor(color: string): Rgba {
  if (!color) return { r: 0, g: 0, b: 0, a: 0 };

  const value = color.trim().toLowerCase();
  if (value === 'transparent' || value === 'none') return { r: 0, g: 0, b: 0, a: 0 };

  const rgbMatch = value.match(RGB_RE);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(',')
      .map((part) => parseFloat(part.trim()))
      .filter((part) => !Number.isNaN(part));
    const r = parts[0] ?? 0;
    const g = parts[1] ?? 0;
    const b = parts[2] ?? 0;
    const a = parts.length > 3 ? parts[3] : 1;
    return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: clamp(a, 0, 1) };
  }

  const hexMatch = value.match(HEX_RE);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

/** Converte RGBA de volta para hex (#RRGGBB ou #RRGGBBAA quando ha alpha). */
export function rgbaToHex(color: Rgba): string {
  const r = clampByte(color.r).toString(16).padStart(2, '0');
  const g = clampByte(color.g).toString(16).padStart(2, '0');
  const b = clampByte(color.b).toString(16).padStart(2, '0');
  if (color.a >= 1) return `#${r}${g}${b}`;
  const a = clampByte(color.a * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}${a}`;
}

export function hexToRgba(hex: string): Rgba {
  return parseColor(hex);
}

/** Luminancia perceptual (0 a 255). */
export function luminance(color: Rgba): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/** Distancia de cor aproximada (redmean), usada para escolher a cor mais proxima. */
export function colorDistance(a: Rgba, b: Rgba): number {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
}

/** Retorna a cor da paleta mais proxima da informada. */
export function nearestInPalette(color: string, palette: string[]): string {
  if (palette.length === 0) return color;
  const target = parseColor(color);
  let best = palette[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of palette) {
    const distance = colorDistance(target, parseColor(candidate));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
}

/** Clareia (amount > 0) ou escurece (amount < 0) uma cor. amount vai de -1 a 1. */
export function shadeColor(color: string, amount: number): string {
  const rgba = parseColor(color);
  const target = amount >= 0 ? 255 : 0;
  const ratio = Math.abs(amount);
  return rgbaToHex({
    r: rgba.r + (target - rgba.r) * ratio,
    g: rgba.g + (target - rgba.g) * ratio,
    b: rgba.b + (target - rgba.b) * ratio,
    a: rgba.a,
  });
}
