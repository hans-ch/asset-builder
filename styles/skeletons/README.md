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

### Opções úteis

| Flag | Efeito |
|---|---|
| `--max-colors <n>` | Limita as cores do esqueleto (median cut). Padrão: 24. Use 12–16 para pixel art. |
| `--max-cols <n>` | Limita a largura da grade (aumenta a célula). Padrão: 48. |
| `--cell <n>` | Força o tamanho da célula em px (ignora a detecção). |
| `--no-trim` | Não recorta a moldura vazia. |

## Disponíveis

| Arquivo | Grade | Origem |
|---|---|---|
| `slime-chibi.md` | 32×28 | `reference/slime_chibi_sprite.png` |
| `caveira-chibi.md` | 30×47 | `reference/caveira_chibi_sprite.png` |
| `diabrete-chibi.md` | 33×24 | `reference/diabrete_chibi_sprite.png` |
| `espadachim-chibi.md` | 33×33 | `reference/espadachim_chibi_sprite.png` |
| `fantasma-chibi.md` | 25×31 | `reference/fantasma_chibi_sprite.png` |

> As referências são folhas geradas por IA (1024×1024, fundo sólido, texto e pose extras).
> O extrator remove o fundo por *flood fill* a partir da borda, descarta componentes
> pequenos (texto/pose extras), posteriza as cores e detecta a grade da arte.

## Regras de uso

1. Copie a **estrutura** (silhueta e proporções), troque as **cores** conforme o pedido.
2. Mantenha o contorno de 1 px.
3. Use `ctx.setPalette([...])` quando quiser bater com a paleta da referência.
4. Antes de entregar: `npm run render -- <pasta>` + **ler o preview.png** + `npm run doctor -- <asset.ts>`.
