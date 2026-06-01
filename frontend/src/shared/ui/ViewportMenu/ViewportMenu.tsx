import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

type ViewportMenuPlacement = 'bottom-end' | 'left-start';

type ViewportMenuProps = {
  isOpen: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  placement?: ViewportMenuPlacement;
  offset?: number;
  viewportPadding?: number;
  className: string;
  role?: string;
  children: ReactNode;
};

type MenuPosition = {
  top: number;
  left: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function ViewportMenu({
  isOpen,
  triggerRef,
  placement = 'bottom-end',
  offset = 8,
  viewportPadding = 12,
  className,
  role,
  children,
}: ViewportMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;

    if (!trigger || !menu) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const maxLeft = window.innerWidth - menuRect.width - viewportPadding;
    const maxTop = window.innerHeight - menuRect.height - viewportPadding;
    let left = viewportPadding;
    let top = viewportPadding;

    if (placement === 'left-start') {
      left = triggerRect.left - menuRect.width - offset;
      if (left < viewportPadding) {
        left = triggerRect.right + offset;
      }
      top = triggerRect.top;
    } else {
      left = triggerRect.right - menuRect.width;
      top = triggerRect.bottom + offset;

      if (top > maxTop && triggerRect.top - menuRect.height - offset >= viewportPadding) {
        top = triggerRect.top - menuRect.height - offset;
      }
    }

    setPosition({
      left: clamp(left, viewportPadding, Math.max(viewportPadding, maxLeft)),
      top: clamp(top, viewportPadding, Math.max(viewportPadding, maxTop)),
    });
  }, [offset, placement, triggerRef, viewportPadding]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className={className}
      role={role}
      style={{
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
