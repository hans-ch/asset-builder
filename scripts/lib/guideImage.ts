import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdirSync } from 'fs';
import path from 'path';
import type { ExtractedGrid } from './pngToGrid.js';

/**
 * Gera um guia para leitura vetorial: a referencia ampliada com o grid 0-100
 * e os bounding boxes das regioes destacados.
 */
export async function buildGuideImage(
  pngPath: string,
  outPath: string,
  grid: ExtractedGrid
): Promise<void> {
  const image = await loadImage(pngPath);
  const size = 640;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#12141a';
  ctx.fillRect(0, 0, size, size);

  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const offsetX = (size - width) / 2;
  const offsetY = (size - height) / 2;

  ctx.drawImage(image, offsetX, offsetY, width, height);

  // Grade 0-100 (10 divisoes).
  const step = size / 10;
  ctx.lineWidth = 1;
  ctx.font = '12px sans-serif';
  ctx.textBaseline = 'top';

  for (let i = 1; i < 10; i++) {
    const major = i % 5 === 0;
    ctx.strokeStyle = major ? 'rgba(96,165,250,0.85)' : 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(96,165,250,0.95)';
  for (let i = 0; i <= 10; i += 2) {
    ctx.fillText(String(i * 10), i * step + 3, 3);
    ctx.fillText(String(i * 10), 3, i * step + 3);
  }

  // Bounding boxes das regioes (em % do canvas).
  ctx.lineWidth = 2;
  for (const region of grid.regions.slice(0, 12)) {
    ctx.strokeStyle = 'rgba(248,113,113,0.9)';
    ctx.strokeRect(
      (region.x / 100) * size,
      (region.y / 100) * size,
      (region.w / 100) * size,
      (region.h / 100) * size
    );
  }

  mkdirSync(path.dirname(outPath), { recursive: true });
  await fsWriteFile(outPath, await canvas.encode('png'));
}

async function fsWriteFile(target: string, buffer: Buffer): Promise<void> {
  const { writeFile } = await import('fs/promises');
  await writeFile(target, buffer);
}
