import { useRef } from 'react';
import { useVectorRenderer } from '../hooks/useVectorRenderer';

interface Props {
  generatedCode: string;
  canvasSize: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function PreviewPanel({ generatedCode, canvasSize, zoom, onZoomChange }: Props) {
  const { canvasRef, error } = useVectorRenderer(generatedCode, canvasSize);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function downloadPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `asset-${canvasSize}x${canvasSize}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 text-xs font-bold uppercase tracking-wider text-gray-400 flex justify-between items-center">
        <span>Preview</span>
        <div className="flex items-center gap-2">
          <label className="text-gray-500 font-normal normal-case">Zoom</label>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={zoom}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className="w-24 accent-blue-500"
          />
          <span className="text-gray-500 font-normal normal-case w-12 text-right">{zoom}x</span>
          <button
            onClick={downloadPNG}
            className="ml-2 px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors"
          >
            PNG
          </button>
        </div>
      </div>

      <div
        ref={wrapperRef}
        className="flex-1 relative bg-gray-900 overflow-auto flex items-center justify-center"
      >
        {/* Grade de fundo para destacar transparência */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        />

        <canvas
          ref={canvasRef}
          className="relative z-10 bg-transparent shadow-2xl"
          style={{
            width: canvasSize * zoom,
            height: canvasSize * zoom,
            imageRendering: zoom >= 4 ? 'pixelated' : 'auto',
          }}
        />
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-900/40 border-t border-red-700 text-red-200 text-xs">
          <strong className="text-red-300">Erro:</strong> {error}
        </div>
      )}
    </div>
  );
}
