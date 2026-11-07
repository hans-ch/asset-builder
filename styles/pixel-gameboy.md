# Pixel Art Game Boy

Visual monocromatico do Game Boy original: 4 tons de verde sobre fundo quase preto.

## Configuração

| Item | Valor |
|---|---|
| Id | `pixel-gameboy` |
| Grade | 48 x 48 células |
| Escala final | 8x (saída 384 x 384 px) |
| Cores | 4 (quantização automática para a paleta) |
| Contorno | 1 px, cor `#0F380F` |
| Sombreamento | 2 tons |
| Quantização | **sim** — toda cor é forçada para a paleta |

## Paleta

```text
#0F380F  (mais escuro)
#306230
#8BAC0F
#9BBC0F  (mais claro)
```

## Regras

1. **Só 4 tons.** Qualquer cor fora da paleta vira a mais próxima automaticamente.
2. **Preto quase nao existe**: use `#0F380F` no lugar de preto puro.
3. **Grade generosa** (48x48) para caber detalhe sem poluir.
4. **Sombreamento em 2 tons** (base + sombra). O terceiro tom so com dithering.
5. **Dithering** (`ctx.ditherPixels(..., 'bayer4')`) para simular meio-tom em céu, chão e água.

## Anti-padrões

- Usar preto puro (`#000000`) para contorno: destoa da paleta.
- Gradiente suave: vira uma mancha so.
- Sprite muito detalhado: com 4 tons o detalhe some.

## Exemplo

```typescript
export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('pixel-gameboy');

  ctx.drawPixelRect(14, 20, 20, 16, '#8BAC0F');   // corpo
  ctx.drawPixelRect(16, 10, 16, 12, '#8BAC0F');   // cabeca
  ctx.drawPixelRect(18, 14, 3, 3, '#0F380F');     // olho
  ctx.drawPixelRect(27, 14, 3, 3, '#0F380F');     // olho
  ctx.ditherPixels(10, 30, 28, 8, '#306230', '#8BAC0F', 'bayer4');
  ctx.outlinePixels('#0F380F');
}
```
