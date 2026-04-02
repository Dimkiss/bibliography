import type { MouseEventHandler, KeyboardEventHandler } from 'react';

import type { PublicationListItemDto } from '@/shared/api/publications';
import {
  buildDoiUrl,
  formatOriginalTranslationLabel,
  getPublicationSubtitle,
} from '@/shared/lib/publications';
import styles from './PublicationResultCard.module.css';

type PublicationResultCardProps = {
  item: PublicationListItemDto;
  onClick?: MouseEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
};

export function PublicationResultCard({
  item,
  onClick,
  onKeyDown,
}: PublicationResultCardProps) {
  const doiUrl = buildDoiUrl(item.doi);
  const originalTranslationLabel = formatOriginalTranslationLabel(
    item.original_translation,
  );
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
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{item.title || 'Без названия'}</h3>
          <p className={styles.authors}>{item.authors || 'Авторы не указаны'}</p>
          <p className={styles.subtitle}>
            {getPublicationSubtitle(item) || 'Издание не указано'}
          </p>
        </div>

        <div className={styles.headerMeta}>
          {item.year ? <span className={styles.yearBadge}>{item.year}</span> : null}
          {originalTranslationLabel ? (
            <span className={styles.stateBadge}>{originalTranslationLabel}</span>
          ) : null}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Тип публикации</span>
          <div className={styles.tags}>
            {item.publication_types.length ? (
              item.publication_types.map((type) => (
                <span key={type} className={styles.tag}>
                  {type}
                </span>
              ))
            ) : (
              <span className={styles.placeholder}>—</span>
            )}
          </div>
        </div>

        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Базы данных</span>
          <div className={styles.tags}>
            {item.databases.length ? (
              item.databases.map((database) => (
                <span key={database} className={styles.tag}>
                  {database}
                </span>
              ))
            ) : (
              <span className={styles.placeholder}>—</span>
            )}
          </div>
        </div>

        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Квартиль</span>
          <div className={styles.tags}>
            {item.quartile ? (
              <span className={styles.quartileBadge}>WoS {item.quartile}</span>
            ) : null}
            {item.quartile_scopus ? (
              <span className={styles.quartileBadge}>
                Scopus {item.quartile_scopus}
              </span>
            ) : null}
            {!item.quartile && !item.quartile_scopus ? (
              <span className={styles.placeholder}>—</span>
            ) : null}
          </div>
        </div>

        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>DOI</span>
          {doiUrl && item.doi ? (
            <a
              className={styles.doiLink}
              href={doiUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {item.doi}
            </a>
          ) : (
            <span className={styles.placeholder}>Не указан</span>
          )}
        </div>
      </div>
    </article>
  );
}