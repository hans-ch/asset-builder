import { useState } from 'react';
import { useVectorRenderer } from '../hooks/useVectorRenderer';
import type { DetectedStyle } from '../styles/detect.js';
import type { StyleInfo } from '../styles/types.js';

interface ZoomRange {
  min: number;
  max: number;
  step: number;
}

interface Props {
  generatedCode: string;
  /** Zoom efetivo (ja dentro da faixa). */
  zoom: number;
  zoomRange: ZoomRange;
  style: StyleInfo | null;
  detected: DetectedStyle;
  onZoomChange: (zoom: number) => void;
}

const PIXEL_ZOOMS = [1, 2, 4, 8, 16];

export function PreviewPanel({
  generatedCode,
  zoom,
  zoomRange,
  style,
  detected,
  onZoomChange,
}: Props) {
  const { canvasRef, error, canvasSize } = useVectorRenderer(generatedCode);
  const [showGrid, setShowGrid] = useState(false);

  const isPixel = style?.family === 'pixel';

  const displayWidth = Math.max(canvasSize.width * zoom, 1);
  const displayHeight = Math.max(canvasSize.height * zoom, 1);
  const cellSize = isPixel && style.cols > 0 ? canvasSize.width / style.cols : 0;

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

  function copyColor(color: string) {
    navigator.clipboard?.writeText(color).catch(() => undefined);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 text-xs font-bold uppercase tracking-wider text-gray-400 flex justify-between items-center gap-2 flex-wrap">
        <span>Preview</span>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="range"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoom}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className="w-20 accent-blue-500"
            title={`Zoom (${zoomRange.min}x a ${zoomRange.max}x)`}
          />
          <span className="text-gray-500 font-normal normal-case w-10 text-right">
            {zoom}x
          </span>
          <button
            onClick={downloadPNG}
            className="ml-1 px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors"
          >
            PNG
          </button>
        </div>
      </div>

      {isPixel && style && (
        <div className="px-3 py-1.5 bg-gray-800/60 border-b border-gray-700 flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-blue-300 bg-blue-900/40 border border-blue-800 rounded px-2 py-0.5">
            {style.label}
          </span>
          <span className="text-[11px] text-gray-400">
            {style.cols}x{style.rows} · {style.maxColors} cores
          </span>
          <div className="flex items-center gap-1">
            {style.palette.map((color) => (
              <button
                key={color}
                title={color}
                onClick={() => copyColor(color)}
                className="w-3 h-3 rounded-sm border border-gray-600 hover:scale-125 transition-transform"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 ml-1">
            {PIXEL_ZOOMS.map((value) => (
              <button
                key={value}
                onClick={() => onZoomChange(value)}
                title={`Zoom ${value}x`}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  zoom === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {value}x
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowGrid((value) => !value)}
            className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
              showGrid
                ? 'bg-gray-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Grade
          </button>
        </div>
      )}

      {detected.unknown && (
        <div className="px-3 py-1.5 bg-amber-900/30 border-b border-amber-800 text-amber-200 text-[11px]">
          Estilo desconhecido: <code className="text-amber-100">{detected.id}</code>
        </div>
      )}

      {detected.conflict && (
        <div className="px-3 py-1.5 bg-red-900/30 border-b border-red-800 text-red-200 text-[11px]">
          Conflito de estilo: cabeçalho informa <code>{detected.headerId}</code>, mas o código usa{' '}
          <code>{detected.callId}</code>.
        </div>
      )}

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

        <div className="relative z-10" style={{ width: displayWidth, height: displayHeight }}>
          {isPixel && showGrid && cellSize > 0 && (
            <div
              className="absolute inset-0 pointer-events-none z-20"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.28) 1px, transparent 1px)',
                backgroundSize: `${cellSize * zoom}px ${cellSize * zoom}px`,
              }}
            />
          )}
          <canvas
            ref={canvasRef}
            className="relative bg-transparent shadow-2xl"
            style={{
              width: displayWidth,
              height: displayHeight,
              imageRendering: isPixel || zoom >= 2 ? 'pixelated' : 'auto',
            }}
          />
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-900/40 border-t border-red-700 text-red-200 text-xs">
          <strong className="text-red-300">Erro:</strong> {error}
        </div>
      )}
    </div>
  );
}
