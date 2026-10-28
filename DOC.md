# Asset Builder — Documentação de Contexto

## Visão geral

Asset Builder é uma ferramenta híbrida para geração procedural de assets 2D.

- **Geração**: feita via OpenCode CLI usando `SKILL.md`. O agente CLI cria scripts TypeScript e os salva em `asset_gen/<grupo>/`.
- **Visualização/edição**: interface web (React + Vite) com explorer de arquivos, editor Monaco e preview de canvas.

A interface web **não** possui input de prompt nem integração com API de IA.

---

## Tecnologias

- **Vite 8** + **React 19** + **TypeScript 6**
- **Tailwind CSS v4** com plugin do Vite (`@tailwindcss/vite`)
- **Monaco Editor** (`@monaco-editor/react`) para edição de TypeScript
- **Sucrase** para compilar TypeScript em tempo de execução no browser e no Node
- **@napi-rs/canvas** para renderizar previews no Node
- **Express** como middleware dentro do servidor de dev do Vite

---

## Estrutura de pastas

```
asset-builder/
├── asset_gen/                    # Assets gerados pelo CLI (não versionar)
│   └── <grupo_01>/
│       ├── asset_01.ts
│       ├── asset_02.ts
│       └── preview.png
├── scripts/
│   └── render.ts                 # CLI: renderiza PNG no Node
├── server/
│   └── api.ts                    # Endpoints REST de arquivos
├── src/
│   ├── components/
│   │   ├── AssetExplorer.tsx     # Explorer de pastas/scripts
│   │   ├── EditorPanel.tsx       # Monaco Editor + salvar
│   │   ├── PreviewPanel.tsx      # Canvas + zoom + export PNG
│   │   └── ErrorConsole.tsx      # Exibe erros
│   ├── engine/
│   │   ├── types.ts              # Interface VectorContext
│   │   ├── VectorEngine.ts       # Implementação dos métodos de desenho
│   │   └── utils.ts              # Utilitários (cores, aleatoriedade)
│   ├── hooks/
│   │   └── useVectorRenderer.ts  # Compila e executa script no canvas
│   ├── services/
│   │   └── assetsApi.ts          # Cliente dos endpoints REST
│   ├── vector-engine.d.ts        # Tipos globais para VS Code/Monaco
│   └── App.tsx                   # Layout principal (3 colunas)
├── SKILL.md                      # Instruções para o agente CLI
├── vite.config.ts                # Config do Vite + middleware de API
└── package.json
```

---

## Fluxo de uso

### 1. Gerar assets pelo CLI

```bash
# O agente OpenCode CLI lê SKILL.md e salva scripts em asset_gen/<grupo>/
```

Regras do `SKILL.md`:
- Cada prompt gera uma pasta em `asset_gen/<snake_case_descricao_01>/`.
- Todos os assets do mesmo prompt são salvos nessa pasta.
- Cada arquivo exporta `generateAsset(ctx: VectorContext)`.

### 2. Visualizar/editar na web

```bash
npm run dev
```

- O explorer lista grupos e arquivos `.ts`.
- Clique carrega o script no editor.
- Preview renderiza automaticamente.
- `Ctrl+S` salva o arquivo no disco.

### 3. Renderizar previews em PNG

```bash
# Um arquivo
npm run render asset_gen/grupo_01/asset_01.ts

# Uma pasta (usa o primeiro .ts como preview do grupo)
npm run render asset_gen/grupo_01
```

---

## Backend (server/api.ts)

Endpoints REST servidos pelo próprio `vite.config.ts` via `configureServer`:

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/assets` | Lista pastas e arquivos `.ts` de `asset_gen/` |
| GET | `/api/assets/:folder/:file` | Lê conteúdo de um script |
| POST | `/api/assets/:folder` | Cria pasta e salva arquivo `.ts` |
| POST | `/api/assets/:folder/render` | Renderiza `preview.png` |

A pasta `asset_gen` é criada automaticamente se não existir.

---

## API de desenho (VectorContext)

Implementada em `src/engine/VectorEngine.ts`. Todos os scripts usam `ctx`:

```typescript
export function generateAsset(ctx: VectorContext) {
  ctx.setBackground('#1f2937')
  ctx.drawCircle(50, 50, 30, '#3b82f6')
}
```

### Formas

- `drawRect(x, y, w, h, color)`
- `drawRoundedRect(x, y, w, h, radius, color)`
- `drawCircle(cx, cy, r, color)`
- `drawEllipse(cx, cy, rx, ry, color)`
- `drawLine(x1, y1, x2, y2, thickness, color)`
- `drawBezier(x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2, thickness, color)` — curva cúbica
- `drawQuadratic(x1, y1, cpx, cpy, x2, y2, thickness, color)` — curva quadrática
- `drawPolygon(points, color)`
- `drawStar(cx, cy, outerR, innerR, points, color)`
- `drawArc(cx, cy, r, startAngle, endAngle, color)`

### Grupos e transformações

- `startGroup(id)` / `endGroup()` — salvam/restauram estado do canvas
- `withGroup(id, fn)` — executa função dentro de um grupo
- `translate(x, y)`
- `rotate(angleDegrees)`
- `scale(x, y?)`

### Estilo e canvas

- `setFill(color)` / `setStroke(color, thickness)`
- `setShadow(color, blur, offsetX?, offsetY?)` / `clearShadow()`
- `setCanvasSize(width, height?)` — define resolução real mantendo coordenadas lógicas 0-100
- `clear(color?)` / `setBackground(color)`

### Utilitários procedural

- `random(min?, max?)` / `randomInt(min?, max?)`
- `randomColor()`
- `pick(items)`

### Tipos globais

`src/vector-engine.d.ts` declara `VectorContext` e `Color` globalmente para VS Code e Monaco Editor não exigirem importação.

---

## Partes cruciais do código

### Compilação e execução no browser

`src/hooks/useVectorRenderer.ts`:
- Recebe o código TypeScript do editor.
- Compila com Sucrase (`transform(..., { transforms: ['typescript'] })`).
- Substitui `export function generateAsset` por `return function`.
- Executa via `new Function(...)` e chama a função com uma instância de `VectorEngine`.
- Exibe erros de compilação/execução no painel de preview.

### Compilação e execução no Node

`server/api.ts` (endpoint `/render`) e `scripts/render.ts` usam o mesmo padrão, mas com `@napi-rs/canvas` para criar o contexto 2D no Node. O contexto do `@napi-rs/canvas` é convertido via `as unknown as CanvasRenderingContext2D` porque `VectorEngine` espera o tipo do browser.

### Editor com autocomplete

`src/components/EditorPanel.tsx` injeta a definição global de `VectorContext` no Monaco via `addExtraLib`. A definição usa `interface VectorContext` sem `export` para ficar global dentro do editor.

### Explorer

`src/components/AssetExplorer.tsx` consome `GET /api/assets` e renderiza pastas expansíveis. Cada arquivo `.ts` é clicável e dispara `onSelect(folder, file)`.

### Layout

`src/App.tsx` organiza três colunas:
1. Explorer (largura fixa em desktop)
2. Editor
3. Preview

O estado `selectedPath` e `code` são gerenciados no `App`.

---

## Convenções

- Todos os scripts de asset devem exportar `generateAsset(ctx: VectorContext)`.
- Cores são strings hexadecimais (`#RRGGBB`).
- O canvas usa coordenadas lógicas de 0 a 100. O tamanho padrão é 100×100 pixels.
- Use `ctx.setCanvasSize(n)` para render em alta resolução (ex: 512×512) sem perder a proporção das coordenadas.
- O preview usa zoom via CSS (`width: realWidth * zoom`).
- Export PNG usa o tamanho real do canvas.

---

## Comandos úteis

```bash
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção
npm run lint      # lint
npm run render <caminho>  # renderiza PNG no Node
```

---

## Pontos de atenção para futuras modificações

- Se adicionar novos métodos à `VectorContext`, atualize:
  - `src/engine/types.ts`
  - `src/engine/VectorEngine.ts`
  - `src/vector-engine.d.ts`
  - `src/components/EditorPanel.tsx` (extra-lib do Monaco)
  - `SKILL.md`
- O backend roda dentro do servidor de dev do Vite; em produção os endpoints não existem automaticamente.
- `@napi-rs/canvas` tem binários nativos; em alguns ambientes pode exigir reinstalação.
