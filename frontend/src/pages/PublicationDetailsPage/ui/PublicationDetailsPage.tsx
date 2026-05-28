import { useEffect, useMemo, useState, type MouseEvent } from 'react';

import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import { Icon } from '@/shared/ui/Icon';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
import { buildEditionDetailsPath } from '@/entities/edition';
import {
  getBibliographicReference,
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

function downloadPublicationPdf(articleId: number) {
  const link = document.createElement('a');
  link.href = getPublicationPdfUrl(articleId);
  link.download = `article-${articleId}.pdf`;
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatMetricValue(metric: PublicationMetricDto): string {
  return metric.value || '—';
}

const ALLOWED_RICH_TEXT_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'ul',
  'ol',
  'li',
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizePublicationRichText(value: string): string {
  if (!value.trim()) {
    return '';
  }

  if (typeof DOMParser === 'undefined') {
    return escapeHtml(value);
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(value, 'text/html');
  const output = document.createElement('div');

  const sanitizeNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const sourceElement = node as HTMLElement;
    const tagName = sourceElement.tagName.toLowerCase();

    if (!ALLOWED_RICH_TEXT_TAGS.has(tagName)) {
      const fragment = document.createDocumentFragment();

      sourceElement.childNodes.forEach((childNode) => {
        const sanitizedChild = sanitizeNode(childNode);

        if (sanitizedChild) {
          fragment.appendChild(sanitizedChild);
        }
      });

      return fragment;
    }

    const sanitizedElement = document.createElement(tagName);

    sourceElement.childNodes.forEach((childNode) => {
      const sanitizedChild = sanitizeNode(childNode);

      if (sanitizedChild) {
        sanitizedElement.appendChild(sanitizedChild);
      }
    });

    return sanitizedElement;
  };

  document.body.childNodes.forEach((node) => {
    const sanitizedNode = sanitizeNode(node);

    if (sanitizedNode) {
      output.appendChild(sanitizedNode);
    }
  });

  return output.innerHTML;
}

function RelatedPublicationCard({
  item,
}: {
  item: RelatedPublicationDto;
}) {
  const doiUrl = buildDoiUrl(item.doi);
  const handleTitleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    navigateTo(`/articles/${item.id}`);
  };

  return (
    <div className={styles.relatedSection}>
      <h2 className={styles.sectionTitle}>{formatRelatedPublicationTitle(item)}</h2>

      <div className={styles.relatedCard}>
        <div className={styles.relatedMain}>
          <a
            className={styles.relatedTitleButton}
            href={`/articles/${item.id}`}
            onClick={handleTitleClick}
          >
            {item.title || 'Без названия'}
          </a>

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

        <div className={styles.relatedPublisher}>
          <div className={styles.relatedJournal}>
            {normalizeJournalName(item.journal) || 'Издание не указано'}
          </div>
          <div className={styles.relatedYear}>{item.year ?? '—'}</div>
        </div>

        <div className={styles.relatedActions}>
          <OutlineIconButton
            iconName="copy"
            iconSize={20}
            size="small-x"
            className={styles.actionButton}
            onClick={() => {
              const textToCopy = item.doi || item.title || '';
              if (!textToCopy) {
                return;
              }
              void navigator.clipboard.writeText(textToCopy);
            }}
            aria-label="Скопировать данные публикации"
          />

          <OutlineIconButton
            iconName={item.has_pdf ? 'pdf-color' : 'pdf-mono'}
            iconSize={20}
            iconColored={item.has_pdf}
            size="small-x"
            className={styles.actionButton}
            disabled={!item.has_pdf}
            onClick={() => {
              if (!item.has_pdf) {
                return;
              }
              downloadPublicationPdf(item.id);
            }}
            aria-label={item.has_pdf ? 'Открыть PDF' : 'PDF недоступен'}
          />
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
  const abstractHtml = useMemo(
    () => sanitizePublicationRichText(item?.abstract ?? ''),
    [item?.abstract],
  );
  const editionDetailsPath =
    item?.edition_kind && typeof item.edition_source_id === 'number'
      ? buildEditionDetailsPath(item.edition_kind, item.edition_source_id)
      : null;
  const sourceSectionTitle = item?.edition_kind === 'nonperiodical' ? 'Издание' : 'Журнал';

  const handleCopyMain = async () => {
    if (!item) {
      return;
    }

    const textToCopy = getBibliographicReference(item);
    if (!textToCopy) {
      return;
    }

    await navigator.clipboard.writeText(textToCopy);
    setCopyMessage('Скопировано');
  };

  return (
    <div className="app-page">
      <Header title="Информация о публикации" />

      <main className="app-main">
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
                      name={item.has_pdf ? 'pdf-color' : 'pdf-mono'}
                      size={64}
                      colored={item.has_pdf}
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
                    <OutlineIconButton
                      iconName="more_horiz"
                      iconSize={20}
                      size="small-x"
                      className={styles.actionButton}
                      disabled
                      aria-label="Дополнительные действия недоступны"
                    />

                    <OutlineIconButton
                      iconName="copy"
                      iconSize={20}
                      size="small-x"
                      className={styles.actionButton}
                      onClick={() => {
                        void handleCopyMain();
                      }}
                      aria-label="Скопировать библиографическую ссылку"
                    />

                    {item.has_pdf ? (
                      <OutlineIconButton
                        iconName="pdf-color"
                        iconSize={20}
                        iconColored
                        size="small-x"
                        className={styles.actionButton}
                        onClick={() => downloadPublicationPdf(item.id)}
                        aria-label="Открыть PDF"
                      />
                    ) : (
                      <OutlineIconButton
                        iconName="pdf-mono"
                        iconSize={20}
                        size="small-x"
                        className={styles.actionButton}
                        disabled
                        aria-label="PDF недоступен"
                      />
                    )}
                  </div>
                </div>

                {copyMessage ? (
                  <div className={styles.copyMessage}>{copyMessage}</div>
                ) : null}

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Аннотация</h2>
                  <div className={styles.sectionBody}>
                    <div className={styles.abstract}>
                      {abstractHtml ? (
                        <div
                          className={styles.abstractRichText}
                          dangerouslySetInnerHTML={{ __html: abstractHtml }}
                        />
                      ) : (
                        'Аннотация отсутствует.'
                      )}
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
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>{sourceSectionTitle}</h2>

                  <div className={styles.sectionBody}>
                    <button
                      type="button"
                      className={styles.journalNameButton}
                      disabled={!editionDetailsPath}
                      onClick={() => {
                        if (editionDetailsPath) {
                          navigateTo(editionDetailsPath);
                        }
                      }}
                    >
                      {normalizeJournalName(item.journal) || 'Издание не указано'}
                    </button>

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
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Ключевые слова</h2>

                  {item.keywords.length ? (
                    <div className={styles.sectionBody}>
                      <div className={styles.keywords}>
                        {item.keywords.map((keyword) => (
                          <span key={keyword} className={styles.keyword}>
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.sectionBody}>
                      <div className={styles.emptyText}>Ключевые слова не указаны.</div>
                    </div>
                  )}
                </div>

                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Библиометрические показатели</h2>

                  {item.metrics.length ? (
                    <div className={styles.metrics}>
                      {item.metrics.map((metric) => (
                        <div key={metric.label} className={styles.metricItem}>
                          <div className={styles.metricLabel}>{metric.label}</div>
                          <div className={styles.metricValueGroup}>
                            <div className={styles.metricValue}>
                              {formatMetricValue(metric)}
                            </div>
                            {metric.extra ? (
                              <div className={styles.metricExtra}>
                                {metric.extra}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.sectionBody}>
                      <div className={styles.emptyText}>Показатели не указаны.</div>
                    </div>
                  )}
                </div>

                {item.related_articles.map((relatedItem) => (
                  <RelatedPublicationCard
                    key={`${relatedItem.relation_type}-${relatedItem.id}`}
                    item={relatedItem}
                  />
                ))}

                <div className={styles.bottomRow}>
                  <OutlineButton
                    label="Назад"
                    iconName="arrow_back"
                    size="small"
                    className={styles.backButton}
                    onClick={() => navigateTo('/articles')}
                  />

                  <div className={styles.systemMeta}>
                    <div className={styles.systemMetaRow}>
                      <span className={styles.systemMetaLabel}>Идентификатор</span>{' '}
                      <span className={styles.systemMetaValue}>{item.id}</span>
                    </div>
                    <div className={styles.systemMetaRow}>
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
