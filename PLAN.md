# PLAN — Pixel Art e catálogo de estilos no Asset Builder

> **Objetivo:** permitir pedir no prompt do CLI algo como *"Faça um personagem no estilo pixel art de pokemon"*
> e receber um asset **realmente** em pixel art (grade discreta, sem antialias, paleta limitada, contorno),
> com o estilo escolhido registrado no arquivo e visível na UI.
>
> **Escopo do documento:** motor (grade + rasterização), catálogo de estilos, `SKILL.md` (seleção a partir do
> prompt), front (badge/paleta/grade), backend/CLI (render), documentação.
>
> **Documento gerado em:** 06/11/2026

---

## 1. Objetivo e fluxo-alvo

Hoje o prompt é interpretado apenas pelo `SKILL.md`, que gera TypeScript usando uma API **vetorial**
(coordenadas lógicas 0–100, canvas 2D com antialias). Não existe noção de "estilo": o prompt
*"personagem no estilo pixel art de pokemon"* hoje produz o mesmo resultado que *"personagem"* —
arte vetorial suave, que **não** é pixel art.

Fluxo-alvo (implementado por este plano):

```text
Prompt no CLI
  └─ SKILL.md detecta keywords → resolve o estilo do catálogo
       └─ script chama ctx.setStyle('pixel-pokemon-gba') como 1ª linha
            └─ motor entra em modo pixel (grade 56×56, paleta do estilo, sem antialias)
                 └─ script desenha com primitivas de grade / mapa ASCII
                      └─ finalize() → upscale nearest-neighbor na resolução final
                           └─ preview na web (badge do estilo, paleta, overlay de grade)
```

Exemplo do script gerado (contrato alvo):

```typescript
// Prompt: Faça um personagem no estilo pixel art de pokemon
// Estilo: pixel-pokemon-gba
// Asset: personagem pixel art
// Gerado em: 2026-11-06

export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('pixel-pokemon-gba');

  ctx.drawPixelMap(
    [
      '....oooo....',
      '...obbbbo...',
      '..obllllbo..',
      '.obllllllbo.',
      'obllllllllbo',
      'oblwwwwwwlbo',
      'obllkkkkllbo',
      'obllllllllbo',
      '.obbbbbbbbo.',
      '..oooooooo..',
    ],
    { o: '#181018', b: '#58D854', l: '#8BAC0F', w: '#FCFCFC', k: '#101010' },
    { x: 23, y: 23 }
  );
}
```

---

## 2. Estado atual (levantamento)

### 2.1 Como o asset é desenhado hoje

| Camada | Arquivo | Estado |
|---|---|---|
| API de desenho | `src/engine/types.ts` (66 linhas) | 11 primitivas vetoriais + grupos/transformações + estilo/efeitos + canvas + 4 utilitários. **Tudo contínuo, tudo com antialias.** |
| Motor | `src/engine/VectorEngine.ts` (229 linhas) | Escala interna `s(v) = v * scaleFactor`, `scaleFactor = width/100`. Desenha direto no `CanvasRenderingContext2D`. |
| Coordenadas | — | Lógicas 0–100; canvas default **100×100 px**; `setCanvasSize(n)` muda a resolução final mantendo a escala. |
| Tipos globais | `src/vector-engine.d.ts` | `VectorContext` + `Color` declarados globalmente (VS Code / Monaco). |
| Utilitários | `src/engine/utils.ts` | `clamp`, `toRadians`, `random`, `randomInt`, `randomColor`, `pick`. |

**Não existe:** grade, paleta, notion de estilo, metadado de estilo, modo pixel, primitivas "crispy",
dithering, contorno automático, quantização de paleta.

### 2.2 Pontos de render (3 call sites) — precisam de `finalize()`

| # | Arquivo:linha | Trecho |
|---|---|---|
| R1 | `server/api.ts:151-154` | `createCanvas(size,size)` → `new VectorEngine(ctx)` → `builder(engine)` → `canvas.encode('png')` |
| R2 | `scripts/render.ts:26-29` | idem, para `npm run render` |
| R3 | `src/hooks/useVectorRenderer.ts:49-52` | idem, no preview do browser |

> **Sem um passo de "flush", o modo pixel não desenha nada** (o conteúdo vive num buffer de grade,
> não no canvas). Por isso o plano centraliza a execução em um helper único (`runAsset`),
> em vez de espalhar `builder(engine); engine.finalize();` pelos 3 lugares.

### 2.3 Onde a API é replicada (checklist do DOC §8.2)

Toda método novo precisa ser replicado em **4 lugares** + 2 docs:

1. `src/engine/types.ts` — interface
2. `src/engine/VectorEngine.ts` — implementação
3. `src/vector-engine.d.ts` — tipos globais
4. `src/components/EditorPanel.tsx` — constante `EXTRA_LIB` (Monaco)
5. `SKILL.md` — documentação do agente CLI
6. `DOC.md` — documentação do projeto

### 2.4 Frontend atual

- `PreviewPanel.tsx`: canvas com `imageRendering: zoom >= 2 ? 'pixelated' : 'auto'` (já preparado, mas só acima de 2×),
  zoom contínuo `0.25–5`, export PNG, grade de transparência ao fundo.
- `AssetExplorer.tsx`: lista pastas/arquivos `.ts`; sem metadados.
- `src/lib/examples.ts`: `EXAMPLE_PROMPTS` / `DEFAULT_CODE` — **código morto** (nenhuma importação em `src/`).

### 2.5 O que NÃO muda

- Toda a API vetorial atual continua **idêntica** e funcional (assets existentes não são afetados).
- O fluxo CLI → `asset_gen/<grupo>/<asset>.ts` → web → preview continua o mesmo.
- `asset_gen/` segue não versionado (`.gitignore`).
- O backend segue existindo só no dev server do Vite.

---

## 3. Decisões de arquitetura

| # | Tema | Decisão | Justificativa |
|---|---|---|---|
| D1 | Escopo dos estilos | **Catálogo genérico** (`src/styles/registry.ts`) com 2 famílias: `pixel` e `vector`. Pixel art primeiro; vetoriais (`vector-flat`, `vector-cartoon`, `vector-outline`) mapeados para o comportamento atual + regras de técnica. | O pedido nasce no pixel art, mas o prompt já é livre ("estilo flat", "estilo cartoon"). Um catálogo de dados permite crescer sem refatorar o motor. |
| D2 | Renderização do pixel | **Híbrido**: um `PixelBuffer` em grade (RGBA por célula) + as primitivas vetoriais existentes **rasterizadas sem antialias** dentro da grade. | Só com filtro de downscale, o resultado é "vetor reduzido" (borrado, sem definição de pixel). Só com primitivas de grade, o agente fica sem as formas que já conhece. O híbrido dá fidelidade + versatilidade. |
| D3 | Como o estilo é aplicado | **`ctx.setStyle(id)`** como primeira chamada do script. O motor consulta o catálogo e configura grade, paleta, escala e regras. | Um único ponto de entrada, legível no editor, e o cabeçalho do arquivo registra o estilo de forma explícita. |
| D4 | Espaço de coordenadas no modo pixel | **Células inteiras** `0..cols-1` / `0..rows-1` (origem no canto superior esquerdo). O espaço lógico 0–100 continua valendo no modo vetorial. | Pixel art se raciocia em pixels, não em frações. Manter os dois espaços separados evita ambiguidade. |
| D5 | Renderização final do buffer | `finalize()` faz **upscale nearest-neighbor com escala inteira** (`cols×scale × rows×scale`), via `fillRect` por pixel (portável browser + `@napi-rs/canvas`), com `imageSmoothingEnabled = false`. | `fillRect` por célula (≤ 4096 por asset) é simples e não depende de `getImageData`/`putImageData` (portabilidade browser ↔ Node). Escala inteira garante pixels quadrados, sem seams. |
| D6 | Detecção do estilo a partir do prompt | Vive no **`SKILL.md`** (tabela de keywords + precedência). O código tem `matchStyleFromPrompt()` como espelho/validador, não como autoridade. | Quem decide é o agente CLI (ele lê o prompt). O código espelha a regra para a UI e para testes, evitando divergência silenciosa. |
| D7 | Escolha do estilo na UI | **Não há seletor que injeta código.** A UI só **mostra**: badge do estilo, paleta, overlay de grade e zoom inteiro. | O pedido é "no prompt eu escolho o estilo". Injetar `setStyle` pela UI criaria duas fontes de verdade sobre o mesmo arquivo. |
| D8 | Paletas iniciais | 4 presets pixel: **pokemon-gba**, **generic**, **gameboy**, **nes**. | Cobrem o caso de uso pedido + os clássicos de console. O catálogo é dado: novos presets = 1 entrada. |
| D9 | Metadado do estilo | Duas fontes redundantes de propósito: cabeçalho `// Estilo: <id>` (leitura humana/CLI) e `ctx.setStyle('<id>')` (execução). A UI detecta por regex. | O cabeçalho sobrevive a edições manuais; a chamada é a que o motor executa. Divergência entre as duas é sinalizada pela UI. |
| D10 | Onde mora a técnica de cada estilo | `styles/<id>.md` (guia por estilo: regras de contorno, sombreamento, olhos, simetria, paleta) referenciado pelo `SKILL.md`; o registry guarda só **config** (grid, paleta, escala, flags). | Separar "config" de "técnica" mantém o registry serializável e o SKILL.md enxuto, com profundidade sob demanda. |
| D11 | Composição do catálogo | TypeScript (`src/styles/registry.ts`) como fonte única, importado pelo motor **e** pelo front. | Um único lugar muda quando se acrescenta um estilo; a UI mostra a paleta sem duplicar dados. |
| D12 | Rasterização vetorial → grade | Cada primitiva vetorial é convertida em **polígono/polilinha no espaço da grade** e rasterizada por teste do centro da célula (even-odd / distância). `drawCircle`/`drawEllipse`/`drawArc`/`drawStar` usam teste analítico (distância/ângulo). | Resultado **crisp** (semantialmente "pixel art de verdade"), não "arte reduzida". Curvas viram polilinha (Bresenham). |

### Alternativas consideradas e descartadas

| Alternativa | Motivo da descarte |
|---|---|
| **Filtro de pixelização** (desenhar vetorial → downscale nearest → quantizar paleta → dithering) | Barato de implementar, mas o resultado é vetor reduzido: bordas serrilhadas com thickness fracionário, "fantasma" de curvas, paleta sem controle de traço. Serve como *fase opcional*, não como o motor principal. |
| **Só primitivas de grade** (vetorial fora do modo pixel) | Deixaria o agente sem `drawCircle`/`drawPolygon` no modo pixel — presente maior chance de o agente "cair" no vetorial e produzir arte suave. |
| **Estilo só em texto no SKILL.md** (sem registry) | Sem validação: id errado = falha em runtime; sem paleta mostrado na UI; sem regra de precedência testável. |
| **Seletor de estilo na UI** | Duas fontes de verdade sobre o arquivo; escopo extra sem o pedido. Fica no backlog. |
| **`OffscreenCanvas`/`ImageData` no flush** | `ImageData`/`putImageData` têm comportamento diferente entre browser e `@napi-rs/canvas`; `fillRect` por célula é portátil e o volume é pequeno. |
| **Renderer WebGL/pixi.js** | Dependência pesada e fora do escopo (o projeto é 100% canvas 2D + TypeScript puro). |

---

## 4. Catálogo de estilos

### 4.1 Tipos (`src/styles/types.ts`)

```ts
export type StyleFamily = 'pixel' | 'vector';

export interface StyleBase {
  id: string;                 // 'pixel-pokemon-gba'
  label: string;              // 'Pixel Art Pokémon (GBA)'
  family: StyleFamily;
  keywords: string[];         // normalizados, sem acento, minúsculos
  guide: string;              // 'styles/pixel-pokemon-gba.md'
}

export interface PixelStyle extends StyleBase {
  family: 'pixel';
  cols: number;               // largura da grade em células
  rows: number;               // altura da grade em células
  pixelScale: number;         // px finais por célula (inteiro)
  palette: string[];          // cores permitidas (hex)
  maxColors: number;          // limite de cores do asset
  outline: 'none' | 'dark' | 'dark-diagonal';
  outlineColor: string | null;
  shading: 'flat' | 'two-tone' | 'three-tone';
  quantize: boolean;          // força as cores do asset para a paleta
  background: string | null;  // fundo do canvas
}

export interface VectorStyle extends StyleBase {
  family: 'vector';
  rules: string[];            // frases curtas de técnica (vão para o SKILL.md)
}

export type Style = PixelStyle | VectorStyle;
```

### 4.2 Estilos pixel art

| id | Grid | Escala → saída | Cores | Outline | Sombreamento | Keywords (principais) |
|---|---|---|---|---|---|---|
| `pixel-pokemon-gba` | 56×56 | ×8 → **448×448** | 20 (ramp GBA-like) | `dark` 1px | `three-tone` | `pokemon`, `pokémon`, `pikachu`, `charizard`, `bulbasaur`, `monstro`, `criatura`, `gba`, `game boy advance`, `pixel monster` |
| `pixel-generic` | 32×32 | ×8 → **256×256** | 16 (curated) | `dark` 1px | `three-tone` | `pixel art`, `pixelado`, `pixel`, `sprite`, `8 bits`, `8-bit` |
| `pixel-gameboy` | 48×48 | ×8 → **384×384** | 4 (verdes DMG) | `dark` 1px | `two-tone` | `game boy`, `gameboy`, `gb`, `monocromático`, `verde`, `4 tons` |
| `pixel-nes` | 32×32 | ×16 → **512×512** | 16 (paleta NES) | `dark` 1px | `two-tone` | `nes`, `8 bits`, `8-bit`, `atari`, `famicom` |

Paletas (proposta inicial, a ajustar no guia):

```ts
// pixel-pokemon-gba (20)
'#181018','#FCFCFC','#D8D8E0','#101010',   // outline / branco / cinza / preto
'#F8D030','#F0A030','#C87018',              // amarelo (claro/base/escuro)
'#F8C8A0','#E09860',                        // pele
'#8C5030','#603820',                        // marrom
'#E03030','#A01020',                        // vermelho
'#3860F8','#2038A0',                        // azul
'#58D854','#289040',                        // verde
'#9058F8','#5828A8',                        // roxo
'#909090','#585858'                         // cinza

// pixel-gameboy (4)
'#0F380F','#306230','#8BAC0F','#9BBC0F'

// pixel-nes (16)
'#7C7C7C','#0000FC','#0000BC','#4428BC','#A01000','#E45C10','#AC7C00','#00B800',
'#48D048','#005800','#B8F818','#F8D800','#F8A800','#F83800','#F87858','#F0F0F0'
```

### 4.3 Estilos vetoriais (comportamento atual + regras)

| id | Keywords | Regras (resumo) |
|---|---|---|
| `vector-flat` *(padrão)* | `flat`, `vetorial`, `limpo`, `simples`, `ícone` | Formas simples, cores chapadas, sem degradê, sem contorno grosso. |
| `vector-cartoon` | `cartoon`, `desenho`, `carto`, `personagem` | Contorno escuro 2–3 px, cores chapadas, proporções exageradas, sombra simples. |
| `vector-outline` | `outline`, `contorno`, `lineart`, `traço` | Só contorno (sem preenchimento), fundo transparente, espessura 1.5–2. |

> `vector-flat` é o **default** quando o prompt não traz nenhuma keyword de estilo.

### 4.4 Resolução do estilo a partir do prompt (precedência)

A regra vale para `SKILL.md` e para `matchStyleFromPrompt()`:

| Prioridade | Tipo de keyword | Exemplo | Estilo |
|---|---|---|---|
| 1 | Marca/franquise | "pokemon", "game boy", "nes" | `pixel-pokemon-gba`, `pixel-gameboy`, `pixel-nes` |
| 2 | Técnica/console | "8-bit", "16-bit", "snes" | `pixel-nes` / `pixel-generic` (`16-bit` cai no genérico até existir preset SNES) |
| 3 | Genérica de pixel | "pixel art", "pixelado", "sprite" | `pixel-generic` |
| 4 | Vetorial | "flat", "cartoon", "contorno" | `vector-flat` / `vector-cartoon` / `vector-outline` |
| 5 | Nenhuma | — | `vector-flat` |

Regras de desempate:

- Várias keywords de **prioridades diferentes** → vence a de maior prioridade.
- Mesma prioridade → vence a **primeira entrada do registry** na ordem listada (registry é ordenado por especificidade).
- Keyword ambígua ("verde") só vale se o estilo candato for o único que a contém.

### 4.5 Nomenclatura de pasta (recomendação)

Manter `snake_case_descricao_01`, mas incluir o slug do estilo quando o estilo for explicitamente pedido:

```
asset_gen/personagem_pixel_pokemon_01/
    ├── personagem_pixel_art.ts
    └── preview.png
```

---

## 5. API nova

### 5.1 Contrato de estilo

```ts
setStyle(styleId: string): void;      // 1ª chamada do script; lança erro se o id não existir
getStyle(): StyleInfo | null;          // { id, label, family, cols, rows, palette, pixelScale }
isPixelMode(): boolean;
```

`StyleInfo` é uma versão "achatada" e serializável do estilo (o front precisa só de campos simples).

### 5.2 Primitivas de grade (modo pixel)

```ts
drawPixel(x: number, y: number, color: Color): void;
drawPixelRect(x: number, y: number, w: number, h: number, color: Color): void;
drawPixelLine(x1: number, y1: number, x2: number, y2: number, color: Color): void;
drawPixelCircle(cx: number, cy: number, r: number, color: Color): void;
drawPixelEllipse(cx: number, cy: number, rx: number, ry: number, color: Color): void;
drawPixelPolygon(points: [number, number][], color: Color): void;
drawPixelMap(
  rows: string[],
  palette: Record<string, Color>,
  options?: { x?: number; y?: number; flipX?: boolean; transparent?: string[] }
): void;
```

Regras:

- Coordenadas em **células inteiras**; valores fora da grade são ignorados (clipados).
- Fora do modo pixel, esses métodos lançam erro claro: *"Primitivas de pixel exigem um estilo pixel. Chame ctx.setStyle('pixel-...') primeiro."*
- `drawPixelMap`: cada caractere é looked-up em `palette`; caractere ausente **e** não listado em `transparent` → erro listando os caracteres desconhecidos (pega typo do agente na hora).
- `drawPixelMap` com `flipX: true` espelha a arte (útil para simetria).

### 5.3 Utilitários de grade

```ts
outlinePixels(color: Color, options?: { diagonal?: boolean }): void;   // contorno 1px em volta dos pixels opacos
shadePixels(from: Color, to: Color): void;                            // troca uma cor da ramp (sombra/luz)
replacePixelColor(from: Color, to: Color): void;
ditherPixels(x, y, w, h, colorA, colorB, pattern?: 'bayer4' | 'checker' | 'dots'): void;
mirrorPixels(axis: 'x' | 'y'): void;                                  // simetria a partir do eixo do canvas
```

### 5.4 Rasterização das primitivas vetoriais no modo pixel

No modo pixel, as primitivas vetoriais **não** desenham no canvas: são convertidas para a grade.

| Primitiva vetorial | Conversão na grade |
|---|---|
| `drawRect` | Polígono de 4 vértices → fill even-odd |
| `drawRoundedRect` | Polígono com cantos arredondados amostrados (8 segmentos/arco) |
| `drawCircle` / `drawEllipse` | Teste analítico de distância por centro de célula |
| `drawPolygon` | Polígono arbitrário → fill even-odd |
| `drawStar` | Teste radial (ângulo + raio alternado) |
| `drawArc` | Setor (ângulo + raio) |
| `drawLine` | Bresenham na grade (espessura em células) |
| `drawBezier` / `drawQuadratic` | Amostragem em N segmentos → polilinha → Bresenham |

Conversão de coordenadas: `grid = logical / 100 * cols` (ou `rows` no eixo Y).

### 5.5 Ciclo de vida e precedência

```
setStyle('pixel-pokemon-gba')
   ├─ pixelMode = true
   ├─ buffer = new PixelBuffer(56, 56)
   ├─ canvas = 56×8 = 448 × 448
   └─ regras do estilo aplicadas pelo agente (contorno, tons, nº de cores)

setCanvasSize(512)   // chamado DEPOIS do setStyle, no modo pixel:
   └─ pixelScale = floor(512 / 56) = 9  →  canvas = 504 × 504   (escala inteira preservada)

generateAsset(...)    // desenha na grade
finalize()            // flush nearest-neighbor → canvas final
```

Regras fixas:

1. No modo pixel, `setCanvasSize(w, h)` define a **resolução de saída** (o agente pode pedir "512×512"), não a grade.
2. No modo pixel, `setCanvasSize` é ignorado se não for possível obter escala inteira ≥ 1 (mantém a do estilo).
3. `clear()`/`setBackground()` no modo pixel preenchem a **grade** (não o canvas).
4. `startGroup`/`endGroup`/`translate`/`rotate`/`scale` continuam funcionando: no modo pixel, `translate`/`rotate`/`scale` aplicam-se à grade via transformação de coordenadas no momento do desenho (implementado no conversor vetorial→grade).

### 5.6 Execução centralizada (`src/engine/runner.ts`)

```ts
export function runAsset(engine: VectorEngine, builder: (ctx: VectorContext) => void): void {
  builder(engine);
  engine.finalize();   // flush do buffer de grade, se houver
}
```

Os 3 call sites passam a usar `runAsset(engine, builder)` — elimina o risco de esquecer o flush.

---

## 6. SKILL.md — novo conteúdo

O `SKILL.md` é o contrato com o agente CLI. Recebe 3 seções novas:

### 6.1 "Seleção de estilo" (nova, antes das regras de geração)

- Tabela de keywords → `id` de estilo (a mesma do §4.4), com a precedência.
- Default: `vector-flat`.
- Regra dura: *"Sempre chame `ctx.setStyle('<id>')` como **primeira** linha de `generateAsset`."*
- Regra dura: *"Inclua `// Estilo: <id>` no cabeçalho do arquivo."*
- Referência: *"Para as regras técnicas do estilo, leia `styles/<id>.md` antes de desenhar."*

### 6.2 "Estilos pixel art" (nova)

Regras resumidas (o detalhe por estilo fica em `styles/<id>.md`):

1. A grade tem `cols×rows` células; as coordenadas são **inteiras em células** (0..cols-1).
2. **Nenhuma** curva suave, gradiente ou transparência parcial: pixel art é chapada.
3. Contorno escuro de **1 px** em volta da silhueta (`outlinePixels`).
4. **2–3 tons** por material (base, luz, sombra) com luz vindo do topo-esquerda.
5. Máximo de cores = `maxColors` do estilo; paleta restrita ao que está em `styles/<id>.md`.
6. Olhos: **2–3 px** de largura, com 1 px de brilho (só em sprites de personagem).
7. Simetria: desenhe metade e use `mirrorPixels('x')`.
8. Personagens complexos → `drawPixelMap` (mapa ASCII) é mais confiável que primitivas.
9. Dithering só em áreas grandes (céu, chão), nunca no personagem.

### 6.3 Regras de geração (ajustes)

- `ctx.setStyle('<id>')` como 1ª linha (obrigatório).
- Cabeçalho com `// Prompt`, `// Estilo`, `// Asset`, `// Gerado em`.
- Nomes de pasta/arquivo em `snake_case`, sufixo `_01`.
- Escala/resolução: para pixel art, **não** usar `setCanvasSize` (a escala vem do estilo), a não ser que o prompt peça resolução explícita.

### 6.4 Guias por estilo (`styles/<id>.md`)

Um arquivo por estilo, com: paleta (hex), grid, regras de contorno/sombreamento, anatomia de sprites
(ex.: "orelhas longas em 2 tons", "cauda em raio"), anti-padrões e um exemplo de `drawPixelMap`.

```
styles/
├── pixel-pokemon-gba.md
├── pixel-generic.md
├── pixel-gameboy.md
├── pixel-nes.md
├── vector-flat.md
├── vector-cartoon.md
└── vector-outline.md
```

---

## 7. Frontend

### 7.1 Detecção do estilo

`src/hooks/useVectorRenderer.ts` passa a expor, além de `{ canvasRef, error, canvasSize }`:

```ts
{ canvasRef, error, canvasSize, style: StyleInfo | null, grid: { cols: number; rows: number } | null }
```

Detecção (duas fontes, redundância proposital):

```ts
const HEADER_RE = /^\s*\/\/\s*Estilo:\s*(.+)$/m;
const CALL_RE   = /ctx\.setStyle\(\s*['"]([\w-]+)['"]\s*\)/;
```

- Se ambas existirem e divergirem → aviso na UI ("cabeçalho diz X, código diz Y").
- O `id` é resolvido no registry; id desconhecido → badge "estilo desconhecido: X" (sem quebrar o preview).

### 7.2 PreviewPanel

| Recurso | Comportamento |
|---|---|
| **Badge de estilo** | No header: `Pixel Art Pokémon (GBA)` + chip `56×56`. Vetorial: `Vetorial Flat`. |
| **Paleta** | Fita de swatches da paleta do estilo (clique copia o hex). Só para família `pixel`. |
| **Overlay de grade** | Botão "Grade": linhas de 1 px a cada célula, período = `(canvasWidth/cols) * zoom`. |
| **Zoom** | Em estilo pixel: zoom em **inteiros** (1, 2, 4, 8, 16) em vez do slider contínuo 0.25–5. Em vetorial: slider atual (inalterado). |
| **Renderização** | `imageRendering: 'pixelated'` **sempre** quando o estilo é pixel (hoje só liga acima de 2×). |
| **Export PNG** | Mantido. Em pixel art, exporta a resolução real (ex.: 448×448). |

### 7.3 AssetExplorer (opcional, fase posterior)

Mostrar o estilo do grupo no explorer, lendo um `meta.json` opcional por pasta
(`{ "prompt": "...", "style": "pixel-pokemon-gba", "createdAt": "..." }`) escrito pelo agente.
O `listAssetFolders` já filtra apenas `.ts`, então o `meta.json` não quebra a listagem — apenas exige
um endpoint extra (`GET /api/assets/:folder/meta`) para ser lido.

---

## 8. Backend e CLI

- `server/api.ts` e `scripts/render.ts`: trocar `builder(engine)` por `runAsset(engine, builder)`.
- `scripts/render.ts`: opcionalmente aceitar `--size <n>` para forçar a resolução de saída em pixel art
  (hoje o CLI renderiza sempre em 100×100 — insuficiente para pixel art de 448×448).
  **Atenção:** hoje `render.ts` usa `CANVAS_SIZE = 100`; em modo pixel, `setStyle` já dimensiona o canvas,
  então o tamanho inicial só importa para o modo vetorial.
- O `POST /assets/:folder/render` recebe `{ file?, size? }` — `size` deve ser aplicado **antes** de rodar o script
  ou ignorado em modo pixel (o estilo manda).

---

## 9. Arquivos a criar / modificar

### 9.1 Novos

| Arquivo | Responsabilidade |
|---|---|
| `src/styles/types.ts` | `Style`, `PixelStyle`, `VectorStyle`, `StyleInfo`, `StyleFamily`. |
| `src/styles/registry.ts` | Catálogo (7 estilos) + `getStyle`, `listStyles`, `matchStyleFromPrompt`. |
| `src/styles/index.ts` | Re-exports + `STYLE_IDS` (fonte para validação e UI). |
| `src/engine/pixel/PixelBuffer.ts` | Grade RGBA: `get/set/clear/forEach/clone`, blend opcional. |
| `src/engine/pixel/color.ts` | `parseHex`, `toRgba`, `luminance`, `nearestInPalette`, `shade/lighten`. |
| `src/engine/pixel/raster.ts` | `fillPolygon`, `strokePolyline`, `fillEllipse`, `fillSector`, `outline`, `dither patterns`. |
| `src/engine/runner.ts` | `runAsset(engine, builder)` (builder + finalize). |
| `scripts/check-styles.ts` | `npm run styles:check`: valida o registry (ids únicos, hex válido, grid > 0, guia existe, keywords não vazias). |
| `styles/*.md` (7 arquivos) | Guias de técnica por estilo (§6.4). |

### 9.2 Modificados

| Arquivo | Mudança |
|---|---|
| `src/engine/types.ts` | `+ setStyle/getStyle/isPixelMode`, 7 primitivas de grade, 6 utilitários de grade, `+ finalize()` no `VectorContext`? **(não** — `finalize` fica só em `VectorEngine`, não faz parte do `ctx` do script). |
| `src/engine/VectorEngine.ts` | Modo pixel: `buffer`, `style`, `pixelScale`; delegação das primitivas vetoriais para a grade; `setStyle`; `finalize()`; `setCanvasSize` ciente do modo pixel. |
| `src/vector-engine.d.ts` | Tipos globais das assinaturas novas (§5.1–5.3). |
| `src/components/EditorPanel.tsx` | `EXTRA_LIB` com as assinaturas novas (autocomplete no Monaco). |
| `src/hooks/useVectorRenderer.ts` | `runAsset`, detecção de estilo, expõe `style`/`grid`. |
| `src/components/PreviewPanel.tsx` | Badge, paleta, overlay de grade, zoom inteiro, `imageRendering` condicional. |
| `server/api.ts` | `runAsset` no `/render`. |
| `scripts/render.ts` | `runAsset` + flag `--size`. |
| `SKILL.md` | Seções "Seleção de estilo" + "Estilos pixel art" + ajustes nas regras (§6). |
| `DOC.md` | Nova seção: motor de pixel, catálogo de estilos, fluxo, checklist de novo método. |
| `README.md` | Exemplos de prompt com estilo; menção a `styles/` e `npm run styles:check`. |
| `package.json` | Script `styles:check`. |
| `src/lib/examples.ts` | (Código morto) — incluir 3 prompts de exemplo com estilo, para quando for ligado na UI. |

### 9.3 Não alterados

- `src/engine/utils.ts` (utilidades vetoriais), `src/App.tsx`, `src/components/AssetExplorer.tsx`,
  `src/components/ErrorConsole.tsx`, `src/services/assetsApi.ts`, `vite.config.ts`.

---

## 10. Detalhamento técnico

### 10.1 `PixelBuffer`

```ts
export class PixelBuffer {
  readonly cols: number;
  readonly rows: number;
  private data: Uint8ClampedArray;   // RGBA, 4 bytes por célula

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.data = new Uint8ClampedArray(cols * rows * 4);
  }

  index(x: number, y: number): number { return (y * this.cols + x) * 4; }
  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }
  get(x: number, y: number): Color | null {
    if (!this.inside(x, y)) return null;
    const i = this.index(x, y);
    if (this.data[i + 3] === 0) return null;
    return rgbaToHex(this.data[i], this.data[i + 1], this.data[i + 2]);
  }
  set(x: number, y: number, color: Color, blend = false): void { /* ... */ }
  clear(color?: Color): void { /* ... */ }
  forEach(cb: (x: number, y: number, color: Color | null) => void): void { /* ... */ }
}
```

### 10.2 Rasterização (trecho crítico)

```ts
// Preenche um polígono na grade: teste do centro da célula (even-odd).
export function fillPolygon(buf: PixelBuffer, pts: [number, number][], color: Color): void {
  if (pts.length < 3) return;
  const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))));
  const maxY = Math.min(buf.rows - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))));
  for (let y = minY; y <= maxY; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > cy) !== (yj > cy)) {
        xs.push(xi + ((cy - yi) / (yj - yi)) * (xj - xi));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k] - 0.5));
      const x1 = Math.min(buf.cols - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = x0; x <= x1; x++) buf.set(x, y, color);
    }
  }
}
```

Elipse por distância:

```ts
export function fillEllipse(buf, cx, cy, rx, ry, color) {
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(buf.cols - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(buf.rows - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) buf.set(x, y, color);
    }
  }
}
```

### 10.3 Conversão vetorial → grade no `VectorEngine`

```ts
private toGridX(logical: number): number { return (logical / 100) * (this.buffer?.cols ?? 100); }
private toGridY(logical: number): number { return (logical / 100) * (this.buffer?.rows ?? 100); }

drawCircle(cx: number, cy: number, r: number, color: Color) {
  if (this.pixelMode && this.buffer) {
    fillEllipse(this.buffer, this.toGridX(cx), this.toGridY(cy),
      this.toGridX(r), this.toGridY(r), color);
    return;
  }
  /* ... caminho vetorial atual ... */
}
```

### 10.4 Flush (`finalize`)

```ts
finalize(): void {
  const buf = this.buffer;
  if (!this.pixelMode || !buf) return;
  const scale = this.pixelScale;
  const ctx = this.ctx;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < buf.rows; y++) {
    for (let x = 0; x < buf.cols; x++) {
      const color = buf.get(x, y);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}
```

### 10.5 `setStyle` no motor

```ts
setStyle(styleId: string) {
  const style = getStyle(styleId);
  if (!style) {
    throw new Error(`Estilo desconhecido: "${styleId}". Disponíveis: ${STYLE_IDS.join(', ')}`);
  }
  this.style = style;
  if (style.family === 'pixel') {
    this.pixelMode = true;
    this.buffer = new PixelBuffer(style.cols, style.rows);
    this.pixelScale = style.pixelScale;
    this.resizeCanvasForPixel();
  } else {
    this.pixelMode = false;
    this.buffer = null;
  }
}

private resizeCanvasForPixel() {
  const buf = this.buffer!;
  this.ctx.canvas.width = buf.cols * this.pixelScale;
  this.ctx.canvas.height = buf.rows * this.pixelScale;
}
```

E `setCanvasSize` ciente do modo pixel:

```ts
setCanvasSize(width: number, height?: number) {
  if (this.pixelMode && this.buffer) {
    const scale = Math.max(1, Math.floor(width / this.buffer.cols));
    this.pixelScale = scale;
    this.resizeCanvasForPixel();
    return;
  }
  /* ... comportamento atual ... */
}
```

### 10.6 `matchStyleFromPrompt` (espelho da regra do SKILL.md)

```ts
export function matchStyleFromPrompt(prompt: string): Style {
  const text = normalize(prompt);           // minúsculo, sem acento
  const hits = STYLES.filter((s) => s.keywords.some((k) => text.includes(k)));
  // maior prioridade = família/marca > técnica > genérica; empate → ordem do registry
  return hits[0] ?? getStyle('vector-flat')!;
}
```

> A tabela de precedência do §4.4 é implementada aqui **e** transcrita no `SKILL.md`.
> `npm run styles:check` garante que os dois não divirjam (ids e keywords idênticos).

---

## 11. Riscos e limitações

| # | Risco | Mitigação |
|---|---|---|
| R1 | **Pixel art gerado por LLM costuma sair "liso"** (sem contorno, cores demais, olhos enormes). | Regras duras no `SKILL.md` + guias por estilo com anti-padrões + checklist de autovalidação antes de salvar (contorno 1px? ≤ maxColors? olhos 2–3px? sem gradiente?). |
| R2 | **Esquecer o flush** → preview vazio em modo pixel. | `runAsset()` centraliza `builder + finalize` nos 3 call sites; o runner é o único caminho de execução. |
| R3 | **Divergência SKILL.md ↔ registry** (id/keyword_typo). | `npm run styles:check` valida ids, keywords, guia e paleta; a regra de precedência é espelhada em `matchStyleFromPrompt`. |
| R4 | **Ambiguidade `setCanvasSize` no modo pixel.** | Regra fixa (§5.5): no modo pixel, define a resolução de saída; escala inteira preservada. |
| R5 | **Monaco sem autocomplete das assinaturas novas.** | Checklist do DOC §8.2 (§2.3) aplicado: `types.ts`, `VectorEngine.ts`, `vector-engine.d.ts`, `EXTRA_LIB`, `SKILL.md`, `DOC.md`. |
| R6 | **Grade grande → flush lento.** | Grades ≤ 64×64 (≤ 4096 células) → 4096 `fillRect` (sub-ms). Grades maiores ficam fora do catálogo inicial. |
| R7 | **Estilo pedido que não existe** ("pixel art de zelda"). | Fallback explícito: o agente usa o estilo genérico mais próximo e registra `// Estilo: pixel-generic`; o `setStyle` nunca recebe id inválido (o erro lista os ids válidos). |
| R8 | **Asset existente quebra** ao entrar em modo pixel. | Modo vetorial permanece intocado; `setStyle` só é chamado se o script pedir. Sem regressão nos assets em `asset_gen/`. |
| R9 | **Cores fora da paleta** (agente inventa hex). | `quantize: true` em `pixel-gameboy`/`pixel-nes` mapeia para a cor mais próxima da paleta no `finalize`; nos demais, o SKILL.md proíbe e o guia lista os hexes. |
| R10 | **Curvas amostradas podem "vazar" 1 px** fora da grade. | Recorte final no `PixelBuffer` (todas as escritas são clipadas por `inside()`). |

---

## 12. Ordem de execução

| Fase | Entrega | Depende de |
|---|---|---|
| **F0 — Catálogo** | `src/styles/{types,registry,index}.ts` + `scripts/check-styles.ts` + `npm run styles:check` + 7 guias em `styles/` | — |
| **F1 — Motor (núcleo)** | `PixelBuffer`, `color.ts`, `raster.ts`, modo pixel no `VectorEngine` (`setStyle`, primitivas de grade, rasterização vetorial, `finalize`), `runner.ts` | F0 |
| **F2 — Tipos e Monaco** | `types.ts`, `vector-engine.d.ts`, `EXTRA_LIB` | F1 |
| **F3 — Pontos de render** | `useVectorRenderer`, `server/api.ts`, `scripts/render.ts` usando `runAsset` | F1 |
| **F4 — SKILL.md** | Seções "Seleção de estilo" e "Estilos pixel art", regras atualizadas, exemplo golden | F0, F1 |
| **F5 — Front** | Badge de estilo, paleta, overlay de grade, zoom inteiro, `imageRendering` condicional | F2, F3 |
| **F6 — Docs** | `DOC.md` (seção nova + checklist), `README.md`, `src/lib/examples.ts` | F4, F5 |
| **F7 — QA** | Gerar 4 assets de referência (1 por estilo pixel), renderizar via CLI, conferir na UI, ajustar paletas/guias | F6 |

---

## 13. Critérios de aceite

- [ ] `ctx.setStyle('pixel-pokemon-gba')` coloca o motor em modo pixel: grade 56×56, saída 448×448, sem antialias.
- [ ] O prompt *"Faça um personagem no estilo pixel art de pokemon"* gera um script com `// Estilo: pixel-pokemon-gba` e `ctx.setStyle('pixel-pokemon-gba')`.
- [ ] O resultado tem pixels **quadrados e nítidos** (sem bordas suaves nem serrilhado de vetor reduzido).
- [ ] As primitivas vetoriais (`drawCircle`, `drawPolygon`, `drawBezier`…) funcionam dentro do modo pixel e saem crisp.
- [ ] `drawPixelMap` renderiza um mapa ASCII na grade e erra com mensagem clara em caractere desconhecido.
- [ ] `outlinePixels`, `shadePixels`, `ditherPixels`, `mirrorPixels` funcionam e são documentadas no `SKILL.md`.
- [ ] A UI mostra o badge do estilo, a paleta e o overlay de grade; o zoom em pixel art é inteiro e o `imageRendering` é `pixelated` mesmo em 1×.
- [ ] `npm run render asset_gen/<grupo>` gera PNG na resolução real do asset (ex.: 448×448), idêntico ao preview da web.
- [ ] Assets vetoriais existentes (ex.: `pikachu_vermelho_01`) continuam renderizando **sem alteração**.
- [ ] `npm run build` e `npm run lint` sem erros; `npm run styles:check` verde.
- [ ] `SKILL.md` documenta: seleção de estilo por keyword, precedência, API de pixel e regras de técnica.
- [ ] `DOC.md` documenta: motor de pixel, catálogo de estilos, `runAsset`, checklist para novos métodos.

---

## 14. Decisões fechadas (confirmadas com o solicitante)

| # | Tema | Decisão |
|---|---|---|
| 1 | Escopo dos estilos | **Catálogo genérico** (famílias `pixel` + `vector`), com pixel art primeiro. |
| 2 | Renderização | **Híbrido**: grade (`PixelBuffer`) + rasterização das primitivas vetoriais na grade. |
| 3 | Onde o estilo é escolhido | **No prompt do CLI** (via `SKILL.md`); a UI apenas **mostra** (badge/paleta/grade), sem injetar código. |
| 4 | Paletas iniciais | **4 presets pixel**: pokemon-gba, generic, gameboy, nes (+ 3 estilos vetoriais). |

### Pendências (para depois)

- Preset `pixel-snes` (16-bit) — hoje cai em `pixel-generic`; adicionar é 1 entrada no registry + 1 guia.
- `meta.json` por pasta + endpoint `/api/assets/:folder/meta` → estilo no explorer.
- Seletor de estilo na UI (injeção de `setStyle` no arquivo aberto) — outliers deliberados do §D7.
- `pixelify` (filtro de pixelização vetorial → grade) como utilitário opcional para converter assets vetoriais.
- Testes automatizados do rasterizador (vitest) — o projeto não tem framework de teste hoje; `styles:check` cobre o registry.

---

## 15. Registro de implementação

> Implementado conforme o plano (fases F0–F7). O plano vive na raiz do projeto (`PLAN.md`).

### 15.1 O que foi entregue

| Fase | Entrega | Estado |
|---|---|---|
| F0 | `src/styles/{types,registry,index,detect}.ts`, `scripts/check-styles.ts`, `npm run styles:check`, 7 guias em `styles/` | ✅ |
| F1 | `src/engine/pixel/{PixelBuffer,color,raster}.ts`, modo pixel no `VectorEngine`, `src/engine/runner.ts` | ✅ |
| F2 | `src/engine/types.ts`, `src/vector-engine.d.ts`, `EXTRA_LIB` do Monaco | ✅ |
| F3 | `useVectorRenderer`, `server/api.ts`, `scripts/render.ts` usando `runAsset` | ✅ |
| F4 | `SKILL.md` com "Seleção de estilo" + "Estilos pixel art" + 2 exemplos | ✅ |
| F5 | Badge de estilo, paleta, overlay de grade, zoom inteiro, avisos de conflito | ✅ |
| F6 | `DOC.md` (§8.3, §14), `README.md`, `src/lib/examples.ts` | ✅ |
| F7 | 3 assets de referência em `asset_gen/` + verificação de render | ✅ |

Assets de referência criados para QA (em `asset_gen/`, não versionado):

- `personagem_pixel_pokemon_01/personagem_pixel_art.ts` — `drawPixelMap` + polígonos na grade (448×448).
- `espada_pixel_generic_01/espada_pixel_art.ts` — primitivas de grade + `outlinePixels` (256×256).
- `bebe_gameboy_01/bebe_gameboy.ts` — paleta quantizada + `ditherPixels` (384×384).

### 15.2 Desvios do plano

| # | Desvio | Motivo |
|---|---|---|
| I1 | **`replacePixelColor` não foi implementado** (só `shadePixels`, com o mesmo comportamento). | API duplicada sem ganho prático; `shadePixels(from, to)` cobre os dois casos. |
| I2 | **`asset_gen/` adicionado ao `globalIgnores` do ESLint.** | `asset_gen/` é código gerado e não versionado; havia 1 erro de lint pré-existente (`homem_aranha.ts`) quebrando o `npm run lint`. |
| I3 | **`setCanvasSize` chamado *antes* de `setStyle` passa a definir a resolução de saída do modo pixel.** | O plano só previa o caso inverso. Sem isso, o `setStyle` sobrescreveria a resolução pedida pelo script. |
| I4 | **`drawPixelMap` considera `' '` e `'.'` transparentes por padrão.** | O primeiro asset gerado falhou com "caracteres sem cor na paleta: ." — o erro estava correto, mas a convenção de mapa ASCII usa `.`; ficou mais amigável tratar ambos como transparentes (o erro continua valendo para qualquer outro caractere). |
| I5 | **Paleta do `pixel-pokemon-gba` tem 21 cores (`maxColors: 21`, não 24).** | O `styles:check` avisa quando `maxColors` > tamanho da paleta; o limite passou a ser coerente com a paleta real. |
| I6 | **`StyleInfo` duplicado** em `src/styles/types.ts` e no `src/vector-engine.d.ts` (global). | Segue o padrão já existente do projeto (`VectorContext` também é duplicado). |
| I7 | **`meta.json` por grupo + estilo no explorer ficaram pendentes.** | Já estavam na lista de pendências (§14) — dependem de um endpoint novo e não bloqueiam o uso. |

### 15.3 Verificação executada

- `npm run build` — **ok** (tsc + vite, 107 módulos).
- `npm run lint` — **sem erros** (após I2).
- `npm run styles:check` — **ok**: 7 estilos válidos; ids, keywords sem acento, paletas, guias e os 9 prompts canônicos conferidos.
- `npm run render asset_gen/<grupo>` — 3 previews gerados:
  - `personagem_pixel_pokemon_01/preview.png` → **448×448**, pixel art nítida (orelhas, olhos 2×2 com pupila, bochechas, rabo).
  - `espada_pixel_generic_01/preview.png` → **256×256**, lâmina + guarda + contorno de 1 px.
  - `bebe_gameboy_01/preview.png` → **384×384**, 4 tons de verde + chão com dithering ordenado.
- **Sem regressão no vetor**: `asset_gen/pikachu_perfil_direita_01` renderizou exatamente igual ao anterior (arte vetorial suave com antialias).
- **Rasterização vetorial na grade**: script com `drawCircle` + `drawPolygon` em modo pixel produziu **2 cores distintas** no asset inteiro (sem tons intermediários de antialias) — confirma que a grade é crisp.
- **Endpoint do backend**: `POST /api/assets/personagem_pixel_pokemon_01/render` → `preview.png` de **448×448** (o `setStyle` redimensiona o canvas do backend).
- **Detecção no frontend**: `detectStyle()` sobre o asset real retorna `callId` e `headerId` = `pixel-pokemon-gba`, `cols/rows` = 56/56, paleta com 21 cores, `conflict: false`, `unknown: false`.
- **Resolução antes do estilo**: `setCanvasSize(512)` seguido de `setStyle('pixel-generic')` → saída **512×512** (escala inteira 16).

### 15.4 Como usar

```text
# No prompt do OpenCode CLI
"Faça um personagem no estilo pixel art de pokemon"
```

O agente lê o `SKILL.md`, resolve `pixel-pokemon-gba`, chama `ctx.setStyle('pixel-pokemon-gba')`
e grava o asset em `asset_gen/personagem_pixel_pokemon_01/`. Na interface web o preview mostra o
badge do estilo, a paleta e o overlay de grade, com zoom em múltiplos inteiros.

---

## 16. Fase seguinte — referência, esqueletos e doctor (implementada)

> Continuação do plano `PLAN-REFERENCE-SKETCHTONS.md` (pasta `reference/`, esqueletos `.md`,
> `npm run doctor` e as 3 recomendações P0).

### 16.1 O que foi entregue

| Entrega | Onde |
|---|---|
| **P0-1 — motor para de aceitar sprite ruim** | `drawPixelMap` agora **lança erro** em mapa irregular (com a lista das linhas e a largura esperada); `align`/`trim`/`mirror`; `separatePixels` (contorno interno); `setPalette` + `quantize: true` em todos os presets pixel |
| **P0-2 — o agente vê o que fez** | Seção "Fluxo obrigatório de verificação" no `SKILL.md`: render → **ler o preview.png** → doctor → corrigir (máx. 3 rodadas) |
| **P0-3 — doctor barato em texto** | `scripts/doctor.ts` (`npm run doctor`) com 8 checks + exit code |
| **Pasta `reference/`** | Versionada; os 2 PNGs do usuário viraram esqueletos em `styles/skeletons/` |
| **`npm run skeleton`** | `scripts/skeleton.ts` + `scripts/lib/pngToGrid.ts` → `.md` (mapa ASCII + papéis + geometria) + guia PNG com grid 0–100 |
| **`npm run pixelize`** | `scripts/pixelize.ts` → `.ts` editável a partir de uma referência |
| **Teste pedido** | `asset_gen/personagens_one_piece_01/{luffy,zoro,sanji}.ts` — mesmo esqueleto `ref-front` (14×19), cores por personagem |

### 16.2 Desvios

| # | Desvio | Motivo |
|---|---|---|
| D1 | `separatePixels` ganhou um limite de perda (30% da região) e, quando o empate de área acontece, carva da região **mais escura**. | A primeira versão corroía a arte inteira (o Mario de referência virou uma mancha escura): regiões com muitos detalhes pequenos perdiam pixels demais. O limite devolve a arte intacta e só separa o que dá. |
| D2 | O check de "mapa irregular" do doctor é **estático** (lê as linhas literais do `drawPixelMap`). Mapas montados por código (`padEnd`) não são detectados por ele. | O mapa gerado por código já é regular por construção; o problema real (linhas de conteúdo diferentes) aparece na **silhueta**, que ganhou check próprio (salto da borda por linha, em células). |
| D3 | A silhueta irregular é medida em **células** (o render é 8× maior que a grade). | Medir em pixels do render dava números sem sentido (saltos de 8 px). |
| D4 | O `doctor` usa a `outlineColor` do preset como "cor de contorno" (fallback: a cor mais escura do asset). | Adivinhando pela cor mais escura, o doctor acusava falso positivo (o contorno não era a cor mais escura). |
| D5 | Os assets antigos foram movidos para `asset_gen/_archive/` e as pastas com prefixo `_` não aparecem no explorer. | Pedido do solicitante: são só testes. O endpoint `/api/assets` passou a ignorar pastas `_`. |
| D6 | A paleta do `pixel-pokemon-gba` ficou com 21 cores (não 24) e o `maxColors` foi alinhado. | `styles:check` avisa quando `maxColors` > tamanho da paleta. |
| D7 | O esqueleto usa **papéis genéricos** (`o` contorno, `b` base, `l` luz, `d` sombra, `w` brilho) em vez das cores do personagem. | O esqueleto serve a qualquer personagem; o agente troca as cores. |

### 16.3 Verificação executada

- `npm run build` — **ok**; `npm run lint` — **sem erros**; `npm run styles:check` — **ok**
  (7 estilos + comandos no `SKILL.md` + mapas dos esqueletos retangulares).
- `npm run skeleton -- reference/character-front.png` → grade detectada **14×19, célula 1 px**
  (imagem nativa de 56×56) e guia PNG com grid 0–100 + bboxes.
- `npm run skeleton -- reference/character-left.png` → idem, pose `profile`.
- `npm run pixelize -- reference/character-front.png` → `.ts` de 14×19 que renderiza idêntico
  (simetria 1.00 no doctor).
- **O motor estrito pegou sprites ruins de verdade**: ele reprovou o próprio exemplo golden
  (`personagem_pixel_art.ts`, mapa com linhas de 19–22 colunas) e os assets do Luffy/Homem-Aranha
  (mapas ralos) — exatamente o defeito do diagnóstico.
- **Teste Luffy/Zoro/Sanji**: os 3 assets (14×19, mesmo esqueleto, mesma paleta base + 1 acento cada)
  renderizam em 448×448 e passam no `doctor` sem falhas; a inspeção visual mostra o chapéu de palha
  do Luffy, a faixa e o sobretudo verde do Zoro com as espadas na cintura, e o loiro/terno/gravata
  do Sanji.
- `npm run doctor` nos assets de exemplo: `espada_pixel_generic_01` e `bebe_gameboy_01` passam
  limpos; `personagem_pixel_pokemon_01` passou a passar depois de corrigir o mapa e de trocar
  `outlinePixels` por `separatePixels` + contorno manual nas orelhas/rabo.
