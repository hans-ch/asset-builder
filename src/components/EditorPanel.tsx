import { useCallback } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';

interface Props {
  code: string;
  selectedPath: string | null;
  hasChanges: boolean;
  isSaving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

const EXTRA_LIB = `
type Color = string;

interface VectorContext {
  // Formas básicas
  drawRect(x: number, y: number, w: number, h: number, color: Color): void;
  drawRoundedRect(x: number, y: number, w: number, h: number, radius: number, color: Color): void;
  drawCircle(cx: number, cy: number, r: number, color: Color): void;
  drawEllipse(cx: number, cy: number, rx: number, ry: number, color: Color): void;
  drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color): void;
  drawBezier(
    x1: number,
    y1: number,
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x2: number,
    y2: number,
    thickness: number,
    color: Color
  ): void;
  drawQuadratic(
    x1: number,
    y1: number,
    cpx: number,
    cpy: number,
    x2: number,
    y2: number,
    thickness: number,
    color: Color
  ): void;
  drawPolygon(points: [number, number][], color: Color): void;
  drawStar(cx: number, cy: number, outerR: number, innerR: number, points: number, color: Color): void;
  drawArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, color: Color): void;

  // Grupos e transformações
  startGroup(id: string): void;
  endGroup(): void;
  withGroup<T>(id: string, fn: () => T): T;
  translate(x: number, y: number): void;
  rotate(angleDegrees: number): void;
  scale(x: number, y?: number): void;

  // Estilo e efeitos
  setFill(color: Color): void;
  setStroke(color: Color, thickness: number): void;
  setShadow(color: Color, blur: number, offsetX?: number, offsetY?: number): void;
  clearShadow(): void;

  // Canvas
  setCanvasSize(width: number, height?: number): void;
  clear(color?: Color): void;
  setBackground(color: Color): void;

  // Utilitários procedural
  random(min?: number, max?: number): number;
  randomInt(min?: number, max?: number): number;
  randomColor(): Color;
  pick<T>(items: T[]): T;
}
`;

export function EditorPanel({ code, selectedPath, hasChanges, isSaving, onChange, onSave }: Props) {
  const handleWillMount = useCallback((monaco: Monaco) => {
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      EXTRA_LIB,
      'file:///node_modules/@types/vector-engine/index.d.ts'
    );
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
      allowJs: true,
      checkJs: false,
      noImplicitAny: false,
    });
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 text-xs font-bold uppercase tracking-wider text-gray-400 flex justify-between items-center gap-3">
        <span className="truncate">{selectedPath ?? 'TypeScript Source'}</span>
        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && (
            <span className="text-amber-400 normal-case font-normal">modificado</span>
          )}
          <button
            onClick={onSave}
            disabled={isSaving || !selectedPath}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-xs font-bold transition-colors"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="typescript"
          theme="vs-dark"
          value={code}
          onChange={(value) => onChange(value || '')}
          beforeMount={handleWillMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            tabSize: 2,
            insertSpaces: true,
            readOnly: !selectedPath,
          }}
        />
      </div>
    </div>
  );
}
