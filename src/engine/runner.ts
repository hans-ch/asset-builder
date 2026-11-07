import type { VectorContext } from './types.js';
import type { VectorEngine } from './VectorEngine.js';

/**
 * Executa um script de asset e finaliza o desenho.
 *
 * No modo pixel art, o conteudo vive em um buffer de grade e so aparece no
 * canvas depois do `finalize()` (upscale nearest-neighbor).
 */
export function runAsset(engine: VectorEngine, builder: (ctx: VectorContext) => void): void {
  builder(engine);
  engine.finalize();
}
