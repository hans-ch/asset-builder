import { useCallback, useEffect, useState } from 'react';
import { AssetExplorer } from './components/AssetExplorer';
import { EditorPanel } from './components/EditorPanel';
import { ErrorConsole } from './components/ErrorConsole';
import { PreviewPanel } from './components/PreviewPanel';
import { fetchAssetContent, saveAsset } from './services/assetsApi';

export default function App() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const [originalCode, setOriginalCode] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(4);

  const hasChanges = selectedPath !== null && code !== originalCode;

  const handleSelect = useCallback(async (folder: string, file: string) => {
    const path = `${folder}/${file}`;
    setSelectedPath(path);
    setError(null);

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

  // Atalho Ctrl+S para salvar
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
        <div className="w-full lg:w-64 shrink-0 h-48 lg:h-full border-b lg:border-b-0 lg:border-r border-gray-800">
          <AssetExplorer selectedPath={selectedPath} onSelect={handleSelect} />
        </div>
        <div className="flex-1 min-h-0 border-b lg:border-b-0 lg:border-r border-gray-800">
          <EditorPanel
            code={code}
            selectedPath={selectedPath}
            hasChanges={hasChanges}
            isSaving={isSaving}
            onChange={setCode}
            onSave={handleSave}
          />
        </div>
        <div className="flex-1 min-h-0">
          <PreviewPanel generatedCode={code} canvasSize={100} zoom={zoom} onZoomChange={setZoom} />
        </div>
      </main>
    </div>
  );
}
