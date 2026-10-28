import { useEffect, useState } from 'react';
import { fetchAssetTree, type AssetFolder } from '../services/assetsApi';

interface Props {
  selectedPath: string | null;
  onSelect: (folder: string, file: string) => void;
}

export function AssetExplorer({ selectedPath, onSelect }: Props) {
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTree();
  }, []);

  async function loadTree() {
    try {
      setError(null);
      const data = await fetchAssetTree();
      setFolders(data.folders);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-900 border-r border-gray-800">
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 text-xs font-bold uppercase tracking-wider text-gray-400 flex justify-between items-center">
        <span>Explorer</span>
        <button
          onClick={loadTree}
          className="text-gray-500 hover:text-white transition-colors"
          title="Atualizar"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {error && (
          <div className="text-xs text-red-300 mb-2 p-2 bg-red-950/50 rounded">
            {error}
          </div>
        )}

        {folders.length === 0 && !error && (
          <div className="text-xs text-gray-500 p-2">
            Nenhum asset encontrado em <code className="text-gray-400">asset_gen/</code>.
          </div>
        )}

        {folders.map((folder) => (
          <FolderNode
            key={folder.name}
            folder={folder}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

interface FolderNodeProps {
  folder: AssetFolder;
  selectedPath: string | null;
  onSelect: (folder: string, file: string) => void;
}

function FolderNode({ folder, selectedPath, onSelect }: FolderNodeProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 w-full text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded px-2 py-1 transition-colors"
      >
        <span className="text-xs text-gray-500">{expanded ? '▼' : '▶'}</span>
        <span className="font-medium truncate">{folder.name}</span>
      </button>

      {expanded && (
        <div className="pl-5">
          {folder.files.map((file) => {
            const fullPath = `${folder.name}/${file}`;
            const isSelected = selectedPath === fullPath;

            return (
              <button
                key={file}
                onClick={() => onSelect(folder.name, file)}
                className={`flex items-center gap-2 w-full text-left text-xs px-2 py-1 rounded transition-colors ${
                  isSelected
                    ? 'bg-blue-600/30 text-blue-200'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="text-gray-600">{'</>'}</span>
                <span className="truncate">{file}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
