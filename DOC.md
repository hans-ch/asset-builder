# Asset Builder — Documentação Completa

## 1. Visão geral

**Asset Builder** é uma ferramenta híbrida para geração procedural de assets 2D.

- **Geração**: feita via **OpenCode CLI** usando `SKILL.md`. O agente CLI cria scripts TypeScript e os salva em `asset_gen/<grupo>/`.
- **Visualização/edição**: interface web (React + Vite) com explorer de arquivos, editor Monaco e preview de canvas em tempo real.
- A interface web **não possui input de prompt nem integração com API de IA**.

O diferencial é que os scripts são desenhados em um sistema vetorial de coordenadas lógicas (0–100) e podem ser renderizados em qualquer resolução real via `ctx.setCanvasSize(n)`.

---

## 2. Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Build / dev server | Vite 8 |
| UI | React 19 + TypeScript 6 |
| Estilos | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Editor de código | Monaco Editor (`@monaco-editor/react`) |
| Compilação TS em runtime | Sucrase |
| Renderização no Node | `@napi-rs/canvas` |
| Backend de arquivos | Express como middleware do Vite |
| Scripts CLI | `tsx` |

---

## 3. Estrutura de pastas

```
asset-builder/
├── asset_gen/                         # Assets gerados pelo CLI (não versionar)
│   └── <grupo_01>/
│       ├── asset_01.ts
│       ├── asset_02.ts
│       └── preview.png
├── scripts/
│   ├── render.ts                      # CLI para renderizar previews PNG no Node
│   └── check-styles.ts                # Valida o catálogo de estilos
├── server/
│   └── api.ts                         # Endpoints REST de arquivos + render
├── src/
│   ├── components/
│   │   ├── AssetExplorer.tsx          # Explorer de pastas/scripts
│   │   ├── EditorPanel.tsx            # Monaco Editor + salvar
│   │   ├── PreviewPanel.tsx           # Canvas + zoom + export PNG
│   │   ├── Resizer.tsx                # Alça de redimensionamento entre colunas
│   │   └── ErrorConsole.tsx           # Exibe erros
│   ├── engine/
│   │   ├── types.ts                   # Interface VectorContext
│   │   ├── VectorEngine.ts            # Implementação dos métodos de desenho
│   │   ├── runner.ts                  # runAsset(): executa + finaliza (flush do modo pixel)
│   │   ├── utils.ts                   # Utilitários (cores, aleatoriedade)
│   │   └── pixel/
│   │       ├── PixelBuffer.ts         # Grade RGBA (modo pixel)
│   │       ├── color.ts               # Parse de cor, luminância, paleta mais próxima
│   │       └── raster.ts              # Rasterização na grade (polígono, elipse, linha, dither)
│   ├── hooks/
│   │   └── useVectorRenderer.ts       # Compila e executa script no canvas
│   ├── services/
│   │   └── assetsApi.ts               # Cliente dos endpoints REST
│   ├── styles/
│   │   ├── types.ts                   # Tipos do catálogo de estilos
│   │   ├── registry.ts                # Catálogo (pixel + vetorial) e detecção por prompt
│   │   ├── detect.ts                  # Detecta o estilo no código do asset
│   │   └── index.ts                   # Re-exports
│   ├── vector-engine.d.ts             # Tipos globais para VS Code/Monaco
│   ├── App.tsx                        # Layout principal (3 colunas)
│   ├── index.css                      # Tailwind v4
│   └── main.tsx                       # Entrypoint React
├── styles/                            # Guias técnicos por estilo (markdown)
│   ├── pixel-pokemon-gba.md
│   ├── pixel-generic.md
│   ├── pixel-gameboy.md
│   ├── pixel-nes.md
│   ├── vector-flat.md
│   ├── vector-cartoon.md
│   ├── vector-outline.md
│   └── skeletons/                     # Esqueletos extraídos de reference/
│       ├── README.md
│       ├── ref-front.md
│       ├── ref-front-guia.png
│       ├── ref-profile.md
│       └── ref-profile-guia.png
├── reference/                         # PNGs de referência do usuário (versionados)
│   ├── character-front.png
│   └── character-left.png
├── SKILL.md                           # Instruções para o agente CLI
├── vite.config.ts                     # Config do Vite + middleware de API
├── tsconfig.app.json                  # TS para o front
├── tsconfig.node.json                 # TS para Vite config, server e scripts
├── package.json
├── DOC.md                             # Este documento
└── PLAN.md                            # Plano de implementação do modo pixel art
```

---

## 4. Fluxo de uso

### 4.1 Gerar assets pelo OpenCode CLI

O agente CLI lê `SKILL.md` e:

1. Gera código TypeScript com `export function generateAsset(ctx: VectorContext)`.
2. Cria `asset_gen/` se não existir.
3. Cria uma subpasta para o grupo/prompt: `asset_gen/<snake_case_descricao_01>/`.
4. Salva todos os assets do mesmo prompt nessa pasta, um arquivo `.ts` por asset.
5. (Opcional) Renderiza `preview.png`.

### 4.2 Visualizar/editar na web

```bash
npm run dev
```

1. O explorer lista grupos e arquivos `.ts`.
2. Clique em um script carrega o código no Monaco Editor.
3. O preview renderiza automaticamente.
4. `Ctrl+S` salva o arquivo no disco.

### 4.3 Renderizar previews via CLI

```bash
# Um arquivo específico
npm run render asset_gen/grupo_01/asset_01.ts

# Uma pasta (usa o primeiro .ts como preview do grupo)
npm run render asset_gen/grupo_01
```

---

## 5. Backend (server/api.ts)

O backend é um conjunto de endpoints Express servido dentro do próprio servidor de dev do Vite via `configureServer` em `vite.config.ts`.

| Método | Rota | Body | Descrição |
|--------|------|------|-----------|
| GET | `/api/assets` | — | Lista pastas e arquivos `.ts` de `asset_gen/` |
| GET | `/api/assets/:folder/:file` | — | Lê conteúdo de um script |
| POST | `/api/assets/:folder` | `{ file, content }` | Cria pasta e salva arquivo `.ts` |
| POST | `/api/assets/:folder/render` | `{ file?, size? }` | Renderiza `preview.png` |

Validações:
- Caminhos são validados para ficar dentro de `asset_gen/`.
- Apenas arquivos `.ts` podem ser salvos.
- A pasta `asset_gen` é criada automaticamente.

### Renderização no backend

O endpoint `/render` compila o TypeScript com Sucrase, executa a função `generateAsset` com uma instância de `VectorEngine` e salva o PNG usando `@napi-rs/canvas`.

```ts
const canvas = createCanvas(size, size)
const engine = new VectorEngine(ctx as unknown as CanvasRenderingContext2D)
builder(engine)
const buffer = await canvas.encode('png')
await fs.writeFile(previewPath, buffer)
```

---

## 6. API de desenho (VectorContext)

Implementada em `src/engine/VectorEngine.ts`.

### 6.1 Conceito de coordenadas lógicas

O canvas usa coordenadas **lógicas de 0 a 100**. O tamanho padrão real é **100×100 pixels**, mas pode ser alterado:

```typescript
export function generateAsset(ctx: VectorContext) {
  ctx.setCanvasSize(512)   // renderiza em 512×512 pixels
  ctx.drawCircle(50, 50, 30, '#3b82f6') // centro, raio 30% do canvas
}
```

A engine multiplica todas as coordenadas internamente por `width / 100`, mantendo a proporção.

### 6.2 Métodos disponíveis

#### Formas básicas

```typescript
drawRect(x: number, y: number, w: number, h: number, color: string): void
drawRoundedRect(x: number, y: number, w: number, h: number, radius: number, color: string): void
drawCircle(cx: number, cy: number, r: number, color: string): void
drawEllipse(cx: number, cy: number, rx: number, ry: number, color: string): void
drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: string): void

// Curva de Bézier cúbica
drawBezier(
  x1: number, y1: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x2: number, y2: number,
  thickness: number, color: string
): void

// Curva de Bézier quadrática
drawQuadratic(
  x1: number, y1: number,
  cpx: number, cpy: number,
  x2: number, y2: number,
  thickness: number, color: string
): void

drawPolygon(points: [number, number][], color: string): void
drawStar(cx: number, cy: number, outerR: number, innerR: number, points: number, color: string): void
drawArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, color: string): void
```

#### Grupos e transformações

```typescript
startGroup(id: string): void
endGroup(): void
withGroup<T>(id: string, fn: () => T): T
translate(x: number, y: number): void
rotate(angleDegrees: number): void
scale(x: number, y?: number): void
```

#### Estilo e efeitos

```typescript
setFill(color: string): void
setStroke(color: string, thickness: number): void
setShadow(color: string, blur: number, offsetX?: number, offsetY?: number): void
clearShadow(): void
```

#### Canvas e utilitários

```typescript
setCanvasSize(width: number, height?: number): void
clear(color?: string): void
setBackground(color: string): void
random(min?: number, max?: number): number
randomInt(min?: number, max?: number): number
randomColor(): string
pick<T>(items: T[]): T
```

#### Estilo (catálogo)

```typescript
setStyle(styleId: string): void   // 1ª chamada do script; lança erro se o id não existir
getStyle(): StyleInfo | null
isPixelMode(): boolean
```

#### Primitivas de grade (modo pixel)

```typescript
drawPixel(x: number, y: number, color: string): void
drawPixelRect(x: number, y: number, w: number, h: number, color: string): void
drawPixelLine(x1: number, y1: number, x2: number, y2: number, color: string): void
drawPixelCircle(cx: number, cy: number, r: number, color: string): void
drawPixelEllipse(cx: number, cy: number, rx: number, ry: number, color: string): void
drawPixelPolygon(points: [number, number][], color: string): void
drawPixelMap(
  rows: string[],
  palette: Record<string, string>,
  options?: {
    x?: number; y?: number;
    align?: 'left' | 'center' | 'right';
    trim?: boolean;
    mirror?: 'x';
    flipX?: boolean;
    transparent?: string[];
  }
): void
```

> `drawPixelMap` **lança erro** quando as linhas do mapa têm larguras diferentes (sprite torto).
> Use `trim: true` para cortar a moldura vazia e `mirror: 'x'` para desenhar só metade e espelhar.

#### Utilitários de grade (modo pixel)

```typescript
outlinePixels(color: string, options?: { diagonal?: boolean }): void
separatePixels(ink: string, options?: { includeDiagonal?: boolean }): void
shadePixels(from: string, to: string): void
ditherPixels(x, y, w, h, colorA, colorB, pattern?: 'bayer4' | 'checker' | 'dots'): void
mirrorPixels(axis: 'x' | 'y'): void
```

> `separatePixels` desenha uma linha escura **entre regiões de cores diferentes** (contorno interno).
> A linha é "carvada" da região maior, para que detalhes pequenos (olhos, emblemas) preservem a forma;
> regiões que perderiam mais de 30% dos pixels não são corroídas.

#### Paleta

```typescript
setPalette(colors: string[]): void
```

Trava a paleta do asset (sobrescreve a do preset). No `finalize()`, os presets com `quantize: true`
( todos os de pixel art) mapeiam cada célula para a cor mais próxima da paleta ativa.

### 6.3 Tipos globais

`src/vector-engine.d.ts` declara `VectorContext` e `Color` globalmente. Isso faz com que VS Code e Monaco Editor reconheçam o tipo sem importação.

---

## 7. Frontend

### 7.1 App.tsx

Layout de 3 colunas, **redimensionáveis**:

1. **Explorer** (`AssetExplorer`) — largura padrão 256 px (180–520).
2. **Editor** (`EditorPanel`) — Monaco Editor, largura padrão 42% da janela (280–1400).
3. **Preview** (`PreviewPanel`) — Canvas, ocupa o espaço restante (`flex-1 min-w-0`).

Entre as colunas há o componente `Resizer` (`src/components/Resizer.tsx`): uma alça de 4 px que
arrasta com o mouse (eventos no `window`, então o cursor pode sair da área) e aceita as setas do
teclado (`←`/`→`, com `Shift` para passos maiores). As larguras são persistidas em `localStorage`
(`asset-builder:explorer-width`, `asset-builder:editor-width`). Abaixo de `lg` o layout empilha e as
alças ficam ocultas.

Estados principais:
- `selectedPath`: caminho relativo do arquivo selecionado (`grupo/arquivo.ts`).
- `code`: conteúdo atual do editor.
- `originalCode`: conteúdo salvo no disco (para detectar modificações).
- `zoom`: fator de zoom do preview (inicia em **1x** e volta a 1x a cada script escolhido).
- `explorerWidth` / `editorWidth`: larguras dos painéis.

O **estilo é derivado do código** (`detectStyle(code)`) e define a faixa de zoom:
pixel art → 1×–16× (inteira), vetorial → 0,25×–5×. O zoom efetivo é o estado limitado à faixa
(`effectiveZoom`), então o slider nunca fica com valor inválido — não existe effect escrevendo
estado, apenas o valor derivado.

### 7.2 AssetExplorer

- Consome `GET /api/assets`.
- Renderiza pastas expansíveis.
- Cada `.ts` é clicável e dispara `onSelect(folder, file)`.
- Botão de atualizar (↻) para recarregar a árvore.
- Pastas com prefixo `_` (ex.: `_archive`) não são listadas.

### 7.3 EditorPanel

- Usa Monaco Editor com definição global de `VectorContext` injetada via `addExtraLib`.
- Exibe o caminho do arquivo selecionado.
- Mostra "modificado" quando `code !== originalCode`.
- Botão "Salvar" e atalho `Ctrl+S`.

### 7.4 PreviewPanel

- Usa o hook `useVectorRenderer` para compilar e executar o código.
- Canvas tem a resolução real definida pelo script.
- **Zoom via slider sempre visível**: a faixa vem do `App` (`zoomRange`), 1×–16× em pixel art e
  0,25×–5× em vetorial. Em pixel art há atalhos (1× 2× 4× 8× 16×) na barra do estilo.
- O `imageRendering` é `pixelated` em estilos pixel (em qualquer zoom) e a partir de 2× em vetorial.
- Badge do estilo, paleta (clique copia o hex) e overlay de grade (1 linha por célula) em pixel art.
- Exportação PNG com o tamanho real do canvas.

### 7.5 useVectorRenderer

Responsabilidades:

1. Cria canvas com tamanho padrão 100×100.
2. Compila o TypeScript com Sucrase.
3. Substitui `export function generateAsset` por `return function`.
4. Executa via `new Function(...)`.
5. Instancia `VectorEngine` e roda o script com `runAsset()` (executa + `finalize()`).
6. Lê o tamanho final do canvas e expõe para o PreviewPanel.
7. Captura erros de compilação/execução e exibe no preview.
8. Detecta o estilo do script (`detectStyle`) — usado pelo `App` para definir a faixa de zoom.

---

## 8. Motor gráfico (VectorEngine)

### 8.1 Escala interna

```ts
private scaleFactor: number = 1

private s(value: number): number {
  return value * this.scaleFactor
}
```

`setCanvasSize(width, height?)` define:

```ts
this.scaleFactor = width / 100
this.ctx.canvas.width = width
this.ctx.canvas.height = height ?? width
```

Todos os métodos de desenho aplicam `s()` nas coordenadas, raio, espessura, blur e offsets.

### 8.2 Adicionar um novo método

Para adicionar um novo método à API de desenho:

1. **Interface**: adicione em `src/engine/types.ts`.
2. **Implementação**: adicione em `src/engine/VectorEngine.ts`.
   - Use `this.s(value)` para escalonar valores de posição/tamanho/espessura.
   - Se o método só faz sentido no modo pixel, valide com `this.requirePixelBuffer('<metodo>')`.
3. **Tipos globais**: adicione em `src/vector-engine.d.ts`.
4. **Autocomplete Monaco**: adicione em `src/components/EditorPanel.tsx` (constante `EXTRA_LIB`).
5. **Documentação do agente CLI**: adicione em `SKILL.md`.
6. **Documentação do projeto**: atualize este `DOC.md`.

### 8.3 Modo pixel art

Quando `ctx.setStyle('<id>')` aponta para um estilo da família `pixel`, o motor:

1. Cria um `PixelBuffer` com `cols × rows` células (ex.: 56×56).
2. Redimensiona o canvas para `cols × pixelScale` (ex.: 448×448).
3. Redireciona **todas** as primitivas vetoriais para a grade (sem antialias).
4. Mantém transformações (`translate`/`rotate`/`scale`) em uma matriz própria aplicada às células.
5. No `finalize()`, faz o upscale nearest-neighbor (escala inteira) do buffer no canvas.

A execução de todo asset passa por `runAsset(engine, builder)` (`src/engine/runner.ts`),
que chama `builder(engine)` e depois `engine.finalize()`. **Esquecer o `finalize()` deixa o
preview vazio**, porque no modo pixel o desenho vive no buffer e não no canvas.

Rasterização das primitivas vetoriais na grade:

| Primitiva vetorial | Conversão |
|---|---|
| `drawRect`, `drawPolygon` | Polígono → teste do centro da célula (even-odd) |
| `drawRoundedRect` | Polígono com cantos arredondados amostrados |
| `drawCircle`, `drawEllipse` | Teste analítico de distância |
| `drawStar` | Polígono de pontas (mesma construção da versão vetorial) |
| `drawArc` | Setor (ângulo + raio) |
| `drawLine` | Bresenham na grade |
| `drawBezier`, `drawQuadratic` | Amostragem em polilinha → Bresenham |

No modo pixel, `setCanvasSize(w, h)` deixa de definir a grade e passa a definir a **resolução de
saída**: `pixelScale = floor(min(w / cols, h / rows))`, sempre inteiro para não gerar pixels tortos.

---

## 9. CLI de renderização (scripts/render.ts)

Renderiza um arquivo `.ts` ou o primeiro `.ts` de uma pasta.

```bash
npm run render <caminho>
```

Comportamento:

- Se o caminho for um arquivo `.ts`: gera `<nome>.png` na mesma pasta.
- Se o caminho for uma pasta: gera `preview.png` usando o primeiro `.ts` encontrado.

---

## 10. Configurações TypeScript

### tsconfig.app.json

- Aplica-se a `src/**/*`.
- Libs: `ES2023`, `DOM`.
- `moduleResolution: bundler`.

### tsconfig.node.json

- Aplica-se a `vite.config.ts`, `server/**/*.ts`, `scripts/**/*.ts`.
- Libs: `ES2023`, `DOM` (necessário porque server/scripts importam `VectorEngine`).
- `module: nodenext` — exige extensões `.js` em imports relativos.

---

## 11. Comandos úteis

```bash
npm install         # instala dependências
npm run dev         # servidor de desenvolvimento
npm run build       # build de produção
npm run lint        # lint do código
npm run preview     # preview do build
npm run render <caminho>  # renderiza PNG no Node
npm run render <caminho> --size 512  # renderiza com resolução inicial de 512 (vetorial)
npm run styles:check      # valida o catálogo de estilos, o SKILL.md e os esqueletos
npm run skeleton <png>    # extrai um esqueleto .md de uma imagem de reference/
npm run pixelize <png>    # gera um asset .ts editável a partir de uma imagem
npm run doctor <asset>    # relatório de qualidade do asset (texto)
```

> Em npm, flags de script precisam do separador `--`:
> `npm run skeleton -- reference/x.png --pose front --name x`.

---

## 12. Convenções

- Todo script de asset deve exportar `generateAsset(ctx: VectorContext)`.
- Não importar bibliotecas dentro dos scripts gerados.
- Cores em hexadecimal (`#RRGGBB`).
- Coordenadas lógicas de 0 a 100.
- Use `setCanvasSize(n)` para alta resolução.
- Um grupo = uma pasta em `asset_gen/`.
- Um asset = um arquivo `.ts` dentro do grupo.

---

## 13. Pontos de atenção

- O backend só existe no servidor de dev do Vite. Em produção (build estático), os endpoints não estarão disponíveis.
- `@napi-rs/canvas` tem binários nativos; em alguns ambientes pode exigir reinstalação.
- O Monaco Editor recebe os tipos via `addExtraLib`; arquivos `.d.ts` do projeto não são automaticamente lidos por ele.
- Quando `setCanvasSize` é chamado, o canvas é redimensionado antes do desenho. Deve ser a primeira chamada no script para evitar apagar arte já desenhada.
- No modo pixel, `setCanvasSize` é ignorado como troca de grade: ele define apenas a resolução final.
- `asset_gen/` é ignorado pelo ESLint (código gerado, fora do versionamento).

---

## 14. Estilos e pixel art

### 14.1 Catálogo de estilos

O catálogo vive em `src/styles/registry.ts` e é a **fonte única** de configuração (consumido pelo
motor e pelo frontend). Cada estilo tem:

| Campo | Descrição |
|---|---|
| `id` | Identificador usado em `ctx.setStyle('<id>')` |
| `label` | Nome exibido na UI |
| `family` | `pixel` ou `vector` |
| `keywords` | Palavras do prompt que selecionam o estilo (minúsculas, sem acento) |
| `priority` | Menor número = maior precedência na detecção |
| `guide` | Caminho do guia técnico (`styles/<id>.md`) |
| `rules` | Regras curtas exibidas na UI e resumidas no `SKILL.md` |

Estilos cadastrados:

| Id | Família | Grade | Saída | Cores |
|---|---|---|---|---|
| `pixel-pokemon-gba` | pixel | 56×56 | 448×448 | até 21 |
| `pixel-gameboy` | pixel | 48×48 | 384×384 | 4 (quantizado) |
| `pixel-nes` | pixel | 32×32 | 512×512 | 16 (quantizado) |
| `pixel-generic` | pixel | 32×32 | 256×256 | até 16 |
| `vector-cartoon` | vector | — | livre | livre |
| `vector-outline` | vector | — | livre | livre |
| `vector-flat` | vector | — | livre | livre (padrão) |

### 14.2 Seleção de estilo pelo prompt

A regra mora no `SKILL.md` (é o agente do CLI quem lê o prompt) e é espelhada em
`matchStyleFromPrompt()` no código, para a UI e para os testes:

| Prioridade | Tipo de keyword | Exemplo | Estilo |
|---|---|---|---|
| 1 | Marca / jogo | "pokemon", "game boy", "nes" | preset específico |
| 2 | Técnica | "16-bit", "snes" | `pixel-generic` |
| 3 | Genérica de pixel | "pixel art", "pixelado", "sprite" | `pixel-generic` |
| 4 | Vetorial | "flat", "cartoon", "contorno" | `vector-*` |
| 5 | Nenhuma | — | `vector-flat` |

A comparação usa palavra inteira (`(?<![a-z0-9])...(?![a-z0-9])`), então "nes" não casa com
"linhas" e "pokemon" casa com "Pokémon" (o texto é normalizado sem acento).

### 14.3 Contrato do script gerado

```typescript
// Prompt: Faça um personagem no estilo pixel art de pokemon
// Estilo: pixel-pokemon-gba
// Asset: personagem pixel art
// Gerado em: 2026-11-06

export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('pixel-pokemon-gba');
  // ...desenho...
}
```

O estilo é registrado em duas fontes redundantes: o comentário `// Estilo:` (leitura humana) e a
chamada `ctx.setStyle()` (o que o motor executa). O frontend detecta as duas com
`src/styles/detect.ts` e avisa quando elas divergem.

### 14.4 Frontend

- **Badge** com o rótulo do estilo e o tamanho da grade (`56x56`).
- **Paleta** do estilo exibida em swatches (clique copia o hex).
- **Overlay de grade** (botão "Grade") com uma linha por célula.
- **Zoom inteiro** (1×, 2×, 4×, 8×, 16×) em estilos pixel, com `imageRendering: pixelated` sempre.
  Em estilos vetoriais o slider contínuo (0.25×–5×) continua igual.

### 14.5 Validação

```bash
npm run styles:check
```

Verifica: ids únicos, keywords em minúsculas e sem acento, paletas com hex válido, grade e escala
coerentes, existência de cada guia em `styles/`, presença de todos os ids e dos novos comandos no
`SKILL.md` e o resultado esperado da detecção para uma lista de prompts canônicos. Também confere
que os esqueletos em `styles/skeletons/` têm mapa ASCII retangular.

---

## 15. Referências, esqueletos e doctor

### 15.1 A pasta `reference/`

O usuário deposita PNGs de referência (personagens, itens, assets) na raiz do projeto. São
versionados (arquivos pequenos). As imagens **não** entram no bundle do front: o extrator roda
apenas no Node (`scripts/lib/`), usando `@napi-rs/canvas`.

### 15.2 `npm run skeleton` — imagem → esqueleto `.md`

```bash
npm run skeleton -- reference/slime_chibi_sprite.png --pose front --name slime-chibi --style pixel-pokemon-gba --max-colors 16
```

Gera dois arquivos em `styles/skeletons/`:

| Arquivo | Conteúdo |
|---|---|
| `<nome>.md` | Mapa ASCII + tabela de papéis (char → papel → hex) + geometria relativa (regiões em %) + regras |
| `<nome>-guia.png` | A referência ampliada com o grid 0–100 e os bboxes das regiões (para leitura vetorial) |

**Detecção da grade** (`detectCellSize`): duas estratégias combinadas por score
(`monoRatio × edgeAlignment`), escolhendo a melhor:
1. **GCD dos runs de cor** — robusto para pixel art gerado por IA (que tem antialias e bordas suaves);
2. **alinhamento das fronteiras** — para sprite nativo ou upscale perfeito.

Funciona para sprite nativo (56×56 → `c = 1`) e para upscale (448×448 de uma grade 56×56 → `c = 8`).
`--cell <n>` sobrescreve.

**Tratamento de imagens de IA** (folhas 1024×1024 com fundo sólido, texto e pose extras):

| Passo | O que faz |
|---|---|
| `removeBackground` | *Flood fill* a partir da borda com tolerância: remove o fundo (e a sombra suave) sem tocar no personagem isolado no centro |
| `keepMainComponents` | Descarta componentes menores que 45% do maior (texto, pose extras, bolhas soltas) |
| `posterize` | Median cut: reduz as cores distintas ao limite (`--max-colors`, padrão 24) — limpa o antialias |
| `--max-cols` | Limita a largura da grade (padrão 48), ajustando a célula |

**Recorte**: por padrão o esqueleto é o *bbox* do sprite (ex.: 32×28), não a grade cheia — menos
token e só a forma interessa. A posição na grade original fica no frontmatter.

### 15.3 `npm run pixelize` — referência → asset editável

```bash
npm run pixelize -- reference/character-front.png --style pixel-pokemon-gba --out asset_gen/grupo/personagem.ts
```

Gera um `.ts` com `setStyle` + `setPalette` + `drawPixelMap` (mapa recortado, cores aproximadas na
paleta do preset). O resultado é editável e renderiza igual à referência dentro da grade.

### 15.4 `npm run doctor` — o crítico barato (texto)

```bash
npm run doctor -- asset_gen/grupo/personagem.ts
npm run doctor -- asset_gen/grupo/preview.png
```

| Check | Como é medido |
|---|---|
| Mapa irregular | Estático no `.ts`: larguras das linhas do `drawPixelMap` |
| Cor fora da paleta | Cores do PNG renderizado vs paleta ativa (preset ou `setPalette`) |
| Contorno externo | Fração da borda da silhueta que usa a cor de contorno do preset |
| Separação interna | Trocas de cor entre vizinhos sem pixel de contorno no meio |
| Silhueta irregular | Fração de linhas em que a borda salta mais de 1 célula (mapa ralo) |
| Simetria | Similaridade entre a metade esquerda e a direita espelhada |
| Nº de cores | Distintas no asset vs `maxColors` do preset |
| Densidade | % de pixels que não são da cor dominante |

Saída em texto (barato em token) e **exit code ≠ 0** quando há falhas.

### 15.5 Fluxo do agente (obrigatório)

1. `npm run skeleton` (se houver referência) → leia o `.md`.
2. Escreva o asset copiando a estrutura.
3. `npm run render -- <pasta>` → **leia o `preview.png`**.
4. `npm run doctor -- <asset.ts>` → corrija.
5. Repita 3–4 (máximo 3 rodadas).

### 15.6 Convenção `_archive`

Pastas dentro de `asset_gen/` com prefixo `_` (ex.: `asset_gen/_archive/`) são áreas de trabalho:
ficam fora do versionamento (o `.gitignore` já ignora `asset_gen/*`) e **não aparecem no explorer**
(o endpoint `/api/assets` ignora pastas com prefixo `_`).
