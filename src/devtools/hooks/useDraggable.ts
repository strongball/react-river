import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';

interface Position {
  x: number;
  y: number;
}

/**
 * Hook for making a component draggable.
 * Returns the onMouseDown handler to be attached to the drag handle.
 */
export function useDraggable(position: Position, setPosition: (pos: Position) => void) {
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      dragging.current = true;
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };

      const onMouseMove = (ev: globalThis.MouseEvent) => {
        if (!dragging.current) return;
        setPosition({
          x: ev.clientX - dragOffset.current.x,
          y: ev.clientY - dragOffset.current.y,
        });
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [position, setPosition],
  );

  return { onMouseDown };
}
