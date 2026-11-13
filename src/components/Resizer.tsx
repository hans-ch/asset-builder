import { useRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';

interface ResizerProps {
  /** Tamanho atual da area que este handle controla (px). */
  size: number;
  /** Tamanho minimo (px). */
  min: number;
  /** Tamanho maximo (px). */
  max: number;
  /** Chamado com o novo tamanho durante o arraste. */
  onResize: (size: number) => void;
  /** 'vertical' = divide colunas (arrasta na horizontal). */
  orientation?: 'vertical' | 'horizontal';
  title?: string;
}

/**
 * Alca de redimensionamento entre dois paineis.
 *
 * Usa eventos de mouse no window (funciona mesmo se o cursor sair da area)
 * e setas do teclado para ajuste fino.
 */
export function Resizer({
  size,
  min,
  max,
  onResize,
  orientation = 'vertical',
  title = 'Redimensionar painel',
}: ResizerProps) {
  const dragRef = useRef<{ start: number; origin: number } | null>(null);

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    dragRef.current = {
      start: orientation === 'vertical' ? event.clientX : event.clientY,
      origin: size,
    };

    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    function handleMove(moveEvent: globalThis.MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const current = orientation === 'vertical' ? moveEvent.clientX : moveEvent.clientY;
      const next = drag.origin + (current - drag.start);
      onResize(Math.max(min, Math.min(max, next)));
    }

    function handleUp() {
      dragRef.current = null;
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    }

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 48 : 16;
    const decrease = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
    const increase = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';

    if (event.key === decrease) {
      event.preventDefault();
      onResize(Math.max(min, size - step));
    } else if (event.key === increase) {
      event.preventDefault();
      onResize(Math.min(max, size + step));
    }
  }

  const vertical = orientation === 'vertical';

  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label={title}
      aria-valuenow={Math.round(size)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={title}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      className={
        vertical
          ? 'hidden lg:block w-1 shrink-0 cursor-col-resize bg-gray-800 hover:bg-blue-500 active:bg-blue-500 transition-colors'
          : 'hidden lg:block h-1 shrink-0 cursor-row-resize bg-gray-800 hover:bg-blue-500 active:bg-blue-500 transition-colors'
      }
      style={{ touchAction: 'none' } as CSSProperties}
    />
  );
}
