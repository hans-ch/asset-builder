import type { ExtractedGrid } from './pngToGrid.js';

export interface SkeletonDocInput {
  id: string;
  pose: string;
  source: string;
  grid: ExtractedGrid;
  /** char -> hex mais proximo no preset escolhido. */
  presetPalette?: Record<string, string>;
  presetLabel?: string;
  /** Grade de destino (canvas do preset). */
  canvas?: { cols: number; rows: number; label: string };
}

const ROLE_LABELS: Record<string, string> = {
  contorno: 'contorno (1 px, sempre)',
  sombra: 'sombra',
  base: 'cor base',
  'brilho': 'brilho / luz',
  'cor clara': 'cor clara',
  cor: 'cor',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * Monta o markdown do esqueleto com as duas secoes:
 *  - "Pixel": mapa ASCII pronto para `ctx.drawPixelMap`;
 *  - "Vetor": geometria relativa (regioes em %) para reproduzir em 0-100.
 */
export function buildSkeletonDoc(input: SkeletonDocInput): string {
  const { grid } = input;
  const chars = Object.keys(grid.palette);

  const lines: string[] = [];

  lines.push('---');
  lines.push(`id: ${input.id}`);
  lines.push(`pose: ${input.pose}`);
  lines.push(`source: ${input.source}`);
  lines.push('mode: pixel');
  lines.push(`grid: ${grid.cols}x${grid.rows}`);
  lines.push(`cell: ${grid.cell}`);
  lines.push(
    `canvas: ${grid.imageWidth}x${grid.imageHeight}`
  );
  lines.push(
    `bbox: { x: ${grid.bbox.x}, y: ${grid.bbox.y}, w: ${grid.bbox.w}, h: ${grid.bbox.h } }`
  );
  if (input.canvas) {
    lines.push(`target_canvas: ${input.canvas.cols}x${input.canvas.rows} (${input.canvas.label})`);
  }
  lines.push('---');
  lines.push('');
  lines.push(`# Esqueleto — ${input.pose} (referência)`);
  lines.push('');
  lines.push(
    `Sprite de **${grid.cols}x${grid.rows} células** extraído de \`${input.source}\` ` +
      `(imagem ${grid.imageWidth}x${grid.imageHeight}, célula de ${grid.cell} px).`
  );
  lines.push('');
  lines.push(
    'Use como **base de forma**: copie a silhueta e as proporções, troque as cores ' +
      'conforme o pedido e mantenha o contorno de 1 px.'
  );
  lines.push('');
  lines.push('## Papéis');
  lines.push('');
  lines.push('| Char | Papel | Hex da referência | Hex no preset |');
  lines.push('|---|---|---|---|');
  for (const char of chars) {
    const hex = grid.palette[char];
    const role = grid.roles[char] ?? 'cor';
    const preset = input.presetPalette?.[char] ?? '—';
    lines.push(`| \`${char}\` | ${roleLabel(role)} | ${hex} | ${preset} |`);
  }
  lines.push('');
  lines.push(`## Mapa (${grid.cols}x${grid.rows})`);
  lines.push('');
  lines.push('```text');
  for (const row of grid.map) lines.push(row);
  lines.push('```');
  lines.push('');
  lines.push('```typescript');
  lines.push(`ctx.drawPixelMap(`);
  lines.push('  [');
  for (const row of grid.map) lines.push(`    '${row}',`);
  lines.push('  ],');
  lines.push(`  { ${chars.map((char) => `${char}: '${grid.palette[char]}'`).join(', ')} }`);
  lines.push(');');
  lines.push('```');
  lines.push('');
  lines.push('## Vetor — geometria relativa (canvas 0-100)');
  lines.push('');
  const notable = grid.regions.filter((region) => region.area >= 3);
  lines.push('| Papel | Char | Cor | bbox x0,y0 → x1,y1 (%) | área (células) |');
  lines.push('|---|---|---|---|---|');
  for (const region of notable) {
    const x1 = Math.round((region.x + region.w) * 10) / 10;
    const y1 = Math.round((region.y + region.h) * 10) / 10;
    const role = grid.roles[region.char] ?? 'cor';
    lines.push(
      `| ${roleLabel(role)} | \`${region.char}\` | ${region.color} | ${region.x},${region.y} → ${x1},${y1} | ${region.area} |`
    );
  }
  lines.push('');
  const small = grid.regions.length - notable.length;
  if (small > 0) {
    lines.push(
      `> ${small} região(ões) de 1–2 células (detalhes finos) foram omitidas nesta tabela.`
    );
    lines.push('');
  }
  lines.push(
    `- Proporção da silhueta: **${grid.cols}/${grid.rows}** (largura/altura).`
  );
  lines.push(
    `- No canvas 0-100, o sprite ocupa **x ${Math.round((grid.bbox.x / grid.imageWidth) * 100)}–${Math.round(
      ((grid.bbox.x + grid.bbox.w) / grid.imageWidth) * 100
    )}** e **y ${Math.round((grid.bbox.y / grid.imageHeight) * 100)}–${Math.round(
      ((grid.bbox.y + grid.bbox.h) / grid.imageHeight) * 100
    )}**.`
  );
  lines.push('');
  lines.push('## Regras');
  lines.push('');
  lines.push('1. Mantenha o contorno de 1 px em volta de toda a silhueta.');
  lines.push('2. Não altere a proporção da silhueta (só acrescente detalhes dentro dela).');
  lines.push('3. Luz do topo-esquerda: sombra embaixo-direita.');
  lines.push('4. Use `ctx.setPalette([...])` se quiser bater com a paleta da referência.');
  lines.push(
    '5. Antes de entregar: `npm run render <pasta>` + **ler o preview.png** + `npm run doctor <arquivo>`.'
  );
  lines.push('');

  return lines.join('\n');
}
