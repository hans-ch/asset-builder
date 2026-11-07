export const EXAMPLE_PROMPTS = [
  'Desenhe uma poção de vida vermelha',
  'Desenhe um escudo de madeira',
  'Desenhe uma espada de aço',
  'Desenhe uma moeda de ouro',
  'Desenhe uma gema azul',
  'Desenhe uma bomba clássica',
  'Desenhe um coração pixelado',
  'Desenhe uma caixa de tesouro',
  'Faça um personagem no estilo pixel art de pokemon',
  'Desenhe uma espada no estilo pixel art',
  'Desenhe um cogumelo no estilo game boy',
  'Desenhe um gato em estilo cartoon',
];

export const DEFAULT_CODE = `export function generateAsset(ctx: VectorContext) {
  // Fundo transparente (opcional)
  ctx.setBackground('#1f2937');

  ctx.startGroup('corpo');
  ctx.drawRoundedRect(30, 30, 40, 40, 8, '#4CAF50');
  ctx.drawCircle(50, 50, 12, '#81C784');
  ctx.endGroup();
}`;

export const DEFAULT_PIXEL_CODE = `// Prompt: Faça um personagem no estilo pixel art de pokemon
// Estilo: pixel-pokemon-gba
// Asset: personagem pixel art
// Gerado em: 2026-11-06

export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('pixel-pokemon-gba');

  ctx.drawPixelMap(
    [
      '.......oooooo.......',
      '.....olllllllo.....',
      '....ollllllllllo....',
      '...olllllllllllllo...',
      '..ollllllllllllllllo..',
      '..ollllllllllllllllo..',
      '..ollllllllllllllllo..',
      '..ollllllllllllllllo..',
      '..obllllllllllllllbo..',
      '..obbwwbbbbbbwwbo..',
      '..obbwkbbbbbbwkkbo..',
      '..obllllllllllllllbo..',
      '..obllllllllllllllbo..',
      '..obllllllllllllllbo..',
      '..obllllllllllllllbo..',
      '..obdddddddddddddddo..',
      '...obbbbbbbbbbbbo...',
      '....obbbbbbbbbbo....',
      '.....obbbbbbbo.....',
      '.......oooooo.......',
    ],
    {
      o: '#181018',
      l: '#F8D030',
      b: '#F0A030',
      d: '#C87018',
      w: '#FCFCFC',
      k: '#101010',
    },
    { x: 20, y: 19 }
  );
}`;
