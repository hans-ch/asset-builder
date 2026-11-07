import { getStyle, toStyleInfo } from './registry.js';
import type { StyleInfo } from './types.js';

const CALL_RE = /ctx\.setStyle\(\s*['"]([^'"]+)['"]\s*\)/;
const HEADER_RE = /^\s*\/\/\s*Estilo:\s*(.+)$/m;

export interface DetectedStyle {
  /** Id vindo da chamada `ctx.setStyle('...')`. */
  callId: string | null;
  /** Id vindo do comentário de cabeçalho `// Estilo: ...`. */
  headerId: string | null;
  /** Id resolvido (a chamada tem prioridade sobre o cabeçalho). */
  id: string | null;
  /** Estilo resolvido no catálogo (null quando o id é desconhecido). */
  info: StyleInfo | null;
  /** true quando cabeçalho e chamada apontam para estilos diferentes. */
  conflict: boolean;
  /** true quando o id detectado não existe no catálogo. */
  unknown: boolean;
}

/**
 * Descobre o estilo de um script lendo duas fontes:
 *  - o comentário de cabeçalho `// Estilo: <id>` (leitura humana);
 *  - a chamada `ctx.setStyle('<id>')` (o que o motor executa).
 */
export function detectStyle(code: string): DetectedStyle {
  const callMatch = code.match(CALL_RE);
  const headerMatch = code.match(HEADER_RE);

  const callId = callMatch ? callMatch[1].trim() : null;
  const headerId = headerMatch ? headerMatch[1].trim() : null;
  const id = callId ?? headerId;

  const style = id ? getStyle(id) : undefined;

  return {
    callId,
    headerId,
    id,
    info: style ? toStyleInfo(style) : null,
    conflict: Boolean(callId && headerId && callId !== headerId),
    unknown: Boolean(id && !style),
  };
}
