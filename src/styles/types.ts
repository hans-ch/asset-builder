export type StyleFamily = 'pixel' | 'vector';

export type OutlineMode = 'none' | 'dark' | 'dark-diagonal';

export type ShadingMode = 'flat' | 'two-tone' | 'three-tone';

export interface StyleBase {
  /** Identificador único usado em `ctx.setStyle('...')`. */
  id: string;
  /** Rótulo exibido na UI. */
  label: string;
  family: StyleFamily;
  /** Palavras-chave normalizadas (minúsculas, sem acento) usadas na detecção do prompt. */
  keywords: string[];
  /** Caminho do guia técnico do estilo, relativo à raiz do projeto. */
  guide: string;
  /** Menor número = maior precedência na detecção de estilo. */
  priority: number;
  /** Regras curtas de técnica (usadas pelo SKILL.md e exibidas na UI). */
  rules: string[];
}

export interface PixelStyle extends StyleBase {
  family: 'pixel';
  /** Largura da grade em células. */
  cols: number;
  /** Altura da grade em células. */
  rows: number;
  /** Pixels finais por célula (escala inteira). */
  pixelScale: number;
  /** Paleta permitida pelo estilo. */
  palette: string[];
  /** Limite de cores distintas por asset. */
  maxColors: number;
  outline: OutlineMode;
  outlineColor: string | null;
  shading: ShadingMode;
  /** Quando true, as cores são forçadas para a paleta no flush final. */
  quantize: boolean;
  /** Cor de fundo aplicada ao abrir a grade (null = transparente). */
  background: string | null;
}

export interface VectorStyle extends StyleBase {
  family: 'vector';
}

export type Style = PixelStyle | VectorStyle;

/** Versão achatada e serializável de um estilo (usada pelo frontend). */
export interface StyleInfo {
  id: string;
  label: string;
  family: StyleFamily;
  cols: number;
  rows: number;
  pixelScale: number;
  palette: string[];
  maxColors: number;
  outline: OutlineMode;
  outlineColor: string | null;
  shading: ShadingMode;
  quantize: boolean;
  background: string | null;
  rules: string[];
  guide: string;
}
