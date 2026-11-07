---
id: ref-front
pose: front
source: reference/character-front.png
mode: pixel
grid: 14x19
cell: 1
canvas: 56x56
bbox: { x: 21, y: 20, w: 14, h: 19 }
target_canvas: 56x56 (Pixel Art Pokémon (GBA))
---

# Esqueleto — front (referência)

Sprite de **14x19 células** extraído de `reference/character-front.png` (imagem 56x56, célula de 1 px).

Use como **base de forma**: copie a silhueta e as proporções, troque as cores conforme o pedido e mantenha o contorno de 1 px.

## Papéis

| Char | Papel | Hex da referência | Hex no preset |
|---|---|---|---|
| `o` | contorno (1 px, sempre) | #000000 | #101010 |
| `w` | brilho / luz | #FFFFFF | #FCFCFC |
| `b` | cor base | #BE2633 | #E03030 |
| `c` | cor | #732930 | #603820 |
| `e` | cor | #005784 | #2038A0 |
| `f` | cor | #245AEF | #3860F8 |
| `g` | cor | #DA4200 | #E03030 |
| `i` | cor | #A46422 | #8C5030 |
| `j` | cor | #EB8931 | #F0A030 |
| `k` | cor | #F7B080 | #F8C8A0 |
| `m` | cor | #CCCCCC | #D8D8E0 |

## Mapa (14x19)

```text
...cccccccc...
..cbggggggbc..
..cggggggggc..
.cbggggggggbc.
.obbggggggbbo.
.obbbbwwbbbbo.
ojcmbmbbmbmcjo
okoewwwwwweoko
.oikeeeeeekio.
.okkkokkokkko.
..ikkikkikki..
.oeoikkkkioeo.
ikeeboooobeeki
ikkebbwwbbekki
.ioebbwwbbeoi.
..efeooooefe..
..ooffooffoo..
..oeeo..oeeo..
...oo....oo...
```

```typescript
ctx.drawPixelMap(
  [
    '...cccccccc...',
    '..cbggggggbc..',
    '..cggggggggc..',
    '.cbggggggggbc.',
    '.obbggggggbbo.',
    '.obbbbwwbbbbo.',
    'ojcmbmbbmbmcjo',
    'okoewwwwwweoko',
    '.oikeeeeeekio.',
    '.okkkokkokkko.',
    '..ikkikkikki..',
    '.oeoikkkkioeo.',
    'ikeeboooobeeki',
    'ikkebbwwbbekki',
    '.ioebbwwbbeoi.',
    '..efeooooefe..',
    '..ooffooffoo..',
    '..oeeo..oeeo..',
    '...oo....oo...',
  ],
  { o: '#000000', w: '#FFFFFF', b: '#BE2633', c: '#732930', e: '#005784', f: '#245AEF', g: '#DA4200', i: '#A46422', j: '#EB8931', k: '#F7B080', m: '#CCCCCC' }
);
```

## Vetor — geometria relativa (canvas 0-100)

| Papel | Char | Cor | bbox x0,y0 → x1,y1 (%) | área (células) |
|---|---|---|---|---|
| cor | `g` | #DA4200 | 42.9,37.5 → 57.2,44.6 | 28 |
| cor | `c` | #732930 | 42.9,35.7 → 57.2,37.5 | 8 |
| cor base | `b` | #BE2633 | 41.1,41.1 → 48.2,48.2 | 8 |
| cor base | `b` | #BE2633 | 51.8,41.1 → 58.9,48.2 | 8 |
| cor | `k` | #F7B080 | 46.4,51.8 → 53.5,57.2 | 8 |
| brilho / luz | `w` | #FFFFFF | 44.6,48.2 → 55.3,50 | 6 |
| cor | `k` | #F7B080 | 41.1,50 → 46.5,55.4 | 6 |
| cor | `e` | #005784 | 44.6,50 → 55.3,51.8 | 6 |
| cor | `k` | #F7B080 | 53.6,50 → 59,55.4 | 6 |
| cor | `e` | #005784 | 41.1,55.4 → 44.7,60.8 | 4 |
| cor | `e` | #005784 | 55.4,55.4 → 59,60.8 | 4 |
| contorno (1 px, sempre) | `o` | #000000 | 46.4,57.1 → 53.5,58.9 | 4 |
| cor | `k` | #F7B080 | 39.3,57.1 → 42.9,60.7 | 3 |
| cor base | `b` | #BE2633 | 44.6,57.1 → 48.2,60.7 | 3 |
| cor base | `b` | #BE2633 | 51.8,57.1 → 55.4,60.7 | 3 |
| cor | `k` | #F7B080 | 57.1,57.1 → 60.7,60.7 | 3 |

> 89 região(ões) de 1–2 células (detalhes finos) foram omitidas nesta tabela.

- Proporção da silhueta: **14/19** (largura/altura).
- No canvas 0-100, o sprite ocupa **x 38–63** e **y 36–70**.

## Regras

1. Mantenha o contorno de 1 px em volta de toda a silhueta.
2. Não altere a proporção da silhueta (só acrescente detalhes dentro dela).
3. Luz do topo-esquerda: sombra embaixo-direita.
4. Use `ctx.setPalette([...])` se quiser bater com a paleta da referência.
5. Antes de entregar: `npm run render <pasta>` + **ler o preview.png** + `npm run doctor <arquivo>`.
