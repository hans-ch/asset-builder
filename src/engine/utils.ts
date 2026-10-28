import type { Color } from './types.js';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function random(min = 0, max = 1): number {
  return Math.random() * (max - min) + min;
}

export function randomInt(min = 0, max = 100): number {
  return Math.floor(random(min, max + 1));
}

const PALETTE: Color[] = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
  '#f43f5e', '#78716c', '#475569', '#0f172a', '#ffffff',
];

export function randomColor(): Color {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

export function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
