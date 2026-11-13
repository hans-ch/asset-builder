# Vetorial Flat

Estilo padrao do Asset Builder (comportamento atual do motor).

## Configuração

| Item | Valor |
|---|---|
| Id | `vector-flat` (padrao) |
| Espaço | coordenadas logicas 0-100 |
| Resolucao | livre (`ctx.setCanvasSize(n)`) |

## Regras

1. Formas simples e cores solidas.
2. Sem gradiente e sem sombra dura.
3. Desenho centralizado no canvas logico 0-100.
4. Curvas suaves (`drawBezier`, `drawQuadratic`) sao bem-vindas.
5. Paleta livre, mas poco e consistente no mesmo grupo de assets.

## Anti-padrões

- Excesso de shapes sem hierarquia (use `startGroup`/`withGroup`).
- Detalhe minimo (1 px de espessura) que some na resolucao final.
- Fundo com gradiente escondido por tras do asset.

## Verificação

Antes de entregar: `npm run render -- <pasta>` → **ler o preview.png** → `npm run doctor -- <asset.ts>`.
O doctor aponta cor fora da paleta, contorno ausente e silhueta irregular.

## Exemplo

```typescript
export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('vector-flat');
  ctx.setCanvasSize(512);

  ctx.withGroup('corpo', () => {
    ctx.drawRoundedRect(30, 30, 40, 40, 8, '#4CAF50');
    ctx.drawCircle(50, 50, 12, '#81C784');
  });
}
```
