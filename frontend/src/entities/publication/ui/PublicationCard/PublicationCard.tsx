import type { KeyboardEventHandler, MouseEventHandler } from 'react';

import { buildDoiUrl } from '../../lib/publications';
import styles from './PublicationCard.module.css';

export type PublicationCardProps = {
  title: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  onClick?: MouseEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
};

export function PublicationCard({
  title,
  authors,
  journal,
  year,
  doi,
  onClick,
  onKeyDown,
}: PublicationCardProps) {
  const doiUrl = buildDoiUrl(doi);
  const isInteractive = Boolean(onClick);

  return (
    <article
      className={[
        styles.card,
        isInteractive ? styles.cardInteractive : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <h3 className={styles.title}>{title || 'Без названия'}</h3>

      <p className={styles.authors}>{authors || 'Авторы не указаны'}</p>

      <div className={styles.meta}>
        {journal ? <span className={styles.journal}>{journal}</span> : null}
        {journal && year ? <span className={styles.separator}>·</span> : null}
        {year ? <span className={styles.year}>{year}</span> : null}
      </div>

      {doiUrl && doi ? (
        <a
          className={styles.doi}
          href={doiUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          <span className={styles.doiLabel}>DOI:</span>{' '}
          <span className={styles.doiValue}>{doi}</span>
        </a>
      ) : (
        <span className={styles.doiPlaceholder}>DOI не указан</span>
      )}
    </article>
  );
}
