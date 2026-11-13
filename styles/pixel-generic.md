# Pixel Art Generico

Padrao pixel art para icones, itens, tiles e personagens pequenos. Use quando o prompt pedir
"pixel art", "pixelado" ou "sprite" sem citar um jogo ou console.

## Configuração

| Item | Valor |
|---|---|
| Id | `pixel-generic` |
| Grade | 32 x 32 células |
| Escala final | 8x (saída 256 x 256 px) |
| Cores | até 16 (paleta abaixo) |
| Contorno | 1 px, cor `#0F172A` |
| Sombreamento | 3 tons por material |
| Quantização | não |

## Paleta

```text
Neutros  #0F172A  #1E293B  #334155  #475569  #64748B  #94A3B8  #CBD5E1  #E2E8F0
Cores    #EF4444  #F97316  #F59E0B  #84CC16  #22C55E  #06B6D4  #3B82F6  #A855F7
```

## Regras

1. **Grade 32x32**: o sprite ocupa 24-28 px e fica centralizado (offset ~2).
2. **Mapa retangular**: `drawPixelMap` lança erro se as linhas tiverem larguras diferentes.
3. **Silhueta primeiro**: se a forma nao se lê em silhueta preta, o icone está ruim.
4. **Contorno escuro de 1 px** (`ctx.outlinePixels('#0F172A')`).
5. **Separação entre regiões**: `ctx.separatePixels('#0F172A')` (ex.: detalhe claro sobre corpo escuro).
6. **3 tons**: base, luz em cima, sombra embaixo. Sem gradiente.
7. **Detalhes pequenos viram blocos**: em 32x32 um detalhe de 1 px some. Prefira 2 px.
8. **Icones simples**: menos elementos = mais legibilidade. 2 a 3 formas principais.

## Anti-padrões

- Sprite de 32x32 com 16 cores e 10 elementos: vira ruido.
- Usar `drawCircle`/`drawEllipse` para detalhe fino: a curva vira serrilha irregular.
- Texto dentro do sprite: ilegivel em 32x32.

## Exemplo

```typescript
export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('pixel-generic');

  // Poção: corpo, gargalo, rolha e brilho
  ctx.drawPixelRect(12, 16, 8, 12, '#3B82F6');
  ctx.drawPixelRect(13, 11, 6, 5, '#3B82F6');
  ctx.drawPixelRect(12, 8, 8, 3, '#F59E0B');
  ctx.drawPixelRect(13, 19, 2, 6, '#E2E8F0');
  ctx.outlinePixels('#0F172A');
}
```

> Para personagem, prefira `ctx.drawPixelMap(...)`: o mapa ASCII garante a silhueta exata.
