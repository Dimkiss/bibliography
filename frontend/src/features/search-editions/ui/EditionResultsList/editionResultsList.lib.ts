import type { MouseEvent as ReactMouseEvent } from 'react';

export function stopInteractiveEvent(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation();
}
