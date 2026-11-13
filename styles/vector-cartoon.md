# Vetorial Cartoon

Estilo de personagem de desenho animado: contorno grosso, cores chapadas e proporcoes exageradas.

## Configuração

| Item | Valor |
|---|---|
| Id | `vector-cartoon` |
| Espaço | coordenadas logicas 0-100 |
| Resolucao | livre (`ctx.setCanvasSize(n)`) |

## Regras

1. **Contorno escuro de 2 a 3 px** em todas as formas (desenhe a forma maior e escura, depois a
   forma menor e colorida por cima).
2. **Cores chapadas**, sem degradê.
3. **Proporcoes exageradas**: cabeca grande, olhos expressivos, membros curtos.
4. **Sombra simples**: uma unica tonalidade mais escura, sem gradiente.
5. Formas arredondadas (`drawRoundedRect`, `drawCircle`) funcionam melhor que poligonos duros.

## Anti-padrões

- Contorno de 1 px: some na resolucao final.
- Many tonalidades por superficie: vira realismo, nao cartoon.
- Detalhe anatomico fino: nao cabe no estilo.

## Verificação

Antes de entregar: `npm run render -- <pasta>` → **ler o preview.png** → `npm run doctor -- <asset.ts>`.

## Exemplo

```typescript
export function generateAsset(ctx: VectorContext) {
  ctx.setStyle('vector-cartoon');
  ctx.setCanvasSize(512);

  const ink = '#1f2937';
  const skin = '#fcd9b6';

  ctx.drawCircle(50, 34, 24, ink);
  ctx.drawCircle(50, 34, 21, skin);
  ctx.drawCircle(43, 32, 3, ink);
  ctx.drawCircle(57, 32, 3, ink);
  ctx.drawArc(50, 40, 8, 20, 160, ink);
}
```
