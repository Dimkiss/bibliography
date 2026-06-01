import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import { Icon } from '@/shared/ui/Icon';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
import { ViewportMenu } from '@/shared/ui/ViewportMenu';
import { buildEditionDetailsPath } from '@/entities/edition';
import {
  deleteAdminArticle,
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
import { useAuth } from '@/features/auth';
import { ADMIN_ROLE_ID } from '@/entities/role';
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

function openPublicationPdf(articleId: number) {
  window.open(getPublicationPdfUrl(articleId), '_blank', 'noopener,noreferrer');
}

function buildKeywordSearchPath(keyword: string): string {
  const searchParams = new URLSearchParams();
  searchParams.set('keyword', keyword);
  searchParams.set('page', '1');
  searchParams.set('page_size', '10');
  searchParams.set('sort_by', 'year');
  searchParams.set('sort_order', 'desc');
  searchParams.set('view', 'list');

  return `/articles?${searchParams.toString()}`;
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
              openPublicationPdf(item.id);
            }}
            aria-label={item.has_pdf ? 'Открыть PDF' : 'PDF недоступен'}
          />
        </div>
      </div>
    </div>
  );
}

export function PublicationDetailsPage() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = Boolean(isAuthenticated && user?.role_id === ADMIN_ROLE_ID);
  const articleId = useMemo(
    () => getArticleIdFromPathname(window.location.pathname),
    [],
  );

  const menuAnchorRef = useRef<HTMLElement | null>(null);
  const [item, setItem] = useState<PublicationDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
    const handleClickOutside = () => {
      setIsActionMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const handleOpenPdf = () => {
    if (!item?.has_pdf) {
      return;
    }

    setIsActionMenuOpen(false);
    openPublicationPdf(item.id);
  };

  const handleOpenDoi = () => {
    const url = buildDoiUrl(item?.doi);
    if (!url) {
      return;
    }

    setIsActionMenuOpen(false);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyReference = async () => {
    setIsActionMenuOpen(false);
    await handleCopyMain();
  };

  const handleEditPublication = () => {
    if (!item) {
      return;
    }

    setIsActionMenuOpen(false);
    navigateTo(`/articles/${item.id}/edit`);
  };

  const handleRequestDelete = () => {
    setIsActionMenuOpen(false);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!item) {
      return;
    }

    try {
      await deleteAdminArticle(item.id);
      navigateTo('/articles');
    } catch (caughtError) {
      setIsDeleteDialogOpen(false);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось удалить публикацию.',
      );
    }
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

                  <div
                    className={styles.actions}
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <OutlineIconButton
                      iconName="more_horiz"
                      iconSize={20}
                      size="small-x"
                      className={styles.actionButton}
                      aria-label="Дополнительные действия"
                      aria-expanded={isActionMenuOpen}
                      onClick={(event) => {
                        event.stopPropagation();
                        menuAnchorRef.current = event.currentTarget;
                        setIsActionMenuOpen((prev) => !prev);
                      }}
                    />

                    <ViewportMenu
                      isOpen={isActionMenuOpen}
                      triggerRef={menuAnchorRef}
                      placement="left-start"
                      offset={10}
                      className={styles.publicationMenu}
                      role="menu"
                    >
                      <button
                        type="button"
                        className={styles.publicationMenuItem}
                        onClick={handleOpenPdf}
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
                        onClick={handleOpenDoi}
                        disabled={!doiUrl}
                        role="menuitem"
                      >
                        <Icon name="doi" size={24} />
                        <span>Открыть по DOI</span>
                      </button>

                      <button
                        type="button"
                        className={styles.publicationMenuItem}
                        onClick={() => {
                          void handleCopyReference();
                        }}
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
                            onClick={handleEditPublication}
                            role="menuitem"
                          >
                            <Icon name="edit" size={24} />
                            <span>Редактировать</span>
                          </button>

                          <button
                            type="button"
                            className={styles.publicationMenuItem}
                            onClick={handleRequestDelete}
                            role="menuitem"
                          >
                            <Icon name="delete" size={24} />
                            <span>Удалить</span>
                          </button>
                        </>
                      ) : null}
                    </ViewportMenu>

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
                        onClick={() => openPublicationPdf(item.id)}
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
                          <button
                            key={keyword}
                            type="button"
                            className={styles.keyword}
                            onClick={() => navigateTo(buildKeywordSearchPath(keyword))}
                            aria-label={`Найти публикации по ключевому слову ${keyword}`}
                          >
                            {keyword}
                          </button>
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

          {item && isDeleteDialogOpen ? (
            <div
              className={styles.confirmOverlay}
              role="presentation"
              onMouseDown={() => setIsDeleteDialogOpen(false)}
            >
              <div
                className={styles.confirmDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-publication-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <h2 id="delete-publication-title" className={styles.confirmTitle}>
                  Удалить публикацию?
                </h2>
                <p className={styles.confirmText}>
                  Вы точно хотите удалить публикацию «{item.title || `#${item.id}`}»? Это
                  действие нельзя отменить.
                </p>
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    className={styles.confirmCancelButton}
                    onClick={() => setIsDeleteDialogOpen(false)}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className={styles.confirmDeleteButton}
                    onClick={() => {
                      void handleConfirmDelete();
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}
