import type { PixelStyle, Style, StyleInfo, VectorStyle } from './types.js';

/**
 * Remove acentos, baixa a caixa e colapsa espaços.
 * Usado para comparar o prompt do usuário com as keywords do catálogo.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escapa uma string para uso em RegExp. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Monta o RegExp de fronteira para uma keyword: a keyword só casa como palavra inteira.
 * Evita falsos positivos como "nes" dentro de "linhas" ou "pokemon" dentro de "pokemonster".
 */
function keywordPattern(keyword: string): RegExp {
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(keyword)}(?![a-z0-9])`, 'i');
}

const POKEMON_PALETTE = [
  '#181018', '#FCFCFC', '#D8D8E0', '#101010',
  '#F8D030', '#F0A030', '#C87018',
  '#F8C8A0', '#E09860',
  '#8C5030', '#603820',
  '#E03030', '#A01020',
  '#3860F8', '#2038A0',
  '#58D854', '#289040',
  '#9058F8', '#5828A8',
  '#909090', '#585858',
];

const GENERIC_PALETTE = [
  '#0F172A', '#1E293B', '#334155', '#475569',
  '#64748B', '#94A3B8', '#CBD5E1', '#E2E8F0',
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#06B6D4', '#3B82F6', '#A855F7',
];

const GAMEBOY_PALETTE = ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F'];

const NES_PALETTE = [
  '#7C7C7C', '#0000FC', '#0000BC', '#4428BC',
  '#A01000', '#E45C10', '#AC7C00', '#00B800',
  '#48D048', '#005800', '#B8F818', '#F8D800',
  '#F8A800', '#F83800', '#F87858', '#F0F0F0',
];

/**
 * Catálogo de estilos do Asset Builder.
 *
 * A ordem do array é a ordem de desempate quando duas styles casam com o mesmo
 * prompt na mesma prioridade (a primeira vence).
 */
export const STYLES: Style[] = [
  {
    id: 'pixel-pokemon-gba',
    label: 'Pixel Art Pokémon (GBA)',
    family: 'pixel',
    guide: 'styles/pixel-pokemon-gba.md',
    priority: 10,
    keywords: [
      'pokemon', 'pikachu', 'charizard', 'bulbasaur', 'squirtle', 'eevee',
      'pocket monster', 'monstro de pokemon', 'criatura de pokemon', 'pixel monster',
      'gba', 'game boy advance',
    ],
    cols: 56,
    rows: 56,
    pixelScale: 8,
    palette: POKEMON_PALETTE,
    maxColors: 21,
    outline: 'dark',
    outlineColor: '#181018',
    shading: 'three-tone',
    quantize: true,
    background: null,
    rules: [
      'Grade 56x56, sprite ocupa ~44x44 centralizado.',
      'Contorno escuro (#181018) de 1 px em toda a silhueta.',
      '3 tons por material (base, luz no topo-esquerda, sombra embaixo-direita).',
      'Maximo de 24 cores; use apenas a paleta do guia.',
      'Olhos de 2 a 3 px com 1 px de brilho branco.',
      'Sem gradiente: apenas degraus solidos de cor.',
    ],
  },
  {
    id: 'pixel-gameboy',
    label: 'Pixel Art Game Boy',
    family: 'pixel',
    guide: 'styles/pixel-gameboy.md',
    priority: 20,
    keywords: ['game boy', 'gameboy', 'game-boy', 'monocrom', 'dmg', '4 tons'],
    cols: 48,
    rows: 48,
    pixelScale: 8,
    palette: GAMEBOY_PALETTE,
    maxColors: 4,
    outline: 'dark',
    outlineColor: '#0F380F',
    shading: 'two-tone',
    quantize: true,
    background: null,
    rules: [
      'Grade 48x48, apenas 4 tons de verde.',
      'As cores sao forcadas para a paleta (quantizacao automatica).',
      'Sombras representadas pelo tom mais escuro, nunca por preto.',
      'Use dithering (bayer4) para transicoes suaves de meio-tom.',
    ],
  },
  {
    id: 'pixel-nes',
    label: 'Pixel Art NES (8-bit)',
    family: 'pixel',
    guide: 'styles/pixel-nes.md',
    priority: 20,
    keywords: ['nes', 'famicom', '8-bit', '8 bits', '8bit'],
    cols: 32,
    rows: 32,
    pixelScale: 16,
    palette: NES_PALETTE,
    maxColors: 16,
    outline: 'dark',
    outlineColor: '#000000',
    shading: 'two-tone',
    quantize: true,
    background: null,
    rules: [
      'Grade 32x32 (baixa resolucao) com escala 16x na saida final.',
      'Paleta fixa de 16 cores do NES (quantizacao automatica).',
      'Formas simples e legiveis: detalhe vira bloco, nao contorno fino.',
      'Sombreamento em 2 tons apenas.',
    ],
  },
  {
    id: 'pixel-generic',
    label: 'Pixel Art Generico',
    family: 'pixel',
    guide: 'styles/pixel-generic.md',
    priority: 30,
    keywords: ['pixel art', 'pixelart', 'pixelado', 'pixel', 'sprite', '16-bit', '16 bits', '16bit', 'snes'],
    cols: 32,
    rows: 32,
    pixelScale: 8,
    palette: GENERIC_PALETTE,
    maxColors: 16,
    outline: 'dark',
    outlineColor: '#0F172A',
    shading: 'three-tone',
    quantize: true,
    background: null,
    rules: [
      'Grade 32x32, saida final 256x256.',
      'Contorno escuro de 1 px em volta da silhueta.',
      '3 tons por material, luz vinda do topo-esquerda.',
      'Maximo de 16 cores.',
      'Icons e itens: formes simples e legiveis em 32x32.',
    ],
  },
  {
    id: 'vector-cartoon',
    label: 'Vetorial Cartoon',
    family: 'vector',
    guide: 'styles/vector-cartoon.md',
    priority: 40,
    keywords: ['cartoon', 'carto', 'desenho animado', 'personagem cartoon'],
    rules: [
      'Contorno escuro de 2 a 3 px em todas as formas.',
      'Cores chapadas, sem degrade.',
      'Proporcoes exageradas (cabeca grande, olhos expressivos).',
      'Sombra simples em uma unica tonalidade mais escura.',
    ],
  },
  {
    id: 'vector-outline',
    label: 'Vetorial Contorno',
    family: 'vector',
    guide: 'styles/vector-outline.md',
    priority: 40,
    keywords: ['outline', 'contorno', 'lineart', 'line art', 'traco'],
    rules: [
      'Somente contorno, sem preenchimento (fundo transparente).',
      'Espessura de linha 1.5 a 2 px.',
      'Curvas suaves permitidas (bezier e quadratica).',
    ],
  },
  {
    id: 'vector-flat',
    label: 'Vetorial Flat',
    family: 'vector',
    guide: 'styles/vector-flat.md',
    priority: 90,
    keywords: ['flat', 'vetorial', 'vetor', 'limpo', 'simples', 'icone', 'minimalista', 'flat design'],
    rules: [
      'Formas simples e cores solidas.',
      'Sem degrade e sem sombra dura.',
      'Mantenha o desenho centralizado no canvas logico 0-100.',
    ],
  },
];

export const DEFAULT_STYLE_ID = 'vector-flat';

export const STYLE_IDS: string[] = STYLES.map((style) => style.id);

/** Retorna o estilo pelo id (undefined se não existir). */
export function getStyle(id: string): Style | undefined {
  return STYLES.find((style) => style.id === id);
}

/** Lista os estilos de uma família. */
export function listStyles(family?: 'pixel' | 'vector'): Style[] {
  return family ? STYLES.filter((style) => style.family === family) : STYLES;
}

/** Converte um estilo do catálogo na versão serializável usada pelo frontend. */
export function toStyleInfo(style: Style): StyleInfo {
  if (style.family === 'pixel') {
    const pixel = style as PixelStyle;
    return {
      id: pixel.id,
      label: pixel.label,
      family: 'pixel',
      cols: pixel.cols,
      rows: pixel.rows,
      pixelScale: pixel.pixelScale,
      palette: pixel.palette,
      maxColors: pixel.maxColors,
      outline: pixel.outline,
      outlineColor: pixel.outlineColor,
      shading: pixel.shading,
      quantize: pixel.quantize,
      background: pixel.background,
      rules: pixel.rules,
      guide: pixel.guide,
    };
  }

  const vector = style as VectorStyle;
  return {
    id: vector.id,
    label: vector.label,
    family: 'vector',
    cols: 0,
    rows: 0,
    pixelScale: 0,
    palette: [],
    maxColors: 0,
    outline: 'none',
    outlineColor: null,
    shading: 'flat',
    quantize: false,
    background: null,
    rules: vector.rules,
    guide: vector.guide,
  };
}

/**
 * Espelho da regra de selecao de estilo descrita no SKILL.md.
 * Usado pela UI e pelos checks; a autoridade continua sendo o SKILL.md.
 */
export function matchStyleFromPrompt(prompt: string): Style {
  const text = normalizeText(prompt);
  if (!text) return getStyle(DEFAULT_STYLE_ID)!;

  let best: Style | null = null;
  for (const style of STYLES) {
    const matched = style.keywords.some((keyword) => keywordPattern(keyword).test(text));
    if (!matched) continue;
    if (!best || style.priority < best.priority) best = style;
  }

  return best ?? getStyle(DEFAULT_STYLE_ID)!;
}
