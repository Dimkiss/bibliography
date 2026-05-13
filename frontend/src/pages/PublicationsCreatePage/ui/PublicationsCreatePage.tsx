import { useEffect, useMemo, useRef, useState } from 'react';

import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import { useAuth } from '@/features/auth';
import { KeywordSearchInput } from '@/features/search-publications';
import {
  createAdminArticle,
  getAdminPublicationTypes,
  getAdminAuthors,
  getAdminWorkFormTypes,
  searchAdminArticles,
  searchAdminJournals,
  searchAdminPublishers,
  uploadAdminArticlePdf,
  type AdminOptionDto,
  type ArticleSearchItemDto,
  type AuthorOptionDto,
  type PublicationTypeDto,
  type WorkFormTypeDto,
} from '@/features/create-publication';
import { navigateTo } from '@/shared/lib/navigation';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Icon } from '@/shared/ui/Icon';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { RichTextField } from '@/shared/ui/RichTextField';
import { Select } from '@/shared/ui/Select';
import { TextButton } from '@/shared/ui/TextButton';
import { TextField } from '@/shared/ui/TextField';
import styles from './PublicationsCreatePage.module.css';

type FormVariant = 'article' | 'book-chapter' | 'book-monograph' | 'conference';
type ArticleLanguage = 'R' | 'F' | '';
type SelectorMode = 'journal' | 'publisher' | 'source' | 'related' | 'author' | null;

type SelectedAuthor = {
  author: AuthorOptionDto;
  affiliation: string;
  correspondingAuthor: boolean;
};

type ClearFieldButtonProps = {
  label: string;
  onClick: () => void;
};

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
  relatedArticle: null,
  isbn: '',
  tirage: '',
  extentOfWork: '',
  notes: '',
  pdfFileName: '',
  pdfFile: null,
};

function ClearFieldButton({ label, onClick }: ClearFieldButtonProps) {
  return (
    <button
      type="button"
      className={styles.clearFieldButton}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
    >
      <Icon name="close" size={20} />
    </button>
  );
}

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

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function transliterateRuToLat(value: string): string {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };

  return value
    .toLowerCase()
    .split('')
    .map((char) => map[char] ?? char)
    .join('');
}

function getAuthorLastNameVariants(author: AuthorOptionDto): string[] {
  const [lastName = ''] = author.label.trim().split(/\s+/);
  const nicknameVariants = (author.nickname ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return [lastName, ...nicknameVariants].filter(Boolean);
}

function buildAuthorMatchVariants(author: AuthorOptionDto): string[] {
  const [, firstName = '', patronymic = ''] = author.label.trim().split(/\s+/);
  const firstInitial = firstName.charAt(0);
  const patronymicInitial = patronymic.charAt(0);
  const variants: string[] = [];

  for (const lastName of getAuthorLastNameVariants(author)) {
    variants.push(lastName);

    if (firstInitial) {
      variants.push(`${lastName} ${firstInitial}`);
      variants.push(`${lastName} ${firstInitial}.`);
    }

    if (firstInitial && patronymicInitial) {
      variants.push(`${lastName} ${firstInitial}${patronymicInitial}`);
      variants.push(`${lastName} ${firstInitial}.${patronymicInitial}.`);
      variants.push(`${lastName} ${firstInitial} ${patronymicInitial}`);
    }
  }

  return Array.from(
    new Set(
      variants.flatMap((variant) => [
        normalizeSearchText(variant),
        normalizeSearchText(transliterateRuToLat(variant)),
      ]),
    ),
  ).filter(Boolean);
}

function findAuthorsInText(authorsText: string, authors: AuthorOptionDto[]): AuthorOptionDto[] {
  const normalizedText = normalizeSearchText(authorsText);
  const transliteratedText = normalizeSearchText(transliterateRuToLat(authorsText));

  if (!normalizedText) {
    return [];
  }

  return authors.filter(
    (author) =>
      author.id !== null &&
      author.source === 'employee' &&
      buildAuthorMatchVariants(author).some(
        (variant) => normalizedText.includes(variant) || transliteratedText.includes(variant),
      ),
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

function getRelatedArticleLabel(articleLanguage: ArticleLanguage): string {
  if (articleLanguage === 'R') {
    return 'Переводная версия';
  }

  if (articleLanguage === 'F') {
    return 'Оригинальная версия';
  }

  return 'Связанная статья';
}

function detectArticleLanguage(title: string): ArticleLanguage {
  const value = title.trim();

  if (!value) {
    return '';
  }

  if (/[а-яё]/i.test(value)) {
    return 'R';
  }

  if (/[a-z]/i.test(value)) {
    return 'F';
  }

  return '';
}

function buildEmptyForm(workFormType: string, publicationTypeFlag: string): FormState {
  return {
    ...INITIAL_FORM,
    workFormType,
    publicationTypeFlag,
  };
}

export function PublicationsCreatePage() {
  const { user, isAuthenticated, isInitializing } = useAuth();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [workForms, setWorkForms] = useState<WorkFormTypeDto[]>([]);
  const [publicationTypes, setPublicationTypes] = useState<PublicationTypeDto[]>([]);
  const [allAuthors, setAllAuthors] = useState<AuthorOptionDto[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<SelectedAuthor[]>([]);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [selectorMode, setSelectorMode] = useState<SelectorMode>(null);
  const [selectorQuery, setSelectorQuery] = useState('');
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [journalResults, setJournalResults] = useState<AdminOptionDto[]>([]);
  const [publisherResults, setPublisherResults] = useState<AdminOptionDto[]>([]);
  const [authorResults, setAuthorResults] = useState<AuthorOptionDto[]>([]);
  const [sourceResults, setSourceResults] = useState<ArticleSearchItemDto[]>([]);
  const [relatedResults, setRelatedResults] = useState<ArticleSearchItemDto[]>([]);

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const publicationDateInputRef = useRef<HTMLInputElement | null>(null);

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
        setForm(buildEmptyForm(defaultWorkForm.value, publicationTypeItems[0]?.value ?? ''));

        const authorsResponse = await getAdminAuthors({ all: true });
        if (isMounted) {
          setAllAuthors(authorsResponse.items);
        }
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
  const detectedArticleLanguage = useMemo(
    () => detectArticleLanguage(form.title),
    [form.title],
  );

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
    const isArticleSelector = selectorMode === 'source' || selectorMode === 'related';
    const isSearchRequiredSelector =
      isArticleSelector || selectorMode === 'author' || selectorMode === 'journal';
    const trimmedSelectorQuery = selectorQuery.trim();

    if (isSearchRequiredSelector && !trimmedSelectorQuery) {
      setSelectorLoading(false);
      if (selectorMode === 'source') {
        setSourceResults([]);
      } else if (selectorMode === 'related') {
        setRelatedResults([]);
      } else if (selectorMode === 'journal') {
        setJournalResults([]);
      } else {
        setAuthorResults([]);
      }
      return;
    }

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

        if (selectorMode === 'author') {
          const response = await getAdminAuthors({
            query: selectorQuery,
            page: 1,
            pageSize: 100,
          });
          if (isMounted) {
            setAuthorResults(response.items);
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

    const loadTimer = isSearchRequiredSelector
      ? window.setTimeout(() => {
          void loadSelectorItems();
        }, 300)
      : null;

    if (!isSearchRequiredSelector) {
      void loadSelectorItems();
    }

    return () => {
      isMounted = false;
      if (loadTimer !== null) {
        window.clearTimeout(loadTimer);
      }
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
      setSelectedAuthors([]);
      setForm(() => buildEmptyForm(nextValue, items[0]?.value ?? ''));
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
    setSelectedAuthors([]);
    setForm((prev) => buildEmptyForm(prev.workFormType, nextValue));
  };

  const openPublicationDatePicker = () => {
    const input = publicationDateInputRef.current;

    if (!input) {
      return;
    }

    input.showPicker?.();
    input.focus();
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
    } else if (mode === 'author') {
      setSelectorQuery('');
    } else {
      setSelectorQuery(form.relatedArticle?.title ?? '');
    }

    setSelectorMode(mode);
  };

  const appendAuthorToText = (authorName: string) => {
    setForm((prev) => {
      const currentAuthors = prev.authorsText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const hasAuthor = currentAuthors.some(
        (item) => item.toLowerCase() === authorName.toLowerCase(),
      );

      return {
        ...prev,
        authorsText: hasAuthor
          ? prev.authorsText
          : [...currentAuthors, authorName].join(', '),
      };
    });
  };

  const syncAuthorsFromText = () => {
    setError('');
    setSuccessMessage('');

    const matchedAuthors = findAuthorsInText(form.authorsText, allAuthors);

    setSelectedAuthors((prev) => {
      const prevById = new Map(prev.map((item) => [item.author.id, item]));

      return matchedAuthors.map((author) => ({
        author,
        affiliation: prevById.get(author.id)?.affiliation ?? '1',
        correspondingAuthor: prevById.get(author.id)?.correspondingAuthor ?? false,
      }));
    });
  };

  const updateSelectedAuthor = (
    authorId: number,
    patch: Partial<Pick<SelectedAuthor, 'affiliation' | 'correspondingAuthor'>>,
  ) => {
    setSelectedAuthors((prev) =>
      prev.map((item) => {
        if (item.author.id !== authorId) {
          return patch.correspondingAuthor ? { ...item, correspondingAuthor: false } : item;
        }

        return {
          ...item,
          ...patch,
        };
      }),
    );
  };

  const removeSelectedAuthor = (authorId: number) => {
    setSelectedAuthors((prev) => prev.filter((item) => item.author.id !== authorId));
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
      authors: selectedAuthors
        .filter((item) => item.author.id !== null)
        .map((item) => ({
          author_id: item.author.id as number,
          affiliation: Number(item.affiliation) || 1,
          corresponding_author: item.correspondingAuthor,
        })),
      abstract: form.abstract.trim() || null,
      doi: form.doi.trim() || null,
      work_form_type: form.workFormType || null,
      publication_type_flags: form.publicationTypeFlag ? [form.publicationTypeFlag] : [],
      keywords: normalizeKeywords(form.keywordsInput),
      article_language: detectedArticleLanguage || null,
      original_version_id:
        form.relatedArticle && detectedArticleLanguage === 'F' ? form.relatedArticle.id : null,
      translation_version_id:
        form.relatedArticle && detectedArticleLanguage === 'R' ? form.relatedArticle.id : null,
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
      setSelectedAuthors([]);
      setForm((prev) => buildEmptyForm(prev.workFormType, prev.publicationTypeFlag));
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
          <TextField
            variant="plain"
            height={40}
            radius={4}
            rootClassName={styles.selectorSearchField}
            fieldClassName={styles.formTextField}
            inputClassName={styles.formTextFieldInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск по названию, ISSN или ID"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && !selectorQuery.trim() ? (
              <div className={styles.selectorHint}>Введите название, ISSN или ID издания.</div>
            ) : null}
            {!selectorLoading && selectorQuery.trim() && journalResults.length === 0 ? (
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
          <TextField
            variant="plain"
            height={40}
            radius={4}
            rootClassName={styles.selectorSearchField}
            fieldClassName={styles.formTextField}
            inputClassName={styles.formTextFieldInput}
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

    if (selectorMode === 'author') {
      return (
        <div className={styles.selectorPanel}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorTitle}>Выбор автора</div>
            <button type="button" className={styles.selectorClose} onClick={closeSelector}>
              ×
            </button>
          </div>
          <TextField
            variant="plain"
            height={40}
            radius={4}
            rootClassName={styles.selectorSearchField}
            fieldClassName={styles.formTextField}
            inputClassName={styles.formTextFieldInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск по ФИО"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && !selectorQuery.trim() ? (
              <div className={styles.selectorHint}>Введите ФИО автора.</div>
            ) : null}
            {!selectorLoading && selectorQuery.trim() && authorResults.length === 0 ? (
              <div className={styles.selectorHint}>Совпадения не найдены.</div>
            ) : null}
            {authorResults.map((item) => (
              <button
                key={`${item.source}-${item.id ?? item.label}`}
                type="button"
                className={styles.selectorItem}
                onClick={() => {
                  appendAuthorToText(item.label);
                  closeSelector();
                }}
              >
                <div className={styles.selectorItemTitle}>{item.label}</div>
                {item.source === 'publication_author' ? (
                  <div className={styles.selectorItemMeta}>Автор из публикаций</div>
                ) : item.department_name || item.position ? (
                  <div className={styles.selectorItemMeta}>
                    {['Сотрудник', item.department_name, item.position].filter(Boolean).join(' · ')}
                  </div>
                ) : item.source === 'employee' ? (
                  <div className={styles.selectorItemMeta}>Сотрудник</div>
                ) : null}
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
          <TextField
            variant="plain"
            height={40}
            radius={4}
            rootClassName={styles.selectorSearchField}
            fieldClassName={styles.formTextField}
            inputClassName={styles.formTextFieldInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск по названию, DOI или ID"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && !selectorQuery.trim() ? (
              <div className={styles.selectorHint}>Введите название, DOI или ID статьи.</div>
            ) : null}
            {!selectorLoading && selectorQuery.trim() && sourceResults.length === 0 ? (
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
        <div className={styles.selectorHint}>
          Будет сохранено как: {getRelatedArticleLabel(detectedArticleLanguage).toLowerCase()}.
        </div>
        <TextField
          variant="plain"
          height={40}
          radius={4}
          rootClassName={styles.selectorSearchField}
          fieldClassName={styles.formTextField}
          inputClassName={styles.formTextFieldInput}
          value={selectorQuery}
          onChange={(event) => setSelectorQuery(event.target.value)}
          placeholder="Поиск по названию, DOI или ID"
        />
        <div className={styles.selectorResults}>
          {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
          {!selectorLoading && !selectorQuery.trim() ? (
            <div className={styles.selectorHint}>Введите название, DOI или ID статьи.</div>
          ) : null}
          {!selectorLoading && selectorQuery.trim() && relatedResults.length === 0 ? (
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
      <div className={`app-page ${styles.page}`}>
        <Header title="Добавить публикацию" />
        <main className="app-main">
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
      <div className={`app-page ${styles.page}`}>
        <Header title="Добавить публикацию" />
        <main className="app-main">
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
    <div className={`app-page ${styles.page}`}>
      <Header title="Добавить публикацию" />

      <main className="app-main">
        <div className="container app-block-group">
          {error ? <div className={styles.messageError}>{error}</div> : null}
          {successMessage ? <div className={styles.messageSuccess}>{successMessage}</div> : null}

          <section className={styles.card}>
            <div className={styles.typeRow}>
              <div className={styles.typeLabel}>Тип публикации</div>

              <Select
                className={styles.primarySelect}
                width={191}
                menuWidth={220}
                ariaLabel="Тип публикации"
                options={workForms.map((item) => ({
                  value: item.value,
                  label: getWorkFormLabel(item),
                }))}
                value={form.workFormType}
                onChange={(nextValue) => void handleWorkFormChange(nextValue)}
              />

              {showPublicationSubtype ? (
                <Select
                  className={styles.secondarySelect}
                  variant="outlined"
                  width={191}
                  menuWidth={220}
                  ariaLabel="Подтип публикации"
                  options={publicationTypes.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                  value={form.publicationTypeFlag}
                  onChange={handlePublicationTypeChange}
                />
              ) : null}
            </div>

            <div className={styles.formBody}>
              <TextField
                label={getTitlePlaceholder(variant)}
                height={40}
                radius={4}
                rootClassName={styles.fullWidthField}
                fieldClassName={styles.formTextField}
                inputClassName={styles.formTextFieldInput}
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
              />

              <TextField
                label={getAuthorsPlaceholder(variant)}
                height={40}
                radius={4}
                rootClassName={styles.fullWidthField}
                fieldClassName={styles.formTextField}
                inputClassName={styles.formTextFieldInput}
                value={form.authorsText}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    authorsText: event.target.value,
                  }))
                }
              />

              {selectedAuthors.length > 0 ? (
                <div className={styles.authorsPanel}>
                  <div className={styles.selectedAuthorsList}>
                    {selectedAuthors.map((item) => (
                      <div key={item.author.id} className={styles.selectedAuthorRow}>
                        <div className={styles.selectedAuthorName}>{item.author.label}</div>
                        <label className={styles.affiliationControl}>
                          <span>Количество аффилиаций</span>
                          <input
                            className={styles.affiliationInput}
                            type="number"
                            min="1"
                            max="9"
                            value={item.affiliation}
                            onChange={(event) =>
                              updateSelectedAuthor(item.author.id as number, {
                                affiliation: event.target.value,
                              })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className={styles.correspondingButton}
                          onClick={() =>
                            updateSelectedAuthor(item.author.id as number, {
                              correspondingAuthor: !item.correspondingAuthor,
                            })
                          }
                        >
                          <Checkbox checked={item.correspondingAuthor} />
                          <span>Автор для переписки</span>
                        </button>
                        <button
                          type="button"
                          className={styles.authorDeleteButton}
                          onClick={() => removeSelectedAuthor(item.author.id as number)}
                          aria-label={`Удалить автора ${item.author.label}`}
                        >
                          <Icon name="delete" size={20} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className={styles.authorsActions}>
                    <TextButton
                      label="Обновить"
                      iconName="sync"
                      className={styles.authorsTextButton}
                      onClick={syncAuthorsFromText}
                    />
                    <OutlineButton
                      label="Добавить"
                      iconName="add"
                      className={styles.addAuthorButton}
                      onClick={() => openSelector('author')}
                    />
                  </div>
                </div>
              ) : form.authorsText.trim() ? (
                <div className={styles.authorsEmptyActions}>
                  <TextButton
                    label="Обновить"
                    iconName="sync"
                    className={styles.authorsTextButton}
                    onClick={syncAuthorsFromText}
                  />
                  <OutlineButton
                    label="Добавить"
                    iconName="add"
                    className={styles.addAuthorButton}
                    onClick={() => openSelector('author')}
                  />
                </div>
              ) : null}

              {selectorMode === 'author' ? renderSelectorPanel() : null}

              {variant === 'article' ? (
                <div className={styles.lookupRow}>
                  <TextField
                    label="Издание"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
                    inputClassName={styles.formTextFieldInput}
                    value={form.journal?.label ?? ''}
                    readOnly
                    endContent={
                      form.journal ? (
                        <ClearFieldButton
                          label="Очистить издание"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              journal: null,
                            }))
                          }
                        />
                      ) : null
                    }
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
                  <TextField
                    label={sourceLabel}
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
                    inputClassName={styles.formTextFieldInput}
                    value={form.sourceText}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        sourceText: event.target.value,
                      }))
                    }
                  />
                  <Button
                    label="Выбрать"
                    className={styles.sideButton}
                    onClick={() => openSelector('source')}
                  />
                </div>
              ) : null}

              {variant === 'book-monograph' ? (
                <TextField
                  label="Редакция"
                  height={40}
                  radius={4}
                  rootClassName={styles.fullWidthField}
                  fieldClassName={styles.formTextField}
                  inputClassName={styles.formTextFieldInput}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                />
              ) : null}

              {variant === 'book-monograph' || variant === 'conference' ? (
                <div className={styles.lookupRow}>
                  <TextField
                    label="Издательство"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
                    inputClassName={styles.formTextFieldInput}
                    value={form.publisher?.label ?? ''}
                    readOnly
                    endContent={
                      form.publisher ? (
                        <ClearFieldButton
                          label="Очистить издательство"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              publisher: null,
                            }))
                          }
                        />
                      ) : null
                    }
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
                  <TextField
                    label="DOI"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={styles.formTextField}
                    inputClassName={styles.formTextFieldInput}
                    value={form.doi}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        doi: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    label="Страницы"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={styles.formTextField}
                    inputClassName={styles.formTextFieldInput}
                    value={form.pages}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        pages: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    ref={publicationDateInputRef}
                    label="Дата"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={styles.formTextField}
                    inputClassName={[
                      styles.formTextFieldInput,
                      styles.dateFieldInput,
                    ].join(' ')}
                    trailingIcon="calendar_month"
                    onTrailingIconClick={openPublicationDatePicker}
                    type="date"
                    value={form.publicationDate}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        publicationDate: event.target.value,
                      }))
                    }
                  />
                </div>
              ) : null}

              {variant === 'book-chapter' || variant === 'conference' ? (
                <>
                  <div className={styles.rowTwo}>
                    <TextField
                      label="DOI"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.doi}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          doi: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="URL"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.url}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          url: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className={styles.rowTwoLeft}>
                    <TextField
                      label="Страницы"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.pages}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          pages: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      ref={publicationDateInputRef}
                      label="Дата"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={[
                        styles.formTextFieldInput,
                        styles.dateFieldInput,
                      ].join(' ')}
                      trailingIcon="calendar_month"
                      onTrailingIconClick={openPublicationDatePicker}
                      type="date"
                      value={form.publicationDate}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          publicationDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              ) : null}

              {variant === 'book-monograph' ? (
                <>
                  <div className={styles.rowTwo}>
                    <TextField
                      label="ISBN"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.isbn}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          isbn: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="DOI"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.doi}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          doi: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className={styles.rowThree}>
                    <TextField
                      label="Год"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      type="number"
                      value={form.year}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          year: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="Тираж"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.tirage}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          tirage: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="Объем работы"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.extentOfWork}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          extentOfWork: event.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              ) : null}

              <RichTextField
                label="Аннотация"
                placeholder="Аннотация"
                value={form.abstract}
                onChange={(nextValue) =>
                  setForm((prev) => ({
                    ...prev,
                    abstract: nextValue,
                  }))
                }
              />

              <div className={styles.keywordsField}>
                {form.keywordsInput.trim() ? (
                  <span className={styles.keywordsLabel}>Ключевые слова</span>
                ) : null}
                <KeywordSearchInput
                  value={form.keywordsInput}
                  placeholder="Ключевые слова"
                  onChange={(nextValue) =>
                    setForm((prev) => ({
                      ...prev,
                      keywordsInput: nextValue,
                    }))
                  }
                />
              </div>

              <div className={styles.lookupRow}>
                <TextField
                  label="Файл PDF"
                  height={40}
                  radius={4}
                  rootClassName={styles.fullWidthField}
                  fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
                  inputClassName={styles.formTextFieldInput}
                  value={form.pdfFileName}
                  readOnly
                  endContent={
                    form.pdfFileName ? (
                      <ClearFieldButton
                        label="Очистить файл PDF"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            pdfFileName: '',
                            pdfFile: null,
                          }));
                          if (pdfInputRef.current) {
                            pdfInputRef.current.value = '';
                          }
                        }}
                      />
                    ) : null
                  }
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
                  {!form.relatedArticle ? (
                    <div className={styles.lookupRow}>
                      <TextField
                        label="Связанная статья"
                        height={40}
                        radius={4}
                        rootClassName={styles.fullWidthField}
                        fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
                        inputClassName={styles.formTextFieldInput}
                        value=""
                        readOnly
                      />
                      <Button
                        label="Выбрать"
                        className={styles.sideButton}
                        onClick={() => openSelector('related')}
                      />
                    </div>
                  ) : null}

                  {form.relatedArticle ? (
                    <div className={styles.relatedArticleCard}>
                      <span className={styles.relatedArticleLabel}>
                        {getRelatedArticleLabel(detectedArticleLanguage)}
                      </span>
                      <div className={styles.relatedArticleContent}>
                        <div className={styles.relatedArticleMain}>
                          <div className={styles.relatedArticleTitle}>
                            {getSourceItemTitle(form.relatedArticle)}
                          </div>
                          {form.relatedArticle.authors ? (
                            <div className={styles.relatedArticleAuthors}>
                              {form.relatedArticle.authors}
                            </div>
                          ) : null}
                          {form.relatedArticle.doi ? (
                            <div className={styles.relatedArticleDoi}>
                              <span>DOI:</span> {form.relatedArticle.doi}
                            </div>
                          ) : null}
                        </div>
                        <div className={styles.relatedArticleMeta}>
                          {form.relatedArticle.journal ? (
                            <span>{form.relatedArticle.journal}</span>
                          ) : null}
                          {form.relatedArticle.year ? (
                            <span>{form.relatedArticle.year}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className={styles.relatedArticleUnlink}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              relatedArticle: null,
                            }))
                          }
                          aria-label="Отвязать связанную статью"
                        >
                          <Icon name="link_off" size={24} />
                        </button>
                      </div>
                    </div>
                  ) : null}

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
