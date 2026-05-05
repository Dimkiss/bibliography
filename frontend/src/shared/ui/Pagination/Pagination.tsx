import { Icon } from '@/shared/ui/Icon';
import styles from './Pagination.module.css';

type PageItem = number | 'ellipsis';

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

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
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

  return (
    <div className={styles.root}>
      <div className={styles.pageSizeWrap}>
        <label className={styles.pageSizeLabel} htmlFor={pageSizeSelectId}>
          {itemLabel} на странице:
        </label>
        <select
          id={pageSizeSelectId}
          className={styles.pageSizeSelect}
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label="Первая страница"
        >
          <Icon name="first-page" size={18} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Предыдущая страница"
        >
          <Icon name="chevron_backward" size={18} />
        </button>

        <div className={styles.pages}>
          {pages.map((item, index) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className={styles.ellipsis}>
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={[styles.pageButton, item === page ? styles.pageButtonActive : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Следующая страница"
        >
          <Icon name="chevron_forward" size={18} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Последняя страница"
        >
          <Icon name="last-page" size={18} />
        </button>
      </div>
    </div>
  );
}
