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

## Scripts

- `npm run dev` — servidor de desenvolvimento com explorer de assets
- `npm run build` — build de produção
- `npm run lint` — lint do código
- `npm run preview` — preview do build
- `npm run render <caminho>` — renderiza preview PNG no Node

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

Veja `src/engine/types.ts` e `SKILL.md` para a lista completa de métodos e regras de salvamento.
