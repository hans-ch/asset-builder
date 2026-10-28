import { createCanvas } from '@napi-rs/canvas';
import express, { type Router } from 'express';
import { existsSync, mkdirSync, promises as fs, readdirSync, statSync } from 'fs';
import path from 'path';
import { transform } from 'sucrase';
import { VectorEngine } from '../src/engine/VectorEngine.js';

const ASSET_DIR = path.resolve(process.cwd(), 'asset_gen');

function ensureAssetDir() {
  if (!existsSync(ASSET_DIR)) {
    mkdirSync(ASSET_DIR, { recursive: true });
  }
}

function isInsideAssetDir(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(ASSET_DIR + path.sep) || resolved === ASSET_DIR;
}

interface AssetFolder {
  name: string;
  files: string[];
}

function listAssetFolders(): AssetFolder[] {
  ensureAssetDir();
  const entries = readdirSync(ASSET_DIR);
  const folders: AssetFolder[] = [];

  for (const entry of entries) {
    const fullPath = path.join(ASSET_DIR, entry);
    if (statSync(fullPath).isDirectory()) {
      const files = readdirSync(fullPath)
        .filter((f) => f.endsWith('.ts'))
        .sort();
      folders.push({ name: entry, files });
    }
  }

  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

export function createAssetsRouter(): Router {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  // Lista pastas e arquivos .ts de asset_gen
  router.get('/assets', (_req, res) => {
    try {
      const folders = listAssetFolders();
      res.json({ folders });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Lê o conteúdo de um script
  router.get('/assets/:folder/:file', async (req, res) => {
    try {
      const { folder, file } = req.params;
      const filePath = path.join(ASSET_DIR, folder, file);

      if (!isInsideAssetDir(filePath) || !filePath.endsWith('.ts')) {
        res.status(400).json({ error: 'Caminho inválido.' });
        return;
      }

      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'Arquivo não encontrado.' });
        return;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      res.json({ content });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Cria/salva um arquivo .ts dentro de uma pasta
  router.post('/assets/:folder', async (req, res) => {
    try {
      const { folder } = req.params;
      const { file, content } = req.body as { file?: string; content?: string };

      if (!file || typeof content !== 'string') {
        res.status(400).json({ error: 'Campos "file" e "content" são obrigatórios.' });
        return;
      }

      if (!file.endsWith('.ts')) {
        res.status(400).json({ error: 'Apenas arquivos .ts são permitidos.' });
        return;
      }

      const folderPath = path.join(ASSET_DIR, folder);
      const filePath = path.join(folderPath, file);

      if (!isInsideAssetDir(folderPath) || !isInsideAssetDir(filePath)) {
        res.status(400).json({ error: 'Caminho inválido.' });
        return;
      }

      ensureAssetDir();
      if (!existsSync(folderPath)) {
        mkdirSync(folderPath, { recursive: true });
      }

      await fs.writeFile(filePath, content, 'utf-8');
      res.json({ success: true, path: filePath });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Renderiza um script e salva preview.png
  router.post('/assets/:folder/render', async (req, res) => {
    try {
      const { folder } = req.params;
      const { file = 'generate.ts', size = 100 } = req.body as { file?: string; size?: number };

      const folderPath = path.join(ASSET_DIR, folder);
      const filePath = path.join(folderPath, file);
      const previewPath = path.join(folderPath, 'preview.png');

      if (!isInsideAssetDir(filePath)) {
        res.status(400).json({ error: 'Caminho inválido.' });
        return;
      }

      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'Arquivo não encontrado.' });
        return;
      }

      const source = await fs.readFile(filePath, 'utf-8');
      const compiled = transform(source, { transforms: ['typescript'] }).code;
      const executableCode = compiled
        .replace(/export\s+function\s+generateAsset/, 'return function')
        .replace(/function\s+generateAsset/, 'return function');

      const builder = new Function(executableCode)();
      if (typeof builder !== 'function') {
        throw new Error('O código deve conter uma função generateAsset(ctx: VectorContext).');
      }

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      const engine = new VectorEngine(ctx as unknown as CanvasRenderingContext2D);
      builder(engine);

      const buffer = await canvas.encode('png');
      await fs.writeFile(previewPath, buffer);

      res.json({ success: true, previewPath });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
