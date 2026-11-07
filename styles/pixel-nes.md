# Pixel Art NES (8-bit)

Visual dos jogos de NES: paleta fixa e resolucao baixa (32x32), com forms simples e legiveis.

## Configuração

| Item | Valor |
|---|---|
| Id | `pixel-nes` |
| Grade | 32 x 32 células |
| Escala final | 16x (saída 512 x 512 px) |
| Cores | 16 (paleta NES, quantização automática) |
| Contorno | 1 px, cor `#000000` |
| Sombreamento | 2 tons |
| Quantização | **sim** — toda cor é forçada para a paleta NES |

## Paleta

```text
#7C7C7C  #0000FC  #0000BC  #4428BC
#A01000  #E45C10  #AC7C00  #00B800
#48D048  #005800  #B8F818  #F8D800
#F8A800  #F83800  #F87858  #F0F0F0
```

## Regras

1. **Grade 32x32**: poucas células. Cada pixel conta.
2. **Detalhe vira bloco**: nao existe linha de 1 px de cor diferente no meio de uma forma
   grande — o contraste e feito por blocos de 2 px ou mais.
3. **Sombreamento em 2 tons** apenas.
4. **Paleta NES**: cores saturadas e puras, sem tons pastéis.
5. **Silhueta forte**: o NES usava sprites pequenos, entao a forma geral carrega o desenho.

## Anti-padrões

- Tentar detalhe fino (1 px) em area grande: vira ruido.
- Tons pastéis ou dessaturados: a quantizacao joga para fora da paleta.
- Sprite maior que 24x24 dentro da grade: nao cabe o detalhe.

## Exemplo

```typescript
export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('pixel-nes');

  ctx.drawPixelRect(10, 18, 12, 10, '#B8F818');  // corpo do heroi
  ctx.drawPixelRect(12, 8, 8, 10, '#F8D800');    // cabeca
  ctx.drawPixelRect(13, 11, 2, 2, '#000000');    // olho
  ctx.drawPixelRect(17, 11, 2, 2, '#000000');    // olho
  ctx.drawPixelRect(12, 4, 8, 4, '#F83800');     // capacete
  ctx.outlinePixels('#000000');
}
```
