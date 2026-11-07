# Esqueletos de referência

Esqueletos extraídos das imagens da pasta `reference/`. Cada arquivo `.md` traz:

- **Pixel**: o mapa ASCII pronto para `ctx.drawPixelMap` + a tabela de papéis (char → cor).
- **Vetor**: a geometria relativa (bbox de cada região em % do canvas) para reproduzir em 0–100.
- `<nome>-guia.png`: a referência ampliada com o grid 0–100 (para ler coordenadas com visão).

## Como usar

```bash
# extrair um esqueleto novo (o comando detecta a grade da imagem)
npm run skeleton -- reference/character-front.png --pose front --name ref-front --style pixel-pokemon-gba

# transformar a referência direto em asset editável
npm run pixelize -- reference/character-front.png --style pixel-pokemon-gba --out asset_gen/meu_grupo/personagem.ts
```

## Disponíveis

| Arquivo | Pose | Grade | Origem |
|---|---|---|---|
| `ref-front.md` | frente | 14×19 | `reference/character-front.png` |
| `ref-profile.md` | perfil | 14×19 | `reference/character-left.png` |

## Regras de uso

1. Copie a **estrutura** (silhueta e proporções), troque as **cores** conforme o pedido.
2. Mantenha o contorno de 1 px.
3. Use `ctx.setPalette([...])` quando quiser bater com a paleta da referência.
4. Antes de entregar: `npm run render -- <pasta>` + **ler o preview.png** + `npm run doctor -- <asset.ts>`.
