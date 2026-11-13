import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { DEFAULT_STYLE_ID, STYLES, getStyle, matchStyleFromPrompt } from '../src/styles/registry.js';

const ROOT = process.cwd();
const HEX_RE = /^#[0-9A-F]{6}$/i;

const errors: string[] = [];
const warnings: string[] = [];

function fail(message: string) {
  errors.push(message);
}

// --- Integridade do catálogo ---

const ids = new Set<string>();

for (const style of STYLES) {
  if (ids.has(style.id)) fail(`Id duplicado no catálogo: ${style.id}`);
  ids.add(style.id);

  if (!style.label.trim()) fail(`Estilo "${style.id}" sem label.`);

  if (style.keywords.length === 0) fail(`Estilo "${style.id}" sem keywords.`);
  for (const keyword of style.keywords) {
    if (keyword !== keyword.toLowerCase()) {
      fail(`Keyword "${keyword}" do estilo "${style.id}" deve estar em minusculas.`);
    }
    if (keyword !== keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) {
      fail(`Keyword "${keyword}" do estilo "${style.id}" deve estar sem acento.`);
    }
  }

  const guidePath = path.join(ROOT, style.guide);
  if (!existsSync(guidePath)) {
    fail(`Guia ausente para o estilo "${style.id}": ${style.guide}`);
  }

  if (style.family === 'pixel') {
    if (style.cols < 1 || style.rows < 1) {
      fail(`Estilo "${style.id}" tem grade invalida (${style.cols}x${style.rows}).`);
    }
    if (style.pixelScale < 1) {
      fail(`Estilo "${style.id}" tem pixelScale invalido (${style.pixelScale}).`);
    }
    if (style.palette.length === 0) fail(`Estilo "${style.id}" sem paleta.`);
    if (style.palette.length < style.maxColors) {
      warnings.push(
        `Estilo "${style.id}" permite ${style.maxColors} cores mas a paleta tem ${style.palette.length}.`
      );
    }
    for (const color of style.palette) {
      if (!HEX_RE.test(color)) fail(`Cor invalida no estilo "${style.id}": ${color}`);
    }
    if (style.quantize && style.palette.length === 0) {
      fail(`Estilo "${style.id}" quantiza mas nao tem paleta.`);
    }
  }
}

if (!getStyle(DEFAULT_STYLE_ID)) {
  fail(`Estilo padrao "${DEFAULT_STYLE_ID}" nao existe no catalogo.`);
}

// --- O SKILL.md documenta todos os estilos ---

const skillPath = path.join(ROOT, 'SKILL.md');
if (existsSync(skillPath)) {
  const skill = readFileSync(skillPath, 'utf-8');
  for (const style of STYLES) {
    if (!skill.includes(style.id)) {
      fail(`SKILL.md nao menciona o estilo "${style.id}".`);
    }
  }
  for (const command of ['npm run skeleton', 'npm run doctor', 'npm run pixelize']) {
    if (!skill.includes(command)) {
      fail(`SKILL.md nao menciona o comando "${command}".`);
    }
  }
} else {
  fail('SKILL.md nao encontrado.');
}

// --- Mapas de exemplo do SKILL.md precisam ser retangulares ---

if (existsSync(skillPath)) {
  const skill = readFileSync(skillPath, 'utf-8');
  let searchFrom = 0;

  while (true) {
    const index = skill.indexOf('drawPixelMap(', searchFrom);
    if (index === -1) break;
    searchFrom = index + 1;

    const open = skill.indexOf('[', index);
    if (open === -1) break;

    let depth = 0;
    let close = -1;
    for (let i = open; i < skill.length; i++) {
      const char = skill[i];
      if (char === '[') depth++;
      else if (char === ']') {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) break;

    const rows = [...skill.slice(open, close).matchAll(/'([^']*)'/g)].map((match) => match[1]);
    if (rows.length === 0) continue;

    const expected = rows[0].length;
    const invalid = rows
      .map((row, rowIndex) => ({ row, rowIndex }))
      .filter((entry) => entry.row.length !== expected);
    if (invalid.length > 0) {
      const detail = invalid
        .map((entry) => `linha ${entry.rowIndex + 1} tem ${entry.row.length}`)
        .join(', ');
      fail(`SKILL.md: exemplo de mapa irregular (esperado ${expected} colunas): ${detail}`);
    }
  }
}

// --- Esqueletos gerados a partir de reference/ ---

const skeletonsDir = path.join(ROOT, 'styles', 'skeletons');
if (existsSync(skeletonsDir)) {
  const skeletons = readdirSync(skeletonsDir).filter((file) => file.endsWith('.md'));
  for (const file of skeletons) {
    if (file === 'README.md') continue;
    const content = readFileSync(path.join(skeletonsDir, file), 'utf-8');
    const rows = [...content.matchAll(/^ {4}'([^']*)',$/gm)].map((match) => match[1]);

    if (rows.length === 0) {
      fail(`Esqueleto "${file}" sem mapa ASCII.`);
      continue;
    }

    const expected = rows[0].length;
    const invalid = rows
      .map((row, index) => ({ row, index }))
      .filter((entry) => entry.row.length !== expected);
    if (invalid.length > 0) {
      const detail = invalid
        .map((entry) => `linha ${entry.index + 1} tem ${entry.row.length}`)
        .join(', ');
      fail(`Esqueleto "${file}" com mapa irregular (esperado ${expected} colunas): ${detail}`);
    }
  }
}

// --- Deteccao de estilo a partir do prompt ---

const EXPECTED: [string, string][] = [
  ['Faça um personagem no estilo pixel art de pokemon', 'pixel-pokemon-gba'],
  ['desenhe um pikachu', 'pixel-pokemon-gba'],
  ['sprite em game boy', 'pixel-gameboy'],
  ['cena de NES', 'pixel-nes'],
  ['faca um sprite pixelado', 'pixel-generic'],
  ['desenhe uma espada em flat', 'vector-flat'],
  ['desenhe um gato em cartoon', 'vector-cartoon'],
  ['desenhe um icone', 'vector-flat'],
  ['desenhe uma espada de aco', 'vector-flat'],
];

for (const [prompt, expectedId] of EXPECTED) {
  const style = matchStyleFromPrompt(prompt);
  if (style.id !== expectedId) {
    fail(`Prompt "${prompt}" resolveu para "${style.id}" (esperado "${expectedId}").`);
  }
}

// --- Resultado ---

for (const warning of warnings) {
  console.warn(`AVISO: ${warning}`);
}

if (errors.length > 0) {
  console.error('Falha na validacao dos estilos:\n');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`✓ ${STYLES.length} estilos validos (padrao: ${DEFAULT_STYLE_ID}).`);
