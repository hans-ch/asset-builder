interface Props {
  error: string | null;
  onClear?: () => void;
}

export function ErrorConsole({ error, onClear }: Props) {
  if (!error) return null;

  return (
    <div className="px-4 py-3 bg-red-950 border-t border-red-800 text-red-200 text-sm flex items-start gap-3">
      <span className="text-red-400 font-bold shrink-0">Erro</span>
      <span className="flex-1 whitespace-pre-wrap font-mono text-xs">{error}</span>
      {onClear && (
        <button
          onClick={onClear}
          className="shrink-0 text-xs text-red-300 hover:text-white underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
