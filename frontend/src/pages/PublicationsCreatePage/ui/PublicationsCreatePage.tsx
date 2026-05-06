import { useEffect, useMemo, useRef, useState } from 'react';

import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import { useAuth } from '@/features/auth';
import {
  createAdminArticle,
  getAdminPublicationTypes,
  getAdminWorkFormTypes,
  searchAdminArticles,
  searchAdminJournals,
  searchAdminPublishers,
  uploadAdminArticlePdf,
  type AdminOptionDto,
  type ArticleSearchItemDto,
  type PublicationTypeDto,
  type WorkFormTypeDto,
} from '@/features/create-publication';
import { navigateTo } from '@/shared/lib/navigation';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { Button } from '@/shared/ui/Button';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import styles from './PublicationsCreatePage.module.css';

type FormVariant = 'article' | 'book-chapter' | 'book-monograph' | 'conference';
type RelatedRelationType = 'original' | 'translation';
type SelectorMode = 'journal' | 'publisher' | 'source' | 'related' | null;

type FormState = {
  workFormType: string;
  publicationTypeFlag: string;
  title: string;
  authorsText: string;
  sourceText: string;
  journal: AdminOptionDto | null;
  publisher: AdminOptionDto | null;
  doi: string;
  url: string;
  pages: string;
  publicationDate: string;
  year: string;
  abstract: string;
  keywordsInput: string;
  relatedRelationType: RelatedRelationType;
  relatedArticle: ArticleSearchItemDto | null;
  isbn: string;
  tirage: string;
  extentOfWork: string;
  notes: string;
  pdfFileName: string;
  pdfFile: File | null;
};

const INITIAL_FORM: FormState = {
  workFormType: '',
  publicationTypeFlag: '',
  title: '',
  authorsText: '',
  sourceText: '',
  journal: null,
  publisher: null,
  doi: '',
  url: '',
  pages: '',
  publicationDate: '',
  year: '',
  abstract: '',
  keywordsInput: '',
  relatedRelationType: 'original',
  relatedArticle: null,
  isbn: '',
  tirage: '',
  extentOfWork: '',
  notes: '',
  pdfFileName: '',
  pdfFile: null,
};

function getWorkFormLabel(item: WorkFormTypeDto): string {
  return item.label_ru?.trim() || item.label?.trim() || item.value;
}

function resolveVariant(
  workForm: WorkFormTypeDto | null,
  publicationType: PublicationTypeDto | null,
): FormVariant {
  const workFormLabel = `${workForm?.label_ru ?? ''} ${workForm?.label ?? ''}`.toLowerCase();
  const publicationTypeLabel = `${publicationType?.label ?? ''}`.toLowerCase();

  if (workFormLabel.includes('конферен')) {
    return 'conference';
  }

  if (
    workFormLabel.includes('книж') ||
    workFormLabel.includes('монограф') ||
    publicationTypeLabel.includes('монограф') ||
    publicationTypeLabel.includes('глава')
  ) {
    if (publicationTypeLabel.includes('монограф')) {
      return 'book-monograph';
    }

    return 'book-chapter';
  }

  return 'article';
}

function normalizeKeywords(value: string): string[] {
  return value
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(
      (item, index, array) =>
        array.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index,
    );
}

function deriveYear(year: string, publicationDate: string): number | null {
  const trimmedYear = year.trim();
  if (trimmedYear) {
    const parsedYear = Number(trimmedYear);
    return Number.isFinite(parsedYear) ? parsedYear : null;
  }

  if (publicationDate) {
    const parsedYear = Number(publicationDate.slice(0, 4));
    return Number.isFinite(parsedYear) ? parsedYear : null;
  }

  return null;
}

function formatArticleMeta(item: ArticleSearchItemDto): string {
  return [item.authors, item.journal, item.year, item.doi].filter(Boolean).join(' · ');
}

function getSourceLabel(variant: FormVariant): string {
  if (variant === 'book-chapter') {
    return 'Монография';
  }

  if (variant === 'conference') {
    return 'Конференция';
  }

  return 'Издание';
}

function getTitlePlaceholder(variant: FormVariant): string {
  if (variant === 'book-chapter') {
    return 'Название главы';
  }

  if (variant === 'book-monograph') {
    return 'Название монографии';
  }

  if (variant === 'conference') {
    return 'Название материала';
  }

  return 'Название';
}

function getAuthorsPlaceholder(variant: FormVariant): string {
  if (variant === 'book-chapter') {
    return 'Авторы главы';
  }

  if (variant === 'book-monograph') {
    return 'Авторы монографии';
  }

  if (variant === 'conference') {
    return 'Авторы материала';
  }

  return 'Авторы';
}

function getSourceItemTitle(item: ArticleSearchItemDto): string {
  return item.title || item.journal || `Публикация #${item.id}`;
}

function buildEmptyForm(
  prev: FormState,
  workFormType: string,
  publicationTypeFlag: string,
): FormState {
  return {
    ...INITIAL_FORM,
    workFormType,
    publicationTypeFlag,
    relatedRelationType: prev.relatedRelationType,
  };
}

export function PublicationsCreatePage() {
  const { user, isAuthenticated, isInitializing } = useAuth();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [workForms, setWorkForms] = useState<WorkFormTypeDto[]>([]);
  const [publicationTypes, setPublicationTypes] = useState<PublicationTypeDto[]>([]);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [selectorMode, setSelectorMode] = useState<SelectorMode>(null);
  const [selectorQuery, setSelectorQuery] = useState('');
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [journalResults, setJournalResults] = useState<AdminOptionDto[]>([]);
  const [publisherResults, setPublisherResults] = useState<AdminOptionDto[]>([]);
  const [sourceResults, setSourceResults] = useState<ArticleSearchItemDto[]>([]);
  const [relatedResults, setRelatedResults] = useState<ArticleSearchItemDto[]>([]);

  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const isRoleAllowed = Boolean(isAuthenticated && user?.role_id === ADMIN_ROLE_ID);

  useEffect(() => {
    if (!isInitializing && (!isAuthenticated || user?.role_id !== ADMIN_ROLE_ID)) {
      navigateTo('/articles');
    }
  }, [isAuthenticated, isInitializing, user?.role_id]);

  useEffect(() => {
    if (!isRoleAllowed) {
      return;
    }

    let isMounted = true;

    async function loadInitialData() {
      setIsBootLoading(true);
      setError('');

      try {
        const workFormItems = await getAdminWorkFormTypes();

        if (!isMounted) {
          return;
        }

        setWorkForms(workFormItems);

        const defaultWorkForm =
          workFormItems.find((item) => getWorkFormLabel(item).toLowerCase().includes('стат')) ||
          workFormItems.find((item) => item.value === 'J') ||
          workFormItems[0] ||
          null;

        if (!defaultWorkForm) {
          setPublicationTypes([]);
          setForm(INITIAL_FORM);
          return;
        }

        const publicationTypeItems = await getAdminPublicationTypes(defaultWorkForm.value);

        if (!isMounted) {
          return;
        }

        setPublicationTypes(publicationTypeItems);
        setForm((prev) =>
          buildEmptyForm(prev, defaultWorkForm.value, publicationTypeItems[0]?.value ?? ''),
        );
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Не удалось подготовить форму добавления публикации.',
        );
      } finally {
        if (isMounted) {
          setIsBootLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [isRoleAllowed]);

  const selectedWorkForm = useMemo(
    () => workForms.find((item) => item.value === form.workFormType) ?? null,
    [form.workFormType, workForms],
  );

  const selectedPublicationType = useMemo(
    () => publicationTypes.find((item) => item.value === form.publicationTypeFlag) ?? null,
    [form.publicationTypeFlag, publicationTypes],
  );

  const variant = useMemo(
    () => resolveVariant(selectedWorkForm, selectedPublicationType),
    [selectedWorkForm, selectedPublicationType],
  );

  const sourceLabel = useMemo(() => getSourceLabel(variant), [variant]);
  const showPublicationSubtype = variant !== 'article' && publicationTypes.length > 0;
  const resolvedYear = deriveYear(form.year, form.publicationDate);

  const isSubmitDisabled =
    isSubmitting ||
    !form.title.trim() ||
    resolvedYear === null ||
    (variant === 'article' && !form.journal) ||
    (variant === 'book-chapter' && !form.sourceText.trim()) ||
    (variant === 'book-monograph' && !form.publisher) ||
    (variant === 'conference' && (!form.sourceText.trim() || !form.publisher));

  useEffect(() => {
    if (!selectorMode) {
      return;
    }

    let isMounted = true;

    async function loadSelectorItems() {
      setSelectorLoading(true);

      try {
        if (selectorMode === 'journal') {
          const items = await searchAdminJournals(selectorQuery);
          if (isMounted) {
            setJournalResults(items);
          }
          return;
        }

        if (selectorMode === 'publisher') {
          const items = await searchAdminPublishers(selectorQuery);
          if (isMounted) {
            setPublisherResults(items);
          }
          return;
        }

        if (selectorMode === 'source') {
          const items = await searchAdminArticles(selectorQuery);
          if (isMounted) {
            setSourceResults(items);
          }
          return;
        }

        if (selectorMode === 'related') {
          const items = await searchAdminArticles(selectorQuery);
          if (isMounted) {
            setRelatedResults(items);
          }
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Не удалось загрузить данные для выбора.',
          );
        }
      } finally {
        if (isMounted) {
          setSelectorLoading(false);
        }
      }
    }

    void loadSelectorItems();

    return () => {
      isMounted = false;
    };
  }, [selectorMode, selectorQuery]);

  const closeSelector = () => {
    setSelectorMode(null);
    setSelectorQuery('');
  };

  const handleWorkFormChange = async (nextValue: string) => {
    setError('');
    setSuccessMessage('');
    setSelectorMode(null);

    try {
      const items = await getAdminPublicationTypes(nextValue);
      setPublicationTypes(items);
      setForm((prev) => buildEmptyForm(prev, nextValue, items[0]?.value ?? ''));
    } catch (caughtError) {
      setPublicationTypes([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось загрузить типы публикаций.',
      );
    }
  };

  const handlePublicationTypeChange = (nextValue: string) => {
    setSelectorMode(null);
    setForm((prev) => ({
      ...buildEmptyForm(prev, prev.workFormType, nextValue),
      relatedRelationType: prev.relatedRelationType,
    }));
  };

  const openSelector = (mode: SelectorMode) => {
    setError('');
    setSuccessMessage('');

    if (selectorMode === mode) {
      closeSelector();
      return;
    }

    if (mode === 'source') {
      setSelectorQuery(form.sourceText);
    } else if (mode === 'journal') {
      setSelectorQuery(form.journal?.label ?? '');
    } else if (mode === 'publisher') {
      setSelectorQuery(form.publisher?.label ?? '');
    } else {
      setSelectorQuery(form.relatedArticle?.title ?? '');
    }

    setSelectorMode(mode);
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');

    if (!form.title.trim()) {
      setError('Заполни поле «Название».');
      return;
    }

    if (resolvedYear === null) {
      setError('Укажи год публикации или дату, из которой можно определить год.');
      return;
    }

    if (variant === 'article' && !form.journal) {
      setError('Для статьи выбери издание.');
      return;
    }

    const payloadBase = {
      title: form.title.trim(),
      year: resolvedYear,
      authors_text: form.authorsText.trim() || null,
      abstract: form.abstract.trim() || null,
      doi: form.doi.trim() || null,
      work_form_type: form.workFormType || null,
      publication_type_flags: form.publicationTypeFlag ? [form.publicationTypeFlag] : [],
      keywords: normalizeKeywords(form.keywordsInput),
      original_version_id:
        form.relatedArticle && form.relatedRelationType === 'original'
          ? form.relatedArticle.id
          : null,
      translation_version_id:
        form.relatedArticle && form.relatedRelationType === 'translation'
          ? form.relatedArticle.id
          : null,
    };

    const payload =
      variant === 'article'
        ? {
            ...payloadBase,
            journal_id: form.journal?.id ?? null,
            pages: form.pages.trim() || null,
            publication_date: form.publicationDate || null,
          }
        : variant === 'book-chapter'
          ? {
              ...payloadBase,
              edition: form.sourceText.trim() || null,
              url: form.url.trim() || null,
              pages: form.pages.trim() || null,
              publication_date: form.publicationDate || null,
            }
          : variant === 'book-monograph'
            ? {
                ...payloadBase,
                publisher_id: form.publisher?.id ?? null,
                isbn: form.isbn.trim() || null,
                notes: form.notes.trim() || null,
                tirage: form.tirage.trim() || null,
                extent_of_work: form.extentOfWork.trim() || null,
              }
            : {
                ...payloadBase,
                edition: form.sourceText.trim() || null,
                publisher_id: form.publisher?.id ?? null,
                url: form.url.trim() || null,
                pages: form.pages.trim() || null,
                publication_date: form.publicationDate || null,
                date_of_meeting: form.publicationDate || null,
              };

    setIsSubmitting(true);

    try {
      const createdArticle = await createAdminArticle(payload);

      if (form.pdfFile) {
        await uploadAdminArticlePdf(createdArticle.id, form.pdfFile);
      }
      setSuccessMessage(`Публикация успешно добавлена. ID: ${createdArticle.id}`);
      setSelectorMode(null);
      setForm((prev) => buildEmptyForm(prev, prev.workFormType, prev.publicationTypeFlag));
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }

      window.setTimeout(() => {
        navigateTo('/articles');
      }, 900);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось создать публикацию.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSelectorPanel = () => {
    if (!selectorMode) {
      return null;
    }

    if (selectorMode === 'journal') {
      return (
        <div className={styles.selectorPanel}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorTitle}>Выбор издания</div>
            <button type="button" className={styles.selectorClose} onClick={closeSelector}>
              ×
            </button>
          </div>
          <input
            className={styles.queryInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск издания"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && journalResults.length === 0 ? (
              <div className={styles.selectorHint}>Совпадения не найдены.</div>
            ) : null}
            {journalResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.selectorItem}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    journal: item,
                  }));
                  closeSelector();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectorMode === 'publisher') {
      return (
        <div className={styles.selectorPanel}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorTitle}>Выбор издательства</div>
            <button type="button" className={styles.selectorClose} onClick={closeSelector}>
              ×
            </button>
          </div>
          <input
            className={styles.queryInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск издательства"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && publisherResults.length === 0 ? (
              <div className={styles.selectorHint}>Совпадения не найдены.</div>
            ) : null}
            {publisherResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.selectorItem}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    publisher: item,
                  }));
                  closeSelector();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectorMode === 'source') {
      return (
        <div className={styles.selectorPanel}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorTitle}>
              Выбор значения для поля «{sourceLabel}»
            </div>
            <button type="button" className={styles.selectorClose} onClick={closeSelector}>
              ×
            </button>
          </div>
          <input
            className={styles.queryInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder={`Поиск: ${sourceLabel.toLowerCase()}`}
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && sourceResults.length === 0 ? (
              <div className={styles.selectorHint}>Совпадения не найдены.</div>
            ) : null}
            {sourceResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.selectorItem}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    sourceText: getSourceItemTitle(item),
                  }));
                  closeSelector();
                }}
              >
                <div className={styles.selectorItemTitle}>{getSourceItemTitle(item)}</div>
                <div className={styles.selectorItemMeta}>{formatArticleMeta(item)}</div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={styles.selectorPanel}>
        <div className={styles.selectorHeader}>
          <div className={styles.selectorTitle}>Выбор связанной статьи</div>
          <button type="button" className={styles.selectorClose} onClick={closeSelector}>
            ×
          </button>
        </div>
        <div className={styles.relatedModeRow}>
          <button
            type="button"
            className={[
              styles.relationToggle,
              form.relatedRelationType === 'original' ? styles.relationToggleActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                relatedRelationType: 'original',
              }))
            }
          >
            Оригинал
          </button>
          <button
            type="button"
            className={[
              styles.relationToggle,
              form.relatedRelationType === 'translation' ? styles.relationToggleActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                relatedRelationType: 'translation',
              }))
            }
          >
            Перевод
          </button>
        </div>
        <input
          className={styles.queryInput}
          value={selectorQuery}
          onChange={(event) => setSelectorQuery(event.target.value)}
          placeholder="Поиск статьи"
        />
        <div className={styles.selectorResults}>
          {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
          {!selectorLoading && relatedResults.length === 0 ? (
            <div className={styles.selectorHint}>Совпадения не найдены.</div>
          ) : null}
          {relatedResults.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.selectorItem}
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  relatedArticle: item,
                }));
                closeSelector();
              }}
            >
              <div className={styles.selectorItemTitle}>{getSourceItemTitle(item)}</div>
              <div className={styles.selectorItemMeta}>{formatArticleMeta(item)}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (isInitializing || (isRoleAllowed && isBootLoading)) {
    return (
      <div className={styles.page}>
        <Header title="Добавить публикацию" />
        <main className={styles.main}>
          <div className="container app-block-group">
            <div className={styles.statusBox}>Загрузка формы…</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isRoleAllowed) {
    return (
      <div className={styles.page}>
        <Header title="Добавить публикацию" />
        <main className={styles.main}>
          <div className="container app-block-group">
            <div className={styles.statusBox}>
              Доступ к странице добавления публикаций разрешён только пользователям с ролью 5.
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header title="Добавить публикацию" />

      <main className={styles.main}>
        <div className="container app-block-group">
          {error ? <div className={styles.messageError}>{error}</div> : null}
          {successMessage ? <div className={styles.messageSuccess}>{successMessage}</div> : null}

          <section className={styles.card}>
            <div className={styles.typeRow}>
              <div className={styles.typeLabel}>Тип публикации</div>

              <select
                className={[styles.selectField, styles.primarySelect].join(' ')}
                value={form.workFormType}
                onChange={(event) => void handleWorkFormChange(event.target.value)}
              >
                {workForms.map((item) => (
                  <option key={item.value} value={item.value}>
                    {getWorkFormLabel(item)}
                  </option>
                ))}
              </select>

              {showPublicationSubtype ? (
                <select
                  className={[styles.selectField, styles.secondarySelect].join(' ')}
                  value={form.publicationTypeFlag}
                  onChange={(event) => handlePublicationTypeChange(event.target.value)}
                >
                  {publicationTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className={styles.formBody}>
              <input
                className={styles.textInput}
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                placeholder={getTitlePlaceholder(variant)}
              />

              <input
                className={styles.textInput}
                value={form.authorsText}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    authorsText: event.target.value,
                  }))
                }
                placeholder={getAuthorsPlaceholder(variant)}
              />

              {variant === 'article' ? (
                <div className={styles.lookupRow}>
                  <input
                    className={styles.lookupInput}
                    value={form.journal?.label ?? ''}
                    readOnly
                    placeholder="Издание"
                  />
                  <Button
                    label="Выбрать"
                    className={styles.sideButton}
                    onClick={() => openSelector('journal')}
                  />
                </div>
              ) : null}

              {variant === 'book-chapter' || variant === 'conference' ? (
                <div className={styles.lookupRow}>
                  <input
                    className={styles.lookupInput}
                    value={form.sourceText}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        sourceText: event.target.value,
                      }))
                    }
                    placeholder={sourceLabel}
                  />
                  <Button
                    label="Выбрать"
                    className={styles.sideButton}
                    onClick={() => openSelector('source')}
                  />
                </div>
              ) : null}

              {variant === 'book-monograph' ? (
                <input
                  className={styles.textInput}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Редакция"
                />
              ) : null}

              {variant === 'book-monograph' || variant === 'conference' ? (
                <div className={styles.lookupRow}>
                  <input
                    className={styles.lookupInput}
                    value={form.publisher?.label ?? ''}
                    readOnly
                    placeholder="Издательство"
                  />
                  <Button
                    label="Выбрать"
                    className={styles.sideButton}
                    onClick={() => openSelector('publisher')}
                  />
                </div>
              ) : null}

              {selectorMode === 'journal' ||
              selectorMode === 'publisher' ||
              selectorMode === 'source'
                ? renderSelectorPanel()
                : null}

              {variant === 'article' ? (
                <div className={styles.rowThreeArticle}>
                  <input
                    className={styles.textInput}
                    value={form.doi}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        doi: event.target.value,
                      }))
                    }
                    placeholder="DOI"
                  />
                  <input
                    className={styles.textInput}
                    value={form.pages}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        pages: event.target.value,
                      }))
                    }
                    placeholder="Страницы"
                  />
                  <input
                    className={styles.textInput}
                    type="date"
                    value={form.publicationDate}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        publicationDate: event.target.value,
                      }))
                    }
                    placeholder="Дата"
                  />
                </div>
              ) : null}

              {variant === 'book-chapter' || variant === 'conference' ? (
                <>
                  <div className={styles.rowTwo}>
                    <input
                      className={styles.textInput}
                      value={form.doi}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          doi: event.target.value,
                        }))
                      }
                      placeholder="DOI"
                    />
                    <input
                      className={styles.textInput}
                      value={form.url}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          url: event.target.value,
                        }))
                      }
                      placeholder="URL"
                    />
                  </div>

                  <div className={styles.rowTwoLeft}>
                    <input
                      className={styles.textInput}
                      value={form.pages}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          pages: event.target.value,
                        }))
                      }
                      placeholder="Страницы"
                    />
                    <input
                      className={styles.textInput}
                      type="date"
                      value={form.publicationDate}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          publicationDate: event.target.value,
                        }))
                      }
                      placeholder="Дата"
                    />
                  </div>
                </>
              ) : null}

              {variant === 'book-monograph' ? (
                <>
                  <div className={styles.rowTwo}>
                    <input
                      className={styles.textInput}
                      value={form.isbn}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          isbn: event.target.value,
                        }))
                      }
                      placeholder="ISBN"
                    />
                    <input
                      className={styles.textInput}
                      value={form.doi}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          doi: event.target.value,
                        }))
                      }
                      placeholder="DOI"
                    />
                  </div>

                  <div className={styles.rowThree}>
                    <input
                      className={styles.textInput}
                      type="number"
                      value={form.year}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          year: event.target.value,
                        }))
                      }
                      placeholder="Год"
                    />
                    <input
                      className={styles.textInput}
                      value={form.tirage}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          tirage: event.target.value,
                        }))
                      }
                      placeholder="Тираж"
                    />
                    <input
                      className={styles.textInput}
                      value={form.extentOfWork}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          extentOfWork: event.target.value,
                        }))
                      }
                      placeholder="Объем работы"
                    />
                  </div>
                </>
              ) : null}

              <textarea
                className={styles.textareaField}
                value={form.abstract}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    abstract: event.target.value,
                  }))
                }
                placeholder="Аннотация"
              />

              <input
                className={styles.textInput}
                value={form.keywordsInput}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    keywordsInput: event.target.value,
                  }))
                }
                placeholder="Ключевые слова"
              />

              <div className={styles.lookupRow}>
                <input
                  className={styles.lookupInput}
                  value={form.pdfFileName}
                  readOnly
                  placeholder="Файл PDF"
                />
                <Button
                  label="Обзор"
                  className={styles.sideButton}
                  onClick={() => pdfInputRef.current?.click()}
                />
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className={styles.hiddenInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setForm((prev) => ({
                      ...prev,
                      pdfFileName: file?.name ?? '',
                      pdfFile: file,
                    }));
                  }}
                />
              </div>

              {variant === 'article' ? (
                <>
                  <div className={styles.lookupRow}>
                    <input
                      className={styles.lookupInput}
                      value={form.relatedArticle ? getSourceItemTitle(form.relatedArticle) : ''}
                      readOnly
                      placeholder="Связанная статья"
                    />
                    <Button
                      label="Выбрать"
                      className={styles.sideButton}
                      onClick={() => openSelector('related')}
                    />
                  </div>

                  {selectorMode === 'related' ? renderSelectorPanel() : null}
                </>
              ) : null}

              <div className={styles.actionsRow}>
                <OutlineButton
                  label="Отмена"
                  className={styles.cancelButton}
                  onClick={() => navigateTo('/articles')}
                />
                <Button
                  label={isSubmitting ? 'Добавление...' : 'Добавить'}
                  iconName="add_notes"
                  className={styles.submitButton}
                  disabled={isSubmitDisabled}
                  onClick={() => void handleSubmit()}
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
