import { createCanvas } from '@napi-rs/canvas';
import { existsSync, mkdirSync, promises as fs, statSync } from 'fs';
import path from 'path';
import { transform } from 'sucrase';
import { VectorEngine } from '../src/engine/VectorEngine.js';

const CANVAS_SIZE = 100;

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function renderFile(filePath: string, outputPath: string) {
  const source = await fs.readFile(filePath, 'utf-8');

  const compiled = transform(source, { transforms: ['typescript'] }).code;
  const executableCode = compiled
    .replace(/export\s+function\s+generateAsset/, 'return function')
    .replace(/function\s+generateAsset/, 'return function');

  const builder = new Function(executableCode)();
  if (typeof builder !== 'function') {
    throw new Error(`Função generateAsset não encontrada em ${filePath}`);
  }

  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext('2d');
  const engine = new VectorEngine(ctx as unknown as CanvasRenderingContext2D);
  builder(engine);

  const buffer = await canvas.encode('png');
  await fs.writeFile(outputPath, buffer);
  console.log(`✓ ${outputPath}`);
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Uso: npm run render <caminho do arquivo .ts ou pasta>');
    process.exit(1);
  }

  const targetPath = path.resolve(target);

  if (!existsSync(targetPath)) {
    console.error(`Caminho não encontrado: ${targetPath}`);
    process.exit(1);
  }

  if (statSync(targetPath).isDirectory()) {
    const files = (await fs.readdir(targetPath))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.join(targetPath, f));

    if (files.length === 0) {
      console.log('Nenhum arquivo .ts encontrado na pasta.');
      return;
    }

    const previewPath = path.join(targetPath, 'preview.png');
    // Renderiza o primeiro arquivo como preview do grupo
    await renderFile(files[0], previewPath);
    console.log(`Preview do grupo salvo em ${previewPath}`);
  } else {
    const dir = path.dirname(targetPath);
    const base = path.basename(targetPath, '.ts');
    ensureDir(dir);
    const outputPath = path.join(dir, `${base}.png`);
    await renderFile(targetPath, outputPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
