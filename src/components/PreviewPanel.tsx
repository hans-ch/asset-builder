import { useVectorRenderer } from '../hooks/useVectorRenderer';

interface Props {
  generatedCode: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function PreviewPanel({ generatedCode, zoom, onZoomChange }: Props) {
  const { canvasRef, error, canvasSize } = useVectorRenderer(generatedCode);

  function downloadPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `asset-${canvas.width}x${canvas.height}.png`;
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
            min={0.25}
            max={5}
            step={0.25}
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

      <div className="flex-1 relative bg-gray-900 overflow-auto flex items-center justify-center">
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
            width: Math.max(canvasSize.width * zoom, 1),
            height: Math.max(canvasSize.height * zoom, 1),
            imageRendering: zoom >= 2 ? 'pixelated' : 'auto',
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
