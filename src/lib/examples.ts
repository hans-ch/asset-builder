export const EXAMPLE_PROMPTS = [
  'Desenhe uma poção de vida vermelha',
  'Desenhe um escudo de madeira',
  'Desenhe uma espada de aço',
  'Desenhe uma moeda de ouro',
  'Desenhe uma gema azul',
  'Desenhe uma bomba clássica',
  'Desenhe um coração pixelado',
  'Desenhe uma caixa de tesouro',
];

export const DEFAULT_CODE = `export function generateAsset(ctx: VectorContext) {
  // Fundo transparente (opcional)
  ctx.setBackground('#1f2937');

  ctx.startGroup('corpo');
  ctx.drawRoundedRect(30, 30, 40, 40, 8, '#4CAF50');
  ctx.drawCircle(50, 50, 12, '#81C784');
  ctx.endGroup();
}`;
