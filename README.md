# Asset Builder

Ferramenta web para visualizar e editar assets 2D gerados proceduralmente via OpenCode CLI.

## Fluxo de uso

1. Você prompta pelo **OpenCode CLI** referenciando o `SKILL.md`.
2. O agente CLI gera os scripts TypeScript e os salva em `asset_gen/<pasta_do_grupo>/`.
3. Você roda `npm run dev` para abrir a interface web.
4. Navega pelo explorer, clica em um script e vê o preview em tempo real.
5. Pode fazer pequenas edições manuais e salvar com `Ctrl+S`.

## Tecnologias

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Monaco Editor](https://github.com/suren-atoyan/monaco-react)
- [Sucrase](https://github.com/alangpierce/sucrase) para compilar TypeScript
- [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) para renderização no Node

## Como usar

```bash
npm install
npm run dev
```

## Renderizar previews pela linha de comando

Renderizar um único arquivo:

```bash
npm run render asset_gen/espadas_coloridas_01/espada_vermelha.ts
```

Renderizar o preview de um grupo (primeiro `.ts` da pasta):

```bash
npm run render asset_gen/espadas_coloridas_01
```

## Estrutura de assets

```
asset_gen/
└── espadas_coloridas_01/        # uma pasta por prompt/grupo
    ├── espada_vermelha.ts
    ├── espada_azul.ts
    ├── espada_verde.ts
    └── preview.png
```

## Estilos (pixel art e vetorial)

O estilo é escolhido **no prompt** e registrado no arquivo gerado:

```text
"Faça um personagem no estilo pixel art de pokemon"  → pixel-pokemon-gba
"Desenhe uma espada no estilo pixel art"             → pixel-generic
"Um sprite em game boy"                              → pixel-gameboy
"Desenhe um gato em cartoon"                         → vector-cartoon
"Desenhe uma espada de aço"                          → vector-flat (padrão)
```

O script gerado começa sempre com o estilo e o cabeçalho registra a escolha:

```typescript
// Prompt: Faça um personagem no estilo pixel art de pokemon
// Estilo: pixel-pokemon-gba

export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('pixel-pokemon-gba');
  // ...
}
```

| Id | Família | Grade | Saída | Cores |
|---|---|---|---|---|
| `pixel-pokemon-gba` | pixel | 56×56 | 448×448 | até 21 |
| `pixel-gameboy` | pixel | 48×48 | 384×384 | 4 (quantizado) |
| `pixel-nes` | pixel | 32×32 | 512×512 | 16 (quantizado) |
| `pixel-generic` | pixel | 32×32 | 256×256 | até 16 |
| `vector-cartoon` | vetorial | — | livre | livre |
| `vector-outline` | vetorial | — | livre | livre |
| `vector-flat` | vetorial | — | livre | livre (padrão) |

No modo pixel o desenho acontece em uma grade discreta (sem antialias) e o preview mostra o badge
do estilo, a paleta e um overlay de grade. As regras técnicas de cada estilo estão em `styles/<id>.md`
e no `SKILL.md`.

## Scripts

- `npm run dev` — servidor de desenvolvimento com explorer de assets
- `npm run build` — build de produção
- `npm run lint` — lint do código
- `npm run preview` — preview do build
- `npm run render <caminho>` — renderiza preview PNG no Node
- `npm run styles:check` — valida o catálogo de estilos, o `SKILL.md` e os esqueletos
- `npm run skeleton <png>` — extrai um esqueleto `.md` de uma imagem de `reference/`
- `npm run pixelize <png>` — gera um asset `.ts` editável a partir de uma imagem
- `npm run doctor <asset>` — relatório de qualidade do asset (texto, exit code)

> Flags de script no npm precisam do separador `--`:
> `npm run skeleton -- reference/character-front.png --pose front --name ref-front`.

## Imagens de referência e esqueletos

A pasta `reference/` guarda os PNGs de referência (personagens, itens, assets). O comando
`npm run skeleton` extrai de cada imagem um **esqueleto** em `styles/skeletons/`:

- `## Pixel` — o mapa ASCII pronto para `ctx.drawPixelMap` e a tabela de papéis (char → cor);
- `## Vetor` — a geometria relativa (bbox de cada região em % do canvas) para desenhar em 0–100;
- `<nome>-guia.png` — a referência com grid 0–100 sobreposto (para ler coordenadas com visão).

```bash
npm run skeleton -- reference/character-front.png --pose front --name ref-front --style pixel-pokemon-gba
```

Já existem dois esqueletos prontos: `ref-front` (frente) e `ref-profile` (perfil), ambos 14×19.

## Verificar a qualidade de um asset

```bash
npm run render -- asset_gen/meu_grupo      # gera o preview.png
npm run doctor -- asset_gen/meu_grupo/personagem.ts
```

O `doctor` é texto (barato) e aponta: mapa irregular, cor fora da paleta, contorno externo ausente,
separação interna pendente, silhueta irregular, simetria, número de cores e densidade de detalhes.
 Sai com código ≠ 1 quando há falhas.

## API de Desenho

Cada script deve exportar:

```typescript
export function generateAsset(ctx: VectorContext) {
  // Define resolução maior para bordas nítidas (opcional)
  ctx.setCanvasSize(512);

  ctx.setBackground('#1f2937');
  ctx.drawCircle(50, 50, 30, '#3b82f6');

  // Linha orgânica com curva de Bézier cúbica
  ctx.drawBezier(10, 50, 30, 20, 70, 80, 90, 50, 2, '#22c55e');
}
```

Para pixel art, use `ctx.setStyle('pixel-...')` e as primitivas de grade (`drawPixelMap`,
`drawPixelRect`, `outlinePixels`, `mirrorPixels`, ...). Veja `src/engine/types.ts`,
`src/styles/registry.ts` e `SKILL.md` para a lista completa de métodos e regras de salvamento.
