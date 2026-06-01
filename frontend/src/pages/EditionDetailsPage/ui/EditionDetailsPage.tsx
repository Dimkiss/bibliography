import { useEffect, useMemo, useState } from 'react';

import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import {
  buildEditionDetailsPath,
  buildNonperiodicalEditionEditPath,
  buildPeriodicalEditionEditPath,
  formatEditionPresence,
  formatWhiteListLevel,
  getEditionDetail,
  type EditionDetailDto,
  type EditionKind,
  type EditionPublicationDto,
  type RelatedEditionDto,
} from '@/entities/edition';
import { buildDoiUrl, getPublicationPdfUrl } from '@/entities/publication';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { useAuth } from '@/features/auth';
import { navigateTo } from '@/shared/lib/navigation';
import { Button } from '@/shared/ui/Button';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { OutlineIconButton } from '@/shared/ui/OutlineIconButton';
import styles from './EditionDetailsPage.module.css';

type EditionRouteParams = {
  kind: EditionKind;
  sourceId: number;
};

type PeriodicalPublicationGroup = {
  key: string;
  label: string;
  items: EditionPublicationDto[];
};

function getEditionRouteParams(pathname: string): EditionRouteParams | null {
  const match = pathname.match(/^\/journals\/(periodical|nonperiodical)\/(\d+)$/);

  if (!match) {
    return null;
  }

  const sourceId = Number(match[2]);
  if (Number.isNaN(sourceId)) {
    return null;
  }

  return {
    kind: match[1] as EditionKind,
    sourceId,
  };
}

function getHeaderTitle(kind?: EditionKind): string {
  return kind === 'nonperiodical'
    ? 'Информация о непериодическом издании'
    : 'Информация о периодическом издании';
}

function formatDisplayDate(dateString?: string | null): string {
  if (!dateString) {
    return '—';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function formatMetricValue(value?: string | null): string {
  return value?.trim() || '—';
}

function formatWosValue(
  quartile?: string | null,
  impactFactor?: string | null,
): string {
  const parts = [formatMetricValue(quartile)];

  if (impactFactor?.trim()) {
    parts.push(`IF: ${impactFactor.trim()}`);
  }

  return parts.join('\n');
}

function formatRincValue(rinc: boolean, rincCore: boolean): string {
  const parts = [formatEditionPresence(rinc)];

  if (rincCore) {
    parts.push('core');
  }

  return parts.join('\n');
}

function openPublicationPdf(articleId: number) {
  const link = document.createElement('a');
  link.href = getPublicationPdfUrl(articleId);
  link.download = `article-${articleId}.pdf`;
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function groupPeriodicalPublications(
  publications: EditionPublicationDto[],
): PeriodicalPublicationGroup[] {
  const groupMap = new Map<string, PeriodicalPublicationGroup>();

  publications.forEach((item) => {
    const volume = item.volume?.trim() || '—';
    const year = item.year ? String(item.year) : '';
    const key = `${volume}:${year}`;
    const label = year ? `Том: ${volume}(${year})` : `Том: ${volume}`;
    const group = groupMap.get(key);

    if (group) {
      group.items.push(item);
      return;
    }

    groupMap.set(key, {
      key,
      label,
      items: [item],
    });
  });

  return Array.from(groupMap.values());
}

function PublicationActions({
  item,
  onCopy,
}: {
  item: EditionPublicationDto;
  onCopy: (item: EditionPublicationDto) => void;
}) {
  return (
    <div className={styles.publicationActions}>
      <OutlineIconButton
        iconName="copy"
        iconSize={20}
        size="small-x"
        className={styles.actionButton}
        onClick={() => onCopy(item)}
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
          if (item.has_pdf) {
            openPublicationPdf(item.id);
          }
        }}
        aria-label={item.has_pdf ? 'Открыть PDF' : 'PDF недоступен'}
      />
    </div>
  );
}

function EditionPublicationRow({
  item,
  kind,
  onCopy,
}: {
  item: EditionPublicationDto;
  kind: EditionKind;
  onCopy: (item: EditionPublicationDto) => void;
}) {
  const doiUrl = buildDoiUrl(item.doi);

  return (
    <div className={styles.publicationRow}>
      <div className={styles.publicationMain}>
        <button
          type="button"
          className={styles.publicationTitle}
          onClick={() => navigateTo(`/articles/${item.id}`)}
        >
          {item.title || 'Без названия'}
        </button>

        {item.authors ? (
          <div className={styles.publicationAuthors}>{item.authors}</div>
        ) : null}

        {item.doi ? (
          <div className={styles.publicationDoi}>
            <span>DOI:</span>{' '}
            {doiUrl ? (
              <a href={doiUrl} target="_blank" rel="noreferrer">
                {item.doi}
              </a>
            ) : (
              <span>{item.doi}</span>
            )}
          </div>
        ) : null}
      </div>

      <div
        className={[
          styles.publicationMeta,
          kind === 'periodical' ? styles.periodicalPublicationMeta : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {kind === 'periodical' ? (
          <>
            <div className={styles.metaLabels}>
              <span>Номер</span>
              <span>Стр.</span>
            </div>
            <div className={styles.metaValues}>
              <span>{item.issue || '—'}</span>
              <span>{item.pages || '—'}</span>
            </div>
          </>
        ) : (
          <div className={styles.pageMeta}>
            <span>Стр.</span>
            <span>{item.pages || '—'}</span>
          </div>
        )}
      </div>

      <PublicationActions item={item} onCopy={onCopy} />
    </div>
  );
}

function RelatedEditionLink({ item }: { item: RelatedEditionDto }) {
  return (
    <button
      type="button"
      className={styles.relatedLink}
      onClick={() => navigateTo(buildEditionDetailsPath(item.kind, item.source_id))}
    >
      {item.title || 'Без названия'}
    </button>
  );
}

export function EditionDetailsPage() {
  const { user, isAuthenticated } = useAuth();
  const routeParams = useMemo(
    () => getEditionRouteParams(window.location.pathname),
    [],
  );
  const [item, setItem] = useState<EditionDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadEdition() {
      if (!routeParams) {
        setError('Некорректный идентификатор издания.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const data = await getEditionDetail(routeParams.kind, routeParams.sourceId);

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
            : 'Не удалось загрузить издание.',
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadEdition();

    return () => {
      isMounted = false;
    };
  }, [routeParams]);

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

  const headerTitle = getHeaderTitle(item?.kind ?? routeParams?.kind);
  const periodicalGroups = useMemo(
    () => groupPeriodicalPublications(item?.publications ?? []),
    [item?.publications],
  );
  const canEditEdition = Boolean(
    isAuthenticated &&
      user?.role_id === ADMIN_ROLE_ID &&
      (item?.kind === 'nonperiodical' || item?.kind === 'periodical'),
  );

  const handleEditEdition = () => {
    if (!item) {
      return;
    }

    navigateTo(
      item.kind === 'periodical'
        ? buildPeriodicalEditionEditPath(item.source_id)
        : buildNonperiodicalEditionEditPath(item.source_id),
    );
  };

  const handleCopyPublication = async (publication: EditionPublicationDto) => {
    const text = [publication.title, publication.authors, publication.doi]
      .filter(Boolean)
      .join('\n');

    if (!text) {
      return;
    }

    await navigator.clipboard.writeText(text);
    setCopyMessage('Скопировано');
  };

  return (
    <div className="app-page">
      <Header title={headerTitle} />

      <main className="app-main">
        <div className="container app-block-group">
          <section className={styles.card}>
            {isLoading ? (
              <div className={styles.state}>Загрузка издания...</div>
            ) : null}

            {!isLoading && error ? (
              <div className={styles.state}>{error}</div>
            ) : null}

            {!isLoading && !error && item ? (
              <>
                <div className={styles.heading}>
                  <div className={styles.headingMain}>
                    <h1 className={styles.title}>{item.title || 'Без названия'}</h1>
                    <div className={styles.identifier}>
                      {item.identifier_label}: {item.identifier || '—'}
                    </div>
                  </div>

                  {canEditEdition ? (
                    <Button
                      label="Редактировать"
                      iconName="edit"
                      size="normal"
                      className={styles.editButton}
                      onClick={handleEditEdition}
                    />
                  ) : null}
                </div>

                {item.kind === 'periodical' ? (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                      Библиометрические показатели
                    </h2>

                    <div className={styles.metricsScroll}>
                      <table className={styles.metricsTable}>
                        <thead>
                          <tr>
                            <th>Год</th>
                            <th>«Белый список»</th>
                            <th>Web of Science</th>
                            <th>Scopus</th>
                            <th>РИНЦ</th>
                            <th>ВАК</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.metrics.map((metric) => (
                            <tr key={metric.year}>
                              <td>{metric.year}</td>
                              <td>{formatWhiteListLevel(metric.white_list_level)}</td>
                              <td className={styles.multilineCell}>
                                {formatWosValue(
                                  metric.wos_quartile,
                                  metric.impact_factor,
                                )}
                              </td>
                              <td>{formatMetricValue(metric.scopus_quartile)}</td>
                              <td className={styles.multilineCell}>
                                {formatRincValue(metric.rinc, metric.rinc_core)}
                              </td>
                              <td>{formatEditionPresence(metric.vak)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : (
                  <section className={styles.infoGrid}>
                    {item.date_of_meeting ? (
                      <div className={styles.infoBlock}>
                        <h2 className={styles.sectionTitle}>Даты проведения</h2>
                        <div className={styles.infoValue}>{item.date_of_meeting}</div>
                      </div>
                    ) : null}

                    {(item.publisher || item.place || item.year) ? (
                      <div className={styles.infoBlock}>
                        <h2 className={styles.sectionTitle}>Издательство</h2>
                        <div className={styles.publisherLine}>
                          {item.publisher ? <span>{item.publisher}</span> : null}
                          {item.place ? <strong>{item.place}</strong> : null}
                        </div>
                        {item.year ? (
                          <div className={styles.infoValue}>{item.year}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                )}

                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Публикации</h2>

                  {copyMessage ? (
                    <div className={styles.copyMessage} role="status">
                      {copyMessage}
                    </div>
                  ) : null}

                  <div className={styles.publicationsScroll}>
                    {item.publications.length ? (
                      item.kind === 'periodical' ? (
                        <div className={styles.volumeGroups}>
                          {periodicalGroups.map((group) => (
                            <div key={group.key} className={styles.volumeGroup}>
                              <h3 className={styles.volumeTitle}>{group.label}</h3>
                              <div className={styles.publicationList}>
                                {group.items.map((publication) => (
                                  <EditionPublicationRow
                                    key={publication.id}
                                    item={publication}
                                    kind={item.kind}
                                    onCopy={(copiedItem) => {
                                      void handleCopyPublication(copiedItem);
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.publicationList}>
                          {item.publications.map((publication) => (
                            <EditionPublicationRow
                              key={publication.id}
                              item={publication}
                              kind={item.kind}
                              onCopy={(copiedItem) => {
                                void handleCopyPublication(copiedItem);
                              }}
                            />
                          ))}
                        </div>
                      )
                    ) : (
                      <div className={styles.emptyText}>
                        Публикации для издания не найдены.
                      </div>
                    )}
                  </div>
                </section>

                {item.kind === 'periodical' && item.related_editions.length ? (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Связанные журналы</h2>
                    <div className={styles.relatedList}>
                      {item.related_editions.map((relatedItem) => (
                        <RelatedEditionLink
                          key={`${relatedItem.kind}:${relatedItem.source_id}`}
                          item={relatedItem}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                <div className={styles.bottomRow}>
                  <OutlineButton
                    label="Назад"
                    iconName="arrow_back"
                    size="small"
                    className={styles.backButton}
                    onClick={() => navigateTo('/journals')}
                  />

                  <div className={styles.systemMeta}>
                    <div className={styles.systemMetaRow}>
                      <span className={styles.systemMetaLabel}>Идентификатор</span>
                      <span className={styles.systemMetaValue}>{item.source_id}</span>
                    </div>
                    <div className={styles.systemMetaRow}>
                      <span className={styles.systemMetaLabel}>
                        Дата добавления в базу
                      </span>
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
