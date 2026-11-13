# Vetorial Contorno

Desenho apenas com contorno (line art), sem preenchimento e com fundo transparente.

## Configuração

| Item | Valor |
|---|---|
| Id | `vector-outline` |
| Espaço | coordenadas logicas 0-100 |
| Resolucao | livre (`ctx.setCanvasSize(n)`) |

## Regras

1. **Somente contorno**: nao preencha as formas, desenhe apenas as bordas.
2. **Espessura de linha 1.5 a 2 px** (`ctx.setStroke(color, 2)`).
3. **Curvas suaves** sao o essence deste estilo (`drawBezier`, `drawQuadratic`).
4. **Fundo transparente**: nao chame `setBackground` a menos que o prompt peca.
5. Uma cor por-stroke (geralmente um unico tom escuro).

## Anti-padrões

- Preenchimento accidental (`drawCircle` preenche; use `setStroke` + `setFill('transparent')`).
- Multiplas cores sem motivo.
- Espessura fina demais (1 px) para a resolucao final.

## Verificação

Antes de entregar: `npm run render -- <pasta>` → **ler o preview.png** → `npm run doctor -- <asset.ts>`.

## Exemplo

```typescript
export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('vector-outline');
  ctx.setCanvasSize(512);

  ctx.setStroke('#111827', 2);
  ctx.setFill('transparent');

  ctx.drawCircle(30, 50, 14, 'transparent');
  ctx.drawCircle(70, 50, 14, 'transparent');
  ctx.drawBezier(44, 50, 50, 62, 60, 62, 66, 50, 2, '#111827');
}
```
