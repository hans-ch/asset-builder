import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AssetExplorer } from './components/AssetExplorer';
import { EditorPanel } from './components/EditorPanel';
import { ErrorConsole } from './components/ErrorConsole';
import { PreviewPanel } from './components/PreviewPanel';
import { Resizer } from './components/Resizer';
import { fetchAssetContent, saveAsset } from './services/assetsApi';
import { detectStyle } from './styles/detect.js';

const EXPLORER_MIN = 180;
const EXPLORER_MAX = 520;
const EDITOR_MIN = 280;
const EDITOR_MAX = 1400;

const ZOOM_RANGE_VECTOR = { min: 0.25, max: 5, step: 0.25 };
const ZOOM_RANGE_PIXEL = { min: 1, max: 16, step: 1 };

function readStoredWidth(key: string, fallback: number): number {
  try {
    const stored = Number.parseInt(window.localStorage.getItem(key) ?? '', 10);
    return Number.isFinite(stored) && stored > 0 ? stored : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const [originalCode, setOriginalCode] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const [explorerWidth, setExplorerWidth] = useState(() =>
    readStoredWidth('asset-builder:explorer-width', 256)
  );
  const [editorWidth, setEditorWidth] = useState(() =>
    readStoredWidth('asset-builder:editor-width', Math.round(window.innerWidth * 0.42))
  );

  const hasChanges = selectedPath !== null && code !== originalCode;

  // O estilo e derivado do codigo: e ele que define a faixa de zoom e o preview.
  const detected = useMemo(() => detectStyle(code), [code]);
  const style = detected.info ?? null;
  const isPixel = style?.family === 'pixel';

  const zoomRange = isPixel ? ZOOM_RANGE_PIXEL : ZOOM_RANGE_VECTOR;
  const effectiveZoom = Math.min(zoomRange.max, Math.max(zoomRange.min, zoom));

  const handleSelect = useCallback(async (folder: string, file: string) => {
    const path = `${folder}/${file}`;
    setSelectedPath(path);
    setError(null);
    // Todo asset comeca em 1x (a resolucao real do canvas).
    setZoom(1);

    try {
      const content = await fetchAssetContent(folder, file);
      setCode(content);
      setOriginalCode(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setCode('');
      setOriginalCode('');
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedPath) return;

    const [folder, file] = selectedPath.split('/');
    if (!folder || !file) return;

    setIsSaving(true);
    setError(null);

    try {
      await saveAsset(folder, file, code);
      setOriginalCode(code);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }, [selectedPath, code]);

  // Atalhos Ctrl+S para salvar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Persiste as larguras dos paineis
  useEffect(() => {
    try {
      window.localStorage.setItem('asset-builder:explorer-width', String(explorerWidth));
      window.localStorage.setItem('asset-builder:editor-width', String(editorWidth));
    } catch {
      // localStorage indisponivel: ignora.
    }
  }, [explorerWidth, editorWidth]);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-950 text-white font-sans overflow-hidden">
      <header className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm">
            AB
          </div>
          <h1 className="font-bold text-lg tracking-tight">Asset Builder</h1>
        </div>
        <div className="text-xs text-gray-500 hidden sm:block">
          Preview e edição de assets gerados pelo CLI
        </div>
      </header>

      <ErrorConsole error={error} onClear={() => setError(null)} />

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div
          className="w-full lg:w-[var(--explorer-w)] shrink-0 h-48 lg:h-full border-b lg:border-b-0 lg:border-r border-gray-800"
          style={{ '--explorer-w': `${explorerWidth}px` } as CSSProperties}
        >
          <AssetExplorer selectedPath={selectedPath} onSelect={handleSelect} />
        </div>

        <Resizer
          size={explorerWidth}
          min={EXPLORER_MIN}
          max={EXPLORER_MAX}
          onResize={setExplorerWidth}
          title="Redimensionar o explorer"
        />

        <div
          className="w-full lg:w-[var(--editor-w)] shrink-0 min-w-0 h-[60vh] lg:h-full border-b lg:border-b-0 lg:border-r border-gray-800"
          style={{ '--editor-w': `${editorWidth}px` } as CSSProperties}
        >
          <EditorPanel
            code={code}
            selectedPath={selectedPath}
            hasChanges={hasChanges}
            isSaving={isSaving}
            onChange={setCode}
            onSave={handleSave}
          />
        </div>

        <Resizer
          size={editorWidth}
          min={EDITOR_MIN}
          max={EDITOR_MAX}
          onResize={setEditorWidth}
          title="Redimensionar o editor"
        />

        <div className="flex-1 min-w-0 min-h-0">
          <PreviewPanel
            generatedCode={code}
            zoom={effectiveZoom}
            zoomRange={zoomRange}
            style={style}
            detected={detected}
            onZoomChange={setZoom}
          />
        </div>
      </main>
    </div>
  );
}
