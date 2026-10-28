/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import { transform } from 'sucrase';
import { VectorEngine } from '../engine/VectorEngine.js';

export interface RenderResult {
  error: string | null;
  canvas: HTMLCanvasElement | null;
}

export function useVectorRenderer(generatedCode: string) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 100, height: 100 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) {
      setError('Não foi possível obter o contexto 2D do canvas.');
      return;
    }

    // Reset para tamanho padrão
    canvas.width = 100;
    canvas.height = 100;
    setError(null);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    if (!generatedCode.trim()) {
      setCanvasSize({ width: 100, height: 100 });
      return;
    }

    try {
      const compiled = transform(generatedCode, { transforms: ['typescript'] }).code;
      // Permite tanto "export function generateAsset" quanto "function generateAsset"
      const executableCode = compiled
        .replace(/export\s+function\s+generateAsset/, 'return function')
        .replace(/function\s+generateAsset/, 'return function');

      const builder = new Function(executableCode)();
      if (typeof builder !== 'function') {
        throw new Error('O código deve conter uma função generateAsset(ctx: VectorContext).');
      }

      const engine = new VectorEngine(ctx2d);
      builder(engine);

      setCanvasSize({ width: canvas.width, height: canvas.height });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Erro na execução do script:', err);
      setCanvasSize({ width: 100, height: 100 });
    }
  }, [generatedCode]);

  return { canvasRef, error, canvasSize };
}
