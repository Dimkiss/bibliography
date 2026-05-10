import { buildDoiUrl, type PublicationListItemDto } from '@/entities/publication';
import { Icon } from '@/shared/ui/Icon';
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
import { stopInteractiveEvent } from './publicationResultsList.lib';
import styles from './PublicationResultsList.module.css';

type PublicationRowActionsProps = {
  item: PublicationListItemDto;
  isAdmin: boolean;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onOpenPdf: () => void;
  onOpenDoi: () => void;
  onCopyReference: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function PublicationRowActions({
  item,
  isAdmin,
  isMenuOpen,
  onToggleMenu,
  onOpenPdf,
  onOpenDoi,
  onCopyReference,
  onEdit,
  onDelete,
}: PublicationRowActionsProps) {
  const hasDoiUrl = Boolean(buildDoiUrl(item.doi));

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
          onToggleMenu();
        }}
      />

      {isMenuOpen ? (
        <div className={styles.publicationMenu} role="menu">
          <button
            type="button"
            className={styles.publicationMenuItem}
            onClick={onOpenPdf}
            disabled={!item.has_pdf}
            role="menuitem"
          >
            <Icon
              name={item.has_pdf ? 'pdf-color' : 'pdf-mono'}
              size={24}
              colored={item.has_pdf}
            />
            <span>Открыть PDF</span>
          </button>

          <button
            type="button"
            className={styles.publicationMenuItem}
            onClick={onOpenDoi}
            disabled={!hasDoiUrl}
            role="menuitem"
          >
            <Icon name="doi" size={24} />
            <span>Открыть по DOI</span>
          </button>

          <button
            type="button"
            className={styles.publicationMenuItem}
            onClick={onCopyReference}
            role="menuitem"
          >
            <Icon name="copy" size={24} />
            <span>Копировать библ. ссылку</span>
          </button>

          {isAdmin ? (
            <>
              <div className={styles.publicationMenuDivider} />

              <button
                type="button"
                className={styles.publicationMenuItem}
                onClick={onEdit}
                role="menuitem"
              >
                <Icon name="edit" size={24} />
                <span>Редактировать</span>
              </button>

              <button
                type="button"
                className={styles.publicationMenuItem}
                onClick={onDelete}
                role="menuitem"
              >
                <Icon name="delete" size={24} />
                <span>Удалить</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <OutlineIconButton
        iconName="copy"
        iconSize={20}
        size="small-x"
        aria-label="Копировать данные публикации"
        onClick={(event) => {
          stopInteractiveEvent(event);
          onCopyReference();
        }}
      />

      <OutlineIconButton
        iconName={item.has_pdf ? 'pdf-color' : 'pdf-mono'}
        iconSize={20}
        iconColored={item.has_pdf}
        size="small-x"
        disabled={!item.has_pdf}
        aria-label="Скачать PDF"
        onClick={(event) => {
          stopInteractiveEvent(event);
          if (!item.has_pdf) {
            return;
          }
          onOpenPdf();
        }}
      />
    </div>
  );
}
