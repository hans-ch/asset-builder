# Pixel Art Pokémon (GBA)

Estilo de sprite de creature no estilo dos jogos de Pokemon para Game Boy Advance.

## Configuração

| Item | Valor |
|---|---|
| Id | `pixel-pokemon-gba` |
| Grade | 56 x 56 células |
| Escala final | 8x (saída 448 x 448 px) |
| Cores | até 21 (paleta fixa abaixo) |
| Contorno | 1 px, cor `#181018` |
| Sombreamento | 3 tons por material |
| Quantização | não (a paleta é orienta, não obrigatória) |

## Paleta

```text
Outline / pretos  #181018  #101010  #D8D8E0  #FCFCFC
Amarelo           #F8D030  #F0A030  #C87018
Pele              #F8C8A0  #E09860
Marrom            #8C5030  #603820
Vermelho          #E03030  #A01020
Azul              #3860F8  #2038A0
Verde             #58D854  #289040
Roxo              #9058F8  #5828A8
Cinza             #909090  #585858
```

## Regras

1. **Grade, não pixels soltos.** A silhueta ocupa ~32 x 32 células centralizadas (sprite de 24–32
   células lê melhor do que um sprite de 56). Nada de meia grade: todo pixel cai em uma célula inteira.
2. **Mapa retangular.** `drawPixelMap` lança erro se as linhas tiverem larguras diferentes — corrija
   o mapa (o erro lista as linhas e a largura esperada).
3. **Contorno escuro de 1 px** em toda a silhueta (`ctx.outlinePixels('#181018')`). O contorno é
   desenhado **depois** do corpo, nunca antes.
4. **Separação entre regiões**: `ctx.separatePixels('#181018')` desenha a linha escura entre cores
   diferentes (ex.: o branco do olho sobre o vermelho do capacete). Chame depois do corpo e antes do
   `outlinePixels`.
5. **3 tons por material**: base, luz (topo-esquerda) e sombra (base-direita). A luz vem sempre
   do mesmo lugar em todos os assets do mesmo grupo.
6. **Olhos de 2 a 3 px** de largura, com 1 px de brilho branco no canto superior.
7. **Sem gradiente**: só degraus sólidos. Transições suaves só por dithering (`bayer4`) e só em
   áreas grandes (céu, chão), nunca no personagem.
8. **Anatomia primeiro**: orelhas, cauda, membros e snout são lidos pela silhueta. Detalhe interno
   só depois que a silhueta estiver boa.
9. **Simetria**: desenhe a metade esquerda e use `ctx.mirrorPixels('x')` para espelhar.

## Anti-padrões

- Cores fora da paleta sem necessidade (o resultado fica "sujo").
- Contorno de 2 px: em 56x56 o contorno grosso come a silhueta.
- Olhos enormes (4 px ou mais): o sprite fica com cara de icone, não de personagem.
- Sombra hardcoded em cada parte: use `ctx.shadePixels(base, sombra)` para trocar a cor depois.

## Exemplo

```typescript
export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('pixel-pokemon-gba');

  ctx.drawPixelMap(
    [
      '.....oooooo.....',
      '....obbbbbbo....',
      '...obbbbbbbbo...',
      '..obllllllllbo..',
      '.obllllllllllbo.',
      '.obllllllllllbo.',
      '.oblwwwwwwwwlbo.',
      '.oblllkkkkkklbo.',
      '.obllllllllllbo.',
      '.obllllllllllbo.',
      '.obllllllllllbo.',
      '.obllllllllllbo.',
      '.obllllllllllbo.',
      '..obllllllllbo..',
      '...obbbbbbbbo...',
      '.....oooooo.....',
    ],
    {
      o: '#181018',
      b: '#58D854',
      l: '#8BAC0F',
      w: '#FCFCFC',
      k: '#101010',
    },
    { x: 20, y: 20 }
  );
}
```

> O mapa ASCII é a forma mais confiável de desenhar personagem: cada caractere é uma célula,
> então o sprite fica exatamente como foi escrito, sem depender de antialias ou de curvas.
