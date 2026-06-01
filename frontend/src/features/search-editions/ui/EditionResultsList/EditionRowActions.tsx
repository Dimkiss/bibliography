import { useRef } from 'react';

import { Icon } from '@/shared/ui/Icon';
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
import { ViewportMenu } from '@/shared/ui/ViewportMenu';
import { stopInteractiveEvent } from './editionResultsList.lib';
import styles from './EditionResultsList.module.css';

type EditionRowActionsProps = {
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function EditionRowActions({
  isMenuOpen,
  onToggleMenu,
  onEdit,
  onDelete,
}: EditionRowActionsProps) {
  const menuAnchorRef = useRef<HTMLElement | null>(null);

  return (
    <div
      className={styles.rowActions}
      onClick={stopInteractiveEvent}
      onMouseDown={stopInteractiveEvent}
    >
      <OutlineIconButton
        iconName="more_horiz"
        iconSize={20}
        size="small-x"
        aria-label="Дополнительные действия"
        aria-expanded={isMenuOpen}
        onClick={(event) => {
          stopInteractiveEvent(event);
          menuAnchorRef.current = event.currentTarget;
          onToggleMenu();
        }}
      />

      <ViewportMenu
        isOpen={isMenuOpen}
        triggerRef={menuAnchorRef}
        placement="left-start"
        offset={10}
        className={styles.editionMenu}
        role="menu"
      >
          <button
            type="button"
            className={styles.editionMenuItem}
            onClick={onEdit}
            role="menuitem"
          >
            <Icon name="edit" size={24} />
            <span>Редактировать</span>
          </button>

          <button
            type="button"
            className={styles.editionMenuItem}
            onClick={onDelete}
            role="menuitem"
          >
            <Icon name="delete" size={24} />
            <span>Удалить</span>
          </button>
      </ViewportMenu>
    </div>
  );
}
