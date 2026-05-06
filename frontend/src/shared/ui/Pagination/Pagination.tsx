import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/shared/ui/Icon';
import styles from './Pagination.module.css';

type PageItem = number | 'ellipsis';

type PaginationButtonProps = {
  iconName?: string;
  text?: string;
  variant?: 'nav' | 'page' | 'top';
  isActive?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
};

type PageSizeSelectProps = {
  id: string;
  value: number;
  options: number[];
  onChange: (nextPageSize: number) => void;
};

export type PaginationProps = {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  itemLabel?: string;
  pageSizeOptions?: number[];
  pageSizeSelectId?: string;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
};

function buildPages(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    'ellipsis',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis',
    totalPages,
  ];
}

function PaginationButton({
  iconName,
  text,
  variant = 'nav',
  isActive = false,
  disabled = false,
  ariaLabel,
  onClick,
}: PaginationButtonProps) {
  return (
    <button
      type="button"
      className={[
        styles.button,
        variant === 'page' ? styles.buttonPage : '',
        variant === 'top' ? styles.buttonTop : '',
        isActive ? styles.buttonActive : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={isActive ? 'page' : undefined}
    >
      {iconName ? <Icon name={iconName} size={18} /> : null}
      {text ? <span className={styles.buttonText}>{text}</span> : null}
    </button>
  );
}

function PageSizeSelect({ id, value, options, onChange }: PageSizeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.pageSizeSelectWrap}>
      <button
        id={id}
        type="button"
        className={styles.pageSizeSelect}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{value}</span>
        <Icon name="arrow_drop_down" size={18} />
      </button>

      {isOpen ? (
        <div className={styles.pageSizeMenu} role="listbox" aria-labelledby={id}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={[
                styles.pageSizeOption,
                option === value ? styles.pageSizeOptionActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={option === value}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  totalPages,
  total,
  itemLabel = 'Элементов',
  pageSizeOptions = [10, 20, 50],
  pageSizeSelectId = 'page-size-select',
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (!total) {
    return null;
  }

  const pages = buildPages(page, totalPages);
  const handleScrollTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <div className={styles.root}>
      <div className={styles.pageSizeWrap}>
        <label className={styles.pageSizeLabel} htmlFor={pageSizeSelectId}>
          {itemLabel} на странице:
        </label>
        <PageSizeSelect
          id={pageSizeSelectId}
          value={pageSize}
          options={pageSizeOptions}
          onChange={onPageSizeChange}
        />
      </div>

      <div className={styles.controls}>
        <div className={styles.navGroup}>
          <PaginationButton
            iconName="first-page"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            ariaLabel="Первая страница"
          />
          <PaginationButton
            iconName="chevron_backward"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            ariaLabel="Предыдущая страница"
          />
        </div>

        <div className={styles.pages}>
          {pages.map((item, index) =>
            item === 'ellipsis' ? (
              <PaginationButton
                key={`ellipsis-${index}`}
                variant="page"
                text="..."
                disabled
                ariaLabel="Скрытые страницы"
              />
            ) : (
              <PaginationButton
                key={item}
                variant="page"
                text={String(item)}
                isActive={item === page}
                onClick={() => onPageChange(item)}
                ariaLabel={`Страница ${item}`}
              />
            ),
          )}
        </div>

        <div className={styles.navGroup}>
          <PaginationButton
            iconName="chevron_forward"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            ariaLabel="Следующая страница"
          />
          <PaginationButton
            iconName="last-page"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            ariaLabel="Последняя страница"
          />
        </div>
      </div>

      <div className={styles.topAction}>
        <PaginationButton
          variant="top"
          iconName="arrow-upward"
          text="Наверх"
          ariaLabel="Наверх страницы"
          onClick={handleScrollTop}
        />
      </div>
    </div>
  );
}
