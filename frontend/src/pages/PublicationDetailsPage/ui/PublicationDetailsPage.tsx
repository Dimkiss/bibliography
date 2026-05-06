import { useEffect, useMemo, useState } from 'react';

import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import { Icon } from '@/shared/ui/Icon';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import {
  getPublicationDetail,
  getPublicationPdfUrl,
  type PublicationDetailDto,
  type PublicationMetricDto,
  type RelatedPublicationDto,
} from '@/entities/publication';
import {
  buildDoiUrl,
  formatDisplayDate,
  formatRelatedPublicationTitle,
  normalizeJournalName,
} from '@/entities/publication';
import { navigateTo } from '@/shared/lib/navigation';
import styles from './PublicationDetailsPage.module.css';

function getArticleIdFromPathname(pathname: string): number | null {
  const match = pathname.match(/^\/articles\/(\d+)$/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatMetricValue(metric: PublicationMetricDto): string {
  const parts = [metric.value, metric.extra].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

function RelatedPublicationCard({
  item,
}: {
  item: RelatedPublicationDto;
}) {
  const doiUrl = buildDoiUrl(item.doi);

  return (
    <div className={styles.relatedCard}>
      <div className={styles.relatedMain}>
        <div className={styles.relatedHeading}>
          {formatRelatedPublicationTitle(item)}
        </div>

        <button
          type="button"
          className={styles.relatedTitleButton}
          onClick={() => navigateTo(`/articles/${item.id}`)}
        >
          {item.title || 'Без названия'}
        </button>

        <div className={styles.relatedAuthors}>
          {item.authors || 'Авторы не указаны'}
        </div>

        {item.doi ? (
          doiUrl ? (
            <a
              className={styles.relatedDoi}
              href={doiUrl}
              target="_blank"
              rel="noreferrer"
            >
              DOI: {item.doi}
            </a>
          ) : (
            <div className={styles.relatedDoi}>DOI: {item.doi}</div>
          )
        ) : null}
      </div>

      <div className={styles.relatedSide}>
        <div className={styles.relatedJournal}>
          {normalizeJournalName(item.journal) || 'Издание не указано'}
        </div>
        <div className={styles.relatedYear}>{item.year ?? '—'}</div>

        <div className={styles.relatedActions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              const textToCopy = item.doi || item.title || '';
              if (!textToCopy) {
                return;
              }
              void navigator.clipboard.writeText(textToCopy);
            }}
            aria-label="Скопировать данные публикации"
          >
            <Icon name="copy" size={20} />
          </button>

          <button
            type="button"
            className={styles.iconButton}
            disabled
            aria-label="PDF недоступен"
          >
            <Icon name="pdf-color" size={20} colored />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PublicationDetailsPage() {
  const articleId = useMemo(
    () => getArticleIdFromPathname(window.location.pathname),
    [],
  );

  const [item, setItem] = useState<PublicationDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadPublication() {
      if (articleId === null) {
        setError('Некорректный идентификатор публикации.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const data = await getPublicationDetail(articleId);

        if (!isMounted) {
          return;
        }

        setItem(data);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Не удалось загрузить публикацию.',
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPublication();

    return () => {
      isMounted = false;
    };
  }, [articleId]);

  useEffect(() => {
    if (!copyMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyMessage('');
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyMessage]);

  const doiUrl = buildDoiUrl(item?.doi);

  const handleCopyMain = async () => {
    if (!item) {
      return;
    }

    const textToCopy = item.doi || item.title || '';
    if (!textToCopy) {
      return;
    }

    await navigator.clipboard.writeText(textToCopy);
    setCopyMessage('Скопировано');
  };

  return (
    <div className={styles.page}>
      <Header title="Информация о публикации" />

      <main className={styles.main}>
        <div className="container app-block-group">
          <section className={styles.card}>
            {isLoading ? (
              <div className={styles.state}>Загрузка публикации...</div>
            ) : null}

            {!isLoading && error ? (
              <div className={styles.state}>{error}</div>
            ) : null}

            {!isLoading && !error && item ? (
              <>
                <div className={styles.topBlock}>
                  <div className={styles.fileIconWrap}>
                    <Icon
                      name="pdf-color"
                      size={64}
                      colored
                      className={styles.fileIcon}
                    />
                  </div>

                  <div className={styles.topContent}>
                    <h1 className={styles.title}>{item.title || 'Без названия'}</h1>
                    <div className={styles.authors}>
                      {item.authors || 'Авторы не указаны'}
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      disabled
                      aria-label="Дополнительные действия недоступны"
                    >
                      <Icon name="more_vert" size={20} />
                    </button>

                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => {
                        void handleCopyMain();
                      }}
                      aria-label="Скопировать DOI или заголовок"
                    >
                      <Icon name="copy" size={20} />
                    </button>

                    {item.has_pdf ? (
                      <a
                        className={styles.iconButton}
                        href={getPublicationPdfUrl(item.id)}
                        download
                        aria-label="Скачать PDF"
                      >
                        <Icon name="pdf-color" size={20} colored />
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={styles.iconButton}
                        disabled
                        aria-label="PDF недоступен"
                      >
                        <Icon name="pdf-color" size={20} colored />
                      </button>
                    )}
                  </div>
                </div>

                {copyMessage ? (
                  <div className={styles.copyMessage}>{copyMessage}</div>
                ) : null}

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Аннотация</h2>
                  <div className={styles.abstract}>
                    {item.abstract || 'Аннотация отсутствует.'}
                  </div>

                  <div className={styles.doiRow}>
                    <span className={styles.doiLabel}>DOI:</span>{' '}
                    {item.doi ? (
                      doiUrl ? (
                        <a
                          className={styles.doiLink}
                          href={doiUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.doi}
                        </a>
                      ) : (
                        <span className={styles.doiLink}>{item.doi}</span>
                      )
                    ) : (
                      <span className={styles.doiMuted}>не указан</span>
                    )}
                  </div>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Журнал</h2>

                  <div className={styles.journalName}>
                    {normalizeJournalName(item.journal) || 'Издание не указано'}
                  </div>

                  <div className={styles.journalMeta}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Год</span>
                      <span className={styles.metaValue}>{item.year ?? '—'}</span>
                    </div>

                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Том</span>
                      <span className={styles.metaValue}>{item.volume || '—'}</span>
                    </div>

                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Номер</span>
                      <span className={styles.metaValue}>{item.issue || '—'}</span>
                    </div>

                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Страницы</span>
                      <span className={styles.metaValue}>{item.pages || '—'}</span>
                    </div>

                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Дата публикации</span>
                      <span className={styles.metaValue}>
                        {formatDisplayDate(item.publication_date)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Ключевые слова</h2>

                  {item.keywords.length ? (
                    <div className={styles.keywords}>
                      {item.keywords.map((keyword) => (
                        <span key={keyword} className={styles.keyword}>
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyText}>Ключевые слова не указаны.</div>
                  )}
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Библиометрические показатели</h2>

                  <div className={styles.metrics}>
                    {item.metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className={[
                          styles.metricCard,
                          metric.enabled ? styles.metricCardActive : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <div className={styles.metricLabel}>{metric.label}</div>
                        <div className={styles.metricValue}>
                          {formatMetricValue(metric)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {item.related_articles.length ? (
                  <div className={styles.section}>
                    {item.related_articles.map((relatedItem) => (
                      <RelatedPublicationCard
                        key={`${relatedItem.relation_type}-${relatedItem.id}`}
                        item={relatedItem}
                      />
                    ))}
                  </div>
                ) : null}

                <div className={styles.bottomRow}>
                  <OutlineButton
                    label="Назад"
                    iconName="arrow_back"
                    onClick={() => navigateTo('/articles')}
                  />

                  <div className={styles.systemMeta}>
                    <div>
                      <span className={styles.systemMetaLabel}>Идентификатор</span>{' '}
                      <span className={styles.systemMetaValue}>{item.id}</span>
                    </div>
                    <div>
                      <span className={styles.systemMetaLabel}>
                        Дата добавления в базу
                      </span>{' '}
                      <span className={styles.systemMetaValue}>
                        {formatDisplayDate(item.insert_date)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
